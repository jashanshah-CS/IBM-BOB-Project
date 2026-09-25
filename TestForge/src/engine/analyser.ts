import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import type { SourceSymbol, ParameterInfo } from '../types.js';

// ---------------------------------------------------------------------------
// Lightweight regex-based analyser.
// For a production tool this would be replaced by a proper TS compiler API
// traversal, but this gives a meaningful, dependency-free baseline.
// ---------------------------------------------------------------------------

const FUNCTION_RE =
  /^export\s+(async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{]+?))?\s*\{/gm;
const ARROW_EXPORT_RE =
  /^export\s+(?:const|let)\s+(\w+)\s*=\s*(async\s+)?\(([^)]*)\)\s*(?::\s*([^=>{]+?))?\s*=>/gm;
const CLASS_RE = /^export\s+(?:abstract\s+)?class\s+(\w+)/gm;
const METHOD_RE =
  /^\s+(?:async\s+)?(public\s+|private\s+|protected\s+)?(?:static\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{]+?))?\s*\{/gm;

function parseParams(raw: string): ParameterInfo[] {
  if (!raw.trim()) return [];
  return raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const [nameTypePart, defaultValue] = p.split('=').map((s) => s.trim());
      const [rawName, type] = (nameTypePart ?? '').split(':').map((s) => s.trim());
      const optional = (rawName ?? '').endsWith('?') || defaultValue !== undefined;
      return {
        name: (rawName ?? '').replace(/\?$/, ''),
        type: type ?? 'unknown',
        optional,
        defaultValue: defaultValue,
      };
    });
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

export async function analyseFile(filePath: string): Promise<SourceSymbol[]> {
  if (extname(filePath) !== '.ts' && extname(filePath) !== '.js') {
    return [];
  }

  const source = await readFile(filePath, 'utf8');
  const symbols: SourceSymbol[] = [];

  // Named exports: functions
  for (const match of source.matchAll(FUNCTION_RE)) {
    symbols.push({
      name: match[2] ?? '',
      kind: 'function',
      filePath,
      lineStart: lineOf(source, match.index ?? 0),
      lineEnd: lineOf(source, (match.index ?? 0) + match[0].length),
      params: parseParams(match[3] ?? ''),
      returnType: (match[4] ?? 'void').trim(),
      isAsync: Boolean(match[1]),
      isExported: true,
    });
  }

  // Arrow-function exports
  for (const match of source.matchAll(ARROW_EXPORT_RE)) {
    symbols.push({
      name: match[1] ?? '',
      kind: 'arrow',
      filePath,
      lineStart: lineOf(source, match.index ?? 0),
      lineEnd: lineOf(source, (match.index ?? 0) + match[0].length),
      params: parseParams(match[3] ?? ''),
      returnType: (match[4] ?? 'unknown').trim(),
      isAsync: Boolean(match[2]),
      isExported: true,
    });
  }

  // Exported classes (just top-level; methods left as exercise)
  for (const match of source.matchAll(CLASS_RE)) {
    symbols.push({
      name: match[1] ?? '',
      kind: 'class',
      filePath,
      lineStart: lineOf(source, match.index ?? 0),
      lineEnd: lineOf(source, (match.index ?? 0) + match[0].length),
      params: [],
      returnType: match[1] ?? '',
      isAsync: false,
      isExported: true,
    });
  }

  // Methods inside classes
  for (const match of source.matchAll(METHOD_RE)) {
    const name = match[2] ?? '';
    // Skip constructor noise and common non-method lines
    if (['if', 'for', 'while', 'switch', 'catch', 'constructor'].includes(name)) continue;
    symbols.push({
      name,
      kind: 'method',
      filePath,
      lineStart: lineOf(source, match.index ?? 0),
      lineEnd: lineOf(source, (match.index ?? 0) + match[0].length),
      params: parseParams(match[3] ?? ''),
      returnType: (match[4] ?? 'void').trim(),
      isAsync: /async/.test(match[0]),
      isExported: false,
    });
  }

  return symbols;
}
