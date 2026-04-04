import React, { useState } from 'react'
import { Plus, Trash2, Edit2 } from 'lucide-react'
import { useDowntime } from '../hooks/useDowntime'
import { ipc } from '../lib/ipcClient'
import Toggle from '../components/shared/Toggle'
import Modal from '../components/shared/Modal'
import type { DowntimeRule } from '../types'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function parseDays(json: string): number[] {
  try { return JSON.parse(json) } catch { return [] }
}

function RuleEditor({
  initial,
  onSave,
  onClose,
}: {
  initial?: Partial<DowntimeRule>
  onSave: (rule: Omit<DowntimeRule, 'id'>) => void
  onClose: () => void
}): React.ReactElement {
  const [label, setLabel] = useState(initial?.label ?? '')
  const [days, setDays] = useState<number[]>(parseDays(initial?.days_of_week ?? '[1,2,3,4,5]'))
  const [startTime, setStartTime] = useState(initial?.start_time ?? '22:00')
  const [endTime, setEndTime] = useState(initial?.end_time ?? '07:00')

  function toggleDay(d: number) {
    setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort())
  }

  const inputStyle: React.CSSProperties = {
    background: '#1e2133', border: '1px solid #374162',
    borderRadius: 8, color: '#e2e8f0', padding: '7px 10px', fontSize: 14,
    width: '100%',
  }

  return (
    <div>
      <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Label (optional)</label>
      <input
        style={{ ...inputStyle, marginBottom: 14 }}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="e.g. Bedtime"
      />

      <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 8 }}>Days</label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {DAY_LABELS.map((day, i) => (
          <button
            key={i}
            onClick={() => toggleDay(i)}
            style={{
              padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
              background: days.includes(i) ? '#7c8cf8' : '#1e2133',
              color: days.includes(i) ? '#fff' : '#64748b',
              border: `1px solid ${days.includes(i) ? '#7c8cf8' : '#374162'}`,
              fontWeight: days.includes(i) ? 600 : 400,
            }}
          >
            {day}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Start</label>
          <input type="time" style={inputStyle} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>End</label>
          <input type="time" style={inputStyle} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          onClick={onClose}
          style={{ padding: '8px 16px', borderRadius: 8, background: 'none', border: '1px solid #374162', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}
        >
          Cancel
        </button>
        <button
          onClick={() => onSave({ label, days_of_week: JSON.stringify(days), start_time: startTime, end_time: endTime, is_enabled: 1, applies_to: 'all' })}
          disabled={days.length === 0}
          style={{ padding: '8px 16px', borderRadius: 8, background: '#7c8cf8', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          Save Rule
        </button>
      </div>
    </div>
  )
}

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

  const btnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', borderRadius: 8,
    background: '#7c8cf8', color: '#fff', border: 'none',
    cursor: 'pointer', fontSize: 13, fontWeight: 500,
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0' }}>Downtime</h1>
        <button style={btnStyle} onClick={() => setModal('create')}>
          <Plus size={14} /> Add Rule
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#64748b', textAlign: 'center', marginTop: 60 }}>Loading...</div>
      ) : rules.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#64748b', marginTop: 60, fontSize: 14, lineHeight: 1.8 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🌙</div>
          No downtime rules yet.<br />
          Schedule blocks of time when apps should be closed automatically.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rules.map((rule) => {
            const days = parseDays(rule.days_of_week)
            return (
              <div
                key={rule.id}
                style={{
                  background: '#1a1d2e', border: '1px solid #2d3148',
                  borderRadius: 10, padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  opacity: rule.is_enabled ? 1 : 0.5,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 4 }}>
                    {rule.label || 'Downtime'}
                    <span style={{ marginLeft: 8, fontSize: 12, color: '#7c8cf8', fontWeight: 400 }}>
                      {rule.start_time} – {rule.end_time}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {DAY_LABELS.map((day, i) => (
                      <span key={i} style={{
                        fontSize: 11, padding: '1px 6px', borderRadius: 4,
                        background: days.includes(i) ? 'rgba(124,140,248,0.15)' : 'transparent',
                        color: days.includes(i) ? '#7c8cf8' : '#374162',
                      }}>{day}</span>
                    ))}
                  </div>
                </div>
                <Toggle checked={rule.is_enabled === 1} onChange={(v) => handleToggle(rule, v)} />
                <button
                  onClick={() => setModal({ edit: rule })}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 4 }}
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => handleDelete(rule.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 4 }}
                >
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
          <RuleEditor
            initial={modal.edit}
            onSave={(rule) => handleUpdate(modal.edit.id, rule)}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  )
}
