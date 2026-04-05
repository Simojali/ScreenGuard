import React, { useState } from 'react'

interface Props {
  valueMs: number
  onChange: (ms: number) => void
}

export default function DurationInput({ valueMs, onChange }: Props): React.ReactElement {
  const totalMinutes = Math.floor(valueMs / 60000)
  const [hours, setHours] = useState(Math.floor(totalMinutes / 60))
  const [minutes, setMinutes] = useState(totalMinutes % 60)

  function update(h: number, m: number) {
    const clampedH = Math.max(0, Math.min(23, h))
    const clampedM = Math.max(0, Math.min(59, m))
    setHours(clampedH)
    setMinutes(clampedM)
    onChange((clampedH * 60 + clampedM) * 60000)
  }

  const inputStyle: React.CSSProperties = {
    width: 56,
    background: 'var(--bg-row)',
    border: '1px solid var(--border-hi)',
    borderRadius: 6,
    color: 'var(--text-1)',
    padding: '6px 8px',
    fontSize: 14,
    textAlign: 'center',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input
        type="number" min={0} max={23} value={hours}
        onChange={(e) => update(Number(e.target.value), minutes)}
        style={inputStyle}
      />
      <span style={{ color: 'var(--text-3)', fontSize: 13 }}>h</span>
      <input
        type="number" min={0} max={59} value={minutes}
        onChange={(e) => update(hours, Number(e.target.value))}
        style={inputStyle}
      />
      <span style={{ color: 'var(--text-3)', fontSize: 13 }}>m</span>
    </div>
  )
}
