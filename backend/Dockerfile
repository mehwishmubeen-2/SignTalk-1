FROM python:3.11-slim

# System libraries OpenCV / MediaPipe need on Linux (ffmpeg is only needed for Whisper)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 libgomp1 libportaudio2 ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# CPU-only PyTorch first (the default Linux wheel is the huge CUDA build)
RUN pip install --no-cache-dir torch==2.14.0 --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONUNBUFFERED=1

# Render provides $PORT. One worker: each worker would load all the models.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]