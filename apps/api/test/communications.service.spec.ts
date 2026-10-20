import { CommunicationsService } from '../src/modules/communications/communications.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { encryptAesGcm, decryptAesGcm } from '../src/common/crypto/encryption';
import * as crypto from 'crypto';

describe('CommunicationsService — Omnichannel Messaging & Compliance', () => {
  let commsService: CommunicationsService;
  let mockPrisma: any;
  let mockAuditService: any;
  let mockEmailService: any;
  let mockConfigService: any;

  const orgId = 'org-tenant-123';
  const userId = 'user-sales-456';

  const mockLead = {
    id: 'lead-uuid-1',
    organizationId: orgId,
    fullName: 'Katherine Johnson',
    company: 'NASA Flight Research',
    emailRaw: 'katherine.johnson@nasa.gov',
    emailNormalized: 'katherine.johnson@nasa.gov',
    phoneRaw: '+12025550199',
    phoneNormalized: '+12025550199',
    deletedAt: null,
  };

  beforeEach(() => {
    mockPrisma = {
      client: {
        messageTemplate: {
          create: jest.fn(),
          findFirst: jest.fn(),
          findMany: jest.fn(),
          update: jest.fn(),
        },
        consentRecord: {
          create: jest.fn(),
          findFirst: jest.fn(),
        },
        suppressionEntry: {
          upsert: jest.fn(),
          findUnique: jest.fn(),
          findFirst: jest.fn(),
          findMany: jest.fn(),
          delete: jest.fn(),
        },
        lead: {
          findFirst: jest.fn(),
        },
        message: {
          create: jest.fn(),
          findFirst: jest.fn(),
          update: jest.fn(),
          findMany: jest.fn(),
          count: jest.fn(),
        },
        emailThread: {
          findFirst: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        approvalRequest: {
          create: jest.fn(),
        },
        activity: {
          create: jest.fn().mockResolvedValue({ id: 'act-1' }),
        },
      },
    };

    mockAuditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    mockEmailService = {
      sendEmail: jest.fn().mockResolvedValue({ messageId: 'smtp-msg-1' }),
    };

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'WHATSAPP_ENABLED') return true;
        if (key === 'WHATSAPP_VERIFY_TOKEN') return 'secure_verify_token_123';
        if (key === 'WHATSAPP_APP_SECRET') return 'app_secret_hex_9999';
        return undefined;
      }),
    };

    commsService = new CommunicationsService(
      mockPrisma,
      mockAuditService,
      mockEmailService,
      mockConfigService,
    );
  });

  describe('Template Engine', () => {
    it('creates a message template and automatically extracts variable tags', async () => {
      mockPrisma.client.messageTemplate.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'tmpl-1', ...data }),
      );

      const template = await commsService.createTemplate(orgId, userId, {
        name: 'Executive Followup',
        channel: 'email',
        subject: 'Following up on {{company}} project',
        body: 'Hi {{firstName}}, great speaking today regarding {{company}} requirements.',
      });

      expect(template.variables).toContain('firstName');
      expect(template.variables).toContain('company');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'communication.template.create',
          entityType: 'message_template',
        }),
      );
    });

    it('correctly renders template variables with contextual values', () => {
      const templateBody =
        'Hi {{firstName}}, we analyzed {{company}} and identified {{metric}} increase.';
      const rendered = commsService.renderTemplate(templateBody, {
        firstName: 'Katherine',
        company: 'NASA',
        metric: '35%',
      });

      expect(rendered).toBe('Hi Katherine, we analyzed NASA and identified 35% increase.');
    });
  });

  describe('Consent & Suppression Compliance Engine', () => {
    it('records consent opt-in and withdrawal correctly', async () => {
      mockPrisma.client.lead.findFirst.mockResolvedValue(mockLead);
      mockPrisma.client.consentRecord.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'consent-1', ...data }),
      );

      // Record opt-in
      const optIn = await commsService.recordConsent(orgId, mockLead.id, {
        channel: 'email',
        consentGiven: true,
      });
      expect(optIn.consentGiven).toBe(true);
      expect(optIn.withdrawnAt).toBeNull();

      // Record withdrawal / opt-out
      const optOut = await commsService.recordConsent(orgId, mockLead.id, {
        channel: 'email',
        consentGiven: false,
      });
      expect(optOut.consentGiven).toBe(false);
      expect(optOut.withdrawnAt).toBeInstanceOf(Date);
    });

    it('adds contact to suppression list and checks suppression status', async () => {
      mockPrisma.client.suppressionEntry.upsert.mockResolvedValue({
        id: 'supp-1',
        organizationId: orgId,
        channel: 'email',
        identifier: 'katherine.johnson@nasa.gov',
      });

      await commsService.addToSuppression(orgId, userId, {
        channel: 'email',
        identifier: 'Katherine.Johnson@NASA.gov',
        reason: 'unsubscribe',
      });

      expect(mockPrisma.client.suppressionEntry.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId_channel_identifier: {
              organizationId: orgId,
              channel: 'email',
              identifier: 'katherine.johnson@nasa.gov', // normalized
            },
          }),
        }),
      );
    });
  });

  describe('Outbound Message Dispatch Guard', () => {
    it('rejects sending when recipient is on the suppression blacklist', async () => {
      mockPrisma.client.lead.findFirst.mockResolvedValue(mockLead);
      mockPrisma.client.suppressionEntry.findUnique.mockResolvedValue({ id: 'supp-1' });

      await expect(
        commsService.sendMessage(orgId, userId, {
          leadId: mockLead.id,
          channel: 'email',
          toAddress: mockLead.emailRaw,
          subject: 'Sales Pitch',
          body: 'Hello Katherine',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects sending when recipient has withdrawn consent', async () => {
      mockPrisma.client.lead.findFirst.mockResolvedValue(mockLead);
      mockPrisma.client.suppressionEntry.findUnique.mockResolvedValue(null);
      mockPrisma.client.consentRecord.findFirst.mockResolvedValue({
        consentGiven: false,
        withdrawnAt: new Date(),
      });

      await expect(
        commsService.sendMessage(orgId, userId, {
          leadId: mockLead.id,
          channel: 'email',
          toAddress: mockLead.emailRaw,
          subject: 'Sales Pitch',
          body: 'Hello Katherine',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects dispatch of an unapproved message with 400 BadRequestException', async () => {
      mockPrisma.client.lead.findFirst.mockResolvedValue(mockLead);
      mockPrisma.client.suppressionEntry.findUnique.mockResolvedValue(null);
      mockPrisma.client.consentRecord.findFirst.mockResolvedValue(null);

      // Existing message still in pending_approval
      mockPrisma.client.message.findFirst.mockResolvedValue({
        id: 'msg-unapproved',
        organizationId: orgId,
        status: 'pending_approval',
      });

      await expect(
        commsService.sendMessage(orgId, userId, {
          leadId: mockLead.id,
          messageId: 'msg-unapproved',
          channel: 'email',
          toAddress: mockLead.emailRaw,
          body: 'Draft body',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
    });

    it('successfully dispatches a pre-approved message and records email thread and activity', async () => {
      mockPrisma.client.lead.findFirst.mockResolvedValue(mockLead);
      mockPrisma.client.suppressionEntry.findUnique.mockResolvedValue(null);
      mockPrisma.client.consentRecord.findFirst.mockResolvedValue(null);

      mockPrisma.client.message.findFirst.mockResolvedValue({
        id: 'msg-approved',
        organizationId: orgId,
        status: 'approved', // Pre-approved by sales manager
        threadId: null,
      });

      mockPrisma.client.emailThread.findFirst.mockResolvedValue(null);
      mockPrisma.client.emailThread.create.mockResolvedValue({ id: 'thread-1' });
      mockPrisma.client.message.update.mockResolvedValue({
        id: 'msg-approved',
        status: 'sent',
        sentAt: new Date(),
      });

      const result = await commsService.sendMessage(orgId, userId, {
        leadId: mockLead.id,
        messageId: 'msg-approved',
        channel: 'email',
        toAddress: mockLead.emailRaw,
        subject: 'Final Proposal',
        body: 'Approved proposal content',
      });

      expect(result.status).toBe('sent');
      expect(result.threadId).toBe('thread-1');
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'katherine.johnson@nasa.gov',
          subject: 'Final Proposal',
        }),
      );
      expect(mockPrisma.client.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            activityType: 'email_sent',
          }),
        }),
      );
    });
  });

  describe('WhatsApp Webhook Handlers', () => {
    it('verifies WhatsApp webhook subscription challenge when tokens match', () => {
      const challenge = commsService.verifyWhatsAppWebhook(
        'subscribe',
        'secure_verify_token_123',
        '1155998877',
      );
      expect(challenge).toBe('1155998877');
    });

    it('rejects WhatsApp webhook verification with invalid token', () => {
      expect(() =>
        commsService.verifyWhatsAppWebhook('subscribe', 'invalid_token', '1155998877'),
      ).toThrow(BadRequestException);
    });

    it('ingests inbound WhatsApp message and links it to lead by phone number', async () => {
      mockPrisma.client.lead.findFirst.mockResolvedValue(mockLead);
      mockPrisma.client.message.create.mockResolvedValue({ id: 'msg-inbound-1' });

      const payload = {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      id: 'wamid.HBgLMTIwMjU1NTAxOTk',
                      from: '12025550199',
                      timestamp: '1729350000',
                      text: { body: 'Sounds great, let us talk on Thursday.' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = await commsService.handleWhatsAppInbound(undefined, payload);
      expect(result.received).toBe(true);

      expect(mockPrisma.client.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            direction: 'inbound',
            channel: 'whatsapp',
            bodyPreview: 'Sounds great, let us talk on Thursday.',
            leadId: mockLead.id,
            status: 'delivered',
          }),
        }),
      );
    });
  });

  describe('AES-256-GCM Token Encryption Security', () => {
    it('encrypts and decrypts secret credentials cleanly', () => {
      const secretKey = crypto.randomBytes(32).toString('hex');
      const token = 'ya29.a0AfH6SMD_gmail_super_secret_refresh_token_12345';

      const encrypted = encryptAesGcm(token, secretKey);
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.tag).toBeDefined();
      expect(encrypted.ciphertext).not.toBe(token);

      const decrypted = decryptAesGcm(encrypted, secretKey);
      expect(decrypted).toBe(token);
    });

    it('fails decryption when ciphertext or authentication tag is tampered with', () => {
      const secretKey = crypto.randomBytes(32).toString('hex');
      const token = 'original_token';

      const encrypted = encryptAesGcm(token, secretKey);
      const tampered = { ...encrypted, ciphertext: encrypted.ciphertext.slice(0, -2) + 'aa' };

      expect(() => decryptAesGcm(tampered, secretKey)).toThrow();
    });
  });
});
