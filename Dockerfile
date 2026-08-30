# ==========================================================
# Multi-Stage Production Dockerfile for Enterprise Deployment
# Suitable for AWS ECS, EKS, EC2, App Runner, or Docker Swarm
# ==========================================================

# Stage 1: Build & Package dependencies
FROM node:22-alpine AS builder
WORKDIR /app

# Install build essentials if native modules are needed
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Build Vite / TanStack Start production bundles
RUN npm run build

# Stage 2: Production Minimal Runtime
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Create a non-root system user for enterprise security & compliance
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 umiuser

# Copy built application and node_modules
COPY --from=builder --chown=umiuser:nodejs /app/package.json ./package.json
COPY --from=builder --chown=umiuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=umiuser:nodejs /app/.output ./.output
COPY --from=builder --chown=umiuser:nodejs /app/dist ./dist
COPY --from=builder --chown=umiuser:nodejs /app/src ./src

# Expose production port
EXPOSE 3000

USER umiuser

# Healthcheck for AWS Load Balancer / ECS target group
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

# Start the TanStack Start production server
CMD ["node", ".output/server/index.mjs"]
