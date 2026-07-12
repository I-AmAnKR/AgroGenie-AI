# AgroGenie AI — API Reference

Complete reference for all REST API endpoints.

**Base URL:** `http://localhost:5000/api/v1` (development)

**Response Format:**
```json
{ "success": true, "data": {}, "error": null, "meta": { "requestId": "uuid" } }
{ "success": false, "data": null, "error": { "code": "...", "message": "..." }, "meta": { "requestId": "uuid" } }
```

---

## Health

### GET /health

Liveness probe — is the server process alive?

**Response 200:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "server": "running",
    "version": "1.0.0",
    "uptime": 3600,
    "database": "connected | not-configured | not-connected",
    "ai": "mock | connected | not-configured | error",
    "storage": "mock | connected | unavailable | not-configured",
    "stt": "mock | connected | not-configured",
    "tts": "mock | connected | not-configured",
    "rag": {
      "embeddingProvider": "mock | connected | not-configured",
      "vectorStore": "connected",
      "indexedDocuments": 0
    },
    "weather": { "provider": "mock | connected", "cache": { "size": 0, "ttlSeconds": 900 } },
    "market": { "provider": "mock | connected", "cache": { "size": 0, "ttlSeconds": 1800 } },
    "mockMode": true,
    "demoMode": false,
    "timestamp": "2026-01-01T00:00:00.000Z",
    "environment": "production"
  }
}
```

---

### GET /health/ready

Readiness probe — are all critical dependencies available?

**Response 200 (ready):**
```json
{
  "success": true,
  "data": {
    "status": "ready",
    "checks": {
      "database": "ok | not-configured",
      "ibmGranite": "mock | connected",
      "ibmCOS": "mock | connected",
      "ibmSTT": "mock | connected | not-configured",
      "ibmTTS": "mock | connected | not-configured",
      "mongodb": "ok | not-configured"
    },
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

**Response 503 (not ready):**
```json
{ "success": false, "error": { "code": "NOT_READY", "message": "Service is not ready to accept traffic" } }
```

---

## Chat (Agent Router)

### POST /chat

Route a farmer message through the Agent Router.

**Request:**
```json
{
  "message": "Will it rain tomorrow in Karnal?",
  "language": "en",
  "conversationId": null,
  "userId": "farmer-123",
  "attachments": []
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "conversationId": "uuid",
    "message": { "id": "msg-...", "role": "assistant", "content": "...", "timestamp": "..." },
    "routing": { "intent": "WEATHER", "confidenceCategory": "high" },
    "agentActivity": ["WeatherAgent", "Weather Provider (open-meteo)", "IBM Granite"],
    "sources": [{ "sourceType": "weather_api", "provider": "open-meteo", "location": "Karnal", "cacheHit": false, "isDemo": false }],
    "grounded": true,
    "missingInformation": [],
    "warnings": ["Weather forecasts may change. Check imd.gov.in for official forecasts."],
    "provider": "watsonx",
    "model": "meta-llama/llama-3-3-70b-instruct",
    "isDemo": false,
    "detectedLanguage": "en",
    "weather": { "current": {}, "forecast": [] },
    "market": null,
    "scheme": null,
    "recommendation": null,
    "explainability": null,
    "assistant": { "followUps": [], "history": [], "activity": [], "insights": [] }
  }
}
```

**Supported Intents:**

| Intent | Description |
|--------|-------------|
| `GENERAL` | Agricultural education (Granite pretrained) |
| `KNOWLEDGE` | RAG retrieval from uploaded documents |
| `WEATHER` | Live weather + farming advisory |
| `MARKET` | Mandi/commodity prices |
| `SCHEME` | Government scheme eligibility guidance |
| `CROP_RECOMMENDATION` | Personalized crop selection |
| `DISEASE` | Plant disease identification |
| `MULTI_INTENT` | Multiple intents in one message |
| `CLARIFICATION` | Asking for missing information |

---

## Crop Recommendation

### POST /crop-recommendation

Get AI crop recommendations for the current season and farm conditions.

**Request:**
```json
{
  "location": { "state": "Punjab", "district": "Ludhiana" },
  "soilType": "Loamy",
  "season": "rabi",
  "irrigation": "drip",
  "previousCrops": ["wheat"],
  "farmArea": 2.5,
  "farmAreaUnit": "acres"
}
```

---

## Weather

### GET /weather

Get current weather and forecast for a location.

**Query Parameters:** `location=Karnal` (city name)

### POST /weather/advice

Get farming advice based on weather conditions.

---

## Market Prices

### GET /market/prices

Get mandi market prices.

**Query Parameters:** `commodity=wheat&state=Punjab&district=Ludhiana`

### GET /market/trends

Get commodity price trend analysis.

---

## Disease Analysis

### POST /disease/analyze

Analyze crop disease from symptoms.

**Request (multipart/form-data):**
```
image: <binary>          (optional — disease photo)
crop: "Wheat"
plantPart: "Leaf"
symptomDescription: "Yellow spots on leaves"
```

### POST /disease/image

Upload a disease image for analysis.

---

## Government Schemes

### GET /schemes

Search government agricultural schemes.

**Query Parameters:** `category=insurance&state=Maharashtra`

### GET /schemes/:id

Get a specific scheme by ID.

---

## Voice

### POST /voice/transcribe

Transcribe an audio clip to text.

**Request (multipart/form-data):**
```
audio: <binary>    (audio/webm, audio/wav, audio/ogg, audio/mp4)
language: "en"     (BCP-47 hint)
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "transcript": "Will it rain tomorrow?",
    "detectedLanguage": "en",
    "confidence": 0.95,
    "provider": "ibm-stt",
    "model": "en-US_BroadbandModel",
    "isDemo": false
  }
}
```

### POST /voice/synthesize

Synthesize speech from text.

**Request:**
```json
{ "text": "It will rain tomorrow with 70% probability.", "language": "en" }
```

**Response:** Binary audio stream (`audio/mpeg`)

---

## Knowledge Base

### POST /knowledge/documents

Upload a document (PDF or text).

**Request (multipart/form-data):**
```
file: <binary>      (required — PDF or text)
category: "crop-guides"
tags: ["wheat", "rabi"]
```

### GET /knowledge/documents

List all documents with filters.

**Query Parameters:** `category=crop-guides&status=processed&page=1&limit=20`

### GET /knowledge/documents/:id

Get document metadata.

### GET /knowledge/documents/:id/content

Stream document content.

### DELETE /knowledge/documents/:id

Delete document (COS + MongoDB).

### POST /knowledge/documents/:id/process

Run RAG ingestion pipeline (extract text, chunk, embed).

### POST /knowledge/search

Similarity search.

**Request:** `{ "query": "wheat water requirements", "topK": 5 }`

### POST /knowledge/ask

RAG answer via IBM Granite.

**Request:** `{ "question": "What is the ideal sowing time for wheat in Punjab?" }`

---

## Farmer Profile

### GET /profile/:userId

Get farmer profile.

### PUT /profile/:userId

Update farmer profile.

---

## Recommendations

### GET /recommendations/:userId

Get all recommendation history.

### GET /recommendations/:userId/recent

Get recent recommendations.

---

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request payload |
| `NOT_FOUND` | 404 | Resource not found |
| `UPLOAD_TOO_LARGE` | 413 | File exceeds size limit |
| `UNSUPPORTED_FILE_TYPE` | 415 | MIME type not allowed |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `AI_CONFIGURATION_ERROR` | 500 | IBM Granite not configured |
| `STORAGE_CONFIGURATION_ERROR` | 500 | IBM COS not configured |
| `STT_CONFIGURATION_ERROR` | 500 | IBM STT not configured |
| `TTS_CONFIGURATION_ERROR` | 500 | IBM TTS not configured |
| `MARKET_CONFIGURATION_ERROR` | 500 | Market API not configured |
| `PROVIDER_ERROR` | 502 | External provider error |
| `NOT_READY` | 503 | Service not ready |
