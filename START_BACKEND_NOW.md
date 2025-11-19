# 🚀 Start Backend Now

## Quick Commands

### 1. Start Backend API
```bash
cd /Users/jesper/nivo
./scripts/start-backend.sh
```

This will:
- ✅ Create virtual environment
- ✅ Install all dependencies  
- ✅ Start FastAPI on port 8000

### 2. Verify It's Running
Open a new terminal and run:
```bash
curl http://localhost:8000/health
```

Should return: `{"status":"healthy","service":"nivo-intelligence-api"}`

### 3. Check API Docs
Visit: http://localhost:8000/docs

## What You'll See

When you run `./scripts/start-backend.sh`, you'll see:
```
🚀 Starting Nivo Intelligence Backend API
==========================================
📦 Creating Python virtual environment...
📥 Installing dependencies...
🔍 Checking environment variables...
✅ Starting FastAPI server on http://localhost:8000
📚 API docs available at http://localhost:8000/docs
```

## If Something Goes Wrong

1. **Missing dependencies?**
   ```bash
   cd backend
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Port 8000 already in use?**
   ```bash
   # Kill process on port 8000
   lsof -ti:8000 | xargs kill -9
   ```

3. **Python version issues?**
   ```bash
   python3 --version  # Should be 3.9+
   ```

## Next Steps After Backend Starts

1. ✅ Backend running on port 8000
2. ✅ Frontend already running
3. ⚠️  Test the Financial Filters page
4. ⚠️  Test AI Report generation

