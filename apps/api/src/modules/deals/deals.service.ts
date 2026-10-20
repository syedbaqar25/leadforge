import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Prisma } from '@prisma/client';
import {
  CreateDealDto,
  UpdateDealDto,
  MoveDealStageDto,
  DealQueryDto,
  CreatePipelineDto,
  UpdatePipelineDto,
  CreateStageDto,
  ReorderStagesDto,
} from './dto';

@Injectable()
export class DealsService {
  private readonly logger = new Logger(DealsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // =========================================================================
  // DEAL OPERATIONS
  // =========================================================================

  /**
   * Create a new deal with tenant isolation, initial stage history, and activity logging.
   */
  async createDeal(orgId: string, userId: string | null, dto: CreateDealDto) {
    // 1. Validate associated lead exists and belongs to this organization
    const lead = await this.prisma.client.lead.findFirst({
      where: {
        id: dto.leadId,
        organizationId: orgId,
        deletedAt: null,
      },
    });

    if (!lead) {
      throw new NotFoundException({
        code: 'LEAD_NOT_FOUND',
        message: 'The associated lead was not found in your organization.',
      });
    }

    // 2. Validate pipeline exists and belongs to this organization
    const pipeline = await this.prisma.client.pipeline.findFirst({
      where: {
        id: dto.pipelineId,
        organizationId: orgId,
      },
    });

    if (!pipeline) {
      throw new NotFoundException({
        code: 'PIPELINE_NOT_FOUND',
        message: 'The specified pipeline was not found in your organization.',
      });
    }

    // 3. Validate stage exists and belongs to the pipeline
    const stage = await this.prisma.client.pipelineStage.findFirst({
      where: {
        id: dto.stageId,
        pipelineId: pipeline.id,
      },
    });

    if (!stage) {
      throw new BadRequestException({
        code: 'INVALID_STAGE',
        message: 'The specified stage does not belong to the selected pipeline.',
      });
    }

    // 4. Validate owner if specified
    if (dto.ownerId) {
      const membership = await this.prisma.client.membership.findFirst({
        where: {
          organizationId: orgId,
          userId: dto.ownerId,
        },
      });

      if (!membership) {
        throw new BadRequestException({
          code: 'INVALID_OWNER',
          message: 'The assigned owner is not an active member of this organization.',
        });
      }
    }

    const assignedOwnerId = dto.ownerId || userId || null;
    const isClosed = stage.stageType === 'won' || stage.stageType === 'lost';
    const closedAt = isClosed ? new Date() : null;

    // 5. Create deal atomically with initial stage history and activity
    const deal = await this.prisma.client.$transaction(async (tx) => {
      const newDeal = await tx.deal.create({
        data: {
          organizationId: orgId,
          leadId: lead.id,
          pipelineId: pipeline.id,
          stageId: stage.id,
          title: dto.title.trim(),
          value: dto.value !== undefined ? new Prisma.Decimal(dto.value) : null,
          currency: dto.currency || 'INR',
          expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : null,
          ownerId: assignedOwnerId,
          probability: dto.probability !== undefined ? dto.probability : null,
          nextAction: dto.nextAction?.trim() || null,
          winLossReason: dto.winLossReason?.trim() || null,
          version: 1,
          closedAt,
        },
        include: {
          lead: {
            select: {
              id: true,
              fullName: true,
              company: true,
              emailRaw: true,
              phoneRaw: true,
            },
          },
          stage: true,
          pipeline: true,
          owner: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              email: true,
            },
          },
        },
      });

      // Record initial stage in history (fromStageId is null for new deal)
      await tx.dealStageHistory.create({
        data: {
          dealId: newDeal.id,
          fromStageId: null,
          toStageId: stage.id,
          movedById: userId || assignedOwnerId || orgId,
          movedAt: new Date(),
        },
      });

      // Log deal creation activity
      await tx.activity.create({
        data: {
          organizationId: orgId,
          dealId: newDeal.id,
          leadId: lead.id,
          activityType: 'deal_created',
          description: `Deal "${newDeal.title}" created in stage "${stage.name}"`,
          metadata: {
            pipelineId: pipeline.id,
            pipelineName: pipeline.name,
            stageId: stage.id,
            stageName: stage.name,
            value: dto.value ?? null,
            currency: newDeal.currency,
          },
          performedById: userId,
        },
      });

      return newDeal;
    });

    await this.auditService.log({
      organizationId: orgId,
      userId: userId || undefined,
      action: 'deal.create',
      entityType: 'deal',
      entityId: deal.id,
      after: {
        title: deal.title,
        value: deal.value?.toNumber(),
        stageId: deal.stageId,
        pipelineId: deal.pipelineId,
        leadId: deal.leadId,
      },
    });

    return deal;
  }

  /**
   * Get paginated and filtered deals list.
   */
  async getDeals(orgId: string, query: DealQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize =
      query.pageSize && query.pageSize > 0 && query.pageSize <= 100 ? query.pageSize : 25;
    const skip = (page - 1) * pageSize;

    const where: Prisma.DealWhereInput = {
      organizationId: orgId,
      deletedAt: null,
    };

    if (query.pipelineId) {
      where.pipelineId = query.pipelineId;
    }

    if (query.stageId) {
      where.stageId = query.stageId;
    }

    if (query.ownerId) {
      where.ownerId = query.ownerId;
    }

    if (query.leadId) {
      where.leadId = query.leadId;
    }

    if (query.stageType) {
      where.stage = {
        stageType: query.stageType,
      };
    }

    if (query.search) {
      const searchTerm = query.search.trim();
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { nextAction: { contains: searchTerm, mode: 'insensitive' } },
        { lead: { fullName: { contains: searchTerm, mode: 'insensitive' } } },
        { lead: { company: { contains: searchTerm, mode: 'insensitive' } } },
      ];
    }

    if (query.fromCloseDate || query.toCloseDate) {
      where.expectedCloseDate = {};
      if (query.fromCloseDate) {
        where.expectedCloseDate.gte = new Date(query.fromCloseDate);
      }
      if (query.toCloseDate) {
        where.expectedCloseDate.lte = new Date(query.toCloseDate);
      }
    }

    const orderByField = query.sortBy || 'createdAt';
    const orderDirection: Prisma.SortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const [deals, total] = await Promise.all([
      this.prisma.client.deal.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [orderByField]: orderDirection },
        include: {
          lead: {
            select: {
              id: true,
              fullName: true,
              company: true,
              emailRaw: true,
              phoneRaw: true,
              score: true,
              scoreBand: true,
            },
          },
          stage: true,
          pipeline: { select: { id: true, name: true, isDefault: true } },
          owner: { select: { id: true, name: true, avatarUrl: true, email: true } },
        },
      }),
      this.prisma.client.deal.count({ where }),
    ]);

    return {
      data: deals,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        hasMore: page * pageSize < total,
      },
    };
  }

  /**
   * Get single deal by ID with full history and details.
   */
  async getDealById(orgId: string, dealId: string) {
    const deal = await this.prisma.client.deal.findFirst({
      where: {
        id: dealId,
        organizationId: orgId,
        deletedAt: null,
      },
      include: {
        lead: {
          select: {
            id: true,
            fullName: true,
            company: true,
            emailRaw: true,
            phoneRaw: true,
            score: true,
            scoreBand: true,
          },
        },
        pipeline: true,
        stage: true,
        owner: { select: { id: true, name: true, avatarUrl: true, email: true } },
        stageHistory: {
          orderBy: { movedAt: 'desc' },
          include: {
            fromStage: { select: { id: true, name: true, sortOrder: true } },
            toStage: { select: { id: true, name: true, sortOrder: true } },
            movedBy: { select: { id: true, name: true } },
          },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!deal) {
      throw new NotFoundException({
        code: 'DEAL_NOT_FOUND',
        message: 'Deal not found.',
      });
    }

    return deal;
  }

  /**
   * Update deal with optimistic concurrency control (`version` check).
   */
  async updateDeal(orgId: string, userId: string | null, dealId: string, dto: UpdateDealDto) {
    // 1. Fetch existing deal
    const existing = await this.prisma.client.deal.findFirst({
      where: {
        id: dealId,
        organizationId: orgId,
        deletedAt: null,
      },
      include: {
        stage: true,
        pipeline: true,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'DEAL_NOT_FOUND',
        message: 'Deal not found.',
      });
    }

    // 2. Enforce Optimistic Concurrency Control
    if (existing.version !== dto.version) {
      throw new ConflictException({
        code: 'CONCURRENCY_CONFLICT',
        message: `Deal has been modified by another user (expected version ${dto.version}, found current version ${existing.version}). Please refresh and try again.`,
      });
    }

    // 3. Stage transition handling if stageId changed
    let targetStage: any = null;
    let closedAt = existing.closedAt;
    const isStageChanging = Boolean(dto.stageId && dto.stageId !== existing.stageId);

    if (dto.stageId && dto.stageId !== existing.stageId) {
      const newStageId = dto.stageId;
      targetStage = await this.prisma.client.pipelineStage.findFirst({
        where: {
          id: newStageId,
          pipelineId: existing.pipelineId,
        },
      });

      if (!targetStage) {
        throw new BadRequestException({
          code: 'INVALID_STAGE',
          message: 'The specified stage does not belong to the deal pipeline.',
        });
      }

      if (targetStage.stageType === 'won' || targetStage.stageType === 'lost') {
        closedAt = existing.closedAt || new Date();
      } else {
        closedAt = null;
      }
    }

    // 4. Validate owner if changing
    if (dto.ownerId) {
      const membership = await this.prisma.client.membership.findFirst({
        where: {
          organizationId: orgId,
          userId: dto.ownerId,
        },
      });

      if (!membership) {
        throw new BadRequestException({
          code: 'INVALID_OWNER',
          message: 'The assigned owner is not an active member of this organization.',
        });
      }
    }

    // 5. Execute atomic update
    const updated = await this.prisma.client.$transaction(async (tx) => {
      // Build safe update data without undefined fields for exactOptionalPropertyTypes
      const updateData: Prisma.DealUncheckedUpdateInput = {
        version: { increment: 1 },
        updatedAt: new Date(),
      };

      if (dto.title !== undefined) updateData.title = dto.title.trim();
      if (dto.value !== undefined) updateData.value = new Prisma.Decimal(dto.value);
      if (dto.currency !== undefined) updateData.currency = dto.currency;
      if (dto.expectedCloseDate !== undefined) {
        updateData.expectedCloseDate = dto.expectedCloseDate
          ? new Date(dto.expectedCloseDate)
          : null;
      }
      if (dto.ownerId !== undefined) updateData.ownerId = dto.ownerId;
      if (dto.probability !== undefined) updateData.probability = dto.probability;
      if (dto.nextAction !== undefined) updateData.nextAction = dto.nextAction;
      if (dto.winLossReason !== undefined) updateData.winLossReason = dto.winLossReason;
      if (isStageChanging && targetStage) {
        updateData.stageId = targetStage.id;
        updateData.closedAt = closedAt;
      }

      const deal = await tx.deal.update({
        where: { id: existing.id },
        data: updateData,
        include: {
          lead: {
            select: {
              id: true,
              fullName: true,
              company: true,
              emailRaw: true,
              phoneRaw: true,
            },
          },
          stage: true,
          pipeline: true,
          owner: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              email: true,
            },
          },
        },
      });

      // Record stage transition if stage changed
      if (isStageChanging && targetStage) {
        await tx.dealStageHistory.create({
          data: {
            dealId: existing.id,
            fromStageId: existing.stageId,
            toStageId: targetStage.id,
            movedById: userId || existing.ownerId || orgId,
            movedAt: new Date(),
          },
        });

        await tx.activity.create({
          data: {
            organizationId: orgId,
            dealId: existing.id,
            leadId: existing.leadId,
            activityType: 'deal_moved',
            description: `Deal moved from "${existing.stage.name}" to "${targetStage.name}"`,
            metadata: {
              fromStageId: existing.stageId,
              fromStageName: existing.stage.name,
              toStageId: targetStage.id,
              toStageName: targetStage.name,
              fromStageType: existing.stage.stageType,
              toStageType: targetStage.stageType,
              winLossReason: dto.winLossReason || null,
            },
            performedById: userId,
          },
        });
      }

      return deal;
    });

    await this.auditService.log({
      organizationId: orgId,
      userId: userId || undefined,
      action: 'deal.update',
      entityType: 'deal',
      entityId: dealId,
      before: {
        title: existing.title,
        value: existing.value?.toNumber(),
        stageId: existing.stageId,
        version: existing.version,
      },
      after: {
        title: updated.title,
        value: updated.value?.toNumber(),
        stageId: updated.stageId,
        version: updated.version,
      },
    });

    return updated;
  }

  /**
   * Fast drag-and-drop stage movement with optimistic locking.
   */
  async moveDealStage(orgId: string, userId: string | null, dealId: string, dto: MoveDealStageDto) {
    const updatePayload: UpdateDealDto = {
      version: dto.version,
      stageId: dto.stageId,
      ...(dto.winLossReason !== undefined ? { winLossReason: dto.winLossReason } : {}),
    };
    return this.updateDeal(orgId, userId, dealId, updatePayload);
  }

  /**
   * Soft delete a deal.
   */
  async deleteDeal(orgId: string, userId: string | null, dealId: string) {
    const existing = await this.prisma.client.deal.findFirst({
      where: {
        id: dealId,
        organizationId: orgId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'DEAL_NOT_FOUND',
        message: 'Deal not found.',
      });
    }

    await this.prisma.client.deal.update({
      where: { id: existing.id },
      data: {
        deletedAt: new Date(),
      },
    });

    await this.auditService.log({
      organizationId: orgId,
      userId: userId || undefined,
      action: 'deal.delete',
      entityType: 'deal',
      entityId: dealId,
      before: { title: existing.title, value: existing.value?.toNumber() },
    });

    return { success: true, message: 'Deal deleted successfully.' };
  }

  // =========================================================================
  // KANBAN BOARD AGGREGATION
  // =========================================================================

  /**
   * Get Kanban board view with aggregated stage metrics and deal cards.
   */
  async getKanbanBoard(orgId: string, pipelineId?: string) {
    // 1. Resolve pipeline
    let pipeline: any = null;

    if (pipelineId) {
      pipeline = await this.prisma.client.pipeline.findFirst({
        where: { id: pipelineId, organizationId: orgId },
        include: {
          stages: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      });
    } else {
      pipeline = await this.prisma.client.pipeline.findFirst({
        where: { organizationId: orgId, isDefault: true },
        include: {
          stages: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      });

      if (!pipeline) {
        pipeline = await this.prisma.client.pipeline.findFirst({
          where: { organizationId: orgId },
          include: {
            stages: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        });
      }
    }

    // Auto-initialize standard pipeline if none exists
    if (!pipeline) {
      pipeline = await this.createDefaultPipeline(orgId);
    }

    // 2. Fetch all active deals for this pipeline
    const deals = await this.prisma.client.deal.findMany({
      where: {
        organizationId: orgId,
        pipelineId: pipeline.id,
        deletedAt: null,
      },
      include: {
        lead: {
          select: {
            id: true,
            fullName: true,
            company: true,
            emailRaw: true,
            phoneRaw: true,
            score: true,
            scoreBand: true,
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Group deals by stage and calculate aggregates
    const stagesWithDeals = pipeline.stages.map((stage: any) => {
      const stageDeals = deals.filter((d) => d.stageId === stage.id);
      const totalValue = stageDeals.reduce((sum, d) => sum + (d.value ? Number(d.value) : 0), 0);

      return {
        id: stage.id,
        name: stage.name,
        sortOrder: stage.sortOrder,
        stageType: stage.stageType,
        dealCount: stageDeals.length,
        totalValue: Number(totalValue.toFixed(2)),
        deals: stageDeals,
      };
    });

    // 4. Calculate total pipeline summary
    const totalPipelineValue = deals.reduce((sum, d) => sum + (d.value ? Number(d.value) : 0), 0);
    const wonDeals = deals.filter((d) => {
      const stage = pipeline.stages.find((s: any) => s.id === d.stageId);
      return stage?.stageType === 'won';
    });
    const wonValue = wonDeals.reduce((sum, d) => sum + (d.value ? Number(d.value) : 0), 0);

    const lostDeals = deals.filter((d) => {
      const stage = pipeline.stages.find((s: any) => s.id === d.stageId);
      return stage?.stageType === 'lost';
    });
    const lostValue = lostDeals.reduce((sum, d) => sum + (d.value ? Number(d.value) : 0), 0);

    return {
      pipeline: {
        id: pipeline.id,
        name: pipeline.name,
        isDefault: pipeline.isDefault,
      },
      stages: stagesWithDeals,
      summary: {
        totalDeals: deals.length,
        totalPipelineValue: Number(totalPipelineValue.toFixed(2)),
        wonValue: Number(wonValue.toFixed(2)),
        wonCount: wonDeals.length,
        lostValue: Number(lostValue.toFixed(2)),
        lostCount: lostDeals.length,
      },
    };
  }

  // =========================================================================
  // PIPELINE & STAGES MANAGEMENT
  // =========================================================================

  /**
   * Get all pipelines for the organization with their stages.
   */
  async getPipelines(orgId: string) {
    const pipelines = await this.prisma.client.pipeline.findMany({
      where: { organizationId: orgId },
      include: {
        stages: {
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: {
            deals: {
              where: { deletedAt: null },
            },
          },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    return pipelines.map((p) => ({
      ...p,
      dealsCount: p._count.deals,
    }));
  }

  /**
   * Get pipeline details by ID.
   */
  async getPipelineById(orgId: string, pipelineId: string) {
    const pipeline = await this.prisma.client.pipeline.findFirst({
      where: { id: pipelineId, organizationId: orgId },
      include: {
        stages: {
          orderBy: { sortOrder: 'asc' },
          include: {
            _count: {
              select: {
                deals: {
                  where: { deletedAt: null },
                },
              },
            },
          },
        },
      },
    });

    if (!pipeline) {
      throw new NotFoundException({
        code: 'PIPELINE_NOT_FOUND',
        message: 'Pipeline not found.',
      });
    }

    return {
      ...pipeline,
      stages: pipeline.stages.map((s) => ({
        id: s.id,
        name: s.name,
        sortOrder: s.sortOrder,
        stageType: s.stageType,
        dealsCount: s._count.deals,
        createdAt: s.createdAt,
      })),
    };
  }

  /**
   * Create a new pipeline with optional custom stages.
   */
  async createPipeline(orgId: string, userId: string | null, dto: CreatePipelineDto) {
    const existingCount = await this.prisma.client.pipeline.count({
      where: { organizationId: orgId },
    });

    const isFirstPipeline = existingCount === 0;
    const isDefault = dto.isDefault || isFirstPipeline;

    const pipeline = await this.prisma.client.$transaction(async (tx) => {
      // If setting as default, unset other defaults in org
      if (isDefault) {
        await tx.pipeline.updateMany({
          where: { organizationId: orgId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const newPipeline = await tx.pipeline.create({
        data: {
          organizationId: orgId,
          name: dto.name.trim(),
          isDefault,
        },
      });

      // Stages to create
      const stagesToCreate =
        dto.stages && dto.stages.length > 0
          ? dto.stages
          : [
              { name: 'New Lead', sortOrder: 1, stageType: 'open' as const },
              { name: 'Contacted', sortOrder: 2, stageType: 'open' as const },
              { name: 'Qualified', sortOrder: 3, stageType: 'open' as const },
              { name: 'Proposal Sent', sortOrder: 4, stageType: 'open' as const },
              { name: 'Negotiation', sortOrder: 5, stageType: 'open' as const },
              { name: 'Closed Won', sortOrder: 6, stageType: 'won' as const },
              { name: 'Closed Lost', sortOrder: 7, stageType: 'lost' as const },
            ];

      for (const s of stagesToCreate) {
        await tx.pipelineStage.create({
          data: {
            pipelineId: newPipeline.id,
            name: s.name.trim(),
            sortOrder: s.sortOrder,
            stageType: s.stageType || 'open',
          },
        });
      }

      return tx.pipeline.findUniqueOrThrow({
        where: { id: newPipeline.id },
        include: {
          stages: { orderBy: { sortOrder: 'asc' } },
        },
      });
    });

    await this.auditService.log({
      organizationId: orgId,
      userId: userId || undefined,
      action: 'pipeline.create',
      entityType: 'pipeline',
      entityId: pipeline.id,
      after: { name: pipeline.name, isDefault: pipeline.isDefault },
    });

    return pipeline;
  }

  /**
   * Update pipeline metadata.
   */
  async updatePipeline(
    orgId: string,
    userId: string | null,
    pipelineId: string,
    dto: UpdatePipelineDto,
  ) {
    const existing = await this.prisma.client.pipeline.findFirst({
      where: { id: pipelineId, organizationId: orgId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'PIPELINE_NOT_FOUND',
        message: 'Pipeline not found.',
      });
    }

    const updated = await this.prisma.client.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.pipeline.updateMany({
          where: { organizationId: orgId, isDefault: true, id: { not: pipelineId } },
          data: { isDefault: false },
        });
      }

      const updateData: Prisma.PipelineUpdateInput = {};
      if (dto.name !== undefined) updateData.name = dto.name.trim();
      if (dto.isDefault !== undefined) updateData.isDefault = dto.isDefault;

      return tx.pipeline.update({
        where: { id: pipelineId },
        data: updateData,
        include: {
          stages: { orderBy: { sortOrder: 'asc' } },
        },
      });
    });

    await this.auditService.log({
      organizationId: orgId,
      userId: userId || undefined,
      action: 'pipeline.update',
      entityType: 'pipeline',
      entityId: pipelineId,
      before: { name: existing.name, isDefault: existing.isDefault },
      after: { name: updated.name, isDefault: updated.isDefault },
    });

    return updated;
  }

  /**
   * Delete a pipeline (prohibited if default or deals exist).
   */
  async deletePipeline(orgId: string, userId: string | null, pipelineId: string) {
    const existing = await this.prisma.client.pipeline.findFirst({
      where: { id: pipelineId, organizationId: orgId },
      include: {
        _count: {
          select: { deals: { where: { deletedAt: null } } },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'PIPELINE_NOT_FOUND',
        message: 'Pipeline not found.',
      });
    }

    if (existing.isDefault) {
      throw new BadRequestException({
        code: 'CANNOT_DELETE_DEFAULT_PIPELINE',
        message:
          'Cannot delete the default pipeline. Please set another pipeline as default first.',
      });
    }

    if (existing._count.deals > 0) {
      throw new BadRequestException({
        code: 'PIPELINE_HAS_ACTIVE_DEALS',
        message: `Cannot delete pipeline because it contains ${existing._count.deals} active deals. Move or delete those deals first.`,
      });
    }

    await this.prisma.client.pipeline.delete({
      where: { id: pipelineId },
    });

    await this.auditService.log({
      organizationId: orgId,
      userId: userId || undefined,
      action: 'pipeline.delete',
      entityType: 'pipeline',
      entityId: pipelineId,
      before: { name: existing.name },
    });

    return { success: true, message: 'Pipeline deleted successfully.' };
  }

  /**
   * Add a new stage to an existing pipeline.
   */
  async addStage(orgId: string, userId: string | null, pipelineId: string, dto: CreateStageDto) {
    const pipeline = await this.prisma.client.pipeline.findFirst({
      where: { id: pipelineId, organizationId: orgId },
    });

    if (!pipeline) {
      throw new NotFoundException({
        code: 'PIPELINE_NOT_FOUND',
        message: 'Pipeline not found.',
      });
    }

    // Determine sort order if already occupied
    const existingStageWithOrder = await this.prisma.client.pipelineStage.findFirst({
      where: { pipelineId, sortOrder: dto.sortOrder },
    });

    let targetSortOrder = dto.sortOrder;
    if (existingStageWithOrder) {
      const maxOrder = await this.prisma.client.pipelineStage.aggregate({
        where: { pipelineId },
        _max: { sortOrder: true },
      });
      targetSortOrder = (maxOrder._max.sortOrder || 0) + 1;
    }

    const stage = await this.prisma.client.pipelineStage.create({
      data: {
        pipelineId,
        name: dto.name.trim(),
        sortOrder: targetSortOrder,
        stageType: dto.stageType || 'open',
      },
    });

    await this.auditService.log({
      organizationId: orgId,
      userId: userId || undefined,
      action: 'pipeline.stage.create',
      entityType: 'pipeline_stage',
      entityId: stage.id,
      after: {
        pipelineId,
        name: stage.name,
        sortOrder: stage.sortOrder,
        stageType: stage.stageType,
      },
    });

    return stage;
  }

  /**
   * Reorder stages within a pipeline.
   */
  async reorderStages(
    orgId: string,
    userId: string | null,
    pipelineId: string,
    dto: ReorderStagesDto,
  ) {
    const pipeline = await this.prisma.client.pipeline.findFirst({
      where: { id: pipelineId, organizationId: orgId },
    });

    if (!pipeline) {
      throw new NotFoundException({
        code: 'PIPELINE_NOT_FOUND',
        message: 'Pipeline not found.',
      });
    }

    // Temporary offset to prevent unique constraint conflicts on [pipelineId, sortOrder]
    await this.prisma.client.$transaction(async (tx) => {
      // Step 1: Temporarily shift all orders by +1000
      for (const item of dto.stageOrders) {
        await tx.pipelineStage.updateMany({
          where: { id: item.id, pipelineId },
          data: { sortOrder: item.sortOrder + 1000 },
        });
      }

      // Step 2: Set final target orders
      for (const item of dto.stageOrders) {
        await tx.pipelineStage.updateMany({
          where: { id: item.id, pipelineId },
          data: { sortOrder: item.sortOrder },
        });
      }
    });

    const updatedStages = await this.prisma.client.pipelineStage.findMany({
      where: { pipelineId },
      orderBy: { sortOrder: 'asc' },
    });

    await this.auditService.log({
      organizationId: orgId,
      userId: userId || undefined,
      action: 'pipeline.stages.reorder',
      entityType: 'pipeline',
      entityId: pipelineId,
      after: { stageOrders: dto.stageOrders },
    });

    return updatedStages;
  }

  /**
   * Delete a pipeline stage (prohibited if deals exist in it).
   */
  async deleteStage(orgId: string, userId: string | null, pipelineId: string, stageId: string) {
    const pipeline = await this.prisma.client.pipeline.findFirst({
      where: { id: pipelineId, organizationId: orgId },
    });

    if (!pipeline) {
      throw new NotFoundException({
        code: 'PIPELINE_NOT_FOUND',
        message: 'Pipeline not found.',
      });
    }

    const stage = await this.prisma.client.pipelineStage.findFirst({
      where: { id: stageId, pipelineId },
      include: {
        _count: {
          select: { deals: { where: { deletedAt: null } } },
        },
      },
    });

    if (!stage) {
      throw new NotFoundException({
        code: 'STAGE_NOT_FOUND',
        message: 'Stage not found in this pipeline.',
      });
    }

    if (stage._count.deals > 0) {
      throw new BadRequestException({
        code: 'STAGE_HAS_ACTIVE_DEALS',
        message: `Cannot delete stage "${stage.name}" because it currently holds ${stage._count.deals} active deals. Move those deals to another stage first.`,
      });
    }

    await this.prisma.client.pipelineStage.delete({
      where: { id: stageId },
    });

    await this.auditService.log({
      organizationId: orgId,
      userId: userId || undefined,
      action: 'pipeline.stage.delete',
      entityType: 'pipeline_stage',
      entityId: stageId,
      before: { name: stage.name, pipelineId },
    });

    return { success: true, message: `Stage "${stage.name}" deleted successfully.` };
  }

  // =========================================================================
  // INTERNAL HELPERS
  // =========================================================================

  private async createDefaultPipeline(orgId: string) {
    return this.prisma.client.$transaction(async (tx) => {
      const pipeline = await tx.pipeline.create({
        data: {
          organizationId: orgId,
          name: 'Standard Sales Pipeline',
          isDefault: true,
        },
      });

      const standardStages = [
        { name: 'New Lead', sortOrder: 1, stageType: 'open' as const },
        { name: 'Contacted', sortOrder: 2, stageType: 'open' as const },
        { name: 'Qualified', sortOrder: 3, stageType: 'open' as const },
        { name: 'Proposal Sent', sortOrder: 4, stageType: 'open' as const },
        { name: 'Negotiation', sortOrder: 5, stageType: 'open' as const },
        { name: 'Closed Won', sortOrder: 6, stageType: 'won' as const },
        { name: 'Closed Lost', sortOrder: 7, stageType: 'lost' as const },
      ];

      for (const s of standardStages) {
        await tx.pipelineStage.create({
          data: {
            pipelineId: pipeline.id,
            name: s.name,
            sortOrder: s.sortOrder,
            stageType: s.stageType,
          },
        });
      }

      return tx.pipeline.findUniqueOrThrow({
        where: { id: pipeline.id },
        include: {
          stages: { orderBy: { sortOrder: 'asc' } },
        },
      });
    });
  }
}
