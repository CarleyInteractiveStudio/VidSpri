FROM python:3.9-slim

WORKDIR /app

# Install system dependencies for rembg and opencv
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the isnet-anime model during build
# This avoids networking issues and slow startup times
RUN python -c 'from rembg import new_session; new_session("isnet-anime")'

COPY . .

EXPOSE 7860

# We use port 7860 which is the default for Hugging Face Spaces
# Using gunicorn for better performance and stability
CMD ["gunicorn", "app:app", "--workers", "1", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:7860", "--timeout", "600"]
