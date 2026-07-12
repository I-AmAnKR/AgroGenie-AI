# AgroGenie AI — Environment Variables Reference

Complete reference for all environment variables. Group by service.

---

## Quick Start (Development)

Minimal variables needed for development with mock providers:

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
USE_MOCK_PROVIDERS=true
```

No IBM credentials required in mock mode.

---

## All Variables

### Server

| Variable | Default | Required | Description |
|----------|---------|---------|-------------|
| `PORT` | `5000` | No | HTTP server port |
| `NODE_ENV` | `development` | No | `development` \| `production` \| `test` |
| `CLIENT_URL` | `http://localhost:5173` | Yes | Frontend URL for CORS allowlist |

### Provider Mode

| Variable | Default | Required | Description |
|----------|---------|---------|-------------|
| `USE_MOCK_PROVIDERS` | `true` | No | `true` = mock (demo); `false` = real IBM |
| `ENABLE_DEMO_MODE` | `false` | No | Seed sample data and mark responses `isDemo:true` |

### Security & Rate Limiting

| Variable | Default | Required | Description |
|----------|---------|---------|-------------|
| `CORS_EXTRA_ORIGINS` | `` | No | Extra CORS origins (comma-separated) |
| `RATE_LIMIT_WINDOW_MS` | `900000` | No | Rate limit window (ms). Default: 15 min |
| `RATE_LIMIT_MAX_PROD` | `200` | No | Max requests/window in production |
| `RATE_LIMIT_MAX_DEV` | `1000` | No | Max requests/window in development |

### Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `debug` (dev) / `info` (prod) | `error` \| `warn` \| `info` \| `debug` |

### MongoDB Atlas

| Variable | Default | Required | Description |
|----------|---------|---------|-------------|
| `MONGODB_URI` | `` | Yes (prod) | Atlas connection string |
| `MONGODB_DB_NAME` | `agrogenie` | No | Database name |

### IBM watsonx.ai

| Variable | Default | Required | Description |
|----------|---------|---------|-------------|
| `WATSONX_API_KEY` | `` | Yes (real mode) | IBM Cloud IAM API key |
| `WATSONX_PROJECT_ID` | `` | Yes (real mode) | watsonx.ai Project ID |
| `WATSONX_URL` | `https://us-south.ml.cloud.ibm.com` | No | Regional endpoint |
| `GRANITE_MODEL_ID` | `meta-llama/llama-3-3-70b-instruct` | No | Inference model ID |
| `WATSONX_EMBEDDING_MODEL_ID` | `ibm/slate-125m-english-rtrvr` | Yes (real mode) | Embedding model ID |

### IBM Cloud Object Storage

| Variable | Default | Required | Description |
|----------|---------|---------|-------------|
| `IBM_COS_API_KEY` | `` | Yes (real mode) | COS IAM API key |
| `IBM_COS_RESOURCE_INSTANCE_ID` | `` | Yes (real mode) | COS instance CRN |
| `IBM_COS_ENDPOINT` | `` | Yes (real mode) | Regional S3 endpoint URL |
| `IBM_COS_BUCKET_NAME` | `` | Yes (real mode) | Target bucket name |
| `IBM_COS_AUTH_ENDPOINT` | `https://iam.cloud.ibm.com/identity/token` | No | IAM token endpoint |
| `MAX_UPLOAD_BYTES` | `20971520` | No | Max document size (bytes). Default: 20 MB |

### IBM Speech to Text

| Variable | Default | Required | Description |
|----------|---------|---------|-------------|
| `IBM_STT_API_KEY` | `` | Yes (voice mode) | STT IAM API key |
| `IBM_STT_URL` | `https://api.us-south.speech-to-text.watson.cloud.ibm.com` | No | STT service URL |
| `IBM_IAM_URL` | `https://iam.cloud.ibm.com/identity/token` | No | IAM token endpoint |
| `IBM_STT_MODEL` | `en-US_BroadbandModel` | No | Default STT acoustic model |
| `VOICE_MAX_BYTES` | `5242880` | No | Max audio size (bytes). Default: 5 MB |

### IBM Text to Speech

| Variable | Default | Required | Description |
|----------|---------|---------|-------------|
| `IBM_TTS_API_KEY` | `` | Yes (voice mode) | TTS IAM API key |
| `IBM_TTS_URL` | `https://api.us-south.text-to-speech.watson.cloud.ibm.com` | No | TTS service URL |
| `IBM_TTS_VOICE` | `en-US_AllisonV3Voice` | No | Default English voice |
| `IBM_TTS_VOICE_HI` | `hi-IN_EelaVoice` | No | Hindi voice |
| `IBM_TTS_VOICE_HI_LATN` | `en-US_AllisonV3Voice` | No | Hinglish voice |
| `IBM_TTS_VOICE_PA` | `en-US_AllisonV3Voice` | No | Punjabi voice |
| `TTS_MAX_TEXT_BYTES` | `5000` | No | IBM TTS byte limit |

### Image Upload

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_IMAGE_BYTES` | `5242880` | Max chat image size (bytes). Default: 5 MB |
| `IMAGE_ALLOWED_TYPES` | `image/jpeg,image/png,image/webp` | MIME types for image upload |

### RAG Pipeline

| Variable | Default | Description |
|----------|---------|-------------|
| `RAG_CHUNK_SIZE` | `800` | Chunk size in characters |
| `RAG_CHUNK_OVERLAP` | `100` | Overlap between chunks (characters) |
| `RAG_TOP_K` | `5` | Top chunks retrieved per query |
| `RAG_MIN_SCORE` | `0.30` | Minimum cosine similarity (0.0–1.0) |
| `RAG_EMBEDDING_BATCH_SIZE` | `10` | Chunks per embedding API call |
| `RAG_PROCESSING_VERSION` | `1` | Increment to force re-indexing |

### Weather Agent

| Variable | Default | Description |
|----------|---------|-------------|
| `WEATHER_API_URL` | `https://api.open-meteo.com/v1` | Open-Meteo forecast API |
| `WEATHER_GEOCODING_URL` | `https://geocoding-api.open-meteo.com/v1` | Geocoding API |
| `WEATHER_FORECAST_DAYS` | `7` | Forecast horizon (1–16) |
| `WEATHER_CACHE_TTL_SECONDS` | `900` | In-memory cache TTL (seconds) |
| `WEATHER_REQUEST_TIMEOUT_MS` | `10000` | HTTP timeout (ms) |

### Market Agent

| Variable | Default | Description |
|----------|---------|-------------|
| `MARKET_API_URL` | `https://api.data.gov.in/resource` | Agmarknet API base URL |
| `MARKET_API_KEY` | `` | data.gov.in API key |
| `MARKET_API_RESOURCE_ID` | `9ef84268-d588-465a-a308-a864a43d0070` | Agmarknet resource ID |
| `MARKET_CACHE_TTL_SECONDS` | `1800` | In-memory cache TTL (seconds) |
| `MARKET_REQUEST_TIMEOUT_MS` | `10000` | HTTP timeout (ms) |
| `MARKET_MAX_RECORDS` | `100` | Max records per API call |

### Government Schemes

| Variable | Default | Description |
|----------|---------|-------------|
| `SCHEME_VERIFICATION_STALE_DAYS` | `90` | Days before stale warning triggers |
| `SCHEME_SEARCH_LIMIT` | `10` | Max schemes per search |
| `SCHEME_RAG_TOP_K` | `5` | RAG chunks for scheme questions |

### Crop Recommendation

| Variable | Default | Description |
|----------|---------|-------------|
| `CROP_CANDIDATE_LIMIT` | `15` | Max crop candidates to evaluate |
| `CROP_RESULT_LIMIT` | `3` | Top results to return |
| `CROP_RAG_TOP_K` | `3` | RAG chunks per crop |
| `CROP_SCORING_VERSION` | `1.0.0` | Scoring algorithm version tag |
| `CROP_WEIGHT_SEASON_FIT` | `0.22` | Season fit scoring weight |
| `CROP_WEIGHT_SOIL_FIT` | `0.20` | Soil fit scoring weight |
| `CROP_WEIGHT_WATER_FIT` | `0.20` | Water availability weight |
| `CROP_WEIGHT_LOCATION_FIT` | `0.10` | Geographic suitability weight |
| `CROP_WEIGHT_WEATHER_FIT` | `0.10` | Weather condition weight |
| `CROP_WEIGHT_ROTATION_FIT` | `0.08` | Crop rotation benefit weight |
| `CROP_WEIGHT_MARKET_EVIDENCE` | `0.06` | Market demand weight |
| `CROP_WEIGHT_KNOWLEDGE_FIT` | `0.03` | RAG knowledge match weight |
| `CROP_WEIGHT_SCHEME_SUPPORT` | `0.01` | Government scheme support weight |

### Multilingual

| Variable | Default | Description |
|----------|---------|-------------|
| `LANG_DETECT_HINGLISH_THRESHOLD` | `2` | Min keyword matches for Hinglish |
| `LANG_DETECT_USE_LLM_FALLBACK` | `true` | Use LLM as Tier 3 language detection |

### Farmer Memory & Context

| Variable | Default | Description |
|----------|---------|-------------|
| `MEMORY_MAX_ARRAY_SIZE` | `15` | Max items per memory array |
| `MEMORY_SUMMARIZATION_MIN_MESSAGES` | `4` | Min messages before summarization |
| `CONTEXT_MAX_ITEMS` | `5` | Max memory items injected per prompt |
| `CONTEXT_WEATHER_TTL_DAYS` | `7` | Weather memory TTL (days) |
| `CONTEXT_MARKET_TTL_DAYS` | `30` | Market memory TTL (days) |
| `CONTEXT_DISEASE_TTL_DAYS` | `365` | Disease memory TTL (days) |
| `CONTEXT_CROP_TTL_DAYS` | `180` | Crop recommendation memory TTL (days) |

### Follow-up Engine

| Variable | Default | Description |
|----------|---------|-------------|
| `FOLLOWUP_WEATHER_RAIN_THRESHOLD` | `80` | Rain probability (%) for rain follow-up |
| `FOLLOWUP_WEATHER_HIGH_TEMP_THRESHOLD` | `38` | Temperature (°C) for heat-stress follow-up |
| `FOLLOWUP_DISEASE_CONFIDENCE_THRESHOLD` | `0.80` | Disease confidence for critical follow-up |
| `FOLLOWUP_MARKET_PRICE_SPIKE_THRESHOLD` | `10` | Price rise (%) for spike follow-up |
| `FOLLOWUP_MARKET_PRICE_DROP_THRESHOLD` | `10` | Price fall (%) for drop follow-up |
| `FOLLOWUP_MAX_SUGGESTIONS` | `4` | Max follow-up suggestions returned |
| `FOLLOWUP_HISTORY_DAYS` | `30` | History look-back window (days) |
| `FOLLOWUP_HISTORY_LIMIT` | `10` | Max history records returned |

---

## Variable Validation

On server startup, `server/src/config/env.js` validates:

1. In **production** + **real mode**: missing `MONGODB_URI`, `WATSONX_*`, `IBM_COS_*` → fatal error + process exit
2. In **real mode**: missing `IBM_STT_API_KEY`, `IBM_TTS_API_KEY` → warning only (features degrade gracefully)
3. In **development/test**: all variables are optional — mock providers always available

To test validation:
```bash
cd server && node -e "import('./src/config/env.js')"
```
