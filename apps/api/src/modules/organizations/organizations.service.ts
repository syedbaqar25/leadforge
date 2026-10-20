import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { AuditService } from '../audit/audit.service';
import { UpdateOrgDto, InviteMemberDto, UpdateMemberRoleDto } from './dto';
import { type Role } from '@leadforge/shared';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Get current active organization profile and stats
   */
  async getCurrentOrg(orgId: string) {
    const org = await this.prisma.client.organization.findUnique({
      where: { id: orgId },
      include: {
        _count: {
          select: {
            memberships: true,
            leads: { where: { deletedAt: null } },
            deals: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundException({
        code: 'ORG_NOT_FOUND',
        message: 'Organization not found.',
      });
    }

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      settings: org.settings,
      timezone: org.timezone,
      currency: org.currency,
      aiEnabled: org.aiEnabled,
      logoUrl: org.logoUrl,
      createdAt: org.createdAt,
      stats: {
        membersCount: org._count.memberships,
        activeLeadsCount: org._count.leads,
        activeDealsCount: org._count.deals,
      },
    };
  }

  /**
   * Update organization settings (Owner / Admin only)
   */
  async updateCurrentOrg(orgId: string, dto: UpdateOrgDto, currentUserId: string) {
    const existing = await this.prisma.client.organization.findUnique({
      where: { id: orgId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'ORG_NOT_FOUND',
        message: 'Organization not found.',
      });
    }

    const updated = await this.prisma.client.organization.update({
      where: { id: orgId },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.timezone ? { timezone: dto.timezone } : {}),
        ...(dto.currency ? { currency: dto.currency } : {}),
        ...(dto.aiEnabled !== undefined ? { aiEnabled: dto.aiEnabled } : {}),
        ...(dto.settings
          ? {
              settings: {
                ...((existing.settings as Record<string, unknown>) || {}),
                ...dto.settings,
              } as any,
            }
          : {}),
      },
    });

    await this.auditService.log({
      organizationId: orgId,
      userId: currentUserId,
      action: 'org:update_settings',
      entityType: 'Organization',
      entityId: orgId,
      before: {
        name: existing.name,
        timezone: existing.timezone,
        currency: existing.currency,
        aiEnabled: existing.aiEnabled,
      },
      after: {
        name: updated.name,
        timezone: updated.timezone,
        currency: updated.currency,
        aiEnabled: updated.aiEnabled,
      },
    });

    return updated;
  }

  /**
   * List all organizations that the user belongs to
   */
  async getUserOrgs(userId: string) {
    const memberships = await this.prisma.client.membership.findMany({
      where: { userId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            timezone: true,
            currency: true,
            aiEnabled: true,
            logoUrl: true,
            createdAt: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return memberships.map((m: any) => ({
      organization: m.organization,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  /**
   * Switch user active organization and issue a new JWT scoped to the target org
   */
  async switchOrg(userId: string, targetOrgId: string) {
    const membership = await this.prisma.client.membership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: targetOrgId,
        },
      },
      include: {
        organization: true,
        user: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_TENANT',
        message: 'You are not a member of the requested organization.',
      });
    }

    const secret = process.env.JWT_SECRET || 'fallback_secret_for_tests_only';
    const accessToken = jwt.sign(
      {
        sub: userId,
        orgId: targetOrgId,
        role: membership.role,
        email: membership.user.email,
      },
      secret,
      { expiresIn: '15m' },
    );

    return {
      accessToken,
      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
      },
      role: membership.role,
    };
  }

  /**
   * List members of the current organization
   */
  async getMembers(orgId: string) {
    const members = await this.prisma.client.membership.findMany({
      where: { organizationId: orgId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            emailVerified: true,
            lastLoginAt: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });

    return members.map((m: any) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      user: m.user,
    }));
  }

  /**
   * Send an invitation to join the organization
   */
  async inviteMember(orgId: string, invitedById: string, dto: InviteMemberDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    // 1. Check if user is already a member
    const existingMember = await this.prisma.client.membership.findFirst({
      where: {
        organizationId: orgId,
        user: { email: normalizedEmail },
      },
    });

    if (existingMember) {
      throw new ConflictException({
        code: 'ALREADY_MEMBER',
        message: 'This user is already a member of this organization.',
      });
    }

    // 2. Fetch org and inviter details
    const [org, inviter] = await Promise.all([
      this.prisma.client.organization.findUnique({ where: { id: orgId } }),
      this.prisma.client.user.findUnique({ where: { id: invitedById } }),
    ]);

    if (!org || !inviter) {
      throw new NotFoundException('Organization or inviter not found');
    }

    // 3. Generate secure invitation token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // 4. Create or replace invitation
    await this.prisma.client.invitation.deleteMany({
      where: {
        organizationId: orgId,
        email: normalizedEmail,
        acceptedAt: null,
      },
    });

    const invitation = await this.prisma.client.invitation.create({
      data: {
        organizationId: orgId,
        email: normalizedEmail,
        role: dto.role as Role,
        tokenHash,
        invitedById,
        expiresAt,
      },
    });

    // 5. Send invitation email
    this.emailService
      .sendInvitationEmail(normalizedEmail, org.name, rawToken, inviter.name, dto.role)
      .catch((err) => this.logger.error(`Failed sending invitation email: ${err.message}`));

    // 6. Audit log
    await this.auditService.log({
      organizationId: orgId,
      userId: invitedById,
      action: 'org:invite_member',
      entityType: 'Invitation',
      entityId: invitation.id,
      after: { email: normalizedEmail, role: dto.role },
    });

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      message: 'Invitation sent successfully.',
    };
  }

  /**
   * View invitation details by raw token (Public endpoint)
   */
  async getInvitationByToken(rawToken: string) {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const invitation = await this.prisma.client.invitation.findFirst({
      where: {
        tokenHash,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
          },
        },
        invitedBy: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!invitation) {
      throw new NotFoundException({
        code: 'INVITATION_NOT_FOUND',
        message: 'Invitation link is invalid, expired, or has already been accepted.',
      });
    }

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      organizationName: invitation.organization.name,
      inviterName: invitation.invitedBy.name,
      expiresAt: invitation.expiresAt,
    };
  }

  /**
   * Accept an invitation with an authenticated user account
   */
  async acceptInvitation(userId: string, rawToken: string) {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const invitation = await this.prisma.client.invitation.findFirst({
      where: {
        tokenHash,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { organization: true },
    });

    if (!invitation) {
      throw new BadRequestException({
        code: 'INVALID_INVITATION',
        message: 'Invitation link is invalid or has expired.',
      });
    }

    // Check if user is already a member
    const existing = await this.prisma.client.membership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: invitation.organizationId,
        },
      },
    });

    if (existing) {
      await this.prisma.client.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      return {
        message: 'You are already a member of this organization.',
        organizationId: invitation.organizationId,
      };
    }

    await this.prisma.client.$transaction([
      this.prisma.client.membership.create({
        data: {
          userId,
          organizationId: invitation.organizationId,
          role: invitation.role,
        },
      }),
      this.prisma.client.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      }),
    ]);

    await this.auditService.log({
      organizationId: invitation.organizationId,
      userId,
      action: 'org:accept_invitation',
      entityType: 'Membership',
      entityId: userId,
      after: { role: invitation.role },
    });

    return {
      message: 'Invitation accepted successfully.',
      organizationId: invitation.organizationId,
    };
  }

  /**
   * Update member role with ownership safeguard (cannot demote last owner)
   */
  async updateMemberRole(
    orgId: string,
    membershipId: string,
    dto: UpdateMemberRoleDto,
    currentUserId: string,
  ) {
    const membership = await this.prisma.client.membership.findFirst({
      where: { id: membershipId, organizationId: orgId },
    });

    if (!membership) {
      throw new NotFoundException({
        code: 'MEMBER_NOT_FOUND',
        message: 'Member not found in this organization.',
      });
    }

    // OWNERSHIP SAFEGUARD: Cannot demote the last remaining owner
    if (membership.role === 'owner' && dto.role !== 'owner') {
      const ownerCount = await this.prisma.client.membership.count({
        where: { organizationId: orgId, role: 'owner' },
      });

      if (ownerCount <= 1) {
        throw new BadRequestException({
          code: 'LAST_OWNER_PROTECTION',
          message: 'Cannot demote the last remaining organization owner. Transfer ownership first.',
        });
      }
    }

    const updated = await this.prisma.client.membership.update({
      where: { id: membership.id },
      data: { role: dto.role as Role },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    await this.auditService.log({
      organizationId: orgId,
      userId: currentUserId,
      action: 'org:update_member_role',
      entityType: 'Membership',
      entityId: membership.id,
      before: { role: membership.role },
      after: { role: dto.role, targetUserId: membership.userId },
    });

    return updated;
  }

  /**
   * Remove member from organization with ownership safeguard (cannot remove last owner)
   */
  async removeMember(orgId: string, membershipId: string, currentUserId: string) {
    const membership = await this.prisma.client.membership.findFirst({
      where: { id: membershipId, organizationId: orgId },
    });

    if (!membership) {
      throw new NotFoundException({
        code: 'MEMBER_NOT_FOUND',
        message: 'Member not found in this organization.',
      });
    }

    // OWNERSHIP SAFEGUARD: Cannot remove the last owner
    if (membership.role === 'owner') {
      const ownerCount = await this.prisma.client.membership.count({
        where: { organizationId: orgId, role: 'owner' },
      });

      if (ownerCount <= 1) {
        throw new BadRequestException({
          code: 'LAST_OWNER_PROTECTION',
          message: 'Cannot remove the last remaining organization owner.',
        });
      }
    }

    await this.prisma.client.membership.delete({
      where: { id: membership.id },
    });

    await this.auditService.log({
      organizationId: orgId,
      userId: currentUserId,
      action: 'org:remove_member',
      entityType: 'Membership',
      entityId: membership.id,
      before: { userId: membership.userId, role: membership.role },
    });

    return { message: 'Member removed successfully.' };
  }
}
