import React from 'react';
import { TEAL } from '../../styles/theme.js';

export default function PushPermissionBanner({ onAllow, onDismiss }) {
  return (
    <div style={{
      position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      background: '#1a2535', color: '#fff', borderRadius: 12, padding: '14px 18px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)', zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 14, maxWidth: 420, width: 'calc(100% - 32px)',
      border: '1px solid ' + TEAL,
    }}>
      <span style={{ fontSize: 28 }}>🔔</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>Activar notificaciones</div>
        <div style={{ fontSize: 12, color: '#aaa' }}>Recibe alertas de cuentas vencidas, garantías y reparaciones</div>
      </div>
      <button onClick={onAllow} style={{
        background: TEAL, color: '#fff', border: 'none', borderRadius: 8,
        padding: '8px 14px', fontWeight: 700, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap',
      }}>Activar</button>
      <button onClick={onDismiss} style={{
        background: 'transparent', color: '#aaa', border: 'none',
        cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 4px',
      }}>✕</button>
    </div>
  );
}
