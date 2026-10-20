import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { type ScoreBand } from '@leadforge/shared';
import { UpdateScoringRulesDto } from './dto/update-scoring-rules.dto';
import * as crypto from 'crypto';

export interface ScoreFactor {
  factorName: string;
  points: number;
  reason: string;
  impact: 'positive' | 'neutral' | 'negative';
}

export interface ScoreEvaluationResult {
  score: number;
  scoreBand: ScoreBand;
  factors: ScoreFactor[];
}

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Pure evaluation function computing score, band, and explainable factor breakdown.
   */
  evaluateLead(lead: any, _ruleSetConfig?: any): ScoreEvaluationResult {
    const factors: ScoreFactor[] = [];
    let totalScore = 0;

    // 1. Budget Factor (max 30 pts)
    const budget = lead.budgetAmount ? Number(lead.budgetAmount) : 0;
    if (budget >= 500000) {
      factors.push({
        factorName: 'Budget Authority',
        points: 30,
        reason: `Significant investment budget (${lead.budgetCurrency || 'INR'} ${budget.toLocaleString()})`,
        impact: 'positive',
      });
      totalScore += 30;
    } else if (budget >= 100000) {
      factors.push({
        factorName: 'Budget Authority',
        points: 20,
        reason: `Qualified budget commitment (${lead.budgetCurrency || 'INR'} ${budget.toLocaleString()})`,
        impact: 'positive',
      });
      totalScore += 20;
    } else if (budget > 0) {
      factors.push({
        factorName: 'Budget Authority',
        points: 10,
        reason: `Initial budget indicated (${lead.budgetCurrency || 'INR'} ${budget.toLocaleString()})`,
        impact: 'positive',
      });
      totalScore += 10;
    } else {
      factors.push({
        factorName: 'Budget Authority',
        points: 0,
        reason: 'No budget specified',
        impact: 'neutral',
      });
    }

    // 2. Timeline Urgency (max 25 pts)
    const timeline = (lead.purchaseTimeline || '').toLowerCase();
    if (
      timeline.includes('immediate') ||
      timeline.includes('urgent') ||
      timeline.includes('now') ||
      timeline.includes('30 days') ||
      timeline.includes('1 month') ||
      timeline.includes('q1')
    ) {
      factors.push({
        factorName: 'Purchase Urgency',
        points: 25,
        reason: `High purchase urgency stated: "${lead.purchaseTimeline}"`,
        impact: 'positive',
      });
      totalScore += 25;
    } else if (
      timeline.includes('q2') ||
      timeline.includes('3 months') ||
      timeline.includes('short')
    ) {
      factors.push({
        factorName: 'Purchase Urgency',
        points: 15,
        reason: `Medium purchase timeline: "${lead.purchaseTimeline}"`,
        impact: 'positive',
      });
      totalScore += 15;
    } else if (timeline.length > 0) {
      factors.push({
        factorName: 'Purchase Urgency',
        points: 5,
        reason: `Extended purchase horizon: "${lead.purchaseTimeline}"`,
        impact: 'neutral',
      });
      totalScore += 5;
    } else {
      factors.push({
        factorName: 'Purchase Urgency',
        points: 0,
        reason: 'No purchase timeline provided',
        impact: 'neutral',
      });
    }

    // 3. Decision Maker Seniority (max 20 pts)
    const title = (lead.jobTitle || '').toLowerCase();
    const isExecutive =
      /\b(ceo|cto|cfo|cro|cmo|coo|cio|cxo|vp|founder|owner|partner|president|chief)\b/i.test(
        title,
      ) ||
      title.includes('vice president') ||
      title.includes('managing director');

    const isDirector =
      /\b(director|head|principal)\b/i.test(title) || title.includes('general manager');

    const isManager = /\b(manager|lead|supervisor)\b/i.test(title) || title.includes('team lead');

    if (isExecutive) {
      factors.push({
        factorName: 'Decision Maker Seniority',
        points: 20,
        reason: `Executive / Owner title: "${lead.jobTitle}"`,
        impact: 'positive',
      });
      totalScore += 20;
    } else if (isDirector) {
      factors.push({
        factorName: 'Decision Maker Seniority',
        points: 15,
        reason: `Director / Department Head: "${lead.jobTitle}"`,
        impact: 'positive',
      });
      totalScore += 15;
    } else if (isManager) {
      factors.push({
        factorName: 'Decision Maker Seniority',
        points: 10,
        reason: `Management role: "${lead.jobTitle}"`,
        impact: 'positive',
      });
      totalScore += 10;
    } else if (lead.jobTitle) {
      factors.push({
        factorName: 'Decision Maker Seniority',
        points: 5,
        reason: `Individual contributor role: "${lead.jobTitle}"`,
        impact: 'neutral',
      });
      totalScore += 5;
    } else {
      factors.push({
        factorName: 'Decision Maker Seniority',
        points: 0,
        reason: 'No job title on record',
        impact: 'neutral',
      });
    }

    // 4. Contact Reachability & Completeness (max 15 pts)
    const hasEmail = Boolean(lead.emailNormalized || lead.emailRaw);
    const hasPhone = Boolean(lead.phoneNormalized || lead.phoneRaw);

    if (hasEmail && hasPhone) {
      factors.push({
        factorName: 'Direct Reachability',
        points: 15,
        reason: 'Full verified contact profiles (email + direct phone number)',
        impact: 'positive',
      });
      totalScore += 15;
    } else if (hasEmail || hasPhone) {
      factors.push({
        factorName: 'Direct Reachability',
        points: 10,
        reason: hasEmail ? 'Direct email address available' : 'Direct phone number available',
        impact: 'positive',
      });
      totalScore += 10;
    } else {
      factors.push({
        factorName: 'Direct Reachability',
        points: 0,
        reason: 'No valid direct contact info found',
        impact: 'negative',
      });
    }

    // 5. Company & Digital Footprint (max 10 pts)
    const hasCompany = Boolean(lead.company);
    const hasWebsite = Boolean(lead.website);

    if (hasCompany && hasWebsite) {
      factors.push({
        factorName: 'Account Verification',
        points: 10,
        reason: `Company (${lead.company}) and verified domain (${lead.website})`,
        impact: 'positive',
      });
      totalScore += 10;
    } else if (hasCompany) {
      factors.push({
        factorName: 'Account Verification',
        points: 5,
        reason: `Account verified (${lead.company})`,
        impact: 'positive',
      });
      totalScore += 5;
    } else {
      factors.push({
        factorName: 'Account Verification',
        points: 0,
        reason: 'No company affiliation on record',
        impact: 'neutral',
      });
    }

    const clampedScore = Math.min(100, Math.max(0, totalScore));
    const scoreBand: ScoreBand = clampedScore >= 75 ? 'hot' : clampedScore >= 40 ? 'warm' : 'cold';

    return {
      score: clampedScore,
      scoreBand,
      factors,
    };
  }

  /**
   * Calculate and persist lead score with audit trail in LeadScoreHistory.
   */
  async scoreLead(orgId: string, leadId: string, userId?: string) {
    const lead = await this.prisma.client.lead.findFirst({
      where: { id: leadId, organizationId: orgId, deletedAt: null },
    });

    if (!lead) {
      throw new NotFoundException({
        code: 'LEAD_NOT_FOUND',
        message: 'Lead not found.',
      });
    }

    const activeRuleSet = await this.getActiveRuleSet(orgId);
    const evaluation = this.evaluateLead(lead, activeRuleSet.rules);

    const inputHash = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          budget: lead.budgetAmount,
          timeline: lead.purchaseTimeline,
          title: lead.jobTitle,
          email: lead.emailNormalized,
          phone: lead.phoneNormalized,
          company: lead.company,
          website: lead.website,
        }),
      )
      .digest('hex')
      .slice(0, 16);

    // Save history audit log
    await this.prisma.client.leadScoreHistory.create({
      data: {
        leadId: lead.id,
        score: evaluation.score,
        band: evaluation.scoreBand,
        ruleSetVersion: activeRuleSet.version,
        factors: evaluation.factors as any,
        inputHash,
        modelName: 'rule-based-engine-v1',
      },
    });

    // If score or band changed, update lead record and log timeline activity
    const hasChanged = lead.score !== evaluation.score || lead.scoreBand !== evaluation.scoreBand;

    if (hasChanged) {
      await this.prisma.client.lead.update({
        where: { id: lead.id },
        data: {
          score: evaluation.score,
          scoreBand: evaluation.scoreBand,
        },
      });

      await this.prisma.client.activity.create({
        data: {
          organizationId: orgId,
          leadId: lead.id,
          activityType: 'score_change',
          description: `Lead score recalculated: ${lead.score} → ${evaluation.score} (Band: ${evaluation.scoreBand.toUpperCase()})`,
          performedById: userId || null,
          metadata: {
            previousScore: lead.score,
            newScore: evaluation.score,
            previousBand: lead.scoreBand,
            newBand: evaluation.scoreBand,
          },
        },
      });
    }

    return {
      leadId: lead.id,
      score: evaluation.score,
      scoreBand: evaluation.scoreBand,
      factors: evaluation.factors,
      hasChanged,
    };
  }

  /**
   * Recalculate score for all active leads in organization.
   */
  async recalculateAllLeads(orgId: string, userId?: string) {
    const leads = await this.prisma.client.lead.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { id: true },
    });

    for (const lead of leads) {
      await this.scoreLead(orgId, lead.id, userId);
    }

    return {
      totalScored: leads.length,
      message: `Successfully recalculated scores for ${leads.length} leads.`,
    };
  }

  /**
   * Fetch active scoring rules for organization, seeding default v1 if not present.
   */
  async getActiveRuleSet(orgId: string) {
    let ruleSet = await this.prisma.client.scoringRuleSet.findFirst({
      where: { organizationId: orgId, isActive: true },
      orderBy: { version: 'desc' },
    });

    if (!ruleSet) {
      const defaultRules = {
        budgetWeight: 30,
        timelineWeight: 25,
        seniorityWeight: 20,
        contactWeight: 15,
        companyWeight: 10,
        bands: {
          hot: 75,
          warm: 40,
          cold: 0,
        },
      };

      ruleSet = await this.prisma.client.scoringRuleSet.create({
        data: {
          organizationId: orgId,
          version: 1,
          rules: defaultRules,
          isActive: true,
          createdById: 'system',
        },
      });
    }

    return ruleSet;
  }

  /**
   * Update scoring rules: increments version and creates new active rule set.
   */
  async updateRuleSet(orgId: string, userId: string, dto: UpdateScoringRulesDto) {
    const currentRuleSet = await this.getActiveRuleSet(orgId);
    const nextVersion = currentRuleSet.version + 1;

    // Transaction to deactivate old and activate new
    const newRuleSet = await this.prisma.client.$transaction(async (tx) => {
      await tx.scoringRuleSet.updateMany({
        where: { organizationId: orgId, isActive: true },
        data: { isActive: false },
      });

      return tx.scoringRuleSet.create({
        data: {
          organizationId: orgId,
          version: nextVersion,
          rules: dto.rules as any,
          isActive: true,
          createdById: userId,
        },
      });
    });

    await this.auditService.log({
      organizationId: orgId,
      userId,
      action: 'scoring:update_rules',
      entityType: 'ScoringRuleSet',
      entityId: newRuleSet.id,
      after: { version: nextVersion, rules: dto.rules },
    });

    if (dto.recalculateAllLeads) {
      // Trigger recalculation in background
      this.recalculateAllLeads(orgId, userId).catch((err) =>
        this.logger.error(`Error in batch recalculation: ${err.message}`),
      );
    }

    return newRuleSet;
  }

  /**
   * Retrieve score audit history for a lead.
   */
  async getLeadScoreHistory(orgId: string, leadId: string) {
    const lead = await this.prisma.client.lead.findFirst({
      where: { id: leadId, organizationId: orgId, deletedAt: null },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return this.prisma.client.leadScoreHistory.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}
