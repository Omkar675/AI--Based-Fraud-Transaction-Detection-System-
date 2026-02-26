FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies first for cache layer
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code and ML models
COPY . .

# Expose the FastAPI port
EXPOSE 8000

# Run the server
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
