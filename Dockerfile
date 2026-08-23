# ─── Stage 1: Build ─────────────────────────────────────────────────────────

FROM node:20-alpine AS build

WORKDIR /app

# Frontend deps (cached until package*.json changes)
COPY package.json package-lock.json ./
RUN npm ci

# Server deps (includes dev for TypeScript compiler)
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci

# Source
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY server/*.ts server/tsconfig.json ./server/

# Build frontend → /app/dist
RUN npm run build

# Build server → /app/server/dist
RUN cd server && npm run build

# ─── Stage 2: Production ────────────────────────────────────────────────────

FROM node:20-alpine AS production

# Run as non-root
RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

# Frontend static files
COPY --from=build /app/dist ./dist

# Server: compiled JS + production deps only
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/package.json ./server/
COPY --from=build /app/server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev && npm cache clean --force

# Switch to non-root
USER app

ENV NODE_ENV=production \
    PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', r => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "server/dist/index.js"]
