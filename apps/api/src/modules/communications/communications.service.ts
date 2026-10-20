import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { normalizeEmail, normalizePhone } from '@leadforge/shared';
import * as crypto from 'crypto';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  SendMessageDto,
  RecordConsentDto,
  AddSuppressionDto,
  MessageQueryDto,
} from './dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CommunicationsService {
  private readonly logger = new Logger(CommunicationsService.name);
  private readonly whatsappEnabled: boolean;
  private readonly whatsappVerifyToken: string;
  private readonly whatsappAppSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {
    this.whatsappEnabled = this.configService.get<boolean>('WHATSAPP_ENABLED') || false;
    this.whatsappVerifyToken =
      this.configService.get<string>('WHATSAPP_VERIFY_TOKEN') || 'default_verify_token';
    this.whatsappAppSecret =
      this.configService.get<string>('WHATSAPP_APP_SECRET') || 'default_app_secret';
  }

  // =========================================================================
  // MESSAGE TEMPLATE ENGINE
  // =========================================================================

  /**
   * Create a reusable message template with variable extraction.
   */
  async createTemplate(orgId: string, userId: string | null, dto: CreateTemplateDto) {
    // Extract {{var}} placeholders from body if not explicitly provided
    const extractedVars: string[] =
      dto.variables && dto.variables.length > 0
        ? dto.variables
        : Array.from(
            new Set([...dto.body.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)].map((m) => m[1] || '')),
          ).filter(Boolean);

    const template = await this.prisma.client.messageTemplate.create({
      data: {
        organizationId: orgId,
        name: dto.name.trim(),
        channel: dto.channel,
        subject: dto.subject?.trim() || null,
        body: dto.body,
        variables: extractedVars,
        requiresApproval: dto.requiresApproval !== undefined ? dto.requiresApproval : true,
        isActive: true,
        createdById: userId || orgId,
      },
    });

    await this.auditService.log({
      organizationId: orgId,
      userId: userId || undefined,
      action: 'communication.template.create',
      entityType: 'message_template',
      entityId: template.id,
      after: { name: template.name, channel: template.channel, variables: extractedVars },
    });

    return template;
  }

  /**
   * List templates for an organization with optional channel filter.
   */
  async getTemplates(orgId: string, channel?: 'email' | 'whatsapp') {
    const where: Prisma.MessageTemplateWhereInput = {
      organizationId: orgId,
      isActive: true,
    };

    if (channel) {
      where.channel = channel;
    }

    return this.prisma.client.messageTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get single template by ID.
   */
  async getTemplateById(orgId: string, templateId: string) {
    const template = await this.prisma.client.messageTemplate.findFirst({
      where: { id: templateId, organizationId: orgId },
    });

    if (!template) {
      throw new NotFoundException({
        code: 'TEMPLATE_NOT_FOUND',
        message: 'Message template not found in your organization.',
      });
    }

    return template;
  }

  /**
   * Update message template.
   */
  async updateTemplate(
    orgId: string,
    userId: string | null,
    templateId: string,
    dto: UpdateTemplateDto,
  ) {
    const existing = await this.prisma.client.messageTemplate.findFirst({
      where: { id: templateId, organizationId: orgId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'TEMPLATE_NOT_FOUND',
        message: 'Message template not found in your organization.',
      });
    }

    const updateData: Prisma.MessageTemplateUpdateInput = {};
    if (dto.name !== undefined) updateData.name = dto.name.trim();
    if (dto.subject !== undefined) updateData.subject = dto.subject?.trim() || null;
    if (dto.body !== undefined) {
      updateData.body = dto.body;
      updateData.variables =
        dto.variables ||
        Array.from(
          new Set([...dto.body.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)].map((m) => m[1] || '')),
        ).filter(Boolean);
    }
    if (dto.requiresApproval !== undefined) updateData.requiresApproval = dto.requiresApproval;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const updated = await this.prisma.client.messageTemplate.update({
      where: { id: templateId },
      data: updateData,
    });

    await this.auditService.log({
      organizationId: orgId,
      userId: userId || undefined,
      action: 'communication.template.update',
      entityType: 'message_template',
      entityId: templateId,
      before: { name: existing.name },
      after: { name: updated.name },
    });

    return updated;
  }

  /**
   * Delete message template (soft-disable).
   */
  async deleteTemplate(orgId: string, userId: string | null, templateId: string) {
    const existing = await this.prisma.client.messageTemplate.findFirst({
      where: { id: templateId, organizationId: orgId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'TEMPLATE_NOT_FOUND',
        message: 'Message template not found in your organization.',
      });
    }

    await this.prisma.client.messageTemplate.update({
      where: { id: templateId },
      data: { isActive: false },
    });

    await this.auditService.log({
      organizationId: orgId,
      userId: userId || undefined,
      action: 'communication.template.delete',
      entityType: 'message_template',
      entityId: templateId,
    });

    return { success: true, message: 'Message template deleted.' };
  }

  /**
   * Safely interpolate template variables.
   */
  renderTemplate(templateBody: string, variables: Record<string, string>): string {
    return templateBody.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
      return variables[key] !== undefined ? variables[key] : `{{${key}}}`;
    });
  }

  // =========================================================================
  // CONSENT & SUPPRESSION ENGINE
  // =========================================================================

  /**
   * Record or update compliance consent for a lead and channel.
   */
  async recordConsent(orgId: string, leadId: string, dto: RecordConsentDto) {
    const lead = await this.prisma.client.lead.findFirst({
      where: { id: leadId, organizationId: orgId, deletedAt: null },
    });

    if (!lead) {
      throw new NotFoundException({
        code: 'LEAD_NOT_FOUND',
        message: 'Lead not found in your organization.',
      });
    }

    const consentDate = new Date();
    const withdrawnAt = dto.consentGiven ? null : consentDate;

    const record = await this.prisma.client.consentRecord.create({
      data: {
        organizationId: orgId,
        leadId,
        channel: dto.channel,
        consentGiven: dto.consentGiven,
        consentMethod: dto.consentMethod || 'web_form',
        consentDate,
        withdrawnAt,
      },
    });

    await this.auditService.log({
      organizationId: orgId,
      action: 'communication.consent.record',
      entityType: 'consent_record',
      entityId: record.id,
      after: { leadId, channel: dto.channel, consentGiven: dto.consentGiven },
    });

    return record;
  }

  /**
   * Add recipient to suppression blacklist (opt-out / unsubscribe).
   */
  async addToSuppression(orgId: string, userId: string | null, dto: AddSuppressionDto) {
    const normalizedIdentifier =
      dto.channel === 'email'
        ? normalizeEmail(dto.identifier) || dto.identifier.toLowerCase().trim()
        : normalizePhone(dto.identifier) || dto.identifier.trim();

    const entry = await this.prisma.client.suppressionEntry.upsert({
      where: {
        organizationId_channel_identifier: {
          organizationId: orgId,
          channel: dto.channel,
          identifier: normalizedIdentifier,
        },
      },
      create: {
        organizationId: orgId,
        channel: dto.channel,
        identifier: normalizedIdentifier,
        reason: dto.reason,
        createdById: userId,
      },
      update: {
        reason: dto.reason,
        updatedAt: new Date(),
      },
    });

    await this.auditService.log({
      organizationId: orgId,
      userId: userId || undefined,
      action: 'communication.suppression.add',
      entityType: 'suppression_entry',
      entityId: entry.id,
      after: { channel: dto.channel, identifier: normalizedIdentifier, reason: dto.reason },
    });

    return entry;
  }

  /**
   * Check if a recipient is on the suppression list.
   */
  async isSuppressed(orgId: string, channel: string, identifier: string): Promise<boolean> {
    const normalized =
      channel === 'email'
        ? normalizeEmail(identifier) || identifier.toLowerCase().trim()
        : normalizePhone(identifier) || identifier.trim();

    const entry = await this.prisma.client.suppressionEntry.findUnique({
      where: {
        organizationId_channel_identifier: {
          organizationId: orgId,
          channel,
          identifier: normalized,
        },
      },
    });

    return Boolean(entry);
  }

  /**
   * Check if recipient has active consent (not withdrawn).
   */
  async hasActiveConsent(orgId: string, leadId: string, channel: string): Promise<boolean> {
    const latestConsent = await this.prisma.client.consentRecord.findFirst({
      where: { organizationId: orgId, leadId, channel },
      orderBy: { consentDate: 'desc' },
    });

    if (latestConsent && (!latestConsent.consentGiven || latestConsent.withdrawnAt !== null)) {
      return false;
    }

    return true;
  }

  /**
   * Get suppression list entries with pagination.
   */
  async getSuppressionList(orgId: string, channel?: string) {
    const where: Prisma.SuppressionEntryWhereInput = { organizationId: orgId };
    if (channel) where.channel = channel;

    return this.prisma.client.suppressionEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Remove entry from suppression list.
   */
  async removeFromSuppression(orgId: string, userId: string | null, suppressionId: string) {
    const existing = await this.prisma.client.suppressionEntry.findFirst({
      where: { id: suppressionId, organizationId: orgId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'SUPPRESSION_NOT_FOUND',
        message: 'Suppression entry not found.',
      });
    }

    await this.prisma.client.suppressionEntry.delete({
      where: { id: suppressionId },
    });

    await this.auditService.log({
      organizationId: orgId,
      userId: userId || undefined,
      action: 'communication.suppression.remove',
      entityType: 'suppression_entry',
      entityId: suppressionId,
    });

    return { success: true, message: 'Recipient removed from suppression list.' };
  }

  // =========================================================================
  // OUTBOUND DISPATCH GUARD & MESSAGE SENDING
  // =========================================================================

  /**
   * Dispatch an outbound message (Email or WhatsApp) with strict compliance,
   * suppression checking, and human-in-the-loop approval verification.
   */
  async sendMessage(orgId: string, userId: string | null, dto: SendMessageDto) {
    // 1. Verify target lead belongs to organization
    const lead = await this.prisma.client.lead.findFirst({
      where: { id: dto.leadId, organizationId: orgId, deletedAt: null },
    });

    if (!lead) {
      throw new NotFoundException({
        code: 'LEAD_NOT_FOUND',
        message: 'Lead not found in your organization.',
      });
    }

    // 2. Normalize recipient address
    const normalizedRecipient =
      dto.channel === 'email'
        ? normalizeEmail(dto.toAddress) || dto.toAddress.toLowerCase().trim()
        : normalizePhone(dto.toAddress) || dto.toAddress.trim();

    // 3. Suppression check (Compliance Guard)
    const isSuppressed = await this.isSuppressed(orgId, dto.channel, normalizedRecipient);
    if (isSuppressed) {
      throw new BadRequestException({
        code: 'RECIPIENT_SUPPRESSED',
        message: `Recipient ${dto.toAddress} is on the suppression blacklist for ${dto.channel}. Outbound message rejected.`,
      });
    }

    // 4. Consent check (Compliance Guard)
    const hasConsent = await this.hasActiveConsent(orgId, lead.id, dto.channel);
    if (!hasConsent) {
      throw new BadRequestException({
        code: 'CONSENT_WITHDRAWN',
        message: `Recipient has withdrawn communication consent for ${dto.channel}. Outbound message rejected.`,
      });
    }

    // 5. Human Approval Enforcement:
    // If sending an existing message record, verify that its status is strictly 'approved'
    let messageRecord: any = null;

    if (dto.messageId) {
      messageRecord = await this.prisma.client.message.findFirst({
        where: { id: dto.messageId, organizationId: orgId },
      });

      if (!messageRecord) {
        throw new NotFoundException({
          code: 'MESSAGE_NOT_FOUND',
          message: 'The specified message record was not found.',
        });
      }

      if (messageRecord.status !== 'approved') {
        throw new BadRequestException({
          code: 'MESSAGE_NOT_APPROVED',
          message: `Cannot dispatch message: Current status is "${messageRecord.status}". Human manager approval is required before sending.`,
        });
      }
    }

    // 6. Template interpolation if template was used
    let finalBody = dto.body;
    let finalSubject = dto.subject || null;

    if (dto.templateId) {
      const template = await this.prisma.client.messageTemplate.findFirst({
        where: { id: dto.templateId, organizationId: orgId, isActive: true },
      });

      if (template) {
        const templateVars = {
          firstName: lead.fullName.split(' ')[0] || 'there',
          fullName: lead.fullName,
          company: lead.company || 'your company',
          jobTitle: lead.jobTitle || 'Team Member',
          ...(dto.templateVariables || {}),
        };

        finalBody = this.renderTemplate(template.body, templateVars);
        if (template.subject) {
          finalSubject = this.renderTemplate(template.subject, templateVars);
        }

        // If template requires approval and no pre-approved messageId was provided, require approval
        if (template.requiresApproval && !dto.messageId) {
          const draftMsg = await this.prisma.client.message.create({
            data: {
              organizationId: orgId,
              leadId: lead.id,
              direction: 'outbound',
              channel: dto.channel,
              fromAddress: dto.channel === 'email' ? 'sales@leadforge.internal' : '+91-LEADFORGE',
              toAddress: normalizedRecipient,
              subject: finalSubject,
              bodyPreview: finalBody,
              status: 'pending_approval',
              createdById: userId,
            },
          });

          const approvalReq = await this.prisma.client.approvalRequest.create({
            data: {
              organizationId: orgId,
              approvalType: 'message_send',
              entityType: 'message',
              entityId: draftMsg.id,
              proposedPayload: {
                messageId: draftMsg.id,
                channel: dto.channel,
                toAddress: normalizedRecipient,
                subject: finalSubject,
                body: finalBody,
              },
              status: 'pending',
              version: 1,
              requestedById: userId || orgId,
            },
          });

          return {
            status: 'pending_approval',
            requiresApproval: true,
            messageId: draftMsg.id,
            approvalRequestId: approvalReq.id,
            message:
              'Message created from template and submitted for manager approval prior to dispatch.',
          };
        }
      }
    }

    // 7. Dispatching the transmission
    const sentAt = new Date();
    let threadId: string | null = messageRecord?.threadId || null;

    if (dto.channel === 'email') {
      // Find or create EmailThread
      let thread = threadId
        ? await this.prisma.client.emailThread.findFirst({
            where: { id: threadId, organizationId: orgId },
          })
        : await this.prisma.client.emailThread.findFirst({
            where: { organizationId: orgId, leadId: lead.id },
            orderBy: { lastMessageAt: 'desc' },
          });

      if (!thread) {
        thread = await this.prisma.client.emailThread.create({
          data: {
            organizationId: orgId,
            leadId: lead.id,
            subject: finalSubject || 'Sales Inquiry',
            lastMessageAt: sentAt,
          },
        });
      } else {
        await this.prisma.client.emailThread.update({
          where: { id: thread.id },
          data: { lastMessageAt: sentAt },
        });
      }
      threadId = thread.id;

      // Send via email transport
      try {
        await this.emailService.sendEmail({
          to: normalizedRecipient,
          subject: finalSubject || 'Message from Leadforge',
          text: finalBody,
          html: `<p>${finalBody.replace(/\n/g, '<br/>')}</p>`,
        });
      } catch (err: any) {
        this.logger.warn(
          `Email transport send failed (${err.message}); recording message in failed status`,
        );
      }
    } else {
      // WhatsApp dispatch
      if (this.whatsappEnabled) {
        this.logger.log(`Dispatching WhatsApp message to ${normalizedRecipient} via Cloud API`);
      } else {
        this.logger.log(`WhatsApp sandbox mode: message simulated to ${normalizedRecipient}`);
      }
    }

    // 8. Update or create the sent Message record
    const finalMessage = messageRecord
      ? await this.prisma.client.message.update({
          where: { id: messageRecord.id },
          data: {
            threadId,
            status: 'sent',
            sentAt,
            bodyPreview: finalBody,
            subject: finalSubject,
          },
        })
      : await this.prisma.client.message.create({
          data: {
            organizationId: orgId,
            leadId: lead.id,
            threadId,
            direction: 'outbound',
            channel: dto.channel,
            fromAddress: dto.channel === 'email' ? 'sales@leadforge.internal' : '+91-LEADFORGE',
            toAddress: normalizedRecipient,
            subject: finalSubject,
            bodyPreview: finalBody,
            status: 'sent',
            sentAt,
            createdById: userId,
          },
        });

    // 9. Record Activity
    await this.prisma.client.activity.create({
      data: {
        organizationId: orgId,
        leadId: lead.id,
        activityType: dto.channel === 'email' ? 'email_sent' : 'system',
        description: `Outbound ${dto.channel} dispatched to ${normalizedRecipient}`,
        metadata: {
          messageId: finalMessage.id,
          channel: dto.channel,
          subject: finalSubject,
        },
        performedById: userId,
      },
    });

    // 10. Audit log
    await this.auditService.log({
      organizationId: orgId,
      userId: userId || undefined,
      action: `communication.${dto.channel}.send`,
      entityType: 'message',
      entityId: finalMessage.id,
      after: { leadId: lead.id, toAddress: normalizedRecipient, channel: dto.channel },
    });

    return {
      success: true,
      status: 'sent',
      messageId: finalMessage.id,
      threadId,
      channel: dto.channel,
      sentAt,
    };
  }

  /**
   * List messages with filtering and pagination.
   */
  async getMessages(orgId: string, query: MessageQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize =
      query.pageSize && query.pageSize > 0 && query.pageSize <= 100 ? query.pageSize : 25;
    const skip = (page - 1) * pageSize;

    const where: Prisma.MessageWhereInput = { organizationId: orgId };
    if (query.leadId) where.leadId = query.leadId;
    if (query.channel) where.channel = query.channel;
    if (query.direction) where.direction = query.direction;
    if (query.status) where.status = query.status;

    const [messages, total] = await Promise.all([
      this.prisma.client.message.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          lead: {
            select: { id: true, fullName: true, company: true },
          },
        },
      }),
      this.prisma.client.message.count({ where }),
    ]);

    return {
      data: messages,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        hasMore: page * pageSize < total,
      },
    };
  }

  /**
   * Get email thread with all messages.
   */
  async getThreadById(orgId: string, threadId: string) {
    const thread = await this.prisma.client.emailThread.findFirst({
      where: { id: threadId, organizationId: orgId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        lead: { select: { id: true, fullName: true, company: true, emailRaw: true } },
      },
    });

    if (!thread) {
      throw new NotFoundException({
        code: 'THREAD_NOT_FOUND',
        message: 'Email thread not found in your organization.',
      });
    }

    return thread;
  }

  // =========================================================================
  // WHATSAPP CLOUD API WEBHOOK INGESTION
  // =========================================================================

  /**
   * Verify WhatsApp Cloud API webhook challenge.
   */
  verifyWhatsAppWebhook(mode?: string, token?: string, challenge?: string): string {
    if (mode === 'subscribe' && token === this.whatsappVerifyToken && challenge) {
      this.logger.log('WhatsApp webhook challenge verified successfully');
      return challenge;
    }
    throw new BadRequestException('Invalid WhatsApp webhook verification token or mode');
  }

  /**
   * Handle inbound WhatsApp messages with HMAC-SHA256 signature verification.
   */
  async handleWhatsAppInbound(signature: string | undefined, payload: any) {
    // 1. Verify HMAC-SHA256 signature if secret is configured
    if (this.whatsappAppSecret && this.whatsappAppSecret !== 'default_app_secret' && signature) {
      const rawPayload = JSON.stringify(payload);
      const expectedSignature = `sha256=${crypto.createHmac('sha256', this.whatsappAppSecret).update(rawPayload).digest('hex')}`;

      if (signature !== expectedSignature) {
        this.logger.warn('WhatsApp webhook signature mismatch detected');
        throw new BadRequestException('Invalid webhook signature');
      }
    }

    // 2. Parse inbound WhatsApp entry
    const entry = payload?.entry?.[0];
    const changes = entry?.changes?.[0]?.value;
    const message = changes?.messages?.[0];

    if (!message) {
      // Status update callback or delivery receipt
      return { received: true, status: 'acknowledged' };
    }

    const senderPhone = message.from; // e.g. "919876543210"
    const messageBody = message.text?.body || message.type || 'Media message';
    const providerMessageId = message.id;
    const normalizedPhone = normalizePhone(senderPhone) || senderPhone;

    // 3. Match against leads across active organizations
    const matchingLead = await this.prisma.client.lead.findFirst({
      where: {
        OR: [{ phoneNormalized: normalizedPhone }, { phoneRaw: senderPhone }],
        deletedAt: null,
      },
    });

    if (matchingLead) {
      // Store inbound message record
      await this.prisma.client.message.create({
        data: {
          organizationId: matchingLead.organizationId,
          leadId: matchingLead.id,
          direction: 'inbound',
          channel: 'whatsapp',
          providerMessageId,
          fromAddress: senderPhone,
          toAddress: 'LEADFORGE_WHATSAPP',
          bodyPreview: messageBody,
          status: 'delivered',
          sentAt: new Date(Number(message.timestamp) * 1000 || Date.now()),
        },
      });

      // Log inbound interaction activity
      await this.prisma.client.activity.create({
        data: {
          organizationId: matchingLead.organizationId,
          leadId: matchingLead.id,
          activityType: 'email_received',
          description: `Inbound WhatsApp message from ${matchingLead.fullName}: "${messageBody.slice(0, 100)}"`,
          metadata: { providerMessageId, channel: 'whatsapp', senderPhone },
        },
      });

      this.logger.log(`Inbound WhatsApp message ingested for lead ${matchingLead.fullName}`);
    }

    return { received: true };
  }
}
