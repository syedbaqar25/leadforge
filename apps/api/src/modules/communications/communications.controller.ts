import { Controller, Get, Post, Put, Delete, Body, Param, Query, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CommunicationsService } from './communications.service';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  SendMessageDto,
  RecordConsentDto,
  AddSuppressionDto,
  MessageQueryDto,
} from './dto';
import {
  CurrentOrgId,
  CurrentUserId,
  RequirePermissions,
  Public,
} from '../../common/decorators/tenant.decorator';

@ApiTags('Communications')
@Controller('communications')
export class CommunicationsController {
  constructor(private readonly communicationsService: CommunicationsService) {}

  // =========================================================================
  // MESSAGE TEMPLATES
  // =========================================================================

  @Get('templates')
  @RequirePermissions('communication:view')
  @ApiOperation({ summary: 'List reusable message templates' })
  @ApiQuery({ name: 'channel', required: false, enum: ['email', 'whatsapp'] })
  @ApiResponse({ status: 200, description: 'List of templates' })
  async getTemplates(
    @CurrentOrgId() orgId: string,
    @Query('channel') channel?: 'email' | 'whatsapp',
  ) {
    return this.communicationsService.getTemplates(orgId, channel);
  }

  @Post('templates')
  @RequirePermissions('email:template:manage')
  @ApiOperation({ summary: 'Create a new reusable message template' })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  async createTemplate(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string | null,
    @Body() dto: CreateTemplateDto,
  ) {
    return this.communicationsService.createTemplate(orgId, userId, dto);
  }

  @Get('templates/:id')
  @RequirePermissions('communication:view')
  @ApiOperation({ summary: 'Get template details by ID' })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({ status: 200, description: 'Template details' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async getTemplateById(@CurrentOrgId() orgId: string, @Param('id') id: string) {
    return this.communicationsService.getTemplateById(orgId, id);
  }

  @Put('templates/:id')
  @RequirePermissions('email:template:manage')
  @ApiOperation({ summary: 'Update an existing message template' })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({ status: 200, description: 'Template updated successfully' })
  async updateTemplate(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string | null,
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.communicationsService.updateTemplate(orgId, userId, id, dto);
  }

  @Delete('templates/:id')
  @RequirePermissions('email:template:manage')
  @ApiOperation({ summary: 'Soft delete a message template' })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({ status: 200, description: 'Template deleted successfully' })
  async deleteTemplate(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string | null,
    @Param('id') id: string,
  ) {
    return this.communicationsService.deleteTemplate(orgId, userId, id);
  }

  // =========================================================================
  // OUTBOUND DISPATCH & MESSAGES
  // =========================================================================

  @Post('messages/send')
  @RequirePermissions('email:send')
  @ApiOperation({
    summary:
      'Dispatch an outbound message (Email/WhatsApp) with consent, suppression, and approval checks',
  })
  @ApiResponse({ status: 200, description: 'Message dispatched successfully' })
  @ApiResponse({
    status: 400,
    description: 'Recipient suppressed, consent withdrawn, or approval missing',
  })
  @ApiResponse({ status: 404, description: 'Lead or message not found' })
  async sendMessage(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string | null,
    @Body() dto: SendMessageDto,
  ) {
    return this.communicationsService.sendMessage(orgId, userId, dto);
  }

  @Get('messages')
  @RequirePermissions('communication:view')
  @ApiOperation({ summary: 'List message history with pagination and status filters' })
  @ApiResponse({ status: 200, description: 'Paginated message records' })
  async getMessages(@CurrentOrgId() orgId: string, @Query() query: MessageQueryDto) {
    return this.communicationsService.getMessages(orgId, query);
  }

  @Get('threads/:id')
  @RequirePermissions('communication:view')
  @ApiOperation({ summary: 'Get full email thread with associated messages' })
  @ApiParam({ name: 'id', description: 'Thread UUID' })
  @ApiResponse({ status: 200, description: 'Email thread with message trail' })
  async getThreadById(@CurrentOrgId() orgId: string, @Param('id') id: string) {
    return this.communicationsService.getThreadById(orgId, id);
  }

  // =========================================================================
  // CONSENT & SUPPRESSION ENGINE
  // =========================================================================

  @Post('leads/:leadId/consent')
  @RequirePermissions('communication:view')
  @ApiOperation({ summary: 'Record opt-in or opt-out compliance consent for a lead' })
  @ApiParam({ name: 'leadId', description: 'Lead UUID' })
  @ApiResponse({ status: 201, description: 'Consent recorded' })
  async recordConsent(
    @CurrentOrgId() orgId: string,
    @Param('leadId') leadId: string,
    @Body() dto: RecordConsentDto,
  ) {
    return this.communicationsService.recordConsent(orgId, leadId, dto);
  }

  @Post('suppression')
  @RequirePermissions('communication:manage')
  @ApiOperation({ summary: 'Add an email or phone number to the suppression blacklist' })
  @ApiResponse({ status: 201, description: 'Added to suppression list' })
  async addToSuppression(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string | null,
    @Body() dto: AddSuppressionDto,
  ) {
    return this.communicationsService.addToSuppression(orgId, userId, dto);
  }

  @Get('suppression')
  @RequirePermissions('communication:view')
  @ApiOperation({ summary: 'View suppressed contacts blacklist' })
  @ApiQuery({ name: 'channel', required: false })
  @ApiResponse({ status: 200, description: 'Suppression blacklist entries' })
  async getSuppressionList(@CurrentOrgId() orgId: string, @Query('channel') channel?: string) {
    return this.communicationsService.getSuppressionList(orgId, channel);
  }

  @Delete('suppression/:id')
  @RequirePermissions('communication:manage')
  @ApiOperation({ summary: 'Remove contact from suppression blacklist' })
  @ApiParam({ name: 'id', description: 'Suppression entry UUID' })
  @ApiResponse({ status: 200, description: 'Removed from suppression list' })
  async removeFromSuppression(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string | null,
    @Param('id') id: string,
  ) {
    return this.communicationsService.removeFromSuppression(orgId, userId, id);
  }

  // =========================================================================
  // WHATSAPP CLOUD API WEBHOOKS (PUBLIC)
  // =========================================================================

  @Public()
  @Get('whatsapp/webhook')
  @ApiOperation({ summary: 'WhatsApp Cloud API webhook challenge verification' })
  async verifyWhatsApp(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ) {
    return this.communicationsService.verifyWhatsAppWebhook(mode, token, challenge);
  }

  @Public()
  @Post('whatsapp/webhook')
  @ApiOperation({ summary: 'WhatsApp Cloud API inbound webhook message receiver' })
  async handleWhatsAppInbound(
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() payload: any,
  ) {
    return this.communicationsService.handleWhatsAppInbound(signature, payload);
  }
}
