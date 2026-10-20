import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantContext } from '../../common/tenant/tenant.context';

export interface AuditLogParams {
  organizationId?: string | undefined;
  userId?: string | null | undefined;
  action: string;
  entityType: string;
  entityId?: string | null | undefined;
  before?: Record<string, unknown> | null | undefined;
  after?: Record<string, unknown> | null | undefined;
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
  requestId?: string | null | undefined;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record an immutable audit log entry.
   * Derives missing context (org, user, ip, userAgent, requestId) from AsyncLocalStorage if not provided.
   */
  async log(params: AuditLogParams): Promise<void> {
    try {
      let tenantCtx: any = null;
      try {
        tenantCtx = getTenantContext();
      } catch {
        // May be called outside request context (e.g. system background worker)
      }

      const organizationId = params.organizationId || tenantCtx?.organizationId;
      if (!organizationId) {
        this.logger.warn(`Skipping audit log for ${params.action}: missing organizationId`);
        return;
      }

      const userId = params.userId !== undefined ? params.userId : tenantCtx?.userId || null;
      const ipAddress = params.ipAddress || tenantCtx?.ipAddress || null;
      const userAgent = params.userAgent || tenantCtx?.userAgent || null;
      const requestId = params.requestId || tenantCtx?.requestId || null;

      // Note: Cast to Prisma Json to avoid typing issues with nested structures
      await this.prisma.client.auditLog.create({
        data: {
          organizationId,
          userId,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId || null,
          before: (params.before as any) ?? undefined,
          after: (params.after as any) ?? undefined,
          ipAddress,
          userAgent,
          requestId,
        },
      });
    } catch (err: any) {
      // Audit log failures should never crash primary transactions, but must be logged
      this.logger.error(`Failed to write audit log [${params.action}]: ${err.message}`, err.stack);
    }
  }
}
