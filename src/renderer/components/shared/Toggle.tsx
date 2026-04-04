import React from 'react'

interface Props {
  checked: boolean
  onChange: (checked: boolean) => void
}

export default function Toggle({ checked, onChange }: Props): React.ReactElement {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 36, height: 20, borderRadius: 10,
        background: checked ? '#7c8cf8' : '#374151',
        border: 'none', cursor: 'pointer', position: 'relative',
        transition: 'background 0.2s', padding: 2,
        display: 'flex', alignItems: 'center',
      }}
    >
      <span style={{
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        transform: checked ? 'translateX(16px)' : 'translateX(0)',
        transition: 'transform 0.2s', display: 'block',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  )
}
