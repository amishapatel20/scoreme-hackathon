import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { ChatbotWidget } from './components/ChatbotWidget'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { useAppStore } from './store/appStore'

import AdminPanel from './pages/AdminPanel'
import AllRequests from './pages/AllRequests'
import AuditExplorer from './pages/AuditExplorer'
import ConfigEditor from './pages/ConfigEditor'
import Dashboard from './pages/Dashboard'
import Help from './pages/Help'
import NewRequest from './pages/NewRequest'
import RequestDetail from './pages/RequestDetail'
import Workflows from './pages/Workflows'

function AppLayout() {
  const location = useLocation()
  const darkMode = useAppStore((s) => s.darkMode)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('light', !darkMode)
  }, [darkMode])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="min-w-0 flex-1">
          <Topbar />
          <div className="mx-auto max-w-7xl p-4 md:p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/requests/new" element={<NewRequest />} />
              <Route path="/requests" element={<AllRequests />} />
              <Route path="/requests/:id" element={<RequestDetail />} />
              <Route path="/audit" element={<AuditExplorer />} />
              <Route path="/workflows" element={<Workflows />} />
              <Route path="/config-editor" element={<ConfigEditor />} />
              <Route path="/admin" element={<AdminPanel />} />
              <Route path="/help" element={<Help />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
      {location.pathname ? <ChatbotWidget /> : null}
    </div>
  )
}

export default function App() {
  return <AppLayout />
}
