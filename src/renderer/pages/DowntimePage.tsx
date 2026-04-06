import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, FolderOpen, X } from 'lucide-react'
import { useDowntime } from '../hooks/useDowntime'
import { ipc } from '../lib/ipcClient'
import { friendlyName, isSelfApp } from '../lib/appNames'
import Toggle from '../components/shared/Toggle'
import Modal from '../components/shared/Modal'
import type { DowntimeRule, KnownApp } from '../types'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function parseDays(json: string): number[] {
  try { return JSON.parse(json) } catch { return [] }
}

function parseAppliesTo(val: string): string[] | 'all' {
  if (val === 'all') return 'all'
  try { return JSON.parse(val) } catch { return 'all' }
}

// ── Rule editor ──────────────────────────────────────────────────────────────
function RuleEditor({
  initial, onSave, onClose,
}: {
  initial?: Partial<DowntimeRule>
  onSave: (rule: Omit<DowntimeRule, 'id'>) => void
  onClose: () => void
}): React.ReactElement {
  const [label, setLabel]         = useState(initial?.label ?? '')
  const [days, setDays]           = useState<number[]>(parseDays(initial?.days_of_week ?? '[1,2,3,4,5]'))
  const [startTime, setStartTime] = useState(initial?.start_time ?? '22:00')
  const [endTime, setEndTime]     = useState(initial?.end_time ?? '07:00')

  // applies_to: 'all' or list of app_names
  const initialApplies = parseAppliesTo(initial?.applies_to ?? 'all')
  const [blockAll, setBlockAll]         = useState(initialApplies === 'all')
  const [selectedApps, setSelectedApps] = useState<string[]>(
    initialApplies === 'all' ? [] : initialApplies
  )
  const [knownApps, setKnownApps] = useState<KnownApp[]>([])

  useEffect(() => {
    ipc.getKnownApps().then((apps) => setKnownApps(apps.filter((a) => !isSelfApp(a.app_name))))
  }, [])

  function toggleDay(d: number) {
    setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort())
  }

  function toggleApp(appName: string) {
    setSelectedApps((prev) =>
      prev.includes(appName) ? prev.filter((a) => a !== appName) : [...prev, appName]
    )
  }

  async function handleBrowse() {
    const picked = await ipc.pickExe()
    if (!picked || isSelfApp(picked.app_name)) return
    if (!knownApps.some((a) => a.app_name === picked.app_name)) {
      setKnownApps((prev) => [...prev, picked])
    }
    setSelectedApps((prev) =>
      prev.includes(picked.app_name) ? prev : [...prev, picked.app_name]
    )
  }

  function handleSave() {
    const applies_to = blockAll ? 'all' : JSON.stringify(selectedApps)
    onSave({
      label,
      days_of_week: JSON.stringify(days),
      start_time: startTime,
      end_time: endTime,
      is_enabled: 1,
      applies_to,
    })
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-row)', border: '1px solid var(--border-hi)',
    borderRadius: 8, color: 'var(--text-1)', padding: '7px 10px', fontSize: 14, width: '100%',
  }

  const canSave = days.length > 0 && (blockAll || selectedApps.length > 0)

  return (
    <div>
      {/* Label */}
      <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>Label (optional)</label>
      <input
        style={{ ...inputStyle, marginBottom: 14 }}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="e.g. Bedtime"
      />

      {/* Days */}
      <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 8 }}>Days</label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {DAY_LABELS.map((day, i) => (
          <button
            key={i}
            onClick={() => toggleDay(i)}
            style={{
              padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
              background: days.includes(i) ? 'var(--accent)' : 'var(--bg-row)',
              color: days.includes(i) ? '#fff' : 'var(--text-3)',
              border: `1px solid ${days.includes(i) ? 'var(--accent)' : 'var(--border-hi)'}`,
              fontWeight: days.includes(i) ? 600 : 400,
            }}
          >
            {day}
          </button>
        ))}
      </div>

      {/* Time range */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>Start</label>
          <input type="time" style={inputStyle} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>End</label>
          <input type="time" style={inputStyle} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>

      {/* Applies to */}
      <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 8 }}>Block</label>
      <div style={{
        background: 'var(--bg-row)', border: '1px solid var(--border-hi)',
        borderRadius: 10, overflow: 'hidden', marginBottom: 20,
      }}>
        {/* All apps toggle */}
        <div
          onClick={() => setBlockAll(true)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', cursor: 'pointer',
            borderBottom: '1px solid var(--border)',
            background: blockAll ? 'var(--accent-sub)' : 'transparent',
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>All apps</div>
            <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 1 }}>
              Block everything during this period
            </div>
          </div>
          <div style={{
            width: 16, height: 16, borderRadius: '50%', border: `2px solid ${blockAll ? 'var(--accent)' : 'var(--border-hi)'}`,
            background: blockAll ? 'var(--accent)' : 'transparent', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {blockAll && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
          </div>
        </div>

        {/* Specific apps */}
        <div
          onClick={() => setBlockAll(false)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', cursor: 'pointer',
            background: !blockAll ? 'var(--accent-sub)' : 'transparent',
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>Specific apps</div>
            <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 1 }}>
              Choose which apps to block
            </div>
          </div>
          <div style={{
            width: 16, height: 16, borderRadius: '50%', border: `2px solid ${!blockAll ? 'var(--accent)' : 'var(--border-hi)'}`,
            background: !blockAll ? 'var(--accent)' : 'transparent', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {!blockAll && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
          </div>
        </div>

        {/* App picker — shown when specific mode */}
        {!blockAll && (
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
            {/* Currently selected apps */}
            {selectedApps.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {selectedApps.map((appName) => (
                  <div key={appName} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: 'var(--bg-card)', border: '1px solid var(--border-hi)',
                    borderRadius: 20, padding: '3px 8px 3px 10px', fontSize: 12, color: 'var(--text-2)',
                  }}>
                    {friendlyName(appName)}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleApp(appName) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', padding: 0, display: 'flex', lineHeight: 1 }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Tracked apps dropdown */}
            <select
              value=""
              onChange={(e) => { if (e.target.value) toggleApp(e.target.value) }}
              style={{
                width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-hi)',
                borderRadius: 7, color: selectedApps.length === 0 ? 'var(--text-3)' : 'var(--text-1)',
                padding: '7px 10px', fontSize: 13, marginBottom: 8,
              }}
            >
              <option value="">Add a tracked app…</option>
              {knownApps
                .filter((a) => !selectedApps.includes(a.app_name))
                .map((a) => (
                  <option key={a.app_name} value={a.app_name}>{friendlyName(a.app_name)}</option>
                ))}
            </select>

            {/* Browse button */}
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

            {selectedApps.length === 0 && (
              <div style={{ fontSize: 11, color: '#ef4444', marginTop: 8 }}>
                Select at least one app to block.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          onClick={onClose}
          style={{ padding: '8px 16px', borderRadius: 8, background: 'none', border: '1px solid var(--border-hi)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 13 }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave}
          style={{
            padding: '8px 16px', borderRadius: 8, background: 'var(--accent)', color: '#fff',
            border: 'none', cursor: canSave ? 'pointer' : 'default', fontSize: 13, fontWeight: 500,
            opacity: canSave ? 1 : 0.5,
          }}
        >
          Save Rule
        </button>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function DowntimePage(): React.ReactElement {
  const { rules, loading, refresh } = useDowntime()
  const [modal, setModal] = useState<'create' | { edit: DowntimeRule } | null>(null)

  async function handleCreate(rule: Omit<DowntimeRule, 'id'>) {
    await ipc.createDowntimeRule(rule)
    setModal(null)
    refresh()
  }

  async function handleUpdate(id: number, rule: Omit<DowntimeRule, 'id'>) {
    await ipc.updateDowntimeRule({ ...rule, id })
    setModal(null)
    refresh()
  }

  async function handleDelete(id: number) {
    await ipc.deleteDowntimeRule(id)
    refresh()
  }

  async function handleToggle(rule: DowntimeRule, enabled: boolean) {
    await ipc.updateDowntimeRule({ ...rule, is_enabled: enabled ? 1 : 0 })
    refresh()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Downtime</h1>
        <button
          onClick={() => setModal('create')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8,
            background: 'var(--accent)', color: '#fff', border: 'none',
            cursor: 'pointer', fontSize: 13, fontWeight: 500,
          }}
        >
          <Plus size={14} /> Add Rule
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-3)', textAlign: 'center', marginTop: 60 }}>Loading...</div>
      ) : rules.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-3)', marginTop: 60, fontSize: 14, lineHeight: 1.8 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🌙</div>
          No downtime rules yet.<br />
          Schedule blocks of time to automatically close specific apps.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rules.map((rule) => {
            const days = parseDays(rule.days_of_week)
            const appliesTo = parseAppliesTo(rule.applies_to)
            return (
              <div key={rule.id} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
                opacity: rule.is_enabled ? 1 : 0.5,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 4 }}>
                    {rule.label || 'Downtime'}
                    <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--accent)', fontWeight: 400 }}>
                      {rule.start_time} – {rule.end_time}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                    {DAY_LABELS.map((day, i) => (
                      <span key={i} style={{
                        fontSize: 11, padding: '1px 6px', borderRadius: 4,
                        background: days.includes(i) ? 'var(--accent-sub)' : 'transparent',
                        color: days.includes(i) ? 'var(--accent)' : 'var(--border-hi)',
                      }}>{day}</span>
                    ))}
                    <span style={{ fontSize: 11, color: 'var(--text-4)', margin: '0 4px' }}>·</span>
                    {appliesTo === 'all' ? (
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>All apps</span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        {appliesTo.map((a) => friendlyName(a)).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                <Toggle checked={rule.is_enabled === 1} onChange={(v) => handleToggle(rule, v)} />
                <button onClick={() => setModal({ edit: rule })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', padding: 4 }}>
                  <Edit2 size={14} />
                </button>
                <button onClick={() => handleDelete(rule.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', padding: 4 }}>
                  <Trash2 size={15} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {modal === 'create' && (
        <Modal title="Add Downtime Rule" onClose={() => setModal(null)}>
          <RuleEditor onSave={handleCreate} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal !== null && modal !== 'create' && (
        <Modal title="Edit Downtime Rule" onClose={() => setModal(null)}>
          <RuleEditor initial={modal.edit} onSave={(rule) => handleUpdate(modal.edit.id, rule)} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  )
}
