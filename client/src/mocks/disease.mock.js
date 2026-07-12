// Mock disease advisory data
export const mockDiseaseResult = {
  condition: 'Downy Mildew (Peronospora destructor)',
  confidence: 'Moderate',
  confidenceLabel: 'Moderate (Demo Analysis)',
  crop: 'Onion',
  plantPart: 'Leaf',
  isDemo: true,
  observedSymptoms: [
    'Pale yellow to violet lesions on older leaves',
    'White to violet-grey fuzzy growth (sporulation) on undersides',
    'Leaves may turn pale green, then yellow and die back',
    'Systemic infection may cause stunted growth'
  ],
  recommendedChecks: [
    'Inspect leaf underside for characteristic fuzzy sporulation',
    'Check for oval pale patches — distinguishes downy mildew from purple blotch',
    'Assess crop density and ventilation conditions',
    'Check recent rainfall and humidity records (>70% humidity favours spread)'
  ],
  generalPrevention: [
    'Avoid overhead irrigation; use drip or furrow irrigation',
    'Maintain adequate plant spacing for air circulation',
    'Remove and destroy infected plant debris',
    'Rotate crops — avoid planting alliums in the same field next season',
    'Apply copper-based protectants when conditions favour infection (early morning applications)'
  ],
  whenToContactExpert: 'If symptoms are spreading rapidly across more than 10% of the field, or if you are uncertain about the diagnosis, contact your nearest Krishi Vigyan Kendra (KVK) or State Agriculture Department extension officer.',
  sources: [
    { title: 'Onion Disease Management Guide', organization: 'NHRDF', date: '2022' },
    { title: 'Plant Disease Compendium — Allium', organization: 'ICAR', date: '2021' },
  ],
  disclaimer: 'This is a demonstration analysis. Do not apply any pesticide based solely on this output. Always consult a licensed agronomist or KVK for actual treatment recommendations.'
}

export const mockCropsForDisease = [
  'Onion', 'Tomato', 'Potato', 'Wheat', 'Rice', 'Maize', 'Cotton',
  'Soybean', 'Groundnut', 'Sugarcane', 'Grapes', 'Pomegranate', 'Other'
]

export const mockPlantParts = ['Leaf', 'Stem', 'Fruit / Bulb', 'Root', 'Other']
