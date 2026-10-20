import { OrganizationsService } from '../src/modules/organizations/organizations.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

describe('OrganizationsService — Multi-Tenancy & Membership Controls', () => {
  let orgsService: OrganizationsService;
  let mockPrisma: any;
  let mockEmailService: any;
  let mockAuditService: any;

  const mockOrg = {
    id: 'org-123',
    name: 'Wayne Enterprises',
    slug: 'wayne-enterprises',
    settings: {},
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    aiEnabled: true,
    logoUrl: null,
    createdAt: new Date(),
    _count: { memberships: 2, leads: 15, deals: 4 },
  };

  const mockOwner = {
    id: 'user-owner',
    email: 'bruce@wayne.com',
    name: 'Bruce Wayne',
  };

  const mockMember = {
    id: 'mem-1',
    organizationId: 'org-123',
    userId: 'user-owner',
    role: 'owner',
    user: mockOwner,
  };

  beforeEach(() => {
    process.env.JWT_SECRET = 'super_secure_random_string_that_is_at_least_32_characters_long_123'; // fake test key

    mockPrisma = {
      client: {
        organization: {
          findUnique: jest.fn().mockResolvedValue(mockOrg),
          update: jest
            .fn()
            .mockImplementation((args) => Promise.resolve({ ...mockOrg, ...args.data })),
        },
        user: {
          findUnique: jest.fn().mockResolvedValue(mockOwner),
        },
        membership: {
          findMany: jest.fn(),
          findFirst: jest.fn(),
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
          count: jest.fn(),
        },
        invitation: {
          findFirst: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          deleteMany: jest.fn(),
        },
        $transaction: jest.fn(async (cbOrArray) => {
          if (typeof cbOrArray === 'function') {
            return cbOrArray(mockPrisma.client);
          }
          return Promise.all(cbOrArray);
        }),
      },
    };

    mockEmailService = {
      sendInvitationEmail: jest.fn().mockResolvedValue(true),
    };

    mockAuditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    orgsService = new OrganizationsService(mockPrisma, mockEmailService, mockAuditService);
  });

  describe('Organization Switching & Multi-Tenant Access', () => {
    it('issues a new JWT scoped to the target organization when membership exists', async () => {
      mockPrisma.client.membership.findUnique.mockResolvedValue({
        id: 'mem-target',
        userId: 'user-owner',
        organizationId: 'org-123',
        role: 'owner',
        organization: mockOrg,
        user: mockOwner,
      });

      const result = await orgsService.switchOrg('user-owner', 'org-123');

      expect(result.accessToken).toBeDefined();
      expect(result.role).toBe('owner');
      const decoded: any = jwt.verify(result.accessToken, process.env.JWT_SECRET!);
      expect(decoded.orgId).toBe('org-123');
      expect(decoded.sub).toBe('user-owner');
    });

    it('denies switching and throws 403 when user is not a member of target org', async () => {
      mockPrisma.client.membership.findUnique.mockResolvedValue(null);

      await expect(orgsService.switchOrg('user-owner', 'foreign-org-999')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('Invitations & Acceptance Flow', () => {
    it('dispatches invitation email with secure hashed token', async () => {
      mockPrisma.client.membership.findFirst.mockResolvedValue(null); // Not already a member
      mockPrisma.client.invitation.create.mockResolvedValue({
        id: 'invite-1',
        email: 'lucius@wayne.com',
        role: 'admin',
        expiresAt: new Date(Date.now() + 86400000),
      });

      const result = await orgsService.inviteMember('org-123', 'user-owner', {
        email: 'lucius@wayne.com',
        role: 'admin',
      });

      expect(result.email).toBe('lucius@wayne.com');
      expect(mockEmailService.sendInvitationEmail).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'org:invite_member' }),
      );
    });

    it('rejects invitation if user is already a member', async () => {
      mockPrisma.client.membership.findFirst.mockResolvedValue(mockMember);

      await expect(
        orgsService.inviteMember('org-123', 'user-owner', {
          email: mockOwner.email,
          role: 'admin',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Ownership Safeguards', () => {
    it('prevents demoting the last remaining organization owner', async () => {
      mockPrisma.client.membership.findFirst.mockResolvedValue(mockMember);
      mockPrisma.client.membership.count.mockResolvedValue(1); // Only 1 owner exists

      await expect(
        orgsService.updateMemberRole('org-123', 'mem-1', { role: 'sales_manager' }, 'user-owner'),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows demoting an owner if another owner exists', async () => {
      mockPrisma.client.membership.findFirst.mockResolvedValue(mockMember);
      mockPrisma.client.membership.count.mockResolvedValue(2); // 2 owners exist
      mockPrisma.client.membership.update.mockResolvedValue({ ...mockMember, role: 'admin' });

      const updated = await orgsService.updateMemberRole(
        'org-123',
        'mem-1',
        { role: 'admin' },
        'user-owner',
      );

      expect(updated.role).toBe('admin');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'org:update_member_role' }),
      );
    });

    it('prevents removing the last remaining organization owner', async () => {
      mockPrisma.client.membership.findFirst.mockResolvedValue(mockMember);
      mockPrisma.client.membership.count.mockResolvedValue(1); // Only 1 owner exists

      await expect(orgsService.removeMember('org-123', 'mem-1', 'user-owner')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
