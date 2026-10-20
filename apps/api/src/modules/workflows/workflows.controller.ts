import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { WorkflowsService } from './workflows.service';
import { CreateWorkflowDto, UpdateWorkflowDto, WorkflowQueryDto } from './dto';
import {
  CurrentOrgId,
  CurrentUserId,
  RequirePermissions,
} from '../../common/decorators/tenant.decorator';

@ApiTags('Workflows')
@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Get()
  @RequirePermissions('workflow:view')
  @ApiOperation({ summary: 'List automated workflows with latest version details' })
  @ApiResponse({ status: 200, description: 'Paginated workflows list' })
  async getWorkflows(@CurrentOrgId() orgId: string, @Query() query: WorkflowQueryDto) {
    return this.workflowsService.getWorkflows(orgId, query);
  }

  @Post()
  @RequirePermissions('workflow:create')
  @ApiOperation({ summary: 'Create a new automated workflow with initial version' })
  @ApiResponse({ status: 201, description: 'Workflow created successfully' })
  async createWorkflow(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string | null,
    @Body() dto: CreateWorkflowDto,
  ) {
    return this.workflowsService.createWorkflow(orgId, userId, dto);
  }

  @Get(':id')
  @RequirePermissions('workflow:view')
  @ApiOperation({ summary: 'Get workflow details with complete version history' })
  @ApiParam({ name: 'id', description: 'Workflow UUID' })
  @ApiResponse({ status: 200, description: 'Workflow details and version list' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async getWorkflowById(@CurrentOrgId() orgId: string, @Param('id') id: string) {
    return this.workflowsService.getWorkflowById(orgId, id);
  }

  @Put(':id')
  @RequirePermissions('workflow:manage')
  @ApiOperation({ summary: 'Update workflow configuration and generate next version instance' })
  @ApiParam({ name: 'id', description: 'Workflow UUID' })
  @ApiResponse({ status: 200, description: 'Workflow updated with new version' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async updateWorkflow(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string | null,
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDto,
  ) {
    return this.workflowsService.updateWorkflow(orgId, userId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('workflow:manage')
  @ApiOperation({ summary: 'Delete a workflow definition' })
  @ApiParam({ name: 'id', description: 'Workflow UUID' })
  @ApiResponse({ status: 200, description: 'Workflow deleted successfully' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async deleteWorkflow(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string | null,
    @Param('id') id: string,
  ) {
    return this.workflowsService.deleteWorkflow(orgId, userId, id);
  }

  @Get(':id/executions')
  @RequirePermissions('workflow:view')
  @ApiOperation({ summary: 'Get execution run history for a workflow' })
  @ApiParam({ name: 'id', description: 'Workflow UUID' })
  @ApiResponse({ status: 200, description: 'List of executions with step traces' })
  async getWorkflowExecutions(@CurrentOrgId() orgId: string, @Param('id') id: string) {
    return this.workflowsService.getWorkflowExecutions(orgId, id);
  }

  @Post(':id/test-run')
  @RequirePermissions('workflow:manage')
  @ApiOperation({ summary: 'Manually trigger a test execution of the workflow' })
  @ApiParam({ name: 'id', description: 'Workflow UUID' })
  @ApiResponse({ status: 200, description: 'Test execution results' })
  async testRunWorkflow(
    @CurrentOrgId() orgId: string,
    @Param('id') id: string,
    @Body() payload: Record<string, any>,
  ) {
    return this.workflowsService.executeWorkflow(orgId, id, 'manual_test_event', payload);
  }
}
