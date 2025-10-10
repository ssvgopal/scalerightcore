# Multi-stage build for optimal image size
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 orchestrall

# Copy the public folder
COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown orchestrall:nodejs .next

# Copy the built application
COPY --from=builder --chown=orchestrall:nodejs /app/.next/standalone ./
COPY --from=builder --chown=orchestrall:nodejs /app/.next/static ./.next/static

USER orchestrall

EXPOSE 3000

ENV PORT 3000
ENV NODE_ENV production

# Start the server
CMD ["node", "server.js"]
