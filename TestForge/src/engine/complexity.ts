import ts from 'typescript';

export interface ComplexityEstimate {
  time: string;
  space: string;
  cyclomatic: number;
  maintainability: 'low risk' | 'moderate risk' | 'high risk';
  confidence: 'low' | 'medium' | 'high';
  evidence: string[];
  note: string;
}

export function estimateComplexity(code: string): ComplexityEstimate {
  const source = ts.createSourceFile(
    'source.ts',
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let loopDepth = 0;
  let maxLoopDepth = 0;
  let linearOperations = 0;
  let hasSort = false;
  let allocatesCollection = false;
  let cyclomatic = 1;
  let recursiveCalls = 0;
  const binarySearchPattern = /\bwhile\b/.test(code) &&
    /Math\.floor\s*\(/.test(code) && /\/\s*2/.test(code) &&
    /=\s*\w+\s*[+-]\s*1/.test(code);
  const functionNames: string[] = [];
  const evidence = new Set<string>();

  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name) functionNames.push(node.name.text);

    const isLoop = ts.isForStatement(node) || ts.isForInStatement(node) ||
      ts.isForOfStatement(node) || ts.isWhileStatement(node) ||
      ts.isDoStatement(node);
    if (isLoop) {
      loopDepth += 1;
      maxLoopDepth = Math.max(maxLoopDepth, loopDepth);
      cyclomatic += 1;
    }

    if (ts.isIfStatement(node) || ts.isCaseClause(node) ||
        ts.isCatchClause(node) || ts.isConditionalExpression(node)) {
      cyclomatic += 1;
    }
    if (ts.isBinaryExpression(node) && [
      ts.SyntaxKind.AmpersandAmpersandToken,
      ts.SyntaxKind.BarBarToken,
      ts.SyntaxKind.QuestionQuestionToken,
    ].includes(node.operatorToken.kind)) cyclomatic += 1;

    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      if (ts.isPropertyAccessExpression(expression)) {
        const method = expression.name.text;
        if (method === 'sort') hasSort = true;
        if (['map', 'filter', 'reduce', 'forEach', 'some', 'every', 'find', 'findIndex'].includes(method)) {
          linearOperations += 1;
        }
        if (['map', 'filter', 'slice', 'concat', 'flat', 'flatMap'].includes(method)) {
          allocatesCollection = true;
        }
      } else if (ts.isIdentifier(expression) && functionNames.includes(expression.text)) {
        recursiveCalls += 1;
      }
    }

    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) &&
        ['Array', 'Map', 'Set'].includes(node.expression.text)) {
      allocatesCollection = true;
    }
    if (ts.isArrayLiteralExpression(node) || ts.isSpreadElement(node)) {
      allocatesCollection = true;
    }

    ts.forEachChild(node, visit);
    if (isLoop) loopDepth -= 1;
  }
  visit(source);

  let time = 'O(1)';
  let confidence: ComplexityEstimate['confidence'] = 'medium';
  if (recursiveCalls >= 2) {
    time = 'O(2^n)';
    confidence = 'low';
    evidence.add('Multiple apparent self-recursive calls may create exponential growth.');
  } else if (recursiveCalls === 1) {
    time = 'O(n)';
    confidence = 'low';
    evidence.add('An apparent recursive call was found; the estimate assumes the input shrinks each call.');
  } else if (binarySearchPattern && maxLoopDepth === 1) {
    time = 'O(log n)';
    evidence.add('The loop halves a search interval using a midpoint and moves one boundary past it.');
  } else if (maxLoopDepth >= 3) {
    time = `O(n^${maxLoopDepth})`;
    evidence.add(`${maxLoopDepth} nested loops were found.`);
  } else if (maxLoopDepth === 2) {
    time = 'O(n^2)';
    evidence.add('Two nested loops were found.');
  } else if (hasSort) {
    time = 'O(n log n)';
    evidence.add(maxLoopDepth >= 1
      ? 'Sorting and sequential linear passes were found; sorting dominates.'
      : 'A sort operation was found.');
  } else if (maxLoopDepth === 1 || linearOperations > 0) {
    time = 'O(n)';
    evidence.add(maxLoopDepth === 1 ? 'A single loop was found.' : 'A linear array operation was found.');
  } else {
    evidence.add('No loops, sorting, or apparent recursion were found.');
  }

  const space = allocatesCollection || recursiveCalls > 0 ? 'O(n)' : 'O(1)';
  evidence.add(space === 'O(n)'
    ? 'The code allocates a collection or uses recursion.'
    : 'No input-sized collection allocation was detected.');

  const maintainability = cyclomatic > 15
    ? 'high risk'
    : cyclomatic > 8
      ? 'moderate risk'
      : 'low risk';

  return {
    time,
    space,
    cyclomatic,
    maintainability,
    confidence,
    evidence: [...evidence],
    note: 'Heuristic estimate based on visible source syntax. Data sizes, library internals and runtime behaviour can change the real complexity.',
  };
}

export function estimatePythonComplexity(code: string): ComplexityEstimate {
  const lines = code.split(/\r?\n/);
  const loopIndents: number[] = [];
  let maxLoopDepth = 0;
  let cyclomatic = 1;
  let hasSort = false;
  let linearOperations = 0;
  let allocatesCollection = false;
  let recursiveCalls = 0;
  const binarySearchPattern = /\bwhile\b[\s\S]*\/\/\s*2[\s\S]*(?:=\s*\w+\s*\+\s*1|=\s*\w+\s*-\s*1)/.test(code);
  const functionNames: string[] = [];
  const evidence = new Set<string>();

  for (const rawLine of lines) {
    const stripped = rawLine.replace(/#.*$/, '').trim();
    if (!stripped) continue;
    const indent = rawLine.match(/^[ \t]*/)?.[0]
      .replace(/\t/g, '    ').length ?? 0;
    while (loopIndents.length > 0 && indent <= (loopIndents.at(-1) ?? -1)) loopIndents.pop();

    const fn = /^(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/.exec(stripped);
    if (fn?.[1]) functionNames.push(fn[1]);

    if (/^(?:async\s+)?for\b|^while\b/.test(stripped)) {
      loopIndents.push(indent);
      maxLoopDepth = Math.max(maxLoopDepth, loopIndents.length);
      cyclomatic += 1;
    }
    if (/^(?:if|elif|except)\b/.test(stripped) || /\sif\s.+\selse\s/.test(stripped)) {
      cyclomatic += 1;
    }
    cyclomatic += (stripped.match(/\b(?:and|or)\b/g) ?? []).length;
    if (/\bsorted\s*\(|\.sort\s*\(/.test(stripped)) hasSort = true;
    linearOperations += (stripped.match(/\b(?:map|filter|sum|any|all|min|max)\s*\(/g) ?? []).length;
    if (/\[[^\]]*\b(?:for|if)\b[^\]]*\]|\b(?:list|set|dict)\s*\(/.test(stripped)) {
      allocatesCollection = true;
    }
  }

  for (const name of functionNames) {
    const matches = code.match(new RegExp(`\\b${name}\\s*\\(`, 'g'))?.length ?? 0;
    if (matches > 1) recursiveCalls += matches - 1;
  }

  let time = 'O(1)';
  let confidence: ComplexityEstimate['confidence'] = 'medium';
  if (recursiveCalls >= 2) {
    time = 'O(2^n)'; confidence = 'low';
    evidence.add('Multiple apparent self-recursive calls may create exponential growth.');
  } else if (recursiveCalls === 1) {
    time = 'O(n)'; confidence = 'low';
    evidence.add('An apparent recursive call was found; the estimate assumes the input shrinks each call.');
  } else if (binarySearchPattern && maxLoopDepth === 1) {
    time = 'O(log n)';
    evidence.add('The loop halves a search interval using a midpoint and moves one boundary past it.');
  } else if (maxLoopDepth >= 3) {
    time = `O(n^${maxLoopDepth})`; evidence.add(`${maxLoopDepth} nested loops were found.`);
  } else if (maxLoopDepth === 2) {
    time = 'O(n^2)'; evidence.add('Two nested loops were found.');
  } else if (hasSort) {
    time = 'O(n log n)'; evidence.add('A sort operation was found.');
  } else if (maxLoopDepth === 1 || linearOperations > 0) {
    time = 'O(n)'; evidence.add(maxLoopDepth === 1 ? 'A single loop was found.' : 'A linear built-in operation was found.');
  } else {
    evidence.add('No loops, sorting, or apparent recursion were found.');
  }

  const space = allocatesCollection || recursiveCalls > 0 ? 'O(n)' : 'O(1)';
  evidence.add(space === 'O(n)'
    ? 'The code allocates a collection or uses recursion.'
    : 'No input-sized collection allocation was detected.');
  const maintainability = cyclomatic > 15 ? 'high risk' : cyclomatic > 8 ? 'moderate risk' : 'low risk';
  return {
    time, space, cyclomatic, maintainability, confidence, evidence: [...evidence],
    note: 'Heuristic estimate based on visible Python syntax. Data sizes, library internals and runtime behaviour can change the real complexity.',
  };
}
