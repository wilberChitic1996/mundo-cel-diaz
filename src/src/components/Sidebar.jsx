import React from 'react'
import { TEAL, NAVY } from '../styles/theme.js'

const TEAL_COLOR = TEAL;

const NAV_ITEMS = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard' },
  { id: 'pos',       icon: '🛒', label: 'Nueva Venta' },
  { id: 'caja',      icon: '💰', label: 'Caja' },
  { id: 'accounts',  icon: '💳', label: 'Cuentas' },
  { id: 'returns',   icon: '🔄', label: 'Devoluciones' },
  { id: 'defective', icon: '⚠️',  label: 'Defectuosos' },
  { id: 'products',  icon: '📦', label: 'Productos' },
  { id: 'inventory', icon: '🗄️', label: 'Inventario' },
  { id: 'history',   icon: '📋', label: 'Historial' },
  { id: 'backup',    icon: '💾', label: 'Respaldo' },
  { id: 'users',     icon: '👥', label: 'Usuarios' },
]

var PERMS = {
  admin:   ["dashboard","pos","caja","accounts","returns","defective","products","inventory","history","backup","users"],
  cajero:  ["dashboard","pos","caja","accounts","returns","history"],
  auditor: ["dashboard","caja","history","inventory"],
}

var ROLE_LABEL = { admin:"Administrador", cajero:"Cajero", auditor:"Auditor (solo lectura)" }

export default function Sidebar({ view, setView, cartCount, pendingCount, products, sales, session, onLogout, isOnline }) {
  var role = session ? session.role : "auditor"
  var allowed = PERMS[role] || []
  var visibleItems = NAV_ITEMS.filter(function(item){ return allowed.indexOf(item.id) >= 0 })

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
              background: 'linear-gradient(135deg,' + TEAL + ',#0d7a5a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }}>
              📱
            </div>
            <div>
              <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>MUNDO CEL</p>
              <p style={{ color: TEAL, fontSize: 11, fontWeight: 700, margin: 0, letterSpacing: '0.5px' }}>DIAZ</p>
            </div>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, margin: '6px 0 0', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            Sistema de Gestión v2.1
          </p>
        </div>

        {/* Usuario activo */}
        {session && (
            <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)' }}>
              <p style={{ color: '#fff', fontSize: 12, fontWeight: 600, margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {session.name}
              </p>
              <p style={{ color: TEAL, fontSize: 10, margin: 0, fontWeight: 500 }}>
                {ROLE_LABEL[role] || role}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: isOnline ? '#4CAF50' : '#E24B4A', flexShrink: 0 }}/>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>{isOnline ? 'En línea' : 'Sin conexión'}</span>
              </div>
            </div>
        )}

        {/* Navegación */}
        <nav style={{ flex: 1, padding: '10px 0', overflowY: 'auto' }}>
          {visibleItems.map(function(item) {
            var id = item.id; var icon = item.icon; var label = item.label;
            var isActive = view === id
            var badge = id === 'accounts' ? pendingCount : id === 'pos' ? cartCount : 0
            return (
                <div
                    key={id}
                    onClick={function(){ setView(id); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '11px 16px',
                      cursor: 'pointer',
                      background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                      color: isActive ? '#fff' : 'rgba(255,255,255,0.52)',
                      fontSize: 13,
                      borderLeft: isActive ? '3px solid ' + TEAL : '3px solid transparent',
                      marginBottom: 1,
                      transition: 'background 0.15s',
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
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', lineHeight: 1.9, marginBottom: 8 }}>
            {products.length} productos · {sales.length} ventas
          </div>
          {onLogout && (
              <div
                  onClick={onLogout}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    cursor: 'pointer', color: 'rgba(255,255,255,0.4)',
                    fontSize: 12, padding: '6px 0',
                  }}
              >
                <span>🚪</span>
                <span>Cerrar sesión</span>
              </div>
          )}
        </div>
      </div>
  )
}