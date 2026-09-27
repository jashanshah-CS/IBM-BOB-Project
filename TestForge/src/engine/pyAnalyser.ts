import { readFile } from 'node:fs/promises';
import type { SourceSymbol, ParameterInfo } from '../types.js';

// ---------------------------------------------------------------------------
// Lightweight regex-based analyser for Python source files (.py).
// Produces SourceSymbol records with types normalised to the shared vocabulary
// used by edgeCases.ts and generator.ts:
//   int / float  → number
//   str          → string
//   bool         → boolean
//   list / List  → <element>[]  (e.g. List[int] → number[])
//   dict / Dict  → object
//   Any          → any
//   None / void  → void
// ---------------------------------------------------------------------------

// Matches top-level (unindented) function definitions, capturing:
//   group 1 — "async " or undefined
//   group 2 — function name
//   group 3 — raw parameter string (everything inside the outer parens)
//   group 4 — return type annotation after "->" (optional)
const TOP_FUNC_RE =
  /^(async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:\n]+?))?\s*:/gm;

// Matches top-level class definitions.
const TOP_CLASS_RE = /^class\s+(\w+)/gm;

// Matches method definitions inside a class (indented with at least one space/tab).
const METHOD_RE =
  /^[ \t]+(async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:\n]+?))?\s*:/gm;

// ---------------------------------------------------------------------------
// Type normalisation
// ---------------------------------------------------------------------------

function normaliseType(raw: string | undefined): string {
  if (!raw) return 'unknown';
  const t = raw.trim();

  // Optional[X] → X (treat as the inner type; optional-ness is on the param)
  const optionalMatch = /^Optional\[(.+)]$/.exec(t);
  if (optionalMatch) return normaliseType(optionalMatch[1]);

  // Union[X, None] / X | None  → treat as optional of X
  const unionNoneMatch = /^Union\[(.+),\s*None]$/.exec(t) ??
                         /^(.+)\s*\|\s*None$/.exec(t) ??
                         /^None\s*\|\s*(.+)$/.exec(t);
  if (unionNoneMatch) return normaliseType(unionNoneMatch[1]);

  // List[X] / list[X]
  const listMatch = /^(?:List|list)\[(.+)]$/.exec(t);
  if (listMatch) return `${normaliseType(listMatch[1])}[]`;

  // Tuple, Set, Sequence → treat as array of the first type arg
  const seqMatch = /^(?:Tuple|Set|Sequence|FrozenSet|tuple|set|frozenset)\[(.+)]$/.exec(t);
  if (seqMatch) {
    const first = seqMatch[1]?.split(',')[0] ?? 'unknown';
    return `${normaliseType(first)}[]`;
  }

  // Dict[K, V] / dict → object
  if (/^(?:Dict|dict)(?:\[.+])?$/.test(t)) return 'object';

  // Primitives
  if (t === 'int' || t === 'float' || t === 'complex') return 'number';
  if (t === 'str') return 'string';
  if (t === 'bool') return 'boolean';
  if (t === 'None') return 'void';
  if (t === 'Any') return 'any';
  if (t === 'list') return 'unknown[]';
  if (t === 'tuple') return 'unknown[]';
  if (t === 'set') return 'unknown[]';
  if (t === 'bytes' || t === 'bytearray') return 'string';

  // Leave class names / generics as-is
  return t;
}

function normaliseReturn(raw: string | undefined): string {
  if (!raw) return 'unknown';
  const n = normaliseType(raw.trim());
  return n === 'unknown' ? 'void' : n;
}

// ---------------------------------------------------------------------------
// Name-based type inference (used when no annotation is present)
// ---------------------------------------------------------------------------

function inferTypeFromName(name: string): string {
  const n = name.toLowerCase();
  if (/arr|array|list|items|values|nums|numbers|elements|data|seq|sequence/.test(n)) return 'number[]';
  if (/target|val|value|key|search|query|num|count|size|index|idx|pos|n$|x$|k$|i$/.test(n)) return 'number';
  if (/name|text|label|msg|message|str|word|char|path|url|email/.test(n)) return 'string';
  if (/flag|is_|has_|enabled|disabled|active|visible/.test(n)) return 'boolean';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Parameter parsing
// ---------------------------------------------------------------------------

function parsePythonParams(raw: string): ParameterInfo[] {
  if (!raw.trim()) return [];

  const params: ParameterInfo[] = [];

  // Split on commas not inside brackets
  const parts = splitTopLevel(raw, ',');

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed === '*' || trimmed === '**kwargs' || trimmed === '*args') continue;

    // Handle **kwargs and *args with type annotations
    const isKwargs = trimmed.startsWith('**');
    const isArgs   = !isKwargs && trimmed.startsWith('*');
    const stripped = trimmed.replace(/^\*{1,2}/, '');

    // Skip `self` and `cls`
    const nameCandidate = stripped.split(':')[0]?.split('=')[0]?.trim() ?? '';
    if (nameCandidate === 'self' || nameCandidate === 'cls') continue;

    // Split name:type=default
    const colonIdx   = stripped.indexOf(':');
    const rawType    = colonIdx >= 0 ? stripped.slice(colonIdx + 1).split('=')[0]?.trim() : undefined;
    const rawDefault = stripped.includes('=') ? stripped.slice(stripped.indexOf('=') + 1).trim() : undefined;
    const name       = colonIdx >= 0 ? stripped.slice(0, colonIdx).trim() : stripped.split('=')[0]?.trim() ?? '';

    const optional = rawDefault !== undefined || isKwargs;
    const normType  = isKwargs ? 'object'
      : isArgs      ? `${normaliseType(rawType)}[]`
      : normaliseType(rawType);

    // When there is no annotation, infer a likely type from the parameter name
    const type = normType !== 'unknown' ? normType : inferTypeFromName(name);

    params.push({
      name,
      type,
      optional,
      defaultValue: rawDefault,
    });
  }

  return params;
}

// ---------------------------------------------------------------------------
// Utility: split a string on a single-char separator, respecting nesting
// ---------------------------------------------------------------------------

function splitTopLevel(value: string, separator: string): string[] {
  const parts: string[] = [];
  let start  = 0;
  let round  = 0;
  let square = 0;
  let curly  = 0;
  let quote  = '';

  for (let i = 0; i < value.length; i++) {
    const ch = value[i] ?? '';
    if (quote) {
      if (ch === quote && value[i - 1] !== '\\') quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '(') round++;
    else if (ch === ')') round--;
    else if (ch === '[') square++;
    else if (ch === ']') square--;
    else if (ch === '{') curly++;
    else if (ch === '}') curly--;
    else if (ch === separator && round === 0 && square === 0 && curly === 0) {
      parts.push(value.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(value.slice(start));
  return parts;
}

// ---------------------------------------------------------------------------
// Line number helper
// ---------------------------------------------------------------------------

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function analysePythonFile(filePath: string): Promise<SourceSymbol[]> {
  const source = await readFile(filePath, 'utf8');
  const symbols: SourceSymbol[] = [];

  // Top-level functions
  for (const match of source.matchAll(TOP_FUNC_RE)) {
    const matchIndex = match.index ?? 0;
    symbols.push({
      name: match[2] ?? '',
      kind: 'function',
      filePath,
      lineStart: lineOf(source, matchIndex),
      lineEnd: lineOf(source, matchIndex + match[0].length),
      params: parsePythonParams(match[3] ?? ''),
      returnType: normaliseReturn(match[4]),
      isAsync: Boolean(match[1]),
      isExported: !( (match[2] ?? '').startsWith('_') ),
    });
  }

  // Top-level classes
  for (const match of source.matchAll(TOP_CLASS_RE)) {
    const matchIndex = match.index ?? 0;
    symbols.push({
      name: match[1] ?? '',
      kind: 'class',
      filePath,
      lineStart: lineOf(source, matchIndex),
      lineEnd: lineOf(source, matchIndex + match[0].length),
      params: [],
      returnType: match[1] ?? '',
      isAsync: false,
      isExported: !( (match[1] ?? '').startsWith('_') ),
    });
  }

  // Methods inside classes
  for (const match of source.matchAll(METHOD_RE)) {
    const name = match[2] ?? '';
    if (['__init__', '__str__', '__repr__', '__eq__', '__hash__'].includes(name)) continue;
    symbols.push({
      name,
      kind: 'method',
      filePath,
      lineStart: lineOf(source, match.index ?? 0),
      lineEnd: lineOf(source, (match.index ?? 0) + match[0].length),
      params: parsePythonParams(match[3] ?? ''),
      returnType: normaliseReturn(match[4]),
      isAsync: Boolean(match[1]),
      isExported: !name.startsWith('_'),
    });
  }

  return symbols;
}
