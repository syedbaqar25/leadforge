import { AsyncLocalStorage } from 'async_hooks';

/**
 * Tenant context carried through the request lifecycle via AsyncLocalStorage.
 * Populated from the verified session/JWT — never from client input.
 */
export interface TenantContext {
  /** The authenticated user's ID */
  userId: string;
  /** The active organization ID */
  organizationId: string;
  /** The user's role in this organization */
  role: string;
  /** The request ID for tracing */
  requestId: string;
  /** Client IP address */
  ipAddress: string;
  /** User agent string */
  userAgent: string;
}

/**
 * AsyncLocalStorage instance for tenant context.
 * Accessible anywhere in the request lifecycle without prop drilling.
 */
export const tenantStorage = new AsyncLocalStorage<TenantContext>();

/**
 * Get the current tenant context. Throws if called outside a request.
 */
export function getTenantContext(): TenantContext {
  const ctx = tenantStorage.getStore();
  if (!ctx) {
    throw new Error(
      'TenantContext not available — this code is running outside an authenticated request lifecycle',
    );
  }
  return ctx;
}

/**
 * Get the current organization ID. Throws if not in a request context.
 */
export function getCurrentOrgId(): string {
  return getTenantContext().organizationId;
}

/**
 * Get the current user ID. Throws if not in a request context.
 */
export function getCurrentUserId(): string {
  return getTenantContext().userId;
}

/**
 * Get the current user's role. Throws if not in a request context.
 */
export function getCurrentRole(): string {
  return getTenantContext().role;
}
