import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, Bell, FolderOpen } from 'lucide-react'
import { ipc } from '../lib/ipcClient'
import { friendlyName, isSelfApp } from '../lib/appNames'
import Toggle from '../components/shared/Toggle'
import Modal from '../components/shared/Modal'
import DurationInput from '../components/shared/DurationInput'
import type { Reminder, KnownApp } from '../types'

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

// ── Editor modal ─────────────────────────────────────────────────────────────
function ReminderEditor({
  initial,
  onSave,
  onClose,
}: {
  initial?: Partial<Reminder>
  onSave: (r: { label: string; app_name: string; threshold_ms: number }) => void
  onClose: () => void
}): React.ReactElement {
  const [label, setLabel]           = useState(initial?.label ?? '')
  const [appName, setAppName]       = useState(initial?.app_name ?? 'all')
  const [thresholdMs, setThreshold] = useState(initial?.threshold_ms ?? 7200000) // 2h default
  const [knownApps, setKnownApps]   = useState<KnownApp[]>([])
  const [allApps, setAllApps]       = useState(initial?.app_name === undefined || initial?.app_name === 'all')

  useEffect(() => {
    ipc.getKnownApps().then((apps) => setKnownApps(apps.filter((a) => !isSelfApp(a.app_name))))
  }, [])

  async function handleBrowse() {
    const picked = await ipc.pickExe()
    if (!picked || isSelfApp(picked.app_name)) return
    if (!knownApps.some((a) => a.app_name === picked.app_name)) {
      setKnownApps((prev) => [...prev, picked])
    }
    setAppName(picked.app_name)
    setAllApps(false)
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-row)', border: '1px solid var(--border-hi)',
    borderRadius: 8, color: 'var(--text-1)', padding: '7px 10px', fontSize: 14, width: '100%',
  }

  return (
    <div>
      {/* Label */}
      <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>Label (optional)</label>
      <input
        style={{ ...inputStyle, marginBottom: 16 }}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="e.g. Take a break"
      />

      {/* App target */}
      <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 8 }}>Apply to</label>
      <div style={{
        background: 'var(--bg-row)', border: '1px solid var(--border-hi)',
        borderRadius: 10, overflow: 'hidden', marginBottom: 16,
      }}>
        {/* All apps option */}
        <div
          onClick={() => { setAllApps(true); setAppName('all') }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', cursor: 'pointer',
            borderBottom: '1px solid var(--border)',
            background: allApps ? 'var(--accent-sub)' : 'transparent',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>All apps combined</div>
          <div style={{
            width: 16, height: 16, borderRadius: '50%',
            border: `2px solid ${allApps ? 'var(--accent)' : 'var(--border-hi)'}`,
            background: allApps ? 'var(--accent)' : 'transparent', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {allApps && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
          </div>
        </div>

        {/* Specific app option */}
        <div
          onClick={() => { setAllApps(false); if (appName === 'all') setAppName(knownApps[0]?.app_name ?? '') }}
          style={{
            padding: '10px 14px', cursor: 'pointer',
            background: !allApps ? 'var(--accent-sub)' : 'transparent',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: !allApps ? 10 : 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>Specific app</div>
            <div style={{
              width: 16, height: 16, borderRadius: '50%',
              border: `2px solid ${!allApps ? 'var(--accent)' : 'var(--border-hi)'}`,
              background: !allApps ? 'var(--accent)' : 'transparent', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {!allApps && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
            </div>
          </div>

          {!allApps && (
            <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <select
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                style={{
                  width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-hi)',
                  borderRadius: 7, color: 'var(--text-1)', padding: '7px 10px', fontSize: 13,
                }}
              >
                {appName && !knownApps.some((a) => a.app_name === appName) && appName !== 'all' && (
                  <option value={appName}>{friendlyName(appName)}</option>
                )}
                {knownApps.map((a) => (
                  <option key={a.app_name} value={a.app_name}>{friendlyName(a.app_name)}</option>
                ))}
                {knownApps.length === 0 && <option value="">No tracked apps yet</option>}
              </select>
              <button
                onClick={handleBrowse}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                  background: 'none', border: '1px dashed var(--border-hi)', borderRadius: 7,
                  color: 'var(--text-3)', padding: '6px 10px', cursor: 'pointer', fontSize: 12,
                }}
              >
                <FolderOpen size={13} /> Browse for app…
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Threshold */}
      <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 8 }}>Alert after</label>
      <DurationInput valueMs={thresholdMs} onChange={setThreshold} />

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
        <button
          onClick={onClose}
          style={{ padding: '8px 16px', borderRadius: 8, background: 'none', border: '1px solid var(--border-hi)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 13 }}
        >
          Cancel
        </button>
        <button
          onClick={() => onSave({ label, app_name: allApps ? 'all' : appName, threshold_ms: thresholdMs })}
          disabled={thresholdMs === 0 || (!allApps && !appName)}
          style={{
            padding: '8px 16px', borderRadius: 8, background: 'var(--accent)', color: '#fff',
            border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
            opacity: thresholdMs === 0 || (!allApps && !appName) ? 0.5 : 1,
          }}
        >
          Save Reminder
        </button>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function RemindersPage(): React.ReactElement {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState<'create' | { edit: Reminder } | null>(null)

  async function load() {
    setLoading(true)
    setReminders(await ipc.getReminders())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleCreate(r: { label: string; app_name: string; threshold_ms: number }) {
    await ipc.createReminder(r)
    setModal(null)
    load()
  }

  async function handleUpdate(id: number, r: { label: string; app_name: string; threshold_ms: number }) {
    await ipc.updateReminder({ id, ...r, is_enabled: 1 })
    setModal(null)
    load()
  }

  async function handleDelete(id: number) {
    await ipc.deleteReminder(id)
    load()
  }

  async function handleToggle(id: number, enabled: boolean) {
    await ipc.toggleReminder(id, enabled)
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Reminders</h1>
        <button
          onClick={() => setModal('create')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8,
            background: 'var(--accent)', color: '#fff', border: 'none',
            cursor: 'pointer', fontSize: 13, fontWeight: 500,
          }}
        >
          <Plus size={14} /> Add Reminder
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-3)', textAlign: 'center', marginTop: 60 }}>Loading...</div>
      ) : reminders.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-3)', marginTop: 60, fontSize: 14, lineHeight: 1.8 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔔</div>
          No reminders set yet.<br />
          Get notified when you've spent too long on an app.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reminders.map((r) => (
            <div
              key={r.id}
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
                opacity: r.is_enabled ? 1 : 0.5,
              }}
            >
              {/* Bell icon */}
              <div style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: 'var(--accent-sub)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Bell size={16} color="var(--accent)" />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>
                  {r.label || (r.app_name === 'all' ? 'All apps' : friendlyName(r.app_name))}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                  {r.app_name === 'all'
                    ? 'All apps combined'
                    : friendlyName(r.app_name)
                  }
                  {' · Alert after '}
                  <span style={{ color: 'var(--accent)' }}>{formatDuration(r.threshold_ms)}</span>
                </div>
              </div>

              <Toggle checked={r.is_enabled === 1} onChange={(v) => handleToggle(r.id, v)} />
              <button
                onClick={() => setModal({ edit: r })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', padding: 4 }}
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={() => handleDelete(r.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', padding: 4 }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {modal === 'create' && (
        <Modal title="Add Reminder" onClose={() => setModal(null)}>
          <ReminderEditor onSave={handleCreate} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal !== null && modal !== 'create' && (
        <Modal title="Edit Reminder" onClose={() => setModal(null)}>
          <ReminderEditor
            initial={modal.edit}
            onSave={(r) => handleUpdate(modal.edit.id, r)}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  )
}
