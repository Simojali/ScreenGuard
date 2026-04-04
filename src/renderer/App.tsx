import React, { useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import TopBar from './components/layout/TopBar'
import DashboardPage from './pages/DashboardPage'
import ReportsPage from './pages/ReportsPage'
import LimitsPage from './pages/LimitsPage'
import DowntimePage from './pages/DowntimePage'
import { onSessionUpdate } from './lib/ipcClient'
import { useAppStore } from './store/appStore'

export default function App(): React.ReactElement {
  const updateTodayTotal = useAppStore((s) => s.updateTodayTotal)

  useEffect(() => {
    const unsub = onSessionUpdate(({ appName, todayTotalMs }) => {
      updateTodayTotal(appName, todayTotalMs)
    })
    return unsub
  }, [updateTodayTotal])

  return (
    <HashRouter>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <TopBar />
          <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/limits" element={<LimitsPage />} />
              <Route path="/downtime" element={<DowntimePage />} />
            </Routes>
          </main>
        </div>
      </div>
    </HashRouter>
  )
}
