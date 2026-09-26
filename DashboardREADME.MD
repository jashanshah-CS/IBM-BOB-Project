# 🧪 TestCraft AI — Powered by IBM Bob 2.0

An ultra-fast, multi-agent automated testing and static analysis suite built with Python, Streamlit, and `ast`. TestCraft AI performs single-pass AST code auditing, security scanning, edge-case unit test synthesis, and zero-I/O in-memory `pytest` execution.

---

## ⚡ Key Features

* **$O(N)$ Single-Pass AST Engine:** Ultra-low latency static code analyzer that traverses code trees in a single pass without redundant sub-tree walks.
* **In-Memory Pytest Execution:** Executes generated unit test suites directly in memory via `sys.modules`, completely bypassing physical disk I/O latency.
* **Multi-Agent Pipeline Support:** Integrates concurrently with IBM Bob 2.0 subagent endpoints for AST complexity analysis, edge-case synthesis, and security auditing (with seamless fallback to the local AST engine).
* **Security & Performance Audits:** Automatically detects potential dynamic execution vulnerabilities (`eval`/`exec`), raw SQL injection vectors, and inefficient inner-loop memory patterns (such as list `.insert(0, ...)` or string `+=` accumulation).
* **Document Context Ingestion:** Accepts uploaded spec documents (`.md`, `.txt`) to validate logic against architectural requirements.

---

## 🏗️ Architecture & Project Structure

```text
├── app.py              # Streamlit dashboard & scoped UI fragments
├── core_engine.py      # O(N) AST NodeVisitor & multi-agent pipeline
├── requirements.txt    # Production dependencies
└── README.md           # Project documentation
