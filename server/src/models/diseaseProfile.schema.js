/**
 * DiseaseProfile schema and factory — Phase 15A.
 *
 * DiseaseProfile stores verified agricultural disease data.
 *
 * Key design rules:
 *   - Data comes from verified curated sources, NOT from LLM knowledge.
 *   - All textual fields are exact or structured.
 *   - Fields marked as null mean "not reliably verified".
 *   - officialSources must always be populated for scoring credibility.
 *   - lastVerifiedAt tracks when the data was last checked against the source.
 */

/** Disease severity categories. */
export const DISEASE_SEVERITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
}

/** Disease categories. */
export const DISEASE_CATEGORY = {
  FUNGAL: 'FUNGAL',
  BACTERIAL: 'BACTERIAL',
  VIRAL: 'VIRAL',
  NUTRIENT_DEFICIENCY: 'NUTRIENT_DEFICIENCY',
  PEST_ASSOCIATED: 'PEST_ASSOCIATED',
  OTHER: 'OTHER',
}

/** Disease profile status. */
export const DISEASE_STATUS = {
  ACTIVE: 'ACTIVE',
  DEPRECATED: 'DEPRECATED',
  DRAFT: 'DRAFT',
}

/**
 * Create a DiseaseProfile record.
 * All disease data must come from verified sources.
 *
 * @param {object} data - Raw disease data
 * @returns {object} Normalized DiseaseProfile
 */
export function createDiseaseProfile(data) {
  return {
    diseaseCode: data.diseaseCode,
    name: data.name,
    aliases: Array.isArray(data.aliases) ? data.aliases : [],
    crop: data.crop,
    diseaseCategory: data.diseaseCategory ?? DISEASE_CATEGORY.OTHER,
    
    symptoms: Array.isArray(data.symptoms) ? data.symptoms : [],
    causes: data.causes ?? null,
    severity: data.severity ?? DISEASE_SEVERITY.MEDIUM,
    
    affectedPlantParts: Array.isArray(data.affectedPlantParts) ? data.affectedPlantParts : [],
    affectedGrowthStage: Array.isArray(data.affectedGrowthStage) ? data.affectedGrowthStage : [],
    
    environmentalConditions: {
      temperature: data.environmentalConditions?.temperature ?? null,
      humidity: data.environmentalConditions?.humidity ?? null,
      rainfall: data.environmentalConditions?.rainfall ?? null,
      season: data.environmentalConditions?.season ?? null,
    },
    
    riskFactors: Array.isArray(data.riskFactors) ? data.riskFactors : [],
    
    treatment: {
      immediateActions: Array.isArray(data.treatment?.immediateActions) ? data.treatment.immediateActions : [],
      organicTreatment: data.treatment?.organicTreatment ?? null,
      chemicalTreatment: data.treatment?.chemicalTreatment ?? null,
      culturalPractices: Array.isArray(data.treatment?.culturalPractices) ? data.treatment.culturalPractices : [],
      monitoring: data.treatment?.monitoring ?? null,
      expertConsultation: data.treatment?.expertConsultation ?? null,
    },
    
    prevention: Array.isArray(data.prevention) ? data.prevention : [],
    
    confidenceThreshold: typeof data.confidenceThreshold === 'number' ? data.confidenceThreshold : 0.8,
    
    knowledgeDocumentIds: Array.isArray(data.knowledgeDocumentIds) ? data.knowledgeDocumentIds : [],
    
    officialSources: Array.isArray(data.officialSources) 
      ? data.officialSources.map(src => ({
          title: src.title,
          url: src.url,
          sourceType: src.sourceType ?? 'unknown',
          year: src.year ?? new Date().getFullYear(),
        }))
      : [],
      
    lastVerifiedAt: data.lastVerifiedAt ?? new Date().toISOString(),
    status: data.status ?? DISEASE_STATUS.ACTIVE,
  }
}
