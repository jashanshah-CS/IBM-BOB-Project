import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import type { DocSection } from '../types.js';

// ---------------------------------------------------------------------------
// Parses Markdown files and splits them into heading-scoped sections.
// ---------------------------------------------------------------------------

export async function parseDocFile(filePath: string): Promise<DocSection[]> {
  const ext = extname(filePath).toLowerCase();
  if (ext !== '.md' && ext !== '.mdx' && ext !== '.txt') {
    return [];
  }

  const raw = await readFile(filePath, 'utf8');
  const lines = raw.split('\n');
  const sections: DocSection[] = [];

  let currentHeading = '(preamble)';
  let currentStart = 0;
  let buffer: string[] = [];

  const flush = (endLine: number) => {
    const content = buffer.join('\n').trim();
    if (content) {
      sections.push({
        heading: currentHeading,
        content,
        filePath,
        lineStart: currentStart,
      });
    }
    buffer = [];
    currentStart = endLine + 1;
  };

  lines.forEach((line, idx) => {
    const headingMatch = /^#{1,6}\s+(.+)/.exec(line);
    if (headingMatch) {
      flush(idx - 1);
      currentHeading = headingMatch[1].trim();
    } else {
      buffer.push(line);
    }
  });
  flush(lines.length - 1);

  return sections;
}
