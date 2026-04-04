import React from 'react'
import type { DailyTotal } from '../../types'

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${totalSec}s`
}

interface Props {
  totals: DailyTotal[]
}

export default function TodaySummaryCard({ totals }: Props): React.ReactElement {
  const totalMs = totals.reduce((sum, t) => sum + t.total_ms, 0)
  const appCount = totals.length

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1e2240 0%, #1a1d2e 100%)',
      border: '1px solid #2d3148',
      borderRadius: 12,
      padding: '20px 24px',
      marginBottom: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 32,
    }}>
      <div>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Total Screen Time Today
        </div>
        <div style={{ fontSize: 36, fontWeight: 700, color: '#7c8cf8', letterSpacing: '-1px' }}>
          {totalMs > 0 ? formatDuration(totalMs) : '—'}
        </div>
      </div>
      <div style={{ height: 40, width: 1, background: '#2d3148' }} />
      <div>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Apps used</div>
        <div style={{ fontSize: 24, fontWeight: 600, color: '#e2e8f0' }}>{appCount}</div>
      </div>
    </div>
  )
}
