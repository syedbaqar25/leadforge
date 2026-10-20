import { Controller, Get, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { CurrentOrgId, RequirePermissions } from '../../common/decorators/tenant.decorator';

@ApiTags('Analytics & Reporting')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @RequirePermissions('analytics:view:all')
  @ApiOperation({ summary: 'High-level KPI dashboard overview (leads, pipeline, AI usage)' })
  @ApiResponse({ status: 200, description: 'Aggregated KPI metrics' })
  async getDashboardSummary(@CurrentOrgId() orgId: string) {
    return this.analyticsService.getDashboardSummary(orgId);
  }

  @Get('leads')
  @RequirePermissions('analytics:view:all')
  @ApiOperation({ summary: 'Lead velocity, source/campaign conversion rates, and score bands' })
  @ApiQuery({ name: 'days', required: false, type: Number, example: 30 })
  @ApiResponse({ status: 200, description: 'Lead analytics breakdown' })
  async getLeadAnalytics(
    @CurrentOrgId() orgId: string,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.analyticsService.getLeadAnalytics(orgId, days);
  }

  @Get('deals')
  @RequirePermissions('analytics:view:all')
  @ApiOperation({ summary: 'Pipeline stage conversion funnel, win/loss rates, and deal velocity' })
  @ApiResponse({ status: 200, description: 'Deal and pipeline funnel analytics' })
  async getDealAnalytics(@CurrentOrgId() orgId: string) {
    return this.analyticsService.getDealAnalytics(orgId);
  }

  @Get('ai-usage')
  @RequirePermissions('analytics:view:all')
  @ApiOperation({ summary: 'AI token accounting, execution costs, and monthly counters' })
  @ApiResponse({ status: 200, description: 'AI consumption and cost accounting' })
  async getAiUsageAnalytics(@CurrentOrgId() orgId: string) {
    return this.analyticsService.getAiUsageAnalytics(orgId);
  }
}
