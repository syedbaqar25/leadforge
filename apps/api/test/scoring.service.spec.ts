import { ScoringService } from '../src/modules/scoring/scoring.service';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('ScoringService — Lead Prioritization & Explainable Scoring', () => {
  let scoringService: ScoringService;
  let mockPrisma: any;
  let mockAuditService: any;

  const orgId = 'org-tenant-123';
  const userId = 'user-agent-456';

  beforeEach(() => {
    mockPrisma = {
      client: {
        lead: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
          update: jest.fn(),
        },
        scoringRuleSet: {
          findFirst: jest.fn(),
          create: jest.fn(),
          updateMany: jest.fn(),
        },
        leadScoreHistory: {
          create: jest.fn().mockResolvedValue({ id: 'hist-1' }),
          findMany: jest.fn(),
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

    scoringService = new ScoringService(mockPrisma, mockAuditService);
  });

  describe('Pure Multi-Factor Score Calculation', () => {
    it('computes a Hot score (>= 75) with explainable factors for a high-intent enterprise lead', () => {
      const enterpriseLead = {
        fullName: 'Eleanor Vance',
        jobTitle: 'Chief Information Officer',
        budgetAmount: new Prisma.Decimal(750000),
        budgetCurrency: 'INR',
        purchaseTimeline: 'Immediate Q1 rollout',
        emailNormalized: 'eleanor.vance@enterprise.com',
        phoneNormalized: '+919876543210',
        company: 'Vance Dynamics',
        website: 'https://vancedynamics.com',
      };

      const result = scoringService.evaluateLead(enterpriseLead);

      // 30 (budget) + 25 (timeline) + 20 (seniority) + 15 (contact) + 10 (company) = 100
      expect(result.score).toBe(100);
      expect(result.scoreBand).toBe('hot');
      expect(result.factors.length).toBe(5);

      const budgetFactor = result.factors.find((f) => f.factorName === 'Budget Authority');
      expect(budgetFactor?.points).toBe(30);
      expect(budgetFactor?.impact).toBe('positive');

      const urgencyFactor = result.factors.find((f) => f.factorName === 'Purchase Urgency');
      expect(urgencyFactor?.points).toBe(25);
      expect(urgencyFactor?.impact).toBe('positive');

      const seniorityFactor = result.factors.find(
        (f) => f.factorName === 'Decision Maker Seniority',
      );
      expect(seniorityFactor?.points).toBe(20);
      expect(seniorityFactor?.impact).toBe('positive');
    });

    it('computes a Warm score (40-74) for a mid-tier lead with partial information', () => {
      const midTierLead = {
        fullName: 'Alex Rivera',
        jobTitle: 'Marketing Director',
        budgetAmount: new Prisma.Decimal(150000),
        budgetCurrency: 'INR',
        purchaseTimeline: 'Q2 evaluation',
        emailNormalized: 'alex.rivera@midco.com',
        phoneNormalized: null,
        company: 'Midco Retail',
        website: null,
      };

      const result = scoringService.evaluateLead(midTierLead);

      // 20 (budget) + 15 (timeline) + 15 (director seniority) + 10 (email only) + 5 (company only) = 65
      expect(result.score).toBe(65);
      expect(result.scoreBand).toBe('warm');
    });

    it('computes a Cold score (< 40) for a lead with missing budget, timeline, and title', () => {
      const coldLead = {
        fullName: 'Anonymous User',
        jobTitle: null,
        budgetAmount: null,
        purchaseTimeline: null,
        emailNormalized: 'user@gmail.com',
        phoneNormalized: null,
        company: null,
        website: null,
      };

      const result = scoringService.evaluateLead(coldLead);

      // 0 (budget) + 0 (timeline) + 0 (title) + 10 (email only) + 0 (company) = 10
      expect(result.score).toBe(10);
      expect(result.scoreBand).toBe('cold');
    });
  });

  describe('Lead Score Persistence & Timeline Auditing', () => {
    it('persists LeadScoreHistory and creates score_change activity when score changes', async () => {
      const lead = {
        id: 'lead-test-1',
        organizationId: orgId,
        score: 20,
        scoreBand: 'cold',
        budgetAmount: new Prisma.Decimal(600000),
        purchaseTimeline: 'Immediate',
        jobTitle: 'VP Technology',
        emailNormalized: 'test@example.com',
        phoneNormalized: '+919876543210',
        company: 'Tech Corp',
        website: 'https://techcorp.com',
      };

      mockPrisma.client.lead.findFirst.mockResolvedValue(lead);
      mockPrisma.client.scoringRuleSet.findFirst.mockResolvedValue({
        id: 'rules-v1',
        version: 1,
        rules: {},
      });
      mockPrisma.client.lead.update.mockResolvedValue({
        ...lead,
        score: 100,
        scoreBand: 'hot',
      });

      const result = await scoringService.scoreLead(orgId, 'lead-test-1', userId);

      expect(result.score).toBe(100);
      expect(result.scoreBand).toBe('hot');
      expect(result.hasChanged).toBe(true);

      // Verify LeadScoreHistory audit entry
      expect(mockPrisma.client.leadScoreHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            leadId: 'lead-test-1',
            score: 100,
            band: 'hot',
            ruleSetVersion: 1,
            factors: expect.any(Array),
          }),
        }),
      );

      // Verify lead updated
      expect(mockPrisma.client.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead-test-1' },
        data: { score: 100, scoreBand: 'hot' },
      });

      // Verify activity created
      expect(mockPrisma.client.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            activityType: 'score_change',
            leadId: 'lead-test-1',
            description: expect.stringContaining('20 → 100 (Band: HOT)'),
          }),
        }),
      );
    });

    it('throws 404 when scoring a lead from another tenant', async () => {
      mockPrisma.client.lead.findFirst.mockResolvedValue(null);

      await expect(scoringService.scoreLead(orgId, 'cross-tenant-lead-id', userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Scoring Rule Set Versioning', () => {
    it('increments version and deactivates prior rules when rules are updated', async () => {
      mockPrisma.client.scoringRuleSet.findFirst.mockResolvedValue({
        id: 'rules-v1',
        version: 1,
        isActive: true,
      });

      mockPrisma.client.scoringRuleSet.create.mockResolvedValue({
        id: 'rules-v2',
        version: 2,
        isActive: true,
      });

      const result = await scoringService.updateRuleSet(orgId, userId, {
        rules: { budgetWeight: 35, timelineWeight: 25 },
        recalculateAllLeads: false,
      });

      expect(result.version).toBe(2);
      expect(mockPrisma.client.scoringRuleSet.updateMany).toHaveBeenCalledWith({
        where: { organizationId: orgId, isActive: true },
        data: { isActive: false },
      });
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'scoring:update_rules' }),
      );
    });
  });
});
