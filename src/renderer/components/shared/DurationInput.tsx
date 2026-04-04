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
    background: '#1e2133',
    border: '1px solid #374162',
    borderRadius: 6,
    color: '#e2e8f0',
    padding: '6px 8px',
    fontSize: 14,
    textAlign: 'center',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input
        type="number"
        min={0} max={23}
        value={hours}
        onChange={(e) => update(Number(e.target.value), minutes)}
        style={inputStyle}
      />
      <span style={{ color: '#64748b', fontSize: 13 }}>h</span>
      <input
        type="number"
        min={0} max={59}
        value={minutes}
        onChange={(e) => update(hours, Number(e.target.value))}
        style={inputStyle}
      />
      <span style={{ color: '#64748b', fontSize: 13 }}>m</span>
    </div>
  )
}
