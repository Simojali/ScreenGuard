import React from 'react'
import { useUsageData } from '../hooks/useUsageData'
import { useLimits } from '../hooks/useLimits'
import { useAppStore } from '../store/appStore'
import { useAppIcons } from '../hooks/useAppIcons'
import TodaySummaryCard from '../components/dashboard/TodaySummaryCard'
import AppUsageRow from '../components/dashboard/AppUsageRow'
import type { AppLimit } from '../types'

export default function DashboardPage(): React.ReactElement {
  const { totals, loading } = useUsageData()
  const { limits } = useLimits()
  const currentApp = useAppStore((s) => s.currentApp)
  const liveTotals = useAppStore((s) => s.todayTotals)

  // Merge live totals from push events with DB totals
  const mergedTotals = totals.map((t) => ({
    ...t,
    total_ms: liveTotals[t.app_name] ?? t.total_ms,
  })).sort((a, b) => b.total_ms - a.total_ms)

  const maxMs = mergedTotals[0]?.total_ms ?? 1

  const limitMap: Record<string, AppLimit> = {}
  for (const l of limits) limitMap[l.app_name] = l

  // Fetch icons for all tracked apps
  const exePaths = mergedTotals.map((t) => t.exe_path).filter(Boolean)
  const icons = useAppIcons(exePaths)

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#64748b' }}>
        Loading...
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', marginBottom: 16 }}>Today</h1>

      <TodaySummaryCard totals={mergedTotals} />

      {mergedTotals.length === 0 ? (
        <div style={{
          textAlign: 'center', color: '#64748b', marginTop: 60,
          fontSize: 14, lineHeight: 1.8,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
          No app usage recorded yet today.<br />
          Start using your computer and data will appear here.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Header */}
          <div style={{
            display: 'flex', gap: 12, padding: '6px 16px',
            fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            <div style={{ width: 180 }}>App</div>
            <div style={{ flex: 1 }}>Usage</div>
            <div style={{ width: 72, textAlign: 'right' }}>Time</div>
            <div style={{ width: 80, textAlign: 'right' }}>Limit</div>
          </div>

          {mergedTotals.map((total) => (
            <AppUsageRow
              key={total.app_name}
              total={total}
              limit={limitMap[total.app_name]}
              maxMs={maxMs}
              isActive={total.app_name === currentApp}
              icon={icons[total.exe_path]}
            />
          ))}
        </div>
      )}
    </div>
  )
}
