import { getImageProvider } from '../src/providers/image.provider.factory.js'
import { mockImageProvider } from '../src/providers/mock/mock-image.provider.js'
import { imageProvider } from '../src/providers/image.provider.js'
import config from '../src/config/env.js'

describe('Image Provider Factory (Phase 15B)', () => {
  const originalUseMocks = config.providers.useMocks

  afterAll(() => {
    config.providers.useMocks = originalUseMocks
  })

  it('should return mockImageProvider when useMocks is true', () => {
    config.providers.useMocks = true
    const provider = getImageProvider()
    expect(provider).toBe(mockImageProvider)
  })

  it('should return imageProvider when useMocks is false', () => {
    config.providers.useMocks = false
    const provider = getImageProvider()
    expect(provider).toBe(imageProvider)
  })
})

describe('Mock Image Provider', () => {
  it('should simulate an image upload and return metadata with sha256', async () => {
    const dummyBuffer = Buffer.from('test-image-content')
    const result = await mockImageProvider.uploadImage(dummyBuffer, 'image/jpeg', 'test.jpg')
    
    expect(result.objectKey).toMatch(/^disease-images\/[a-f0-9-]{36}-test\.jpg$/)
    expect(result.bucket).toBe('mock-agrogenie-bucket')
    expect(result.mimeType).toBe('image/jpeg')
    expect(result.size).toBe(dummyBuffer.length)
    expect(result.sha256).toBeDefined()
    expect(typeof result.sha256).toBe('string')
    expect(result.uploadedAt).toBeDefined()
    // Since it's a dummy text buffer, image-size will throw internally and height/width will be null
    expect(result.width).toBeNull()
    expect(result.height).toBeNull()
  })
})
