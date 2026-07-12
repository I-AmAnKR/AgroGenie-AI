// Mock chat conversations
export const mockSuggestedQuestions = [
  'Which Kharif crop is suitable for loamy soil in Nashik?',
  'Will the weather be suitable for sowing next week?',
  'Show recent onion mandi prices in Lasalgaon.',
  'Which irrigation schemes may be relevant for my farm?',
  'What are the early signs of downy mildew in onion?',
  'How much fertilizer should I apply for my onion crop?'
]

export const mockConversations = [
  {
    id: 'conv-001',
    title: 'Kharif crop recommendation',
    preview: 'Which Kharif crop suits loamy soil?',
    timestamp: '2024-11-17T10:23:00Z',
    messageCount: 4
  },
  {
    id: 'conv-002',
    title: 'Onion mandi prices',
    preview: 'Show recent tomato mandi prices',
    timestamp: '2024-11-16T14:10:00Z',
    messageCount: 2
  },
  {
    id: 'conv-003',
    title: 'Rainfall advisory',
    preview: 'Will it rain this week near Nashik?',
    timestamp: '2024-11-15T09:05:00Z',
    messageCount: 3
  }
]

export const mockDemoMessages = [
  {
    id: 'msg-1',
    role: 'user',
    content: 'Which Kharif crop is suitable for my loamy soil in Nashik with drip irrigation?',
    timestamp: '2024-11-17T10:23:00Z'
  },
  {
    id: 'msg-2',
    role: 'assistant',
    content: `Based on your farm profile — loamy soil in Nashik, drip irrigation, 4.5 acres — the most suitable Kharif crops in order of recommendation are:

**1. Onion (Agrifound Light Red)** — Highly Suitable (Score: 88/100)
Nashik's loamy soil and your existing drip infrastructure make onion cultivation well-aligned. Lasalgaon market proximity provides strong market access.

**2. Soybean** — Suitable (Score: 74/100)
Low input cost, nitrogen-fixing, and resilient to moderate rainfall variability. Good rotation crop.

**3. Maize (Hybrid)** — Conditionally Suitable (Score: 61/100)
Requires more water than your current drip capacity may support optimally during August.

Consider checking current weather forecast before finalising sowing schedule — moderate rainfall is expected this week.`,
    timestamp: '2024-11-17T10:23:15Z',
    agent: 'Crop Advisor',
    agentChain: ['Agent Router', 'Crop Advisor Agent', 'Weather Agent', 'Knowledge Retrieval'],
    confidence: 'High',
    sources: [
      { title: 'ICAR Kharif Crop Production Guide 2023', organization: 'ICAR', date: 'March 2023' },
      { title: 'Maharashtra State Crop Calendar', organization: 'Agri Dept. Maharashtra', date: 'June 2023' },
      { title: 'Nashik District Soil Survey Report', organization: 'NBSS&LUP', date: 'January 2022' }
    ],
    dataConsidered: [
      'Farmer profile: loamy soil, Nashik, drip irrigation',
      'Current weather: 24°C, 68% humidity, rain expected Wed–Thu',
      'Agricultural knowledge base (RAG)',
      'Market data: onion modal price ₹1,750/quintal (Lasalgaon)'
    ]
  }
]
