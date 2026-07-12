# ── AgroGenie AI — Production Dockerfile ─────────────────────────────────────
#
# Multi-stage build:
#   Stage 1 (client-build): React/Vite frontend → static dist/
#   Stage 2 (server):       Node.js Express backend, serves static files
#
# Usage:
#   docker build -t agrogenie-ai .
#   docker run -p 5000:5000 --env-file server/.env agrogenie-ai
#
# IBM Code Engine:
#   ibmcloud ce app create --name agrogenie-ai --image <registry>/agrogenie-ai:latest
#   See deployment/code-engine.md for full instructions.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build React frontend ────────────────────────────────────────────
FROM node:20-alpine AS client-build

WORKDIR /app/client

# Install client dependencies
COPY client/package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy client source and build
COPY client/ ./
RUN npm run build

# ── Stage 2: Production server ────────────────────────────────────────────────
FROM node:20-alpine AS server

# Security: run as non-root user
RUN addgroup -S agrogenie && adduser -S agrogenie -G agrogenie

WORKDIR /app

# Install server dependencies only
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev --ignore-scripts

# Copy server source
COPY server/src ./server/src

# Copy built frontend into server's public directory (served as static files)
COPY --from=client-build /app/client/dist ./client/dist

# Use non-root user
USER agrogenie

WORKDIR /app/server

# Expose port (configurable via PORT env var)
EXPOSE 5000

# Health check — Docker and Kubernetes liveness probe
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "import('http').then(({default: h}) => h.get('http://localhost:5000/api/v1/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1)))"

# Environment defaults (override with --env-file or -e flags)
ENV NODE_ENV=production \
    PORT=5000 \
    # USE_MOCK_PROVIDERS=true

# Start production server
CMD ["node", "src/server.js"]
