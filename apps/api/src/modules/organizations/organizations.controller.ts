import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { OrganizationsService } from './organizations.service';
import { UpdateOrgDto, InviteMemberDto, UpdateMemberRoleDto, SwitchOrgDto } from './dto';
import {
  Public,
  CurrentOrgId,
  CurrentUserId,
  RequirePermissions,
} from '../../common/decorators/tenant.decorator';

@ApiTags('Organizations')
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get current active organization details' })
  async getCurrent(@CurrentOrgId() orgId: string) {
    return this.orgsService.getCurrentOrg(orgId);
  }

  @Patch('current')
  @RequirePermissions('org:settings')
  @ApiOperation({ summary: 'Update organization settings' })
  async updateCurrent(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string,
    @Body() dto: UpdateOrgDto,
  ) {
    return this.orgsService.updateCurrentOrg(orgId, dto, userId);
  }

  @Get('my-orgs')
  @ApiOperation({ summary: 'List all organizations for the current user' })
  async getMyOrgs(@CurrentUserId() userId: string) {
    return this.orgsService.getUserOrgs(userId);
  }

  @Post('switch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Switch active organization tenant context' })
  async switchOrg(
    @CurrentUserId() userId: string,
    @Body() dto: SwitchOrgDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.orgsService.switchOrg(userId, dto.organizationId);

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000,
    });

    return result;
  }

  @Get('members')
  @ApiOperation({ summary: 'List team members in current organization' })
  async getMembers(@CurrentOrgId() orgId: string) {
    return this.orgsService.getMembers(orgId);
  }

  @Post('invitations')
  @RequirePermissions('org:members:invite')
  @ApiOperation({ summary: 'Invite a new team member' })
  async inviteMember(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.orgsService.inviteMember(orgId, userId, dto);
  }

  @Public()
  @Get('invitations/:token')
  @ApiOperation({ summary: 'Preview invitation details by token' })
  async getInvitation(@Param('token') token: string) {
    return this.orgsService.getInvitationByToken(token);
  }

  @Post('invitations/:token/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept invitation and join organization' })
  async acceptInvitation(@CurrentUserId() userId: string, @Param('token') token: string) {
    return this.orgsService.acceptInvitation(userId, token);
  }

  @Patch('members/:id/role')
  @RequirePermissions('org:members:manage')
  @ApiOperation({ summary: 'Update a member role' })
  async updateMemberRole(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string,
    @Param('id') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.orgsService.updateMemberRole(orgId, memberId, dto, userId);
  }

  @Delete('members/:id')
  @RequirePermissions('org:members:remove')
  @ApiOperation({ summary: 'Remove a member from the organization' })
  async removeMember(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string,
    @Param('id') memberId: string,
  ) {
    return this.orgsService.removeMember(orgId, memberId, userId);
  }
}
