import React from 'react'
import { TEAL, NAVY } from '../styles/theme.js'

const NAV_ITEMS = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard' },
  { id: 'pos',       icon: '🛒', label: 'Nueva Venta' },
  { id: 'accounts',  icon: '💳', label: 'Cuentas' },
  { id: 'returns',   icon: '🔄', label: 'Devoluciones' },
  { id: 'products',  icon: '📦', label: 'Productos' },
  { id: 'inventory', icon: '🗄️', label: 'Inventario' },
  { id: 'history',   icon: '📋', label: 'Historial' },
  { id: 'backup',    icon: '💾', label: 'Respaldo' },
]

export default function Sidebar({ view, setView, cartCount, pendingCount, products, sales }) {
  const handleNav = (id) => setView(id)

  return (
    <div style={{
      width: 200,
      background: NAVY,
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      position: 'sticky',
      top: 0,
      height: '100vh',
    }}>
      {/* Logo */}
      <div style={{ padding: '18px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: `linear-gradient(135deg, ${TEAL}, #0d7a5a)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
          }}>
            📱
          </div>
          <div>
            <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
              MUNDO CEL
            </p>
            <p style={{ color: TEAL, fontSize: 11, fontWeight: 700, margin: 0, letterSpacing: '0.5px' }}>
              DIAZ
            </p>
          </div>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, margin: '6px 0 0', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
          Sistema de Gestión v2.0
        </p>
      </div>

      {/* Navegación */}
      <nav style={{ flex: 1, padding: '10px 0', overflowY: 'auto' }}>
        {NAV_ITEMS.map(({ id, icon, label }) => {
          const isActive = view === id
          const badge = id === 'accounts' ? pendingCount : id === 'pos' ? cartCount : 0
          return (
            <div
              key={id}
              onClick={() => handleNav(id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '11px 16px',
                cursor: 'pointer',
                background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.52)',
                fontSize: 13,
                borderLeft: isActive ? `3px solid ${TEAL}` : '3px solid transparent',
                marginBottom: 1,
              }}
            >
              <span style={{ fontSize: 15 }}>{icon}</span>
              <span style={{ flex: 1 }}>{label}</span>
              {badge > 0 && (
                <span style={{
                  background: id === 'pos' ? TEAL : '#E24B4A',
                  color: '#fff', borderRadius: 10,
                  fontSize: 10, padding: '1px 6px', fontWeight: 700,
                }}>
                  {badge}
                </span>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', lineHeight: 1.9 }}>
          {products.length} productos · {sales.length} ventas
        </div>
      </div>
    </div>
  )
}
