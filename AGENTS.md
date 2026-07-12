# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project Identity

AgroGenie AI — Agentic AI Smart Farming Advisor for IBM SkillsBuild AICTE 2026.
Monorepo with two workspaces: `client/` (React/Vite) and `server/` (Node/Express).

## Key Rules (Non-Negotiable)

1. **Never expose credentials to the frontend.** All IBM and third-party keys live in `server/.env` only.
2. **Never invent live data.** Weather and mandi prices must come from real provider calls or mock providers — LLM must not fabricate them.
3. **Provider interfaces are mandatory.** All external services (watsonx.ai, COS, Weather, Market) must be accessed through `server/src/providers/`. Direct SDK calls outside providers are forbidden.
4. **Mock mode must always work.** Every provider has a mock implementation. `USE_MOCK_PROVIDERS=true` in `.env` switches the entire stack to mock mode without code changes.
5. **RAG answers must carry source metadata.** Any response generated via RAG must include `sources[]` in its JSON.
6. **AI responses use structured JSON** wherever the agent contract specifies it (see `server/src/agents/*/schema.js`).
7. **Implement phases in order.** Do not jump ahead. Current phase is tracked in `PROGRESS.md`.

## Commands

```bash
# Root (runs both workspaces via concurrently)
npm install          # installs all workspaces
npm run dev          # starts client (Vite :5173) + server (Express :5000) concurrently
npm run lint         # runs ESLint on both workspaces
npm test             # runs Jest (server) + Vitest (client)

# Server only
cd server && npm run dev          # nodemon watch
cd server && npm test             # Jest
cd server && npm test -- --testPathPattern=agents/crop   # single test file

# Client only
cd client && npm run dev          # Vite dev server
cd client && npm test             # Vitest
cd client && npm test -- -t "CropCard"   # single test by name
```

## Architecture Rules

- **Agent Router** (`server/src/agents/router.js`) is the single entry point for all AI calls from controllers. Controllers must not call individual agents directly.
- **watsonx.ai calls** are exclusively in `server/src/providers/watsonx.provider.js`. No service or controller imports the IBM SDK directly.
- **Vector retrieval** results from `server/src/services/rag.service.js` must be passed to Granite as context — Granite must never be called without context for RAG queries.
- **MongoDB sessions/transactions** are required for any multi-document write.
- **Farmer context** (location, crop, soil) is stored in `FarmerProfile` and injected into every agent call via `contextMiddleware`.

## Code Style

- **ES Modules** (`"type": "module"`) in both workspaces — use `import/export`, never `require`.
- **Async/await** only; no `.then()` chains.
- **Error responses** always use `server/src/utils/apiResponse.js` helpers (`success()`, `error()`).
- **Environment variables** are accessed only through `server/src/config/env.js` (never `process.env.X` inline).
- **React components** are `.jsx` files; hooks are `.js` files in `client/src/hooks/`.
- Axios instance with base URL and interceptors lives in `client/src/api/axiosClient.js` — never create ad-hoc Axios instances in components.

## Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Agent files | `<name>.agent.js` | `crop.agent.js` |
| Provider files | `<name>.provider.js` | `weather.provider.js` |
| Service files | `<name>.service.js` | `rag.service.js` |
| Schema files | `<name>.schema.js` | `farmer.schema.js` |
| React pages | PascalCase in `pages/` | `Dashboard.jsx` |
| React components | PascalCase in `components/` | `CropCard.jsx` |
| API routes | kebab-case | `/api/v1/crop-recommendation` |
| Env vars | UPPER_SNAKE | `WATSONX_API_KEY` |

## Directory Highlights

- `server/src/providers/` — all external service adapters (real + mock)
- `server/src/agents/` — one subdirectory per agent; each has `index.js`, `schema.js`, `prompt.js`
- `server/src/services/` — shared services (watsonx, rag, storage)
- `server/src/middleware/` — auth, context injection, error handling
- `client/src/api/` — Axios client + per-feature API modules
- `docs/` — ADRs, schema diagrams, API contracts

## IBM-Specific

- Use `@ibm-cloud/watsonx-ai` SDK for watsonx.ai (not the REST API directly, not `@ibm-cloud/ibm-watson`).
- `IamAuthenticator` is imported from `@ibm-cloud/watsonx-ai/authentication/index.mjs`.
- Object Storage uses `ibm-cos-sdk`. Bucket names and endpoint come from env only.
- Granite model ID is set once in `server/src/config/env.js` as `GRANITE_MODEL_ID`.
- Project ID (`WATSONX_PROJECT_ID`) is required on every inference call.
- AI provider selection lives in `server/src/providers/ai.provider.factory.js` — no scattered env checks.
