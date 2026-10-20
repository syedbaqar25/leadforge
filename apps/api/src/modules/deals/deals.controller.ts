import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { DealsService } from './deals.service';
import { CreateDealDto, UpdateDealDto, MoveDealStageDto, DealQueryDto } from './dto';
import {
  CurrentOrgId,
  CurrentUserId,
  RequirePermissions,
} from '../../common/decorators/tenant.decorator';

@ApiTags('Deals')
@Controller('deals')
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Post()
  @RequirePermissions('deal:create')
  @ApiOperation({ summary: 'Create a new deal revenue opportunity' })
  @ApiResponse({ status: 201, description: 'Deal created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid stage, owner, or input payload' })
  @ApiResponse({ status: 404, description: 'Associated lead or pipeline not found' })
  async createDeal(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string | null,
    @Body() dto: CreateDealDto,
  ) {
    return this.dealsService.createDeal(orgId, userId, dto);
  }

  @Get()
  @RequirePermissions('deal:read:own')
  @ApiOperation({ summary: 'List deals with pagination, search, and filtering' })
  @ApiResponse({ status: 200, description: 'Paginated deals list' })
  async getDeals(@CurrentOrgId() orgId: string, @Query() query: DealQueryDto) {
    return this.dealsService.getDeals(orgId, query);
  }

  @Get('kanban')
  @RequirePermissions('deal:read:own')
  @ApiOperation({ summary: 'Get visual Kanban board with aggregated stage metrics and deals' })
  @ApiQuery({
    name: 'pipelineId',
    required: false,
    description: 'Optional pipeline ID (defaults to primary pipeline)',
  })
  @ApiResponse({ status: 200, description: 'Kanban board stages and deal cards' })
  async getKanbanBoard(@CurrentOrgId() orgId: string, @Query('pipelineId') pipelineId?: string) {
    return this.dealsService.getKanbanBoard(orgId, pipelineId);
  }

  @Get(':id')
  @RequirePermissions('deal:read:own')
  @ApiOperation({ summary: 'Get single deal by ID with stage history and activities' })
  @ApiParam({ name: 'id', description: 'Deal UUID' })
  @ApiResponse({ status: 200, description: 'Deal details with stage history' })
  @ApiResponse({ status: 404, description: 'Deal not found' })
  async getDealById(@CurrentOrgId() orgId: string, @Param('id') id: string) {
    return this.dealsService.getDealById(orgId, id);
  }

  @Patch(':id')
  @RequirePermissions('deal:update:own')
  @ApiOperation({ summary: 'Update deal attributes with optimistic concurrency control' })
  @ApiParam({ name: 'id', description: 'Deal UUID' })
  @ApiResponse({ status: 200, description: 'Deal updated successfully' })
  @ApiResponse({ status: 404, description: 'Deal not found' })
  @ApiResponse({ status: 409, description: 'Version conflict - deal was modified concurrently' })
  async updateDeal(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string | null,
    @Param('id') id: string,
    @Body() dto: UpdateDealDto,
  ) {
    return this.dealsService.updateDeal(orgId, userId, id, dto);
  }

  @Patch(':id/stage')
  @RequirePermissions('deal:update:own')
  @ApiOperation({ summary: 'Quick stage transition for Kanban drag-and-drop' })
  @ApiParam({ name: 'id', description: 'Deal UUID' })
  @ApiResponse({ status: 200, description: 'Stage transitioned successfully' })
  @ApiResponse({ status: 404, description: 'Deal not found' })
  @ApiResponse({ status: 409, description: 'Version conflict - deal was modified concurrently' })
  async moveDealStage(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string | null,
    @Param('id') id: string,
    @Body() dto: MoveDealStageDto,
  ) {
    return this.dealsService.moveDealStage(orgId, userId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('deal:delete')
  @ApiOperation({ summary: 'Soft delete a deal' })
  @ApiParam({ name: 'id', description: 'Deal UUID' })
  @ApiResponse({ status: 200, description: 'Deal deleted successfully' })
  @ApiResponse({ status: 404, description: 'Deal not found' })
  async deleteDeal(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string | null,
    @Param('id') id: string,
  ) {
    return this.dealsService.deleteDeal(orgId, userId, id);
  }
}
