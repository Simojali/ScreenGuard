import React from 'react'
import type { DailyTotal, AppLimit } from '../../types'
import { friendlyName } from '../../lib/appNames'

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${totalSec}s`
}

/** Fallback icon: colored square with first letter */
function LetterIcon({ name }: { name: string }): React.ReactElement {
  const colors = ['#7c8cf8','#38bdf8','#34d399','#f59e0b','#f87171','#a78bfa','#fb7185','#22d3ee']
  const color = colors[name.charCodeAt(0) % colors.length]
  const letter = name.replace(/\.exe$/i, '').charAt(0).toUpperCase()
  return (
    <div style={{
      width: 20, height: 20, borderRadius: 5, background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
    }}>
      {letter}
    </div>
  )
}

interface Props {
  total: DailyTotal
  limit?: AppLimit
  maxMs: number
  isActive: boolean
  icon?: string | null
}

export default function AppUsageRow({ total, limit, maxMs, isActive, icon }: Props): React.ReactElement {
  const pct = maxMs > 0 ? (total.total_ms / maxMs) * 100 : 0
  const limitPct = limit ? Math.min((total.total_ms / limit.limit_ms) * 100, 100) : null
  const overLimit = limit && total.total_ms >= limit.limit_ms
  const barColor = overLimit ? '#ef4444' : limitPct && limitPct >= 90 ? '#f59e0b' : '#7c8cf8'
  const displayName = friendlyName(total.app_name)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
      borderRadius: 8,
      background: isActive ? 'rgba(124,140,248,0.06)' : 'transparent',
      border: isActive ? '1px solid rgba(124,140,248,0.15)' : '1px solid transparent',
    }}>
      {/* Icon + name */}
      <div style={{ width: 180, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        {isActive && (
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: '#22c55e',
            boxShadow: '0 0 5px #22c55e', flexShrink: 0
          }} />
        )}
        {icon
          ? <img src={icon} width={20} height={20} style={{ borderRadius: 4, flexShrink: 0 }} alt="" />
          : <LetterIcon name={total.app_name} />
        }
        <span style={{
          fontSize: 13, color: '#e2e8f0', fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {displayName}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ flex: 1, height: 6, background: '#1e2133', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 3, transition: 'width 0.5s' }} />
      </div>

      {/* Duration */}
      <div style={{ width: 72, textAlign: 'right', flexShrink: 0 }}>
        <span style={{ fontSize: 13, color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
          {formatDuration(total.total_ms)}
        </span>
      </div>

      {/* Limit badge */}
      <div style={{ width: 80, textAlign: 'right', flexShrink: 0 }}>
        {limit ? (
          <span style={{
            fontSize: 11, padding: '2px 7px', borderRadius: 10,
            background: overLimit ? 'rgba(239,68,68,0.15)' : 'rgba(124,140,248,0.1)',
            color: overLimit ? '#ef4444' : '#7c8cf8',
            border: `1px solid ${overLimit ? 'rgba(239,68,68,0.3)' : 'rgba(124,140,248,0.2)'}`,
          }}>
            {overLimit ? 'Limit hit' : `/ ${formatDuration(limit.limit_ms)}`}
          </span>
        ) : null}
      </div>
    </div>
  )
}
