import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ApprovalsService } from './approvals.service';
import { DecideApprovalDto, ApprovalQueryDto } from './dto';
import {
  CurrentOrgId,
  CurrentUserId,
  RequirePermissions,
} from '../../common/decorators/tenant.decorator';

@ApiTags('Approvals')
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get()
  @RequirePermissions('approval:view')
  @ApiOperation({ summary: 'List pending or historical approval requests with pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list of approval requests' })
  async getApprovals(@CurrentOrgId() orgId: string, @Query() query: ApprovalQueryDto) {
    return this.approvalsService.getApprovals(orgId, query);
  }

  @Get(':id')
  @RequirePermissions('approval:view')
  @ApiOperation({ summary: 'Get details of an approval request with entity payload context' })
  @ApiParam({ name: 'id', description: 'Approval Request UUID' })
  @ApiResponse({ status: 200, description: 'Approval request details' })
  @ApiResponse({ status: 404, description: 'Approval request not found' })
  async getApprovalById(@CurrentOrgId() orgId: string, @Param('id') id: string) {
    return this.approvalsService.getApprovalById(orgId, id);
  }

  @Post(':id/decide')
  @RequirePermissions('approval:decide')
  @ApiOperation({
    summary: 'Approve or reject a requested action with optional payload edits (Manager only)',
  })
  @ApiParam({ name: 'id', description: 'Approval Request UUID' })
  @ApiResponse({ status: 200, description: 'Decision recorded successfully' })
  @ApiResponse({ status: 400, description: 'Approval request already decided' })
  @ApiResponse({ status: 404, description: 'Approval request not found' })
  @ApiResponse({ status: 409, description: 'Conflict: approval was modified concurrently' })
  async decideApproval(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: DecideApprovalDto,
  ) {
    return this.approvalsService.decideApproval(orgId, userId, id, dto);
  }
}
