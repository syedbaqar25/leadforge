import { WorkflowsService } from '../src/modules/workflows/workflows.service';
import { validateSafeUrl } from '../src/common/security/ssrf';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('WorkflowsService — Workflow Automation Engine (PART 1.2, 1.3 & PART 12 Phase 8)', () => {
  let workflowsService: WorkflowsService;
  let mockPrisma: any;
  let mockAuditService: any;

  const orgId = 'org-tenant-123';
  const otherOrgId = 'org-tenant-999';
  const userId = 'user-admin-456';

  const mockWorkflowDef = {
    id: 'wf-uuid-1',
    organizationId: orgId,
    name: 'High Score Lead Followup',
    description: 'Auto-create task when lead score exceeds 75',
    isEnabled: true,
    testMode: false,
    concurrencyLimit: 5,
    createdById: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockWorkflowVersion = {
    id: 'wfv-uuid-1',
    workflowId: 'wf-uuid-1',
    version: 1,
    trigger: { type: 'score_changed', event: 'lead.score_updated' },
    conditions: [
      { field: 'score', operator: 'greater_than', value: 70 },
      { field: 'scoreBand', operator: 'equals', value: 'hot' },
    ],
    actions: [
      {
        type: 'create_task',
        params: {
          title: 'Priority Outreach: Hot Lead',
          taskType: 'call',
          dueInHours: 4,
          priority: 'urgent',
        },
      },
      {
        type: 'send_notification',
        params: {
          title: 'Hot Lead Alert',
          body: 'A lead just scored into the Hot tier',
        },
      },
    ],
    createdAt: new Date(),
  };

  beforeEach(() => {
    mockPrisma = {
      client: {
        workflowDefinition: {
          create: jest.fn(),
          findMany: jest.fn(),
          findFirst: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
          count: jest.fn(),
        },
        workflowVersion: {
          create: jest.fn(),
        },
        workflowExecution: {
          create: jest.fn(),
          update: jest.fn(),
          findMany: jest.fn(),
        },
        workflowStepExecution: {
          create: jest.fn(),
        },
        outboxEvent: {
          create: jest.fn(),
        },
        task: {
          create: jest.fn().mockResolvedValue({
            id: 'task-1',
            title: 'Priority Outreach: Hot Lead',
            dueAt: new Date(),
          }),
        },
        lead: {
          update: jest.fn().mockResolvedValue({
            id: 'lead-1',
            status: 'qualified',
            priority: 'urgent',
          }),
        },
        notification: {
          create: jest.fn().mockResolvedValue({
            id: 'notif-1',
            title: 'Hot Lead Alert',
          }),
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

    workflowsService = new WorkflowsService(mockPrisma, mockAuditService);
  });

  describe('Workflow Creation and Versioning', () => {
    it('creates a workflow definition with initial version 1 and logs audit trail', async () => {
      mockPrisma.client.workflowDefinition.create.mockResolvedValue(mockWorkflowDef);
      mockPrisma.client.workflowVersion.create.mockResolvedValue(mockWorkflowVersion);

      const result = await workflowsService.createWorkflow(orgId, userId, {
        name: 'High Score Lead Followup',
        description: 'Auto-create task when lead score exceeds 75',
        isEnabled: true,
        testMode: false,
        trigger: mockWorkflowVersion.trigger,
        conditions: mockWorkflowVersion.conditions,
        actions: mockWorkflowVersion.actions,
      });

      expect(result.id).toBe('wf-uuid-1');
      expect(result.currentVersion.version).toBe(1);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: orgId,
          action: 'workflow.create',
          entityType: 'workflow_definition',
        }),
      );
    });

    it('creates an immutable new version (version 2) when workflow trigger/actions are updated', async () => {
      mockPrisma.client.workflowDefinition.findFirst.mockResolvedValue({
        ...mockWorkflowDef,
        versions: [mockWorkflowVersion],
      });

      const updatedVersion = {
        ...mockWorkflowVersion,
        id: 'wfv-uuid-2',
        version: 2,
      };

      mockPrisma.client.workflowVersion.create.mockResolvedValue(updatedVersion);
      mockPrisma.client.workflowDefinition.update.mockResolvedValue({
        ...mockWorkflowDef,
        name: 'Updated Lead Followup Name',
      });

      const result = await workflowsService.updateWorkflow(orgId, userId, 'wf-uuid-1', {
        name: 'Updated Lead Followup Name',
        actions: [
          {
            type: 'create_task',
            params: { title: 'New 2-hour task' },
          },
        ],
      });

      expect(mockPrisma.client.workflowVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workflowId: 'wf-uuid-1',
            version: 2,
          }),
        }),
      );
      expect(result.currentVersion.version).toBe(2);
    });
  });

  describe('Tenant Isolation & BOLA/IDOR Defense', () => {
    it('returns 404 NotFoundException when attempting to access another tenant workflow', async () => {
      mockPrisma.client.workflowDefinition.findFirst.mockResolvedValue(null);

      await expect(workflowsService.getWorkflowById(otherOrgId, 'wf-uuid-1')).rejects.toThrow(
        NotFoundException,
      );

      expect(mockPrisma.client.workflowDefinition.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'wf-uuid-1', organizationId: otherOrgId },
        }),
      );
    });

    it('rejects deletion of cross-tenant workflow with 404', async () => {
      mockPrisma.client.workflowDefinition.findFirst.mockResolvedValue(null);

      await expect(
        workflowsService.deleteWorkflow(otherOrgId, userId, 'wf-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Condition Evaluation Engine', () => {
    it('evaluates equals and not_equals operators correctly', () => {
      const conditions = [
        { field: 'status', operator: 'equals', value: 'hot' },
        { field: 'country', operator: 'not_equals', value: 'DE' },
      ];

      expect(
        workflowsService.evaluateConditions(conditions, { status: 'hot', country: 'IN' }),
      ).toBe(true);

      expect(
        workflowsService.evaluateConditions(conditions, { status: 'cold', country: 'IN' }),
      ).toBe(false);
    });

    it('evaluates greater_than and less_than operators correctly', () => {
      const conditions = [
        { field: 'score', operator: 'greater_than', value: 50 },
        { field: 'cost', operator: 'less_than', value: 100 },
      ];

      expect(workflowsService.evaluateConditions(conditions, { score: 75, cost: 50 })).toBe(true);

      expect(workflowsService.evaluateConditions(conditions, { score: 40, cost: 50 })).toBe(false);
    });

    it('evaluates contains and in operators correctly', () => {
      const conditions = [
        { field: 'email', operator: 'contains', value: '@acme.com' },
        { field: 'source', operator: 'in', value: ['website', 'referral'] },
      ];

      expect(
        workflowsService.evaluateConditions(conditions, {
          email: 'founder@acme.com',
          source: 'website',
        }),
      ).toBe(true);

      expect(
        workflowsService.evaluateConditions(conditions, {
          email: 'user@gmail.com',
          source: 'website',
        }),
      ).toBe(false);

      expect(
        workflowsService.evaluateConditions(conditions, {
          email: 'founder@acme.com',
          source: 'outbound_cold',
        }),
      ).toBe(false);
    });

    it('passes automatically when conditions array is empty or undefined', () => {
      expect(workflowsService.evaluateConditions([], { any: 'data' })).toBe(true);
      expect(workflowsService.evaluateConditions(null, { any: 'data' })).toBe(true);
    });
  });

  describe('Workflow Execution Runtime & Actions', () => {
    it('skips execution if workflow is disabled', async () => {
      mockPrisma.client.workflowDefinition.findFirst.mockResolvedValue({
        ...mockWorkflowDef,
        isEnabled: false,
        versions: [mockWorkflowVersion],
      });

      const res = await workflowsService.executeWorkflow(orgId, 'wf-uuid-1', 'event-123', {
        score: 85,
        scoreBand: 'hot',
      });

      expect(res.status).toBe('skipped');
      expect(mockPrisma.client.workflowExecution.create).not.toHaveBeenCalled();
    });

    it('skips execution if conditions do not match payload', async () => {
      mockPrisma.client.workflowDefinition.findFirst.mockResolvedValue({
        ...mockWorkflowDef,
        isEnabled: true,
        versions: [mockWorkflowVersion],
      });

      const res = await workflowsService.executeWorkflow(
        orgId,
        'wf-uuid-1',
        'event-123',
        { score: 30, scoreBand: 'cold' }, // Does not meet score > 70
      );

      expect(res.status).toBe('skipped');
      expect(mockPrisma.client.workflowExecution.create).not.toHaveBeenCalled();
    });

    it('executes actions in order and updates execution to completed', async () => {
      mockPrisma.client.workflowDefinition.findFirst.mockResolvedValue({
        ...mockWorkflowDef,
        isEnabled: true,
        versions: [mockWorkflowVersion],
      });

      mockPrisma.client.workflowExecution.create.mockResolvedValue({
        id: 'exec-uuid-1',
        status: 'running',
      });
      mockPrisma.client.workflowStepExecution.create.mockResolvedValue({ id: 'step-1' });
      mockPrisma.client.workflowExecution.update.mockResolvedValue({
        id: 'exec-uuid-1',
        status: 'completed',
      });

      const res = await workflowsService.executeWorkflow(orgId, 'wf-uuid-1', 'event-123', {
        leadId: 'lead-1',
        assignedToId: 'user-sales-1',
        score: 85,
        scoreBand: 'hot',
      });

      expect(res.status).toBe('completed');
      expect(mockPrisma.client.task.create).toHaveBeenCalled();
      expect(mockPrisma.client.notification.create).toHaveBeenCalled();
      expect(mockPrisma.client.workflowExecution.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'exec-uuid-1' },
          data: expect.objectContaining({ status: 'completed' }),
        }),
      );
    });
  });

  describe('Transactional Outbox Pattern', () => {
    it('creates an OutboxEvent with unique deterministic SHA-256 idempotency key', async () => {
      mockPrisma.client.outboxEvent.create.mockImplementation((args: any) =>
        Promise.resolve(args.data),
      );

      const event = await workflowsService.createOutboxEvent(
        orgId,
        'lead.score_updated',
        'lead',
        'lead-uuid-123',
        { score: 82, band: 'hot' },
      );

      expect(event.organizationId).toBe(orgId);
      expect(event.eventType).toBe('lead.score_updated');
      expect(event.status).toBe('pending');
      expect(event.idempotencyKey).toBeDefined();
      expect(event.idempotencyKey.length).toBe(64); // SHA-256 hex string length
    });
  });

  describe('SSRF Protection (PART 1.3)', () => {
    it('rejects AWS/GCP cloud metadata link-local endpoints (169.254.169.254)', async () => {
      await expect(validateSafeUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects loopback addresses (127.0.0.1)', async () => {
      await expect(validateSafeUrl('http://127.0.0.1:8080/webhook')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects private RFC1918 class A, B, C addresses', async () => {
      await expect(validateSafeUrl('http://10.0.0.5/hook')).rejects.toThrow(BadRequestException);
      await expect(validateSafeUrl('http://172.16.1.1/hook')).rejects.toThrow(BadRequestException);
      await expect(validateSafeUrl('http://192.168.1.100/hook')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects malformed URLs', async () => {
      await expect(validateSafeUrl('not-a-valid-url')).rejects.toThrow(BadRequestException);
    });

    it('accepts safe external HTTPS URLs', async () => {
      const res = await validateSafeUrl('https://example.com/webhook');
      expect(res.url.hostname).toBe('example.com');
      expect(res.resolvedIp).toBeDefined();
    });
  });
});
