/**
 * Mock crop recommendations.
 * Replaced by IBM Granite + RAG in Phase 13.
 */
export const mockCropRecommendations = [
  {
    rank: 1,
    crop: 'Onion',
    variety: 'Agrifound Light Red',
    suitabilityScore: 92,
    suitabilityLabel: 'Highly Suitable',
    suitabilityColor: 'success',
    waterRequirement: 'Medium',
    waterRequirementCategory: 'Medium',
    reasons: [
      'Well-suited to loamy soil with good drainage',
      'Nashik region has strong market demand and infrastructure',
      'Drip irrigation is optimal for onion cultivation',
      'Rabi season aligns with ideal onion growth window',
    ],
    risks: [
      'Susceptible to purple blotch in high humidity',
      'Price volatility in peak supply months',
    ],
    riskFactors: [
      'Susceptible to purple blotch in high humidity',
      'Price volatility in peak supply months',
    ],
    marketObservation:
      "Lasalgaon — one of Asia's largest onion markets — is nearby. Current modal prices suggest reasonable returns.",
    npkSuggestion: 'N: 100 kg/ha, P: 60 kg/ha, K: 80 kg/ha',
    duration: '90–110 days',
    rotationFit: 'Excellent (follows tomato)',
    evidenceSources: ['ICAR Onion Production Guide 2023 (Demo)', 'NHRDF Nashik Bulletin (Demo)'],
    isDemo: true,
  },
  {
    rank: 2,
    crop: 'Chickpea (Gram)',
    variety: 'JG-315 / Vijay',
    suitabilityScore: 78,
    suitabilityLabel: 'Suitable',
    suitabilityColor: 'info',
    waterRequirement: 'Low',
    waterRequirementCategory: 'Low',
    reasons: [
      'Nitrogen-fixing legume — improves soil health after onion',
      'Low water requirement suits current drip setup',
      'Rabi season is ideal for chickpea',
    ],
    risks: [
      'Susceptible to pod borer in warmer conditions',
      'Moderate market demand in Nashik compared to onion',
    ],
    riskFactors: [
      'Susceptible to pod borer in warmer conditions',
      'Moderate market demand in Nashik compared to onion',
    ],
    marketObservation: 'Chickpea prices have been stable. Government MSP provides a floor price.',
    npkSuggestion: 'N: 25 kg/ha, P: 60 kg/ha, K: 40 kg/ha',
    duration: '95–110 days',
    rotationFit: 'Good (soil nitrogen restoration)',
    evidenceSources: ['ICRISAT Chickpea Manual (Demo)', 'Maharashtra Agriculture Dept. Advisory 2023 (Demo)'],
    isDemo: true,
  },
  {
    rank: 3,
    crop: 'Wheat',
    variety: 'GW-322 / HD-2781',
    suitabilityScore: 65,
    suitabilityLabel: 'Conditionally Suitable',
    suitabilityColor: 'warning',
    waterRequirement: 'Medium',
    waterRequirementCategory: 'Medium',
    reasons: [
      'Rabi season is appropriate',
      'Loamy soil supports wheat cultivation',
      'Stable MSP pricing reduces market risk',
    ],
    risks: [
      'Requires more water than current drip system may optimally support',
      'Lower per-acre returns compared to onion in Nashik',
    ],
    riskFactors: [
      'Requires more water than current drip system may optimally support',
      'Lower per-acre returns compared to onion in Nashik',
    ],
    marketObservation:
      'Wheat is supported by government MSP. Local market demand is steady but not exceptional.',
    npkSuggestion: 'N: 120 kg/ha, P: 60 kg/ha, K: 40 kg/ha',
    duration: '110–120 days',
    rotationFit: 'Acceptable',
    evidenceSources: ['ICAR Wheat Production Manual (Demo)', 'Agri Dept. Nashik Crop Calendar (Demo)'],
    isDemo: true,
  },
]
