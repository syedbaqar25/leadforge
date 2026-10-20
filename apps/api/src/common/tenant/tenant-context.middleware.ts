import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { tenantStorage, type TenantContext } from './tenant.context';

/**
 * Middleware that initializes the AsyncLocalStorage context for every request.
 * For authenticated requests, the TenantGuard will populate userId/orgId/role.
 * This middleware sets up the base context with requestId and client info.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();

    // Set request ID on the request object for downstream use
    req.headers['x-request-id'] = requestId;

    // Determine real client IP (behind proxy)
    const ipAddress =
      (req.headers['cf-connecting-ip'] as string) ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';

    const userAgent = (req.headers['user-agent'] as string) || 'unknown';

    // Initialize with empty auth context — guards will populate these
    const ctx: TenantContext = {
      userId: '',
      organizationId: '',
      role: '',
      requestId,
      ipAddress,
      userAgent,
    };

    tenantStorage.run(ctx, () => {
      next();
    });
  }
}
