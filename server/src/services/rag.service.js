/**
 * RAG service — Phase 8.
 *
 * Provides the retrieval-augmented generation pipeline:
 *   1. Embed the user query
 *   2. Similarity search against indexed chunks
 *   3. Apply minimum score threshold
 *   4. Deduplicate sources at document level
 *   5. Build grounded prompt
 *   6. Call IBM Granite via AI provider
 *   7. Return answer with source metadata
 *
 * This service is the primary integration point for RAG answers.
 * The Agent Router (Phase 9) will call this service when a query
 * requires grounded knowledge base retrieval.
 *
 * For Phase 8, RAG is exposed through dedicated /knowledge/ask and
 * /knowledge/search endpoints only. The chat endpoint is not yet wired.
 */
import { embedQuery } from './embedding.service.js'
import { vectorStoreAdapter } from '../vectorStores/development.adapter.js'
import { getAiProvider } from '../providers/ai.provider.factory.js'
import { buildRagSystemPrompt, buildRagUserMessage } from '../rag/prompts/rag.prompt.js'
import config from '../config/env.js'
import logger from '../utils/logger.js'

// ── Source deduplication ──────────────────────────────────────────────────────

/**
 * Deduplicate chunks into document-level source cards.
 * Multiple chunks from the same document are merged — page numbers combined,
 * single source card returned per document.
 *
 * @param {object[]} chunks - Retrieved chunks (with documentId, title, etc.)
 * @returns {object[]} Deduplicated document-level source cards
 */
function deduplicateSources(chunks) {
  const map = new Map()
  for (const chunk of chunks) {
    if (!map.has(chunk.documentId)) {
      map.set(chunk.documentId, {
        documentId: chunk.documentId,
        title: chunk.title,
        organization: chunk.organization,
        documentDate: chunk.documentDate,
        category: chunk.category,
        language: chunk.language,
        sourceUrl: chunk.sourceUrl,
        pageNumbers: new Set(),
      })
    }
    if (chunk.pageNumber !== null && chunk.pageNumber !== undefined) {
      map.get(chunk.documentId).pageNumbers.add(chunk.pageNumber)
    }
  }

  return Array.from(map.values()).map((s) => ({
    ...s,
    pageNumbers: Array.from(s.pageNumbers).sort((a, b) => a - b),
  }))
}

// ── RAG retrieval (search only) ───────────────────────────────────────────────

/**
 * Retrieve relevant chunks for a query — no Granite generation.
 * Useful for testing retrieval quality and the RAG Test Console.
 *
 * @param {object} params
 * @param {string} params.query - Search query text
 * @param {number} [params.topK] - Number of results (overrides config default)
 * @param {object} [params.filters={}] - Metadata filters (category, language)
 * @param {number} [params.minScore] - Min score threshold (overrides config default)
 * @returns {Promise<object>} Retrieval result with scored chunks
 */
export async function searchKnowledge({ query, topK, filters = {}, minScore }) {
  const k = topK ?? config.rag.topK
  const scoreThreshold = minScore ?? config.rag.minScore

  logger.debug('RAG search', { query: query.slice(0, 80), k, filters, scoreThreshold })

  // Embed the query
  const queryEmbedding = await embedQuery(query)

  // Similarity search
  const rawChunks = await vectorStoreAdapter.similaritySearch(
    queryEmbedding.vector,
    k,
    filters,
    scoreThreshold
  )

  const results = rawChunks.map((chunk) => ({
    chunkId: chunk.chunkId,
    documentId: chunk.documentId,
    score: Math.round(chunk.score * 10000) / 10000, // 4 decimal places
    textPreview: chunk.text.slice(0, 300) + (chunk.text.length > 300 ? '…' : ''),
    source: {
      title: chunk.title,
      organization: chunk.organization,
      documentDate: chunk.documentDate,
      pageNumber: chunk.pageNumber,
      category: chunk.category,
    },
  }))

  return {
    query,
    results,
    filters,
    topK: k,
    minScore: scoreThreshold,
    resultCount: results.length,
    embeddingModel: queryEmbedding.model,
    embeddingProvider: queryEmbedding.provider,
  }
}

// ── RAG answer (retrieval + generation) ──────────────────────────────────────

/**
 * Ask the knowledge base a question and generate a grounded answer via Granite.
 *
 * @param {object} params
 * @param {string} params.question - Farmer's question
 * @param {string} [params.language='en'] - Response language code
 * @param {number} [params.topK] - Number of chunks to retrieve
 * @param {object} [params.filters={}] - Metadata filters
 * @param {object} [params.metadata={}] - Request metadata for logging
 * @returns {Promise<object>} RAG answer with sources
 */
export async function askKnowledge({ question, language = 'en', topK, filters = {}, memoryContext = null, metadata = {} }) {
  const k = topK ?? config.rag.topK
  const scoreThreshold = config.rag.minScore

  logger.debug('RAG ask', {
    requestId: metadata.requestId,
    question: question.slice(0, 80),
    k,
    language,
  })

  // ── Embed query ──────────────────────────────────────────────────────────────
  const queryEmbedding = await embedQuery(question, { metadata })

  // ── Retrieve relevant chunks ─────────────────────────────────────────────────
  const retrievedChunks = await vectorStoreAdapter.similaritySearch(
    queryEmbedding.vector,
    k,
    filters,
    scoreThreshold
  )

  const chunksRetrieved = retrievedChunks.length
  const grounded = chunksRetrieved > 0

  logger.debug('RAG retrieval complete', {
    requestId: metadata.requestId,
    chunksRetrieved,
    grounded,
  })

  // ── Build prompt ─────────────────────────────────────────────────────────────
  const systemPrompt = buildRagSystemPrompt(language)
  const userMessage = buildRagUserMessage(question, retrievedChunks, memoryContext)

  // ── Controlled no-results response ───────────────────────────────────────────
  if (!grounded) {
    logger.info('RAG ask: no relevant chunks above threshold', {
      requestId: metadata.requestId,
      scoreThreshold,
    })
    return {
      answer:
        'The current AgroGenie knowledge base does not contain enough relevant information to answer this question reliably. ' +
        'Please consult your local Krishi Vigyan Kendra (KVK) or agricultural extension officer for specific advice.',
      provider: 'none',
      model: null,
      grounded: false,
      sources: [],
      retrieval: { chunksRetrieved: 0, documentsUsed: 0 },
      isDemo: false,
    }
  }

  // ── Call LLM ─────────────────────────────────────────────────────────────────
  const aiProvider = getAiProvider()
  let aiResult
  try {
    aiResult = await aiProvider.generate({
      messages: [{ role: 'user', content: userMessage }],
      systemPrompt,
      parameters: { max_tokens: 1000, temperature: 0.2, top_p: 0.85 },
      metadata,
    })
  } catch (err) {
    logger.error('RAG LLM generation failed', {
      requestId: metadata.requestId,
      errorCode: err.code ?? 'UNKNOWN',
    })
    throw err
  }

  // ── Deduplicate sources ───────────────────────────────────────────────────────
  const sources = deduplicateSources(retrievedChunks)
  const documentsUsed = sources.length

  logger.info('RAG ask complete', {
    requestId: metadata.requestId,
    chunksRetrieved,
    documentsUsed,
    model: aiResult.model,
    isDemo: aiResult.isDemo,
  })

  return {
    answer: aiResult.content,
    provider: aiResult.provider,
    model: aiResult.model,
    grounded: true,
    sources,
    retrieval: { chunksRetrieved, documentsUsed },
    isDemo: aiResult.isDemo,
  }
}
