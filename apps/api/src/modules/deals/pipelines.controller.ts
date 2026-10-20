import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { DealsService } from './deals.service';
import { CreatePipelineDto, UpdatePipelineDto, CreateStageDto, ReorderStagesDto } from './dto';
import {
  CurrentOrgId,
  CurrentUserId,
  RequirePermissions,
} from '../../common/decorators/tenant.decorator';

@ApiTags('Pipelines')
@Controller('pipelines')
export class PipelinesController {
  constructor(private readonly dealsService: DealsService) {}

  @Get()
  @RequirePermissions('pipeline:view')
  @ApiOperation({ summary: 'List all sales pipelines and their stages' })
  @ApiResponse({ status: 200, description: 'List of pipelines' })
  async getPipelines(@CurrentOrgId() orgId: string) {
    return this.dealsService.getPipelines(orgId);
  }

  @Post()
  @RequirePermissions('pipeline:manage')
  @ApiOperation({ summary: 'Create a new sales pipeline' })
  @ApiResponse({ status: 201, description: 'Pipeline created successfully' })
  async createPipeline(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string | null,
    @Body() dto: CreatePipelineDto,
  ) {
    return this.dealsService.createPipeline(orgId, userId, dto);
  }

  @Get(':id')
  @RequirePermissions('pipeline:view')
  @ApiOperation({ summary: 'Get pipeline details by ID with stages and deal statistics' })
  @ApiParam({ name: 'id', description: 'Pipeline UUID' })
  @ApiResponse({ status: 200, description: 'Pipeline details' })
  @ApiResponse({ status: 404, description: 'Pipeline not found' })
  async getPipelineById(@CurrentOrgId() orgId: string, @Param('id') id: string) {
    return this.dealsService.getPipelineById(orgId, id);
  }

  @Put(':id')
  @RequirePermissions('pipeline:manage')
  @ApiOperation({ summary: 'Update pipeline name or default status' })
  @ApiParam({ name: 'id', description: 'Pipeline UUID' })
  @ApiResponse({ status: 200, description: 'Pipeline updated successfully' })
  @ApiResponse({ status: 404, description: 'Pipeline not found' })
  async updatePipeline(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string | null,
    @Param('id') id: string,
    @Body() dto: UpdatePipelineDto,
  ) {
    return this.dealsService.updatePipeline(orgId, userId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('pipeline:manage')
  @ApiOperation({ summary: 'Delete a sales pipeline' })
  @ApiParam({ name: 'id', description: 'Pipeline UUID' })
  @ApiResponse({ status: 200, description: 'Pipeline deleted successfully' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete default pipeline or pipeline with active deals',
  })
  @ApiResponse({ status: 404, description: 'Pipeline not found' })
  async deletePipeline(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string | null,
    @Param('id') id: string,
  ) {
    return this.dealsService.deletePipeline(orgId, userId, id);
  }

  @Post(':id/stages')
  @RequirePermissions('pipeline:manage')
  @ApiOperation({ summary: 'Add a new stage to the pipeline' })
  @ApiParam({ name: 'id', description: 'Pipeline UUID' })
  @ApiResponse({ status: 201, description: 'Stage created successfully' })
  @ApiResponse({ status: 404, description: 'Pipeline not found' })
  async addStage(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string | null,
    @Param('id') id: string,
    @Body() dto: CreateStageDto,
  ) {
    return this.dealsService.addStage(orgId, userId, id, dto);
  }

  @Put(':id/stages/reorder')
  @RequirePermissions('pipeline:manage')
  @ApiOperation({ summary: 'Reorder stages within a pipeline' })
  @ApiParam({ name: 'id', description: 'Pipeline UUID' })
  @ApiResponse({ status: 200, description: 'Stages reordered successfully' })
  @ApiResponse({ status: 404, description: 'Pipeline not found' })
  async reorderStages(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string | null,
    @Param('id') id: string,
    @Body() dto: ReorderStagesDto,
  ) {
    return this.dealsService.reorderStages(orgId, userId, id, dto);
  }

  @Delete(':id/stages/:stageId')
  @RequirePermissions('pipeline:manage')
  @ApiOperation({ summary: 'Delete a pipeline stage' })
  @ApiParam({ name: 'id', description: 'Pipeline UUID' })
  @ApiParam({ name: 'stageId', description: 'Stage UUID' })
  @ApiResponse({ status: 200, description: 'Stage deleted successfully' })
  @ApiResponse({ status: 400, description: 'Stage has active deals and cannot be deleted' })
  @ApiResponse({ status: 404, description: 'Pipeline or stage not found' })
  async deleteStage(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string | null,
    @Param('id') id: string,
    @Param('stageId') stageId: string,
  ) {
    return this.dealsService.deleteStage(orgId, userId, id, stageId);
  }
}
