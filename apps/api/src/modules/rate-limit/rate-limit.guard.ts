import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  SetMetadata,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { RateLimitService } from './rate-limit.service';

export const RATE_LIMIT_POLICY_KEY = 'rate_limit_policy';
/**
 * Decorator to apply a specific named rate limit policy to a controller or endpoint
 */
export const UseRateLimit = (policyName: string) => SetMetadata(RATE_LIMIT_POLICY_KEY, policyName);

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest<Request>();
    const res = httpCtx.getResponse<Response>();

    const policyName =
      this.reflector.getAllAndOverride<string>(RATE_LIMIT_POLICY_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || 'global';

    // Derive client IP safely
    const ip = this.resolveClientIp(req);

    // Derive identifier: user ID if authenticated, else IP
    const userId = (req as any).user?.id;
    const identifier = userId ? `user:${userId}` : `ip:${ip}`;

    const result = await this.rateLimitService.checkRateLimit(policyName, identifier);

    // Attach standard rate limit headers
    if (res && typeof res.setHeader === 'function') {
      res.setHeader('RateLimit-Limit', result.limit.toString());
      res.setHeader('RateLimit-Remaining', result.remaining.toString());
      res.setHeader('RateLimit-Reset', result.resetSeconds.toString());
      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfterSeconds.toString());
      }
    }

    if (!result.allowed) {
      this.logger.warn(`Rate limit exceeded: policy=${policyName}, id=${identifier}, ip=${ip}`);

      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please slow down and try again later.',
          retryAfter: result.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private resolveClientIp(req: Request): string {
    const trustProxy = process.env.TRUST_PROXY === 'true';

    if (trustProxy) {
      const cfIp = req.headers['cf-connecting-ip'] as string;
      if (cfIp) return cfIp.trim();

      const xForwarded = req.headers['x-forwarded-for'] as string;
      if (xForwarded) {
        const firstIp = xForwarded.split(',')[0];
        if (firstIp) return firstIp.trim();
      }
    }

    return req.socket.remoteAddress || req.ip || '127.0.0.1';
  }
}
