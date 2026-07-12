import axiosClient from './axiosClient.js'

/**
 * POST /api/v1/chat
 * Send a chat message to the AI assistant.
 */
export async function sendMessage(payload) {
  return axiosClient.post('/chat', {
    message: payload.message,
    language: payload.language ?? 'en',
    conversationId: payload.conversationId ?? null,
    attachments: payload.attachments ?? [],
  })
}

/**
 * GET /api/v1/chat — placeholder for session list.
 * Sessions will be stored in MongoDB in Phase 5.
 * For now returns a static mock from the server's in-memory store.
 */
export async function getSessions() {
  // Sessions API not yet implemented in Phase 4 backend (no DB).
  // Return an empty list — conversation history is unsupported until Phase 5.
  return { success: true, data: [] }
}

/**
 * DELETE /api/v1/chat/sessions/:id — placeholder.
 */
export async function deleteSession(_sessionId) {
  return { success: true, data: { deleted: true } }
}
