import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { IS_PUBLIC_KEY } from '../decorators/tenant.decorator';
import { tenantStorage, type TenantContext } from '../tenant/tenant.context';

export interface JwtPayload {
  sub: string; // userId
  orgId: string; // active organizationId
  role: string; // role in active org
  email?: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const req = context.switchToHttp().getRequest<Request>();

    // 1. Extract token from Authorization header or HttpOnly cookie
    const token = this.extractToken(req);

    if (isPublic) {
      if (token) {
        // Opportunistically verify token on public route to set context if available
        try {
          const secret = process.env.JWT_SECRET || 'fallback_secret_for_tests_only';
          const payload = jwt.verify(token, secret) as JwtPayload;
          this.attachContext(req, payload);
        } catch {
          // Ignore invalid token on public routes
        }
      }
      return true;
    }

    if (!token) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please sign in.',
      });
    }

    try {
      const secret = process.env.JWT_SECRET || 'fallback_secret_for_tests_only';
      const payload = jwt.verify(token, secret) as JwtPayload;

      if (!payload.sub || !payload.orgId || !payload.role) {
        throw new UnauthorizedException({
          code: 'INVALID_TOKEN',
          message: 'Malformed authentication token.',
        });
      }

      this.attachContext(req, payload);
      return true;
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedException({
          code: 'TOKEN_EXPIRED',
          message: 'Session expired. Please refresh your token.',
        });
      }
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid authentication credentials.',
      });
    }
  }

  private extractToken(req: Request): string | null {
    // Check Authorization: Bearer <token>
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check HttpOnly cookie
    if (req.cookies && req.cookies.access_token) {
      return req.cookies.access_token;
    }

    return null;
  }

  private attachContext(req: Request, payload: JwtPayload): void {
    // Attach to Express Request
    (req as any).user = {
      id: payload.sub,
      organizationId: payload.orgId,
      role: payload.role,
      email: payload.email,
    };
    (req as any).organizationId = payload.orgId;

    // Update AsyncLocalStorage store
    const currentStore = tenantStorage.getStore();
    if (currentStore) {
      currentStore.userId = payload.sub;
      currentStore.organizationId = payload.orgId;
      currentStore.role = payload.role;
    }
  }
}
