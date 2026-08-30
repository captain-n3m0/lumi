# ==========================================================
# Multi-Stage Production Dockerfile for Lightweight Deployment
# Optimized for standalone Nitro output (AWS EC2, ECS, or Docker)
# ==========================================================

# Stage 1: Build & Package
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --legacy-peer-deps; else npm install --legacy-peer-deps; fi

COPY . .

# Build Vite / TanStack Start production bundles (.output directory contains everything needed)
RUN npm run build

# Stage 2: Production Minimal Runtime (<150MB total image size)
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Create a non-root system user for enterprise security & compliance
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 lumiuser

# Copy only the standalone self-contained output bundle
COPY --from=builder --chown=lumiuser:nodejs /app/.output ./.output

# Expose production port
EXPOSE 3000

USER lumiuser

# Healthcheck for AWS Load Balancer / ECS target group
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

# Start the production server (works across node-server and standalone builds)
CMD ["sh", "-c", "if [ -f .output/server/index.mjs ]; then node .output/server/index.mjs; elif [ -f .output/server/index.js ]; then node .output/server/index.js; elif [ -f dist/server/index.mjs ]; then node dist/server/index.mjs; else node -e 'console.error(\"Listing files:\"); require(\"fs\").readdirSync(\".\").forEach(f => console.error(f));' && exit 1; fi"]

