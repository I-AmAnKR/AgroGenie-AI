import 'dotenv/config'

/**
 * Centralised environment configuration.
 * All modules must import from here — never use process.env directly.
 */

function required(key) {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

function optional(key, defaultValue = '') {
  return process.env[key] ?? defaultValue
}

function optionalBool(key, defaultValue = false) {
  const val = process.env[key]
  if (val === undefined || val === null || val === '') return defaultValue
  return val === 'true' || val === '1'
}

function optionalInt(key, defaultValue = 0) {
  const val = process.env[key]
  if (!val) return defaultValue
  const parsed = parseInt(val, 10)
  return isNaN(parsed) ? defaultValue : parsed
}

const config = {
  server: {
    port: optionalInt('PORT', 5000),
    nodeEnv: optional('NODE_ENV', 'development'),
    isDev: optional('NODE_ENV', 'development') === 'development',
    isProd: optional('NODE_ENV', 'development') === 'production',
    isTest: optional('NODE_ENV', 'development') === 'test',
    // Step 17 — version from package (populated at runtime via npm_package_version)
    version: optional('APP_VERSION', '1.0.0'),
  },

  client: {
    url: optional('CLIENT_URL', 'http://localhost:5173'),
  },

  providers: {
    useMocks: optionalBool('USE_MOCK_PROVIDERS', true),
  },

  // Step 17 Part 6 — Demo Mode
  // ENABLE_DEMO_MODE=true seeds sample data automatically and marks all
  // responses with isDemo:true so the UI can show an appropriate banner.
  demo: {
    enabled: optionalBool('ENABLE_DEMO_MODE', false),
  },

  // Populated in Phase 17A — Rate limiting
  rateLimit: {
    // Sliding window duration in milliseconds (default: 15 minutes)
    windowMs: optionalInt('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
    // Maximum requests per window in production
    maxProd: optionalInt('RATE_LIMIT_MAX_PROD', 200),
    // Maximum requests per window in development (more lenient)
    maxDev: optionalInt('RATE_LIMIT_MAX_DEV', 1000),
  },

  // Populated in Phase 17A — Server security
  security: {
    // Comma-separated extra trusted origins beyond CLIENT_URL (for multi-origin CORS)
    extraOrigins: optional('CORS_EXTRA_ORIGINS', ''),
    // Log level: error | warn | info | debug
    logLevel: optional('LOG_LEVEL', ''),
  },

  // Populated in Phase 5
  db: {
    uri: optional('MONGODB_URI', ''),
    name: optional('MONGODB_DB_NAME', 'agrogenie'),
  },

  // Placeholder — populated in Phase 6
  watsonx: {
    apiKey: optional('WATSONX_API_KEY', ''),
    projectId: optional('WATSONX_PROJECT_ID', ''),
    url: optional('WATSONX_URL', 'https://us-south.ml.cloud.ibm.com'),
    // MODEL_ID supports any watsonx.ai chat model (Llama, Granite, Mistral, etc.)
    modelId: optional('MODEL_ID', 'meta-llama/llama-3-3-70b-instruct'),
  },

  // Populated in Phase 8 — IBM watsonx.ai Embeddings
  rag: {
    embeddingModelId: optional('WATSONX_EMBEDDING_MODEL_ID', ''),
    chunkSize: optionalInt('RAG_CHUNK_SIZE', 800),
    chunkOverlap: optionalInt('RAG_CHUNK_OVERLAP', 100),
    topK: optionalInt('RAG_TOP_K', 5),
    minScore: parseFloat(process.env.RAG_MIN_SCORE ?? '0.30'),
    embeddingBatchSize: optionalInt('RAG_EMBEDDING_BATCH_SIZE', 10),
    processingVersion: optional('RAG_PROCESSING_VERSION', '1'),
  },

  // Populated in Phase 7 — IBM Cloud Object Storage
  cos: {
    apiKey: optional('IBM_COS_API_KEY', ''),
    resourceInstanceId: optional('IBM_COS_RESOURCE_INSTANCE_ID', ''),
    endpoint: optional('IBM_COS_ENDPOINT', ''),
    bucketName: optional('IBM_COS_BUCKET_NAME', ''),
    authEndpoint: optional('IBM_COS_AUTH_ENDPOINT', 'https://iam.cloud.ibm.com/identity/token'),
  },

  // Populated in Phase 7 — document upload limits
  upload: {
    maxBytes: optionalInt('MAX_UPLOAD_BYTES', 20 * 1024 * 1024), // 20 MB default
    maxImageBytes: optionalInt('MAX_IMAGE_BYTES', 5 * 1024 * 1024), // 5 MB default
  },

  // Populated in Phase 11 — Market Agent (data.gov.in Agmarknet / OGD API)
  market: {
    // data.gov.in OGD API base URL
    apiUrl: optional('MARKET_API_URL', 'https://api.data.gov.in/resource'),
    // data.gov.in API key — required for real mode; optional for mock mode
    apiKey: optional('MARKET_API_KEY', '579b464db66ec23bdd000001a6346f1f623b42ce7b1ac7752409e6df'),
    // Agmarknet resource ID on data.gov.in
    resourceId: optional('MARKET_API_RESOURCE_ID', '9ef84268-d588-465a-a308-a864a43d0070'),
    // In-memory cache TTL in seconds (30 min default)
    cacheTtlSeconds: optionalInt('MARKET_CACHE_TTL_SECONDS', 1800),
    // HTTP request timeout in milliseconds
    // data.gov.in is a government host; from cloud egress IPs (Render, etc.)
    // it regularly takes 12–20 s to respond.  30 s avoids spurious timeouts.
    requestTimeoutMs: optionalInt('MARKET_REQUEST_TIMEOUT_MS', 30000),
    // Maximum records to request per provider call
    maxRecords: optionalInt('MARKET_MAX_RECORDS', 100),
  },

  // Populated in Phase 10 — Weather Agent (Open-Meteo; no API key required)
  weather: {
    // Open-Meteo base URL (no authentication required)
    apiUrl: optional('WEATHER_API_URL', 'https://api.open-meteo.com/v1'),
    // Geocoding API URL (Open-Meteo geocoding, no key required)
    geocodingUrl: optional('WEATHER_GEOCODING_URL', 'https://geocoding-api.open-meteo.com/v1'),
    // Number of forecast days to request (1–16 for Open-Meteo)
    forecastDays: optionalInt('WEATHER_FORECAST_DAYS', 7),
    // In-memory cache TTL in seconds (15 min default)
    cacheTtlSeconds: optionalInt('WEATHER_CACHE_TTL_SECONDS', 900),
    // HTTP request timeout in milliseconds
    // Open-Meteo is normally <2s but Render egress latency can spike to 5-8s.
    // 20s avoids spurious timeouts without hanging the user for too long.
    requestTimeoutMs: optionalInt('WEATHER_REQUEST_TIMEOUT_MS', 20000),
  },

  // Populated in Phase 12 — Government Scheme Discovery Agent
  scheme: {
    // Days since lastVerifiedAt before a stale-data warning is added to responses.
    // Scheme details change — records older than this threshold receive a warning.
    verificationStaleDays: optionalInt('SCHEME_VERIFICATION_STALE_DAYS', 90),
    // Maximum number of schemes returned per search/discovery request.
    searchLimit: optionalInt('SCHEME_SEARCH_LIMIT', 10),
    // Top-K chunks to retrieve from the RAG pipeline for detailed scheme questions.
    ragTopK: optionalInt('SCHEME_RAG_TOP_K', 5),
  },

  // Populated in Phase 13 — Crop Recommendation and Decision Intelligence Agent
  crop: {
    // Maximum candidate crops to shortlist before evidence collection.
    candidateLimit: optionalInt('CROP_CANDIDATE_LIMIT', 8),
    // Maximum ranked results to return to the farmer.
    resultLimit: optionalInt('CROP_RESULT_LIMIT', 3),
    // Scoring algorithm version — stored in recommendation persistence for reproducibility.
    scoringVersion: optional('CROP_SCORING_VERSION', '1'),
    // Minimum evidence coverage (%) required to produce a strong recommendation.
    minEvidenceCoverage: optionalInt('CROP_MIN_EVIDENCE_COVERAGE', 65),
    // Top-K RAG chunks per crop for knowledge evidence.
    ragTopK: optionalInt('CROP_RAG_TOP_K', 4),
    // Factor weights — must sum to 1.00 within floating-point tolerance.
    // Documented defaults; do not change these without updating PROGRESS.md.
    weights: {
      seasonFit: parseFloat(process.env.CROP_WEIGHT_SEASON ?? '0.18'),
      soilFit: parseFloat(process.env.CROP_WEIGHT_SOIL ?? '0.17'),
      waterFit: parseFloat(process.env.CROP_WEIGHT_WATER ?? '0.17'),
      locationFit: parseFloat(process.env.CROP_WEIGHT_LOCATION ?? '0.10'),
      weatherFit: parseFloat(process.env.CROP_WEIGHT_WEATHER ?? '0.10'),
      rotationFit: parseFloat(process.env.CROP_WEIGHT_ROTATION ?? '0.08'),
      marketEvidence: parseFloat(process.env.CROP_WEIGHT_MARKET ?? '0.08'),
      knowledgeFit: parseFloat(process.env.CROP_WEIGHT_KNOWLEDGE ?? '0.10'),
      schemeSupport: parseFloat(process.env.CROP_WEIGHT_SCHEME ?? '0.02'),
    },
  },

  // Populated in Phase 14 — Multilingual Text and Voice Interface
  language: {
    // Minimum Hinglish keyword matches to classify as Hinglish (default: 2)
    hinglishThreshold: optionalInt('LANG_DETECT_HINGLISH_THRESHOLD', 2),
    // Use LLM as Tier 3 fallback when heuristics are uncertain.
    // true  = LLM fallback enabled (uses existing AI provider — no extra credentials)
    // false = heuristics only (synchronous, faster)
    useLlmFallback: optionalBool('LANG_DETECT_USE_LLM_FALLBACK', true),
  },

  // Populated in Phase 14B — IBM Cloud Speech to Text (Voice Input)
  stt: {
    // IBM Cloud Speech to Text API key — required when USE_MOCK_PROVIDERS=false
    apiKey: optional('IBM_STT_API_KEY', ''),
    // IBM STT service URL — region-specific (e.g. us-south, eu-gb)
    serviceUrl: optional('IBM_STT_URL', 'https://api.us-south.speech-to-text.watson.cloud.ibm.com'),
    // IBM IAM token endpoint — used to exchange API key for bearer token
    iamUrl: optional('IBM_IAM_URL', 'https://iam.cloud.ibm.com/identity/token'),
    // Maximum audio upload size in bytes (default: 5 MB)
    maxBytes: optionalInt('VOICE_MAX_BYTES', 5 * 1024 * 1024),
    // IBM STT model — ibm/en-US_BroadbandModel (English), ibm/hi-IN_Telephony (Hindi)
    // Default model handles mixed English/Hindi utterances
    defaultModel: optional('IBM_STT_MODEL', 'en-US_BroadbandModel'),
  },

  // Populated in Phase 14C — IBM Cloud Text to Speech (Voice Output)
  tts: {
    // IBM Cloud Text to Speech API key — required when USE_MOCK_PROVIDERS=false
    apiKey: optional('IBM_TTS_API_KEY', ''),
    // IBM TTS service URL — region-specific (e.g. us-south, eu-gb)
    serviceUrl: optional('IBM_TTS_URL', 'https://api.us-south.text-to-speech.watson.cloud.ibm.com'),
    // IBM IAM token endpoint — shared constant with STT
    iamUrl: optional('IBM_IAM_URL', 'https://iam.cloud.ibm.com/identity/token'),
    // Default IBM TTS voice (en-US_AllisonV3Voice is a neural voice available on all plans)
    defaultVoice: optional('IBM_TTS_VOICE', 'en-US_AllisonV3Voice'),
    // Per-language voice overrides — set these to match your provisioned service plan
    // e.g. IBM_TTS_VOICE_HI=hi-IN_EelaVoice (requires Standard/Premium plan)
    voice_hi: optional('IBM_TTS_VOICE_HI', 'hi-IN_EelaVoice'),
    voice_hi_Latn: optional('IBM_TTS_VOICE_HI_LATN', 'en-US_AllisonV3Voice'),
    voice_pa: optional('IBM_TTS_VOICE_PA', 'en-US_AllisonV3Voice'),
    // Maximum text length in bytes before truncation (IBM limit: 5000 bytes)
    maxTextBytes: optionalInt('TTS_MAX_TEXT_BYTES', 5000),
  },
  // Populated in Phase 15D — Image upload via IBM COS (chat image)
  image: {
    // Maximum image upload size in bytes for chat messages (default: 5 MB)
    maxBytes: optionalInt('MAX_IMAGE_BYTES', 5 * 1024 * 1024),
    // Allowed MIME types for image uploads (comma-separated)
    allowedTypes: optional('IMAGE_ALLOWED_TYPES', 'image/jpeg,image/png,image/webp'),
  },

  // Populated in Phase 16A — Farmer Memory Foundation
  memory: {
    // Maximum number of items in each memory array (history, facts, recommendations, warnings)
    // Prevents unbounded growth of the MongoDB FarmerProfile.memory arrays
    maxArraySize: optionalInt('MEMORY_MAX_ARRAY_SIZE', 15),
    // Minimum conversation messages needed before triggering Granite summarization
    summarizationMinMessages: optionalInt('MEMORY_SUMMARIZATION_MIN_MESSAGES', 4),
  },

  // Populated in Phase 16B — Context Injection
  context: {
    // Maximum number of memory items to inject into a single agent prompt
    maxItems: optionalInt('CONTEXT_MAX_ITEMS', 5),
    // TTL for weather memories in days
    weatherTtlDays: optionalInt('CONTEXT_WEATHER_TTL_DAYS', 7),
    // TTL for market memories in days
    marketTtlDays: optionalInt('CONTEXT_MARKET_TTL_DAYS', 30),
    // TTL for disease memories in days
    diseaseTtlDays: optionalInt('CONTEXT_DISEASE_TTL_DAYS', 365),
    // TTL for crop recommendation memories in days
    cropTtlDays: optionalInt('CONTEXT_CROP_TTL_DAYS', 180),
  },

  // Populated in Phase 16D — Smart Follow-up and Personalized Assistance
  followup: {
    // Rain probability % above which a rain warning is triggered
    weatherRainThreshold: optionalInt('FOLLOWUP_WEATHER_RAIN_THRESHOLD', 80),
    // Temperature °C above which a heat-stress warning is triggered
    weatherHighTempThreshold: optionalInt('FOLLOWUP_WEATHER_HIGH_TEMP_THRESHOLD', 38),
    // Disease confidence (0.0-1.0) above which a Critical follow-up is generated
    diseaseConfidenceThreshold: parseFloat(process.env.FOLLOWUP_DISEASE_CONFIDENCE_THRESHOLD ?? '0.80'),
    // Market price change % above which price-spike follow-up is triggered
    marketPriceSpikeThreshold: optionalInt('FOLLOWUP_MARKET_PRICE_SPIKE_THRESHOLD', 10),
    // Market price change % below which price-drop follow-up is triggered
    marketPriceDropThreshold: optionalInt('FOLLOWUP_MARKET_PRICE_DROP_THRESHOLD', 10),
    // Maximum number of follow-up suggestions to return to the frontend
    maxSuggestions: optionalInt('FOLLOWUP_MAX_SUGGESTIONS', 4),
    // Maximum days of recommendation history to include
    historyDays: optionalInt('FOLLOWUP_HISTORY_DAYS', 30),
    // Maximum recommendation history records to return
    historyLimit: optionalInt('FOLLOWUP_HISTORY_LIMIT', 10),
  },
}

/**
 * Step 17 — Part 3: Startup environment validation.
 *
 * In production (USE_MOCK_PROVIDERS=false), warns loudly about missing critical
 * credentials so operators know exactly what to configure — rather than seeing
 * cryptic errors at runtime.
 *
 * Rules:
 *  - Never throws in development/test — development must work without real keys.
 *  - Throws in production ONLY when a required service credential is missing.
 *  - Demo mode (ENABLE_DEMO_MODE=true) switches to mock mode automatically.
 */
export function validateEnv() {
  const isProd = config.server.nodeEnv === 'production'
  const useMocks = config.providers.useMocks
  const isDemoMode = config.demo.enabled
  const warnings = []
  const errors = []

  // ── Demo mode shortcut ─────────────────────────────────────────────────
  if (isDemoMode) {
    process.stderr.write('[ENV] DEMO MODE enabled — all responses will be marked isDemo:true\n')
    // Demo mode implies mock providers; warn if misconfigured
    if (!useMocks) {
      warnings.push('ENABLE_DEMO_MODE=true is set but USE_MOCK_PROVIDERS=false — demo mode will use real IBM credentials')
    }
  }

  // ── MongoDB ────────────────────────────────────────────────────────────
  if (!config.db.uri) {
    if (isProd) {
      errors.push('MONGODB_URI is required in production')
    } else {
      warnings.push('MONGODB_URI not set — running without persistent database')
    }
  }

  // ── IBM watsonx.ai ─────────────────────────────────────────────────────
  if (!useMocks) {
    if (!config.watsonx.apiKey) errors.push('WATSONX_API_KEY is required when USE_MOCK_PROVIDERS=false')
    if (!config.watsonx.projectId) errors.push('WATSONX_PROJECT_ID is required when USE_MOCK_PROVIDERS=false')
    if (!config.watsonx.url) warnings.push('WATSONX_URL not set — using default https://us-south.ml.cloud.ibm.com')

    // ── IBM COS ───────────────────────────────────────────────────────────
    if (!config.cos.apiKey) errors.push('IBM_COS_API_KEY is required when USE_MOCK_PROVIDERS=false')
    if (!config.cos.resourceInstanceId) errors.push('IBM_COS_RESOURCE_INSTANCE_ID is required when USE_MOCK_PROVIDERS=false')
    if (!config.cos.endpoint) errors.push('IBM_COS_ENDPOINT is required when USE_MOCK_PROVIDERS=false')
    if (!config.cos.bucketName) errors.push('IBM_COS_BUCKET_NAME is required when USE_MOCK_PROVIDERS=false')

    // ── IBM STT / TTS ─────────────────────────────────────────────────────
    if (!config.stt.apiKey) warnings.push('IBM_STT_API_KEY not set — voice input will be unavailable')
    if (!config.tts.apiKey) warnings.push('IBM_TTS_API_KEY not set — voice output will be unavailable')

    // ── Embedding model ────────────────────────────────────────────────────
    if (!config.rag.embeddingModelId) {
      warnings.push('WATSONX_EMBEDDING_MODEL_ID not set — RAG operations will fail in real mode')
    }
  }

  // ── Production-specific checks ─────────────────────────────────────────
  if (isProd) {
    if (config.rateLimit.maxProd > 1000) {
      warnings.push('RATE_LIMIT_MAX_PROD is very high — consider tightening for production')
    }
    if (config.server.nodeEnv === 'production' && !config.security.extraOrigins && !config.client.url) {
      warnings.push('CLIENT_URL is not set — CORS will deny all browser requests')
    }
  }

  // ── Log findings ───────────────────────────────────────────────────────
  for (const w of warnings) {
    process.stderr.write(`[ENV WARNING] ${w}\n`)
  }

  if (errors.length > 0) {
    for (const e of errors) {
      process.stderr.write(`[ENV ERROR] ${e}\n`)
    }
    if (isProd) {
      process.stderr.write('[ENV] Fatal: missing required production environment variables. Exiting.\n')
      process.exit(1)
    }
  }

  // ── Return summary for startup logging ────────────────────────────────
  return { errors, warnings }
}

// Run validation immediately on import (async-safe: purely synchronous)
validateEnv()

export default config
