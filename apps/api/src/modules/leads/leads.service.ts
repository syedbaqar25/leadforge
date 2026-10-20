import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { normalizeEmail, normalizePhone, type Role } from '@leadforge/shared';
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
import { Prisma } from '@prisma/client';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Create a new lead with normalization, deduplication detection, and activity logging.
   */
  async createLead(orgId: string, userId: string | null, dto: CreateLeadDto) {
    const emailNormalized = normalizeEmail(dto.email);
    const phoneNormalized = normalizePhone(dto.phone);

    // 1. Run deduplication check against active leads in this organization
    let potentialDuplicates: any[] = [];
    if (emailNormalized || phoneNormalized) {
      potentialDuplicates = await this.prisma.client.lead.findMany({
        where: {
          organizationId: orgId,
          deletedAt: null,
          OR: [
            ...(emailNormalized ? [{ emailNormalized }] : []),
            ...(phoneNormalized ? [{ phoneNormalized }] : []),
          ],
        },
      });
    }

    // 2. Create the Lead record
    const lead = await this.prisma.client.lead.create({
      data: {
        organizationId: orgId,
        fullName: dto.fullName.trim(),
        emailRaw: dto.email || null,
        emailNormalized,
        phoneRaw: dto.phone || null,
        phoneNormalized,
        company: dto.company?.trim() || null,
        jobTitle: dto.jobTitle?.trim() || null,
        website: dto.website?.trim() || null,
        location: dto.location?.trim() || null,
        industry: dto.industry?.trim() || null,
        source: dto.source || 'manual',
        campaign: dto.campaign || null,
        budgetAmount: dto.budgetAmount !== undefined ? new Prisma.Decimal(dto.budgetAmount) : null,
        budgetCurrency: dto.budgetCurrency || 'INR',
        requirements: dto.requirements || null,
        purchaseTimeline: dto.purchaseTimeline || null,
        status: 'new',
        priority: dto.priority || 'medium',
        assignedToId: dto.assignedToId || null,
        tags: dto.tags || [],
      },
    });

    // 3. Handle custom fields if provided
    if (dto.customFields && Object.keys(dto.customFields).length > 0) {
      for (const [definitionId, value] of Object.entries(dto.customFields)) {
        if (value) {
          await this.prisma.client.customFieldValue.upsert({
            where: {
              leadId_definitionId: {
                leadId: lead.id,
                definitionId,
              },
            },
            update: { value },
            create: {
              leadId: lead.id,
              definitionId,
              value,
            },
          });
        }
      }
    }

    // 4. Handle tags if provided
    if (dto.tags && dto.tags.length > 0) {
      for (const tagName of dto.tags) {
        const tag = await this.prisma.client.tag.upsert({
          where: {
            organizationId_name: {
              organizationId: orgId,
              name: tagName.trim(),
            },
          },
          update: {},
          create: {
            organizationId: orgId,
            name: tagName.trim(),
          },
        });

        await this.prisma.client.leadTag.upsert({
          where: {
            leadId_tagId: {
              leadId: lead.id,
              tagId: tag.id,
            },
          },
          update: {},
          create: {
            leadId: lead.id,
            tagId: tag.id,
          },
        });
      }
    }

    // 5. If duplicates found, create DuplicateCandidate record
    if (potentialDuplicates.length > 0) {
      const match = potentialDuplicates[0];
      const matchingFields: string[] = [];
      if (emailNormalized && match.emailNormalized === emailNormalized) {
        matchingFields.push('email');
      }
      if (phoneNormalized && match.phoneNormalized === phoneNormalized) {
        matchingFields.push('phone');
      }

      const confidence = matchingFields.length >= 2 ? 0.98 : emailNormalized ? 0.95 : 0.85;

      await this.prisma.client.duplicateCandidate.create({
        data: {
          organizationId: orgId,
          leadAId: match.id,
          leadBId: lead.id,
          confidence,
          matchingFields,
          status: 'pending',
        },
      });
    }

    // 6. Log timeline activity
    await this.prisma.client.activity.create({
      data: {
        organizationId: orgId,
        leadId: lead.id,
        activityType: 'status_change',
        description: `Lead created with status "new"${dto.source ? ` via ${dto.source}` : ''}`,
        performedById: userId,
      },
    });

    return this.getLeadById(orgId, lead.id);
  }

  /**
   * List paginated leads with full filtering, searching, and sorting.
   * Central tenant isolation ensures no cross-organization leakage.
   */
  async getLeads(orgId: string, query: LeadQueryDto) {
    const page = Number(query.page) || 1;
    const pageSize = Math.min(Number(query.pageSize) || 25, 100);
    const skip = (page - 1) * pageSize;

    const where: Prisma.LeadWhereInput = {
      organizationId: orgId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.scoreBand ? { scoreBand: query.scoreBand } : {}),
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              { fullName: { contains: query.q, mode: 'insensitive' } },
              { company: { contains: query.q, mode: 'insensitive' } },
              { emailNormalized: { contains: query.q.toLowerCase() } },
              { phoneNormalized: { contains: query.q } },
            ],
          }
        : {}),
    };

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const [total, leads] = await Promise.all([
      this.prisma.client.lead.count({ where }),
      this.prisma.client.lead.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortBy]: sortOrder },
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          leadTags: {
            include: { tag: true },
          },
          _count: {
            select: { notes: true, activities: true, deals: true, tasks: true },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: leads.map((l: any) => ({
        ...l,
        tags: l.leadTags.map((lt: any) => lt.tag.name),
      })),
      meta: {
        total,
        page,
        pageSize,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  /**
   * Get single lead by ID with complete relations.
   * Throws 404 for cross-tenant IDs to prevent existence enumeration (PART 1.2).
   */
  async getLeadById(orgId: string, leadId: string) {
    const lead = await this.prisma.client.lead.findFirst({
      where: {
        id: leadId,
        organizationId: orgId,
        deletedAt: null,
      },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        leadTags: {
          include: { tag: true },
        },
        customFieldValues: {
          include: { definition: true },
        },
        notes: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        activities: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            performedBy: { select: { id: true, name: true } },
          },
        },
        _count: {
          select: { notes: true, activities: true, deals: true, tasks: true },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException({
        code: 'LEAD_NOT_FOUND',
        message: 'Lead not found.',
      });
    }

    return {
      ...lead,
      tags: lead.leadTags.map((lt: any) => lt.tag.name),
    };
  }

  /**
   * Update lead with state change tracking.
   */
  async updateLead(orgId: string, leadId: string, userId: string, dto: UpdateLeadDto) {
    const existing = await this.prisma.client.lead.findFirst({
      where: { id: leadId, organizationId: orgId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'LEAD_NOT_FOUND',
        message: 'Lead not found.',
      });
    }

    const emailNormalized = dto.email !== undefined ? normalizeEmail(dto.email) : undefined;
    const phoneNormalized = dto.phone !== undefined ? normalizePhone(dto.phone) : undefined;

    // Check status change
    if (dto.status && dto.status !== existing.status) {
      await this.prisma.client.activity.create({
        data: {
          organizationId: orgId,
          leadId,
          activityType: 'status_change',
          description: `Status changed from "${existing.status}" to "${dto.status}"`,
          performedById: userId,
        },
      });
    }

    // Check assignment change
    if (dto.assignedToId !== undefined && dto.assignedToId !== existing.assignedToId) {
      const newAssignee = dto.assignedToId
        ? await this.prisma.client.user.findUnique({ where: { id: dto.assignedToId } })
        : null;

      await this.prisma.client.activity.create({
        data: {
          organizationId: orgId,
          leadId,
          activityType: 'assignment',
          description: newAssignee ? `Lead assigned to ${newAssignee.name}` : 'Lead unassigned',
          performedById: userId,
        },
      });
    }

    const updateData: Prisma.LeadUncheckedUpdateInput = {
      ...(dto.fullName ? { fullName: dto.fullName.trim() } : {}),
      ...(dto.email !== undefined
        ? { emailRaw: dto.email || null, emailNormalized: emailNormalized || null }
        : {}),
      ...(dto.phone !== undefined
        ? { phoneRaw: dto.phone || null, phoneNormalized: phoneNormalized || null }
        : {}),
      ...(dto.company !== undefined ? { company: dto.company } : {}),
      ...(dto.jobTitle !== undefined ? { jobTitle: dto.jobTitle } : {}),
      ...(dto.website !== undefined ? { website: dto.website } : {}),
      ...(dto.location !== undefined ? { location: dto.location } : {}),
      ...(dto.industry !== undefined ? { industry: dto.industry } : {}),
      ...(dto.source !== undefined ? { source: dto.source } : {}),
      ...(dto.campaign !== undefined ? { campaign: dto.campaign } : {}),
      ...(dto.budgetAmount !== undefined
        ? { budgetAmount: dto.budgetAmount !== null ? new Prisma.Decimal(dto.budgetAmount) : null }
        : {}),
      ...(dto.budgetCurrency ? { budgetCurrency: dto.budgetCurrency } : {}),
      ...(dto.requirements !== undefined ? { requirements: dto.requirements } : {}),
      ...(dto.purchaseTimeline !== undefined ? { purchaseTimeline: dto.purchaseTimeline } : {}),
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.priority ? { priority: dto.priority } : {}),
      ...(dto.assignedToId !== undefined ? { assignedToId: dto.assignedToId } : {}),
      ...(dto.tags ? { tags: dto.tags } : {}),
    };

    await this.prisma.client.lead.update({
      where: { id: leadId },
      data: updateData,
    });

    // Update custom fields if provided
    if (dto.customFields && Object.keys(dto.customFields).length > 0) {
      for (const [definitionId, value] of Object.entries(dto.customFields)) {
        await this.prisma.client.customFieldValue.upsert({
          where: {
            leadId_definitionId: {
              leadId,
              definitionId,
            },
          },
          update: { value },
          create: {
            leadId,
            definitionId,
            value,
          },
        });
      }
    }

    return this.getLeadById(orgId, leadId);
  }

  /**
   * Soft delete lead (retaining audit and activity history).
   */
  async deleteLead(orgId: string, leadId: string, userId: string) {
    const existing = await this.prisma.client.lead.findFirst({
      where: { id: leadId, organizationId: orgId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'LEAD_NOT_FOUND',
        message: 'Lead not found.',
      });
    }

    await this.prisma.client.lead.update({
      where: { id: leadId },
      data: { deletedAt: new Date() },
    });

    await this.prisma.client.activity.create({
      data: {
        organizationId: orgId,
        leadId,
        activityType: 'system',
        description: 'Lead soft-deleted',
        performedById: userId,
      },
    });

    return { message: 'Lead deleted successfully.' };
  }

  /**
   * Public lead capture ingestion endpoint.
   */
  async publicSubmitLead(dto: PublicSubmitLeadDto, ipAddress?: string) {
    // 1. Locate organization by slug or ID
    const org = await this.prisma.client.organization.findFirst({
      where: {
        OR: [{ slug: dto.organizationSlug }, { id: dto.organizationSlug }],
      },
    });

    if (!org) {
      throw new NotFoundException({
        code: 'ORG_NOT_FOUND',
        message: 'Organization not found.',
      });
    }

    // 2. Create lead under the organization
    const emailNormalized = normalizeEmail(dto.email);
    const phoneNormalized = normalizePhone(dto.phone);

    const lead = await this.prisma.client.lead.create({
      data: {
        organizationId: org.id,
        fullName: dto.fullName.trim(),
        emailRaw: dto.email || null,
        emailNormalized,
        phoneRaw: dto.phone || null,
        phoneNormalized,
        company: dto.company?.trim() || null,
        requirements: dto.requirements?.trim() || null,
        source: 'website_form',
        status: 'new',
        priority: 'medium',
        tags: ['inbound-web'],
      },
    });

    // 3. Deduplication check
    if (emailNormalized || phoneNormalized) {
      const match = await this.prisma.client.lead.findFirst({
        where: {
          organizationId: org.id,
          id: { not: lead.id },
          deletedAt: null,
          OR: [
            ...(emailNormalized ? [{ emailNormalized }] : []),
            ...(phoneNormalized ? [{ phoneNormalized }] : []),
          ],
        },
      });

      if (match) {
        await this.prisma.client.duplicateCandidate.create({
          data: {
            organizationId: org.id,
            leadAId: match.id,
            leadBId: lead.id,
            confidence: 0.95,
            matchingFields: ['inbound_submission'],
            status: 'pending',
          },
        });
      }
    }

    // 4. Log timeline activity
    await this.prisma.client.activity.create({
      data: {
        organizationId: org.id,
        leadId: lead.id,
        activityType: 'system',
        description: `Inbound lead captured from public web form${ipAddress ? ` [IP: ${ipAddress}]` : ''}`,
      },
    });

    return {
      success: true,
      message: 'Thank you! Your inquiry has been received.',
    };
  }

  /**
   * Add sales note to lead.
   */
  async addNote(orgId: string, leadId: string, userId: string, dto: CreateNoteDto) {
    const lead = await this.prisma.client.lead.findFirst({
      where: { id: leadId, organizationId: orgId, deletedAt: null },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const note = await this.prisma.client.note.create({
      data: {
        organizationId: orgId,
        leadId,
        authorId: userId,
        content: dto.content.trim(),
      },
      include: {
        author: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    await this.prisma.client.activity.create({
      data: {
        organizationId: orgId,
        leadId,
        activityType: 'note',
        description: `Note added: "${dto.content.slice(0, 80)}${dto.content.length > 80 ? '...' : ''}"`,
        performedById: userId,
      },
    });

    return note;
  }

  /**
   * Get all notes for lead.
   */
  async getLeadNotes(orgId: string, leadId: string) {
    const lead = await this.prisma.client.lead.findFirst({
      where: { id: leadId, organizationId: orgId, deletedAt: null },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return this.prisma.client.note.findMany({
      where: { organizationId: orgId, leadId },
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });
  }

  /**
   * Delete sales note. Only author or admin/owner can delete.
   */
  async deleteNote(
    orgId: string,
    leadId: string,
    noteId: string,
    userId: string,
    userRole: string,
  ) {
    const note = await this.prisma.client.note.findFirst({
      where: { id: noteId, leadId, organizationId: orgId },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    if (note.authorId !== userId && userRole !== 'owner' && userRole !== 'admin') {
      throw new ForbiddenException('You do not have permission to delete this note.');
    }

    await this.prisma.client.note.delete({
      where: { id: noteId },
    });

    return { message: 'Note deleted successfully.' };
  }

  /**
   * Get paginated activity timeline for lead.
   */
  async getLeadActivities(orgId: string, leadId: string, page = 1, pageSize = 20) {
    const lead = await this.prisma.client.lead.findFirst({
      where: { id: leadId, organizationId: orgId, deletedAt: null },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const skip = (page - 1) * pageSize;

    const [total, activities] = await Promise.all([
      this.prisma.client.activity.count({
        where: { organizationId: orgId, leadId },
      }),
      this.prisma.client.activity.findMany({
        where: { organizationId: orgId, leadId },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          performedBy: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
      }),
    ]);

    return {
      data: activities,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Custom field definitions CRUD.
   */
  async getCustomFieldDefinitions(orgId: string) {
    return this.prisma.client.customFieldDefinition.findMany({
      where: { organizationId: orgId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createCustomFieldDefinition(orgId: string, dto: CreateCustomFieldDto) {
    return this.prisma.client.customFieldDefinition.create({
      data: {
        organizationId: orgId,
        name: dto.name.trim(),
        fieldType: dto.fieldType,
        options: dto.options ? (dto.options as any) : undefined,
        required: dto.required || false,
        sortOrder: dto.sortOrder || 0,
      },
    });
  }

  /**
   * Tags CRUD.
   */
  async getTags(orgId: string) {
    return this.prisma.client.tag.findMany({
      where: { organizationId: orgId },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { leadTags: true } },
      },
    });
  }

  async createTag(orgId: string, dto: CreateTagDto) {
    return this.prisma.client.tag.create({
      data: {
        organizationId: orgId,
        name: dto.name.trim(),
        color: dto.color || '#D64933',
      },
    });
  }

  /**
   * Duplicate detection candidates.
   */
  async getDuplicateCandidates(orgId: string) {
    return this.prisma.client.duplicateCandidate.findMany({
      where: { organizationId: orgId, status: 'pending' },
      orderBy: { confidence: 'desc' },
      include: {
        leadA: {
          select: {
            id: true,
            fullName: true,
            emailRaw: true,
            phoneRaw: true,
            company: true,
            status: true,
          },
        },
        leadB: {
          select: {
            id: true,
            fullName: true,
            emailRaw: true,
            phoneRaw: true,
            company: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Merge duplicate leads: consolidate activities, notes, and soft-delete duplicate.
   */
  async mergeDuplicates(orgId: string, candidateId: string, userId: string, dto: MergeLeadsDto) {
    const candidate = await this.prisma.client.duplicateCandidate.findFirst({
      where: { id: candidateId, organizationId: orgId },
    });

    if (!candidate) {
      throw new NotFoundException('Duplicate candidate not found');
    }

    const [surviving, duplicate] = await Promise.all([
      this.prisma.client.lead.findFirst({
        where: { id: dto.survivingLeadId, organizationId: orgId, deletedAt: null },
      }),
      this.prisma.client.lead.findFirst({
        where: { id: dto.duplicateLeadId, organizationId: orgId, deletedAt: null },
      }),
    ]);

    if (!surviving || !duplicate) {
      throw new NotFoundException('One or both leads not found');
    }

    await this.prisma.client.$transaction([
      // Move notes
      this.prisma.client.note.updateMany({
        where: { leadId: duplicate.id },
        data: { leadId: surviving.id },
      }),
      // Move activities
      this.prisma.client.activity.updateMany({
        where: { leadId: duplicate.id },
        data: { leadId: surviving.id },
      }),
      // Move tasks
      this.prisma.client.task.updateMany({
        where: { leadId: duplicate.id },
        data: { leadId: surviving.id },
      }),
      // Soft-delete duplicate lead
      this.prisma.client.lead.update({
        where: { id: duplicate.id },
        data: { deletedAt: new Date() },
      }),
      // Mark candidate merged
      this.prisma.client.duplicateCandidate.update({
        where: { id: candidateId },
        data: {
          status: 'merged',
          resolvedById: userId,
          resolvedAt: new Date(),
        },
      }),
      // Log merge activity on surviving lead
      this.prisma.client.activity.create({
        data: {
          organizationId: orgId,
          leadId: surviving.id,
          activityType: 'merge',
          description: `Merged duplicate lead "${duplicate.fullName}" into this record`,
          performedById: userId,
        },
      }),
    ]);

    return {
      message: 'Leads merged successfully.',
      survivingLeadId: surviving.id,
    };
  }

  /**
   * Dismiss duplicate candidate without merging.
   */
  async dismissDuplicate(orgId: string, candidateId: string, userId: string) {
    const candidate = await this.prisma.client.duplicateCandidate.findFirst({
      where: { id: candidateId, organizationId: orgId },
    });

    if (!candidate) {
      throw new NotFoundException('Duplicate candidate not found');
    }

    await this.prisma.client.duplicateCandidate.update({
      where: { id: candidateId },
      data: {
        status: 'dismissed',
        resolvedById: userId,
        resolvedAt: new Date(),
      },
    });

    return { message: 'Duplicate candidate dismissed.' };
  }
}
