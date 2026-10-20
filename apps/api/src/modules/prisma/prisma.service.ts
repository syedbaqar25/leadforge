import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { getTenantContext } from '../../common/tenant/tenant.context';

// Tenant-scoped models that carry organizationId
export const TENANT_SCOPED_MODELS = new Set([
  'Lead',
  'Deal',
  'CustomFieldDefinition',
  'Tag',
  'DuplicateCandidate',
  'Pipeline',
  'Activity',
  'Task',
  'Note',
  'ScoringRuleSet',
  'AiAnalysis',
  'AiSuggestion',
  'KnowledgeDocument',
  'KnowledgeChunk',
  'CommunicationAccount',
  'EmailThread',
  'Message',
  'MessageTemplate',
  'ConsentRecord',
  'SuppressionEntry',
  'WorkflowDefinition',
  'WorkflowExecution',
  'OutboxEvent',
  'ApprovalRequest',
  'Notification',
  'NotificationPreference',
  'AuditLog',
  'ImportJob',
  'UsageCounter',
  'Subscription',
  'BillingEvent',
  'ApiKey',
  'Membership',
]);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private _tenantClient: any;

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? [
              { emit: 'event', level: 'query' },
              { emit: 'stdout', level: 'error' },
              { emit: 'stdout', level: 'warn' },
            ]
          : [{ emit: 'stdout', level: 'error' }],
    });

    if (process.env.NODE_ENV === 'development') {
      // @ts-expect-error - Prisma query event typing
      this.$on('query', (e: { query: string; duration: number }) => {
        // Redact any query containing sensitive keywords
        if (
          !e.query.includes('password') &&
          !e.query.includes('token') &&
          !e.query.includes('secret')
        ) {
          this.logger.debug(`Query [${e.duration}ms]: ${e.query}`);
        }
      });
    }
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Prisma connected to PostgreSQL');
    } catch (err: any) {
      this.logger.warn(`PostgreSQL connection deferred: ${err.message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma disconnected from PostgreSQL');
  }

  /**
   * Root Prisma client accessor
   */
  get client(): this {
    return this;
  }

  /**
   * Returns a tenant-scoped Prisma client extension.
   * Central enforcement of organizationId on all tenant models.
   * If organizationId is present in AsyncLocalStorage, it automatically:
   * 1. Injects `organizationId` into `where` clause for reads, updates, deletes.
   * 2. Injects `organizationId` into `data` for creates.
   */
  get tenant() {
    if (!this._tenantClient) {
      this._tenantClient = this.$extends({
        query: {
          $allModels: {
            async findFirst({ model, args, query }: any) {
              if (TENANT_SCOPED_MODELS.has(model)) {
                const orgId = getActiveOrgId();
                if (orgId) {
                  args.where = { ...args.where, organizationId: orgId };
                }
              }
              return query(args);
            },
            async findMany({ model, args, query }: any) {
              if (TENANT_SCOPED_MODELS.has(model)) {
                const orgId = getActiveOrgId();
                if (orgId) {
                  args.where = { ...args.where, organizationId: orgId };
                }
              }
              return query(args);
            },
            async count({ model, args, query }: any) {
              if (TENANT_SCOPED_MODELS.has(model)) {
                const orgId = getActiveOrgId();
                if (orgId) {
                  args.where = { ...args.where, organizationId: orgId };
                }
              }
              return query(args);
            },
            async create({ model, args, query }: any) {
              if (TENANT_SCOPED_MODELS.has(model)) {
                const orgId = getActiveOrgId();
                if (orgId && args.data) {
                  args.data = { ...args.data, organizationId: orgId };
                }
              }
              return query(args);
            },
            async update({ model, args, query }: any) {
              if (TENANT_SCOPED_MODELS.has(model)) {
                const orgId = getActiveOrgId();
                if (orgId) {
                  args.where = { ...args.where, organizationId: orgId };
                }
              }
              return query(args);
            },
            async updateMany({ model, args, query }: any) {
              if (TENANT_SCOPED_MODELS.has(model)) {
                const orgId = getActiveOrgId();
                if (orgId) {
                  args.where = { ...args.where, organizationId: orgId };
                }
              }
              return query(args);
            },
            async delete({ model, args, query }: any) {
              if (TENANT_SCOPED_MODELS.has(model)) {
                const orgId = getActiveOrgId();
                if (orgId) {
                  args.where = { ...args.where, organizationId: orgId };
                }
              }
              return query(args);
            },
            async deleteMany({ model, args, query }: any) {
              if (TENANT_SCOPED_MODELS.has(model)) {
                const orgId = getActiveOrgId();
                if (orgId) {
                  args.where = { ...args.where, organizationId: orgId };
                }
              }
              return query(args);
            },
          },
        },
      });
    }
    return this._tenantClient;
  }
}

function getActiveOrgId(): string | null {
  try {
    const ctx = getTenantContext();
    return ctx.organizationId || null;
  } catch {
    return null;
  }
}
