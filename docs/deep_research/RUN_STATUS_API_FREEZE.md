# RUN_STATUS_API_FREEZE.md

## Endpoint
GET /analysis/runs/{run_id}

## Response Shape

{
  "run_id": "uuid",
  "company_id": "uuid",
  "status": "running|completed|failed",
  "current_stage": "market_analysis",
  "stages": [
    {
      "stage": "company_profile",
      "status": "completed",
      "started_at": "...",
      "finished_at": "..."
    }
  ]
}

## Contract Guarantees
- stages returned in pipeline order
- status values stable
- timestamps ISO8601