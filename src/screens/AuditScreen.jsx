// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA: AuditScreen (Rastro de Auditoría)
//
// Muestra el log de todas las acciones realizadas en el sistema.
// Solo visible para administradores y auditores.
//
// Filtros:
//   - Tipo de registro (venta, cuenta, producto, usuario, cliente, reparación...)
//   - Acción específica (venta_completada, abono_registrado, etc.)
//   - Usuario que realizó la acción
//   - Rango de fechas (desde / hasta)
//
// Detalle inteligente:
//   - Acciones simples → texto descriptivo (cliente, monto, método)
//   - Acciones de edición → diff visual (campo: antes → después)
//
// Paginación:
//   - 50 registros por página, navegación con botones Anterior / Siguiente
//   - La carga se dispara automáticamente al cambiar filtros (useEffect)
//
// Props:
//   session {Object} — sesión activa (para autorización en el componente padre)
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { TEAL, sCard, sInput, sLabel, sTH, sTD, mkBtn, mkBadge } from '../styles/theme.js';
import { fmtD, fmtT } from '../utils/formatters.js';
import { auditAPI } from '../utils/api.js';
import { ROLE_LABEL } from '../constants/index.js';

// ── Mapas de etiquetas y colores para tipos de acción ─────────────────────
var AUDIT_ACTIONS = {
  venta_completada:     'Venta',
  cuenta_creada:        'Cuenta por cobrar',
  abono_registrado:     'Abono',
  producto_creado:      'Producto creado',
  producto_editado:     'Producto editado',
  producto_eliminado:   'Producto eliminado',
  usuario_creado:       'Usuario creado',
  usuario_editado:      'Usuario editado',
  cliente_creado:       'Cliente creado',
  cliente_editado:      'Cliente editado',
  cliente_eliminado:    'Cliente eliminado',
  reparacion_creada:    'Reparación creada',
  reparacion_editada:   'Reparación editada',
  reparacion_estado:    'Estado reparación',
  reparacion_eliminada: 'Reparación eliminada',
  devolucion_registrada:'Devolución',
  defectuoso_estado:    'Defectuoso actualizado',
};

var AUDIT_COLORS = {
  venta_completada:     'teal',
  cuenta_creada:        'blue',
  abono_registrado:     'green',
  producto_creado:      'purple',
  producto_editado:     'amber',
  producto_eliminado:   'red',
  usuario_creado:       'purple',
  usuario_editado:      'amber',
  cliente_creado:       'teal',
  cliente_editado:      'amber',
  cliente_eliminado:    'red',
  reparacion_creada:    'blue',
  reparacion_editada:   'amber',
  reparacion_estado:    'teal',
  reparacion_eliminada: 'red',
  devolucion_registrada:'orange',
  defectuoso_estado:    'gray',
};

var H1 = { fontSize: 'clamp(17px,4vw,22px)', fontWeight: 600, margin: '0 0 20px', color: 'var(--text-primary,#1a1a1a)' };

var LIMIT = 50;

export default function AuditScreen({ session }) {
  var _logs    = useState([]); var logs    = _logs[0];    var setLogs    = _logs[1];
  var _loading = useState(true); var loading= _loading[0]; var setLoading = _loading[1];
  var _err     = useState(''); var err     = _err[0];     var setErr     = _err[1];
  var _page    = useState(1); var page     = _page[0];    var setPage    = _page[1];
  var _total   = useState(0); var total    = _total[0];   var setTotal   = _total[1];

  // Filtros
  var _entity    = useState(''); var entity     = _entity[0];    var setEntity     = _entity[1];
  var _action    = useState(''); var action     = _action[0];    var setAction     = _action[1];
  var _user      = useState(''); var userFilter = _user[0];      var setUserFilter  = _user[1];
  var _dateFrom  = useState(''); var dateFrom   = _dateFrom[0];  var setDateFrom   = _dateFrom[1];
  var _dateTo    = useState(''); var dateTo     = _dateTo[0];    var setDateTo     = _dateTo[1];

  // Recarga al cambiar cualquier filtro
  useEffect(function() { load(1); }, [entity, action, userFilter, dateFrom, dateTo]);

  function clearFilters() {
    setEntity(''); setAction(''); setUserFilter(''); setDateFrom(''); setDateTo('');
  }

  async function load(p) {
    setLoading(true); setErr('');
    try {
      var params = { page: p, limit: LIMIT };
      if (entity)     params.entity    = entity;
      if (action)     params.action    = action;
      if (userFilter) params.user      = userFilter;
      if (dateFrom)   params.date_from = dateFrom;
      if (dateTo)     params.date_to   = dateTo;
      var res = await auditAPI.getAll(params);
      setLogs(res.data || []);
      setTotal(res.total || 0);
      setPage(p);
    } catch(e) {
      setErr(e && e.error ? e.error : 'Error cargando auditoría');
    }
    setLoading(false);
  }

  var totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div>
      <h2 style={H1}>🔍 Rastro de Auditoría</h2>

      {/* Filtros */}
      <div style={Object.assign({}, sCard, { marginBottom: 16 })}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 140px' }}>
            <label style={sLabel}>Tipo de registro</label>
            <select value={entity} onChange={function(e) { setEntity(e.target.value); }} style={sInput}>
              <option value="">Todos</option>
              <option value="sale">Ventas</option>
              <option value="account">Cuentas</option>
              <option value="product">Productos</option>
              <option value="user">Usuarios</option>
              <option value="client">Clientes</option>
              <option value="repair">Reparaciones</option>
              <option value="return">Devoluciones</option>
              <option value="defective">Defectuosos</option>
            </select>
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <label style={sLabel}>Acción</label>
            <select value={action} onChange={function(e) { setAction(e.target.value); }} style={sInput}>
              <option value="">Todas</option>
              {Object.keys(AUDIT_ACTIONS).map(function(k) { return <option key={k} value={k}>{AUDIT_ACTIONS[k]}</option>; })}
            </select>
          </div>
          <div style={{ flex: '1 1 130px' }}>
            <label style={sLabel}>Usuario</label>
            <input style={sInput} placeholder="Nombre..." value={userFilter} onChange={function(e) { setUserFilter(e.target.value); }} />
          </div>
          <div style={{ flex: '1 1 130px' }}>
            <label style={sLabel}>Desde</label>
            <input type="date" style={sInput} value={dateFrom} onChange={function(e) { setDateFrom(e.target.value); }} />
          </div>
          <div style={{ flex: '1 1 130px' }}>
            <label style={sLabel}>Hasta</label>
            <input type="date" style={sInput} value={dateTo} onChange={function(e) { setDateTo(e.target.value); }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={mkBtn('teal')} onClick={function() { load(1); }}>Buscar</button>
            {(entity || action || userFilter || dateFrom || dateTo) && (
              <button style={mkBtn('gray')} onClick={clearFilters}>Limpiar</button>
            )}
          </div>
        </div>
      </div>

      {err && <div style={{ background: 'var(--bg-error,#FDECEA)', color: 'var(--text-error,#791F1F)', padding: '10px 14px', borderRadius: 8, marginBottom: 12 }}>{err}</div>}

      {/* Tabla de logs */}
      <div style={Object.assign({}, sCard, { padding: 0 })}>
        <div className="t-resp tbl-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['#', 'Fecha/Hora', 'Usuario', 'Rol', 'Acción', 'Tipo', 'Detalles'].map(function(h) {
                  return <th key={h} style={h === '#' ? Object.assign({}, sTH, { width: 40, textAlign: 'center' }) : sTH}>{h}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary,#888)' }}>Cargando…</td></tr>}
              {!loading && logs.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary,#888)' }}>Sin registros</td></tr>}
              {!loading && logs.map(function(log, index) {
                var c = AUDIT_COLORS[log.action] || 'gray';
                var detail = '';
                var detailNode = null;

                if (log.details) {
                  var d = log.details;

                  // Formato texto para acciones simples
                  if      (log.action === 'venta_completada')      detail = (d.cliente || d.client || '') + ' — Q' + (Number(d.total || 0).toFixed(2)) + ' — ' + (d.metodo || d.method || '') + (d.articulos ? ' — ' + d.articulos : '');
                  else if (log.action === 'cuenta_creada')         detail = (d.cliente || d.client || '') + ' — Q' + (Number(d.total || 0).toFixed(2)) + (d.abono_inicial ? ' — Abono: Q' + Number(d.abono_inicial).toFixed(2) : '') + (d.articulos ? ' — ' + d.articulos : '');
                  else if (log.action === 'abono_registrado')      detail = 'Q' + (Number(d.amount || 0).toFixed(2)) + ' (' + (d.method || 'Efectivo') + ') — Saldo: Q' + (Number(d.newBalance || 0).toFixed(2)) + ' — ' + (d.newStatus || '');
                  else if (log.action === 'producto_creado')       detail = (d.name || '') + ' [' + (d.code || '') + '] — Q' + (Number(d.price || 0).toFixed(2)) + ' — Stock: ' + (d.stock || 0);
                  else if (log.action === 'producto_eliminado')    detail = (d.nombre || '') + ' [' + (d.codigo || '') + ']';
                  else if (log.action === 'usuario_creado')        detail = (d.name || '') + ' — ' + (d.email || '') + ' — ' + (d.role || '');
                  else if (log.action === 'cliente_creado')        detail = (d.nombre || '') + ' [' + (d.codigo || '') + ']' + (d.telefono && d.telefono !== '—' ? ' — Tel: ' + d.telefono : '');
                  else if (log.action === 'cliente_eliminado')     detail = (d.nombre || '') + ' [' + (d.codigo || '') + ']';
                  else if (log.action === 'reparacion_creada')     detail = '[' + (d.codigo || '') + '] ' + (d.cliente || '') + ' — ' + (d.equipo || '') + ' — ' + (d.problema || '') + (d.tecnico && d.tecnico !== '—' ? ' — Técnico: ' + d.tecnico : '');
                  else if (log.action === 'reparacion_eliminada')  detail = '[' + (d.codigo || '') + '] ' + (d.cliente || '') + ' — ' + (d.equipo || '');
                  else if (log.action === 'devolucion_registrada') detail = (d.cliente || '') + ' — Motivo: ' + (d.motivo || '') + ' — Condición: ' + (d.condicion || '') + (d.reembolso_monto ? ' — Reembolso: Q' + Number(d.reembolso_monto).toFixed(2) : '') + (d.articulos ? ' — ' + d.articulos : '');

                  // Formato diff (antes → después) para acciones de edición
                  else if (['producto_editado', 'usuario_editado', 'cliente_editado', 'reparacion_editada', 'reparacion_estado', 'defectuoso_estado'].includes(log.action)) {
                    var nombre  = d._producto || d._usuario || d._cliente || d._reparacion || d._articulo || '';
                    var cambios = Object.keys(d).filter(function(k) { return k[0] !== '_' && d[k] && typeof d[k] === 'object' && d[k].antes !== undefined; });
                    if (cambios.length === 0) {
                      detail = nombre || 'Sin cambios';
                    } else {
                      detailNode = React.createElement('div', { style: { lineHeight: 1.7 } },
                        nombre ? React.createElement('div', { style: { fontWeight: 700, marginBottom: 4, color: 'var(--text-primary,#222)' } }, nombre) : null,
                        cambios.map(function(campo) {
                          return React.createElement('div', { key: campo, style: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' } },
                            React.createElement('span', { style: { fontWeight: 600, color: 'var(--text-secondary,#666)', minWidth: 90 } }, campo + ':'),
                            React.createElement('span', { style: { background: '#FDECEA', color: '#791F1F', borderRadius: 4, padding: '1px 6px', fontSize: 11 } }, String(d[campo].antes)),
                            React.createElement('span', { style: { color: 'var(--text-secondary,#999)' } }, '→'),
                            React.createElement('span', { style: { background: '#EAF3DE', color: '#27500A', borderRadius: 4, padding: '1px 6px', fontSize: 11 } }, String(d[campo].despues))
                          );
                        })
                      );
                    }
                  }
                }

                return (
                  <tr key={log.id} style={{ background: 'var(--bg-row,transparent)' }}>
                    <td style={{ ...sTD, textAlign: 'center', color: '#999', fontSize: 12 }}>{(page - 1) * LIMIT + index + 1}</td>
                    <td style={sTD}>
                      <div>{fmtD(log.created_at)}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary,#888)' }}>{fmtT(log.created_at)}</div>
                    </td>
                    <td style={sTD}>{log.user_name || '—'}</td>
                    <td style={sTD}>
                      <span style={mkBadge(log.user_role === 'admin' ? 'teal' : log.user_role === 'cajero' ? 'blue' : 'purple')}>
                        {ROLE_LABEL[log.user_role] || log.user_role || '—'}
                      </span>
                    </td>
                    <td style={sTD}><span style={mkBadge(c)}>{AUDIT_ACTIONS[log.action] || log.action}</span></td>
                    <td style={sTD}>{log.entity_type || '—'}</td>
                    <td style={Object.assign({}, sTD, { maxWidth: 320, fontSize: 12, color: 'var(--text-secondary,#666)' })}>
                      {detailNode || (detail || JSON.stringify(log.details || {}).slice(0, 100))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border-table,rgba(0,0,0,0.08))' }}>
            <button style={mkBtn('gray')} disabled={page <= 1} onClick={function() { load(page - 1); }}>‹ Anterior</button>
            <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--text-secondary,#888)' }}>Pág. {page} / {totalPages} ({total} registros)</span>
            <button style={mkBtn('gray')} disabled={page >= totalPages} onClick={function() { load(page + 1); }}>Siguiente ›</button>
          </div>
        )}
      </div>
    </div>
  );
}
