# Multi-stage Dockerfile for Orchestrall Platform
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat sox ffmpeg
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 orchestrall

# Copy built application
COPY --from=builder --chown=orchestrall:nodejs /app/dist ./dist
COPY --from=builder --chown=orchestrall:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=orchestrall:nodejs /app/prisma ./prisma
COPY --from=builder --chown=orchestrall:nodejs /app/package*.json ./

# Copy bootstrap script
COPY --chmod=755 docker/bootstrap.sh /app/docker/bootstrap.sh

# Create necessary directories
RUN mkdir -p /app/logs /app/uploads /app/backups /tmp/gcp-credentials
RUN chown -R orchestrall:nodejs /app/logs /app/uploads /app/backups /tmp/gcp-credentials

# Switch to non-root user
USER orchestrall

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application with bootstrap script
ENTRYPOINT ["/app/docker/bootstrap.sh"]
CMD ["node", "dist/app.js"]