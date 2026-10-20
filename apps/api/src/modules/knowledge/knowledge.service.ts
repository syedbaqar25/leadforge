import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmbeddingService } from './embedding.service';
import { chunkDocumentText } from './chunking';
import { validateUploadedFile } from '../../common/security/file-validation';
import { DirectTextDocumentDto, SearchKnowledgeDto, AskKnowledgeDto } from './dto';
import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import OpenAI from 'openai';

export interface RetrievedChunkResult {
  id: string;
  documentId: string;
  organizationId: string;
  content: string;
  metadata: any;
  chunkIndex: number;
  documentTitle: string;
  similarity: number;
}

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);
  private readonly uploadDir: string;
  private readonly isAiSandbox: boolean;
  private openai: OpenAI | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly embeddingService: EmbeddingService,
  ) {
    this.uploadDir = path.resolve(process.cwd(), 'uploads', 'documents');
    if (!fs.existsSync(this.uploadDir)) {
      try {
        fs.mkdirSync(this.uploadDir, { recursive: true });
      } catch (err: any) {
        this.logger.warn(`Could not create uploads directory: ${err.message}`);
      }
    }

    const apiKey = process.env.OPENAI_API_KEY;
    this.isAiSandbox =
      !apiKey || apiKey.startsWith('sk-CHANGE_ME') || process.env.NODE_ENV === 'test';
    if (!this.isAiSandbox && apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  // =========================================================================
  // DOCUMENT INGESTION
  // =========================================================================

  /**
   * Ingest text or markdown directly into the knowledge base.
   */
  async createDocumentFromText(orgId: string, userId: string | null, dto: DirectTextDocumentDto) {
    const originalName = dto.title.trim();
    const storageKey = `text-${randomUUID()}.md`;
    const mimeType = dto.mimeType || 'text/markdown';
    const sizeBytes = Buffer.byteLength(dto.content, 'utf8');

    // 1. Create KnowledgeDocument record
    const document = await this.prisma.client.knowledgeDocument.create({
      data: {
        organizationId: orgId,
        filename: storageKey,
        originalName,
        mimeType,
        storageKey,
        sizeBytes,
        status: 'processing',
        uploadedById: userId || orgId,
      },
    });

    try {
      // 2. Chunk document text
      const chunks = chunkDocumentText(dto.content);

      if (chunks.length === 0) {
        throw new BadRequestException('Document contains no extractable text chunks.');
      }

      // 3. Generate embeddings & persist chunks via parameterized SQL
      for (const chunk of chunks) {
        const chunkId = randomUUID();
        const embedding = await this.embeddingService.generateEmbedding(chunk.content);
        const vectorString = `[${embedding.join(',')}]`;

        await this.prisma.client.$executeRaw`
          INSERT INTO "KnowledgeChunk" (
            "id", "documentId", "organizationId", "content", "metadata", "chunkIndex", "embedding", "updatedAt"
          ) VALUES (
            ${chunkId}, ${document.id}, ${orgId}, ${chunk.content}, ${JSON.stringify(chunk.metadata)}::jsonb, ${chunk.chunkIndex}, ${vectorString}::vector, NOW()
          )
        `;
      }

      // 4. Mark document as ready
      const updated = await this.prisma.client.knowledgeDocument.update({
        where: { id: document.id },
        data: { status: 'ready' },
      });

      await this.auditService.log({
        organizationId: orgId,
        userId: userId || undefined,
        action: 'knowledge.document_created',
        entityType: 'knowledge_document',
        entityId: document.id,
        after: { title: originalName, chunksCount: chunks.length, sizeBytes },
      });

      return {
        ...updated,
        chunksCount: chunks.length,
      };
    } catch (err: any) {
      this.logger.error(`Document ingestion failed for ${document.id}: ${err.message}`);
      await this.prisma.client.knowledgeDocument.update({
        where: { id: document.id },
        data: { status: 'failed', error: err.message },
      });
      throw err;
    }
  }

  /**
   * Upload binary or text document with strict security validation.
   */
  async uploadDocument(orgId: string, userId: string | null, file: Express.Multer.File) {
    // 1. Validate file (MIME, extension, size, magic bytes)
    const validated = validateUploadedFile(file);

    // 2. Write file outside web root
    const filePath = path.join(this.uploadDir, validated.sanitizedFilename);
    try {
      fs.writeFileSync(filePath, validated.buffer);
    } catch (err: any) {
      this.logger.warn(`Could not write upload to disk: ${err.message}`);
    }

    // 3. Extract text content
    const textContent = validated.buffer.toString('utf-8');

    // 4. Ingest as document
    return this.createDocumentFromText(orgId, userId, {
      title: validated.originalName,
      content: textContent,
      mimeType: validated.mimeType,
    });
  }

  // =========================================================================
  // DOCUMENT RETRIEVAL & MANAGEMENT
  // =========================================================================

  /**
   * List all documents for the organization.
   */
  async getDocuments(orgId: string) {
    const docs = await this.prisma.client.knowledgeDocument.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { chunks: true },
        },
      },
    });

    return docs.map((d) => ({
      id: d.id,
      title: d.originalName,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      status: d.status,
      error: d.error,
      chunksCount: d._count.chunks,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));
  }

  /**
   * Get single document and its associated chunks.
   */
  async getDocumentById(orgId: string, documentId: string) {
    const doc = await this.prisma.client.knowledgeDocument.findFirst({
      where: { id: documentId, organizationId: orgId },
      include: {
        chunks: {
          select: {
            id: true,
            chunkIndex: true,
            content: true,
            metadata: true,
            createdAt: true,
          },
          orderBy: { chunkIndex: 'asc' },
        },
      },
    });

    if (!doc) {
      throw new NotFoundException({
        code: 'DOCUMENT_NOT_FOUND',
        message: 'Knowledge document not found in your organization.',
      });
    }

    return {
      id: doc.id,
      title: doc.originalName,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      status: doc.status,
      error: doc.error,
      chunksCount: doc.chunks.length,
      chunks: doc.chunks,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  /**
   * Delete a knowledge document and its embeddings.
   */
  async deleteDocument(orgId: string, userId: string | null, documentId: string) {
    const doc = await this.prisma.client.knowledgeDocument.findFirst({
      where: { id: documentId, organizationId: orgId },
    });

    if (!doc) {
      throw new NotFoundException({
        code: 'DOCUMENT_NOT_FOUND',
        message: 'Knowledge document not found in your organization.',
      });
    }

    // Delete database records (chunks cascade onDelete)
    await this.prisma.client.knowledgeDocument.delete({
      where: { id: documentId },
    });

    // Clean up physical file if exists
    try {
      const filePath = path.join(this.uploadDir, doc.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err: any) {
      this.logger.warn(`Could not delete physical file ${doc.filename}: ${err.message}`);
    }

    await this.auditService.log({
      organizationId: orgId,
      userId: userId || undefined,
      action: 'knowledge.document_deleted',
      entityType: 'knowledge_document',
      entityId: documentId,
      before: { title: doc.originalName },
    });

    return { success: true, message: 'Document and embeddings deleted successfully.' };
  }

  // =========================================================================
  // SEMANTIC VECTOR SEARCH WITH PGVECTOR
  // =========================================================================

  /**
   * Search knowledge base using pgvector cosine distance with Prisma parameterized SQL.
   */
  async searchChunks(orgId: string, dto: SearchKnowledgeDto): Promise<RetrievedChunkResult[]> {
    const limit = dto.limit && dto.limit > 0 && dto.limit <= 20 ? dto.limit : 5;
    const minSimilarity = dto.minSimilarity !== undefined ? dto.minSimilarity : 0.3;

    // 1. Generate embedding for query text
    const queryEmbedding = await this.embeddingService.generateEmbedding(dto.query);
    const vectorString = `[${queryEmbedding.join(',')}]`;

    // 2. Query pgvector using parameterized tagged template (strictly scoped by organizationId)
    const rawResults = await this.prisma.client.$queryRaw<RetrievedChunkResult[]>`
      SELECT 
        c."id", 
        c."documentId", 
        c."organizationId", 
        c."content", 
        c."metadata", 
        c."chunkIndex",
        d."originalName" AS "documentTitle",
        (1 - (c."embedding" <=> ${vectorString}::vector)) AS "similarity"
      FROM "KnowledgeChunk" c
      JOIN "KnowledgeDocument" d ON c."documentId" = d."id"
      WHERE c."organizationId" = ${orgId}
        AND c."embedding" IS NOT NULL
        AND (1 - (c."embedding" <=> ${vectorString}::vector)) >= ${minSimilarity}
      ORDER BY c."embedding" <=> ${vectorString}::vector ASC
      LIMIT ${limit}
    `;

    return rawResults || [];
  }

  // =========================================================================
  // GROUNDED AI Q&A WITH SOURCE ATTRIBUTION
  // =========================================================================

  /**
   * Answer a question grounded strictly in retrieved knowledge base chunks.
   */
  async askQuestion(orgId: string, userId: string | null, dto: AskKnowledgeDto) {
    const retrievedChunks = await this.searchChunks(orgId, {
      query: dto.question,
      limit: dto.limit || 5,
      minSimilarity: 0.25,
    });

    // Fallback if no relevant documents or chunks exist
    if (!retrievedChunks || retrievedChunks.length === 0) {
      return {
        answer:
          'I could not find sufficient information in your organization’s knowledge base to answer this question.',
        sources: [],
        isGrounded: false,
      };
    }

    // Build grounded context
    const contextText = retrievedChunks
      .map((c) => `[Document: "${c.documentTitle}" | Chunk #${c.chunkIndex}]\n${c.content}`)
      .join('\n\n---\n\n');

    let answer: string;

    if (this.isAiSandbox || !this.openai) {
      // Deterministic realistic response citing actual retrieved sources
      const topChunk = retrievedChunks[0];
      const sourceCitation = `[Source: ${topChunk?.documentTitle || 'Knowledge Base'}, Chunk #${topChunk?.chunkIndex || 1}]`;
      answer = `Based on our knowledge base documents, here is the verified information regarding your inquiry: ${topChunk?.content.substring(0, 300)}... ${sourceCitation}`;
    } else {
      try {
        const completion = await this.openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-4o',
          messages: [
            {
              role: 'system',
              content:
                'You are Leadforge AI Knowledge Assistant. You answer questions strictly and exclusively using the provided knowledge chunks in <grounded_context>. ' +
                'If the context does not contain enough information to answer with high confidence, state clearly: "The provided knowledge base does not contain this information." ' +
                'Never fabricate product capabilities, pricing, or details. ' +
                'Always cite your sources using the format: [Source: <Document Title>, Chunk #<Index>].',
            },
            {
              role: 'user',
              content: `<grounded_context>\n${contextText}\n</grounded_context>\n\nQuestion: ${dto.question}`,
            },
          ],
          temperature: 0.1,
          max_tokens: 600,
        });

        answer =
          completion.choices[0]?.message.content ||
          'Unable to formulate grounded answer from knowledge base.';
      } catch (err: any) {
        this.logger.warn(
          `OpenAI completion failed: ${err.message}. Using fallback grounded response.`,
        );
        const topChunk = retrievedChunks[0];
        answer = `Based on our documentation: ${topChunk?.content.substring(0, 250)}... [Source: ${topChunk?.documentTitle}, Chunk #${topChunk?.chunkIndex}]`;
      }
    }

    return {
      answer,
      sources: retrievedChunks.map((c) => ({
        documentId: c.documentId,
        documentTitle: c.documentTitle,
        chunkIndex: c.chunkIndex,
        similarity: Number(Number(c.similarity).toFixed(4)),
        snippet: c.content.substring(0, 160),
      })),
      isGrounded: true,
    };
  }
}
