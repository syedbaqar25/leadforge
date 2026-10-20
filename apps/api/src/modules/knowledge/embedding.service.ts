import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import * as crypto from 'crypto';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private openai: OpenAI | null = null;
  private readonly isSandbox: boolean;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    const isPlaceholder = !apiKey || apiKey.startsWith('sk-CHANGE_ME');

    if (isPlaceholder || process.env.NODE_ENV === 'test') {
      this.isSandbox = true;
      this.logger.log(
        'EmbeddingService initialized in deterministic Sandbox mode (1536-dim vectors)',
      );
    } else {
      this.isSandbox = false;
      this.openai = new OpenAI({ apiKey });
      this.logger.log('EmbeddingService initialized with live OpenAI text-embedding-3-small');
    }
  }

  /**
   * Generates a 1536-dimensional vector embedding for the given input text.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      return this.generateZeroVector(1536);
    }

    if (this.isSandbox || !this.openai) {
      return this.generateDeterministicVector(text, 1536);
    }

    try {
      const response = await this.openai.embeddings.create({
        model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
        input: text.substring(0, 8000), // Max safe token window for embeddings
      });

      const embedding = response.data[0]?.embedding;
      if (!embedding || embedding.length === 0) {
        throw new Error('Empty embedding received from OpenAI');
      }

      return embedding;
    } catch (err: any) {
      this.logger.warn(
        `OpenAI embedding failed (${err.message}). Falling back to deterministic embedding.`,
      );
      return this.generateDeterministicVector(text, 1536);
    }
  }

  /**
   * Deterministic unit-normalized 1536-dimensional vector for sandbox/test environments.
   * Produces reproducible vector outputs with word-seeded coordinate clusters.
   */
  generateDeterministicVector(text: string, dimensions = 1536): number[] {
    const vector = new Array<number>(dimensions).fill(0);
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(Boolean);

    for (let i = 0; i < dimensions; i++) {
      // Base pseudo-random float from hash of text + dimension index
      const hash = crypto.createHash('sha256').update(`${text}:${i}`).digest();
      const val = hash.readInt16LE(0) / 32768.0; // Range [-1.0, 1.0]
      vector[i] = val;
    }

    // Boost coordinates based on individual words to make keyword similarity realistic
    for (const word of words) {
      const wordHash = crypto.createHash('md5').update(word).digest();
      const coordIndex = Math.abs(wordHash.readInt32LE(0)) % dimensions;
      vector[coordIndex] = (vector[coordIndex] ?? 0) + 1.5;
    }

    // Normalize to unit length (L2 norm = 1.0) for accurate cosine similarity
    let sumSq = 0;
    for (let i = 0; i < dimensions; i++) {
      const val = vector[i] ?? 0;
      sumSq += val * val;
    }

    const norm = Math.sqrt(sumSq) || 1.0;
    for (let i = 0; i < dimensions; i++) {
      vector[i] = (vector[i] ?? 0) / norm;
    }

    return vector;
  }

  private generateZeroVector(dimensions: number): number[] {
    return new Array(dimensions).fill(0);
  }
}
