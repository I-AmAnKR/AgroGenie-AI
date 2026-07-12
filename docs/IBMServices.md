# AgroGenie AI — IBM Cloud Services Guide

All IBM Cloud services used by AgroGenie AI, with setup instructions and configuration references.

---

## Service Overview

| Service | Usage | Required | Mock Available |
|---------|-------|----------|----------------|
| IBM watsonx.ai (Granite) | AI inference, intent classification, agent responses | Yes (real mode) | ✅ Yes |
| IBM watsonx.ai (Slate Embeddings) | RAG document embeddings | Yes (real mode) | ✅ Yes |
| IBM Cloud Object Storage | Document storage, image uploads | Yes (real mode) | ✅ Yes |
| IBM Speech to Text | Voice transcription | Optional | ✅ Yes |
| IBM Text to Speech | Voice output synthesis | Optional | ✅ Yes |

All services can be replaced with mock providers by setting `USE_MOCK_PROVIDERS=true`.

---

## IBM watsonx.ai — Granite Language Model

**SDK Package:** `@ibm-cloud/watsonx-ai` v1.7+  
**Authentication:** IAM API Key (`IamAuthenticator`)  
**Method:** `WatsonXAI.textChat()` (OpenAI-compatible chat API)

### Setup

1. Go to [IBM Cloud Console](https://cloud.ibm.com)
2. Create a **watsonx.ai** service (or use an existing project)
3. Navigate to **Manage → Projects → Your Project**
4. Copy the **Project ID**
5. Go to **IAM → API Keys → Create API Key**
6. Copy the API key

### Environment Variables

```env
WATSONX_API_KEY=<your-iam-api-key>
WATSONX_PROJECT_ID=<your-project-id>
WATSONX_URL=https://us-south.ml.cloud.ibm.com
GRANITE_MODEL_ID=meta-llama/llama-3-3-70b-instruct
```

### Supported Models

| Model ID | Use Case |
|----------|---------|
| `meta-llama/llama-3-3-70b-instruct` | Default — best quality |
| `ibm/granite-3-8b-instruct` | Faster, smaller footprint |
| `ibm/granite-13b-chat-v2` | IBM-native chat model |

The model ID is configurable via `GRANITE_MODEL_ID` without code changes.

### Code Reference

```javascript
// server/src/providers/watsonx.provider.js
import { WatsonXAI } from '@ibm-cloud/watsonx-ai'
// Authentication and inference via IamAuthenticator
```

### Usage in AgroGenie

- Intent classification (structured JSON output)
- All agent responses (weather advisory, scheme guidance, crop recommendations)
- RAG answer generation (grounded responses with citations)
- Language detection fallback (Tier 3)
- Conversation memory summarization

---

## IBM watsonx.ai — Slate Embeddings

**Model:** `ibm/slate-125m-english-rtrvr` (default)  
**Method:** `WatsonXAI.embedText()`

### Setup

Uses the same `WATSONX_API_KEY` and `WATSONX_PROJECT_ID` as Granite — no separate credentials needed.

### Environment Variables

```env
WATSONX_EMBEDDING_MODEL_ID=ibm/slate-125m-english-rtrvr
```

### Supported Embedding Models

| Model ID | Dimensions | Use Case |
|----------|-----------|---------|
| `ibm/slate-125m-english-rtrvr` | 768 | Default — retrieval-optimized |
| `ibm/slate-30m-english-rtrvr` | 384 | Lighter, faster |

### Usage in AgroGenie

- Document chunk embeddings (during RAG ingestion)
- Query embedding (at retrieval time)
- Cosine similarity search via in-process `development.adapter.js`

---

## IBM Cloud Object Storage (COS)

**SDK Package:** `ibm-cos-sdk` (S3-compatible)  
**Authentication:** IAM API Key

### Setup

1. Go to IBM Cloud → **Resource List → Cloud Object Storage**
2. Create or select a COS instance
3. Navigate to **Service Credentials → New Credential**
4. Enable **HMAC credentials** if needed
5. Note the **API key** and **resource instance ID**
6. Create a bucket (e.g., `agrogenie-knowledge`) and note the endpoint

### Finding the Endpoint

1. Navigate to your COS instance
2. Click on your bucket
3. Go to **Configuration → Endpoints**
4. Use the **Public** endpoint for production (e.g., `https://s3.us-south.cloud-object-storage.appdomain.cloud`)

### Environment Variables

```env
IBM_COS_API_KEY=<your-cos-api-key>
IBM_COS_RESOURCE_INSTANCE_ID=crn:v1:bluemix:public:cloud-object-storage:global:...
IBM_COS_ENDPOINT=https://s3.us-south.cloud-object-storage.appdomain.cloud
IBM_COS_BUCKET_NAME=agrogenie-knowledge
IBM_COS_AUTH_ENDPOINT=https://iam.cloud.ibm.com/identity/token
```

### Object Key Schema

```
knowledge/                      # Category prefix
  {uuid}-{sanitized-filename}   # e.g. a1b2c3-wheat-guide.pdf

disease-images/
  {uuid}-{sanitized-filename}   # e.g. b4c5d6-leaf-rust.jpg
```

### Usage in AgroGenie

- Knowledge document storage (uploaded PDFs, text files)
- Disease analysis image storage
- Compensation: if MongoDB write fails after COS upload, COS object is deleted

---

## IBM Speech to Text (STT)

**Authentication:** IAM API Key  
**REST API** (not SDK — direct HTTP calls for streaming support)

### Setup

1. Go to IBM Cloud → **Create a resource → Speech to Text**
2. Select your pricing plan (Lite is free, 500 min/month)
3. Navigate to **Service Credentials → New Credential**
4. Copy the **API key** and **service URL**

### Environment Variables

```env
IBM_STT_API_KEY=<your-stt-api-key>
IBM_STT_URL=https://api.us-south.speech-to-text.watson.cloud.ibm.com
IBM_IAM_URL=https://iam.cloud.ibm.com/identity/token
IBM_STT_MODEL=en-US_BroadbandModel
VOICE_MAX_BYTES=5242880
```

### Supported Models

| Model | Language | Use Case |
|-------|---------|---------|
| `en-US_BroadbandModel` | English (US) | Primary model |
| `hi-IN_Telephony` | Hindi | Switched automatically when `language=hi` |

### Usage in AgroGenie

- POST `/api/v1/voice/transcribe` — audio buffer → transcript
- Language hint passed to IBM STT for model selection
- Transcript language auto-detected and returned to frontend

---

## IBM Text to Speech (TTS)

**Authentication:** IAM API Key  
**REST API** (direct HTTP calls)

### Setup

1. Go to IBM Cloud → **Create a resource → Text to Speech**
2. Select your pricing plan
3. Navigate to **Service Credentials → New Credential**
4. Copy the **API key** and **service URL**

### Environment Variables

```env
IBM_TTS_API_KEY=<your-tts-api-key>
IBM_TTS_URL=https://api.us-south.text-to-speech.watson.cloud.ibm.com
IBM_TTS_VOICE=en-US_AllisonV3Voice
IBM_TTS_VOICE_HI=hi-IN_EelaVoice
IBM_TTS_VOICE_HI_LATN=en-US_AllisonV3Voice
IBM_TTS_VOICE_PA=en-US_AllisonV3Voice
TTS_MAX_TEXT_BYTES=5000
```

### Voice Selection by Language

| Language Code | Voice |
|--------------|-------|
| `en` (English) | `en-US_AllisonV3Voice` |
| `hi` (Hindi) | `hi-IN_EelaVoice` (Standard/Premium plan required) |
| `hi-Latn` (Hinglish) | `en-US_AllisonV3Voice` |
| `pa` (Punjabi) | `en-US_AllisonV3Voice` |

### Usage in AgroGenie

- POST `/api/v1/voice/synthesize` — text → audio buffer (audio/mpeg)
- Automatic voice selection based on detected response language
- Text truncated to `TTS_MAX_TEXT_BYTES` (IBM limit: 5000 bytes)

---

## Mock Mode

When `USE_MOCK_PROVIDERS=true`, all IBM services are replaced with deterministic in-memory mocks:

| Real Provider | Mock Provider | Behavior |
|--------------|--------------|---------|
| `watsonx.provider.js` | `mock-ai.provider.js` | Returns scripted farming responses |
| `watsonx-embedding.provider.js` | `mock-embedding.provider.js` | Returns deterministic 384d vectors |
| `cos.provider.js` | `mock-storage.provider.js` | In-memory Map storage |
| `stt.provider.js` | `mock-stt.provider.js` | Returns fixed Hindi/English transcript |
| `tts.provider.js` | `mock-tts.provider.js` | Returns 1-second silent WAV |
| `vision.provider.js` | `mock-vision.provider.js` | Returns scripted disease result |
| `weather.provider.js` | `mock-weather.provider.js` | Returns seasonal demo data |
| `market.provider.js` | `mock-market.provider.js` | Returns representative mandi prices |

All mock responses are tagged `isDemo: true` in the API response so the frontend can show an appropriate indicator.

---

## IAM Policy Requirements

For production deployments, create a dedicated service ID with minimal permissions:

| Service | Required Role |
|---------|--------------|
| watsonx.ai | Manager (project-level) |
| Cloud Object Storage | Writer (bucket-level) |
| Speech to Text | Manager |
| Text to Speech | Manager |

```bash
# Create service ID
ibmcloud iam service-id-create agrogenie-prod-service

# Assign policies
ibmcloud iam service-policy-create agrogenie-prod-service \
  --roles Manager \
  --service-name pm-20  # watsonx.ai
```
