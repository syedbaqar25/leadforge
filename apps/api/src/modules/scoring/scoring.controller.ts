import { Controller, Get, Put, Post, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ScoringService } from './scoring.service';
import { UpdateScoringRulesDto } from './dto/update-scoring-rules.dto';
import {
  CurrentOrgId,
  CurrentUserId,
  RequirePermissions,
} from '../../common/decorators/tenant.decorator';

@ApiTags('Scoring')
@Controller('scoring')
export class ScoringController {
  constructor(private readonly scoringService: ScoringService) {}

  @Get('rules')
  @RequirePermissions('scoring:rules:view')
  @ApiOperation({ summary: 'Get active scoring rule set for organization' })
  async getRules(@CurrentOrgId() orgId: string) {
    return this.scoringService.getActiveRuleSet(orgId);
  }

  @Put('rules')
  @RequirePermissions('scoring:rules:manage')
  @ApiOperation({ summary: 'Update scoring rule set and trigger versioned rollover' })
  async updateRules(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string,
    @Body() dto: UpdateScoringRulesDto,
  ) {
    return this.scoringService.updateRuleSet(orgId, userId, dto);
  }

  @Post('leads/:id/recalculate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('lead:update:own')
  @ApiOperation({ summary: 'Trigger explainable score recalculation for a lead' })
  async recalculateLead(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string,
    @Param('id') leadId: string,
  ) {
    return this.scoringService.scoreLead(orgId, leadId, userId);
  }

  @Post('batch-recalculate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('scoring:rules:manage')
  @ApiOperation({ summary: 'Batch recalculate scores for all active organization leads' })
  async batchRecalculate(@CurrentOrgId() orgId: string, @CurrentUserId() userId: string) {
    return this.scoringService.recalculateAllLeads(orgId, userId);
  }

  @Get('leads/:id/history')
  @RequirePermissions('lead:read:own')
  @ApiOperation({ summary: 'View score history and explainable factor audit trail' })
  async getLeadScoreHistory(@CurrentOrgId() orgId: string, @Param('id') leadId: string) {
    return this.scoringService.getLeadScoreHistory(orgId, leadId);
  }
}
