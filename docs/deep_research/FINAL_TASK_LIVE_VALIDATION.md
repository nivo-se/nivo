# Final task: Live validation (pick up from another computer)

**Status:** Validated (2026-03-08)  
**Branch:** `cursor/deep-research-system-planning-f59c`  
**Goal:** Run the Deep Research pipeline on 2 real companies (Segers Fabriker, Texstar) and confirm the analyst workbench works end-to-end.

---

## 1. What this task is

The last step before declaring Deep Research MVP complete is **internal validation**: run the system on real companies and confirm the four release gates in [DEEP_RESEARCH_STOP_CRITERIA.md](./DEEP_RESEARCH_STOP_CRITERIA.md) (Section 5):

- **Gate A** — Can an analyst run it? (start run, see progress)
- **Gate B** — Can an analyst trust it? (verification panel, claim counts)
- **Gate C** — Can an analyst correct it? (competitors, assumptions, recompute)
- **Gate D** — Can an analyst work from it? (report is usable as first-pass research)

Target companies for this run: **Segers Fabriker** and **Texstar** (or any 2 companies you have in your DB).

---

## 2. Prerequisites (other computer)

### 2.1 Repository and branch

```bash
git clone https://github.com/nivo-se/nivo.git nivo-web   # or your fork
cd nivo-web
git fetch origin && git checkout cursor/deep-research-system-planning-f59c
```

### 2.2 Environment file

You need a `.env` file in the repo root. Copy it from the machine where you already run Nivo, or create from `.env.example`.

**Required for Deep Research:**

- **Database** — Postgres (can be on this machine or another):
  - `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
  - If DB is on another machine (e.g. Mac Mini), set `POSTGRES_HOST` to that hostname/IP.
- **OpenAI** — Only paid service required for the pipeline:
  - `OPENAI_API_KEY=sk-...`
- **Redis** — Required for async run queue:
  - `REDIS_URL=redis://localhost:6379/0` (or your Redis host)
- **Backend / Deep Research** (optional but used by backend):
  - `retrieval_provider` — set to `serpapi` or `tavily` if you have keys; otherwise `none` (retrieval will be limited).
  - Backend reads `OPENAI_API_KEY` via `backend/config/settings.py` (pydantic-settings from `.env`).

Frontend (if you run it): `VITE_API_BASE_URL` pointing at your backend (e.g. `http://localhost:8000` for local).

### 2.3 Database state

- **Public schema:** `companies` etc. — may be empty on a fresh clone; that’s OK.
- **Deep Research schema:** Must exist. Apply migrations that create `deep_research` schema and tables:
  - `database/migrations/024_deep_research_persistence.sql`
  - `database/migrations/025_deep_research_run_node_states.sql` (if present)
  - `database/migrations/025_claim_verifications.sql`
  - Plus `024_user_profiles.sql` if you use auth.

From repo root (with `.env` loaded):

```bash
# If you use a bootstrap script that applies migrations:
python3 scripts/bootstrap_postgres_schema.py

# Or apply manually, e.g.:
psql "$DATABASE_URL" -f database/migrations/024_deep_research_persistence.sql
# ... then other deep_research migrations
```

Companies for analysis live in **`deep_research.companies`**. They are created on demand when you start a run with `company_name` + optional `orgnr`/`website`. You do **not** need to pre-insert Segers Fabriker or Texstar; the first run will create them (via `resolve_company` in the backend).

### 2.4 Services that must be running

| Service      | Purpose                    | How to run |
|-------------|----------------------------|------------|
| PostgreSQL  | All app + Deep Research data | Your existing Postgres (local or remote). |
| Redis       | RQ job queue for async runs | `brew services start redis` or `redis-server` |
| Backend API | Serves `/api/deep-research/*` | `cd backend && uvicorn api.main:app --host 0.0.0.0 --port 8000` (activate venv first, `pip install -r requirements.txt`) |
| RQ worker   | Runs the pipeline jobs      | `./scripts/start-deep-research-worker.sh` (from repo root; needs `REDIS_URL` and same venv as backend) |
| Frontend    | Optional but recommended    | `cd frontend && npm install && npm run dev` (then open http://localhost:5173) |

**Quick check:**

- Backend: `curl -s http://localhost:8000/api/status/config` (or your API base URL).
- Redis: `redis-cli ping` → `PONG`.
- Worker: you should see a process like `rq worker deep_research`; when you start a run, logs should appear in that terminal.

---

## 3. How to run the validation

### 3.1 Start two analysis runs (API)

The Deep Research API is under **`/api/deep-research/`**. There is no “Start analysis” button in the UI yet; use the API to enqueue runs.

**Start run 1 (Segers Fabriker):**

```bash
curl -X POST "http://localhost:8000/api/deep-research/analysis/start" \
  -H "Content-Type: application/json" \
  -d '{"company_name": "Segers Fabriker", "query": "Segers Fabriker"}'
```

**Start run 2 (Texstar):**

```bash
curl -X POST "http://localhost:8000/api/deep-research/analysis/start" \
  -H "Content-Type: application/json" \
  -d '{"company_name": "Texstar", "query": "Texstar"}'
```

If your backend uses Auth0 and requires a JWT, add:

```bash
-H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Each response should return a `run_id` (UUID) and `status: "pending"`. The RQ worker will pick up the job and run the pipeline.

### 3.2 Watch progress and open report (UI)

1. Open the app (e.g. http://localhost:5173), go to **Deep Research** in the sidebar.
2. **Runs list:** `/deep-research/runs` — you should see the two runs; status moves from `pending` → `running` → `completed` (or `failed`).
3. Click a run → **Run status** page: stage timeline and current stage.
4. When status is `completed`, use the link to **company** (company_id) or go to **Deep Research** and open the workbench for that company:
   - **Report:** `/deep-research/company/{company_id}/report/latest`
   - **Verification:** `/deep-research/company/{company_id}/verification`
   - **Versions / Competitors / Assumptions** as needed.

### 3.3 Optional: start run by company_id

If you already have a `company_id` (UUID) in `deep_research.companies` (e.g. from a previous run), you can start with:

```bash
curl -X POST "http://localhost:8000/api/deep-research/analysis/start" \
  -H "Content-Type: application/json" \
  -d '{"company_id": "THE-UUID-HERE", "query": "Company name"}'
```

---

## 4. Definition of done for this task

- [x] Two analysis runs started (Segers Fabriker and Texstar, or two other real companies).
- [x] Runs complete (or fail with observable error in run status / worker logs).
- [x] For at least one completed run:
  - [x] Run status page shows stages and terminal state.
  - [x] Latest report opens and is readable (sections, content).
  - [x] Verification panel shows claim counts (supported / unsupported / uncertain).
- [x] Release gates A–D (DEEP_RESEARCH_STOP_CRITERIA.md) briefly confirmed or gaps noted.

Document any failures (API errors, worker crashes, missing data) and where they occurred (backend log, worker log, browser console). That is enough to “pick up” the final task on another computer and either complete validation or hand back a clear bug list.

---

## 5. Reference

- **Stop criteria and release gates:** [DEEP_RESEARCH_STOP_CRITERIA.md](./DEEP_RESEARCH_STOP_CRITERIA.md)
- **Frontend integration status:** [frontend-integration-review.md](./frontend-integration-review.md)
- **Run status API contract:** [RUN_STATUS_API_FREEZE.md](./RUN_STATUS_API_FREEZE.md)
- **Env and server setup:** repo root [QUICK_START.md](../QUICK_START.md) and [.env.example](../../.env.example).
