import { analyzeDisease } from '../services/disease.service.js'
import { getImageProvider } from '../providers/image.provider.factory.js'
import { success, error } from '../utils/apiResponse.js'

export async function diseaseAnalyze(req, res) {
  const { crop, plantPart, symptomDescription } = req.body
  const result = await analyzeDisease({ crop, plantPart, symptomDescription })
  return success(res, result)
}

/**
 * Handle image upload for disease analysis.
 * Stores the image using the image provider (COS/Mock) and returns metadata.
 * Does NOT perform diagnosis yet (Phase 15B).
 */
export async function uploadDiseaseImage(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, error: { message: 'No image uploaded' } })
  }

  const { buffer, mimetype, originalname } = req.file
  const imageProvider = getImageProvider()

  const metadata = await imageProvider.uploadImage(buffer, mimetype, originalname)
  
  return success(res, {
    message: 'Image uploaded successfully.',
    metadata
  }, 201)
}
