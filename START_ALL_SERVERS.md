# Start All Servers - Quick Guide

## Current Status

✅ **Backend:** Running on http://localhost:8000
✅ **Redis:** Running
✅ **RQ Worker:** Running (PID: check with `ps aux | grep "rq worker"`)

❌ **Frontend:** Not running - needs to be started manually

---

## Start Frontend

Open a **new terminal** and run:

```bash
cd /Users/jesper/nivo/frontend
npm run dev
```

Wait for output like:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

Then open: **http://localhost:5173**

---

## Verify All Servers

Run this command to check all servers:

```bash
# Backend
curl http://localhost:8000/health

# Frontend
curl http://localhost:5173

# Redis
redis-cli ping

# RQ Worker
ps aux | grep "rq worker" | grep -v grep
```

---

## Quick Test

Once frontend is running, test the main dashboard:

1. Open http://localhost:5173/dashboard
2. Enter prompt: "Find companies with revenue over 10 million SEK"
3. Click Submit
4. Verify companies appear in the table

---

## All Server Commands (Reference)

### Terminal 1: Backend
```bash
cd /Users/jesper/nivo/backend
source venv/bin/activate
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

### Terminal 2: Redis (if not running as service)
```bash
redis-server
```

### Terminal 3: RQ Worker
```bash
cd /Users/jesper/nivo/backend
source venv/bin/activate
rq worker --url redis://localhost:6379/0
```

### Terminal 4: Frontend
```bash
cd /Users/jesper/nivo/frontend
npm run dev
```

---

## Testing Checklist

Once all servers are running, follow:
- **FRONTEND_TESTING_CHECKLIST.md** - Comprehensive frontend testing guide

