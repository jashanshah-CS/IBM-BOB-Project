import type { EdgeCase, SourceSymbol, DocSection } from '../types.js';
import { validNumericValue } from './numericInputs.js';

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
    const isCollection = t.includes('[]') || t.includes('array') ||
      t.includes('set') || t.includes('map');

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
    if (t.includes('string') && !isCollection) {
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
    if (t.includes('number') && !isCollection) {
      const decimalValue = validNumericValue(param, true);
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
          inputSuggestion: `${param.name} = ${decimalValue}`,
          expectedBehaviour: param.integerRequired
            ? 'Should reject invalid numeric input when an integer is explicitly required'
            : 'Should accept valid numeric input within the discovered range',
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
    if (isCollection) {
      const oneItem = t.includes('number') ? '1'
        : t.includes('string') ? '"test"'
          : t.includes('boolean') ? 'true' : '{}';
      const returnsUndefinedForEmpty = sym.returnType.toLowerCase().includes('undefined');
      const findsMaximum = t.includes('number') &&
        /(?:find)?(?:largest|max(?:imum)?)/i.test(sym.name) &&
        sym.returnType.toLowerCase().includes('number');
      const removesDuplicates = t.includes('number') &&
        /(?:remove)?duplicates?|unique/i.test(sym.name) &&
        sym.returnType.toLowerCase().includes('number');
      const calculatesStatistics = t.includes('number') &&
        /statistics|stats|summary/i.test(sym.name) &&
        !sym.returnType.toLowerCase().includes('number[]');
      const emptyStatistics = JSON.stringify({
        count: 0, minimum: 0, maximum: 0, sum: 0, average: 0,
        median: 0, positiveCount: 0, negativeCount: 0, zeroCount: 0,
      });
      cases.push(
        {
          symbolName: sym.name,
          category: 'empty',
          description: `Empty collection for "${param.name}"`,
          inputSuggestion: `${param.name} = []`,
          expectedBehaviour: returnsUndefinedForEmpty
            ? 'Should return undefined for an empty collection'
            : 'Should return a sensible default for empty collections',
          expectedResult: returnsUndefinedForEmpty
            ? 'undefined'
            : calculatesStatistics ? emptyStatistics : undefined,
        },
        {
          symbolName: sym.name,
          category: 'boundary',
          description: `Single-element collection for "${param.name}"`,
          inputSuggestion: `${param.name} = [${oneItem}]`,
          expectedBehaviour: 'Should handle single-element collections correctly',
          expectedResult: findsMaximum ? oneItem
            : removesDuplicates ? `[${oneItem}]`
              : calculatesStatistics ? JSON.stringify({
                count: 1, minimum: 1, maximum: 1, sum: 1, average: 1,
                median: 1, positiveCount: 1, negativeCount: 0, zeroCount: 0,
              }) : undefined,
        },
      );
      if (findsMaximum) {
        cases.push(
          {
            symbolName: sym.name,
            category: 'boundary',
            description: `Largest value occurs in the middle of "${param.name}"`,
            inputSuggestion: `${param.name} = [1, 10, 5]`,
            expectedBehaviour: 'Should inspect every array position',
            expectedResult: '10',
          },
          {
            symbolName: sym.name,
            category: 'boundary',
            description: `All values are negative in "${param.name}"`,
            inputSuggestion: `${param.name} = [-10, -2, -5]`,
            expectedBehaviour: 'Should return the greatest negative value',
            expectedResult: '-2',
          },
        );
      }
      if (removesDuplicates) {
        cases.push(
          {
            symbolName: sym.name,
            category: 'boundary',
            description: `Repeated values in "${param.name}"`,
            inputSuggestion: `${param.name} = [1, 2, 2, 3, 1]`,
            expectedBehaviour: 'Should keep one copy of each value in insertion order',
            expectedResult: '[1, 2, 3]',
          },
          {
            symbolName: sym.name,
            category: 'type-coercion',
            description: `Non-finite values in "${param.name}"`,
            inputSuggestion: `${param.name} = [1, NaN, Infinity, 2, -Infinity]`,
            expectedBehaviour: 'Should exclude non-finite values',
            expectedResult: '[1, 2]',
          },
        );
      }
      if (calculatesStatistics) {
        cases.push(
          {
            symbolName: sym.name,
            category: 'boundary',
            description: `Mixed positive, negative, and zero values in "${param.name}"`,
            inputSuggestion: `${param.name} = [5, -2, 0, 3, 10]`,
            expectedBehaviour: 'Should calculate every statistical field',
            expectedResult: JSON.stringify({
              count: 5, minimum: -2, maximum: 10, sum: 16, average: 3.2,
              median: 3, positiveCount: 3, negativeCount: 1, zeroCount: 1,
            }),
          },
          {
            symbolName: sym.name,
            category: 'boundary',
            description: `Even-sized collection in "${param.name}"`,
            inputSuggestion: `${param.name} = [1, 2, 3, 4]`,
            expectedBehaviour: 'Should average the two middle values for the median',
            expectedResult: JSON.stringify({
              count: 4, minimum: 1, maximum: 4, sum: 10, average: 2.5,
              median: 2.5, positiveCount: 4, negativeCount: 0, zeroCount: 0,
            }),
          },
          {
            symbolName: sym.name,
            category: 'type-coercion',
            description: `Non-finite values in "${param.name}"`,
            inputSuggestion: `${param.name} = [1, NaN, Infinity, 3, -Infinity]`,
            expectedBehaviour: 'Should calculate statistics from finite values only',
            expectedResult: JSON.stringify({
              count: 2, minimum: 1, maximum: 3, sum: 4, average: 2,
              median: 2, positiveCount: 2, negativeCount: 0, zeroCount: 0,
            }),
          },
        );
      }
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
