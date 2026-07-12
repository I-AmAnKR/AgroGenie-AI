# AgroGenie AI — Deployment Guide

Complete guide for deploying AgroGenie AI from development to production.

---

## Environments

| Environment | Mode | Credentials | URL |
|-------------|------|-------------|-----|
| Development | Mock | None required | http://localhost:5173 |
| Demo | Mock | None required | Any |
| Production | Real | IBM Cloud required | IBM Code Engine |

---

## Prerequisites

- Node.js 20 LTS
- Docker (for containerized deployment)
- IBM Cloud account with:
  - watsonx.ai service + project
  - Cloud Object Storage instance + bucket
  - Speech to Text instance (optional)
  - Text to Speech instance (optional)
- MongoDB Atlas cluster (M0 free tier works for development)
- data.gov.in API key for live market data (optional)

---

## Local Development

### 1. Install Dependencies

```bash
# From project root — installs all workspaces
npm install
```

### 2. Configure Environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env` — minimum for development (mock mode):
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
USE_MOCK_PROVIDERS=true
```

### 3. Start Development Servers

```bash
# Start both client and server
npm run dev

# Client: http://localhost:5173
# Server: http://localhost:5000/api/v1/health
```

### 4. Enable Real IBM Services

Set in `server/.env`:
```env
USE_MOCK_PROVIDERS=false
WATSONX_API_KEY=...
WATSONX_PROJECT_ID=...
IBM_COS_API_KEY=...
IBM_COS_RESOURCE_INSTANCE_ID=...
IBM_COS_ENDPOINT=...
IBM_COS_BUCKET_NAME=...
MONGODB_URI=mongodb+srv://...
```

---

## Demo Mode

Demo mode seeds sample farmer data and marks all responses as demo:

```env
ENABLE_DEMO_MODE=true
USE_MOCK_PROVIDERS=true   # No credentials required
```

Starting the server in demo mode automatically seeds:
- Sample farmer profile (Rajesh Kumar, Punjab)
- Sample farm (5 acres, loamy soil, drip irrigation)
- Sample conversations (crop, weather, disease, scheme questions)
- Sample crop recommendations (Wheat, Mustard, Chickpea)

---

## Docker Deployment

### Build Image

```bash
docker build -t agrogenie-ai:latest .
```

### Run with Mock Providers

```bash
docker run -p 5000:5000 \
  -e NODE_ENV=production \
  -e USE_MOCK_PROVIDERS=true \
  agrogenie-ai:latest
```

### Run with Real IBM Services

```bash
docker run -p 5000:5000 \
  --env-file server/.env \
  -e NODE_ENV=production \
  agrogenie-ai:latest
```

### Docker Compose (with local MongoDB)

```bash
# Copy and fill environment variables
cp deployment/env.production.example server/.env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f agrogenie

# Verify health
curl http://localhost:5000/api/v1/health
```

---

## IBM Cloud Code Engine

See [`deployment/code-engine.md`](../deployment/code-engine.md) for full instructions.

### Quick Deploy

```bash
# 1. Build and push image
ibmcloud cr login
docker build -t us.icr.io/<namespace>/agrogenie-ai:latest .
docker push us.icr.io/<namespace>/agrogenie-ai:latest

# 2. Deploy
ibmcloud ce project create --name agrogenie-prod
ibmcloud ce app create \
  --name agrogenie-ai \
  --image us.icr.io/<namespace>/agrogenie-ai:latest \
  --port 5000 \
  --env NODE_ENV=production \
  --env USE_MOCK_PROVIDERS=false \
  --env-from-secret agrogenie-secrets
```

---

## Production Checklist

### Environment Variables
- [ ] `NODE_ENV=production`
- [ ] `USE_MOCK_PROVIDERS=false`
- [ ] `MONGODB_URI` → Atlas production cluster
- [ ] `WATSONX_API_KEY` and `WATSONX_PROJECT_ID`
- [ ] `IBM_COS_*` all four variables set
- [ ] `CLIENT_URL` → production frontend URL
- [ ] `LOG_LEVEL=info`
- [ ] `RATE_LIMIT_MAX_PROD` tuned for expected traffic

### Verification

```bash
# Health check
curl https://<your-app>/api/v1/health

# Expected: { "success": true, "data": { "status": "ok", "database": "connected", "ai": "connected" } }

# Readiness probe
curl https://<your-app>/api/v1/health/ready

# Expected: { "success": true, "data": { "status": "ready" } }
```

### Security
- [ ] IBM credentials stored as Code Engine secrets (not in image)
- [ ] CORS `CLIENT_URL` points to the correct frontend origin
- [ ] Rate limiting enabled
- [ ] Helmet security headers active (verify with `curl -I`)

### Performance
- [ ] MongoDB Atlas connection string uses `?retryWrites=true&w=majority`
- [ ] Weather and market in-memory caches are operational
- [ ] Rate limit `RATE_LIMIT_MAX_PROD` is appropriate for expected load

---

## Build Scripts

```bash
# Root — build both workspaces
npm run build          # Will fail until build script added to server — see below

# Client build only
cd client && npm run build

# Server — no separate build step (pure ESM, no transpilation)
# The server runs directly with node src/server.js

# Lint
npm run lint

# Tests
npm test

# Server tests only
cd server && npm test

# Client tests only
cd client && npm run lint
```

---

## Monitoring

### Health Endpoints

| Endpoint | Purpose | Frequency |
|----------|---------|-----------|
| `GET /health` | Liveness probe | Every 30s |
| `GET /health/ready` | Readiness probe | Every 15s |

### Log Format

In production (`NODE_ENV=production`), logs are newline-delimited JSON:
```json
{ "ts": "2026-01-01T00:00:00.000Z", "level": "info", "message": "AgroGenie AI server started", "port": 5000 }
```

In development, logs are human-readable:
```
[2026-01-01T00:00:00.000Z] [INFO] AgroGenie AI server started {"port":5000}
```

### Routing Metrics

In development, access routing metrics:
```bash
curl http://localhost:5000/api/v1/agents/metrics
```

---

## Rollback

```bash
# Re-deploy previous image tag
ibmcloud ce app update \
  --name agrogenie-ai \
  --image us.icr.io/<namespace>/agrogenie-ai:<previous-tag>
```

---

## Troubleshooting

### Server won't start
1. Check `server/.env` exists and is populated
2. Run `cd server && node src/server.js` to see startup errors
3. Look for `[ENV ERROR]` lines in stderr

### MongoDB connection fails
1. Check Atlas cluster is running
2. Verify IP access list includes Code Engine egress IPs
3. Check `MONGODB_URI` format: `mongodb+srv://user:pass@cluster.mongodb.net/dbname`

### IBM Granite errors
1. Verify `WATSONX_API_KEY` is valid (check IBM Cloud IAM)
2. Verify `WATSONX_PROJECT_ID` matches the watsonx.ai project
3. Verify the model ID is available in your region

### IBM COS errors
1. Verify bucket exists and `IBM_COS_ENDPOINT` matches bucket region
2. Check `IBM_COS_RESOURCE_INSTANCE_ID` includes the full CRN
3. Ensure the API key has Writer access to the bucket

### Rate limit errors (429)
1. Increase `RATE_LIMIT_MAX_PROD` in environment
2. Or widen `RATE_LIMIT_WINDOW_MS`
3. In development: rate limits are automatically increased (`RATE_LIMIT_MAX_DEV=1000`)
