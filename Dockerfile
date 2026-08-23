# ─── Build Stage ───────────────────────────────────────────────────────────

FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Install server dependencies
COPY server/package.json ./server/
RUN cd server && npm ci

# Copy source
COPY . .

# Build frontend
RUN npm run build

# ─── Production Stage ─────────────────────────────────────────────────────

FROM node:20-alpine AS production

WORKDIR /app

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy server
COPY --from=builder /app/server ./server

# Install production dependencies only
RUN cd server && npm ci --only=production

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

# Start server
CMD ["node", "server/index.js"]
