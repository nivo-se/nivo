# Nivo FastAPI backend — for Mac mini / LAN deploy (connects to external Postgres)
FROM python:3.12-slim

WORKDIR /app

# Install backend deps
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy project (backend + scripts, etc.); .env is NOT in the image — use env_file in compose
COPY backend /app/backend

EXPOSE 8000
ENV PYTHONPATH=/app
CMD ["uvicorn", "backend.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
