import { describe, it, expect } from 'vitest';
import { parseDocFile } from '../../src/engine/docParser.js';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TMP = join(tmpdir(), 'testforge-docparser-test');

const SAMPLE_MD = `# Introduction

This is the intro paragraph.

## Installation

Run npm install to get started.

## Usage

Call the function with valid arguments.
`;

describe('parseDocFile', () => {
  it('returns empty array for non-markdown files', async () => {
    const sections = await parseDocFile('/some/file.ts');
    expect(sections).toEqual([]);
  });

  it('parses headings and content from markdown', async () => {
    await mkdir(TMP, { recursive: true });
    const file = join(TMP, 'sample.md');
    await writeFile(file, SAMPLE_MD, 'utf8');

    const sections = await parseDocFile(file);
    const headings = sections.map((s) => s.heading);

    expect(headings).toContain('Introduction');
    expect(headings).toContain('Installation');
    expect(headings).toContain('Usage');
  });

  it('captures content text under each heading', async () => {
    await mkdir(TMP, { recursive: true });
    const file = join(TMP, 'sample2.md');
    await writeFile(file, SAMPLE_MD, 'utf8');

    const sections = await parseDocFile(file);
    const install = sections.find((s) => s.heading === 'Installation');
    expect(install?.content).toContain('npm install');
  });

  it('records the source file path on every section', async () => {
    await mkdir(TMP, { recursive: true });
    const file = join(TMP, 'sample3.md');
    await writeFile(file, '# Only one section\n\nSome content.', 'utf8');

    const sections = await parseDocFile(file);
    expect(sections.every((s) => s.filePath === file)).toBe(true);
  });

  it('handles a file with no headings as a single preamble section', async () => {
    await mkdir(TMP, { recursive: true });
    const file = join(TMP, 'noheadings.md');
    await writeFile(file, 'Just plain text.\nNo headings here.', 'utf8');

    const sections = await parseDocFile(file);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.heading).toBe('(preamble)');
  });

  it('cleans up temp files', async () => {
    await rm(TMP, { recursive: true, force: true });
    expect(true).toBe(true); // just ensure cleanup runs
  });
});
