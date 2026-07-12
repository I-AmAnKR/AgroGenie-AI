/**
 * Mock conversation data.
 * Replaced by MongoDB in Phase 5.
 */
export const mockConversations = [
  {
    id: 'conv-001',
    title: 'Kharif crop recommendation',
    preview: 'Which Kharif crop suits loamy soil?',
    timestamp: '2024-11-17T10:23:00Z',
    messageCount: 4,
  },
  {
    id: 'conv-002',
    title: 'Onion mandi prices',
    preview: 'Show recent onion mandi prices',
    timestamp: '2024-11-16T14:10:00Z',
    messageCount: 2,
  },
  {
    id: 'conv-003',
    title: 'Rainfall advisory',
    preview: 'Will it rain this week near Nashik?',
    timestamp: '2024-11-15T09:05:00Z',
    messageCount: 3,
  },
]

export const mockAssistantReply = {
  role: 'assistant',
  content:
    'To provide a useful crop recommendation, I need a few details: your district, irrigation availability, previous crop, and farming objective. Could you share those? (Demo response — IBM Granite integration coming in Phase 6.)',
  agentActivity: ['Intent Detection', 'Crop Advisor', 'Knowledge Retrieval'],
  sources: [
    {
      title: 'Demo Agricultural Knowledge Source',
      organization: 'Demo Source',
      date: '2026',
      isDemo: true,
    },
  ],
  isDemo: true,
}
