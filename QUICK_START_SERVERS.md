# 🚀 Quick Start - Starting All Servers

## Current Status

✅ **Fixed:**
- `requirements.txt` updated with all dependencies
- Startup scripts created
- Environment variable helper created

## Step-by-Step Setup

### 1. Add Missing Environment Variables

```bash
./scripts/add-missing-env.sh
```

Then edit `.env` and add your actual OpenAI API key:
```bash
OPENAI_API_KEY=sk-your-actual-key-here
```

### 2. Start Backend API

```bash
./scripts/start-backend.sh
```

This will:
- Create Python virtual environment (if needed)
- Install all dependencies
- Start FastAPI on http://localhost:8000
- API docs at http://localhost:8000/docs

### 3. Start Redis (Optional - for background jobs)

```bash
# Install Redis first (if not installed):
brew install redis  # macOS
# or
sudo apt-get install redis-server  # Linux

# Then start it:
./scripts/start-redis.sh
```

### 4. Start Worker (Optional - for background jobs)

```bash
./scripts/start-worker.sh
```

### 5. Frontend (Already Running)

Your frontend is already running on port 3001/8080.

## Quick Start (All at Once)

```bash
# 1. Add missing env vars
./scripts/add-missing-env.sh

# 2. Edit .env and add OPENAI_API_KEY

# 3. Start backend (in a new terminal)
./scripts/start-backend.sh
```

## Verify Everything is Running

```bash
# Check backend
curl http://localhost:8000/health

# Check status
curl http://localhost:8000/status

# Check frontend
curl http://localhost:8080
```

## Troubleshooting

### Backend won't start
- Check Python version: `python3 --version` (needs 3.9+)
- Check virtual environment: `cd backend && source venv/bin/activate`
- Check dependencies: `pip install -r requirements.txt`

### Missing OpenAI key
- Get key from: https://platform.openai.com/api-keys
- Add to `.env`: `OPENAI_API_KEY=sk-...`

### Redis not found
- Install: `brew install redis` (macOS) or use Docker
- Or skip for now - Redis is optional

## Scripts Available

- `./scripts/start-backend.sh` - Start FastAPI backend
- `./scripts/start-redis.sh` - Start Redis server
- `./scripts/start-worker.sh` - Start RQ worker
- `./scripts/check-env.sh` - Check environment variables
- `./scripts/add-missing-env.sh` - Add missing env vars to .env

