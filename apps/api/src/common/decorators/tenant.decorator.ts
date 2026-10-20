import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { type TenantContext, getTenantContext } from '../tenant/tenant.context';
import { type Permission } from '@leadforge/shared';

export const IS_PUBLIC_KEY = 'isPublic';
/**
 * Decorator to bypass standard authentication on public routes
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const PERMISSIONS_KEY = 'permissions';
/**
 * Decorator to enforce required RBAC permissions on endpoints
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Parameter decorator to inject the current authenticated user ID
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    if (request.user?.id) {
      return request.user.id;
    }
    const tenant = tenantStorageContext();
    return tenant.userId;
  },
);

/**
 * Parameter decorator to inject the current active organization ID
 */
export const CurrentOrgId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    if (request.organizationId) {
      return request.organizationId;
    }
    const tenant = tenantStorageContext();
    return tenant.organizationId;
  },
);

/**
 * Parameter decorator to inject the full verified TenantContext
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest();
    if (request.tenantContext) {
      return request.tenantContext as TenantContext;
    }
    return tenantStorageContext();
  },
);

function tenantStorageContext(): TenantContext {
  try {
    return getTenantContext();
  } catch {
    return {
      userId: '',
      organizationId: '',
      role: '',
      requestId: 'system',
      ipAddress: '127.0.0.1',
      userAgent: 'internal',
    };
  }
}
