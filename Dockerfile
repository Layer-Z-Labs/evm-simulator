# Asset Delta Simulator Service Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci && npm cache clean --force

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN npm run build

# Production image with Foundry for Anvil
FROM ghcr.io/foundry-rs/foundry:latest AS foundry

FROM base AS runner
WORKDIR /app

# Install curl for healthcheck and bash for scripts
RUN apk add --no-cache curl bash

# Copy Anvil binary from Foundry image
COPY --from=foundry /usr/local/bin/anvil /usr/local/bin/anvil

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 simulator

# Copy built application with ownership
COPY --from=builder --chown=simulator:nodejs /app/dist ./dist
COPY --from=builder --chown=simulator:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=simulator:nodejs /app/package.json ./package.json

# Create logs directory
RUN mkdir -p /app/logs && chown simulator:nodejs /app/logs

USER simulator

# Expose port
EXPOSE 9000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:9000/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]
