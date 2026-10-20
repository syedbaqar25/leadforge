import { ApprovalsService } from '../src/modules/approvals/approvals.service';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';

describe('ApprovalsService — Human-in-the-Loop Approval Engine (PART 1.8 & PART 12 Phase 6)', () => {
  let approvalsService: ApprovalsService;
  let mockPrisma: any;
  let mockAuditService: any;

  const orgId = 'org-tenant-123';
  const managerUserId = 'user-manager-789';

  const mockPendingApproval = {
    id: 'app-uuid-1',
    organizationId: orgId,
    approvalType: 'message_send',
    entityType: 'message',
    entityId: 'msg-uuid-1',
    proposedPayload: {
      channel: 'email',
      toAddress: 'prospect@company.com',
      subject: 'Accelerating Outbound Growth',
      body: 'Hi Robert, saw your post on high-throughput pipelines...',
    },
    status: 'pending',
    version: 1,
    requestedById: 'user-sales-456',
    reviewedById: null,
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockPrisma = {
      client: {
        approvalRequest: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
          count: jest.fn(),
          update: jest.fn(),
        },
        message: {
          findFirst: jest.fn(),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        aiSuggestion: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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

    approvalsService = new ApprovalsService(mockPrisma, mockAuditService);
  });

  describe('Approval Queue & Retrieval', () => {
    it('retrieves paginated approval requests scoped strictly to organization', async () => {
      mockPrisma.client.approvalRequest.findMany.mockResolvedValue([mockPendingApproval]);
      mockPrisma.client.approvalRequest.count.mockResolvedValue(1);

      const result = await approvalsService.getApprovals(orgId, {
        status: 'pending',
        page: 1,
        pageSize: 25,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('app-uuid-1');
      expect(result.meta.total).toBe(1);
      expect(mockPrisma.client.approvalRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: orgId, status: 'pending' }),
        }),
      );
    });

    it('returns approval details with linked message context', async () => {
      mockPrisma.client.approvalRequest.findFirst.mockResolvedValue(mockPendingApproval);
      mockPrisma.client.message.findFirst.mockResolvedValue({
        id: 'msg-uuid-1',
        lead: { fullName: 'Robert Oppenheimer', company: 'Los Alamos Labs' },
      });

      const result = await approvalsService.getApprovalById(orgId, 'app-uuid-1');

      expect(result.id).toBe('app-uuid-1');
      expect(result.entityDetails.lead.fullName).toBe('Robert Oppenheimer');
    });

    it('returns 404 Not Found when approval does not exist or belongs to another organization (IDOR)', async () => {
      mockPrisma.client.approvalRequest.findFirst.mockResolvedValue(null);

      await expect(approvalsService.getApprovalById(orgId, 'foreign-approval-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Manager Decision Workflow', () => {
    it('approves request, transitions message status to approved, and records audit history', async () => {
      mockPrisma.client.approvalRequest.findFirst.mockResolvedValue(mockPendingApproval);

      const updatedRecord = {
        ...mockPendingApproval,
        status: 'approved',
        version: 2,
        reviewedById: managerUserId,
        reviewedAt: new Date(),
      };
      mockPrisma.client.approvalRequest.update.mockResolvedValue(updatedRecord);

      const result = await approvalsService.decideApproval(orgId, managerUserId, 'app-uuid-1', {
        decision: 'approved',
        version: 1,
        feedback: 'Looks good, send it out.',
      });

      expect(result.status).toBe('approved');
      expect(result.version).toBe(2);

      // Verify underlying Message status transitioned to 'approved'
      expect(mockPrisma.client.message.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'msg-uuid-1', organizationId: orgId },
          data: expect.objectContaining({ status: 'approved' }),
        }),
      );

      // Verify activity and audit log
      expect(mockPrisma.client.activity.create).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'approval.approved',
          entityType: 'approval_request',
          entityId: 'app-uuid-1',
        }),
      );
    });

    it('applies reviewer modifications before approval', async () => {
      mockPrisma.client.approvalRequest.findFirst.mockResolvedValue(mockPendingApproval);

      const editedBody = 'Refined pitch text edited by sales manager';
      const updatedRecord = {
        ...mockPendingApproval,
        status: 'approved',
        version: 2,
        proposedPayload: { ...mockPendingApproval.proposedPayload, body: editedBody },
      };
      mockPrisma.client.approvalRequest.update.mockResolvedValue(updatedRecord);

      await approvalsService.decideApproval(orgId, managerUserId, 'app-uuid-1', {
        decision: 'approved',
        version: 1,
        editedPayload: { ...mockPendingApproval.proposedPayload, body: editedBody },
      });

      expect(mockPrisma.client.message.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'approved',
            bodyPreview: editedBody,
          }),
        }),
      );
    });

    it('rejects request, reverts message status to draft, and records rejection feedback', async () => {
      mockPrisma.client.approvalRequest.findFirst.mockResolvedValue(mockPendingApproval);

      const updatedRecord = {
        ...mockPendingApproval,
        status: 'rejected',
        version: 2,
      };
      mockPrisma.client.approvalRequest.update.mockResolvedValue(updatedRecord);

      const result = await approvalsService.decideApproval(orgId, managerUserId, 'app-uuid-1', {
        decision: 'rejected',
        version: 1,
        feedback: 'Too aggressive on discount pricing.',
      });

      expect(result.status).toBe('rejected');

      // Message reverted to draft
      expect(mockPrisma.client.message.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'msg-uuid-1', organizationId: orgId },
          data: { status: 'draft' },
        }),
      );
    });

    it('rejects re-deciding an already finalized request with 400 BadRequestException', async () => {
      mockPrisma.client.approvalRequest.findFirst.mockResolvedValue({
        ...mockPendingApproval,
        status: 'approved',
      });

      await expect(
        approvalsService.decideApproval(orgId, managerUserId, 'app-uuid-1', {
          decision: 'rejected',
          version: 2,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects decision with 409 ConflictException when version does not match', async () => {
      mockPrisma.client.approvalRequest.findFirst.mockResolvedValue({
        ...mockPendingApproval,
        version: 3, // current DB version is 3
      });

      // Manager sends stale version 1
      await expect(
        approvalsService.decideApproval(orgId, managerUserId, 'app-uuid-1', {
          decision: 'approved',
          version: 1,
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.client.approvalRequest.update).not.toHaveBeenCalled();
    });
  });
});
