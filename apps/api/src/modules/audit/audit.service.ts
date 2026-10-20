import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantContext } from '../../common/tenant/tenant.context';
import { generateCsv } from '../../common/security/csv-export';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { Prisma } from '@prisma/client';

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

  /**
   * List paginated audit logs scoped strictly to the caller's organization.
   */
  async getAuditLogs(orgId: string, query: AuditLogQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize =
      query.pageSize && query.pageSize > 0 && query.pageSize <= 100 ? query.pageSize : 25;
    const skip = (page - 1) * pageSize;

    const where: Prisma.AuditLogWhereInput = {
      organizationId: orgId,
    };

    if (query.action) {
      where.action = { contains: query.action.trim(), mode: 'insensitive' };
    }

    if (query.entityType) {
      where.entityType = query.entityType.trim();
    }

    if (query.userId) {
      where.userId = query.userId.trim();
    }

    const [logs, total] = await Promise.all([
      this.prisma.client.auditLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        hasMore: page * pageSize < total,
      },
    };
  }

  /**
   * Export audit logs to CSV with formula injection defense.
   * Neutralizes formula triggers (=, +, -, @) and wraps fields safely.
   */
  async exportAuditLogsCsv(orgId: string, action?: string, entityType?: string): Promise<string> {
    const where: Prisma.AuditLogWhereInput = {
      organizationId: orgId,
    };

    if (action) {
      where.action = action.trim();
    }
    if (entityType) {
      where.entityType = entityType.trim();
    }

    const logs = await this.prisma.client.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5000, // Maximum export cap
    });

    const headers = [
      'Log ID',
      'Action',
      'Entity Type',
      'Entity ID',
      'User ID',
      'IP Address',
      'Timestamp (UTC)',
    ];

    const rows = logs.map((log) => [
      log.id,
      log.action,
      log.entityType,
      log.entityId || '',
      log.userId || '',
      log.ipAddress || '',
      log.createdAt.toISOString(),
    ]);

    return generateCsv(headers, rows);
  }
}
