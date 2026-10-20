import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { LeadsService } from './leads.service';
import {
  CreateLeadDto,
  UpdateLeadDto,
  LeadQueryDto,
  CreateCustomFieldDto,
  CreateTagDto,
  CreateNoteDto,
  PublicSubmitLeadDto,
  MergeLeadsDto,
} from './dto';
import {
  Public,
  CurrentOrgId,
  CurrentUserId,
  RequirePermissions,
} from '../../common/decorators/tenant.decorator';

@ApiTags('Leads')
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @RequirePermissions('lead:read:own')
  @ApiOperation({ summary: 'List leads with filtering, search, and pagination' })
  async getLeads(@CurrentOrgId() orgId: string, @Query() query: LeadQueryDto) {
    return this.leadsService.getLeads(orgId, query);
  }

  @Post()
  @RequirePermissions('lead:create')
  @ApiOperation({ summary: 'Create a new lead' })
  async createLead(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateLeadDto,
  ) {
    return this.leadsService.createLead(orgId, userId, dto);
  }

  @Public()
  @Post('public/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Public endpoint for website lead capture forms' })
  async publicSubmit(@Body() dto: PublicSubmitLeadDto, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress;
    return this.leadsService.publicSubmitLead(dto, ip);
  }

  @Get('custom-fields/definitions')
  @ApiOperation({ summary: 'List custom field definitions for the organization' })
  async getCustomFieldDefinitions(@CurrentOrgId() orgId: string) {
    return this.leadsService.getCustomFieldDefinitions(orgId);
  }

  @Post('custom-fields/definitions')
  @RequirePermissions('org:settings')
  @ApiOperation({ summary: 'Create a custom field definition' })
  async createCustomFieldDefinition(
    @CurrentOrgId() orgId: string,
    @Body() dto: CreateCustomFieldDto,
  ) {
    return this.leadsService.createCustomFieldDefinition(orgId, dto);
  }

  @Get('tags')
  @ApiOperation({ summary: 'List all tags for the organization' })
  async getTags(@CurrentOrgId() orgId: string) {
    return this.leadsService.getTags(orgId);
  }

  @Post('tags')
  @RequirePermissions('lead:create')
  @ApiOperation({ summary: 'Create a new tag' })
  async createTag(@CurrentOrgId() orgId: string, @Body() dto: CreateTagDto) {
    return this.leadsService.createTag(orgId, dto);
  }

  @Get('duplicates')
  @RequirePermissions('lead:merge')
  @ApiOperation({ summary: 'List pending duplicate candidate pairs' })
  async getDuplicateCandidates(@CurrentOrgId() orgId: string) {
    return this.leadsService.getDuplicateCandidates(orgId);
  }

  @Post('duplicates/:id/merge')
  @RequirePermissions('lead:merge')
  @ApiOperation({ summary: 'Merge duplicate leads into surviving record' })
  async mergeDuplicates(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string,
    @Param('id') candidateId: string,
    @Body() dto: MergeLeadsDto,
  ) {
    return this.leadsService.mergeDuplicates(orgId, candidateId, userId, dto);
  }

  @Post('duplicates/:id/dismiss')
  @RequirePermissions('lead:merge')
  @ApiOperation({ summary: 'Dismiss a duplicate candidate' })
  async dismissDuplicate(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string,
    @Param('id') candidateId: string,
  ) {
    return this.leadsService.dismissDuplicate(orgId, candidateId, userId);
  }

  @Get(':id')
  @RequirePermissions('lead:read:own')
  @ApiOperation({ summary: 'Get single lead details with timeline and custom fields' })
  async getLead(@CurrentOrgId() orgId: string, @Param('id') leadId: string) {
    return this.leadsService.getLeadById(orgId, leadId);
  }

  @Patch(':id')
  @RequirePermissions('lead:update:own')
  @ApiOperation({ summary: 'Update lead details' })
  async updateLead(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string,
    @Param('id') leadId: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leadsService.updateLead(orgId, leadId, userId, dto);
  }

  @Delete(':id')
  @RequirePermissions('lead:delete')
  @ApiOperation({ summary: 'Soft delete a lead' })
  async deleteLead(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string,
    @Param('id') leadId: string,
  ) {
    return this.leadsService.deleteLead(orgId, leadId, userId);
  }

  @Get(':id/notes')
  @RequirePermissions('lead:read:own')
  @ApiOperation({ summary: 'List notes for a lead' })
  async getNotes(@CurrentOrgId() orgId: string, @Param('id') leadId: string) {
    return this.leadsService.getLeadNotes(orgId, leadId);
  }

  @Post(':id/notes')
  @RequirePermissions('lead:update:own')
  @ApiOperation({ summary: 'Add a note to a lead' })
  async addNote(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string,
    @Param('id') leadId: string,
    @Body() dto: CreateNoteDto,
  ) {
    return this.leadsService.addNote(orgId, leadId, userId, dto);
  }

  @Delete(':id/notes/:noteId')
  @RequirePermissions('lead:update:own')
  @ApiOperation({ summary: 'Delete a note' })
  async deleteNote(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string,
    @Param('id') leadId: string,
    @Param('noteId') noteId: string,
    @Req() req: Request,
  ) {
    const role = (req as any).user?.role || 'salesperson';
    return this.leadsService.deleteNote(orgId, leadId, noteId, userId, role);
  }

  @Get(':id/activities')
  @RequirePermissions('lead:read:own')
  @ApiOperation({ summary: 'Get paginated activity timeline for a lead' })
  async getActivities(
    @CurrentOrgId() orgId: string,
    @Param('id') leadId: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.leadsService.getLeadActivities(orgId, leadId, page, pageSize);
  }
}
