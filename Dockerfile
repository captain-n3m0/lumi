# ==========================================================
# Multi-Stage Production Dockerfile for Enterprise Deployment
# Targets Node.js standalone HTTP server via Nitro node-server preset
# ==========================================================

# Stage 1: Build & Package
FROM node:22-alpine AS builder
WORKDIR /app

# Ensure Nitro targets Node.js standalone HTTP server
ENV PATH=/app/node_modules/.bin:$PATH
ENV NITRO_PRESET=node-server

COPY package.json package-lock.json* ./
# Install all dependencies including devDependencies needed for building
RUN npm install --include=dev --legacy-peer-deps

COPY . .

# Accept client-side build arguments for Vite
ARG VITE_ALCHEMY_API_KEY
ENV VITE_ALCHEMY_API_KEY=$VITE_ALCHEMY_API_KEY

ARG VITE_INFURA_API_KEY
ENV VITE_INFURA_API_KEY=$VITE_INFURA_API_KEY

# Build production bundles with NODE_ENV=production
ENV NODE_ENV=production
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

