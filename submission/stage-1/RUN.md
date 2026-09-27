# Run Stage 1

## Option A - local Windows run

Requirements: Node.js 20+, npm and Python 3.11+.

From the repository root:

```powershell
.\start-integrated.ps1
```

Open <http://127.0.0.1:8501>. The dashboard sidebar should display `Connected to TestForge v0.1.0`.

If dependencies have not been installed, the startup script installs them. The backend health endpoint is <http://127.0.0.1:3000/health>.

## Option B - run separately

Backend:

```powershell
cd TestForge
npm install
npm run build
npm start
```

Dashboard in a second terminal:

```powershell
cd Dashboard
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
$env:TESTFORGE_API_URL = "http://127.0.0.1:3000"
.\venv\Scripts\python.exe -m streamlit run app.py
```

## Option C - Docker

Run these commands from the repository root so the Docker build can access the canonical source directories:

```bash
docker build -f submission/stage-1/Dockerfile -t testforge-stage-1 .
docker run --rm -p 3000:3000 -p 8501:8501 testforge-stage-1
```

Open <http://127.0.0.1:8501>.

## Verification

```powershell
cd TestForge
npm run audit
npm run typecheck
npm run lint
```

Expected audit summary:

```text
Audit result: 20/20 scenarios passed.
PASS | infinite-loop isolation | failing
PASS | generated source | out-of-range maximum has an exact rejection assertion
PASS | generated source | comment-documented decimal rule has an exact rejection assertion
```

The word `failing` in the infinite-loop line is the expected product status for deliberately non-terminating submitted code; the audit itself passes.

