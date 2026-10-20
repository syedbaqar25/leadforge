import { AnalyticsService } from '../src/modules/analytics/analytics.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { escapeCsvCell, generateCsv } from '../src/common/security/csv-export';

describe('Analytics & Audit Logs Engine', () => {
  let analyticsService: AnalyticsService;
  let auditService: AuditService;
  let mockPrisma: any;

  const orgId = 'org-tenant-123';

  beforeEach(() => {
    mockPrisma = {
      client: {
        lead: {
          count: jest.fn(),
          findMany: jest.fn(),
        },
        deal: {
          findMany: jest.fn(),
        },
        pipelineStage: {
          findMany: jest.fn(),
        },
        aiAnalysis: {
          findMany: jest.fn(),
        },
        usageCounter: {
          findMany: jest.fn(),
        },
        organization: {
          findUnique: jest.fn(),
        },
        auditLog: {
          create: jest.fn(),
          findMany: jest.fn(),
          count: jest.fn(),
        },
      },
    };

    analyticsService = new AnalyticsService(mockPrisma);
    auditService = new AuditService(mockPrisma);
  });

  describe('CSV Formula Injection Defense (CWE-1236)', () => {
    it('neutralizes cells starting with = by prepending a single quote', () => {
      const maliciousCell = '=SUM(A1:A10)';
      const escaped = escapeCsvCell(maliciousCell);
      expect(escaped).toBe("'=SUM(A1:A10)");
    });

    it('neutralizes DDE command execution payloads starting with =cmd', () => {
      const ddePayload = "=cmd|'/C calc'!A0";
      const escaped = escapeCsvCell(ddePayload);
      expect(escaped).toBe("'=cmd|'/C calc'!A0");
    });

    it('neutralizes cells starting with +, -, @, or tabs', () => {
      expect(escapeCsvCell('+12345')).toBe("'+12345");
      expect(escapeCsvCell('-cmd')).toBe("'-cmd");
      expect(escapeCsvCell('@SUM(1,2)')).toBe('"\'@SUM(1,2)"');
    });

    it('properly quotes and escapes cells containing commas and double quotes', () => {
      const complexCell = 'Acme, "Special" Services';
      const escaped = escapeCsvCell(complexCell);
      expect(escaped).toBe('"Acme, ""Special"" Services"');
    });

    it('leaves standard text unchanged', () => {
      expect(escapeCsvCell('lead.create')).toBe('lead.create');
      expect(escapeCsvCell('user-uuid-123')).toBe('user-uuid-123');
    });

    it('generates fully escaped CSV output with header row', () => {
      const headers = ['Action', 'Payload'];
      const rows = [
        ['lead.update', 'Standard update'],
        ['=EXPORT()', 'Formula injection attempt'],
      ];

      const csv = generateCsv(headers, rows);
      expect(csv).toContain('Action,Payload');
      expect(csv).toContain("'=EXPORT(),Formula injection attempt");
    });
  });

  describe('Audit Log Querying and Export', () => {
    it('retrieves paginated audit logs scoped strictly to organization', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          organizationId: orgId,
          action: 'lead.created',
          entityType: 'lead',
          createdAt: new Date(),
        },
      ];

      mockPrisma.client.auditLog.findMany.mockResolvedValue(mockLogs);
      mockPrisma.client.auditLog.count.mockResolvedValue(1);

      const result = await auditService.getAuditLogs(orgId, { page: 1, pageSize: 25 });
      expect(result.data.length).toBe(1);
      expect(result.meta.total).toBe(1);
      expect(mockPrisma.client.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: orgId }),
        }),
      );
    });

    it('exports audit logs into formula-safe CSV', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          organizationId: orgId,
          action: '=MALICIOUS_LOG',
          entityType: 'lead',
          entityId: 'lead-1',
          userId: 'user-1',
          ipAddress: '192.168.1.1',
          createdAt: new Date('2026-10-19T12:00:00Z'),
        },
      ];

      mockPrisma.client.auditLog.findMany.mockResolvedValue(mockLogs);

      const csv = await auditService.exportAuditLogsCsv(orgId);
      expect(csv).toContain(
        'Log ID,Action,Entity Type,Entity ID,User ID,IP Address,Timestamp (UTC)',
      );
      // Verify the =MALICIOUS_LOG action is escaped with leading quote
      expect(csv).toContain("'=MALICIOUS_LOG");
    });
  });

  describe('Lead Velocity & Conversion Analytics', () => {
    it('calculates velocity per day, source conversion rates, and score band distribution', async () => {
      mockPrisma.client.lead.count
        .mockResolvedValueOnce(10) // total leads
        .mockResolvedValueOnce(6); // leads in last 30 days

      mockPrisma.client.lead.findMany.mockResolvedValue([
        {
          id: '1',
          source: 'Website',
          campaign: 'Q4_Ads',
          status: 'converted',
          scoreBand: 'hot',
          score: 85,
          createdAt: new Date(),
        },
        {
          id: '2',
          source: 'Website',
          campaign: 'Q4_Ads',
          status: 'new',
          scoreBand: 'warm',
          score: 55,
          createdAt: new Date(),
        },
        {
          id: '3',
          source: 'Referral',
          campaign: null,
          status: 'converted',
          scoreBand: 'hot',
          score: 90,
          createdAt: new Date(),
        },
        {
          id: '4',
          source: 'Cold_Outreach',
          campaign: 'Email_Blast',
          status: 'lost',
          scoreBand: 'cold',
          score: 20,
          createdAt: new Date(),
        },
      ]);

      const analytics = await analyticsService.getLeadAnalytics(orgId, 30);

      expect(analytics.totalLeads).toBe(10);
      expect(analytics.newLeadsInPeriod).toBe(6);
      expect(analytics.leadVelocityPerDay).toBe(0.2); // 6 / 30
      expect(analytics.overallConversionRate).toBe(20); // (2 / 10) * 100

      // Check source breakdown
      const websiteSource = analytics.bySource.find((s) => s.source === 'Website');
      expect(websiteSource).toBeDefined();
      expect(websiteSource?.total).toBe(2);
      expect(websiteSource?.converted).toBe(1);
      expect(websiteSource?.conversionRate).toBe(50); // (1 / 2) * 100

      // Check score band breakdown
      expect(analytics.byScoreBand.hot).toBe(2);
      expect(analytics.byScoreBand.warm).toBe(1);
      expect(analytics.byScoreBand.cold).toBe(1);
    });
  });

  describe('Pipeline Stage Funnel & Deal Velocity', () => {
    it('calculates stage conversion funnel, revenue won, win rate, and deal cycle velocity', async () => {
      const created10DaysAgo = new Date(Date.now() - 10 * 86400000);
      const created5DaysAgo = new Date(Date.now() - 5 * 86400000);
      const now = new Date();

      mockPrisma.client.pipelineStage.findMany.mockResolvedValue([
        { id: 'stage-1', name: 'Qualified', sortOrder: 1, stageType: 'open' },
        { id: 'stage-2', name: 'Proposal Sent', sortOrder: 2, stageType: 'open' },
        { id: 'stage-3', name: 'Closed Won', sortOrder: 3, stageType: 'won' },
        { id: 'stage-4', name: 'Closed Lost', sortOrder: 4, stageType: 'lost' },
      ]);

      mockPrisma.client.deal.findMany.mockResolvedValue([
        {
          id: 'deal-1',
          stageId: 'stage-1',
          value: 10000,
          createdAt: created10DaysAgo,
          closedAt: null,
          stage: { stageType: 'open' },
        },
        {
          id: 'deal-2',
          stageId: 'stage-3',
          value: 50000,
          createdAt: created10DaysAgo,
          closedAt: now, // 10 day cycle
          stage: { stageType: 'won' },
        },
        {
          id: 'deal-3',
          stageId: 'stage-4',
          value: 20000,
          createdAt: created5DaysAgo,
          closedAt: now, // 5 day cycle
          stage: { stageType: 'lost' },
        },
      ]);

      const dealAnalytics = await analyticsService.getDealAnalytics(orgId);

      expect(dealAnalytics.totalDeals).toBe(3);
      expect(dealAnalytics.openDealsCount).toBe(1);
      expect(dealAnalytics.openPipelineValue).toBe(10000);
      expect(dealAnalytics.wonDealsCount).toBe(1);
      expect(dealAnalytics.wonRevenue).toBe(50000);
      expect(dealAnalytics.lostDealsCount).toBe(1);
      expect(dealAnalytics.winRate).toBe(50); // 1 won / (1 won + 1 lost)
      expect(dealAnalytics.averageDealSize).toBe(50000);
      expect(dealAnalytics.averageDealVelocityDays).toBe(7.5); // (10 + 5) / 2
      expect(dealAnalytics.stageFunnel.length).toBe(4);
    });
  });

  describe('AI Token & Cost Accounting', () => {
    it('aggregates prompt, completion, total tokens, and cost in cents/dollars', async () => {
      mockPrisma.client.aiAnalysis.findMany.mockResolvedValue([
        {
          analysisType: 'qualification',
          promptTokens: 500,
          completionTokens: 200,
          totalTokens: 700,
          costCents: 15,
          createdAt: new Date(),
        },
        {
          analysisType: 'summary',
          promptTokens: 300,
          completionTokens: 100,
          totalTokens: 400,
          costCents: 8,
          createdAt: new Date(),
        },
      ]);

      mockPrisma.client.usageCounter.findMany.mockResolvedValue([
        { metric: 'ai_requests', count: 25, limitValue: 1000 },
      ]);

      mockPrisma.client.organization.findUnique.mockResolvedValue({
        aiEnabled: true,
        settings: {},
      });

      const aiAnalytics = await analyticsService.getAiUsageAnalytics(orgId);

      expect(aiAnalytics.summary.totalTokens).toBe(1100);
      expect(aiAnalytics.summary.totalPromptTokens).toBe(800);
      expect(aiAnalytics.summary.totalCompletionTokens).toBe(300);
      expect(aiAnalytics.summary.totalCostCents).toBe(23);
      expect(aiAnalytics.summary.totalCostDollars).toBe(0.23);
      expect(aiAnalytics.byType.length).toBe(2);
      expect(aiAnalytics.monthlyCounters[0]?.metric).toBe('ai_requests');
    });
  });
});
