import { RateLimitService } from '../src/modules/rate-limit/rate-limit.service';

describe('RateLimitService Sliding Window Matrix (PART 8)', () => {
  let service: RateLimitService;

  beforeEach(async () => {
    service = new RateLimitService();
    await service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('allows requests within policy limit', async () => {
    const res = await service.checkRateLimit('global', 'test-ip-1');
    expect(res.allowed).toBe(true);
    expect(res.limit).toBe(100);
    expect(res.remaining).toBe(99);
  });

  it('enforces login rate limit of 5 attempts and blocks subsequent requests', async () => {
    const key = 'test-login-user@example.com';
    // Consume 5 attempts allowed by auth_login_email
    for (let i = 0; i < 5; i++) {
      const res = await service.checkRateLimit('auth_login_email', key);
      expect(res.allowed).toBe(true);
    }

    // 6th attempt must be rejected
    const blockedRes = await service.checkRateLimit('auth_login_email', key);
    expect(blockedRes.allowed).toBe(false);
    expect(blockedRes.remaining).toBe(0);
    expect(blockedRes.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('isolates rate limits between different users or IPs', async () => {
    const userA = 'user-a';
    const userB = 'user-b';

    // Exhaust userA
    for (let i = 0; i < 5; i++) {
      await service.checkRateLimit('auth_login_email', userA);
    }
    const userARes = await service.checkRateLimit('auth_login_email', userA);
    expect(userARes.allowed).toBe(false);

    // userB must still be allowed
    const userBRes = await service.checkRateLimit('auth_login_email', userB);
    expect(userBRes.allowed).toBe(true);
  });
});
