import React from 'react'
import { useAppStore } from '../../store/appStore'
import { friendlyName } from '../../lib/appNames'

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}

export default function TopBar(): React.ReactElement {
  const currentApp = useAppStore((s) => s.currentApp)

  return (
    <header style={{
      height: 52,
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      background: 'var(--bg-topbar)',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{todayLabel()}</span>

      {currentApp && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--accent-sub)',
          border: '1px solid rgba(124,140,248,0.25)',
          borderRadius: 20,
          padding: '3px 12px 3px 8px',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: '#22c55e',
            boxShadow: '0 0 6px #22c55e', display: 'inline-block',
          }} />
          <span style={{ fontSize: 12, color: 'var(--accent)' }}>{friendlyName(currentApp)}</span>
        </div>
      )}
    </header>
  )
}
