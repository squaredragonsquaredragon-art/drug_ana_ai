# ── Stage 1: Build dependencies ─────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: Production image ───────────────────────
FROM python:3.11-slim

# Security: run as non-root
RUN groupadd -r meditrack && useradd -r -g meditrack -s /bin/false meditrack

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application source
COPY . .

# Own files to non-root user
RUN chown -R meditrack:meditrack /app

USER meditrack

EXPOSE 8000

# Production: gunicorn with uvicorn workers (4 workers by default)
CMD ["gunicorn", "server:app", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "4", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--timeout", "120", \
     "--graceful-timeout", "30", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
