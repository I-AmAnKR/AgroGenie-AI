/**
 * Mock AI provider — Phase 6 update.
 *
 * Implements both the legacy chat() interface (preserved for backward compat)
 * and the new generate() interface that matches WatsonxProvider.
 *
 * Returns contextually appropriate canned responses with isDemo: true.
 * Replaced by real watsonx.ai when USE_MOCK_PROVIDERS=false.
 */
import { mockAssistantReply } from '../../data/mock/conversations.js'

// ── Helper: pick canned response content based on message text ─────────────

function pickContent(userMessage) {
  const lower = userMessage.toLowerCase()

  if (lower.includes('weather') || lower.includes('rain') || lower.includes('temperature')) {
    return (
      'Weather advisory requires your district and date. I do not have access to live weather data in the current version. ' +
      'For accurate forecasts, please check the India Meteorological Department (IMD) website or your state agriculture department portal. ' +
      '(Demo mode — live weather integration coming in Phase 10.)'
    )
  }
  if (lower.includes('price') || lower.includes('mandi') || lower.includes('market')) {
    return (
      'I do not have access to live mandi prices in the current version. ' +
      'Please check Agmarknet (agmarknet.gov.in) or your state APMC portal for today\'s prices. ' +
      'Never make selling decisions based on demo or estimated data. ' +
      '(Demo mode — live mandi integration coming in Phase 11.)'
    )
  }
  if (lower.includes('scheme') || lower.includes('subsidy') || lower.includes('government') || lower.includes('pm ')) {
    return (
      'I cannot confirm government scheme eligibility without verified scheme data and your complete profile. ' +
      'Common schemes for Indian farmers include PM-KISAN, PMFBY crop insurance, and PM Krishi Sinchayee Yojana. ' +
      'Please contact your local Krishi Vigyan Kendra (KVK) or gram panchayat office to verify eligibility. ' +
      '(Demo mode — RAG-backed scheme agent coming in Phase 12.)'
    )
  }
  if (lower.includes('disease') || lower.includes('pest') || lower.includes('leaf') || lower.includes('symptom')) {
    return (
      'A reliable plant disease diagnosis requires a clear image or a detailed symptom description including: ' +
      'which plant part is affected, colour and pattern of spots or lesions, and how long symptoms have been visible. ' +
      'Please consult your local KVK agronomist for a confirmed diagnosis. ' +
      '(Demo mode — vision AI coming in Phase 16.)'
    )
  }
  if (
    lower.includes('crop') ||
    lower.includes('sow') ||
    lower.includes('plant') ||
    lower.includes('cultivat') ||
    lower.includes('grow')
  ) {
    return (
      'To recommend the right crop, I need a few details: your district and state, current season (Kharif / Rabi / Zaid), ' +
      'soil type, irrigation availability, and your main farming objective (income / food security / market demand). ' +
      'Could you share those? (Demo mode — full AI crop agent coming in Phase 13.)'
    )
  }

  return mockAssistantReply.content
}

// ── Classifier mock: maps message keywords to valid intent JSON ─────────────

/**
 * When the mock provider is called by the intent classifier (detected via
 * systemPrompt containing "intent classifier"), return valid classification JSON
 * so the router reaches the correct agent instead of always falling back to
 * CLARIFICATION.
 */
function pickClassifierJson(userMessage) {
  const lower = userMessage.toLowerCase()
  let primaryIntent = 'GENERAL'

  if (/\b(rain|rainfall|weather|forecast|temperature|humidity|irrigat.*today|today.*rain)\b/i.test(lower)) {
    primaryIntent = 'WEATHER'
  } else if (/\b(price|mandi|market|bhav|rate|apmc)\b/i.test(lower)) {
    primaryIntent = 'MARKET'
  } else if (/\b(scheme|subsidy|pm-kisan|pmfby|government scheme)\b/i.test(lower)) {
    primaryIntent = 'SCHEME'
  } else if (/\b(disease|pest|symptom|leaf.*spot|brown spot|blight|fungus|wilt)\b/i.test(lower)) {
    primaryIntent = 'DISEASE'
  } else if (/\b(which crop|recommend crop|best crop|kharif|rabi|zaid|crop suitab)\b/i.test(lower)) {
    primaryIntent = 'CROP_RECOMMENDATION'
  } else if (/\b(according to|in the document|knowledge base)\b/i.test(lower)) {
    primaryIntent = 'KNOWLEDGE'
  }

  return JSON.stringify({
    primaryIntent,
    secondaryIntents: [],
    confidenceCategory: 'high',
    missingInformation: [],
    requiresLiveData: primaryIntent === 'WEATHER' || primaryIntent === 'MARKET',
    requiresKnowledgeRetrieval: primaryIntent === 'KNOWLEDGE',
  })
}

// ── Provider object ─────────────────────────────────────────────────────────

export const mockAiProvider = {
  /**
   * Normalized generate() interface — matches WatsonxProvider.
   * Used by chat.service.js in Phase 6+.
   *
   * When called by the intent classifier (detected via systemPrompt),
   * returns valid JSON classification instead of a chat response so the
   * Agent Router dispatches to the correct agent.
   *
   * @param {object} options
   * @param {Array<{role, content}>} options.messages - Conversation history (last message is the user turn)
   * @param {string} [options.systemPrompt] - System instruction
   * @param {object} [options.parameters={}] - Generation parameters (ignored in mock)
   * @param {object} [options.metadata={}] - Request metadata (ignored in mock)
   * @returns {Promise<{content, model, provider, usage, finishReason, isDemo}>}
   */
  async generate({ messages, systemPrompt, parameters: _p, metadata: _m }) {
    // Extract the last user message from the conversation history
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
    const userText = lastUserMsg?.content ?? ''

    // Detect classifier calls by the system prompt signature
    const isClassifierCall = typeof systemPrompt === 'string' && systemPrompt.includes('intent classifier')
    const content = isClassifierCall ? pickClassifierJson(userText) : pickContent(userText)

    return {
      content,
      model: 'mock-llm',
      provider: 'mock',
      usage: { inputTokens: null, outputTokens: null },
      finishReason: 'stop',
      isDemo: true,
    }
  },

  /**
   * Legacy chat() interface — preserved for backward compatibility.
   * New code should call generate() instead.
   *
   * @param {string} message - User message text
   * @param {string|null} conversationId - Optional conversation ID
   * @returns {Promise<object>}
   */
  async chat(message, conversationId = null) {
    const content = pickContent(message)
    return {
      conversationId: conversationId ?? `mock-conv-${Date.now()}`,
      message: {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content,
        timestamp: new Date().toISOString(),
      },
      agentActivity: mockAssistantReply.agentActivity,
      sources: [],
      isDemo: true,
    }
  },
}
