# Multi-stage Dockerfile for Orchestrall Platform
# Stage 1: Base
FROM node:18-alpine AS base
WORKDIR /app
RUN apk add --no-cache curl
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Dependencies
FROM base AS dependencies
RUN npm ci
COPY . .

# Stage 3: Development
FROM dependencies AS development
RUN npm install -g nodemon
EXPOSE 3000 9229
CMD ["npm", "run", "dev:zero-config"]

# Stage 4: Build
FROM dependencies AS build
RUN npm run build || echo "No build script found, continuing..."
RUN npm prune --production

# Stage 5: Production
FROM node:18-alpine AS production
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S orchestrall -u 1001

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY --from=build --chown=orchestrall:nodejs /app/src ./src
COPY --from=build --chown=orchestrall:nodejs /app/prisma ./prisma
COPY --from=build --chown=orchestrall:nodejs /app/public ./public
COPY --from=build --chown=orchestrall:nodejs /app/clients ./clients
COPY --from=build --chown=orchestrall:nodejs /app/plugins ./plugins
COPY --from=build --chown=orchestrall:nodejs /app/deployment ./deployment

# Create necessary directories
RUN mkdir -p uploads logs backups && \
    chown -R orchestrall:nodejs uploads logs backups

# Generate Prisma client
RUN npx prisma generate

# Switch to non-root user
USER orchestrall

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "run", "start:zero-config"]
