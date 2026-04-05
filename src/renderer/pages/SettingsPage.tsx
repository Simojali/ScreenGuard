import React, { useState, useEffect, useCallback } from 'react'
import { ipc } from '../lib/ipcClient'

// ── Toggle switch component ─────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: checked ? 'var(--accent)' : 'var(--border-hi)',
        position: 'relative', flexShrink: 0,
        transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s',
        left: checked ? 23 : 3,
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  )
}

// ── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em',
        color: 'var(--text-4)', marginBottom: 10,
      }}>
        {title}
      </div>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  )
}

// ── Setting row ──────────────────────────────────────────────────────────────
function Row({
  label, description, control, noBorder = false,
}: {
  label: string
  description?: string
  control: React.ReactNode
  noBorder?: boolean
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 24, padding: '14px 18px',
      borderBottom: noBorder ? 'none' : '1px solid var(--border)',
    }}>
      <div>
        <div style={{ fontSize: 14, color: 'var(--text-1)', fontWeight: 500 }}>{label}</div>
        {description && (
          <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>{description}</div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{control}</div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function SettingsPage(): React.ReactElement {
  const [idleEnabled, setIdleEnabledState] = useState(true)
  const [idleMinutes, setIdleMinutesState] = useState(5)
  const [startupEnabled, setStartupEnabledState] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [cleared, setCleared] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([ipc.getSettings(), ipc.getStartupEnabled()]).then(([s, startup]) => {
      setIdleEnabledState(s['idle_enabled'] !== 'false')
      setIdleMinutesState(parseInt(s['idle_threshold_minutes'] ?? '5', 10))
      setStartupEnabledState(startup)
      setLoaded(true)
    })
  }, [])

  const handleIdleEnabled = useCallback((v: boolean) => {
    setIdleEnabledState(v)
    ipc.setSetting('idle_enabled', String(v))
  }, [])

  const handleIdleMinutes = useCallback((v: number) => {
    setIdleMinutesState(v)
    ipc.setSetting('idle_threshold_minutes', String(v))
  }, [])

  const handleStartup = useCallback((v: boolean) => {
    setStartupEnabledState(v)
    ipc.setStartupEnabled(v)
  }, [])

  const handleClearHistory = useCallback(async () => {
    if (!window.confirm('Delete all recorded screen time history? This cannot be undone.')) return
    setClearing(true)
    await ipc.clearHistory()
    setClearing(false)
    setCleared(true)
    setTimeout(() => setCleared(false), 3000)
  }, [])

  if (!loaded) return <div style={{ color: 'var(--text-4)', padding: 8 }}>Loading…</div>

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', marginBottom: 24 }}>
        Settings
      </h1>

      {/* ── Tracking ── */}
      <Section title="Tracking">
        <Row
          label="Idle Detection"
          description="Pause tracking when no keyboard or mouse input is detected"
          control={<Toggle checked={idleEnabled} onChange={handleIdleEnabled} />}
        />
        <Row
          label="Idle Timeout"
          description={`Stop counting after ${idleMinutes} minute${idleMinutes !== 1 ? 's' : ''} of inactivity`}
          noBorder
          control={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--text-4)', minWidth: 28, textAlign: 'right' }}>1m</span>
              <input
                type="range" min={1} max={30} value={idleMinutes}
                disabled={!idleEnabled}
                onChange={(e) => handleIdleMinutes(Number(e.target.value))}
                style={{ width: 120, accentColor: 'var(--accent)', opacity: idleEnabled ? 1 : 0.35 }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-4)', minWidth: 28 }}>30m</span>
            </div>
          }
        />
      </Section>

      {/* ── App ── */}
      <Section title="App">
        <Row
          label="Launch at startup"
          description="Start ScreenGuard automatically when Windows starts"
          noBorder
          control={<Toggle checked={startupEnabled} onChange={handleStartup} />}
        />
      </Section>

      {/* ── Data ── */}
      <Section title="Data">
        <Row
          label="Clear usage history"
          description="Permanently delete all recorded screen time data"
          noBorder
          control={
            <button
              onClick={handleClearHistory}
              disabled={clearing}
              style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: clearing ? 'default' : 'pointer',
                fontSize: 13, fontWeight: 500,
                background: cleared ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)',
                color: cleared ? '#22c55e' : '#ef4444',
                opacity: clearing ? 0.6 : 1,
                transition: 'all 0.2s',
              }}
            >
              {cleared ? '✓ Cleared' : clearing ? 'Clearing…' : 'Clear history'}
            </button>
          }
        />
      </Section>
    </div>
  )
}
