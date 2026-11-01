# Forecasting Service (FastAPI)

Python microservice for demand forecasting, waste analytics, and intelligent replenishment suggestions.

## Phase 0 Scope
- Minimal FastAPI scaffold.
- Service health endpoint at `GET /health`.
- No machine learning algorithms implemented yet (scheduled for later phases).

## Setup & Running Locally

1. Create a Python virtual environment:
   ```powershell
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```

2. Install dependencies:
   ```powershell
   pip install -r requirements.txt
   ```

3. Run the service:
   ```powershell
   uvicorn app.main:app --port 8000 --reload
   ```

4. Verify health endpoint:
   Open browser or Postman at `http://127.0.0.1:8000/health`.
