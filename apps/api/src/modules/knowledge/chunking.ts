export interface TextChunk {
  chunkIndex: number;
  content: string;
  metadata: {
    startChar: number;
    endChar: number;
    charCount: number;
  };
}

export interface ChunkingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
}

/**
 * Text chunking engine with overlapping sliding window.
 * Splits text cleanly along paragraph or sentence boundaries where possible.
 */
export function chunkDocumentText(text: string, options?: ChunkingOptions): TextChunk[] {
  const chunkSize = options?.chunkSize ?? 800;
  const chunkOverlap = options?.chunkOverlap ?? 150;

  if (!text || text.trim().length === 0) {
    return [];
  }

  // Normalize newlines and whitespace
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const chunks: TextChunk[] = [];
  let startIndex = 0;
  let chunkIndex = 1;

  while (startIndex < normalizedText.length) {
    let endIndex = startIndex + chunkSize;

    if (endIndex >= normalizedText.length) {
      endIndex = normalizedText.length;
    } else {
      // Find a natural break boundary (paragraph break, line break, or sentence period)
      const lookbackLimit = Math.max(startIndex, endIndex - 150);
      let breakFound = -1;

      // Check for paragraph break
      const paragraphBreak = normalizedText.lastIndexOf('\n\n', endIndex);
      if (paragraphBreak >= lookbackLimit) {
        breakFound = paragraphBreak + 2;
      } else {
        // Check for line break
        const lineBreak = normalizedText.lastIndexOf('\n', endIndex);
        if (lineBreak >= lookbackLimit) {
          breakFound = lineBreak + 1;
        } else {
          // Check for sentence period followed by space
          const sentenceBreak = normalizedText.lastIndexOf('. ', endIndex);
          if (sentenceBreak >= lookbackLimit) {
            breakFound = sentenceBreak + 2;
          }
        }
      }

      if (breakFound > startIndex) {
        endIndex = breakFound;
      }
    }

    const chunkContent = normalizedText.substring(startIndex, endIndex).trim();
    if (chunkContent.length > 0) {
      chunks.push({
        chunkIndex,
        content: chunkContent,
        metadata: {
          startChar: startIndex,
          endChar: endIndex,
          charCount: chunkContent.length,
        },
      });
      chunkIndex++;
    }

    if (endIndex >= normalizedText.length) {
      break;
    }

    // Advance startIndex by chunk length minus overlap
    const step = Math.max(1, endIndex - startIndex - chunkOverlap);
    startIndex += step;
  }

  return chunks;
}
