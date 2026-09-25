import { describe, it, expect } from 'vitest';
import { analyseFile } from '../../src/engine/analyser.js';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TMP = join(tmpdir(), 'testforge-analyser-test');

const SAMPLE_TS = `
export async function fetchUser(id: string, options?: FetchOptions): Promise<User> {
  // implementation
}

export const formatDate = (date: Date, locale: string): string => {
  return date.toLocaleDateString(locale);
};

export class UserService {
  async getById(id: string): Promise<User | null> {
    return null;
  }
}
`;

describe('analyseFile', () => {
  it('returns empty array for non-TS/JS files', async () => {
    const symbols = await analyseFile('/some/file.json');
    expect(symbols).toEqual([]);
  });

  it('extracts exported async functions', async () => {
    await mkdir(TMP, { recursive: true });
    const file = join(TMP, 'sample.ts');
    await writeFile(file, SAMPLE_TS, 'utf8');

    const symbols = await analyseFile(file);
    const fetchUser = symbols.find((s) => s.name === 'fetchUser');

    expect(fetchUser).toBeDefined();
    expect(fetchUser?.kind).toBe('function');
    expect(fetchUser?.isAsync).toBe(true);
    expect(fetchUser?.isExported).toBe(true);
  });

  it('extracts exported arrow functions', async () => {
    await mkdir(TMP, { recursive: true });
    const file = join(TMP, 'sample2.ts');
    await writeFile(file, SAMPLE_TS, 'utf8');

    const symbols = await analyseFile(file);
    const formatDate = symbols.find((s) => s.name === 'formatDate');

    expect(formatDate).toBeDefined();
    expect(formatDate?.kind).toBe('arrow');
    expect(formatDate?.isAsync).toBe(false);
  });

  it('extracts exported classes', async () => {
    await mkdir(TMP, { recursive: true });
    const file = join(TMP, 'sample3.ts');
    await writeFile(file, SAMPLE_TS, 'utf8');

    const symbols = await analyseFile(file);
    const svc = symbols.find((s) => s.name === 'UserService');

    expect(svc).toBeDefined();
    expect(svc?.kind).toBe('class');
  });

  it('cleans up temp files', async () => {
    await rm(TMP, { recursive: true, force: true });
    expect(true).toBe(true);
  });
});
