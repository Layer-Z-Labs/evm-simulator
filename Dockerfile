# Asset Delta Simulator Service Dockerfile
# Use Debian-based image for glibc compatibility with Anvil
FROM node:20-slim AS base

# Install dependencies only when needed
FROM base AS deps
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

# Get Anvil binary from Foundry image
FROM ghcr.io/foundry-rs/foundry:latest AS foundry

FROM base AS runner
WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Copy Anvil binary from Foundry image
COPY --from=foundry /usr/local/bin/anvil /usr/local/bin/anvil

# Create non-root user
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs simulator

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
