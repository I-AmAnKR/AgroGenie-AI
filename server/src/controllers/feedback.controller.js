import { submitFeedback } from '../services/feedback.service.js'
import { success } from '../utils/apiResponse.js'

export async function feedback(req, res) {
  const record = await submitFeedback(req.body)
  return success(res, record, 201)
}
