# AgroGenie AI — System Architecture

## Overview

AgroGenie AI is a full-stack agentic AI platform for Indian farmers built on IBM Cloud services. The system uses IBM Granite (watsonx.ai) as its AI backbone, with specialized agents for crop recommendations, disease diagnosis, weather forecasting, government schemes, and mandi market prices.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AgroGenie AI Frontend                        │
│                    React 18 + Vite + Lucide Icons                   │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐  │
│  │  Chat    │ │  Crop     │ │ Weather  │ │  Market  │ │Disease │  │
│  │Advisor  │ │ Advisor   │ │Intelligence│ │  Prices  │ │Advisory│  │
│  └──────────┘ └───────────┘ └──────────┘ └──────────┘ └────────┘  │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐  │
│  │Schemes   │ │ Knowledge │ │Dashboard │ │ Profile  │ │  Voice │  │
│  │Discovery │ │   Base    │ │          │ │          │ │        │  │
│  └──────────┘ └───────────┘ └──────────┘ └──────────┘ └────────┘  │
│                                                                     │
│  Axios API Layer → /api/v1/* (Vite Dev Proxy → :5000)              │
└─────────────────────────────────────────────────────────────────────┘
                              │ HTTP/JSON
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Express API Server (:5000)                      │
│                                                                     │
│  Security:  Helmet · CORS · Rate Limiter · Request ID              │
│  Logging:   Morgan (HTTP) · Structured JSON Logger (Pino-style)    │
│  Validation: Payload validator · Upload validator (Multer)         │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     Route Controllers                        │   │
│  │  /chat  /crop-recommendation  /weather  /market  /disease   │   │
│  │  /schemes  /profile  /recommendations  /knowledge  /voice   │   │
│  │  /health  /health/ready                                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  ┌───────────────────────────▼─────────────────────────────────┐   │
│  │                      AGENT ROUTER                           │   │
│  │                   (server/src/agents/router.js)             │   │
│  │                                                             │   │
│  │   Intent Classifier                                         │   │
│  │   Layer 1: Deterministic keywords (WEATHER, MARKET)        │   │
│  │   Layer 2: IBM Granite structured JSON classification       │   │
│  │                                                             │   │
│  │   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │   │
│  │   │ General  │ │Knowledge │ │ Weather  │ │    Market    │ │   │
│  │   │  Agent   │ │  Agent   │ │  Agent   │ │    Agent     │ │   │
│  │   └──────────┘ └──────────┘ └──────────┘ └──────────────┘ │   │
│  │   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │   │
│  │   │  Scheme  │ │  Crop    │ │ Disease  │ │ Orchestrator │ │   │
│  │   │  Agent   │ │  Agent   │ │  Agent   │ │(MULTI_INTENT)│ │   │
│  │   └──────────┘ └──────────┘ └──────────┘ └──────────────┘ │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  ┌───────────────────────────▼─────────────────────────────────┐   │
│  │                    Service Layer                             │   │
│  │  chat.service  weather.service  market.service             │   │
│  │  disease.service  schemes.service  crop.service            │   │
│  │  rag.service  embedding.service  memory.service            │   │
│  │  language.service  explainability.service  followup        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  ┌───────────────────────────▼─────────────────────────────────┐   │
│  │                   Provider Layer                            │   │
│  │  ┌───────────────────────────────────────────────────────┐ │   │
│  │  │          USE_MOCK_PROVIDERS=true → Mock Mode          │ │   │
│  │  │          USE_MOCK_PROVIDERS=false → Real IBM APIs     │ │   │
│  │  └───────────────────────────────────────────────────────┘ │   │
│  │  watsonx.provider  cos.provider  stt.provider  tts.provider│   │
│  │  weather.provider  market.provider  image.provider         │   │
│  │  vision.provider  embedding.provider                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼──────────────────────┐
        ▼                     ▼                      ▼
┌───────────────┐   ┌──────────────────┐   ┌────────────────────────┐
│ MongoDB Atlas │   │  IBM Cloud       │   │  External APIs         │
│               │   │  Services        │   │                        │
│ · conversations│  │  · watsonx.ai   │   │  · Open-Meteo          │
│ · farmer      │   │    (Granite 3)  │   │    (Weather — free)    │
│   profiles    │   │  · Cloud Object │   │  · data.gov.in         │
│ · knowledge   │   │    Storage      │   │    (Agmarknet prices)  │
│   documents   │   │  · Speech to   │   │                        │
│ · knowledge   │   │    Text         │   │                        │
│   chunks      │   │  · Text to      │   │                        │
│ · schemes     │   │    Speech       │   │                        │
└───────────────┘   └──────────────────┘   └────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React | 18.x |
| Frontend Build | Vite | 5.x |
| Frontend Icons | Lucide React | 0.356+ |
| Frontend Charts | Recharts | 2.x |
| Backend Runtime | Node.js | 20 LTS |
| Backend Framework | Express | 4.x |
| Backend Module System | ES Modules (native) | — |
| AI Inference | IBM watsonx.ai (Granite 3 / Llama 3.3) | SDK 1.7+ |
| AI Embeddings | IBM watsonx.ai Slate 125M | — |
| Object Storage | IBM Cloud Object Storage | — |
| Voice Input | IBM Speech to Text | Watson API |
| Voice Output | IBM Text to Speech | Watson API |
| Database | MongoDB Atlas | 7.x |
| ORM | Raw MongoDB driver (no Mongoose) | 7.x |
| Containerization | Docker + Docker Compose | 3.9 |
| Deployment | IBM Cloud Code Engine | — |

---

## Agent Architecture

All AI requests flow through the central Agent Router (`server/src/agents/router.js`). Controllers never call agents directly.

```
POST /api/v1/chat
  └── Chat Controller
      └── Context Middleware (FarmerProfile injection)
          └── Chat Service
              └── Agent Router
                  ├── Intent Classifier
                  │   ├── Layer 1: Keyword rules (WEATHER, MARKET)
                  │   └── Layer 2: IBM Granite structured JSON
                  └── Agent Dispatch
                      ├── GeneralAgent   → IBM Granite (pretrained)
                      ├── KnowledgeAgent → RAG + IBM Granite
                      ├── WeatherAgent   → Open-Meteo + IBM Granite
                      ├── MarketAgent    → Agmarknet + IBM Granite
                      ├── SchemeAgent    → MongoDB + RAG + IBM Granite
                      ├── CropAgent      → Multi-source scoring + IBM Granite
                      ├── DiseaseAgent   → Vision AI + IBM Granite
                      └── Orchestrator   → Parallel MULTI_INTENT
```

### Safety Invariants

1. **WEATHER** queries never route to general Granite — no fabricated forecasts
2. **MARKET** queries never route to general Granite — no fabricated prices  
3. **KNOWLEDGE** responses carry real RAG source cards — sources never invented
4. **SCHEME** eligibility is deterministic — LLM only explains, never decides
5. **DISEASE** diagnoses carry explicit uncertainty warnings
6. Mock mode (`USE_MOCK_PROVIDERS=true`) is always available and produces `isDemo: true` responses

---

## Data Flow — RAG Pipeline

```
Uploaded Document (PDF / TXT)
  └── IBM Cloud Object Storage (storage)
      └── documentLoader.js (retrieve bytes)
          └── textExtractor.js (PDF → text via pdf-parse)
              └── textCleaner.js (normalize whitespace)
                  └── chunker.js (sliding window, configurable overlap)
                      └── embedding.service.js (batched IBM Slate embeddings)
                          └── knowledgeChunk.repository.js (MongoDB upsert)
                              └── development.adapter.js (cosine similarity)

Query:
  embedQuery() → cosine similarity → top-K chunks → IBM Granite → answer + sources
```

---

## Security Architecture

| Concern | Implementation |
|---------|---------------|
| Security headers | Helmet (CSP, X-Frame, X-Content-Type) |
| CORS | Strict allowlist via `CLIENT_URL` + `CORS_EXTRA_ORIGINS` |
| Rate limiting | express-rate-limit (200 req/15min in production) |
| Request tracing | UUID request ID on every request/response |
| Error responses | Standardized `{ success, data, error, meta }` shape |
| Secret handling | Env vars only — never in code or logs |
| Upload validation | MIME type + size limits (Multer + custom filter) |
| Credential protection | Providers never log or return API keys |
| Production errors | Stack traces stripped in production responses |

---

## Folder Structure

```
AgroGenie-AI/
├── Dockerfile                    # Multi-stage production build
├── docker-compose.yml            # Local dev + local MongoDB
├── .dockerignore
├── deployment/                   # IBM Cloud deployment resources
│   ├── README.md
│   ├── env.production.example
│   ├── code-engine.md
│   └── code-engine.yaml
├── docs/                         # Architecture and reference docs
│   ├── Architecture.md           (this file)
│   ├── IBMServices.md
│   ├── DeploymentGuide.md
│   ├── EnvironmentVariables.md
│   └── APIReference.md
├── client/                       # React/Vite frontend
│   ├── src/
│   │   ├── api/                  # Axios API modules (one per feature)
│   │   ├── components/           # Reusable UI components
│   │   ├── context/              # React Context (FarmerContext, ThemeContext)
│   │   ├── pages/                # Page-level components
│   │   └── styles/               # Global CSS
│   └── vite.config.js            # Dev server + proxy config
└── server/                       # Node.js / Express backend
    ├── .env.example              # Environment variable template
    └── src/
        ├── agents/               # Agent Router + all agents
        │   ├── router.js         # Central entry point
        │   ├── intents.js        # Intent constants
        │   ├── agentResult.js    # Result normalization
        │   ├── classifier/       # Intent classifier (2-layer)
        │   ├── general/          # General farming Q&A agent
        │   ├── knowledge/        # RAG knowledge agent
        │   ├── weather/          # Live weather agent (Open-Meteo)
        │   ├── market/           # Mandi price agent (Agmarknet)
        │   ├── scheme/           # Government scheme agent
        │   ├── crop/             # Crop recommendation agent
        │   ├── disease/          # Plant disease agent (Vision AI)
        │   └── orchestration/    # MULTI_INTENT orchestrator
        ├── config/
        │   └── env.js            # Centralized config (NEVER use process.env inline)
        ├── controllers/          # Express controllers (thin layer)
        ├── middleware/           # Auth, context, upload, validation, error
        ├── models/               # MongoDB document schemas (no Mongoose)
        ├── providers/            # External service adapters
        │   └── mock/             # Mock providers (zero credentials)
        ├── rag/                  # RAG ingestion pipeline
        │   └── ingestion/        # Loader, extractor, cleaner, chunker
        ├── repositories/         # MongoDB data access layer
        ├── routes/               # Express route definitions
        ├── services/             # Business logic (domain services)
        ├── utils/                # Logger, API response helpers, asyncHandler
        └── vectorStores/         # Vector similarity adapters
```
