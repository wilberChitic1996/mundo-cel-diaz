import React from 'react'

export default function MetricBox({ label, value, color }) {
  return (
    <div style={{
      background: '#f5f4f0',
      borderRadius: 10,
      padding: '16px',
      border: '1px solid rgba(0,0,0,0.07)',
    }}>
      <p style={{ fontSize: 12, color: '#666', margin: '0 0 6px' }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 600, margin: 0, color: color || '#1a1a1a' }}>
        {value}
      </p>
    </div>
  )
}
