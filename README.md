# AgroGenie AI

**Agentic AI Smart Farming Advisor** — IBM SkillsBuild AICTE 2026

A full-stack monorepo with a React frontend, Express backend, IBM watsonx.ai (Granite), MongoDB Atlas, and IBM Cloud Object Storage.

---

## Architecture Overview

### Agent Router (Phase 9–10)

All AI requests from the chat interface route through a central **Agent Router** that classifies intent, selects the appropriate agent, and returns normalized results.

```
Farmer Message
→ Context Middleware (FarmerProfile normalization)
→ Chat Service
→ Agent Router (server/src/agents/router.js)
  → Intent Classifier (deterministic + IBM Granite)
  → Agent Dispatch
    → GeneralAgent         — Granite pretrained knowledge
    → KnowledgeAgent       — RAG over uploaded documents
    → WeatherAgent         — Live weather via Open-Meteo (Phase 10 ✅)
    → MarketAgent          — Mandi prices (Phase 11)
    → SchemeAgent          — Government schemes (Phase 12)
    → CropAgent            — Crop recommendation (Phase 13)
    → DiseaseAgent         — Plant health (Phase 15 ✅)
    → Orchestrator         — MULTI_INTENT parallel dispatch
→ Normalized Agent Result
→ Conversation Persistence
→ Frontend Response
```

### Intent Taxonomy

| Intent | Description | Status |
|--------|-------------|--------|
| `GENERAL` | Agricultural education, Granite pretrained knowledge | ✅ Live |
| `KNOWLEDGE` | Retrieval from uploaded knowledge documents | ✅ Live (RAG) |
| `WEATHER` | Current or forecast weather data | ✅ Live (Phase 10 — Open-Meteo) |
| `MARKET` | Mandi/market price data | 🔜 Phase 11 |
| `SCHEME` | Government scheme information | 🔜 Phase 12 |
| `CROP_RECOMMENDATION` | Personalized crop selection | 🔜 Phase 13 |
| `DISEASE` | Plant-health and symptom analysis | ✅ Live (Phase 15) |
| `MULTI_INTENT` | Multiple independent intents | ✅ Orchestrated |
| `CLARIFICATION` | Missing critical information | ✅ Live |

### Classifier Architecture

**Layer 1 — Deterministic rules (highest priority):**
- Weather keywords (`rain`, `forecast`, `temperature`, `irrigate today`) → `WEATHER`
- Market/price keywords (`mandi price`, `today's tomato price`) → `MARKET`
- These NEVER fall through to Granite — no live-data fabrication is possible

**Layer 2 — IBM Granite structured classification:**
- Ambiguous queries sent to Granite with a structured JSON output prompt
- Response validated against schema; one retry on invalid output
- Safe fallback on complete failure

### Deterministic Routing Protections

> **Non-negotiable safety rules:**
> - `WEATHER` queries **never** route to general Granite — no fabricated forecasts
> - `MARKET` queries **never** route to general Granite — no fabricated prices
> - `KNOWLEDGE` responses carry **real RAG source cards** — sources never invented
> - `GENERAL` responses have `sources: []` — no fake source cards
> - `SCHEME` and `DISEASE` responses warn clearly that unverified data cannot be trusted

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, Lucide |
| Backend | Node.js 20, Express 4 |
| AI Inference | IBM watsonx.ai — IBM Granite |
| AI Embedding | IBM watsonx.ai embedText |
| Object Storage | IBM Cloud Object Storage |
| Database | MongoDB Atlas |
| RAG | Application-side cosine similarity (development adapter) |

---

## Quick Start

```bash
# Install all workspaces from root
npm install

# Copy environment templates
cp server/.env.example server/.env
# Edit server/.env with your IBM Cloud credentials

# Start both client and server
npm run dev
# Client: http://localhost:5173
# Server: http://localhost:5000/api/v1/health
```

### Environment Variables

```env
# server/.env

NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173

# Provider mode
USE_MOCK_PROVIDERS=false        # true = demo mode, false = real IBM APIs

# IBM watsonx.ai
WATSONX_API_KEY=...
WATSONX_PROJECT_ID=...
WATSONX_URL=https://us-south.ml.cloud.ibm.com
GRANITE_MODEL_ID=ibm/granite-3-8b-instruct

# IBM watsonx.ai Embeddings
WATSONX_EMBEDDING_MODEL_ID=ibm/slate-125m-english-rtrvr

# MongoDB Atlas
MONGODB_URI=mongodb+srv://...
MONGODB_DB_NAME=agrogenie

# IBM Cloud Object Storage
IBM_COS_API_KEY=...
IBM_COS_RESOURCE_INSTANCE_ID=...
IBM_COS_ENDPOINT=...
IBM_COS_BUCKET_NAME=...

# RAG Configuration
RAG_CHUNK_SIZE=800
RAG_CHUNK_OVERLAP=100
RAG_TOP_K=5
RAG_MIN_SCORE=0.30

# Weather Agent (Phase 10) — Open-Meteo (NO API KEY REQUIRED)
WEATHER_API_URL=https://api.open-meteo.com/v1
WEATHER_GEOCODING_URL=https://geocoding-api.open-meteo.com/v1
WEATHER_FORECAST_DAYS=7
WEATHER_CACHE_TTL_SECONDS=900
WEATHER_REQUEST_TIMEOUT_MS=10000
```

---

## API Endpoints

### Chat (Phase 9 — Agent Router)

```
POST /api/v1/chat
```

Request:
```json
{
  "message": "Will it rain tomorrow in Nashik?",
  "language": "en",
  "conversationId": null
}
```

Response (WEATHER intent — Phase 10):
```json
{
  "success": true,
  "data": {
    "conversationId": "...",
    "message": { "role": "assistant", "content": "Based on the forecast for Nashik..." },
    "routing": { "intent": "WEATHER", "confidenceCategory": "high" },
    "agentActivity": ["WeatherAgent", "Weather Provider (open-meteo)", "IBM Granite"],
    "sources": [{
      "sourceType": "weather_api",
      "provider": "open-meteo",
      "location": "Nashik, Maharashtra",
      "observedAt": "2025-07-09T08:00:00Z",
      "fetchedAt": "2025-07-09T08:01:00Z",
      "cacheHit": false,
      "isDemo": false
    }],
    "grounded": true,
    "weather": {
      "current": { "temperatureC": 28, "humidityPercent": 65, "condition": "Partly Cloudy", ... },
      "forecast": [{ "date": "2025-07-09", "precipitationProbabilityPercent": 60, ... }]
    },
    "warnings": ["Weather forecasts may change. Check imd.gov.in for official forecasts."],
    "provider": "watsonx",
    "model": "...",
    "isDemo": false
  },
  "error": null,
  "meta": { "requestId": "..." }
}
```

### Knowledge Base (Phase 7 + 8)

```
POST /api/v1/knowledge/documents           — upload document
GET  /api/v1/knowledge/documents           — list documents
POST /api/v1/knowledge/documents/:id/process — run RAG ingestion
POST /api/v1/knowledge/search              — similarity search
POST /api/v1/knowledge/ask                 — RAG answer via Granite
```

### Agent Development (Phase 9 — dev only)

```
POST /api/v1/agents/route-test    — classify intent without executing agent
GET  /api/v1/agents/metrics       — routing metrics counters
```

---

## Weather Agent (Phase 10)

### Provider: Open-Meteo

[Open-Meteo](https://open-meteo.com) is used as the live weather provider. It is free, open-source, and requires **no API key**.

Supported data:
- Current weather observations (temperature, humidity, wind, precipitation)
- Up to 16-day daily forecast (precipitation probability, min/max temperature, conditions)
- Geocoding by city/district name

### Location Resolution Priority

1. **Explicit location in message** — "weather in Jaipur" → uses Jaipur
2. **FarmerProfile** — district + state from stored profile
3. **Clarification** — agent asks "Which district or city should I check?"

Never guesses a location.

### Agricultural Reasoning Boundary

| Responsible Party | Role |
|-------------------|------|
| Weather Provider (Open-Meteo) | Temperature, humidity, rainfall, wind, conditions |
| Weather Agent | Route to provider, resolve location, build context |
| IBM Granite | Interpret weather implications for farming (never invents values) |

### Supported Query Types

| Type | Example |
|------|---------|
| CURRENT_WEATHER | "What is the weather now in Karnal?" |
| RAIN_FORECAST | "Will it rain tomorrow?" |
| IRRIGATION_ADVISORY | "Should I irrigate my wheat today?" |
| SPRAYING_ADVISORY | "Can I spray pesticide tomorrow?" |
| SOWING_WINDOW | "Is this week good for sowing?" |
| HARVEST_ADVISORY | "Should I harvest before the rain?" |
| HEAT_STRESS | "Will high temperature affect my crop?" |
| WIND_RISK | "Is the wind too strong for spraying?" |
| GENERAL_FORECAST | "Give me a 5-day forecast for Nashik" |

### Cache

In-memory TTL cache (15 min default). Prevents repeated API calls for the same location within the freshness window. Cache hits are flagged in source metadata (`cacheHit: true`).

Configure via `WEATHER_CACHE_TTL_SECONDS`.

### Safety Rules

- Granite **never** invents temperature, rainfall, or wind values
- No Granite call if provider retrieval fails
- No silent fallback to mock in real mode
- Forecast always described as uncertain ("probability of", "expected", not "will")
- Soil moisture absence is always disclosed in irrigation advice

### Testing Weather Agent

```bash
cd server && npm test -- --testPathPattern=weather.agent.test
```

---

## Development Commands

```bash
# Server only
cd server && npm run dev          # nodemon
cd server && npm test             # Jest (all tests)
cd server && npm test -- --testPathPattern=weather.agent.test  # Weather tests
cd server && npm test -- --testPathPattern=agents              # All agent tests

# Client only
cd client && npm run dev          # Vite
cd client && npm test             # Vitest

# Lint both workspaces
npm run lint
```

### Running Tests in Mock Mode

Set `USE_MOCK_PROVIDERS=true` in `server/.env` for deterministic tests without IBM Cloud credentials.
In mock mode, the Weather Agent uses demo weather data (tagged `isDemo: true`).

```bash
# With USE_MOCK_PROVIDERS=true
cd server && npm test
```

---

## FarmerProfile Context

FarmerProfile context is injected into every agent call via [`context.middleware.js`](server/src/middleware/context.middleware.js).

Normalized context shape:
```json
{
  "location": { "state": "Maharashtra", "district": "Nashik" },
  "farm": { "area": 4.5, "areaUnit": "acres", "soilType": "Loamy", "irrigationType": "Drip" },
  "cropContext": { "currentCrop": "Onion", "previousCrops": ["Tomato"] },
  "preferences": { "objective": "income", "language": "en" }
}
```

---

## Phase Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| 1–4 | ✅ | Architecture, frontend, backend, integration |
| 5 | ✅ | MongoDB Atlas integration |
| 6 | ✅ | IBM Granite / watsonx.ai integration |
| 7 | ✅ | IBM Cloud Object Storage |
| 8 | ✅ | RAG pipeline (embedding, chunking, retrieval) |
| 9 | ✅ | Agent Router / Orchestration Layer |
| 10 | 🔜 | Weather Agent (live IMD data) |
| 11 | 🔜 | Mandi Price Agent (Agmarknet) |
| 12 | 🔜 | Government Scheme Agent (RAG) |
| 13 | 🔜 | Crop Recommendation Agent |
| 14 | 🔜 | Multilingual Support |
| 15 | 🔜 | Voice Support |
| 16 | 🔜 | Disease Vision AI |
| 17 | 🔜 | Farmer Context Memory |
| 18 | 🔜 | Testing, Deployment |

---

## Known Limitations (Phase 9)

- **Weather Agent**: Returns `capability_not_available`. No live data is connected yet. Farmers are directed to IMD.
- **Market Agent**: Returns `capability_not_available`. No price data is connected yet. Farmers are directed to Agmarknet.
- **Scheme Agent**: Returns `capability_not_available`. Eligibility claims are never made without verified data.
- **Crop Agent**: Requests missing context (location, soil, season); returns placeholder otherwise.
- **Disease Agent**: Returns `capability_not_available`. No vision AI or diagnosis model is connected.
- **Authentication**: Not implemented yet. Farmer identity comes from request body (Phase 17+).
- **Chat history**: Per-conversation only; no cross-session memory (Phase 17+).

---

## Directory Structure

```
AgroGenie-AI/
├── client/                    # React/Vite frontend
│   └── src/
│       ├── api/               # Axios API modules
│       ├── components/        # Reusable components
│       ├── pages/             # Page components
│       └── mocks/             # Frontend mock data
└── server/                    # Node/Express backend
    └── src/
        ├── agents/            # Agent Router + all agents
        │   ├── router.js      # Central entry point
        │   ├── intents.js     # Intent constants
        │   ├── agentResult.js # Result normalization
        │   ├── classifier/    # Intent classifier
        │   ├── general/       # General Agent
        │   ├── knowledge/     # Knowledge Agent
        │   ├── weather/       # Weather Agent (Phase 10)
        │   ├── market/        # Market Agent (Phase 11)
        │   ├── scheme/        # Scheme Agent (Phase 12)
        │   ├── crop/          # Crop Agent (Phase 13)
        │   ├── disease/       # Disease Agent (Phase 16)
        │   └── orchestration/ # MULTI_INTENT orchestrator
        ├── config/            # Environment config
        ├── controllers/       # Express controllers
        ├── middleware/        # Auth, context, validation
        ├── models/            # MongoDB document schemas
        ├── providers/         # External service adapters
        │   └── mock/          # Mock providers (demo mode)
        ├── rag/               # RAG ingestion pipeline
        ├── repositories/      # MongoDB data access
        ├── routes/            # Express route definitions
        ├── services/          # Business logic services
        ├── utils/             # Logger, API response, helpers
        └── vectorStores/      # Vector similarity adapters
```

---

*AgroGenie AI — Empowering Indian farmers with AI-powered agricultural intelligence.*
