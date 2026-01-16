# Use official slim Python 3.10 image
FROM python:3.10-slim

# Install system dependencies needed by dlib / face_recognition
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    libx11-6 \
    libglib2.0-0 \
    libglib2.0-dev \
    libsm6 \
    libxrender1 \
    libxext6 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Upgrade pip and install Python dependencies
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Copy the rest of your application code
COPY ./app ./app

# Start the FastAPI server
# Uses Railway's $PORT environment variable, defaults to 8080 if not set
CMD ["sh", "-c", "python seed_admin.py && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
