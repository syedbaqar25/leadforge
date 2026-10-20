import { LeadsService } from '../src/modules/leads/leads.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('LeadsService — Lead Intelligence, Deduplication & Tenant Isolation (PART 1.2 & PART 3)', () => {
  let leadsService: LeadsService;
  let mockPrisma: any;
  let mockAuditService: any;

  const orgId = 'org-tenant-123';
  const userId = 'user-agent-456';

  const mockExistingLead = {
    id: 'lead-primary-1',
    organizationId: orgId,
    fullName: 'Jane Doe',
    emailRaw: 'jane.doe@example.com',
    emailNormalized: 'jane.doe@example.com',
    phoneRaw: '+91 98765 43210',
    phoneNormalized: '+919876543210',
    company: 'Acme Corp',
    jobTitle: 'VP Technology',
    status: 'new',
    priority: 'medium',
    score: 85,
    scoreBand: 'hot',
    tags: ['enterprise'],
    budgetAmount: new Prisma.Decimal(500000),
    budgetCurrency: 'INR',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    assignedTo: null,
    leadTags: [{ tag: { name: 'enterprise' } }],
    customFieldValues: [],
    notes: [],
    activities: [],
    _count: { notes: 2, activities: 3, deals: 1, tasks: 0 },
  };

  beforeEach(() => {
    mockPrisma = {
      client: {
        lead: {
          findMany: jest.fn(),
          findFirst: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          count: jest.fn(),
        },
        customFieldValue: {
          upsert: jest.fn().mockResolvedValue({ id: 'cfv-1' }),
        },
        tag: {
          upsert: jest.fn().mockResolvedValue({ id: 'tag-1', name: 'enterprise' }),
        },
        leadTag: {
          upsert: jest.fn().mockResolvedValue({ leadId: 'lead-1', tagId: 'tag-1' }),
        },
        duplicateCandidate: {
          findMany: jest.fn(),
          findFirst: jest.fn(),
          create: jest.fn().mockResolvedValue({ id: 'cand-1' }),
          update: jest.fn().mockResolvedValue({ id: 'cand-1', status: 'merged' }),
        },
        activity: {
          create: jest.fn().mockResolvedValue({ id: 'act-1' }),
          count: jest.fn(),
          findMany: jest.fn(),
          updateMany: jest.fn(),
        },
        note: {
          create: jest.fn().mockResolvedValue({ id: 'note-1', content: 'Test note' }),
          findMany: jest.fn(),
          findFirst: jest.fn(),
          delete: jest.fn(),
          updateMany: jest.fn(),
        },
        task: {
          updateMany: jest.fn(),
        },
        user: {
          findUnique: jest.fn().mockResolvedValue({ id: userId, name: 'Agent Smith' }),
        },
        organization: {
          findFirst: jest.fn().mockResolvedValue({ id: orgId, name: 'Acme Org', slug: 'acme-org' }),
        },
        customFieldDefinition: {
          findMany: jest.fn(),
          create: jest.fn(),
        },
        $transaction: jest.fn(async (cbOrArray) => {
          if (typeof cbOrArray === 'function') {
            return cbOrArray(mockPrisma.client);
          }
          return Promise.all(cbOrArray);
        }),
      },
    };

    mockAuditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    leadsService = new LeadsService(mockPrisma, mockAuditService);
  });

  describe('Lead Ingestion & Contact Normalization', () => {
    it('normalizes email (lowercase, trimmed) and phone (removes punctuation) upon creation', async () => {
      mockPrisma.client.lead.findMany.mockResolvedValue([]); // No duplicates
      mockPrisma.client.lead.create.mockResolvedValue({
        id: 'new-lead-id',
        organizationId: orgId,
        fullName: 'Bruce Wayne',
        emailRaw: '  BRUCE.WAYNE@EXAMPLE.COM  ',
        emailNormalized: 'bruce.wayne@example.com',
        phoneRaw: '+1 (555) 019-2834',
        phoneNormalized: '+15550192834',
      });
      mockPrisma.client.lead.findFirst.mockResolvedValue(mockExistingLead);

      await leadsService.createLead(orgId, userId, {
        fullName: 'Bruce Wayne',
        email: '  BRUCE.WAYNE@EXAMPLE.COM  ',
        phone: '+1 (555) 019-2834',
      });

      expect(mockPrisma.client.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            emailNormalized: 'bruce.wayne@example.com',
            phoneNormalized: '+15550192834',
            status: 'new',
            organizationId: orgId,
          }),
        }),
      );

      // Verify activity created
      expect(mockPrisma.client.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            activityType: 'status_change',
            leadId: 'new-lead-id',
          }),
        }),
      );
    });
  });

  describe('Deduplication Detection Engine', () => {
    it('generates a DuplicateCandidate record when matching email or phone exists in the tenant', async () => {
      // Existing lead with same email
      mockPrisma.client.lead.findMany.mockResolvedValue([mockExistingLead]);
      mockPrisma.client.lead.create.mockResolvedValue({
        id: 'duplicate-lead-2',
        organizationId: orgId,
        fullName: 'Jane Doe Junior',
        emailNormalized: 'jane.doe@example.com',
      });
      mockPrisma.client.lead.findFirst.mockResolvedValue(mockExistingLead);

      await leadsService.createLead(orgId, userId, {
        fullName: 'Jane Doe Junior',
        email: 'jane.doe@example.com',
      });

      expect(mockPrisma.client.duplicateCandidate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: orgId,
            leadAId: mockExistingLead.id,
            leadBId: 'duplicate-lead-2',
            confidence: 0.95,
            status: 'pending',
          }),
        }),
      );
    });
  });

  describe('Tenant Scoping & IDOR / BOLA Prevention (PART 1.2)', () => {
    it('returns 404 (NotFoundException) when lead ID does not exist in the caller organization', async () => {
      // Cross-tenant ID query returns null
      mockPrisma.client.lead.findFirst.mockResolvedValue(null);

      await expect(leadsService.getLeadById(orgId, 'foreign-lead-from-other-org')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns 404 when attempting to update a cross-tenant lead', async () => {
      mockPrisma.client.lead.findFirst.mockResolvedValue(null);

      await expect(
        leadsService.updateLead(orgId, 'foreign-lead-from-other-org', userId, {
          company: 'Hacked Corp',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns 404 when attempting to delete a cross-tenant lead', async () => {
      mockPrisma.client.lead.findFirst.mockResolvedValue(null);

      await expect(
        leadsService.deleteLead(orgId, 'foreign-lead-from-other-org', userId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Timeline Activity Tracking on Lead Updates', () => {
    it('automatically records status_change activity when status changes', async () => {
      mockPrisma.client.lead.findFirst.mockResolvedValue(mockExistingLead);
      mockPrisma.client.lead.update.mockResolvedValue({
        ...mockExistingLead,
        status: 'qualified',
      });

      await leadsService.updateLead(orgId, mockExistingLead.id, userId, {
        status: 'qualified',
      });

      expect(mockPrisma.client.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            activityType: 'status_change',
            leadId: mockExistingLead.id,
            description: expect.stringContaining('Status changed from "new" to "qualified"'),
          }),
        }),
      );
    });

    it('automatically records assignment activity when assigned user changes', async () => {
      mockPrisma.client.lead.findFirst.mockResolvedValue(mockExistingLead);
      mockPrisma.client.user.findUnique.mockResolvedValue({ id: 'new-rep-1', name: 'Alice Rep' });
      mockPrisma.client.lead.update.mockResolvedValue({
        ...mockExistingLead,
        assignedToId: 'new-rep-1',
      });

      await leadsService.updateLead(orgId, mockExistingLead.id, userId, {
        assignedToId: 'new-rep-1',
      });

      expect(mockPrisma.client.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            activityType: 'assignment',
            leadId: mockExistingLead.id,
            description: expect.stringContaining('Lead assigned to Alice Rep'),
          }),
        }),
      );
    });
  });

  describe('Lead Merging Workflow', () => {
    it('moves notes, tasks, activities to surviving lead and soft-deletes duplicate lead', async () => {
      const candidate = {
        id: 'cand-123',
        organizationId: orgId,
        leadAId: 'lead-surviving',
        leadBId: 'lead-duplicate',
      };

      const leadSurviving = { id: 'lead-surviving', fullName: 'Surviving Lead' };
      const leadDuplicate = { id: 'lead-duplicate', fullName: 'Duplicate Lead' };

      mockPrisma.client.duplicateCandidate.findFirst.mockResolvedValue(candidate);
      mockPrisma.client.lead.findFirst
        .mockResolvedValueOnce(leadSurviving)
        .mockResolvedValueOnce(leadDuplicate);

      const result = await leadsService.mergeDuplicates(orgId, 'cand-123', userId, {
        survivingLeadId: 'lead-surviving',
        duplicateLeadId: 'lead-duplicate',
      });

      expect(result.survivingLeadId).toBe('lead-surviving');

      // Notes re-pointed
      expect(mockPrisma.client.note.updateMany).toHaveBeenCalledWith({
        where: { leadId: 'lead-duplicate' },
        data: { leadId: 'lead-surviving' },
      });

      // Duplicate soft-deleted
      expect(mockPrisma.client.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead-duplicate' },
        data: { deletedAt: expect.any(Date) },
      });

      // Merge candidate status updated
      expect(mockPrisma.client.duplicateCandidate.update).toHaveBeenCalledWith({
        where: { id: 'cand-123' },
        data: expect.objectContaining({ status: 'merged' }),
      });
    });
  });

  describe('Public Form Ingestion', () => {
    it('creates lead under correct organization slug from public submission', async () => {
      mockPrisma.client.organization.findFirst.mockResolvedValue({
        id: 'org-public-target',
        slug: 'apex-logistics',
      });
      mockPrisma.client.lead.create.mockResolvedValue({
        id: 'lead-public-1',
        organizationId: 'org-public-target',
        fullName: 'Inbound Inquirer',
        source: 'website_form',
      });

      const result = await leadsService.publicSubmitLead({
        organizationSlug: 'apex-logistics',
        fullName: 'Inbound Inquirer',
        email: 'inquirer@example.com',
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.client.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-public-target',
            source: 'website_form',
          }),
        }),
      );
    });
  });
});
