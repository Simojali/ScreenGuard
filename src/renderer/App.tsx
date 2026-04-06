import React, { useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import TopBar from './components/layout/TopBar'
import DashboardPage from './pages/DashboardPage'
import ReportsPage from './pages/ReportsPage'
import LimitsPage from './pages/LimitsPage'
import DowntimePage from './pages/DowntimePage'
import CategoriesPage from './pages/CategoriesPage'
import RemindersPage from './pages/RemindersPage'
import SettingsPage from './pages/SettingsPage'
import { onSessionUpdate } from './lib/ipcClient'
import { useAppStore } from './store/appStore'

export default function App(): React.ReactElement {
  const updateTodayTotal = useAppStore((s) => s.updateTodayTotal)

  useEffect(() => {
    const unsub = onSessionUpdate(({ appName, todayTotalMs, isIdle }) => {
      updateTodayTotal(appName, todayTotalMs, isIdle ?? false)
    })
    return unsub
  }, [updateTodayTotal])

  return (
    <HashRouter>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-app)' }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <TopBar />
          <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/limits" element={<LimitsPage />} />
              <Route path="/downtime" element={<DowntimePage />} />
              <Route path="/reminders" element={<RemindersPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </HashRouter>
  )
}
