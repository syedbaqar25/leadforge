import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // =========================================================================
  // LEAD ANALYTICS & VELOCITY
  // =========================================================================

  /**
   * Calculate lead velocity, conversion rates by source and campaign, and score distribution.
   */
  async getLeadAnalytics(orgId: string, days = 30) {
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [totalLeads, periodLeads, allLeads] = await Promise.all([
      this.prisma.client.lead.count({
        where: { organizationId: orgId, deletedAt: null },
      }),
      this.prisma.client.lead.count({
        where: {
          organizationId: orgId,
          deletedAt: null,
          createdAt: { gte: sinceDate },
        },
      }),
      this.prisma.client.lead.findMany({
        where: { organizationId: orgId, deletedAt: null },
        select: {
          id: true,
          source: true,
          campaign: true,
          status: true,
          scoreBand: true,
          score: true,
          createdAt: true,
        },
      }),
    ]);

    const leadVelocityPerDay = Number((periodLeads / Math.max(1, days)).toFixed(2));
    const convertedCount = allLeads.filter((l) => l.status === 'converted').length;
    const overallConversionRate =
      totalLeads > 0 ? Number(((convertedCount / totalLeads) * 100).toFixed(2)) : 0;

    // Breakdown by source
    const sourceMap = new Map<string, { total: number; converted: number }>();
    for (const l of allLeads) {
      const src = l.source || 'Direct / Unknown';
      const existing = sourceMap.get(src) || { total: 0, converted: 0 };
      existing.total++;
      if (l.status === 'converted') existing.converted++;
      sourceMap.set(src, existing);
    }

    const bySource = Array.from(sourceMap.entries()).map(([source, stats]) => ({
      source,
      total: stats.total,
      converted: stats.converted,
      conversionRate: Number(((stats.converted / stats.total) * 100).toFixed(2)),
    }));

    // Breakdown by campaign
    const campaignMap = new Map<string, { total: number; converted: number }>();
    for (const l of allLeads) {
      if (!l.campaign) continue;
      const cmp = l.campaign;
      const existing = campaignMap.get(cmp) || { total: 0, converted: 0 };
      existing.total++;
      if (l.status === 'converted') existing.converted++;
      campaignMap.set(cmp, existing);
    }

    const byCampaign = Array.from(campaignMap.entries()).map(([campaign, stats]) => ({
      campaign,
      total: stats.total,
      converted: stats.converted,
      conversionRate: Number(((stats.converted / stats.total) * 100).toFixed(2)),
    }));

    // Breakdown by status
    const byStatus: Record<string, number> = {};
    for (const l of allLeads) {
      byStatus[l.status] = (byStatus[l.status] || 0) + 1;
    }

    // Breakdown by score band
    const byScoreBand: Record<string, number> = { hot: 0, warm: 0, cold: 0 };
    for (const l of allLeads) {
      byScoreBand[l.scoreBand] = (byScoreBand[l.scoreBand] || 0) + 1;
    }

    return {
      periodDays: days,
      totalLeads,
      newLeadsInPeriod: periodLeads,
      leadVelocityPerDay,
      overallConversionRate,
      bySource,
      byCampaign,
      byStatus,
      byScoreBand,
    };
  }

  // =========================================================================
  // DEAL & PIPELINE FUNNEL ANALYTICS
  // =========================================================================

  /**
   * Calculate pipeline stage conversion funnel, win/loss metrics, and deal cycle velocity.
   */
  async getDealAnalytics(orgId: string) {
    const [deals, stages] = await Promise.all([
      this.prisma.client.deal.findMany({
        where: { organizationId: orgId, deletedAt: null },
        include: {
          stage: true,
        },
      }),
      this.prisma.client.pipelineStage.findMany({
        where: { pipeline: { organizationId: orgId } },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);

    let totalPipelineValue = 0;
    let wonRevenue = 0;
    let wonCount = 0;
    let lostCount = 0;
    let openCount = 0;
    let totalCycleDays = 0;
    let closedCountWithDates = 0;

    // Stage counts and values
    const stageMetricsMap = new Map<
      string,
      { stageName: string; stageType: string; count: number; totalValue: number }
    >();
    for (const stg of stages) {
      stageMetricsMap.set(stg.id, {
        stageName: stg.name,
        stageType: stg.stageType,
        count: 0,
        totalValue: 0,
      });
    }

    for (const deal of deals) {
      const val = Number(deal.value || 0);

      const metric = stageMetricsMap.get(deal.stageId);
      if (metric) {
        metric.count++;
        metric.totalValue += val;
      }

      if (deal.stage.stageType === 'won') {
        wonCount++;
        wonRevenue += val;
      } else if (deal.stage.stageType === 'lost') {
        lostCount++;
      } else {
        openCount++;
        totalPipelineValue += val;
      }

      if (deal.closedAt) {
        const cycleDays =
          (deal.closedAt.getTime() - deal.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        totalCycleDays += Math.max(0, cycleDays);
        closedCountWithDates++;
      }
    }

    const totalResolved = wonCount + lostCount;
    const winRate = totalResolved > 0 ? Number(((wonCount / totalResolved) * 100).toFixed(2)) : 0;
    const averageDealSize = wonCount > 0 ? Number((wonRevenue / wonCount).toFixed(2)) : 0;
    const averageDealVelocityDays =
      closedCountWithDates > 0 ? Number((totalCycleDays / closedCountWithDates).toFixed(1)) : 0;

    const stageFunnel = Array.from(stageMetricsMap.values());

    return {
      totalDeals: deals.length,
      openDealsCount: openCount,
      openPipelineValue: Number(totalPipelineValue.toFixed(2)),
      wonDealsCount: wonCount,
      wonRevenue: Number(wonRevenue.toFixed(2)),
      lostDealsCount: lostCount,
      winRate,
      averageDealSize,
      averageDealVelocityDays,
      stageFunnel,
    };
  }

  // =========================================================================
  // AI TOKEN & COST ACCOUNTING
  // =========================================================================

  /**
   * Aggregate token consumption, LLM costs, and usage counters for the tenant.
   */
  async getAiUsageAnalytics(orgId: string) {
    const currentPeriod = new Date().toISOString().substring(0, 7); // e.g. "2026-10"

    const [analyses, counters, org] = await Promise.all([
      this.prisma.client.aiAnalysis.findMany({
        where: { organizationId: orgId },
        select: {
          analysisType: true,
          promptTokens: true,
          completionTokens: true,
          totalTokens: true,
          costCents: true,
          createdAt: true,
        },
      }),
      this.prisma.client.usageCounter.findMany({
        where: { organizationId: orgId, period: currentPeriod },
      }),
      this.prisma.client.organization.findUnique({
        where: { id: orgId },
        select: { aiEnabled: true, settings: true },
      }),
    ]);

    let totalTokens = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalCostCents = 0;

    const byTypeMap = new Map<string, { count: number; totalTokens: number; costCents: number }>();

    for (const a of analyses) {
      totalTokens += a.totalTokens;
      totalPromptTokens += a.promptTokens;
      totalCompletionTokens += a.completionTokens;
      totalCostCents += a.costCents;

      const typeStats = byTypeMap.get(a.analysisType) || { count: 0, totalTokens: 0, costCents: 0 };
      typeStats.count++;
      typeStats.totalTokens += a.totalTokens;
      typeStats.costCents += a.costCents;
      byTypeMap.set(a.analysisType, typeStats);
    }

    const byType = Array.from(byTypeMap.entries()).map(([type, stats]) => ({
      analysisType: type,
      executions: stats.count,
      totalTokens: stats.totalTokens,
      costCents: stats.costCents,
      costDollars: Number((stats.costCents / 100).toFixed(4)),
    }));

    return {
      currentPeriod,
      aiEnabled: org?.aiEnabled ?? true,
      summary: {
        totalRequests: analyses.length,
        totalPromptTokens,
        totalCompletionTokens,
        totalTokens,
        totalCostCents,
        totalCostDollars: Number((totalCostCents / 100).toFixed(2)),
      },
      byType,
      monthlyCounters: counters.map((c) => ({
        metric: c.metric,
        count: c.count,
        limit: c.limitValue,
      })),
    };
  }

  // =========================================================================
  // UNIFIED DASHBOARD SUMMARY
  // =========================================================================

  /**
   * Aggregated high-level KPI dashboard metrics for executive view.
   */
  async getDashboardSummary(orgId: string) {
    const [leadMetrics, dealMetrics, aiMetrics] = await Promise.all([
      this.getLeadAnalytics(orgId, 30),
      this.getDealAnalytics(orgId),
      this.getAiUsageAnalytics(orgId),
    ]);

    return {
      leads: {
        total: leadMetrics.totalLeads,
        newInLast30Days: leadMetrics.newLeadsInPeriod,
        velocityPerDay: leadMetrics.leadVelocityPerDay,
        conversionRate: leadMetrics.overallConversionRate,
        hotLeads: leadMetrics.byScoreBand.hot || 0,
      },
      pipeline: {
        openDeals: dealMetrics.openDealsCount,
        openValue: dealMetrics.openPipelineValue,
        wonRevenue: dealMetrics.wonRevenue,
        winRate: dealMetrics.winRate,
        avgDealVelocityDays: dealMetrics.averageDealVelocityDays,
      },
      ai: {
        totalTokens: aiMetrics.summary.totalTokens,
        costDollars: aiMetrics.summary.totalCostDollars,
      },
    };
  }
}
