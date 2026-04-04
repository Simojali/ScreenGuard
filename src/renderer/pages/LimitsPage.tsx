import React, { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useLimits } from '../hooks/useLimits'
import { ipc } from '../lib/ipcClient'
import { friendlyName } from '../lib/appNames'
import Toggle from '../components/shared/Toggle'
import Modal from '../components/shared/Modal'
import DurationInput from '../components/shared/DurationInput'
import type { KnownApp } from '../types'

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export default function LimitsPage(): React.ReactElement {
  const { limits, loading, refresh } = useLimits()
  const [showModal, setShowModal] = useState(false)
  const [knownApps, setKnownApps] = useState<KnownApp[]>([])
  const [selectedApp, setSelectedApp] = useState<KnownApp | null>(null)
  const [limitMs, setLimitMs] = useState(3600000) // default 1h

  async function openModal() {
    const apps = await ipc.getKnownApps()
    setKnownApps(apps)
    setSelectedApp(apps[0] ?? null)
    setLimitMs(3600000)
    setShowModal(true)
  }

  async function handleSave() {
    if (!selectedApp) return
    await ipc.setLimit(selectedApp.app_name, selectedApp.exe_path, limitMs)
    setShowModal(false)
    refresh()
  }

  async function handleDelete(appName: string) {
    await ipc.deleteLimit(appName)
    refresh()
  }

  async function handleToggle(appName: string, isEnabled: boolean) {
    await ipc.toggleLimit(appName, isEnabled)
    refresh()
  }

  const btnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', borderRadius: 8,
    background: '#7c8cf8', color: '#fff', border: 'none',
    cursor: 'pointer', fontSize: 13, fontWeight: 500,
  }

  const selectStyle: React.CSSProperties = {
    width: '100%', background: '#1e2133', border: '1px solid #374162',
    borderRadius: 8, color: '#e2e8f0', padding: '8px 10px', fontSize: 14,
    marginBottom: 16,
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0' }}>App Limits</h1>
        <button style={btnStyle} onClick={openModal}>
          <Plus size={14} /> Add Limit
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#64748b', textAlign: 'center', marginTop: 60 }}>Loading...</div>
      ) : limits.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#64748b', marginTop: 60, fontSize: 14, lineHeight: 1.8 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏱</div>
          No limits set yet.<br />
          Add a limit to control how long you spend in an app each day.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {limits.map((limit) => (
            <div
              key={limit.app_name}
              style={{
                background: '#1a1d2e', border: '1px solid #2d3148',
                borderRadius: 10, padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
                opacity: limit.is_enabled ? 1 : 0.5,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#e2e8f0' }}>{friendlyName(limit.app_name)}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  Daily limit: <span style={{ color: '#7c8cf8' }}>{formatDuration(limit.limit_ms)}</span>
                </div>
              </div>
              <Toggle
                checked={limit.is_enabled === 1}
                onChange={(v) => handleToggle(limit.app_name, v)}
              />
              <button
                onClick={() => handleDelete(limit.app_name)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 4 }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title="Add App Limit" onClose={() => setShowModal(false)}>
          <div>
            <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>App</label>
            {knownApps.length > 0 ? (
              <select
                style={selectStyle}
                value={selectedApp?.app_name ?? ''}
                onChange={(e) => {
                  const app = knownApps.find((a) => a.app_name === e.target.value) ?? null
                  setSelectedApp(app)
                }}
              >
                {knownApps.map((a) => (
                  <option key={a.app_name} value={a.app_name}>{friendlyName(a.app_name)}</option>
                ))}
              </select>
            ) : (
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                No apps tracked yet. Use your computer for a bit first.
              </div>
            )}

            <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 8 }}>Daily Limit</label>
            <DurationInput valueMs={limitMs} onChange={setLimitMs} />

            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{ padding: '8px 16px', borderRadius: 8, background: 'none', border: '1px solid #374162', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!selectedApp || limitMs === 0}
                style={{ padding: '8px 16px', borderRadius: 8, background: '#7c8cf8', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
              >
                Save Limit
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
