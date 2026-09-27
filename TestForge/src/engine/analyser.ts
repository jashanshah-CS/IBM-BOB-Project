import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import type { SourceSymbol, ParameterInfo } from '../types.js';
import { analysePythonFile } from './pyAnalyser.js';

// ---------------------------------------------------------------------------
// Lightweight regex-based analyser.
// For a production tool this would be replaced by a proper TS compiler API
// traversal, but this gives a meaningful, dependency-free baseline.
// ---------------------------------------------------------------------------

const FUNCTION_RE =
  /^[ \t]*export\s+(async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{]+?))?\s*\{/gm;
const ARROW_EXPORT_RE =
  /^[ \t]*export\s+(?:const|let)\s+(\w+)\s*=\s*(async\s+)?\(([^)]*)\)\s*(?::\s*([^=>{]+?))?\s*=>/gm;
const CLASS_RE = /^[ \t]*export\s+(?:abstract\s+)?class\s+(\w+)/gm;
const METHOD_RE =
  /^\s+(?:async\s+)?(public\s+|private\s+|protected\s+)?(?:static\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{]+?))?\s*\{/gm;

function parseParams(raw: string): ParameterInfo[] {
  if (!raw.trim()) return [];
  return splitTopLevel(raw, ',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const [nameTypePart, defaultValue] = splitTopLevel(p, '=').map((s) => s.trim());
      const [rawName, ...typeParts] = splitTopLevel(nameTypePart ?? '', ':').map((s) => s.trim());
      const type = typeParts.join(':');
      const optional = (rawName ?? '').endsWith('?') || defaultValue !== undefined;
      return {
        name: (rawName ?? '').replace(/\?$/, ''),
        type: type ?? 'unknown',
        optional,
        defaultValue: defaultValue,
      };
    });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitTopLevel(value: string, separator: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let round = 0;
  let square = 0;
  let curly = 0;
  let angle = 0;
  let quote = '';
  for (let index = 0; index < value.length; index++) {
    const char = value[index] ?? '';
    if (quote) {
      if (char === quote && value[index - 1] !== '\\') quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '(') round++;
    else if (char === ')') round--;
    else if (char === '[') square++;
    else if (char === ']') square--;
    else if (char === '{') curly++;
    else if (char === '}') curly--;
    else if (char === '<') angle++;
    else if (char === '>') angle = Math.max(0, angle - 1);
    else if (char === separator && round === 0 && square === 0 && curly === 0 && angle === 0) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(value.slice(start));
  return parts;
}

function blockScope(source: string, openingBrace: number): string {
  if (openingBrace < 0 || source[openingBrace] !== '{') return source;
  let depth = 0;
  for (let index = openingBrace; index < source.length; index++) {
    if (source[index] === '{') depth++;
    if (source[index] === '}') {
      depth--;
      if (depth === 0) return source.slice(openingBrace, index + 1);
    }
  }
  return source.slice(openingBrace);
}

function scopeForMatch(source: string, index: number, header: string): string {
  const braceInHeader = header.lastIndexOf('{');
  if (braceInHeader >= 0) return blockScope(source, index + braceInHeader);
  const bodyStart = source.indexOf('{', index + header.length);
  const lineEnd = source.indexOf('\n', index + header.length);
  if (bodyStart >= 0 && (lineEnd < 0 || bodyStart < lineEnd)) {
    return blockScope(source, bodyStart);
  }
  return source.slice(index, lineEnd < 0 ? source.length : lineEnd);
}

function parseParamsWithBoundaries(raw: string, source: string): ParameterInfo[] {
  const parsedParams = parseParams(raw);
  const numericParamCount = parsedParams.filter((param) =>
    /(^|\|)\s*number\s*(\||$)/i.test(param.type),
  ).length;
  return parsedParams.map((param) => {
    if (!param.type.toLowerCase().includes('number')) return param;
    const name = escapeRegExp(param.name);
    const pattern = new RegExp(`\\b${name}\\s*(<=|>=|<|>)\\s*(-?\\d+(?:\\.\\d+)?)`, 'g');
    const constraints = [...source.matchAll(pattern)]
      .map((match) => ({
        operator: match[1] as '<' | '<=' | '>' | '>=',
        value: Number(match[2]),
      }))
      .filter((constraint) => Number.isFinite(constraint.value));
    const integerPattern = new RegExp(`\\bNumber\\.isInteger\\s*\\(\\s*${name}\\s*\\)`);
    const integerRequirementInComment = source.split(/\r?\n/).some((line) =>
      /\b(?:decimals?|fractional|whole[- ]?numbers?|integers?)\b/i.test(line) &&
      /\b(?:invalid|reject|not allowed|incorrect|bug|must)\b/i.test(line) &&
      (numericParamCount === 1 || new RegExp(`\\b${name}\\b`, 'i').test(line)),
    );
    return {
      ...param,
      integerRequired: integerPattern.test(source) || integerRequirementInComment,
      numericConstraints: constraints,
    };
  });
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

export async function analyseFile(filePath: string): Promise<SourceSymbol[]> {
  const ext = extname(filePath);
  if (ext === '.py') {
    return analysePythonFile(filePath);
  }
  if (ext !== '.ts' && ext !== '.js') {
    return [];
  }

  const source = await readFile(filePath, 'utf8');
  const symbols: SourceSymbol[] = [];

  // Named exports: functions
  for (const match of source.matchAll(FUNCTION_RE)) {
    const matchIndex = match.index ?? 0;
    const scope = scopeForMatch(source, matchIndex, match[0]);
    symbols.push({
      name: match[2] ?? '',
      kind: 'function',
      filePath,
      lineStart: lineOf(source, matchIndex),
      lineEnd: lineOf(source, matchIndex + scope.length),
      params: parseParamsWithBoundaries(match[3] ?? '', scope),
      returnType: (match[4] ?? 'void').trim(),
      isAsync: Boolean(match[1]),
      isExported: true,
    });
  }

  // Arrow-function exports
  for (const match of source.matchAll(ARROW_EXPORT_RE)) {
    const matchIndex = match.index ?? 0;
    const scope = scopeForMatch(source, matchIndex, match[0]);
    symbols.push({
      name: match[1] ?? '',
      kind: 'arrow',
      filePath,
      lineStart: lineOf(source, match.index ?? 0),
      lineEnd: lineOf(source, (match.index ?? 0) + match[0].length),
      params: parseParamsWithBoundaries(match[3] ?? '', scope),
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
      params: parseParamsWithBoundaries(
        match[3] ?? '',
        scopeForMatch(source, match.index ?? 0, match[0]),
      ),
      returnType: (match[4] ?? 'void').trim(),
      isAsync: /async/.test(match[0]),
      isExported: false,
    });
  }

  return symbols;
}
