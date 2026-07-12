/**
 * Mock disease advisory data.
 * Replaced by IBM Vision + RAG advisory in Phase 16.
 */
export const mockDiseaseResults = {
  default: {
    // New field names (spec-compliant)
    possibleCondition: 'Downy Mildew (Peronospora destructor)',
    // Old field names (frontend-compatible)
    condition: 'Downy Mildew (Peronospora destructor)',
    confidenceCategory: 'Demo',
    confidence: 'Moderate',
    confidenceLabel: 'Demo Analysis — not a real diagnosis',
    observedSymptoms: [
      'Pale yellow to violet lesions on older leaves',
      'White to violet-grey fuzzy growth (sporulation) on undersides',
      'Leaves may turn pale green, then yellow and die back',
      'Systemic infection may cause stunted growth',
    ],
    // Old field name (frontend uses recommendedChecks)
    recommendedChecks: [
      'Inspect leaf underside for characteristic fuzzy sporulation',
      'Check for oval pale patches — distinguishes downy mildew from purple blotch',
      'Assess crop density and ventilation conditions',
      'Check recent rainfall and humidity records (>70% humidity favours spread)',
    ],
    recommendedNextChecks: [
      'Inspect leaf underside for characteristic fuzzy sporulation',
      'Check for oval pale patches — distinguishes downy mildew from purple blotch',
      'Assess crop density and ventilation conditions',
      'Check recent rainfall and humidity records (>70% humidity favours spread)',
    ],
    // Old field name (frontend uses generalPrevention)
    generalPrevention: [
      'Avoid overhead irrigation; use drip or furrow irrigation',
      'Maintain adequate plant spacing for air circulation',
      'Remove and destroy infected plant debris',
      'Rotate crops — avoid planting alliums in the same field next season',
    ],
    generalPreventionGuidance: [
      'Avoid overhead irrigation; use drip or furrow irrigation',
      'Maintain adequate plant spacing for air circulation',
      'Remove and destroy infected plant debris',
      'Rotate crops — avoid planting alliums in the same field next season',
    ],
    // Old field name (frontend uses whenToContactExpert)
    whenToContactExpert:
      'If symptoms are spreading rapidly across more than 10% of the field, or if you are uncertain about the diagnosis, contact your nearest Krishi Vigyan Kendra (KVK) or State Agriculture Department extension officer.',
    escalationAdvice:
      'If symptoms are spreading rapidly across more than 10% of the field, or if you are uncertain about the diagnosis, contact your nearest Krishi Vigyan Kendra (KVK) or State Agriculture Department extension officer.',
    sources: [
      { title: 'Onion Disease Management Guide (Demo)', organization: 'NHRDF', date: '2022', isDemo: true },
      { title: 'Plant Disease Compendium — Allium (Demo)', organization: 'ICAR', date: '2021', isDemo: true },
    ],
    evidenceSources: [
      { title: 'Onion Disease Management Guide (Demo)', organization: 'NHRDF', date: '2022', isDemo: true },
      { title: 'Plant Disease Compendium — Allium (Demo)', organization: 'ICAR', date: '2021', isDemo: true },
    ],
    disclaimer:
      'This is a demonstration analysis only. Do not apply any pesticide based solely on this output. Always consult a licensed agronomist or KVK for actual treatment recommendations.',
    isDemo: true,
  },
}
