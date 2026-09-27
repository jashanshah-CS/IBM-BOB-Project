# core_engine.py
from ast import Module
from concurrent.futures._base import Future
import os
import ast
from requests.models import Response
from typing import Any, Callable
import requests
import streamlit as st
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv

load_dotenv()

IBM_BOB_API_KEY: str | None = os.getenv("IBM_BOB_API_KEY")
IBM_BOB_ENDPOINT: str | None  = os.getenv("IBM_BOB_ENDPOINT")


class FastCodeAnalyzer(ast.NodeVisitor):
    """
    Pure O(N) single-pass AST visitor with zero redundant sub-tree walks.
    Tracks loop depth, hidden method overheads, and security risks in one traversal.
    """
    def __init__(self) -> None:
        self.max_loop_depth = 0
        self.current_depth = 0
        self.functions = []
        self.security_issues = []
        self.performance_warnings = []

    def _visit_loop(self, node) -> None:
        self.current_depth += 1
        if self.current_depth > self.max_loop_depth:
            self.max_loop_depth = self.current_depth
        self.generic_visit(node)
        self.current_depth -= 1

    visit_For: Callable[..., Any] = _visit_loop
    visit_While: Callable[..., Any] = _visit_loop

    def visit_AugAssign(self, node) -> None:
        # String concatenation check inside loop context (+=)
        if self.current_depth > 0 and isinstance(node.op, ast.Add):
            self.performance_warnings.append(
                "O(N^2) String Overhead: Repeated `+=` concatenation inside loop. Use `str.join()` instead."
            )
        self.generic_visit(node)

    def visit_Call(self, node):
        # 1. Security check: Dynamic execution risks
        if isinstance(node.func, ast.Name) and node.func.id in ("eval", "exec"):
            self.security_issues.append(
                f"CRITICAL: `{node.func.id}()` detected — severe arbitrary code execution vulnerability."
            )

        # 2. Security & Performance checks on attribute calls
        elif isinstance(node.func, ast.Attribute):
            if node.func.attr in ("execute", "raw"):
                for arg in node.args:
                    if isinstance(arg, (ast.JoinedStr, ast.BinOp)):
                        self.security_issues.append(
                            "HIGH: Potential SQL Injection — unformatted string passed directly to database query."
                        )
                        break

            # 3. Performance check: .insert(0, item) inside loops
            if self.current_depth > 0 and node.func.attr == "insert" and node.args:
                if isinstance(node.args[0], ast.Constant) and node.args[0].value == 0:
                    self.performance_warnings.append(
                        "O(N^2) List Overhead: `.insert(0, ...)` inside loop re-indexes array elements. Use `collections.deque`."
                    )

        self.generic_visit(node)

    def visit_FunctionDef(self, node):
        params = [arg.arg for arg in node.args.args if arg.arg != 'self']
        self.functions.append({"name": node.name, "params": params})
        self.generic_visit(node)


def analyze_code_ast(code_input: str) -> dict:
    """
    Fast local AST analyzer and edge-case unit test synthesizer.
    """
    try:
        tree: Module = ast.parse(code_input)
    except SyntaxError:
        return {
            "status": "error",
            "complexity_analysis": {"time_complexity": "N/A"},
            "generated_tests": [],
            "security_issues": [],
            "performance_warnings": [],
            "error": "⚠️ Input Error: Provided text could not be parsed as valid Python code. Please paste valid Python code (e.g., `def my_func(): ...`) in Section 2, and upload Markdown specs in the sidebar."
        }

    analyzer: FastCodeAnalyzer = FastCodeAnalyzer()
    analyzer.visit(node=tree)

    generated_tests: list[Any] = []
    # Fast test case synthesis loop
    for f in analyzer.functions:
        func_name: Any = f["name"]
        params: Any = f["params"]
        num_params: int = len(params)

        # Test Case 1: Null / Type Safety
        null_args: str = ", ".join(["None"] * num_params) if num_params else ""
        generated_tests.append({
            "name": f"test_{func_name}_null_safety",
            "type": "Null / Type Safety",
            "code": (
                f"def test_{func_name}_null_safety():\n"
                f"    import pytest\n"
                f"    with pytest.raises((TypeError, AttributeError, ValueError)):\n"
                f"        {func_name}({null_args})"
            ),
            "explanation": f"Verifies that `{func_name}` safely catches `None` arguments without uncaught crashes."
        })

        # Test Case 2: Boundary Inputs
        empty_args: str = ", ".join(
            ["0" if any(k in p.lower() for k in ("num", "count", "id", "amount", "price", "val")) else "[]" for p in params]
        ) if num_params else ""

        generated_tests.append({
            "name": f"test_{func_name}_boundary_limits",
            "type": "Edge & Boundary Case",
            "code": (
                f"def test_{func_name}_boundary_limits():\n"
                f"    try:\n"
                f"        result = {func_name}({empty_args})\n"
                f"        assert result is not None\n"
                f"    except Exception as e:\n"
                f"        assert isinstance(e, (ValueError, TypeError))"
            ),
            "explanation": f"Tests `{func_name}` against edge boundary inputs (zero limits or empty collections)."
        })

    depth: int = analyzer.max_loop_depth
    complexity_str: str = f"O(N^{depth})" if depth > 1 else ("O(N)" if depth == 1 else "O(1)")

    return {
        "status": "success",
        "complexity_analysis": {
            "time_complexity": complexity_str,
            "max_loop_depth": depth
        },
        "security_issues": list(set(analyzer.security_issues)),
        "performance_warnings": list(set(analyzer.performance_warnings)),
        "generated_tests": generated_tests
    }


def call_subagent(agent_role: str, code_input: str, doc_context: str) -> dict:
    """Helper to send concurrent API calls to IBM Bob endpoints."""
    if not IBM_BOB_ENDPOINT:
        raise ValueError("IBM_BOB_ENDPOINT is not set in environment variables.")
    headers: dict[str, str] = {
        "Authorization": f"Bearer {IBM_BOB_API_KEY}",
        "Content-Type": "application/json"
    }
    prompt: str = f"Role: {agent_role}\nCode:\n{code_input}\nContext:\n{doc_context or 'None'}"
    response: Response = requests.post(
        url= IBM_BOB_ENDPOINT,
        json={"prompt": prompt, "temperature": 0.2},
        headers=headers,
        timeout=10
    )
    response.raise_for_status()
    return response.json()


@st.cache_data(ttl=3600, show_spinner=False)
def run_bbob_analysis(code_input: str, doc_context: str = "") -> dict:
    """
    Main pipeline entrypoint. Executes concurrent subagents if API credentials exist;
    otherwise executes the ultra-fast local AST engine.
    """
    if IBM_BOB_API_KEY and IBM_BOB_ENDPOINT:
        try:
            roles: list[str] = ["AST Complexity Subagent", "Edge Case Synthesizer", "Security Auditor"]
            subagent_results: dict[Any, Any] = {}
            with ThreadPoolExecutor(max_workers=3) as executor:
                future_to_role: dict[Future[dict[Any, Any]], str] = {
                    executor.submit(call_subagent, role, code_input, doc_context): role 
                    for role in roles
                }
                for future in as_completed(future_to_role):
                    role: str = future_to_role[future]
                    try:
                        subagent_results[role] = future.result()
                    except Exception as fut_exc:
                        st.warning(body=f"Subagent '{role}' failed ({fut_exc}). Skipping.")

            return {
                "status": "success",
                "complexity_analysis": subagent_results.get("AST Complexity Subagent", {}).get("complexity_analysis", {"time_complexity": "O(N)"}),
                "generated_tests": subagent_results.get("Edge Case Synthesizer", {}).get("generated_tests", []),
                "security_issues": subagent_results.get("Security Auditor", {}).get("security_issues", []),
                "performance_warnings": []
            }
        except Exception as e:
            st.warning(body=f"IBM Bob 2.0 API connection bypassed ({e}). Utilizing local AST engine.")

    return analyze_code_ast(code_input)