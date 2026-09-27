import { Router } from 'express';
import { writeFile, mkdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { analyseFile } from '../engine/analyser.js';
import { discoverEdgeCases } from '../engine/edgeCases.js';
import { generateTests } from '../engine/generator.js';
import { evaluateTypeScriptIsolated } from '../engine/isolatedEvaluator.js';
import { evaluatePython } from '../engine/pyRunner.js';

export const playgroundRouter = Router();
const MAX_CODE_WORDS = 500;

function detectLanguage(code: string): 'python' | 'typescript' {
  const s = code.trim();
  if (/^(?:async\s+)?def\s+\w|^class\s+\w|\ndef\s+\w|\nasync\s+def\s+\w/.test(s)) return 'python';
  return 'typescript';
}

function codeInputError(code: string | undefined): string | undefined {
  if (!code || code.trim() === '') return 'No code provided';
  const wordCount = code.trim().split(/\s+/).length;
  if (wordCount > MAX_CODE_WORDS) {
    return `Code exceeds the ${MAX_CODE_WORDS}-word limit (${wordCount} words provided).`;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// GET /playground — browser UI
// ---------------------------------------------------------------------------

playgroundRouter.get('/', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(PLAYGROUND_HTML);
});

// ---------------------------------------------------------------------------
// POST /playground/analyse
// ---------------------------------------------------------------------------

playgroundRouter.post('/analyse', async (req, res, next) => {
  try {
    const { code } = req.body as { code?: string };
    const inputError = codeInputError(code);
    if (inputError || !code) {
      res.status(inputError?.startsWith('Code exceeds') ? 413 : 400).json({ error: inputError });
      return;
    }
    const lang = detectLanguage(code);
    const tmpDir = join(tmpdir(), 'testforge-playground');
    await mkdir(tmpDir, { recursive: true });
    const tmpFile = join(tmpDir, randomUUID() + (lang === 'python' ? '.py' : '.ts'));
    await writeFile(tmpFile, code, 'utf8');
    try {
      const symbols = await analyseFile(tmpFile);
      const edgeCases = discoverEdgeCases(symbols);
      res.json({ symbols, edgeCases });
    } finally {
      await unlink(tmpFile).catch(() => undefined);
    }
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /playground/generate
// ---------------------------------------------------------------------------

playgroundRouter.post('/generate', async (req, res, next) => {
  try {
    const { code } = req.body as { code?: string };
    const inputError = codeInputError(code);
    if (inputError || !code) {
      res.status(inputError?.startsWith('Code exceeds') ? 413 : 400).json({ error: inputError });
      return;
    }
    const lang = detectLanguage(code);
    const isPython = lang === 'python';
    const tmpDir = join(tmpdir(), 'testforge-playground');
    await mkdir(tmpDir, { recursive: true });
    const tmpFile = join(tmpDir, randomUUID() + (isPython ? '.py' : '.ts'));
    const outDir  = join(tmpDir, 'generated');
    await writeFile(tmpFile, code, 'utf8');
    await mkdir(outDir, { recursive: true });
    try {
      const symbols    = await analyseFile(tmpFile);
      const edgeCases  = discoverEdgeCases(symbols);
      const tests      = await generateTests(symbols, edgeCases, outDir, 'unit');
      const noSymbolsMsg = isPython
        ? '# No public symbols found — nothing to generate.\n# Make sure your functions do not start with an underscore.'
        : '// No exported symbols found — nothing to generate.\n// Make sure your functions use the "export" keyword.';
      const generatedSource = tests[0]?.source ?? noSymbolsMsg;
      // Make the downloaded pair portable by using a stable source filename.
      const source = isPython
        ? generatedSource.replace(/^from \S+ import/m, 'from source import')
        : generatedSource.replace(/from '\.\.\/[^']+\.js';/, "from './source.js';");
      res.json({
        source,
        sourceCode: code,
        sourceFileName: isPython ? 'source.py' : 'source.ts',
        testFileName: isPython ? 'test_source.py' : 'source.test.ts',
        symbolCount: symbols.length,
        edgeCaseCount: edgeCases.length,
      });
    } finally {
      await unlink(tmpFile).catch(() => undefined);
    }
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /playground/run — analyse and execute derived tests
// ---------------------------------------------------------------------------

playgroundRouter.post('/run', async (req, res, next) => {
  try {
    const { code } = req.body as { code?: string };
    const inputError = codeInputError(code);
    if (inputError || !code) {
      res.status(inputError?.startsWith('Code exceeds') ? 413 : 400).json({ error: inputError });
      return;
    }
    if (detectLanguage(code) === 'python') {
      res.json(await evaluatePython(code));
      return;
    }
    res.json(await evaluateTypeScriptIsolated(code));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// HTML — kept as a plain string constant (no nested template literals)
// ---------------------------------------------------------------------------

const PLAYGROUND_HTML = '<!DOCTYPE html>\n' +
'<html lang="en">\n' +
'<head>\n' +
'<meta charset="UTF-8"/>\n' +
'<meta name="viewport" content="width=device-width,initial-scale=1"/>\n' +
'<title>TestForge Playground</title>\n' +
'<style>\n' +
'*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}\n' +
'body{font-family:-apple-system,"Segoe UI",system-ui,sans-serif;background:#f7f8fa;color:#1f2328;height:100vh;display:flex;flex-direction:column;overflow:hidden}\n' +
'header{background:#1f2328;color:#fff;padding:12px 24px;display:flex;align-items:center;gap:12px;flex-shrink:0}\n' +
'header h1{font-size:1rem;font-weight:700}\n' +
'header a{color:#adbac7;font-size:0.82rem;text-decoration:none;margin-left:auto}\n' +
'header a:hover{color:#fff}\n' +
'.layout{display:grid;grid-template-columns:1fr 1fr;flex:1;overflow:hidden}\n' +
'.pane{display:flex;flex-direction:column;border-right:1px solid #e5e7eb;overflow:hidden}\n' +
'.pane:last-child{border-right:none}\n' +
'.pane-header{padding:10px 16px;background:#fff;border-bottom:1px solid #e5e7eb;font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#57606a;flex-shrink:0;display:flex;align-items:center}\n' +
'#char-count{margin-left:auto;font-weight:400;text-transform:none;letter-spacing:0}\n' +
'textarea{flex:1;width:100%;border:none;outline:none;resize:none;font-family:"Cascadia Code","Fira Code","Courier New",monospace;font-size:0.84rem;line-height:1.6;padding:14px;background:#0d1117;color:#e6edf3;tab-size:2}\n' +
'textarea::placeholder{color:#484f58}\n' +
'.toolbar{padding:8px 14px;background:#fff;border-top:1px solid #e5e7eb;display:flex;gap:8px;flex-shrink:0}\n' +
'button{padding:6px 14px;border:none;border-radius:6px;font-size:0.82rem;font-weight:600;cursor:pointer}\n' +
'button:disabled{opacity:.4;cursor:not-allowed}\n' +
'.btn-blue{background:#3b82d4;color:#fff}\n' +
'.btn-grey{background:#e5e7eb;color:#1f2328}\n' +
'.btn-green{background:#166534;color:#fff;display:none}\n' +
'.btn-purple{background:#7c3aed;color:#fff}\n' +
'.btn-orange{background:#b45309;color:#fff;display:none}\n' +
'.status{padding:5px 14px;font-size:0.75rem;color:#57606a;background:#fff;border-top:1px solid #e5e7eb;min-height:26px;flex-shrink:0}\n' +
'.status.err{color:#991b1b}.status.ok{color:#166534}\n' +
'.out-pane{display:flex;flex-direction:column;overflow:hidden}\n' +
'.tabs{display:flex;background:#fff;border-bottom:1px solid #e5e7eb;flex-shrink:0}\n' +
'.tab{padding:9px 16px;font-size:0.78rem;font-weight:700;cursor:pointer;border-bottom:2px solid transparent;color:#57606a}\n' +
'.tab.on{color:#1f2328;border-bottom-color:#3b82d4}\n' +
'.panels{flex:1;overflow:hidden;position:relative}\n' +
'.panel{display:none;position:absolute;inset:0;overflow:auto}\n' +
'.panel.on{display:block}\n' +
'pre{font-family:"Cascadia Code","Fira Code","Courier New",monospace;font-size:0.8rem;line-height:1.6;padding:14px;background:#0d1117;color:#e6edf3;min-height:100%;white-space:pre-wrap;word-break:break-all}\n' +
'.list{padding:14px}\n' +
'.card{background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:11px 14px;margin-bottom:10px}\n' +
'.card-name{font-weight:700;font-size:0.9rem;margin-bottom:5px}\n' +
'.meta{font-size:0.75rem;color:#57606a;display:flex;gap:8px;flex-wrap:wrap}\n' +
'.tag{background:#f0f1f3;border-radius:4px;padding:1px 7px}\n' +
'.tag-async{background:#dbeafe;color:#1e40af}\n' +
'.tag-exp{background:#dcfce7;color:#166534}\n' +
'.ecat{font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:2px 8px;border-radius:10px;display:inline-block;margin-bottom:6px}\n' +
'.c-boundary{background:#fef9c3;color:#854d0e}\n' +
'.c-nullish{background:#fee2e2;color:#991b1b}\n' +
'.c-empty{background:#f3e8ff;color:#6b21a8}\n' +
'.c-overflow{background:#ffedd5;color:#9a3412}\n' +
'.c-async{background:#dbeafe;color:#1e40af}\n' +
'.c-doc{background:#dcfce7;color:#166534}\n' +
'.edesc{font-size:0.84rem;font-weight:600;margin-bottom:4px}\n' +
'.edet{font-size:0.75rem;color:#57606a;margin-bottom:2px}\n' +
'.pass{border-left:4px solid #16a34a}.fail{border-left:4px solid #dc2626}\n' +
'.pass .card-name{color:#166534}.fail .card-name{color:#991b1b}\n' +
'code{background:#f0f1f3;border-radius:3px;padding:1px 5px;font-size:0.78rem;font-family:monospace}\n' +
'.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:80%;color:#57606a;font-size:0.88rem;gap:8px;text-align:center;padding:20px}\n' +
'.empty .ico{font-size:2rem}\n' +
'.spin{display:inline-block;width:11px;height:11px;border:2px solid #e5e7eb;border-top-color:#3b82d4;border-radius:50%;animation:sp .6s linear infinite;vertical-align:middle;margin-right:5px}\n' +
'@keyframes sp{to{transform:rotate(360deg)}}\n' +
'</style>\n' +
'</head>\n' +
'<body>\n' +
'<header>\n' +
'  <h1>TestForge Playground</h1>\n' +
'  <a href="/">Back to home</a>\n' +
'</header>\n' +
'<div class="layout">\n' +
'  <div class="pane">\n' +
'    <div class="pane-header">Your TypeScript code <span id="char-count"></span></div>\n' +
'    <textarea id="code" placeholder="// Paste your TypeScript code here&#10;// Example:&#10;export function add(a: number, b: number): number {&#10;  return a + b;&#10;}&#10;&#10;export function divide(a: number, b: number): number {&#10;  if (b === 0) throw new Error(\'Division by zero\');&#10;  return a / b;&#10;}"></textarea>\n' +
'    <div class="toolbar">\n' +
'      <button class="btn-blue" id="btn-a">Analyse</button>\n' +
'      <button class="btn-blue" id="btn-g">Generate Tests</button>\n' +
'      <button class="btn-purple" id="btn-r">Run Tests</button>\n' +
'      <button class="btn-grey" id="btn-c">Clear</button>\n' +
'      <button class="btn-orange" id="btn-f">Apply suggested fix</button>\n' +
'      <button class="btn-green" id="btn-d">Download test</button>\n' +
'      <button class="btn-green" id="btn-s">Download source</button>\n' +
'    </div>\n' +
'    <div class="status" id="status"></div>\n' +
'  </div>\n' +
'  <div class="pane out-pane">\n' +
'    <div class="tabs">\n' +
'      <div class="tab on" data-t="sym">Symbols</div>\n' +
'      <div class="tab" data-t="edge">Edge Cases</div>\n' +
'      <div class="tab" data-t="test">Generated Tests</div>\n' +
'      <div class="tab" data-t="result">Results</div>\n' +
'      <div class="tab" data-t="complexity">Complexity</div>\n' +
'      <div class="tab" data-t="fix">Suggested Fix</div>\n' +
'    </div>\n' +
'    <div class="panels">\n' +
'      <div class="panel on" id="p-sym"><div class="list" id="sym-list"><div class="empty"><div class="ico">&#128269;</div><div>Paste code and click <strong>Analyse</strong></div></div></div></div>\n' +
'      <div class="panel" id="p-edge"><div class="list" id="edge-list"><div class="empty"><div class="ico">&#9889;</div><div>Edge cases appear here after analysis</div></div></div></div>\n' +
'      <div class="panel" id="p-test"><pre id="test-out" style="color:#484f58">// Generated tests appear here\n// Click Generate Tests to start</pre></div>\n' +
'      <div class="panel" id="p-result"><div class="list" id="result-list"><div class="empty"><div class="ico">&#9654;</div><div>Click <strong>Run Tests</strong> to verify the code</div></div></div></div>\n' +
'      <div class="panel" id="p-complexity"><div class="list" id="complexity-list"><div class="empty"><div class="ico">&#9201;</div><div>Complexity estimates appear after analysis</div></div></div></div>\n' +
'      <div class="panel" id="p-fix"><pre id="fix-out" style="color:#484f58">// A supported correction will appear here when tests expose a defect</pre></div>\n' +
'    </div>\n' +
'  </div>\n' +
'</div>\n' +
'<script>\n' +
'(function(){\n' +
'var code=document.getElementById("code");\n' +
'var btnA=document.getElementById("btn-a");\n' +
'var btnG=document.getElementById("btn-g");\n' +
'var btnR=document.getElementById("btn-r");\n' +
'var btnC=document.getElementById("btn-c");\n' +
'var btnF=document.getElementById("btn-f");\n' +
'var btnD=document.getElementById("btn-d");\n' +
'var btnS=document.getElementById("btn-s");\n' +
'var status=document.getElementById("status");\n' +
'var symList=document.getElementById("sym-list");\n' +
'var edgeList=document.getElementById("edge-list");\n' +
'var testOut=document.getElementById("test-out");\n' +
'var resultList=document.getElementById("result-list");\n' +
'var complexityList=document.getElementById("complexity-list");\n' +
'var fixOut=document.getElementById("fix-out");\n' +
'var charCount=document.getElementById("char-count");\n' +
'var lastSrc="";\n' +
'var lastCode="";\n' +
'var correctedCode="";\n' +
'var lastTestFileName="source.test.ts";\n' +
'var lastSrcFileName="source.ts";\n' +
'\n' +
'function detectLang(src){var s=src.trim();return(/^(?:async\\s+)?def\\s+\\w|^class\\s+\\w|\\ndef\\s+\\w|\\nasync\\s+def\\s+\\w/.test(s))?"Python":"TypeScript";}\n' +
'code.addEventListener("input",function(){charCount.textContent=code.value.length?code.value.length+" chars":""});\n' +
'\n' +
'document.querySelectorAll(".tab").forEach(function(t){\n' +
'  t.addEventListener("click",function(){switchTab(t.dataset.t);});\n' +
'});\n' +
'\n' +
'function switchTab(name){\n' +
'  document.querySelectorAll(".tab").forEach(function(t){t.classList.toggle("on",t.dataset.t===name);});\n' +
'  document.querySelectorAll(".panel").forEach(function(p){p.classList.toggle("on",p.id==="p-"+name);});\n' +
'}\n' +
'\n' +
'function setStatus(msg,cls){\n' +
'  status.textContent=msg;\n' +
'  status.className="status"+(cls?" "+cls:"");\n' +
'}\n' +
'\n' +
'function busy(msg){\n' +
'  status.innerHTML=\'<span class="spin"></span>\'+msg;\n' +
'  status.className="status";\n' +
'  btnA.disabled=true;btnG.disabled=true;btnR.disabled=true;\n' +
'}\n' +
'\n' +
'function idle(){btnA.disabled=false;btnG.disabled=false;btnR.disabled=false;}\n' +
'\n' +
'function kindColour(k){\n' +
'  return{function:"#3b82d4",arrow:"#7c5cd8",class:"#b45309",method:"#166534"}[k]||"#57606a";\n' +
'}\n' +
'\n' +
'function catCls(c){\n' +
'  return{"boundary":"c-boundary","nullish":"c-nullish","empty":"c-empty","overflow":"c-overflow","async-error":"c-async","documented":"c-doc","type-coercion":"c-boundary"}[c]||"c-boundary";\n' +
'}\n' +
'\n' +
'btnA.addEventListener("click",function(){\n' +
'  var src=code.value.trim();\n' +
'  if(!src){setStatus("Paste some code first.","err");return;}\n' +
'  busy("Analysing...");\n' +
'  fetch("/playground/analyse",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:src})})\n' +
'  .then(function(r){return r.json().then(function(d){return{ok:r.ok,d:d};});})\n' +
'  .then(function(x){\n' +
'    if(!x.ok){setStatus("Error: "+(x.d.error||"unknown"),"err");return;}\n' +
'    var syms=x.d.symbols;\n' +
'    var edges=x.d.edgeCases;\n' +
'    var isPy=detectLang(src)==="Python";\n' +
'    if(syms.length===0){\n' +
'      var noSymMsg=isPy?"No public symbols detected. Ensure functions are not prefixed with <code>_</code>.":"No exported symbols found. Add <code>export</code> before your functions.";\n' +
'      symList.innerHTML=\'<div class="empty"><div class="ico">&#129335;</div><div>\'+noSymMsg+\'</div></div>\';\n' +
'    }else{\n' +
'      symList.innerHTML=syms.map(function(s){\n' +
'        var col=kindColour(s.kind);\n' +
'        var tags=\'<span class="tag" style="background:\'+col+\'22;color:\'+col+\'">\'+s.kind+\'</span>\';\n' +
'        if(s.isAsync)tags+=\'<span class="tag tag-async">async</span>\';\n' +
'        if(s.isExported)tags+=\'<span class="tag tag-exp">exported</span>\';\n' +
'        tags+=\'<span class="tag">line \'+s.lineStart+\'</span>\';\n' +
'        if(s.params.length)tags+=\'<span class="tag">\'+s.params.length+\' param\'+(s.params.length>1?"s":"")+\'</span>\';\n' +
'        if(s.returnType)tags+=\'<span class="tag">&#8594; \'+s.returnType+\'</span>\';\n' +
'        return\'<div class="card"><div class="card-name">\'+s.name+\'</div><div class="meta">\'+tags+\'</div></div>\';\n' +
'      }).join("");\n' +
'    }\n' +
'    if(edges.length===0){\n' +
'      edgeList.innerHTML=\'<div class="empty"><div class="ico">&#9989;</div><div>No edge cases identified.</div></div>\';\n' +
'    }else{\n' +
'      edgeList.innerHTML=edges.map(function(e){\n' +
'        return\'<div class="card">\'  +\n' +
'          \'<span class="ecat \'+catCls(e.category)+\'">\'+e.category+\'</span>\' +\n' +
'          \'<div class="edesc">\'+e.symbolName+\': \'+e.description+\'</div>\' +\n' +
'          \'<div class="edet">Input: <code>\'+e.inputSuggestion+\'</code></div>\' +\n' +
'          \'<div class="edet">Expected: \'+e.expectedBehaviour+\'</div>\' +\n' +
'          \'</div>\';\n' +
'      }).join("");\n' +
'    }\n' +
'    setStatus("Found "+syms.length+" symbol"+(syms.length!==1?"s":"")+" and "+edges.length+" edge case"+(edges.length!==1?"s":"")+".","ok");\n' +
'    switchTab("sym");\n' +
'    btnR.click();\n' +
'  })\n' +
'  .catch(function(e){setStatus("Network error: "+e.message,"err");})\n' +
'  .finally(function(){idle();});\n' +
'});\n' +
'\n' +
'function esc(value){\n' +
'  return String(value).replace(/[&<>"\']/g,function(ch){\n' +
'    if(ch==="&")return "&amp;";\n' +
'    if(ch==="<")return "&lt;";\n' +
'    if(ch===">")return "&gt;";\n' +
'    if(ch.charCodeAt(0)===34)return "&quot;";\n' +
'    return "&#39;";\n' +
'  });\n' +
'}\n' +
'\n' +
'function highlightLine(line){\n' +
'  if(!line||line<1)return;\n' +
'  var lines=code.value.split("\\n");\n' +
'  var start=0;\n' +
'  for(var i=0;i<line-1;i++)start+=lines[i].length+1;\n' +
'  code.focus();\n' +
'  code.setSelectionRange(start,start+(lines[line-1]||"").length);\n' +
'}\n' +
'\n' +
'btnR.addEventListener("click",function(){\n' +
'  var src=code.value.trim();\n' +
'  if(!src){setStatus("Paste some code first.","err");return;}\n' +
'  var isRunPy=detectLang(src)==="Python";\n' +
'  busy(isRunPy?"Analysing complexity...":"Running generated tests...");\n' +
'  fetch("/playground/run",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:src})})\n' +
'  .then(function(r){return r.json().then(function(d){return{ok:r.ok,d:d};});})\n' +
'  .then(function(x){\n' +
'    if(!x.ok){setStatus("Error: "+(x.d.error||"unknown"),"err");return;}\n' +
'    var d=x.d;\n' +
'    var c=d.complexity;\n' +
'    complexityList.innerHTML=\'<div class="card"><div class="card-name">Time complexity: \'+esc(c.time)+\'</div><div class="edet">Estimated from loops, sorting, array operations and recursion.</div></div>\'+\'<div class="card"><div class="card-name">Space complexity: \'+esc(c.space)+\'</div><div class="edet">Estimated from allocations and recursion.</div></div>\'+\'<div class="card"><div class="card-name">Cyclomatic complexity: \'+c.cyclomatic+\'</div><div class="edet">Maintainability: \'+esc(c.maintainability)+\' · Confidence: \'+esc(c.confidence)+\'</div></div>\'+c.evidence.map(function(e){return \'<div class="card"><div class="edet">\'+esc(e)+\'</div></div>\';}).join("")+\'<div class="card"><div class="edet">\'+esc(c.note)+\'</div></div>\';\n' +
'    correctedCode="";\n' +
'    btnF.style.display="none";\n' +
'    if(d.diagnostics.length){\n' +
'      resultList.innerHTML=d.diagnostics.map(function(diag){return \'<div class="card fail"><div class="card-name">Syntax error at line \'+diag.line+\':\'+diag.column+\'</div><div class="edet">\'+esc(diag.message)+\'</div></div>\';}).join("");\n' +
'      setStatus("Code could not be tested: "+d.diagnostics.length+" error"+(d.diagnostics.length!==1?"s":"")+" found.","err");\n' +
'      switchTab("result");\n' +
'      highlightLine(d.diagnostics[0].line);\n' +
'      return;\n' +
'    }\n' +
'    var emptyResultMsg=isRunPy?\'<div class="empty"><div class="ico">&#9989;</div><div>Python test execution runs via pytest. Use <strong>Generate Tests</strong> to download a test file.</div></div>\':\'<div class="empty">No executable exported functions found.</div>\';\n' +
'    resultList.innerHTML=d.tests.map(function(t){return \'<div class="card \'+(t.passed?"pass":"fail")+\'"><div class="card-name">\'+(t.passed?"PASS: ":"FAIL: ")+esc(t.name)+\'</div><div class="edet">Expected: <code>\'+esc(t.expected)+\'</code></div><div class="edet">Actual: <code>\'+esc(t.actual)+\'</code></div>\'+(t.error?\'<div class="edet">Error: \'+esc(t.error)+\'</div>\':"")+\'</div>\';}).join("")||emptyResultMsg;\n' +
'    if(d.suggestion){\n' +
'      correctedCode=d.suggestion.correctedCode;\n' +
'      fixOut.textContent="// "+d.suggestion.message+"\\n\\n"+correctedCode;\n' +
'      fixOut.style.color="";\n' +
'      btnF.style.display="block";\n' +
'      highlightLine(d.suggestion.line);\n' +
'    }else{\n' +
'      fixOut.textContent=d.failed?"// No automatic correction is available for this failure.":"// All derived tests passed; no correction is needed.";\n' +
'    }\n' +
'    setStatus(isRunPy?"Complexity analysis complete — use Generate Tests to run pytest.":d.failed===0?"Verified: all "+d.passed+" derived tests passed.":"Potential defect: "+d.failed+" of "+(d.passed+d.failed)+" tests failed.",isRunPy?"ok":d.failed===0?"ok":"err");\n' +
'    switchTab("result");\n' +
'  })\n' +
'  .catch(function(e){setStatus("Test execution error: "+e.message,"err");})\n' +
'  .finally(function(){idle();});\n' +
'});\n' +
'\n' +
'btnF.addEventListener("click",function(){\n' +
'  if(!correctedCode)return;\n' +
'  code.value=correctedCode;\n' +
'  charCount.textContent=code.value.length+" chars";\n' +
'  setStatus("Suggested correction applied. Run the tests again to verify it.","ok");\n' +
'  btnF.style.display="none";\n' +
'});\n' +
'\n' +
'btnG.addEventListener("click",function(){\n' +
'  var src=code.value.trim();\n' +
'  if(!src){setStatus("Paste some code first.","err");return;}\n' +
'  busy("Generating tests...");\n' +
'  fetch("/playground/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:src})})\n' +
'  .then(function(r){return r.json().then(function(d){return{ok:r.ok,d:d};});})\n' +
'  .then(function(x){\n' +
'    if(!x.ok){setStatus("Error: "+(x.d.error||"unknown"),"err");return;}\n' +
'    lastSrc=x.d.source;\n' +
'    lastCode=x.d.sourceCode;\n' +
'    lastTestFileName=x.d.testFileName||"source.test.ts";\n' +
'    lastSrcFileName=x.d.sourceFileName||"source.ts";\n' +
'    testOut.textContent=x.d.source;\n' +
'    testOut.style.color="";\n' +
'    btnD.style.display="block";\n' +
'    btnS.style.display="block";\n' +
'    setStatus("Generated tests for "+x.d.symbolCount+" symbol"+(x.d.symbolCount!==1?"s":"")+" ("+x.d.edgeCaseCount+" edge case"+(x.d.edgeCaseCount!==1?"s":"")+").","ok");\n' +
'    switchTab("test");\n' +
'  })\n' +
'  .catch(function(e){setStatus("Network error: "+e.message,"err");})\n' +
'  .finally(function(){idle();});\n' +
'});\n' +
'\n' +
'btnD.addEventListener("click",function(){\n' +
'  if(!lastSrc)return;\n' +
'  var b=new Blob([lastSrc],{type:"text/plain"});\n' +
'  var a=document.createElement("a");\n' +
'  a.href=URL.createObjectURL(b);\n' +
'  a.download=lastTestFileName;\n' +
'  a.click();\n' +
'  URL.revokeObjectURL(a.href);\n' +
'});\n' +
'\n' +
'btnS.addEventListener("click",function(){\n' +
'  if(!lastCode)return;\n' +
'  var b=new Blob([lastCode],{type:"text/plain"});\n' +
'  var a=document.createElement("a");\n' +
'  a.href=URL.createObjectURL(b);\n' +
'  a.download=lastSrcFileName;\n' +
'  a.click();\n' +
'  URL.revokeObjectURL(a.href);\n' +
'});\n' +
'\n' +
'btnC.addEventListener("click",function(){\n' +
'  code.value="";\n' +
'  charCount.textContent="";\n' +
'  symList.innerHTML=\'<div class="empty"><div class="ico">&#128269;</div><div>Paste code and click <strong>Analyse</strong></div></div>\';\n' +
'  edgeList.innerHTML=\'<div class="empty"><div class="ico">&#9889;</div><div>Edge cases appear here after analysis</div></div>\';\n' +
'  testOut.textContent="// Generated tests appear here\\n// Click Generate Tests to start";\n' +
'  testOut.style.color="#484f58";\n' +
'  resultList.innerHTML=\'<div class="empty"><div class="ico">&#9654;</div><div>Click <strong>Run Tests</strong> to verify the code</div></div>\';\n' +
'  complexityList.innerHTML=\'<div class="empty"><div class="ico">&#9201;</div><div>Complexity estimates appear after analysis</div></div>\';\n' +
'  fixOut.textContent="// A supported correction will appear here when tests expose a defect";\n' +
'  btnD.style.display="none";\n' +
'  btnS.style.display="none";\n' +
'  btnF.style.display="none";\n' +
'  lastSrc="";\n' +
'  lastCode="";\n' +
'  correctedCode="";\n' +
'  lastTestFileName="source.test.ts";\n' +
'  lastSrcFileName="source.ts";\n' +
'  setStatus("");\n' +
'  switchTab("sym");\n' +
'});\n' +
'})();\n' +
'</script>\n' +
'</body>\n' +
'</html>';
