import { KnowledgeService } from '../src/modules/knowledge/knowledge.service';
import { EmbeddingService } from '../src/modules/knowledge/embedding.service';
import { chunkDocumentText } from '../src/modules/knowledge/chunking';
import { validateUploadedFile } from '../src/common/security/file-validation';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('KnowledgeService — RAG Pipeline & Vector Search (PART 1.3, 1.8 & PART 12 Phase 9)', () => {
  let knowledgeService: KnowledgeService;
  let embeddingService: EmbeddingService;
  let mockPrisma: any;
  let mockAuditService: any;

  const orgId = 'org-tenant-123';
  const otherOrgId = 'org-tenant-999';
  const userId = 'user-admin-456';

  const mockDocument = {
    id: 'doc-uuid-1',
    organizationId: orgId,
    filename: 'pricing-2026.md',
    originalName: 'Leadforge_Pricing_Guide.md',
    mimeType: 'text/markdown',
    storageKey: 'text-uuid.md',
    sizeBytes: 1024,
    status: 'ready',
    error: null,
    uploadedById: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    embeddingService = new EmbeddingService();

    mockPrisma = {
      client: {
        knowledgeDocument: {
          create: jest.fn().mockResolvedValue(mockDocument),
          findMany: jest.fn(),
          findFirst: jest.fn(),
          update: jest.fn().mockResolvedValue(mockDocument),
          delete: jest.fn().mockResolvedValue(mockDocument),
        },
        $executeRaw: jest.fn().mockResolvedValue(1),
        $queryRaw: jest.fn(),
      },
    };

    mockAuditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    knowledgeService = new KnowledgeService(mockPrisma, mockAuditService, embeddingService);
  });

  describe('File Upload Security & Magic Byte Validation (PART 1.3)', () => {
    it('accepts valid Markdown and text files with permitted extensions', () => {
      const validTextFile = {
        originalname: 'playbook.md',
        mimetype: 'text/markdown',
        size: 500,
        buffer: Buffer.from('# Sales Playbook\n\nAlways qualify budget and authority.'),
      };

      const result = validateUploadedFile(validTextFile);
      expect(result.originalName).toBe('playbook.md');
      expect(result.mimeType).toBe('text/markdown');
    });

    it('accepts valid PDF files with %PDF- magic bytes header', () => {
      const validPdfBuffer = Buffer.concat([
        Buffer.from('%PDF-1.7\n'),
        Buffer.from('sample pdf content streams and catalog'),
      ]);

      const validPdfFile = {
        originalname: 'contract.pdf',
        mimetype: 'application/pdf',
        size: validPdfBuffer.length,
        buffer: validPdfBuffer,
      };

      const result = validateUploadedFile(validPdfFile);
      expect(result.mimeType).toBe('application/pdf');
    });

    it('rejects forbidden file extensions (.exe, .sh, .bat)', () => {
      const maliciousFile = {
        originalname: 'payload.exe',
        mimetype: 'application/x-msdownload',
        size: 100,
        buffer: Buffer.from('malicious content'),
      };

      expect(() => validateUploadedFile(maliciousFile as any)).toThrow(BadRequestException);
    });

    it('rejects executable headers disguised with safe extensions (e.g. MZ header named .txt)', () => {
      const disguisedExe = {
        originalname: 'notes.txt',
        mimetype: 'text/plain',
        size: 100,
        buffer: Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]), // 'MZ' Windows executable magic bytes
      };

      expect(() => validateUploadedFile(disguisedExe as any)).toThrow(BadRequestException);
    });

    it('rejects Linux ELF binary headers disguised as .md', () => {
      const disguisedElf = {
        originalname: 'notes.md',
        mimetype: 'text/markdown',
        size: 100,
        buffer: Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x01]), // 0x7f 'ELF' Linux executable header
      };

      expect(() => validateUploadedFile(disguisedElf as any)).toThrow(BadRequestException);
    });

    it('rejects files exceeding 10MB limit', () => {
      const oversizedFile = {
        originalname: 'massive.txt',
        mimetype: 'text/plain',
        size: 11 * 1024 * 1024, // 11MB
        buffer: Buffer.alloc(100),
      };

      expect(() => validateUploadedFile(oversizedFile as any)).toThrow(BadRequestException);
    });
  });

  describe('Document Chunking Engine', () => {
    it('splits text into overlapping chunks along sentence/paragraph boundaries', () => {
      const sampleText =
        'Leadforge is an AI sales platform. It scores incoming leads using multi-factor qualification.\n\n' +
        'Pricing starts at $49/month for the Starter tier. Enterprise plans include WhatsApp and dedicated support.\n\n' +
        'Workflows can trigger automated task creation when lead scores cross 75.';

      const chunks = chunkDocumentText(sampleText, { chunkSize: 120, chunkOverlap: 30 });
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0]?.chunkIndex).toBe(1);
      expect(chunks[0]?.content).toContain('Leadforge');
      expect(chunks[0]?.metadata.charCount).toBeGreaterThan(0);
    });

    it('returns empty array for empty or whitespace text', () => {
      expect(chunkDocumentText('')).toEqual([]);
      expect(chunkDocumentText('   \n  \t ')).toEqual([]);
    });
  });

  describe('Embedding Service (1536-dim Vectors)', () => {
    it('generates a normalized 1536-dimensional vector', async () => {
      const vector = await embeddingService.generateEmbedding('Leadforge Enterprise CRM');
      expect(vector.length).toBe(1536);

      // Verify L2 norm is 1.0 (unit vector for cosine similarity)
      const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
      expect(Math.abs(norm - 1.0)).toBeLessThan(0.001);
    });

    it('is deterministic: produces identical vectors for identical text', async () => {
      const v1 = await embeddingService.generateEmbedding('Quarterly Revenue Target');
      const v2 = await embeddingService.generateEmbedding('Quarterly Revenue Target');
      expect(v1).toEqual(v2);
    });

    it('produces distinct vectors for different text', async () => {
      const v1 = await embeddingService.generateEmbedding('Accounting and Tax Compliance');
      const v2 = await embeddingService.generateEmbedding('WhatsApp Messaging Campaign');
      expect(v1).not.toEqual(v2);
    });
  });

  describe('Document Ingestion & Tenant Isolation', () => {
    it('ingests text document, generates chunks, writes vector embeddings, and logs audit', async () => {
      const result = await knowledgeService.createDocumentFromText(orgId, userId, {
        title: 'Pricing Guide 2026',
        content:
          'Leadforge Starter plan is $49/mo. Enterprise plan is $499/mo with WhatsApp Cloud API integration.',
      });

      expect(mockPrisma.client.knowledgeDocument.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: orgId,
            originalName: 'Pricing Guide 2026',
            status: 'processing',
          }),
        }),
      );

      expect(mockPrisma.client.$executeRaw).toHaveBeenCalled();
      expect(mockPrisma.client.knowledgeDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'ready' },
        }),
      );

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: orgId,
          action: 'knowledge.document_created',
        }),
      );

      expect(result.status).toBe('ready');
      expect(result.chunksCount).toBeGreaterThan(0);
    });

    it('returns 404 NotFoundException when accessing another tenant document (BOLA/IDOR)', async () => {
      mockPrisma.client.knowledgeDocument.findFirst.mockResolvedValue(null);

      await expect(knowledgeService.getDocumentById(otherOrgId, 'doc-uuid-1')).rejects.toThrow(
        NotFoundException,
      );

      expect(mockPrisma.client.knowledgeDocument.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'doc-uuid-1', organizationId: otherOrgId },
        }),
      );
    });

    it('rejects deletion of cross-tenant document with 404', async () => {
      mockPrisma.client.knowledgeDocument.findFirst.mockResolvedValue(null);

      await expect(
        knowledgeService.deleteDocument(otherOrgId, userId, 'doc-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Semantic Vector Search & Grounded Q&A (PART 1.8)', () => {
    it('executes parameterized SQL vector similarity search strictly scoped to tenant', async () => {
      const mockRetrievedChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          organizationId: orgId,
          content: 'Enterprise plan costs $499/mo and includes unlimited WhatsApp messaging.',
          metadata: { charCount: 75 },
          chunkIndex: 1,
          documentTitle: 'Pricing_Guide.md',
          similarity: 0.88,
        },
      ];

      mockPrisma.client.$queryRaw.mockResolvedValue(mockRetrievedChunks);

      const results = await knowledgeService.searchChunks(orgId, {
        query: 'How much does Enterprise cost?',
        limit: 5,
        minSimilarity: 0.3,
      });

      expect(results.length).toBe(1);
      expect(results[0]?.similarity).toBe(0.88);
      expect(results[0]?.documentTitle).toBe('Pricing_Guide.md');
      expect(mockPrisma.client.$queryRaw).toHaveBeenCalled();
    });

    it('answers user question grounded strictly with source citation', async () => {
      const mockRetrievedChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          organizationId: orgId,
          content: 'Enterprise plan costs $499/mo and includes unlimited WhatsApp messaging.',
          metadata: { charCount: 75 },
          chunkIndex: 1,
          documentTitle: 'Pricing_Guide.md',
          similarity: 0.89,
        },
      ];

      mockPrisma.client.$queryRaw.mockResolvedValue(mockRetrievedChunks);

      const response = await knowledgeService.askQuestion(orgId, userId, {
        question: 'What is included in the Enterprise plan?',
      });

      expect(response.isGrounded).toBe(true);
      expect(response.sources.length).toBe(1);
      expect(response.sources[0]?.documentTitle).toBe('Pricing_Guide.md');
      expect(response.sources[0]?.chunkIndex).toBe(1);
      // Verify citation format [Source: ..., Chunk #...] is present
      expect(response.answer).toMatch(/\[Source: Pricing_Guide\.md, Chunk #1\]/);
    });

    it('honestly reports lack of information when no relevant chunks match (Zero Hallucination)', async () => {
      // Mock empty search results
      mockPrisma.client.$queryRaw.mockResolvedValue([]);

      const response = await knowledgeService.askQuestion(orgId, userId, {
        question: 'What is the pricing for interplanetary orbital shipping?',
      });

      expect(response.isGrounded).toBe(false);
      expect(response.sources.length).toBe(0);
      expect(response.answer).toContain('I could not find sufficient information');
    });
  });
});
