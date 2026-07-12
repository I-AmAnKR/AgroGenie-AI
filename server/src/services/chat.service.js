/**
 * Chat service — Phase 9 update.
 *
 * Updated routing flow:
 *   1. Normalize and validate language
 *   2. Resolve or create conversation (MongoDB when connected, in-memory fallback)
 *   3. Build bounded conversation history (max MAX_HISTORY_MESSAGES)
 *   4. Load FarmerProfile context via context normalization
 *   5. Route through Agent Router → intent classification → agent dispatch
 *   6. Persist user message + assistant response with routing metadata
 *   7. Return normalized API response with routing metadata + agent activity
 *
 * Previous flow (Phase 6):
 *   Chat → Granite Provider (direct)
 *
 * New flow (Phase 9):
 *   Chat → Farmer Context → Agent Router → Selected Agent → Normalized Result
 *   → Conversation Persistence → Frontend Response
 *
 * MongoDB persistence:
 *   - Collection: `conversations`
 *   - Falls back to in-memory Map when DB is not connected (tests / no-DB mode)
 *   - Single-doc update — no transaction required
 *
 * Backward compatibility:
 *   - POST /api/v1/chat contract is preserved.
 *   - Response shape is extended (not broken) with routing, agentActivity, sources.
 *   - Frontend can ignore new fields without breaking.
 *
 * Credentials safety: this service never handles or logs API keys or tokens.
 */
import { v4 as uuidv4 } from 'uuid'
import { route as agentRoute } from '../agents/router.js'
import { normalizeFarmerContext } from '../middleware/context.middleware.js'
import { getProfile } from './profile.service.js'
import { getDb } from './db.service.js'
import { detectLanguage, normalizeLanguage, SUPPORTED_LANGUAGES } from './language.service.js'
import { processConversationMemory } from './memory.service.js'
import config from '../config/env.js'
import logger from '../utils/logger.js'

// Maximum recent messages sent to agents to keep context bounded.
const MAX_HISTORY_MESSAGES = 10

// SUPPORTED_LANGUAGES is now imported from language.service.js (includes 'hi-Latn').
// Re-export for any consumers that imported it from here previously.
export { SUPPORTED_LANGUAGES }

// In-memory store used when MongoDB is not available (tests / demo without DB).
const _memStore = new Map()

// ── Persistence helpers ──────────────────────────────────────────────────────

/**
 * Return the MongoDB conversations collection, or null if DB is not connected.
 */
function getCollection() {
  try {
    return getDb().collection('conversations')
  } catch {
    return null
  }
}

/**
 * Load an existing conversation document by its conversationId.
 * @returns {Promise<object|null>}
 */
async function loadConversation(conversationId) {
  const col = getCollection()
  if (col) {
    return col.findOne({ conversationId }, { projection: { _id: 0 } })
  }
  return _memStore.get(conversationId) ?? null
}

/**
 * Create a new conversation document.
 * @returns {Promise<object>} The created document
 */
async function createConversation(conversationId, userId) {
  const doc = {
    conversationId,
    userId: userId ?? 'anonymous',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
  }
  const col = getCollection()
  if (col) {
    await col.insertOne({ ...doc })
  } else {
    _memStore.set(conversationId, { ...doc })
  }
  return doc
}

/**
 * Append message records to an existing conversation.
 *
 * @param {string} conversationId
 * @param {object[]} newMessages - Message records to append
 */
async function appendMessages(conversationId, newMessages) {
  const col = getCollection()
  const now = new Date().toISOString()
  if (col) {
    await col.updateOne(
      { conversationId },
      {
        $push: { messages: { $each: newMessages } },
        $set: { updatedAt: now },
      }
    )
  } else {
    const doc = _memStore.get(conversationId)
    if (doc) {
      doc.messages.push(...newMessages)
      doc.updatedAt = now
    }
  }
}

// ── Language normalization ────────────────────────────────────────────────────
// normalizeLanguage is imported from language.service.js and supports
// 'en', 'hi', 'hi-Latn', 'pa' (Phase 14).

// ── Main service function ─────────────────────────────────────────────────────

/**
 * Process a chat message through the Agent Router and return a response.
 *
 * @param {string} message - User message text
 * @param {string|null} [conversationId=null] - Existing conversation ID or null for new
 * @param {string} [language='en'] - Explicitly requested language
 * @param {string} userId - Auth user ID or demo-user
 * @param {string} requestId - Trace ID
 * @param {object} [farmerContext] - Normalized farmer profile
 * @param {Array} [attachments=[]] - Image attachments
 * @returns {Promise<object>} Standardised chat response
 */
export async function processChat(
  message,
  conversationId = null,
  language = 'en',
  userId = 'demo-user',
  requestId = null,
  injectedFarmerContext = null,
  attachments = [],
  memoryContext = null
) {
  // ── Language Normalisation ───────────────────────────────────────────────
  // Normalize explicitly provided language, or leave empty to trigger auto-detection below
  const requestedLang = normalizeLanguage(language)

  // ── Resolve or create conversation ──────────────────────────────────────
  let conversation
  let activeConversationId = conversationId

  if (activeConversationId) {
    conversation = await loadConversation(activeConversationId)
    if (!conversation) {
      logger.warn('Received unknown conversationId — starting new conversation', {
        requestId,
        suppliedConversationId: activeConversationId,
      })
      activeConversationId = uuidv4()
      conversation = await createConversation(activeConversationId, userId)
    }
  } else {
    activeConversationId = uuidv4()
    conversation = await createConversation(activeConversationId, userId)
  }

  // ── Build bounded history ────────────────────────────────────────────────
  const allMessages = conversation.messages ?? []
  const conversationHistory = allMessages
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content }))

  // ── Load farmer context ──────────────────────────────────────────────────
  let farmerContext = injectedFarmerContext
  if (!farmerContext) {
    try {
      const rawProfile = await getProfile(userId)
      farmerContext = normalizeFarmerContext(rawProfile)
    } catch {
      farmerContext = normalizeFarmerContext(null)
    }
  }

  // ── Resolve effective language ────────────────────────────────────────────
  // If the request provides a non-default language, use it directly.
  // Otherwise run 3-tier language detection and use the profile hint.
  let lang = requestedLang
  let detectionMethod = 'explicit'
  if (!language || language === 'en') {
    // May be default — run detection to see if the message is actually Hindi/Hinglish
    const profileHint = farmerContext?.preferences?.language ?? null
    const detected = await detectLanguage(message, {
      metadata: { requestId },
      hint: profileHint !== 'en' ? profileHint : null,
    })
    if (detected.language !== 'en') {
      lang = detected.language
      detectionMethod = detected.method
      logger.debug('Chat service: language auto-detected', {
        requestId,
        language: lang,
        method: detectionMethod,
      })
    }
  }

  // ── Route through Agent Router ───────────────────────────────────────────
  let routeResult
  try {
    routeResult = await agentRoute({
      message,
      language: lang,
      userId,
      conversationId: activeConversationId,
      farmerContext,
      conversationHistory,
      attachments,
      memoryContext,
      metadata: {
        requestId,
        conversationId: activeConversationId,
        language: lang,
      },
    })
  } catch (err) {
    logger.error('Chat service: Agent Router failed', {
      requestId,
      conversationId: activeConversationId,
      provider: config.providers.useMocks ? 'mock' : 'watsonx',
      code: err.code ?? 'UNKNOWN',
    })
    throw err
  }

  const { result, routing } = routeResult

  // ── Persist messages ─────────────────────────────────────────────────────
  const now = new Date().toISOString()

  const userMsgRecord = {
    role: 'user',
    content: message,
    timestamp: now,
    language: lang,             // Phase 14: per-message language
    isVoice: false,             // Phase 14B: set true for voice inputs
    provider: null,
    isDemo: null,
    sources: [],
  }

  const assistantMsgRecord = {
    role: 'assistant',
    content: result.answer,
    timestamp: now,
    language: lang,             // Phase 14: per-message language
    provider: result.provider,
    model: result.model,
    isDemo: result.isDemo,
    sources: result.sources ?? [],
    // Routing metadata for conversation history
    intent: result.intent,
    grounded: result.grounded,
    agentUsed: result.agentsUsed?.join(', ') ?? null,
  }

  await appendMessages(activeConversationId, [userMsgRecord, assistantMsgRecord])

  logger.debug('Chat processed successfully', {
    requestId,
    conversationId: activeConversationId,
    intent: result.intent,
    provider: result.provider,
    grounded: result.grounded,
    isDemo: result.isDemo,
  })

  // ── Phase 16A: Asynchronous Memory Summarization ─────────────────────────
  processConversationMemory(
    userId, 
    result.intent, 
    result, 
    [...conversationHistory, userMsgRecord, assistantMsgRecord]
  ).catch(err => logger.error('Memory summarization failed', { error: err.message, requestId }))

  // ── Phase 16C: Explainability Engine ──────────────────────────────────────
  let explainability = null
  try {
    const { generateExplainability } = await import('./explainability.service.js')
    explainability = await generateExplainability(result, routing, memoryContext, { requestId })
  } catch (err) {
    logger.error('Chat service: Explainability generation failed', { error: err.message, requestId })
  }

  // ── Phase 16D: Smart Follow-up and Personalized Assistance ────────────────
  let assistantExtensions = { followUps: [], history: [], activity: [], insights: [] }
  try {
    const { getFarmerMemory } = await import('../repositories/memory.repository.js')
    const { generateFollowUp } = await import('./followup.service.js')
    const { getRecommendationHistory } = await import('./recommendationHistory.service.js')
    const { getActivityTimeline } = await import('./activityTimeline.service.js')

    const rawMemory = await getFarmerMemory(userId)
    assistantExtensions.followUps = generateFollowUp(result, rawMemory, explainability)
    assistantExtensions.history = await getRecommendationHistory(userId)
    assistantExtensions.activity = await getActivityTimeline(userId)
  } catch (err) {
    logger.error('Chat service: Follow-up generation failed', { error: err.message, requestId })
  }

  // ── Return normalized API response ────────────────────────────────────────
  return {
    conversationId: activeConversationId,
    message: {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: result.answer,
      timestamp: assistantMsgRecord.timestamp,
    },
    routing: {
      intent: routing.intent,
      confidenceCategory: routing.confidenceCategory,
    },
    agentActivity: result.agentsUsed ?? [],
    sources: result.sources ?? [],
    grounded: result.grounded,
    missingInformation: result.missingInformation ?? [],
    warnings: result.warnings ?? [],
    provider: result.provider,
    model: result.model,
    isDemo: result.isDemo,
    // Phase 14: language used for this response
    detectedLanguage: lang,
    // Phase 11: pass through market data for frontend rendering
    // Phase 10: weather data is available similarly (result.weather)
    // Phase 12: pass through scheme data for frontend SchemeDataPanel
    // Phase 13: pass through crop recommendation data
    market: result.market ?? null,
    scheme: result.scheme ?? null,
    recommendation: result.recommendation ?? null,
    explainability: explainability ?? null,
    assistant: assistantExtensions
  }
}
