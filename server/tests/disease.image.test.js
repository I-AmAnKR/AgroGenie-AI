import request from 'supertest'
import express from 'express'
import diseaseRoutes from '../src/routes/disease.routes.js'
import config from '../src/config/env.js'

const app = express()
app.use(express.json())
app.use('/api/v1/disease', diseaseRoutes)
// Mock error handler
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({ error: err.message })
})

describe('Disease Image API (Phase 15B)', () => {
  const originalUseMocks = config.providers.useMocks

  beforeAll(() => {
    config.providers.useMocks = true
  })

  afterAll(() => {
    config.providers.useMocks = originalUseMocks
  })

  it('should upload a valid image and return metadata', async () => {
    // We send a small valid buffer
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]) // tiny dummy jpeg
    
    const response = await request(app)
      .post('/api/v1/disease/image')
      .attach('image', buffer, { filename: 'leaf.jpg', contentType: 'image/jpeg' })

    expect(response.status).toBe(201)
    expect(response.body.success).toBe(true)
    expect(response.body.data.message).toBe('Image uploaded successfully.')
    expect(response.body.data.metadata).toBeDefined()
    expect(response.body.data.metadata.objectKey).toMatch(/^disease-images\/[a-f0-9-]{36}-leaf\.jpg$/)
    expect(response.body.data.metadata.mimeType).toBe('image/jpeg')
    expect(response.body.data.metadata.sha256).toBeDefined()
  })

  it('should reject invalid MIME types', async () => {
    const buffer = Buffer.from('just a text file')
    
    const response = await request(app)
      .post('/api/v1/disease/image')
      .attach('image', buffer, { filename: 'virus.exe', contentType: 'application/x-msdownload' })

    expect(response.status).toBe(415)
    expect(response.body.success).toBe(false)
    expect(response.body.error.code).toBe('UNSUPPORTED_FILE_TYPE')
  })

  it('should reject missing file', async () => {
    const response = await request(app).post('/api/v1/disease/image')
    expect(response.status).toBe(400)
    expect(response.body.success).toBe(false)
    expect(response.body.error.message).toBe('No image uploaded')
  })
})
