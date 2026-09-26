import os

import streamlit as st

from backend_client import TestForgeClient, TestForgeError


st.set_page_config(page_title="TestForge Dashboard", page_icon="🧪", layout="wide")
DEFAULT_API_URL = os.getenv("TESTFORGE_API_URL", "http://127.0.0.1:3000")


@st.cache_resource
def get_client(base_url: str) -> TestForgeClient:
    return TestForgeClient(base_url)


def render_symbols(symbols: list[dict]) -> None:
    if not symbols:
        st.info("No exported TypeScript symbols were detected.")
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
        if not tests:
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
            st.success("No TypeScript syntax diagnostics were reported.")
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
            st.warning(f"Line {suggestion['line']}: {suggestion['message']}")
            st.code(suggestion["correctedCode"], language="typescript")
            st.button(
                "Apply suggested correction",
                on_click=apply_suggested_correction,
                args=(suggestion["correctedCode"],),
            )


st.title("🧪 TestForge Dashboard")
st.caption("Streamlit interface powered by the TypeScript TestForge engine")

api_url = st.sidebar.text_input("TypeScript backend URL", value=DEFAULT_API_URL)
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

if "source_code" not in st.session_state:
    st.session_state.source_code = """export function validateQuantity(quantity: number): boolean {
  return quantity >= 1 && quantity <= 100;
}"""
for key in ("analysis", "run_result", "generated"):
    if key not in st.session_state:
        st.session_state[key] = None

st.subheader("TypeScript source")
source_code = st.text_area(
    "Paste an exported TypeScript function", key="source_code", height=250
)

analyse_col, run_col, generate_col = st.columns(3)
analyse = analyse_col.button("🔍 Analyse", use_container_width=True)
run_tests = run_col.button("▶ Run generated checks", type="primary", use_container_width=True)
generate = generate_col.button("⚗️ Generate Vitest", use_container_width=True)

try:
    if analyse:
        st.session_state.analysis = client.analyse(source_code)
    if run_tests:
        st.session_state.run_result = client.run(source_code)
        st.session_state.analysis = {
            "symbols": st.session_state.run_result.get("symbols", []),
            "edgeCases": st.session_state.run_result.get("edgeCases", []),
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
    st.subheader("Generated Vitest suite")
    st.code(generated["source"], language="typescript")
    source_col, test_col = st.columns(2)
    source_col.download_button(
        "Download source.ts", generated["sourceCode"],
        file_name=generated.get("sourceFileName", "source.ts"),
        mime="text/typescript", use_container_width=True,
    )
    test_col.download_button(
        "Download source.test.ts", generated["source"],
        file_name=generated.get("testFileName", "source.test.ts"),
        mime="text/typescript", use_container_width=True,
    )
