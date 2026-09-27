import os

import streamlit as st

from backend_client import TestForgeClient, TestForgeError


st.set_page_config(page_title="TestForge Dashboard", page_icon="🧪", layout="wide")
DEFAULT_API_URL = os.getenv("TESTFORGE_API_URL", "http://127.0.0.1:3000")
MAX_CODE_WORDS = 500


def count_words(value: str) -> int:
    return len(value.split())


def detect_language(code: str) -> str:
    """Return 'python' if the code looks like Python, otherwise 'typescript'."""
    stripped = code.strip()
    if stripped.startswith("def ") or stripped.startswith("async def ") or stripped.startswith("class "):
        return "python"
    if "\ndef " in stripped or "\nasync def " in stripped:
        return "python"
    return "typescript"


@st.cache_resource
def get_client(base_url: str) -> TestForgeClient:
    return TestForgeClient(base_url)


def render_symbols(symbols: list[dict]) -> None:
    if not symbols:
        st.info("No exported symbols were detected. For TypeScript add `export`; for Python ensure functions are not prefixed with `_`.")
        return
    for symbol in symbols:
        params = ", ".join(
            f"{item['name']}: {item['type']}" for item in symbol.get("params", [])
        ) or "no parameters"
        with st.expander(f"{symbol['kind'].title()}: {symbol['name']}"):
            st.write(f"**Parameters:** `{params}`")
            st.write(f"**Returns:** `{symbol.get('returnType') or 'inferred'}`")
            st.write(f"**Source:** lines {symbol['lineStart']}–{symbol['lineEnd']}")


def render_edge_cases(edge_cases: list[dict]) -> None:
    if not edge_cases:
        st.info("No edge cases were derived.")
        return
    for case in edge_cases:
        with st.expander(f"{case['category'].title()}: {case['description']}"):
            st.write(f"**Function:** `{case['symbolName']}`")
            st.write(f"**Suggested input:** `{case['inputSuggestion']}`")
            st.write(f"**Expected behaviour:** {case['expectedBehaviour']}")


def apply_suggested_correction(corrected_code: str) -> None:
    """Apply a fix before Streamlit recreates the source-code widget."""
    st.session_state.source_code = corrected_code
    st.session_state.run_result = None
    st.session_state.analysis = None
    st.session_state.generated = None


def render_results(result: dict) -> None:
    complexity = result.get("complexity", {})
    tests = result.get("tests", [])
    diagnostics = result.get("diagnostics", [])

    st.subheader("Execution scorecard")
    cols = st.columns(5)
    cols[0].metric("Status", result.get("status", "unknown").replace("-", " ").title())
    cols[1].metric("Passed", result.get("passed", 0))
    cols[2].metric("Failed", result.get("failed", 0))
    cols[3].metric("Time", complexity.get("time", "unknown"))
    cols[4].metric("Space", complexity.get("space", "unknown"))

    results_tab, complexity_tab, diagnostics_tab, fix_tab = st.tabs(
        ["Test results", "Complexity", "Diagnostics", "Suggested fix"]
    )
    with results_tab:
        if not tests and not diagnostics:
            lang = detect_language(st.session_state.get("source_code", ""))
            if lang == "python":
                st.info("No public functions were found to test. Ensure functions do not start with `_`.")
            else:
                st.info("No executable tests were produced.")
        for test in tests:
            icon = "✅" if test.get("passed") else "❌"
            with st.expander(f"{icon} {test.get('name', 'Generated test')}"):
                st.write(f"**Expected:** `{test.get('expected')}`")
                st.write(f"**Actual:** `{test.get('actual')}`")
                if test.get("error"):
                    st.error(test["error"])

    with complexity_tab:
        complexity_cols = st.columns(3)
        complexity_cols[0].metric("Cyclomatic", complexity.get("cyclomatic", "unknown"))
        complexity_cols[1].metric("Maintainability", complexity.get("maintainability", "unknown"))
        complexity_cols[2].metric("Confidence", complexity.get("confidence", "unknown"))
        for evidence in complexity.get("evidence", []):
            st.write(f"- {evidence}")
        st.caption(complexity.get("note", ""))

    with diagnostics_tab:
        if not diagnostics:
            st.success("No syntax diagnostics were reported.")
        for diagnostic in diagnostics:
            st.error(
                f"Line {diagnostic.get('line')}:{diagnostic.get('column')} — "
                f"{diagnostic.get('message')}"
            )

    with fix_tab:
        suggestion = result.get("suggestion")
        if not suggestion:
            st.info("No supported automatic correction is available or required.")
        else:
            lang = detect_language(st.session_state.get("source_code", ""))
            code_lang = "python" if lang == "python" else "typescript"
            st.warning(f"Line {suggestion['line']}: {suggestion['message']}")
            st.code(suggestion["correctedCode"], language=code_lang)
            st.button(
                "Apply suggested correction",
                on_click=apply_suggested_correction,
                args=(suggestion["correctedCode"],),
            )


st.title("🧪 TestForge Dashboard")
st.caption("Streamlit interface powered by the TestForge engine — supports TypeScript and Python")

api_url = st.sidebar.text_input("Backend URL", value=DEFAULT_API_URL)
client = get_client(api_url)
try:
    health = client.health()
    st.sidebar.success(
        f"Connected to {health.get('service', 'TestForge')} "
        f"v{health.get('version', 'unknown')}"
    )
except TestForgeError as error:
    st.sidebar.error(str(error))
    st.sidebar.info("Start the backend with `npm run dev` inside `TestForge/`.")
st.sidebar.markdown("### Architecture")
st.sidebar.code("Streamlit → Express API → TestForge engine", language="text")
st.sidebar.markdown("### Supported languages")
st.sidebar.markdown("- TypeScript (`.ts`)\n- Python (`.py`)")

if "source_code" not in st.session_state:
    st.session_state.source_code = """export function validateQuantity(quantity: number): boolean {
  return quantity >= 1 && quantity <= 100;
}"""
for key in ("analysis", "run_result", "generated"):
    if key not in st.session_state:
        st.session_state[key] = None

st.subheader("Source code")
source_code = st.text_area(
    "Paste a function to analyse", key="source_code", height=250
)

# Detect language from whatever is currently in the editor
current_lang = detect_language(source_code)
lang_label = "Python" if current_lang == "python" else "TypeScript"
code_syntax = "python" if current_lang == "python" else "typescript"

word_count = count_words(source_code)
over_limit = word_count > MAX_CODE_WORDS
lang_indicator = f" · detected language: **{lang_label}**" if source_code.strip() else ""
st.caption(f"{word_count} / {MAX_CODE_WORDS} words{lang_indicator}")
if over_limit:
    st.error(
        f"Code is {word_count - MAX_CODE_WORDS} words over the limit. "
        f"Shorten it to {MAX_CODE_WORDS} words before running TestForge."
    )

generate_label = "⚗️ Generate pytest" if current_lang == "python" else "⚗️ Generate Vitest"
source_ext = ".py" if current_lang == "python" else ".ts"
test_ext = ".py" if current_lang == "python" else ".test.ts"
test_prefix = "test_" if current_lang == "python" else ""
source_filename = f"source{source_ext}"
test_filename = f"{test_prefix}source{test_ext}"

run_label = "▶ Run tests" if current_lang == "python" else "▶ Run generated checks"
analyse_col, run_col, generate_col = st.columns(3)
analyse = analyse_col.button("🔍 Analyse", use_container_width=True, disabled=over_limit)
run_tests = run_col.button(
    run_label, type="primary", use_container_width=True,
    disabled=over_limit,
)
generate = generate_col.button(
    generate_label, use_container_width=True, disabled=over_limit,
)

try:
    if analyse:
        st.session_state.analysis = client.analyse(source_code)
    if run_tests:
        st.session_state.run_result = client.run(source_code)
        # Only overwrite analysis from the run result for TypeScript (Python run
        # returns empty symbols by design — preserve any existing analysis).
        run_symbols = st.session_state.run_result.get("symbols", [])
        run_edges = st.session_state.run_result.get("edgeCases", [])
        if run_symbols or run_edges or current_lang != "python":
            st.session_state.analysis = {
                "symbols": run_symbols,
                "edgeCases": run_edges,
            }
    if generate:
        st.session_state.generated = client.generate(source_code)
except TestForgeError as error:
    st.error(str(error))

if st.session_state.analysis:
    symbols_tab, edge_tab = st.tabs(["Extracted symbols", "Edge-case inventory"])
    with symbols_tab:
        render_symbols(st.session_state.analysis.get("symbols", []))
    with edge_tab:
        render_edge_cases(st.session_state.analysis.get("edgeCases", []))

if st.session_state.run_result:
    st.divider()
    render_results(st.session_state.run_result)

if st.session_state.generated:
    st.divider()
    generated = st.session_state.generated
    st.subheader(f"Generated {'pytest' if current_lang == 'python' else 'Vitest'} suite")
    st.code(generated["source"], language=code_syntax)
    source_col, test_col = st.columns(2)
    source_col.download_button(
        f"Download {source_filename}", generated["sourceCode"],
        file_name=generated.get("sourceFileName", source_filename),
        mime="text/plain", use_container_width=True,
    )
    test_col.download_button(
        f"Download {test_filename}", generated["source"],
        file_name=generated.get("testFileName", test_filename),
        mime="text/plain", use_container_width=True,
    )
