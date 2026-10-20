import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { RATE_LIMIT_POLICIES, DEFAULT_POLICY, type RateLimitPolicy } from './rate-limit.config';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  retryAfterSeconds: number;
}

@Injectable()
export class RateLimitService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RateLimitService.name);
  private redisClient: Redis | null = null;
  private isRedisConnected = false;
  // Local sliding window fallback cache for Redis outage or local dev without Redis
  private memoryStore = new Map<string, number[]>();

  async onModuleInit(): Promise<void> {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    try {
      this.redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.warn(
              'Redis connection retry limit reached. Falling back to in-memory rate limiter.',
            );
            return null; // Stop retrying
          }
          return Math.min(times * 100, 2000);
        },
        lazyConnect: true,
      });

      this.redisClient.on('connect', () => {
        this.isRedisConnected = true;
        this.logger.log('RateLimitService connected to Redis');
      });

      this.redisClient.on('error', (err) => {
        this.isRedisConnected = false;
        this.logger.warn(`Redis connection error in RateLimitService: ${err.message}`);
      });

      await this.redisClient.connect();
    } catch (err: any) {
      this.isRedisConnected = false;
      this.logger.warn(
        `RateLimitService could not connect to Redis: ${err.message}. Using in-memory fallback.`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }

  /**
   * Check sliding-window rate limit for a key against a named policy
   */
  async checkRateLimit(policyName: string, keyIdentifier: string): Promise<RateLimitResult> {
    const policy: RateLimitPolicy = RATE_LIMIT_POLICIES[policyName] ?? DEFAULT_POLICY;
    const redisKey = `ratelimit:${policy.name}:${keyIdentifier}`;
    const now = Date.now();
    const windowStart = now - policy.ttlSeconds * 1000;

    if (this.isRedisConnected && this.redisClient) {
      try {
        const multi = this.redisClient.multi();
        // Remove timestamps older than window
        multi.zremrangebyscore(redisKey, 0, windowStart);
        // Add current timestamp
        multi.zadd(redisKey, now, `${now}-${Math.random()}`);
        // Count entries in window
        multi.zcard(redisKey);
        // Refresh TTL
        multi.expire(redisKey, policy.ttlSeconds);

        const results = await multi.exec();
        if (!results || !results[2]) {
          throw new Error('Redis multi failed');
        }

        const count = (results[2][1] as number) || 0;
        const allowed = count <= policy.limit;
        const remaining = Math.max(0, policy.limit - count);
        const retryAfterSeconds = allowed ? 0 : policy.ttlSeconds;

        return {
          allowed,
          limit: policy.limit,
          remaining,
          resetSeconds: policy.ttlSeconds,
          retryAfterSeconds,
        };
      } catch (err: any) {
        this.logger.error(`Redis rate limit error: ${err.message}`);
        if (policy.failClosedOnRedisError) {
          // If policy requires fail closed on critical surface, use strict in-memory limit
          return this.checkMemoryRateLimit(policy, keyIdentifier, now, windowStart);
        }
        // Fail open for non-critical reads with a warning
        return {
          allowed: true,
          limit: policy.limit,
          remaining: policy.limit,
          resetSeconds: policy.ttlSeconds,
          retryAfterSeconds: 0,
        };
      }
    }

    // In-memory sliding window fallback
    return this.checkMemoryRateLimit(policy, keyIdentifier, now, windowStart);
  }

  private checkMemoryRateLimit(
    policy: RateLimitPolicy,
    keyIdentifier: string,
    now: number,
    windowStart: number,
  ): RateLimitResult {
    const memKey = `${policy.name}:${keyIdentifier}`;
    const timestamps = this.memoryStore.get(memKey) || [];

    // Filter out timestamps outside window
    const activeTimestamps = timestamps.filter((t) => t > windowStart);
    activeTimestamps.push(now);
    this.memoryStore.set(memKey, activeTimestamps);

    // Periodic cleanup of stale keys
    if (this.memoryStore.size > 10000) {
      for (const [k, ts] of this.memoryStore.entries()) {
        const valid = ts.filter((t) => t > now - 3600 * 1000);
        if (valid.length === 0) {
          this.memoryStore.delete(k);
        } else {
          this.memoryStore.set(k, valid);
        }
      }
    }

    const count = activeTimestamps.length;
    const allowed = count <= policy.limit;
    const remaining = Math.max(0, policy.limit - count);
    const retryAfterSeconds = allowed ? 0 : policy.ttlSeconds;

    return {
      allowed,
      limit: policy.limit,
      remaining,
      resetSeconds: policy.ttlSeconds,
      retryAfterSeconds,
    };
  }
}
