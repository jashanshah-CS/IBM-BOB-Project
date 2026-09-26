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
      cases.push(
        {
          symbolName: sym.name,
          category: 'nullish',
          description: `Pass undefined for required param "${param.name}"`,
          inputSuggestion: `${param.name} = undefined`,
          expectedBehaviour: 'Should reject invalid required input',
        },
        {
          symbolName: sym.name,
          category: 'nullish',
          description: `Pass null for required param "${param.name}"`,
          inputSuggestion: `${param.name} = null`,
          expectedBehaviour: 'Should reject invalid required input',
        },
      );
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
        {
          symbolName: sym.name,
          category: 'type-coercion',
          description: `NaN for "${param.name}"`,
          inputSuggestion: `${param.name} = NaN`,
          expectedBehaviour: 'Should reject invalid numeric input',
        },
        {
          symbolName: sym.name,
          category: 'overflow',
          description: `Infinity for "${param.name}"`,
          inputSuggestion: `${param.name} = Infinity`,
          expectedBehaviour: 'Should reject invalid numeric input',
        },
        {
          symbolName: sym.name,
          category: 'overflow',
          description: `Negative infinity for "${param.name}"`,
          inputSuggestion: `${param.name} = -Infinity`,
          expectedBehaviour: 'Should reject invalid numeric input',
        },
        {
          symbolName: sym.name,
          category: 'type-coercion',
          description: `Decimal value for "${param.name}"`,
          inputSuggestion: `${param.name} = 1.5`,
          expectedBehaviour: 'Should reject invalid numeric input when an integer is required',
        },
      );

      for (const constraint of param.numericConstraints ?? []) {
        const { operator, value } = constraint;
        const exactAccepted = operator === '<=' || operator === '>=';
        const belowAccepted = operator === '<' || operator === '<=';
        const aboveAccepted = operator === '>' || operator === '>=';
        const expectation = (accepted: boolean) => accepted
          ? 'Should accept valid boundary input'
          : 'Should reject input outside a documented boundary';
        cases.push(
          {
            symbolName: sym.name,
            category: 'boundary',
            description: `Exact discovered boundary ${value} for "${param.name}"`,
            inputSuggestion: `${param.name} = ${value}`,
            expectedBehaviour: expectation(exactAccepted),
          },
          {
            symbolName: sym.name,
            category: 'boundary',
            description: `Value immediately below discovered boundary ${value} for "${param.name}"`,
            inputSuggestion: `${param.name} = ${value - 1}`,
            expectedBehaviour: expectation(belowAccepted),
          },
          {
            symbolName: sym.name,
            category: 'boundary',
            description: `Value immediately above discovered boundary ${value} for "${param.name}"`,
            inputSuggestion: `${param.name} = ${value + 1}`,
            expectedBehaviour: expectation(aboveAccepted),
          },
        );
      }
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

  return [...new Map(cases.map((testCase) => [
    `${testCase.symbolName}:${testCase.inputSuggestion}`,
    testCase,
  ])).values()];
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
