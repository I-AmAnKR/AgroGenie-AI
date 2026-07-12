import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { FarmerProvider } from './context/FarmerContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import Layout from './components/layout/Layout.jsx'

import Landing from './pages/Landing.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Chat from './pages/Chat.jsx'
import CropAdvisor from './pages/CropAdvisor.jsx'
import Weather from './pages/Weather.jsx'
import Market from './pages/Market.jsx'
import Schemes from './pages/Schemes.jsx'
import Disease from './pages/Disease.jsx'
import Profile from './pages/Profile.jsx'
import NotFound from './pages/NotFound.jsx'
import KnowledgeBase from './pages/KnowledgeBase.jsx'

export default function App() {
  return (
    <ThemeProvider>
      <FarmerProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout><Landing /></Layout>} />
            <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
            <Route path="/chat" element={<Layout><Chat /></Layout>} />
            <Route path="/crop-advisor" element={<Layout><CropAdvisor /></Layout>} />
            <Route path="/weather" element={<Layout><Weather /></Layout>} />
            <Route path="/market" element={<Layout><Market /></Layout>} />
            <Route path="/schemes" element={<Layout><Schemes /></Layout>} />
            <Route path="/disease" element={<Layout><Disease /></Layout>} />
            <Route path="/profile" element={<Layout><Profile /></Layout>} />
            <Route path="/knowledge-base" element={<Layout><KnowledgeBase /></Layout>} />
            <Route path="/404" element={<Layout><NotFound /></Layout>} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </BrowserRouter>
      </FarmerProvider>
    </ThemeProvider>
  )
}
