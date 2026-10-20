import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RateLimitModule } from './modules/rate-limit/rate-limit.module';
import { RateLimitGuard } from './modules/rate-limit/rate-limit.guard';
import { HealthModule } from './modules/health/health.module';
import { EmailModule } from './modules/email/email.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { TenantContextMiddleware } from './common/tenant/tenant-context.middleware';
import { TenantGuard } from './common/guards/tenant.guard';
import { RbacGuard } from './common/guards/rbac.guard';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    RateLimitModule,
    HealthModule,
    EmailModule,
    AuditModule,
    AuthModule,
    OrganizationsModule,
  ],
  providers: [
    // 1. Global Rate Limit Guard
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    // 2. Global Tenant / Authentication Guard
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
    // 3. Global RBAC Authorization Guard
    {
      provide: APP_GUARD,
      useClass: RbacGuard,
    },
    // Global Response Transform Interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    // Global Exception Filter
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
