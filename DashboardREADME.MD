# TestForge integrated dashboard

This final prototype combines the Streamlit dashboard with the TypeScript and Python TestForge engine.

## Architecture

```text
Streamlit dashboard (port 8501)
             |
             | JSON over HTTP
             v
Express/TestForge API (port 3000)
             |
             +-- TypeScript/Python analysis
             +-- edge-case discovery
             +-- dynamic test execution
             +-- Vitest/pytest generation
             +-- complexity estimates
             `-- supported defect suggestions
```

The dashboard does not duplicate the analysis logic. `Dashboard/backend_client.py` sends code to the Express endpoints and renders the language-specific responses.

## Run both services

From the repository root in PowerShell:

```powershell
.\start-integrated.ps1
```

Or run them separately:

```powershell
cd TestForge
npm install
npm run dev
```

```powershell
cd Dashboard
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe -m streamlit run app.py
```

Open <http://127.0.0.1:8501>. The sidebar shows whether the TestForge API is connected. Set `TESTFORGE_API_URL` if the backend uses another address.

