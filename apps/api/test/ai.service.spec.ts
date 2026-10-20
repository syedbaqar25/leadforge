import { AiService } from '../src/modules/ai/ai.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('AiService — AI Sales Assistant & Lead Intelligence', () => {
  let aiService: AiService;
  let mockPrisma: any;
  let mockAuditService: any;
  let mockConfigService: any;

  const orgId = 'org-tenant-123';
  const otherOrgId = 'org-tenant-other';
  const userId = 'user-agent-456';

  const mockOrg = {
    id: orgId,
    name: 'Acme SaaS',
    aiEnabled: true,
  };

  const mockLead = {
    id: 'lead-uuid-1',
    organizationId: orgId,
    fullName: 'Robert Oppenheimer',
    jobTitle: 'Director of Research',
    company: 'Los Alamos Labs',
    industry: 'Advanced Technologies',
    requirements: 'Automated high-throughput pipeline for research data delivery',
    budgetAmount: new Prisma.Decimal(1200000),
    budgetCurrency: 'INR',
    purchaseTimeline: 'Immediate Q2',
    source: 'inbound',
    emailRaw: 'robert@losalamos.gov',
    phoneRaw: '+919988776655',
    deletedAt: null,
    notes: [],
    activities: [],
  };

  beforeEach(() => {
    mockPrisma = {
      client: {
        organization: {
          findUnique: jest.fn(),
        },
        lead: {
          findFirst: jest.fn(),
        },
        aiAnalysis: {
          create: jest.fn(),
          findMany: jest.fn(),
        },
        usageCounter: {
          upsert: jest.fn().mockResolvedValue({ id: 'counter-1' }),
        },
        message: {
          create: jest.fn(),
        },
        approvalRequest: {
          create: jest.fn(),
        },
        activity: {
          create: jest.fn().mockResolvedValue({ id: 'act-1' }),
        },
        $transaction: jest.fn(async (cbOrArray) => {
          if (typeof cbOrArray === 'function') {
            return cbOrArray(mockPrisma.client);
          }
          return Promise.all(cbOrArray);
        }),
      },
    };

    mockAuditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'OPENAI_API_KEY') return 'sk-test-sandbox-placeholder'; // fake
        if (key === 'OPENAI_MODEL') return 'gpt-4o';
        return undefined;
      }),
    };

    aiService = new AiService(mockPrisma, mockAuditService, mockConfigService);
  });

  describe('Lead Intelligence & Analysis', () => {
    it('analyzes lead qualification and stores structured AiAnalysis with token quota accounting', async () => {
      mockPrisma.client.organization.findUnique.mockResolvedValue(mockOrg);
      mockPrisma.client.lead.findFirst.mockResolvedValue(mockLead);

      const createdAnalysisRecord = {
        id: 'analysis-uuid-1',
        organizationId: orgId,
        leadId: mockLead.id,
        analysisType: 'qualification',
        result: {},
        modelName: 'sandbox-deterministic',
        promptTokens: 420,
        completionTokens: 180,
        totalTokens: 600,
        costCents: 1,
        createdAt: new Date(),
      };

      mockPrisma.client.aiAnalysis.create.mockResolvedValue(createdAnalysisRecord);

      const result = await aiService.analyzeLead(orgId, userId, mockLead.id, {
        focus: 'full',
        contextNotes: 'Lead mentioned evaluating multiple CRM solutions.',
      });

      expect(result.leadId).toBe(mockLead.id);
      expect(result.analysis.qualificationScore).toBeGreaterThanOrEqual(70);
      expect(result.analysis.keyPainPoints.length).toBeGreaterThan(0);
      expect(result.analysis.buyingIntentIndicators.length).toBeGreaterThan(0);
      expect(result.tokenUsage.totalTokens).toBe(600);

      // Verify token quota usage counter was incremented
      expect(mockPrisma.client.usageCounter.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId_metric_period: expect.objectContaining({
              organizationId: orgId,
              metric: 'openai_tokens',
            }),
          }),
        }),
      );

      // Verify audit log
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ai.analyze_lead',
          entityType: 'ai_analysis',
        }),
      );
    });

    it('honors organization AI disabled toggle and rejects analysis with 403 Forbidden', async () => {
      mockPrisma.client.organization.findUnique.mockResolvedValue({
        ...mockOrg,
        aiEnabled: false,
      });

      await expect(
        aiService.analyzeLead(orgId, userId, mockLead.id, { focus: 'full' }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.client.lead.findFirst).not.toHaveBeenCalled();
    });

    it('rejects analysis of cross-tenant lead with 404 Not Found (BOLA/IDOR)', async () => {
      mockPrisma.client.organization.findUnique.mockResolvedValue(mockOrg);
      mockPrisma.client.lead.findFirst.mockResolvedValue(null);

      await expect(
        aiService.analyzeLead(orgId, userId, 'cross-tenant-lead-id', { focus: 'full' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Message Draft Generation & Human-in-the-Loop', () => {
    it('drafts personalized message and creates a pending approval request', async () => {
      mockPrisma.client.organization.findUnique.mockResolvedValue(mockOrg);
      mockPrisma.client.lead.findFirst.mockResolvedValue(mockLead);

      const mockCreatedMessage = {
        id: 'msg-uuid-1',
        organizationId: orgId,
        leadId: mockLead.id,
        direction: 'outbound',
        channel: 'email',
        status: 'pending_approval',
      };

      const mockCreatedApproval = {
        id: 'app-uuid-1',
        organizationId: orgId,
        approvalType: 'message_send',
        entityType: 'message',
        entityId: 'msg-uuid-1',
        status: 'pending',
        version: 1,
      };

      mockPrisma.client.message.create.mockResolvedValue(mockCreatedMessage);
      mockPrisma.client.approvalRequest.create.mockResolvedValue(mockCreatedApproval);

      const result = await aiService.generateDraft(orgId, userId, mockLead.id, {
        channel: 'email',
        tone: 'consultative',
        goal: 'initial_pitch',
      });

      expect(result.messageId).toBe('msg-uuid-1');
      expect(result.approvalRequestId).toBe('app-uuid-1');
      expect(result.status).toBe('pending_approval');
      expect(result.draft.subject).toContain('Accelerating sales productivity');
      expect(result.draft.body).toContain('streamlining business growth');

      // Verify Message was created in pending_approval status
      expect(mockPrisma.client.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'pending_approval',
            leadId: mockLead.id,
            channel: 'email',
          }),
        }),
      );

      // Verify ApprovalRequest was created with pending status and version 1
      expect(mockPrisma.client.approvalRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'pending',
            version: 1,
            entityType: 'message',
            entityId: 'msg-uuid-1',
          }),
        }),
      );
    });

    it('supports WhatsApp drafts with concise pitch copy', async () => {
      mockPrisma.client.organization.findUnique.mockResolvedValue(mockOrg);
      mockPrisma.client.lead.findFirst.mockResolvedValue(mockLead);

      mockPrisma.client.message.create.mockResolvedValue({ id: 'msg-wa-1' });
      mockPrisma.client.approvalRequest.create.mockResolvedValue({ id: 'app-wa-1' });

      const result = await aiService.generateDraft(orgId, userId, mockLead.id, {
        channel: 'whatsapp',
        tone: 'conversational',
      });

      expect(result.channel).toBe('whatsapp');
      expect(result.draft.channel).toBe('whatsapp');
      expect(result.draft.estimatedReadSeconds).toBeLessThanOrEqual(20);
    });
  });
});
