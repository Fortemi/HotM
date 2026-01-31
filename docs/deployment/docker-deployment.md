# Docker Deployment Guide

> **ARCHIVED**: This documentation is for the HotM Desktop Application (v0.1.x) which has been superseded by the React SPA architecture (v0.2.0+).
>
> **Status**: Historical reference only
> **Archived**: 2026-01-31
> **See**: `.aiwg/archive/desktop-era/` for complete desktop documentation
> **Current Architecture**: React SPA consuming matric-memory API (see `.aiwg/architecture/adr/ADR-004-spa-migration.md`)
> **Current Deployment**: Static SPA assets served via Nginx, backend managed by matric-memory repository

---

## Overview
Containerized deployment strategy for the HotM API server, enabling both local development and cloud deployment scenarios.

## Docker Architecture

```yaml
services:
  hotm-api:
    build: ./server
    ports:
      - "53211:53211"
    environment:
      - DATABASE_URL
    depends_on:
      - postgres
      - ollama

  postgres:
    image: pgvector/pgvector:pg14
    volumes:
      - postgres_data:/var/lib/postgresql/data

  ollama:
    image: ollama/ollama
    volumes:
      - ollama_data:/root/.ollama
```

## Server Dockerfile

### Multi-stage Build
```dockerfile
# server/Dockerfile

# Build stage
FROM rust:1.70 as builder

WORKDIR /app

# Cache dependencies
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -rf src

# Build application
COPY . .
RUN touch src/main.rs
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1001 hotm

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/target/release/hotm-server /app/hotm-server

# Copy migrations
COPY --from=builder /app/migrations /app/migrations

# Change ownership
RUN chown -R hotm:hotm /app

USER hotm

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:53211/api/v1/health || exit 1

EXPOSE 53211

CMD ["./hotm-server"]
```

### Development Dockerfile
```dockerfile
# server/Dockerfile.dev

FROM rust:1.70

WORKDIR /app

# Install development tools
RUN cargo install cargo-watch sqlx-cli

# Install dependencies
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build
RUN rm -rf src

# Volume for live code reload
VOLUME ["/app/src"]

EXPOSE 53211

CMD ["cargo", "watch", "-x", "run"]
```

## Docker Compose Configuration

### Production Stack
```yaml
# docker-compose.yml
version: '3.8'

services:
  hotm-api:
    build:
      context: ./server
      dockerfile: Dockerfile
    container_name: hotm-api
    restart: unless-stopped
    ports:
      - "53211:53211"
    environment:
      DATABASE_URL: postgres://hotm:${DB_PASSWORD}@postgres:5432/hotm
      RUST_LOG: hotm_server=info
      OLLAMA_URL: http://ollama:11434
    depends_on:
      postgres:
        condition: service_healthy
      ollama:
        condition: service_started
    networks:
      - hotm-network

  postgres:
    image: pgvector/pgvector:pg14
    container_name: hotm-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: hotm
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: hotm
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./server/migrations:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hotm"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - hotm-network

  ollama:
    image: ollama/ollama:latest
    container_name: hotm-ollama
    restart: unless-stopped
    volumes:
      - ollama_data:/root/.ollama
    ports:
      - "11434:11434"
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    networks:
      - hotm-network

  # Optional: Nginx reverse proxy
  nginx:
    image: nginx:alpine
    container_name: hotm-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/certs:/etc/nginx/certs
    depends_on:
      - hotm-api
    networks:
      - hotm-network

networks:
  hotm-network:
    driver: bridge

volumes:
  postgres_data:
  ollama_data:
```

### Development Stack
```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  hotm-api-dev:
    build:
      context: ./server
      dockerfile: Dockerfile.dev
    container_name: hotm-api-dev
    volumes:
      - ./server/src:/app/src
      - ./server/Cargo.toml:/app/Cargo.toml
    ports:
      - "53211:53211"
    environment:
      DATABASE_URL: postgres://dev:dev@postgres-dev:5432/hotm_dev
      RUST_LOG: debug
      RUST_BACKTRACE: 1
    depends_on:
      - postgres-dev

  postgres-dev:
    image: pgvector/pgvector:pg14
    container_name: hotm-postgres-dev
    environment:
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: hotm_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data

  ollama-dev:
    image: ollama/ollama:latest
    container_name: hotm-ollama-dev
    ports:
      - "11434:11434"
    volumes:
      - ollama_dev_data:/root/.ollama

volumes:
  postgres_dev_data:
  ollama_dev_data:
```

## Nginx Configuration

```nginx
# nginx/nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream hotm_api {
        server hotm-api:53211;
    }

    server {
        listen 80;
        server_name api.hotm.local;

        # Redirect to HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name api.hotm.local;

        ssl_certificate /etc/nginx/certs/cert.pem;
        ssl_certificate_key /etc/nginx/certs/key.pem;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        location /api/ {
            proxy_pass http://hotm_api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # WebSocket support
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        location /health {
            proxy_pass http://hotm_api/api/v1/health;
            access_log off;
        }
    }
}
```

## Environment Configuration

### Production .env
```bash
# .env.production
DB_PASSWORD=secure_password_here
JWT_SECRET=your_jwt_secret_here
API_KEY_SALT=your_api_salt_here
RUST_LOG=hotm_server=info,axum=info
```

### Development .env
```bash
# .env.development
DB_PASSWORD=dev
RUST_LOG=debug
RUST_BACKTRACE=1
```

## Deployment Commands

### Build and Start
```bash
# Production
docker-compose up -d

# Development
docker-compose -f docker-compose.dev.yml up

# Build with no cache
docker-compose build --no-cache

# View logs
docker-compose logs -f hotm-api

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Database Management
```bash
# Run migrations
docker exec hotm-api sqlx migrate run

# Access PostgreSQL
docker exec -it hotm-postgres psql -U hotm

# Backup database
docker exec hotm-postgres pg_dump -U hotm hotm > backup.sql

# Restore database
docker exec -i hotm-postgres psql -U hotm hotm < backup.sql
```

### Ollama Model Management
```bash
# Pull models
docker exec hotm-ollama ollama pull gpt-oss:20b
docker exec hotm-ollama ollama pull nomic-embed-text

# List models
docker exec hotm-ollama ollama list

# Model info
docker exec hotm-ollama ollama show gpt-oss:20b
```

## Kubernetes Deployment

### Deployment Manifest
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hotm-api
  labels:
    app: hotm
spec:
  replicas: 3
  selector:
    matchLabels:
      app: hotm-api
  template:
    metadata:
      labels:
        app: hotm-api
    spec:
      containers:
      - name: hotm-api
        image: hotm/api:latest
        ports:
        - containerPort: 53211
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: hotm-secrets
              key: database-url
        - name: OLLAMA_URL
          value: "http://ollama-service:11434"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/v1/health
            port: 53211
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/v1/health
            port: 53211
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Service Manifest
```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: hotm-api-service
spec:
  selector:
    app: hotm-api
  ports:
    - protocol: TCP
      port: 80
      targetPort: 53211
  type: LoadBalancer
```

## Cloud Deployment

### Azure Container Instances
```bash
# Create resource group
az group create --name hotm-rg --location eastus

# Create container instance
az container create \
  --resource-group hotm-rg \
  --name hotm-api \
  --image hotm/api:latest \
  --cpu 1 \
  --memory 1 \
  --ports 53211 \
  --environment-variables \
    DATABASE_URL=$DATABASE_URL \
    OLLAMA_URL=$OLLAMA_URL
```

### AWS ECS
```json
// task-definition.json
{
  "family": "hotm-api",
  "taskRoleArn": "arn:aws:iam::account:role/ecsTaskRole",
  "networkMode": "awsvpc",
  "containerDefinitions": [
    {
      "name": "hotm-api",
      "image": "hotm/api:latest",
      "memory": 512,
      "cpu": 256,
      "essential": true,
      "portMappings": [
        {
          "containerPort": 53211,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "DATABASE_URL",
          "value": "postgres://..."
        }
      ],
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:53211/api/v1/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3
      }
    }
  ]
}
```

## Monitoring

### Prometheus Metrics
```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

### Health Monitoring Script
```bash
#!/bin/bash
# monitor.sh

API_URL="http://localhost:53211/api/v1/health"

while true; do
  if curl -f $API_URL > /dev/null 2>&1; then
    echo "$(date): API is healthy"
  else
    echo "$(date): API is down!"
    # Send alert
    curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
      -H 'Content-Type: application/json' \
      -d '{"text":"HotM API is down!"}'
  fi
  sleep 60
done
```

## Security Considerations

1. **Use secrets management** for sensitive environment variables
2. **Enable TLS** for all external connections
3. **Implement rate limiting** at the reverse proxy level
4. **Regular security updates** for base images
5. **Network isolation** between services
6. **Non-root user** in containers
7. **Resource limits** to prevent DoS

## Troubleshooting

### Common Issues

#### Container won't start
```bash
# Check logs
docker logs hotm-api

# Inspect container
docker inspect hotm-api

# Shell into container
docker exec -it hotm-api /bin/bash
```

#### Database connection issues
```bash
# Test connection from container
docker exec hotm-api psql $DATABASE_URL -c "SELECT 1"

# Check network
docker network inspect hotm-network
```

#### Performance issues
```bash
# Check resource usage
docker stats hotm-api

# Profile the application
docker exec hotm-api top
```
