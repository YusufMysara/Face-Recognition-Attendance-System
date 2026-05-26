FROM python:3.10-slim

# Runtime libraries required by OpenCV (used by InsightFace).
# No build-essential or cmake — InsightFace ships pre-built ONNX models.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    libsm6 \
    libxrender1 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies before copying source so this layer is cached.
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

# Copy application source (see .dockerignore for exclusions).
COPY . .

# Railway injects $PORT; default to 8080 if running locally.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
