// Mock farmer profile — used as default context throughout the app
export const mockFarmerProfile = {
  userId: 'farmer-001',
  name: 'Ramesh Kumar',
  preferredLang: 'en',
  location: {
    state: 'Maharashtra',
    district: 'Nashik',
    village: 'Sinnar',
    coordinates: { lat: 19.847, lon: 73.998 }
  },
  farm: {
    sizeAcres: 4.5,
    sizeUnit: 'acres',
    soilType: 'loamy',
    irrigationType: 'drip',
    primaryCrops: ['Onion', 'Tomato', 'Wheat'],
    currentCrop: 'Onion',
    sowingDate: '2024-10-15',
    previousCrop: 'Tomato'
  },
  objective: 'balanced',
  createdAt: '2024-09-01T00:00:00Z',
  updatedAt: '2024-11-01T00:00:00Z'
}
