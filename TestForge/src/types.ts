export interface SourceSymbol {
  name: string;
  kind: 'function' | 'class' | 'method' | 'arrow';
  filePath: string;
  lineStart: number;
  lineEnd: number;
  params: ParameterInfo[];
  returnType: string;
  isAsync: boolean;
  isExported: boolean;
}

export interface ParameterInfo {
  name: string;
  type: string;
  optional: boolean;
  defaultValue?: string;
  integerRequired?: boolean;
  numericConstraints?: Array<{
    operator: '<' | '<=' | '>' | '>=';
    value: number;
  }>;
}

export interface DocSection {
  heading: string;
  content: string;
  filePath: string;
  lineStart: number;
}

export interface EdgeCase {
  symbolName: string;
  category: EdgeCaseCategory;
  description: string;
  inputSuggestion: string;
  expectedBehaviour: string;
}

export type EdgeCaseCategory =
  | 'boundary'
  | 'nullish'
  | 'empty'
  | 'overflow'
  | 'type-coercion'
  | 'async-error'
  | 'documented';

export interface GeneratedTest {
  id: string;
  targetFile: string;
  testFilePath: string;
  kind: 'unit' | 'integration';
  source: string;
  createdAt: Date;
}

export interface RunResult {
  testFile: string;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  failures: FailureDetail[];
}

export interface FailureDetail {
  testName: string;
  message: string;
  stack?: string;
}

export interface CoverageReport {
  id: string;
  generatedAt: Date;
  totalFiles: number;
  linesCovered: number;
  linesTotal: number;
  lineCoverage: number;
  branchCoverage: number;
  reportPath: string;
}

export interface AnalyseRequest {
  filePaths: string[];
  docPaths?: string[];
}

export interface GenerateRequest {
  symbols: SourceSymbol[];
  edgeCases?: EdgeCase[];
  outputDir?: string;
  kind?: 'unit' | 'integration' | 'both';
}
