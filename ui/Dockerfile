# HotM UI - Multi-stage Docker build
# Stage 1: Build the React SPA
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci --ignore-scripts

# Copy source code
COPY . .

# Build arguments for environment configuration
ARG VITE_API_BASE_URL=http://localhost:3000
ARG VITE_APP_TITLE=HotM
ARG VITE_DISABLE_WEBSOCKET=false
ARG VITE_GIT_SHA=unknown

# Set environment variables for build
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_APP_TITLE=$VITE_APP_TITLE
ENV VITE_DISABLE_WEBSOCKET=$VITE_DISABLE_WEBSOCKET
ENV VITE_GIT_SHA=$VITE_GIT_SHA

# Build the production bundle
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx configuration
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Add non-root user for security
RUN addgroup -g 1001 -S hotm && \
    adduser -u 1001 -S hotm -G hotm && \
    chown -R hotm:hotm /usr/share/nginx/html && \
    chown -R hotm:hotm /var/cache/nginx && \
    chown -R hotm:hotm /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R hotm:hotm /var/run/nginx.pid

# Expose port 80
EXPOSE 80

# Health check (use 127.0.0.1 to avoid IPv6 issues in Alpine)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/health || exit 1

# Run nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
