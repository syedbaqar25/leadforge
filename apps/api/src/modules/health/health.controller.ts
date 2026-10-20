import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { Public } from '../../common/decorators/tenant.decorator';
import Redis from 'ioredis';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness check' })
  @ApiResponse({ status: 200, description: 'Application process is alive' })
  getLive() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Readiness check (PostgreSQL + Redis)' })
  @ApiResponse({ status: 200, description: 'All core dependencies are healthy' })
  @ApiResponse({ status: 503, description: 'One or more dependencies are degraded' })
  async getReady() {
    const checks: Record<string, { status: 'up' | 'down'; latencyMs?: number; error?: string }> =
      {};

    // 1. Check PostgreSQL
    const dbStart = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = {
        status: 'up',
        latencyMs: Date.now() - dbStart,
      };
    } catch (err: any) {
      checks.database = {
        status: 'down',
        error: err.message,
      };
    }

    // 2. Check Redis
    const redisStart = Date.now();
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      const client = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        lazyConnect: true,
      });
      await client.connect();
      await client.ping();
      await client.quit();
      checks.redis = {
        status: 'up',
        latencyMs: Date.now() - redisStart,
      };
    } catch (err: any) {
      checks.redis = {
        status: 'down',
        error: err.message,
      };
    }

    const allHealthy = Object.values(checks).every((c) => c.status === 'up');

    if (!allHealthy) {
      throw new ServiceUnavailableException({
        status: 'degraded',
        checks,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      status: 'ready',
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}
