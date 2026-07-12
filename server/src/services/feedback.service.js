/**
 * Feedback service.
 * In-memory store — replaced by MongoDB in Phase 5.
 *
 * NOTE: Feedback data is NOT persisted between server restarts in Phase 4.
 */

const feedbackStore = []
let feedbackCounter = 1

/**
 * Submit feedback for a recommendation.
 * @param {object} payload - { userId, recommendationId, rating, comment }
 */
export async function submitFeedback(payload) {
  const record = {
    id: `fb-${String(feedbackCounter).padStart(4, '0')}`,
    userId: payload.userId,
    recommendationId: payload.recommendationId,
    rating: Number(payload.rating),
    comment: payload.comment ?? '',
    createdAt: new Date().toISOString(),
  }
  feedbackStore.push(record)
  feedbackCounter++
  return record
}

/**
 * Get all feedback (for admin/debug).
 */
export async function getAllFeedback() {
  return [...feedbackStore]
}
