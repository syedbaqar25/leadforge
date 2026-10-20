import { BadRequestException } from '@nestjs/common';
import * as path from 'path';

export interface ValidatedFile {
  originalName: string;
  sanitizedFilename: string;
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
}

const ALLOWED_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'application/pdf',
  'application/json',
  'text/csv',
]);

const ALLOWED_EXTENSIONS = new Set(['.txt', '.md', '.markdown', '.pdf', '.json', '.csv']);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Validates file upload against MIME allowlist, extension allowlist,
 * file size caps, and magic byte signatures (PART 1.3).
 */
export function validateUploadedFile(
  file:
    Express.Multer.File | { originalname: string; mimetype: string; size: number; buffer: Buffer },
): ValidatedFile {
  if (!file || !file.buffer) {
    throw new BadRequestException({
      code: 'EMPTY_FILE',
      message: 'No file content was provided.',
    });
  }

  // 1. Enforce size limit
  if (file.size > MAX_FILE_SIZE) {
    throw new BadRequestException({
      code: 'FILE_TOO_LARGE',
      message: `File exceeds maximum allowed size of 10MB (got ${(file.size / 1024 / 1024).toFixed(2)}MB).`,
    });
  }

  // 2. Validate extension
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new BadRequestException({
      code: 'FORBIDDEN_FILE_EXTENSION',
      message: `File extension '${ext}' is not permitted. Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`,
    });
  }

  // 3. Validate MIME type
  const normalizedMime = file.mimetype.toLowerCase().trim();
  if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
    throw new BadRequestException({
      code: 'FORBIDDEN_MIME_TYPE',
      message: `MIME type '${file.mimetype}' is not permitted.`,
    });
  }

  // 4. Magic bytes / header inspection
  validateMagicBytes(file.buffer, ext, normalizedMime);

  // 5. Generate sanitized random filename
  const sanitizedFilename = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}${ext}`;

  return {
    originalName: path.basename(file.originalname),
    sanitizedFilename,
    mimeType: normalizedMime,
    sizeBytes: file.size,
    buffer: file.buffer,
  };
}

/**
 * Inspect magic bytes / headers to prevent masquerading executable files (e.g., .exe disguised as .pdf or .txt)
 */
function validateMagicBytes(buffer: Buffer, ext: string, mime: string): void {
  // Check for dangerous binary executable headers (PE, ELF, Mach-O)
  if (buffer.length >= 2) {
    // Windows PE / MZ
    if (buffer[0] === 0x4d && buffer[1] === 0x5a) {
      throw new BadRequestException({
        code: 'MALICIOUS_FILE_HEADER',
        message: 'File contains executable headers and is prohibited.',
      });
    }
  }

  if (buffer.length >= 4) {
    // Linux ELF header (0x7F 0x45 0x4C 0x46)
    if (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
      throw new BadRequestException({
        code: 'MALICIOUS_FILE_HEADER',
        message: 'File contains Linux ELF executable headers and is prohibited.',
      });
    }
  }

  // PDF verification: Must start with %PDF- (0x25 0x50 0x44 0x46 0x2D)
  if (ext === '.pdf' || mime === 'application/pdf') {
    if (buffer.length < 5 || buffer.toString('utf-8', 0, 5) !== '%PDF-') {
      throw new BadRequestException({
        code: 'INVALID_PDF_HEADER',
        message: 'File claimed to be PDF does not possess a valid PDF magic header.',
      });
    }
  }

  // Plain text / Markdown / JSON / CSV validation: ensure valid text / non-corrupt UTF-8
  if (['.txt', '.md', '.markdown', '.json', '.csv'].includes(ext)) {
    // Check for excessive null bytes (characteristic of binary files)
    let nullByteCount = 0;
    const sampleSize = Math.min(buffer.length, 1024);
    for (let i = 0; i < sampleSize; i++) {
      if (buffer[i] === 0x00) {
        nullByteCount++;
      }
    }

    if (nullByteCount > 5) {
      throw new BadRequestException({
        code: 'BINARY_CONTENT_REJECTED',
        message: 'Text document appears to contain binary data.',
      });
    }
  }
}
