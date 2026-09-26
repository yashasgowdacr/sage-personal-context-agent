# SAGE Unified Production Container (FastEmbed Python + SAGE Fastify/React Node.js)
FROM python:3.11-slim

# Install system dependencies and Node.js 20
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Install Python FastEmbed dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Pre-cache FastEmbed BAAI/bge-small-en-v1.5 model during build for zero runtime delay
RUN python -c "from fastembed import TextEmbedding; TextEmbedding('BAAI/bge-small-en-v1.5')"

# 2. Install Node.js dependencies
COPY package.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
RUN npm --prefix apps/web install && npm --prefix apps/api install

# 3. Copy source and build
COPY . .
RUN npm --prefix apps/web run build && npm --prefix apps/api run build

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=10000
ENV EMBEDDING_SERVICE_URL=http://127.0.0.1:8000

EXPOSE 10000

CMD ["sh", "-c", "python -m uvicorn services.embeddings.server:app --host 127.0.0.1 --port 8000 & node apps/api/dist/server.js"]
