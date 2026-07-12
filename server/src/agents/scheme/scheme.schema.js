/**
 * Scheme Agent schema — Phase 12.
 *
 * Defines the Scheme Agent result contract for documentation and testing.
 * Updated from Phase 9 placeholder.
 */
export const SCHEME_AGENT_SCHEMA = {
  intent: 'SCHEME',
  agentsUsed: [
    'SchemeAgent',
    'SchemeRepository',
    'EligibilityEvaluator',
    'RAGRetrieval (optional)',
    'watsonx/{modelId}',
  ],
  supportedQueryTypes: [
    'ELIGIBILITY_CHECK',
    'SCHEME_DISCOVERY',
    'DOCUMENTS_REQUIRED',
    'NAMED_SCHEME_QUERY',
    'BENEFITS_QUERY',
    'APPLICATION_STEPS',
  ],
  eligibilityStatusValues: [
    'POTENTIALLY_ELIGIBLE',
    'POTENTIALLY_NOT_ELIGIBLE',
    'MORE_INFORMATION_REQUIRED',
    'RULES_NOT_MACHINE_VERIFIABLE',
    'SCHEME_STATUS_UNCERTAIN',
  ],
  // The following values are NEVER returned
  prohibitedEligibilityValues: ['GUARANTEED_ELIGIBLE', 'APPROVAL_GUARANTEED'],
  schemeShape: {
    schemeCode: 'string',
    name: 'string',
    shortName: 'string',
    ministry: 'string',
    schemeLevel: 'CENTRAL|STATE|DISTRICT|OTHER',
    status: 'ACTIVE|INACTIVE|UNKNOWN|NEEDS_REVIEW',
    benefitsSummary: 'string',
    officialSourceUrl: 'string|null',
    applicationUrl: 'string|null',
    applicationMode: 'ONLINE|OFFLINE|BOTH|UNKNOWN',
    requiredDocuments: '{ name, requiredStatus, condition }[]',
    applicationSteps: '{ order, description }[]',
    eligibility: {
      status: 'ELIGIBILITY_STATUS value',
      matchedRules: '{ field, explanation }[]',
      unmatchedRules: '{ field, explanation }[]',
      missingInformation: 'string[]',
    },
    isDemo: 'boolean (true until officially verified)',
    stale: 'boolean',
    lastVerifiedAt: 'ISO8601|null',
  },
  sourceShape: {
    sourceType: 'government_scheme|rag_document',
    schemeCode: 'string (for government_scheme)',
    schemeName: 'string (for government_scheme)',
    officialUrl: 'string|null',
    lastVerifiedAt: 'ISO8601|null',
    isDemo: 'boolean',
    status: 'ACTIVE|INACTIVE|UNKNOWN|NEEDS_REVIEW',
  },
}
