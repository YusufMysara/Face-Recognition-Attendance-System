# Base Python image
FROM python:3.10-slim

# Install system dependencies needed by dlib/face_recognition
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    libx11-6 \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for caching
COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Copy application code
COPY ./app ./app

# Start the FastAPI server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
