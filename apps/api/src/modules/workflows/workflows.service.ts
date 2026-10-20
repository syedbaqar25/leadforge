import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { validateSafeUrl } from '../../common/security/ssrf';
import { CreateWorkflowDto, UpdateWorkflowDto, WorkflowQueryDto } from './dto';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class WorkflowsService {
  private readonly logger = new Logger(WorkflowsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // =========================================================================
  // WORKFLOW DEFINITIONS & VERSIONING
  // =========================================================================

  /**
   * Create a new visual workflow automation with initial version.
   */
  async createWorkflow(orgId: string, userId: string | null, dto: CreateWorkflowDto) {
    const workflow = await this.prisma.client.$transaction(async (tx) => {
      const def = await tx.workflowDefinition.create({
        data: {
          organizationId: orgId,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          isEnabled: dto.isEnabled !== undefined ? dto.isEnabled : false,
          testMode: dto.testMode !== undefined ? dto.testMode : true,
          concurrencyLimit: dto.concurrencyLimit || 5,
          createdById: userId || orgId,
        },
      });

      const initialVersion = await tx.workflowVersion.create({
        data: {
          workflowId: def.id,
          version: 1,
          trigger: dto.trigger as any,
          conditions: (dto.conditions || []) as any,
          actions: dto.actions as any,
        },
      });

      return {
        ...def,
        currentVersion: initialVersion,
      };
    });

    await this.auditService.log({
      organizationId: orgId,
      userId: userId || undefined,
      action: 'workflow.create',
      entityType: 'workflow_definition',
      entityId: workflow.id,
      after: { name: workflow.name, isEnabled: workflow.isEnabled, version: 1 },
    });

    return workflow;
  }

  /**
   * List workflows with pagination and search.
   */
  async getWorkflows(orgId: string, query: WorkflowQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize =
      query.pageSize && query.pageSize > 0 && query.pageSize <= 100 ? query.pageSize : 25;
    const skip = (page - 1) * pageSize;

    const where: Prisma.WorkflowDefinitionWhereInput = {
      organizationId: orgId,
    };

    if (query.isEnabled !== undefined) {
      where.isEnabled = query.isEnabled;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search.trim(), mode: 'insensitive' } },
        { description: { contains: query.search.trim(), mode: 'insensitive' } },
      ];
    }

    const [workflows, total] = await Promise.all([
      this.prisma.client.workflowDefinition.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          versions: {
            orderBy: { version: 'desc' },
            take: 1,
          },
          _count: {
            select: {
              versions: true,
            },
          },
        },
      }),
      this.prisma.client.workflowDefinition.count({ where }),
    ]);

    return {
      data: workflows.map((w) => ({
        id: w.id,
        name: w.name,
        description: w.description,
        isEnabled: w.isEnabled,
        testMode: w.testMode,
        concurrencyLimit: w.concurrencyLimit,
        version: w.versions[0]?.version || 1,
        trigger: w.versions[0]?.trigger,
        totalVersions: w._count.versions,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      })),
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
   * Get single workflow details with version history.
   */
  async getWorkflowById(orgId: string, workflowId: string) {
    const workflow = await this.prisma.client.workflowDefinition.findFirst({
      where: { id: workflowId, organizationId: orgId },
      include: {
        versions: {
          orderBy: { version: 'desc' },
        },
      },
    });

    if (!workflow) {
      throw new NotFoundException({
        code: 'WORKFLOW_NOT_FOUND',
        message: 'Workflow not found in your organization.',
      });
    }

    return {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      isEnabled: workflow.isEnabled,
      testMode: workflow.testMode,
      concurrencyLimit: workflow.concurrencyLimit,
      currentVersion: workflow.versions[0],
      versions: workflow.versions,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
    };
  }

  /**
   * Update workflow. If trigger, conditions, or actions change, an immutable new version is generated.
   */
  async updateWorkflow(
    orgId: string,
    userId: string | null,
    workflowId: string,
    dto: UpdateWorkflowDto,
  ) {
    const existing = await this.prisma.client.workflowDefinition.findFirst({
      where: { id: workflowId, organizationId: orgId },
      include: {
        versions: { orderBy: { version: 'desc' }, take: 1 },
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'WORKFLOW_NOT_FOUND',
        message: 'Workflow not found in your organization.',
      });
    }

    const latestVersion = existing.versions[0];
    const hasVersionChanges = Boolean(dto.trigger || dto.conditions || dto.actions);

    const updated = await this.prisma.client.$transaction(async (tx) => {
      let currentVersionRecord = latestVersion;

      if (hasVersionChanges) {
        const nextVersionNumber = (latestVersion?.version || 0) + 1;
        currentVersionRecord = await tx.workflowVersion.create({
          data: {
            workflowId: existing.id,
            version: nextVersionNumber,
            trigger: (dto.trigger || latestVersion?.trigger || {}) as any,
            conditions: (dto.conditions || latestVersion?.conditions || []) as any,
            actions: (dto.actions || latestVersion?.actions || []) as any,
          },
        });
      }

      const updateData: Prisma.WorkflowDefinitionUpdateInput = {};
      if (dto.name !== undefined) updateData.name = dto.name.trim();
      if (dto.description !== undefined) updateData.description = dto.description?.trim() || null;
      if (dto.isEnabled !== undefined) updateData.isEnabled = dto.isEnabled;
      if (dto.testMode !== undefined) updateData.testMode = dto.testMode;
      if (dto.concurrencyLimit !== undefined) updateData.concurrencyLimit = dto.concurrencyLimit;

      const def = await tx.workflowDefinition.update({
        where: { id: workflowId },
        data: updateData,
      });

      return {
        ...def,
        currentVersion: currentVersionRecord,
      };
    });

    await this.auditService.log({
      organizationId: orgId,
      userId: userId || undefined,
      action: 'workflow.update',
      entityType: 'workflow_definition',
      entityId: workflowId,
      after: {
        name: updated.name,
        isEnabled: updated.isEnabled,
        version: updated.currentVersion?.version,
      },
    });

    return updated;
  }

  /**
   * Delete workflow definition and associated versions.
   */
  async deleteWorkflow(orgId: string, userId: string | null, workflowId: string) {
    const existing = await this.prisma.client.workflowDefinition.findFirst({
      where: { id: workflowId, organizationId: orgId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'WORKFLOW_NOT_FOUND',
        message: 'Workflow not found in your organization.',
      });
    }

    await this.prisma.client.workflowDefinition.delete({
      where: { id: workflowId },
    });

    await this.auditService.log({
      organizationId: orgId,
      userId: userId || undefined,
      action: 'workflow.delete',
      entityType: 'workflow_definition',
      entityId: workflowId,
      before: { name: existing.name },
    });

    return { success: true, message: 'Workflow deleted successfully.' };
  }

  // =========================================================================
  // CONDITION EVALUATION ENGINE
  // =========================================================================

  /**
   * Pure evaluation of rule conditions against event payload.
   */
  evaluateConditions(conditions: any[] | null | undefined, payload: Record<string, any>): boolean {
    if (!conditions || conditions.length === 0) return true;

    for (const cond of conditions) {
      const actualValue = payload[cond.field];
      const targetValue = cond.value;

      switch (cond.operator) {
        case 'equals':
          if (actualValue !== targetValue) return false;
          break;
        case 'not_equals':
          if (actualValue === targetValue) return false;
          break;
        case 'greater_than':
          if (Number(actualValue) <= Number(targetValue)) return false;
          break;
        case 'less_than':
          if (Number(actualValue) >= Number(targetValue)) return false;
          break;
        case 'contains':
          if (
            !String(actualValue || '')
              .toLowerCase()
              .includes(String(targetValue || '').toLowerCase())
          ) {
            return false;
          }
          break;
        case 'in':
          if (!Array.isArray(targetValue) || !targetValue.includes(actualValue)) {
            return false;
          }
          break;
        default:
          return false;
      }
    }

    return true;
  }

  // =========================================================================
  // WORKFLOW EXECUTION RUNTIME
  // =========================================================================

  /**
   * Execute workflow triggered by an event.
   */
  async executeWorkflow(
    orgId: string,
    workflowId: string,
    triggerEventId: string,
    payload: Record<string, any>,
  ) {
    const workflow = await this.prisma.client.workflowDefinition.findFirst({
      where: { id: workflowId, organizationId: orgId },
      include: {
        versions: { orderBy: { version: 'desc' }, take: 1 },
      },
    });

    if (!workflow) {
      throw new NotFoundException({
        code: 'WORKFLOW_NOT_FOUND',
        message: 'Workflow not found in your organization.',
      });
    }

    if (!workflow.isEnabled) {
      return { status: 'skipped', reason: 'Workflow is disabled' };
    }

    const version = workflow.versions[0];
    if (!version) {
      return { status: 'skipped', reason: 'No active version found' };
    }

    // 1. Evaluate trigger conditions
    const conditions = (version.conditions as any[]) || [];
    const conditionsMatch = this.evaluateConditions(conditions, payload);

    if (!conditionsMatch) {
      return { status: 'skipped', reason: 'Trigger conditions did not match event payload' };
    }

    // 2. Create WorkflowExecution record
    const execution = await this.prisma.client.workflowExecution.create({
      data: {
        organizationId: orgId,
        workflowVersionId: version.id,
        triggerEventId,
        status: 'running',
        startedAt: new Date(),
      },
    });

    // 3. Sequentially execute defined actions
    const actions = (version.actions as any[]) || [];
    const stepResults: any[] = [];
    let executionError: string | null = null;

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const stepStartTime = new Date();

      try {
        let stepOutput: any = null;

        switch (action.type) {
          case 'create_task':
            stepOutput = await this.executeCreateTaskAction(orgId, payload, action.params);
            break;
          case 'update_lead':
            stepOutput = await this.executeUpdateLeadAction(orgId, payload, action.params);
            break;
          case 'send_notification':
            stepOutput = await this.executeNotificationAction(orgId, payload, action.params);
            break;
          case 'trigger_webhook':
            stepOutput = await this.executeWebhookAction(action.params);
            break;
          default:
            stepOutput = { skipped: true, reason: `Unknown action type: ${action.type}` };
        }

        await this.prisma.client.workflowStepExecution.create({
          data: {
            executionId: execution.id,
            stepIndex: i + 1,
            actionType: action.type,
            input: action.params,
            output: stepOutput,
            status: 'completed',
            startedAt: stepStartTime,
            completedAt: new Date(),
          },
        });

        stepResults.push({
          step: i + 1,
          type: action.type,
          status: 'completed',
          output: stepOutput,
        });
      } catch (err: any) {
        executionError = err.message || 'Action step execution failed';
        this.logger.error(`Workflow action step ${i + 1} failed: ${executionError}`);

        await this.prisma.client.workflowStepExecution.create({
          data: {
            executionId: execution.id,
            stepIndex: i + 1,
            actionType: action.type,
            input: action.params,
            status: 'failed',
            error: executionError,
            startedAt: stepStartTime,
            completedAt: new Date(),
          },
        });

        stepResults.push({
          step: i + 1,
          type: action.type,
          status: 'failed',
          error: executionError,
        });
        break; // Stop execution on error
      }
    }

    const finalStatus = executionError ? 'failed' : 'completed';

    await this.prisma.client.workflowExecution.update({
      where: { id: execution.id },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        error: executionError,
      },
    });

    return {
      executionId: execution.id,
      workflowId: workflow.id,
      status: finalStatus,
      stepResults,
      error: executionError,
    };
  }

  // =========================================================================
  // TRANSACTIONAL OUTBOX PATTERN
  // =========================================================================

  /**
   * Write an OutboxEvent with idempotency key for reliable async dispatching.
   */
  async createOutboxEvent(
    orgId: string,
    eventType: string,
    entityType: string,
    entityId: string,
    payload: Record<string, any>,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma.client;
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(`${orgId}:${eventType}:${entityType}:${entityId}:${Date.now()}:${Math.random()}`)
      .digest('hex');

    return client.outboxEvent.create({
      data: {
        organizationId: orgId,
        eventType,
        entityType,
        entityId,
        payload,
        status: 'pending',
        idempotencyKey,
      },
    });
  }

  /**
   * Get executions history for a workflow.
   */
  async getWorkflowExecutions(orgId: string, workflowId: string) {
    const workflow = await this.prisma.client.workflowDefinition.findFirst({
      where: { id: workflowId, organizationId: orgId },
    });

    if (!workflow) {
      throw new NotFoundException({
        code: 'WORKFLOW_NOT_FOUND',
        message: 'Workflow not found in your organization.',
      });
    }

    return this.prisma.client.workflowExecution.findMany({
      where: { organizationId: orgId, workflowVersion: { workflowId } },
      include: {
        steps: { orderBy: { stepIndex: 'asc' } },
        workflowVersion: { select: { version: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
  }

  // =========================================================================
  // ACTION EXECUTION IMPLEMENTATIONS
  // =========================================================================

  private async executeCreateTaskAction(orgId: string, payload: any, params: any) {
    const leadId = payload.leadId || payload.id;
    const assignedToId = params.assignedToId || payload.assignedToId;

    if (!assignedToId) {
      return { skipped: true, reason: 'No assignee available for task creation' };
    }

    const task = await this.prisma.client.task.create({
      data: {
        organizationId: orgId,
        leadId,
        taskType: params.taskType || 'follow_up',
        title: params.title || 'Follow up with lead',
        description: params.description || 'Automated task created by workflow engine',
        priority: params.priority || 'medium',
        assignedToId,
        dueAt: new Date(Date.now() + (params.dueInHours || 24) * 60 * 60 * 1000),
        createdById: assignedToId,
      },
    });

    return { taskId: task.id, title: task.title, dueAt: task.dueAt };
  }

  private async executeUpdateLeadAction(orgId: string, payload: any, params: any) {
    const leadId = payload.leadId || payload.id;
    if (!leadId) return { skipped: true, reason: 'No lead ID in payload' };

    const updateData: Prisma.LeadUpdateInput = {};
    if (params.status) updateData.status = params.status;
    if (params.priority) updateData.priority = params.priority;

    const updated = await this.prisma.client.lead.update({
      where: { id: leadId },
      data: updateData,
    });

    return { leadId: updated.id, status: updated.status, priority: updated.priority };
  }

  private async executeNotificationAction(orgId: string, payload: any, params: any) {
    const userId = params.userId || payload.assignedToId;
    if (!userId) return { skipped: true, reason: 'No recipient user for notification' };

    const notif = await this.prisma.client.notification.create({
      data: {
        organizationId: orgId,
        userId,
        notificationType: params.notificationType || 'workflow_alert',
        title: params.title || 'Workflow Alert',
        body: params.body || 'An automated workflow triggered an action on your account.',
        deepLink: payload.leadId ? `/leads/${payload.leadId}` : null,
      },
    });

    return { notificationId: notif.id, title: notif.title };
  }

  private async executeWebhookAction(params: any) {
    if (!params.url) {
      throw new BadRequestException('Webhook action missing destination url');
    }

    // SSRF Protection: Validate destination URL against forbidden private/loopback IPs
    await validateSafeUrl(params.url, true);

    this.logger.log(`Outbound webhook simulated successfully to ${params.url}`);
    return { dispatched: true, url: params.url, timestamp: new Date() };
  }
}
