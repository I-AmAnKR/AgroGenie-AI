# AgroGenie AI — Deployment Guide

This directory contains all resources needed to deploy AgroGenie AI on IBM Cloud.

---

## Contents

| File | Purpose |
|------|---------|
| `README.md` | This file — overview |
| `env.production.example` | Production environment variables template |
| `code-engine.md` | IBM Code Engine step-by-step deployment |
| `code-engine.yaml` | IBM Code Engine application manifest |

---

## Quick Start (IBM Cloud Code Engine)

```bash
# 1. Build and push image to IBM Container Registry
ibmcloud cr login
docker build -t us.icr.io/<namespace>/agrogenie-ai:latest .
docker push us.icr.io/<namespace>/agrogenie-ai:latest

# 2. Create Code Engine project
ibmcloud ce project create --name agrogenie-prod

# 3. Deploy application
ibmcloud ce app create \
  --name agrogenie-ai \
  --image us.icr.io/<namespace>/agrogenie-ai:latest \
  --port 5000 \
  --min-scale 1 \
  --max-scale 3 \
  --env-from-secret agrogenie-secrets \
  --cpu 0.5 \
  --memory 1G
```

See [`code-engine.md`](code-engine.md) for complete instructions.

---

## Deployment Checklist

- [ ] `MONGODB_URI` points to Atlas production cluster
- [ ] `WATSONX_API_KEY` and `WATSONX_PROJECT_ID` are set
- [ ] `IBM_COS_*` credentials are configured
- [ ] `CLIENT_URL` is set to the production frontend URL
- [ ] `NODE_ENV=production`
- [ ] `USE_MOCK_PROVIDERS=false`
- [ ] `LOG_LEVEL=info` (or `warn` for minimal logging)
- [ ] Rate limits tuned for expected traffic
- [ ] Health check endpoint verified: `GET /api/v1/health`
- [ ] Readiness probe verified: `GET /api/v1/health/ready`

---

## Architecture Overview

```
Internet
  │
  ▼
IBM Code Engine (Container)
  ├── React frontend (static, served by Express)
  └── Express API (:5000)
       ├── /api/v1/health
       ├── /api/v1/chat → Agent Router → IBM Granite
       ├── /api/v1/weather → Open-Meteo
       ├── /api/v1/market → data.gov.in
       ├── /api/v1/disease → IBM Vision / Granite
       ├── /api/v1/voice → IBM STT / TTS
       └── /api/v1/knowledge → IBM COS + RAG
            │
            ▼
         MongoDB Atlas (managed)
         IBM Cloud Object Storage
         IBM watsonx.ai (Granite 3)
         IBM Speech to Text
         IBM Text to Speech
```
