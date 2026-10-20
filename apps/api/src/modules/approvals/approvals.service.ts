import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DecideApprovalDto, ApprovalQueryDto } from './dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ApprovalsService {
  private readonly logger = new Logger(ApprovalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * List approval requests for the organization with filtering and pagination.
   */
  async getApprovals(orgId: string, query: ApprovalQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize =
      query.pageSize && query.pageSize > 0 && query.pageSize <= 100 ? query.pageSize : 25;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ApprovalRequestWhereInput = {
      organizationId: orgId,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.approvalType) {
      where.approvalType = query.approvalType;
    }

    if (query.entityType) {
      where.entityType = query.entityType;
    }

    const [approvals, total] = await Promise.all([
      this.prisma.client.approvalRequest.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          requestedBy: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
          reviewedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.client.approvalRequest.count({ where }),
    ]);

    return {
      data: approvals,
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
   * Get approval request by ID with full entity payload.
   */
  async getApprovalById(orgId: string, approvalId: string) {
    const approval = await this.prisma.client.approvalRequest.findFirst({
      where: {
        id: approvalId,
        organizationId: orgId,
      },
      include: {
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!approval) {
      throw new NotFoundException({
        code: 'APPROVAL_NOT_FOUND',
        message: 'Approval request not found in your organization.',
      });
    }

    // If linked to a message, fetch message context for reviewer convenience
    let messageContext: any = null;
    if (approval.entityType === 'message') {
      messageContext = await this.prisma.client.message.findFirst({
        where: { id: approval.entityId, organizationId: orgId },
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
        },
      });
    }

    return {
      ...approval,
      entityDetails: messageContext,
    };
  }

  /**
   * Decide approval request (Approve or Reject) with optimistic concurrency control.
   */
  async decideApproval(orgId: string, userId: string, approvalId: string, dto: DecideApprovalDto) {
    // 1. Fetch approval request
    const existing = await this.prisma.client.approvalRequest.findFirst({
      where: {
        id: approvalId,
        organizationId: orgId,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'APPROVAL_NOT_FOUND',
        message: 'Approval request not found in your organization.',
      });
    }

    // 2. State machine: cannot re-decide already finalized requests
    if (existing.status !== 'pending') {
      throw new BadRequestException({
        code: 'APPROVAL_ALREADY_DECIDED',
        message: `This approval request has already been marked as "${existing.status}".`,
      });
    }

    // 3. Optimistic Concurrency Control
    if (existing.version !== dto.version) {
      throw new ConflictException({
        code: 'CONCURRENCY_CONFLICT',
        message: `Approval request was modified by another reviewer (expected version ${dto.version}, found ${existing.version}). Please refresh and try again.`,
      });
    }

    // 4. Execute atomic decision
    const reviewedAt = new Date();

    const result = await this.prisma.client.$transaction(async (tx) => {
      // Update ApprovalRequest
      const updatedApproval = await tx.approvalRequest.update({
        where: { id: existing.id },
        data: {
          status: dto.decision,
          reviewedById: userId,
          reviewedAt,
          version: { increment: 1 },
          ...(dto.editedPayload ? { proposedPayload: dto.editedPayload } : {}),
        },
      });

      // Update underlying target entity based on approval type
      if (existing.entityType === 'message') {
        if (dto.decision === 'approved') {
          await tx.message.updateMany({
            where: { id: existing.entityId, organizationId: orgId },
            data: {
              status: 'approved',
              ...(dto.editedPayload?.body ? { bodyPreview: dto.editedPayload.body } : {}),
              ...(dto.editedPayload?.subject ? { subject: dto.editedPayload.subject } : {}),
            },
          });
        } else {
          // If rejected, revert message to draft
          await tx.message.updateMany({
            where: { id: existing.entityId, organizationId: orgId },
            data: {
              status: 'draft',
            },
          });
        }
      } else if (existing.entityType === 'ai_suggestion') {
        const suggestionStatus =
          dto.decision === 'approved' ? (dto.editedPayload ? 'edited' : 'accepted') : 'rejected';

        await tx.aiSuggestion.updateMany({
          where: { id: existing.entityId, organizationId: orgId },
          data: {
            status: suggestionStatus,
            reviewedById: userId,
            reviewedAt,
            feedback: dto.feedback || null,
          },
        });
      }

      // Log activity
      await tx.activity.create({
        data: {
          organizationId: orgId,
          activityType: 'system',
          description: `Human Approval: ${dto.decision.toUpperCase()} for ${existing.approvalType} (${existing.entityType})`,
          metadata: {
            approvalId: existing.id,
            decision: dto.decision,
            entityType: existing.entityType,
            entityId: existing.entityId,
            feedback: dto.feedback || null,
            edited: Boolean(dto.editedPayload),
          },
          performedById: userId,
        },
      });

      return updatedApproval;
    });

    // 5. Audit log
    await this.auditService.log({
      organizationId: orgId,
      userId,
      action: `approval.${dto.decision}`,
      entityType: 'approval_request',
      entityId: approvalId,
      before: { status: existing.status, version: existing.version },
      after: {
        status: result.status,
        version: result.version,
        reviewedById: userId,
        feedback: dto.feedback,
      },
    });

    return {
      success: true,
      approvalId: result.id,
      status: result.status,
      version: result.version,
      reviewedAt: result.reviewedAt,
      feedback: dto.feedback || null,
    };
  }
}
