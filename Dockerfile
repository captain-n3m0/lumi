# ==========================================================
# Multi-Stage Production Dockerfile for Enterprise Deployment
# Targets Node.js standalone HTTP server via Nitro node-server preset
# ==========================================================

# Stage 1: Build & Package
FROM node:22-alpine AS builder
WORKDIR /app

# Ensure Nitro targets Node.js standalone HTTP server
ENV NITRO_PRESET=node-server
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --legacy-peer-deps; else npm install --legacy-peer-deps; fi

COPY . .

# Build production bundles
RUN npm run build

# Stage 2: Production Minimal Runtime (<150MB total image size)
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV NITRO_PORT=3000
ENV NITRO_HOST=0.0.0.0

# Create a non-root system user for security compliance
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 lumiuser

# Copy only the compiled output bundle
COPY --from=builder --chown=lumiuser:nodejs /app/package.json ./package.json
COPY --from=builder --chown=lumiuser:nodejs /app/.output ./.output

# Expose production port
EXPOSE 3000

USER lumiuser

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

# Start the standalone Node server
CMD ["node", ".output/server/index.mjs"]

