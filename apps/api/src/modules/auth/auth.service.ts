import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { AuditService } from '../audit/audit.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { RegisterDto, LoginDto, ForgotPasswordDto, ResetPasswordDto, VerifyEmailDto } from './dto';
import { type Role } from '@leadforge/shared';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    name: string;
    emailVerified: boolean;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    role: Role;
  };
  tokens: AuthTokens;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly auditService: AuditService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  /**
   * Register a new user and either create an organization (as Owner)
   * or join an existing organization via an invitation token.
   */
  async register(dto: RegisterDto, ipAddress?: string, userAgent?: string): Promise<AuthResult> {
    // 1. Check if user already exists
    const normalizedEmail = dto.email.toLowerCase().trim();
    const existingUser = await this.prisma.client.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException({
        code: 'USER_EXISTS',
        message: 'An account with this email address already exists.',
      });
    }

    // 2. Hash password with argon2id
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    // 3. Generate email verification token
    const rawVerifyToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenHash = crypto.createHash('sha256').update(rawVerifyToken).digest('hex');
    const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    let invitation: any = null;
    if (dto.invitationToken) {
      const invitationTokenHash = crypto
        .createHash('sha256')
        .update(dto.invitationToken)
        .digest('hex');

      invitation = await this.prisma.client.invitation.findFirst({
        where: {
          tokenHash: invitationTokenHash,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: { organization: true },
      });

      if (!invitation) {
        throw new BadRequestException({
          code: 'INVALID_INVITATION',
          message: 'Invitation is invalid, expired, or has already been used.',
        });
      }
    }

    // 4. Execute atomic creation inside a transaction
    const result = await this.prisma.client.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          name: dto.name.trim(),
          emailVerified: false,
          emailVerifyToken: verifyTokenHash,
          emailVerifyExpiry: verifyExpiry,
          status: 'active',
          lastLoginAt: new Date(),
        },
      });

      let orgId: string;
      let orgName: string;
      let orgSlug: string;
      let userRole: Role;

      if (invitation) {
        // Accept invitation and join organization
        orgId = invitation.organizationId;
        orgName = invitation.organization.name;
        orgSlug = invitation.organization.slug;
        userRole = invitation.role as Role;

        await tx.membership.create({
          data: {
            userId: user.id,
            organizationId: orgId,
            role: userRole,
          },
        });

        await tx.invitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: new Date() },
        });
      } else {
        // Create new organization with user as Owner
        orgName = (dto.organizationName || `${dto.name}'s Workspace`).trim();
        const baseSlug =
          orgName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'workspace';
        const randomSuffix = crypto.randomBytes(3).toString('hex');
        orgSlug = `${baseSlug}-${randomSuffix}`;
        userRole = 'owner';

        const org = await tx.organization.create({
          data: {
            name: orgName,
            slug: orgSlug,
          },
        });

        orgId = org.id;

        await tx.membership.create({
          data: {
            userId: user.id,
            organizationId: org.id,
            role: 'owner',
          },
        });

        // Create default sales pipeline with standard stages
        const pipeline = await tx.pipeline.create({
          data: {
            organizationId: org.id,
            name: 'Standard Sales Pipeline',
            isDefault: true,
          },
        });

        const stages = [
          { name: 'New Lead', sortOrder: 1, stageType: 'open' as const },
          { name: 'Contacted', sortOrder: 2, stageType: 'open' as const },
          { name: 'Qualified', sortOrder: 3, stageType: 'open' as const },
          { name: 'Meeting Scheduled', sortOrder: 4, stageType: 'open' as const },
          { name: 'Proposal Sent', sortOrder: 5, stageType: 'open' as const },
          { name: 'Negotiation', sortOrder: 6, stageType: 'open' as const },
          { name: 'Closed Won', sortOrder: 7, stageType: 'won' as const },
          { name: 'Closed Lost', sortOrder: 8, stageType: 'lost' as const },
        ];

        for (const stage of stages) {
          await tx.pipelineStage.create({
            data: {
              pipelineId: pipeline.id,
              name: stage.name,
              sortOrder: stage.sortOrder,
              stageType: stage.stageType,
            },
          });
        }
      }

      // Generate tokens
      const tokens = await this.createTokensAndSession(
        user.id,
        orgId,
        userRole,
        user.email,
        ipAddress,
        userAgent,
        tx,
      );

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
        },
        organization: {
          id: orgId,
          name: orgName,
          slug: orgSlug,
          role: userRole,
        },
        tokens,
        rawVerifyToken,
      };
    });

    // 5. Send verification email (non-blocking)
    this.emailService
      .sendVerificationEmail(result.user.email, result.rawVerifyToken, result.organization.name)
      .catch((err) => this.logger.error(`Failed sending verify email: ${err.message}`));

    // 6. Log audit event
    await this.auditService.log({
      organizationId: result.organization.id,
      userId: result.user.id,
      action: 'auth:register',
      entityType: 'User',
      entityId: result.user.id,
      ipAddress,
      userAgent,
      after: {
        email: result.user.email,
        organizationId: result.organization.id,
        role: result.organization.role,
      },
    });

    return {
      user: result.user,
      organization: result.organization,
      tokens: result.tokens,
    };
  }

  /**
   * Authenticate user with password and issue short-lived access JWT + rotating refresh token.
   * Enforces account lockout after 5 failed attempts in 15 minutes.
   */
  async login(dto: LoginDto, ipAddress?: string, userAgent?: string): Promise<AuthResult> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    // 1. Check account lockout policy (5 attempts / 15 mins)
    const emailLimit = await this.rateLimitService.checkRateLimit(
      'auth_login_email',
      normalizedEmail,
    );
    if (!emailLimit.allowed) {
      this.logger.warn(`Account locked out for email ${normalizedEmail}`);
      throw new HttpException(
        {
          code: 'ACCOUNT_LOCKED',
          message: 'Too many failed login attempts. Account temporarily locked for 15 minutes.',
          retryAfterSeconds: emailLimit.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 2. Fetch user
    const user = await this.prisma.client.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        memberships: {
          include: { organization: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }

    // 3. Verify password
    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }

    // 4. Ensure user belongs to at least one active organization
    const primaryMembership = user.memberships[0];
    if (!primaryMembership) {
      throw new UnauthorizedException({
        code: 'NO_ORGANIZATION',
        message: 'User does not belong to any organization.',
      });
    }

    // 5. Update last login timestamp
    await this.prisma.client.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // 6. Generate access token and new session family
    const tokens = await this.createTokensAndSession(
      user.id,
      primaryMembership.organizationId,
      primaryMembership.role as Role,
      user.email,
      ipAddress,
      userAgent,
    );

    // 7. Audit log
    await this.auditService.log({
      organizationId: primaryMembership.organizationId,
      userId: user.id,
      action: 'auth:login',
      entityType: 'User',
      entityId: user.id,
      ipAddress,
      userAgent,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
      },
      organization: {
        id: primaryMembership.organizationId,
        name: primaryMembership.organization.name,
        slug: primaryMembership.organization.slug,
        role: primaryMembership.role as Role,
      },
      tokens,
    };
  }

  /**
   * Rotate refresh token with reuse detection.
   * If a revoked token is presented, the entire session family is revoked.
   */
  async refreshTokens(
    rawRefreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthTokens> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_REQUIRED',
        message: 'Refresh token must be provided.',
      });
    }

    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    const session = await this.prisma.client.session.findFirst({
      where: { refreshTokenHash: tokenHash },
    });

    if (!session) {
      throw new UnauthorizedException({
        code: 'INVALID_SESSION',
        message: 'Invalid or unrecognized refresh session.',
      });
    }

    // REUSE DETECTION: If token was already revoked, someone is replaying it!
    if (session.revokedAt !== null) {
      this.logger.error(
        `🚨 SECURITY ALERT: Refresh token reuse detected for user ${session.userId}, family ${session.family}`,
      );

      // Revoke all sessions in this token family immediately
      await this.prisma.client.session.updateMany({
        where: { family: session.family },
        data: { revokedAt: new Date() },
      });

      throw new UnauthorizedException({
        code: 'TOKEN_REUSE_DETECTED',
        message: 'Security alert: Refresh token reuse detected. All sessions have been revoked.',
      });
    }

    // Check expiry
    if (session.expiresAt < new Date()) {
      await this.prisma.client.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });

      throw new UnauthorizedException({
        code: 'SESSION_EXPIRED',
        message: 'Session has expired. Please sign in again.',
      });
    }

    // Fetch user and active membership
    const user = await this.prisma.client.user.findUnique({
      where: { id: session.userId },
      include: {
        memberships: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException({
        code: 'USER_INACTIVE',
        message: 'Account is suspended or deactivated.',
      });
    }

    const membership = user.memberships[0];
    if (!membership) {
      throw new UnauthorizedException({
        code: 'NO_MEMBERSHIP',
        message: 'User has no organization memberships.',
      });
    }

    // ROTATION: Revoke current session, create next in family
    const nextRawRefreshToken = crypto.randomBytes(32).toString('hex');
    const nextTokenHash = crypto.createHash('sha256').update(nextRawRefreshToken).digest('hex');
    const nextExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.prisma.client.$transaction([
      this.prisma.client.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.client.session.create({
        data: {
          userId: user.id,
          refreshTokenHash: nextTokenHash,
          family: session.family, // Keep same family for chain tracking
          ipAddress: ipAddress || session.ipAddress,
          userAgent: userAgent || session.userAgent,
          expiresAt: nextExpiresAt,
        },
      }),
    ]);

    const secret = process.env.JWT_SECRET || 'fallback_secret_for_tests_only';
    const accessToken = jwt.sign(
      {
        sub: user.id,
        orgId: membership.organizationId,
        role: membership.role,
        email: user.email,
      },
      secret,
      { expiresIn: '15m' },
    );

    return {
      accessToken,
      refreshToken: nextRawRefreshToken,
    };
  }

  /**
   * Terminate active session.
   */
  async logout(rawRefreshToken?: string, userId?: string): Promise<void> {
    if (rawRefreshToken) {
      const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

      await this.prisma.client.session.updateMany({
        where: { refreshTokenHash: tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else if (userId) {
      await this.prisma.client.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  /**
   * Request password reset link. Returns generic success to prevent account enumeration.
   */
  async forgotPassword(dto: ForgotPasswordDto, ipAddress?: string): Promise<{ message: string }> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    // Check rate limit for forgot password
    const limitResult = await this.rateLimitService.checkRateLimit(
      'auth_forgot_password',
      `${normalizedEmail}:${ipAddress || 'unknown'}`,
    );

    if (!limitResult.allowed) {
      throw new HttpException(
        {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many password reset requests. Please try again in an hour.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.client.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user && user.status === 'active') {
      const rawResetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = crypto.createHash('sha256').update(rawResetToken).digest('hex');
      const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await this.prisma.client.user.update({
        where: { id: user.id },
        data: {
          emailVerifyToken: resetTokenHash,
          emailVerifyExpiry: resetExpiry,
        },
      });

      this.emailService
        .sendPasswordResetEmail(user.email, rawResetToken)
        .catch((err) => this.logger.error(`Failed sending password reset email: ${err.message}`));
    }

    // Always return same response to prevent enumeration
    return {
      message: 'If an account exists with that email address, a password reset link has been sent.',
    };
  }

  /**
   * Reset password with valid token and revoke all existing sessions.
   */
  async resetPassword(
    dto: ResetPasswordDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    const tokenHash = crypto.createHash('sha256').update(dto.token).digest('hex');

    const user = await this.prisma.client.user.findFirst({
      where: {
        emailVerifyToken: tokenHash,
        emailVerifyExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException({
        code: 'INVALID_RESET_TOKEN',
        message: 'Password reset link is invalid or has expired.',
      });
    }

    const passwordHash = await argon2.hash(dto.newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    // Update password, clear token, and revoke ALL user sessions
    await this.prisma.client.$transaction([
      this.prisma.client.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          emailVerifyToken: null,
          emailVerifyExpiry: null,
        },
      }),
      this.prisma.client.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.auditService.log({
      userId: user.id,
      action: 'auth:reset_password',
      entityType: 'User',
      entityId: user.id,
      ipAddress,
      userAgent,
    });

    return {
      message: 'Password has been reset successfully. Please sign in with your new password.',
    };
  }

  /**
   * Verify email address with verification token.
   */
  async verifyEmail(dto: VerifyEmailDto): Promise<{ message: string }> {
    const tokenHash = crypto.createHash('sha256').update(dto.token).digest('hex');

    const user = await this.prisma.client.user.findFirst({
      where: {
        emailVerifyToken: tokenHash,
        emailVerifyExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException({
        code: 'INVALID_VERIFY_TOKEN',
        message: 'Verification link is invalid or has expired.',
      });
    }

    await this.prisma.client.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpiry: null,
      },
    });

    return {
      message: 'Email verified successfully.',
    };
  }

  /**
   * Get current authenticated user profile with memberships.
   */
  async getCurrentUser(userId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        emailVerified: true,
        status: true,
        createdAt: true,
        memberships: {
          select: {
            role: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                timezone: true,
                currency: true,
                aiEnabled: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User not found.',
      });
    }

    return user;
  }

  /**
   * Helper to sign JWT and create Session record.
   */
  private async createTokensAndSession(
    userId: string,
    orgId: string,
    role: Role,
    email: string,
    ipAddress?: string,
    userAgent?: string,
    tx?: any,
  ): Promise<AuthTokens> {
    const client = tx || this.prisma.client;
    const secret = process.env.JWT_SECRET || 'fallback_secret_for_tests_only';

    const accessToken = jwt.sign(
      {
        sub: userId,
        orgId,
        role,
        email,
      },
      secret,
      { expiresIn: '15m' },
    );

    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const family = crypto.randomUUID();

    await client.session.create({
      data: {
        userId,
        refreshTokenHash,
        family,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }
}
