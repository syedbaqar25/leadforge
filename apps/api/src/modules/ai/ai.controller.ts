import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { AnalyzeLeadDto, GenerateDraftDto } from './dto';
import {
  CurrentOrgId,
  CurrentUserId,
  RequirePermissions,
} from '../../common/decorators/tenant.decorator';

@ApiTags('AI Intelligence')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('leads/:id/analyze')
  @RequirePermissions('ai:analyze')
  @ApiOperation({ summary: 'Run structured AI qualification and pain-point analysis on a lead' })
  @ApiParam({ name: 'id', description: 'Lead UUID' })
  @ApiResponse({ status: 200, description: 'Structured lead analysis and token accounting' })
  @ApiResponse({ status: 403, description: 'AI features are disabled for this organization' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  async analyzeLead(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string | null,
    @Param('id') leadId: string,
    @Body() dto: AnalyzeLeadDto,
  ) {
    return this.aiService.analyzeLead(orgId, userId, leadId, dto);
  }

  @Post('leads/:id/draft')
  @RequirePermissions('ai:draft')
  @ApiOperation({
    summary: 'Generate personalized outreach message draft with human approval requirement',
  })
  @ApiParam({ name: 'id', description: 'Lead UUID' })
  @ApiResponse({
    status: 201,
    description: 'Message drafted and linked to a pending human approval request',
  })
  @ApiResponse({ status: 403, description: 'AI features are disabled for this organization' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  async generateDraft(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string | null,
    @Param('id') leadId: string,
    @Body() dto: GenerateDraftDto,
  ) {
    return this.aiService.generateDraft(orgId, userId, leadId, dto);
  }

  @Get('leads/:id/history')
  @RequirePermissions('ai:assistant')
  @ApiOperation({ summary: 'Get AI analysis history and token accounting for a lead' })
  @ApiParam({ name: 'id', description: 'Lead UUID' })
  @ApiResponse({ status: 200, description: 'List of past AI analyses' })
  async getLeadAiHistory(@CurrentOrgId() orgId: string, @Param('id') leadId: string) {
    return this.aiService.getLeadAiHistory(orgId, leadId);
  }
}
