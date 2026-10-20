import { DealsService } from '../src/modules/deals/deals.service';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('DealsService — Pipeline & Deal Tracking (PART 12 Phase 5)', () => {
  let dealsService: DealsService;
  let mockPrisma: any;
  let mockAuditService: any;

  const orgId = 'org-tenant-123';
  const otherOrgId = 'org-tenant-other';
  const userId = 'user-sales-456';

  const mockPipeline = {
    id: 'pipe-uuid-1',
    organizationId: orgId,
    name: 'Enterprise Sales Pipeline',
    isDefault: true,
    stages: [
      {
        id: 'stage-1',
        pipelineId: 'pipe-uuid-1',
        name: 'Qualified',
        sortOrder: 1,
        stageType: 'open',
      },
      {
        id: 'stage-2',
        pipelineId: 'pipe-uuid-1',
        name: 'Proposal Sent',
        sortOrder: 2,
        stageType: 'open',
      },
      {
        id: 'stage-3',
        pipelineId: 'pipe-uuid-1',
        name: 'Closed Won',
        sortOrder: 3,
        stageType: 'won',
      },
      {
        id: 'stage-4',
        pipelineId: 'pipe-uuid-1',
        name: 'Closed Lost',
        sortOrder: 4,
        stageType: 'lost',
      },
    ],
  };

  const mockLead = {
    id: 'lead-uuid-1',
    organizationId: orgId,
    fullName: 'David Warner',
    company: 'Warner Media',
    emailRaw: 'david@warnermedia.com',
    phoneRaw: '+919876543210',
    deletedAt: null,
  };

  beforeEach(() => {
    mockPrisma = {
      client: {
        deal: {
          create: jest.fn(),
          findFirst: jest.fn(),
          findMany: jest.fn(),
          update: jest.fn(),
          count: jest.fn(),
        },
        dealStageHistory: {
          create: jest.fn().mockResolvedValue({ id: 'hist-uuid-1' }),
          findMany: jest.fn(),
        },
        pipeline: {
          create: jest.fn(),
          findFirst: jest.fn(),
          findMany: jest.fn(),
          update: jest.fn(),
          updateMany: jest.fn(),
          delete: jest.fn(),
          count: jest.fn(),
          findUniqueOrThrow: jest.fn(),
        },
        pipelineStage: {
          create: jest.fn(),
          findFirst: jest.fn(),
          findMany: jest.fn(),
          update: jest.fn(),
          updateMany: jest.fn(),
          delete: jest.fn(),
          aggregate: jest.fn(),
        },
        lead: {
          findFirst: jest.fn(),
        },
        membership: {
          findFirst: jest.fn(),
        },
        activity: {
          create: jest.fn().mockResolvedValue({ id: 'act-uuid-1' }),
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

    dealsService = new DealsService(mockPrisma, mockAuditService);
  });

  describe('Deal Creation', () => {
    it('creates a new deal with version 1, initial stage history, and activity logging', async () => {
      mockPrisma.client.lead.findFirst.mockResolvedValue(mockLead);
      mockPrisma.client.pipeline.findFirst.mockResolvedValue(mockPipeline);
      mockPrisma.client.pipelineStage.findFirst.mockResolvedValue(mockPipeline.stages[0]);

      const createdDealRecord = {
        id: 'deal-uuid-1',
        organizationId: orgId,
        leadId: mockLead.id,
        pipelineId: mockPipeline.id,
        stageId: 'stage-1',
        title: 'Q4 Media Campaign',
        value: new Prisma.Decimal(250000),
        currency: 'INR',
        version: 1,
        closedAt: null,
      };

      mockPrisma.client.deal.create.mockResolvedValue(createdDealRecord);

      const result = await dealsService.createDeal(orgId, userId, {
        leadId: mockLead.id,
        pipelineId: mockPipeline.id,
        stageId: 'stage-1',
        title: 'Q4 Media Campaign',
        value: 250000,
        currency: 'INR',
      });

      expect(result.id).toBe('deal-uuid-1');
      expect(result.version).toBe(1);

      // Verify stage history record created with fromStageId = null
      expect(mockPrisma.client.dealStageHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dealId: 'deal-uuid-1',
            fromStageId: null,
            toStageId: 'stage-1',
          }),
        }),
      );

      // Verify Activity created for deal creation
      expect(mockPrisma.client.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: orgId,
            dealId: 'deal-uuid-1',
            activityType: 'deal_created',
          }),
        }),
      );

      // Verify audit log
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deal.create',
          entityType: 'deal',
          entityId: 'deal-uuid-1',
        }),
      );
    });

    it('rejects deal creation if lead does not belong to the organization (BOLA/IDOR)', async () => {
      mockPrisma.client.lead.findFirst.mockResolvedValue(null);

      await expect(
        dealsService.createDeal(orgId, userId, {
          leadId: 'unauthorized-lead',
          pipelineId: mockPipeline.id,
          stageId: 'stage-1',
          title: 'Unauthorized Deal',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects deal creation if stage does not belong to pipeline', async () => {
      mockPrisma.client.lead.findFirst.mockResolvedValue(mockLead);
      mockPrisma.client.pipeline.findFirst.mockResolvedValue(mockPipeline);
      mockPrisma.client.pipelineStage.findFirst.mockResolvedValue(null);

      await expect(
        dealsService.createDeal(orgId, userId, {
          leadId: mockLead.id,
          pipelineId: mockPipeline.id,
          stageId: 'foreign-stage-id',
          title: 'Mismatch Deal',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Optimistic Concurrency Control', () => {
    it('successfully updates deal and increments version when version matches', async () => {
      const existingDeal = {
        id: 'deal-uuid-1',
        organizationId: orgId,
        leadId: mockLead.id,
        pipelineId: mockPipeline.id,
        stageId: 'stage-1',
        title: 'Initial Title',
        value: new Prisma.Decimal(100000),
        version: 2,
        closedAt: null,
        stage: mockPipeline.stages[0],
      };

      mockPrisma.client.deal.findFirst.mockResolvedValue(existingDeal);

      const updatedDealRecord = {
        ...existingDeal,
        title: 'Updated Title',
        version: 3,
      };

      mockPrisma.client.deal.update.mockResolvedValue(updatedDealRecord);

      const result = await dealsService.updateDeal(orgId, userId, 'deal-uuid-1', {
        version: 2,
        title: 'Updated Title',
      });

      expect(result.version).toBe(3);
      expect(mockPrisma.client.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Updated Title',
            version: { increment: 1 },
          }),
        }),
      );
    });

    it('rejects update with 409 Conflict when version does not match database version', async () => {
      const existingDeal = {
        id: 'deal-uuid-1',
        organizationId: orgId,
        leadId: mockLead.id,
        pipelineId: mockPipeline.id,
        stageId: 'stage-1',
        title: 'Current DB Title',
        version: 5,
        stage: mockPipeline.stages[0],
      };

      mockPrisma.client.deal.findFirst.mockResolvedValue(existingDeal);

      // Client sends stale version 3 instead of current version 5
      await expect(
        dealsService.updateDeal(orgId, userId, 'deal-uuid-1', {
          version: 3,
          title: 'Stale Update',
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.client.deal.update).not.toHaveBeenCalled();
    });
  });

  describe('Deal Stage Progression & State Machine', () => {
    it('records DealStageHistory and deal_moved Activity when moving between open stages', async () => {
      const existingDeal = {
        id: 'deal-uuid-1',
        organizationId: orgId,
        leadId: mockLead.id,
        pipelineId: mockPipeline.id,
        stageId: 'stage-1',
        title: 'Quarterly Renewal',
        version: 1,
        closedAt: null,
        stage: mockPipeline.stages[0], // 'Qualified'
      };

      mockPrisma.client.deal.findFirst.mockResolvedValue(existingDeal);
      mockPrisma.client.pipelineStage.findFirst.mockResolvedValue(mockPipeline.stages[1]); // 'Proposal Sent'

      mockPrisma.client.deal.update.mockResolvedValue({
        ...existingDeal,
        stageId: 'stage-2',
        version: 2,
      });

      await dealsService.moveDealStage(orgId, userId, 'deal-uuid-1', {
        version: 1,
        stageId: 'stage-2',
      });

      // Verify stage history audit transition
      expect(mockPrisma.client.dealStageHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dealId: 'deal-uuid-1',
            fromStageId: 'stage-1',
            toStageId: 'stage-2',
            movedById: userId,
          }),
        }),
      );

      // Verify deal_moved activity logged
      expect(mockPrisma.client.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            activityType: 'deal_moved',
            description: 'Deal moved from "Qualified" to "Proposal Sent"',
          }),
        }),
      );
    });

    it('sets closedAt when moving to won or lost stage', async () => {
      const existingDeal = {
        id: 'deal-uuid-1',
        organizationId: orgId,
        leadId: mockLead.id,
        pipelineId: mockPipeline.id,
        stageId: 'stage-2',
        title: 'Enterprise License',
        version: 3,
        closedAt: null,
        stage: mockPipeline.stages[1],
      };

      mockPrisma.client.deal.findFirst.mockResolvedValue(existingDeal);
      mockPrisma.client.pipelineStage.findFirst.mockResolvedValue(mockPipeline.stages[2]); // 'Closed Won'

      mockPrisma.client.deal.update.mockImplementation(({ data }) => {
        expect(data.closedAt).toBeInstanceOf(Date);
        return Promise.resolve({
          ...existingDeal,
          stageId: 'stage-3',
          closedAt: data.closedAt,
          version: 4,
        });
      });

      const result = await dealsService.moveDealStage(orgId, userId, 'deal-uuid-1', {
        version: 3,
        stageId: 'stage-3',
        winLossReason: 'Best product fit and responsive sales team',
      });

      expect(result.closedAt).not.toBeNull();
    });

    it('clears closedAt when reopening a closed deal to an open stage', async () => {
      const existingDeal = {
        id: 'deal-uuid-1',
        organizationId: orgId,
        leadId: mockLead.id,
        pipelineId: mockPipeline.id,
        stageId: 'stage-4', // 'Closed Lost'
        title: 'Reopened Deal',
        version: 4,
        closedAt: new Date('2026-09-01'),
        stage: mockPipeline.stages[3],
      };

      mockPrisma.client.deal.findFirst.mockResolvedValue(existingDeal);
      mockPrisma.client.pipelineStage.findFirst.mockResolvedValue(mockPipeline.stages[0]); // 'Qualified' (open)

      mockPrisma.client.deal.update.mockImplementation(({ data }) => {
        expect(data.closedAt).toBeNull();
        return Promise.resolve({
          ...existingDeal,
          stageId: 'stage-1',
          closedAt: null,
          version: 5,
        });
      });

      const result = await dealsService.moveDealStage(orgId, userId, 'deal-uuid-1', {
        version: 4,
        stageId: 'stage-1',
      });

      expect(result.closedAt).toBeNull();
    });
  });

  describe('Visual Kanban Board Backend Aggregation', () => {
    it('aggregates deals and values per stage and computes pipeline summary', async () => {
      mockPrisma.client.pipeline.findFirst.mockResolvedValue(mockPipeline);

      const activeDeals = [
        {
          id: 'deal-1',
          stageId: 'stage-1',
          title: 'Deal 1',
          value: new Prisma.Decimal(50000),
          closedAt: null,
        },
        {
          id: 'deal-2',
          stageId: 'stage-1',
          title: 'Deal 2',
          value: new Prisma.Decimal(150000),
          closedAt: null,
        },
        {
          id: 'deal-3',
          stageId: 'stage-2',
          title: 'Deal 3',
          value: new Prisma.Decimal(300000),
          closedAt: null,
        },
        {
          id: 'deal-4',
          stageId: 'stage-3', // Closed Won
          title: 'Deal 4',
          value: new Prisma.Decimal(200000),
          closedAt: new Date(),
        },
      ];

      mockPrisma.client.deal.findMany.mockResolvedValue(activeDeals);

      const kanban = await dealsService.getKanbanBoard(orgId, 'pipe-uuid-1');

      expect(kanban.pipeline.name).toBe('Enterprise Sales Pipeline');
      expect(kanban.stages).toHaveLength(4);

      // Stage 1: Qualified (2 deals, total 200,000)
      const stage1 = kanban.stages.find((s: any) => s.id === 'stage-1');
      expect(stage1.dealCount).toBe(2);
      expect(stage1.totalValue).toBe(200000);

      // Stage 2: Proposal Sent (1 deal, total 300,000)
      const stage2 = kanban.stages.find((s: any) => s.id === 'stage-2');
      expect(stage2.dealCount).toBe(1);
      expect(stage2.totalValue).toBe(300000);

      // Summary checks
      expect(kanban.summary.totalDeals).toBe(4);
      expect(kanban.summary.totalPipelineValue).toBe(700000);
      expect(kanban.summary.wonValue).toBe(200000);
      expect(kanban.summary.wonCount).toBe(1);
    });
  });

  describe('Cross-Tenant IDOR Protection', () => {
    it('returns 404 Not Found when attempting to access a deal belonging to another organization', async () => {
      // Prisma filter enforces organizationId: orgId
      mockPrisma.client.deal.findFirst.mockResolvedValue(null);

      await expect(dealsService.getDealById(orgId, 'other-org-deal-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns 404 Not Found when attempting to update a deal of another organization', async () => {
      mockPrisma.client.deal.findFirst.mockResolvedValue(null);

      await expect(
        dealsService.updateDeal(orgId, userId, 'other-org-deal-id', {
          version: 1,
          title: 'Malicious Update',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Pipeline Management Constraints', () => {
    it('prohibits deleting default sales pipeline', async () => {
      mockPrisma.client.pipeline.findFirst.mockResolvedValue({
        id: 'pipe-default',
        organizationId: orgId,
        isDefault: true,
        _count: { deals: 0 },
      });

      await expect(dealsService.deletePipeline(orgId, userId, 'pipe-default')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('prohibits deleting a pipeline stage that contains active deals', async () => {
      mockPrisma.client.pipeline.findFirst.mockResolvedValue(mockPipeline);
      mockPrisma.client.pipelineStage.findFirst.mockResolvedValue({
        id: 'stage-occupied',
        pipelineId: mockPipeline.id,
        name: 'Negotiation',
        _count: { deals: 3 },
      });

      await expect(
        dealsService.deleteStage(orgId, userId, mockPipeline.id, 'stage-occupied'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
