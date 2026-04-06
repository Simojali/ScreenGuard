import React, { useState } from 'react'
import { Plus, Trash2, FolderOpen } from 'lucide-react'
import { useLimits } from '../hooks/useLimits'
import { ipc } from '../lib/ipcClient'
import { friendlyName, isSelfApp } from '../lib/appNames'
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
  const [limitMs, setLimitMs] = useState(3600000)

  async function openModal() {
    const apps = (await ipc.getKnownApps()).filter((a) => !isSelfApp(a.app_name))
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

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>App Limits</h1>
        <button
          onClick={openModal}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8,
            background: 'var(--accent)', color: '#fff', border: 'none',
            cursor: 'pointer', fontSize: 13, fontWeight: 500,
          }}
        >
          <Plus size={14} /> Add Limit
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-3)', textAlign: 'center', marginTop: 60 }}>Loading...</div>
      ) : limits.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-3)', marginTop: 60, fontSize: 14, lineHeight: 1.8 }}>
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
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
                opacity: limit.is_enabled ? 1 : 0.5,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>
                  {friendlyName(limit.app_name)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                  Daily limit: <span style={{ color: 'var(--accent)' }}>{formatDuration(limit.limit_ms)}</span>
                </div>
              </div>
              <Toggle checked={limit.is_enabled === 1} onChange={(v) => handleToggle(limit.app_name, v)} />
              <button
                onClick={() => handleDelete(limit.app_name)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', padding: 4 }}
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
            <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>App</label>
            {knownApps.length > 0 ? (
              <select
                style={{
                  width: '100%', background: 'var(--bg-row)', border: '1px solid var(--border-hi)',
                  borderRadius: 8, color: 'var(--text-1)', padding: '8px 10px', fontSize: 14,
                }}
                value={selectedApp?.app_name ?? ''}
                onChange={(e) => setSelectedApp(knownApps.find((a) => a.app_name === e.target.value) ?? null)}
              >
                {knownApps.map((a) => (
                  <option key={a.app_name} value={a.app_name}>{friendlyName(a.app_name)}</option>
                ))}
              </select>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
                No apps tracked yet. Use your computer for a bit, or browse manually below.
              </div>
            )}
            {/* Manual browse */}
            <button
              onClick={async () => {
                const picked = await ipc.pickExe()
                if (!picked || isSelfApp(picked.app_name)) return
                setSelectedApp(picked)
                // Add to local list if not already present
                setKnownApps((prev) =>
                  prev.some((a) => a.app_name === picked.app_name) ? prev : [...prev, picked]
                )
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 16,
                background: 'none', border: '1px dashed var(--border-hi)', borderRadius: 8,
                color: 'var(--text-3)', padding: '7px 12px', cursor: 'pointer', fontSize: 13, width: '100%',
              }}
            >
              <FolderOpen size={14} />
              Browse for app…
              {selectedApp && !knownApps.slice(0, -1).some((a) => a.app_name === selectedApp.app_name) && (
                <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 12 }}>
                  {friendlyName(selectedApp.app_name)}
                </span>
              )}
            </button>

            <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 8 }}>Daily Limit</label>
            <DurationInput valueMs={limitMs} onChange={setLimitMs} />

            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{ padding: '8px 16px', borderRadius: 8, background: 'none', border: '1px solid var(--border-hi)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!selectedApp || limitMs === 0}
                style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
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
