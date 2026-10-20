import * as argon2 from 'argon2';
import * as jwt from 'jsonwebtoken';
import { AuthService } from '../src/modules/auth/auth.service';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';

describe('AuthService — Multi-Tenant Authentication & Session Security (PART 1.4 & PART 2)', () => {
  let authService: AuthService;
  let mockPrisma: any;
  let mockEmailService: any;
  let mockAuditService: any;
  let mockRateLimitService: any;

  const mockUser = {
    id: 'user-uuid-1',
    email: 'sarah.connor@example.com',
    name: 'Sarah Connor',
    passwordHash: '',
    emailVerified: false,
    status: 'active',
    memberships: [
      {
        id: 'mem-1',
        organizationId: 'org-uuid-1',
        role: 'owner',
        organization: {
          id: 'org-uuid-1',
          name: 'Apex Cybernetics',
          slug: 'apex-cybernetics',
        },
      },
    ],
  };

  beforeAll(async () => {
    // Generate valid argon2id hash for tests
    mockUser.passwordHash = await argon2.hash('SecurePassword123!', {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  });

  beforeEach(() => {
    process.env.JWT_SECRET = 'super_secure_random_string_that_is_at_least_32_characters_long_123'; // fake test key

    mockPrisma = {
      client: {
        user: {
          findUnique: jest.fn(),
          findFirst: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        organization: {
          create: jest.fn(),
        },
        membership: {
          create: jest.fn(),
        },
        pipeline: {
          create: jest.fn(),
        },
        pipelineStage: {
          create: jest.fn(),
        },
        session: {
          create: jest.fn().mockResolvedValue({ id: 'sess-1' }),
          findFirst: jest.fn(),
          update: jest.fn(),
          updateMany: jest.fn(),
        },
        invitation: {
          findFirst: jest.fn(),
          update: jest.fn(),
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
      sendVerificationEmail: jest.fn().mockResolvedValue(true),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
    };

    mockAuditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    mockRateLimitService = {
      checkRateLimit: jest.fn().mockResolvedValue({
        allowed: true,
        limit: 5,
        remaining: 4,
        resetSeconds: 900,
        retryAfterSeconds: 0,
      }),
    };

    authService = new AuthService(
      mockPrisma,
      mockEmailService,
      mockAuditService,
      mockRateLimitService,
    );
  });

  describe('Password Hashing with Argon2id', () => {
    it('generates secure argon2id hashes that verify correctly', async () => {
      expect(mockUser.passwordHash.startsWith('$argon2id$')).toBe(true);
      const isValid = await argon2.verify(mockUser.passwordHash, 'SecurePassword123!');
      expect(isValid).toBe(true);
      const isInvalid = await argon2.verify(mockUser.passwordHash, 'WrongPassword!');
      expect(isInvalid).toBe(false);
    });
  });

  describe('User Registration', () => {
    it('creates user and organization as Owner when no invitation is provided', async () => {
      mockPrisma.client.user.findUnique.mockResolvedValue(null);
      mockPrisma.client.user.create.mockResolvedValue({
        id: 'new-user-1',
        email: 'john@example.com',
        name: 'John Doe',
        emailVerified: false,
      });
      mockPrisma.client.organization.create.mockResolvedValue({
        id: 'new-org-1',
        name: 'John Workspace',
        slug: 'john-workspace-abc123',
      });
      mockPrisma.client.pipeline.create.mockResolvedValue({ id: 'pipe-1' });

      const result = await authService.register({
        email: 'john@example.com',
        password: 'Password12345!',
        name: 'John Doe',
        organizationName: 'John Workspace',
      });

      expect(result.user.email).toBe('john@example.com');
      expect(result.organization.role).toBe('owner');
      expect(result.tokens.accessToken).toBeDefined();
      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth:register' }),
      );
    });

    it('rejects registration if email already exists', async () => {
      mockPrisma.client.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        authService.register({
          email: mockUser.email,
          password: 'Password12345!',
          name: 'Sarah Connor',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Login & Account Lockout Policy (PART 1.4 & PART 8)', () => {
    it('authenticates user and returns tokens with session', async () => {
      mockPrisma.client.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.client.user.update.mockResolvedValue(mockUser);

      const result = await authService.login({
        email: mockUser.email,
        password: 'SecurePassword123!',
      });

      expect(result.user.id).toBe(mockUser.id);
      expect(result.organization.id).toBe('org-uuid-1');
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();

      const decoded: any = jwt.verify(result.tokens.accessToken, process.env.JWT_SECRET!);
      expect(decoded.sub).toBe(mockUser.id);
      expect(decoded.orgId).toBe('org-uuid-1');
      expect(decoded.role).toBe('owner');
    });

    it('locks account and throws 429 when failed login attempts exceed 5 in 15 minutes', async () => {
      mockRateLimitService.checkRateLimit.mockResolvedValue({
        allowed: false,
        limit: 5,
        remaining: 0,
        resetSeconds: 900,
        retryAfterSeconds: 900,
      });

      await expect(
        authService.login({
          email: mockUser.email,
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(HttpException);
    });

    it('throws generic UnauthorizedException on invalid password to prevent enumeration', async () => {
      mockPrisma.client.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        authService.login({
          email: mockUser.email,
          password: 'IncorrectPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Refresh Token Rotation & Reuse Detection (PART 1.4)', () => {
    it('successfully rotates refresh token and extends session', async () => {
      const activeSession = {
        id: 'sess-active-1',
        userId: mockUser.id,
        family: 'family-uuid-1',
        refreshTokenHash: 'some_hash',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
      };

      mockPrisma.client.session.findFirst.mockResolvedValue(activeSession);
      mockPrisma.client.user.findUnique.mockResolvedValue(mockUser);

      const result = await authService.refreshTokens('valid_raw_refresh_token');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(mockPrisma.client.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: activeSession.id },
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
    });

    it('detects token reuse and revokes entire session family', async () => {
      const revokedSession = {
        id: 'sess-old-revoked',
        userId: mockUser.id,
        family: 'family-uuid-1',
        refreshTokenHash: 'replayed_hash',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: new Date(Date.now() - 3600000), // Already revoked!
      };

      mockPrisma.client.session.findFirst.mockResolvedValue(revokedSession);

      let caughtError: any = null;
      try {
        await authService.refreshTokens('already_used_refresh_token');
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(UnauthorizedException);
      expect(caughtError.getResponse().code).toBe('TOKEN_REUSE_DETECTED');

      // Verify that all sessions in that family were revoked
      expect(mockPrisma.client.session.updateMany).toHaveBeenCalledWith({
        where: { family: 'family-uuid-1' },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('Password Reset Flow', () => {
    it('returns generic message for non-existent email to prevent enumeration', async () => {
      mockPrisma.client.user.findUnique.mockResolvedValue(null);

      const response = await authService.forgotPassword({
        email: 'unknown@example.com',
      });

      expect(response.message).toContain('If an account exists');
      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('resets password and revokes all active sessions on valid token', async () => {
      mockPrisma.client.user.findFirst.mockResolvedValue(mockUser);

      const response = await authService.resetPassword({
        token: 'valid_reset_token',
        newPassword: 'BrandNewPassword123!',
      });

      expect(response.message).toContain('Password has been reset');
      expect(mockPrisma.client.session.updateMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
