import type { EdgeCase, SourceSymbol, DocSection } from '../types.js';

// ---------------------------------------------------------------------------
// Heuristic edge-case discovery.
// Inspects symbol signatures and doc sections to produce EdgeCase records.
// ---------------------------------------------------------------------------

export function discoverEdgeCases(
  symbols: SourceSymbol[],
  docSections: DocSection[] = [],
): EdgeCase[] {
  const cases: EdgeCase[] = [];

  for (const sym of symbols) {
    cases.push(...edgeCasesForSymbol(sym));
  }

  cases.push(...edgeCasesFromDocs(docSections));

  return cases;
}

// ---------------------------------------------------------------------------
// Per-symbol heuristics
// ---------------------------------------------------------------------------

function edgeCasesForSymbol(sym: SourceSymbol): EdgeCase[] {
  const cases: EdgeCase[] = [];

  for (const param of sym.params) {
    const t = param.type.toLowerCase();

    // Nullish inputs
    if (!param.optional) {
      cases.push({
        symbolName: sym.name,
        category: 'nullish',
        description: `Pass null/undefined for required param "${param.name}"`,
        inputSuggestion: `${param.name} = undefined`,
        expectedBehaviour: 'Should throw or return a defined error response',
      });
    }

    // String-specific
    if (t.includes('string')) {
      cases.push(
        {
          symbolName: sym.name,
          category: 'empty',
          description: `Empty string for "${param.name}"`,
          inputSuggestion: `${param.name} = ""`,
          expectedBehaviour: 'Should handle gracefully without crashing',
        },
        {
          symbolName: sym.name,
          category: 'boundary',
          description: `Very long string for "${param.name}"`,
          inputSuggestion: `${param.name} = "a".repeat(10_000)`,
          expectedBehaviour: 'Should not exceed memory limits or hang',
        },
      );
    }

    // Number-specific
    if (t.includes('number')) {
      cases.push(
        {
          symbolName: sym.name,
          category: 'boundary',
          description: `Zero value for "${param.name}"`,
          inputSuggestion: `${param.name} = 0`,
          expectedBehaviour: 'Should handle zero without division errors',
        },
        {
          symbolName: sym.name,
          category: 'overflow',
          description: `Number.MAX_SAFE_INTEGER for "${param.name}"`,
          inputSuggestion: `${param.name} = Number.MAX_SAFE_INTEGER`,
          expectedBehaviour: 'Should not overflow or produce NaN',
        },
        {
          symbolName: sym.name,
          category: 'boundary',
          description: `Negative value for "${param.name}"`,
          inputSuggestion: `${param.name} = -1`,
          expectedBehaviour: 'Should reject or handle negative inputs per spec',
        },
      );
    }

    // Array / collection
    if (t.includes('[]') || t.includes('array') || t.includes('set') || t.includes('map')) {
      cases.push(
        {
          symbolName: sym.name,
          category: 'empty',
          description: `Empty collection for "${param.name}"`,
          inputSuggestion: `${param.name} = []`,
          expectedBehaviour: 'Should return a sensible default for empty collections',
        },
        {
          symbolName: sym.name,
          category: 'boundary',
          description: `Single-element collection for "${param.name}"`,
          inputSuggestion: `${param.name} = [oneItem]`,
          expectedBehaviour: 'Should handle single-element collections correctly',
        },
      );
    }
  }

  // Async functions should have their rejection path tested
  if (sym.isAsync) {
    cases.push({
      symbolName: sym.name,
      category: 'async-error',
      description: `${sym.name} rejects / throws asynchronously`,
      inputSuggestion: 'inject a dependency that rejects',
      expectedBehaviour: 'Caller should receive a rejected promise, not a silent failure',
    });
  }

  return cases;
}

// ---------------------------------------------------------------------------
// Doc-driven edge cases — look for "must", "should not", "error" keywords
// ---------------------------------------------------------------------------

const DOC_TRIGGERS: Array<{ pattern: RegExp; category: EdgeCase['category'] }> = [
  { pattern: /\bmust\b/i, category: 'documented' },
  { pattern: /\bshould not\b/i, category: 'documented' },
  { pattern: /\berror\b/i, category: 'documented' },
  { pattern: /\bthrows?\b/i, category: 'documented' },
  { pattern: /\binvalid\b/i, category: 'documented' },
  { pattern: /\bmaximum\b|\bminimum\b|\blimit\b/i, category: 'boundary' },
  { pattern: /\bnull\b|\bundefined\b/i, category: 'nullish' },
];

function edgeCasesFromDocs(sections: DocSection[]): EdgeCase[] {
  const cases: EdgeCase[] = [];

  for (const section of sections) {
    for (const { pattern, category } of DOC_TRIGGERS) {
      if (pattern.test(section.content)) {
        cases.push({
          symbolName: '(from docs)',
          category,
          description: `Doc section "${section.heading}" mentions constraint: ${pattern}`,
          inputSuggestion: 'derive from documentation context',
          expectedBehaviour: section.content.slice(0, 200),
        });
        break; // one case per section is enough
      }
    }
  }

  return cases;
}
