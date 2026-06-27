import React, { useEffect, useState } from 'react';
import { remindersAPI } from '../../utils/api.js';
import { Q } from '../../utils/formatters.js';

var styles = {
  wrap:  { background: 'var(--bg-card,#fff)', borderRadius: 10, padding: '14px 18px', border: '1px solid var(--border,#e5e7eb)' },
  title: { fontSize: 14, fontWeight: 600, color: 'var(--text-secondary,#6b7280)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' },
  badge: { display: 'inline-block', borderRadius: 99, padding: '2px 10px', fontSize: 12, fontWeight: 700, marginRight: 6 },
  row:   { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border,#f3f4f6)', fontSize: 13 },
  empty: { color: 'var(--text-secondary,#6b7280)', fontSize: 13, textAlign: 'center', padding: '12px 0' },
};

function Badge({ count, color }) {
  return <span style={{ ...styles.badge, background: color + '20', color }}>{count}</span>;
}

export default function RemindersWidget({ setView }) {
  setView = setView || function() {};
  var [data, setData] = useState(null);
  var [loading, setLoading] = useState(true);

  useEffect(function() {
    remindersAPI.summary()
      .then(function(res) { setData(res.data); })
      .catch(function() { setData(null); })
      .finally(function() { setLoading(false); });
  }, []);

  if (loading) return <div style={styles.wrap}><p style={styles.empty}>Cargando alertas…</p></div>;
  if (!data) return null;

  var { accounts_overdue = [], warranties_expiring = [], repairs_stalled = [], counts = {} } = data;
  var total = (counts.accounts_overdue || 0) + (counts.warranties_expiring || 0) + (counts.repairs_stalled || 0);

  return (
    <div style={styles.wrap}>
      <div style={styles.title}>
        Recordatorios
        {total > 0 && <Badge count={total} color="#ef4444" />}
      </div>

      {total === 0 && <p style={styles.empty}>✓ Sin alertas pendientes</p>}

      {accounts_overdue.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', marginBottom: 4, cursor: 'pointer' }} onClick={function() { setView('accounts'); }}>
            Cuentas vencidas ({counts.accounts_overdue}) →
          </div>
          {accounts_overdue.slice(0, 3).map(function(a) {
            return (
              <div key={a.id} style={Object.assign({}, styles.row, { cursor: 'pointer' })} onClick={function() { setView('accounts'); }}>
                <span style={{ flex: 1 }}>{a.client}</span>
                <span style={{ color: '#ef4444', fontWeight: 600 }}>{Q(a.balance)}</span>
                <span style={{ color: '#9ca3af', fontSize: 11 }}>{a.days_overdue}d vencida</span>
              </div>
            );
          })}
          {accounts_overdue.length > 3 && (
            <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0', cursor: 'pointer' }} onClick={function() { setView('accounts'); }}>
              +{accounts_overdue.length - 3} más → Ver todas
            </p>
          )}
        </div>
      )}

      {warranties_expiring.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b', marginBottom: 4, cursor: 'pointer' }} onClick={function() { setView('warranties'); }}>
            Garantías por vencer ({counts.warranties_expiring}) →
          </div>
          {warranties_expiring.slice(0, 3).map(function(w) {
            return (
              <div key={w.id} style={Object.assign({}, styles.row, { cursor: 'pointer' })} onClick={function() { setView('warranties'); }}>
                <span style={{ flex: 1 }}>{w.client}</span>
                <span style={{ color: '#f59e0b', fontSize: 11 }}>vence en {w.days_left}d</span>
              </div>
            );
          })}
        </div>
      )}

      {repairs_stalled.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, cursor: 'pointer' }} onClick={function() { setView('repairs'); }}>
            Reparaciones sin movimiento ({counts.repairs_stalled}) →
          </div>
          {repairs_stalled.slice(0, 3).map(function(r) {
            return (
              <div key={r.id} style={Object.assign({}, styles.row, { cursor: 'pointer' })} onClick={function() { setView('repairs'); }}>
                <span style={{ flex: 1 }}>{r.client} — {r.device}</span>
                <span style={{ color: '#9ca3af', fontSize: 11 }}>Atender →</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
