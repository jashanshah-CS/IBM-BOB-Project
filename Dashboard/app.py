import streamlit as st
import time
# Import the backend function directly from your core_engine.py file
from core_engine import run_bbob_analysis

# --- PAGE CONFIG ---
st.set_page_config(page_title="IBM Bob 2.0 PR Guardian", layout="wide")
st.title("🛡️ PR Guardian powered by IBM Bob 2.0")
st.caption("Automated Parallel Code Review, Security Audit, and Doc Verification")

# --- SIDEBAR: DOCUMENT UNDERSTANDING SETUP ---
st.sidebar.header("1. Document Context")
uploaded_doc = st.sidebar.file_uploader("Upload Architecture / API Specs", type=["md", "txt", "pdf"])

doc_text = None
if uploaded_doc:
    doc_text = uploaded_doc.read().decode("utf-8")
    st.sidebar.success("Doc Context Ingested into Bob 2.0 Engine!")

# --- MAIN INPUT AREA ---
st.header("2. Submit Code Diff for Review")
code_diff = st.text_area(
    "Paste Git Diff or Code Snippet below:",
    height=200,
    value="""def process_user_data(user_id, raw_query):
    # TODO: Add authentication
    query = f"SELECT * FROM users WHERE id = '{user_id}' AND query = '{raw_query}'"
    results = db.execute(query)
    
    # Process items linearly
    output = []
    for item in results:
        for sub_item in item.details:
            output.append(sub_item)
    return output"""
)

# --- EXECUTION TRIGGER ---
if st.button("🚀 Trigger IBM Bob 2.0 Parallel Review", type="primary"):
    if not code_diff.strip():
        st.error("Please enter a code snippet or git diff.")
    else:
        st.info("Initiating IBM Bob 2.0 Master Orchestrator...")

        # Visualizing subagent progress
        with st.status("Executing Parallel Subagent Tasks...", expanded=True) as status:
            st.write("🤖 **Subagent A (Security):** Scanning for OWASP & Secret Leaks...")
            st.write("⚡ **Subagent B (Performance):** Analyzing Time/Space Complexity...")
            st.write("📚 **Subagent C (Doc Sync):** Cross-referencing ingested project docs...")

            # --- CALL BACKEND ENGINE HERE ---
            results = run_bbob_analysis(code_diff, doc_text)

            status.update(label="Parallel Analysis Complete!", state="complete", expanded=False)

        # --- OUTPUT REPORT DISPLAY FROM ENGINE DATA ---
        st.success("Review Complete! Output Generated below:")

        tab1, tab2, tab3 = st.tabs(["🔒 Security Audit", "⚡ Performance Analysis", "📚 Doc Consistency"])

        # Tab 1: Security Data
        with tab1:
            sec_data = results["subagent_security"]
            st.subheader(sec_data["title"])
            for finding in sec_data["findings"]:
                st.error(f"⚠️ **{finding['issue']}** ({finding['severity']} Severity)")
                st.write(f"**Explanation:** {finding['explanation']}")
                st.info(f"**Fix:** {finding['fix_recommendation']}")

        # Tab 2: Performance Data
        with tab2:
            perf_data = results["subagent_performance"]
            st.subheader(perf_data["title"])
            for finding in perf_data["findings"]:
                st.warning(f"⚠️ **{finding['issue']}** ({finding['severity']} Severity)")
                st.write(f"**Explanation:** {finding['explanation']}")
                st.info(f"**Fix:** {finding['fix_recommendation']}")

        # Tab 3: Doc Sync Data
        with tab3:
            doc_data = results["subagent_docs"]
            st.subheader(doc_data["title"])
            for finding in doc_data["findings"]:
                st.info(f"ℹ️ **{finding['issue']}** ({finding['severity']} Severity)")
                st.write(f"**Explanation:** {finding['explanation']}")
                st.info(f"**Fix:** {finding['fix_recommendation']}")