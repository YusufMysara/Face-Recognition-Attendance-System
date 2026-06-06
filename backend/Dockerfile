FROM python:3.10-slim

# Runtime libraries required by OpenCV (used by InsightFace).
# curl is added for the docker-compose health check.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    libsm6 \
    libxrender1 \
    libxext6 \
    curl \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies before copying source so this layer is cached.
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

# Copy application source (see .dockerignore for exclusions).
COPY . .

# Strip Windows carriage returns and make the entrypoint executable.
RUN sed -i 's/\r//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

# The entrypoint creates required dirs, initialises the DB, seeds the
# super-admin, then execs uvicorn.
ENTRYPOINT ["./docker-entrypoint.sh"]
