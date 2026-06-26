// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA: DefectiveScreen (Piezas Defectuosas)
//
// Muestra los artículos retirados del inventario por devoluciones con daño.
// Para cada pieza defectuosa hay dos acciones posibles:
//   - Reingresar: la pieza fue reparada, vuelve al inventario disponible para venta
//   - Dar de baja: la pieza no tiene reparación, se registra como pérdida definitiva
//
// Estados posibles de una pieza defectuosa:
//   defectuoso   → en revisión, esperando decisión
//   dado_de_baja → baja definitiva, pérdida registrada
//   reingresado  → reparada y devuelta al stock
//
// Props:
//   defectives     {Array}    — lista de piezas defectuosas
//   onUpdateStatus {Function} — (id, nuevoEstado) — cambia el estado de una pieza
//   onReingress    {Function} — (id) — reingresa la pieza al inventario
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { TEAL, sCard, sTH, sTD, mkBtn, mkBadge } from '../styles/theme.js';
import { fmtD, Q } from '../utils/formatters.js';
import { usePaginator } from '../hooks/usePaginator.jsx';

var H1 = { fontSize: 'clamp(17px,4vw,22px)', fontWeight: 600, margin: '0 0 16px', color: 'var(--text-primary,#1a1a1a)' };

// Componente de métrica simple
function MetricBox({ label, value, color }) {
  return (
    <div style={{ background: '#f5f4f0', borderRadius: 10, padding: '16px', border: '1px solid rgba(0,0,0,0.07)' }}>
      <p style={{ fontSize: 12, color: '#666', margin: '0 0 6px' }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 600, margin: 0, color: color || '#1a1a1a' }}>{value}</p>
    </div>
  );
}

// Opciones de filtro con su etiqueta de pantalla
var FILTROS = [
  ['defectuoso',   'En revisión'],
  ['dado_de_baja', 'Dados de baja'],
  ['reingresado',  'Reingresados'],
  ['todos',        'Todos'],
];

export default function DefectiveScreen({ defectives, onUpdateStatus, onReingress }) {
  defectives     = defectives     || [];
  onUpdateStatus = onUpdateStatus || function() {};
  onReingress    = onReingress    || function() {};

  var _f = useState('defectuoso');
  var filter    = _f[0];
  var setFilter = _f[1];

  // Filtrar la lista según el filtro activo
  var filtered = defectives.filter(function(d) { return filter === 'todos' || d.status === filter; });
  var defPag   = usePaginator(filtered, 20);

  // Conteos por estado para las métricas
  var totalPiezas = defectives.filter(function(d) { return d.status === 'defectuoso'; }).length;
  var totalDadas  = defectives.filter(function(d) { return d.status === 'dado_de_baja'; }).length;
  var totalReing  = defectives.filter(function(d) { return d.status === 'reingresado'; }).length;

  return (
    <div>
      <p style={H1}>🔩 Piezas Defectuosas</p>
      <p style={{ fontSize: 14, color: '#666', margin: '-12px 0 20px', lineHeight: 1.6 }}>
        Artículos retirados del inventario por devoluciones con daño. Podés darlos de baja definitivamente o repararlos y reingresarlos al stock.
      </p>

      {/* Métricas de estado */}
      <div className="rg-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        <MetricBox label="En revisión"   value={totalPiezas} color="#E24B4A" />
        <MetricBox label="Dados de baja" value={totalDadas}  color="#666" />
        <MetricBox label="Reingresados"  value={totalReing}  color={TEAL} />
      </div>

      {/* Filtros de estado */}
      <div style={Object.assign({}, sCard, { marginBottom: 14 })}>
        <div style={{ display: 'flex', gap: 8 }}>
          {FILTROS.map(function(pair) {
            return (
              <button key={pair[0]} style={Object.assign({}, mkBtn(filter === pair[0] ? 'teal' : 'gray'), { padding: '6px 14px' })} onClick={function() { setFilter(pair[0]); }}>
                {pair[1]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabla de piezas */}
      <div style={sCard}>
        {filtered.length === 0
          ? <p style={{ textAlign: 'center', color: '#999', padding: 40 }}>Sin piezas en esta categoría</p>
          : (
            <div className="tbl-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['#', 'Fecha', 'Código', 'Pieza', 'Cant.', 'Precio', 'Motivo', 'Estado', 'Acciones'].map(function(h) {
                      return <th key={h} style={h === '#' ? Object.assign({}, sTH, { width: 40, textAlign: 'center' }) : sTH}>{h}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {defPag.paged.map(function(d, index) {
                    return (
                      <tr key={d.id}>
                        <td style={Object.assign({}, sTD, { textAlign: 'center', color: '#999', fontSize: 12 })}>{defPag.offset + index + 1}</td>
                        <td style={sTD}>{fmtD(d.date)}</td>
                        <td style={Object.assign({}, sTD, { fontFamily: 'monospace', fontSize: 12 })}>{d.code}</td>
                        <td style={Object.assign({}, sTD, { fontWeight: 600 })}>{d.name}</td>
                        <td style={sTD}>{d.qty}</td>
                        <td style={sTD}>{Q(d.price)}</td>
                        <td style={Object.assign({}, sTD, { color: '#666', fontSize: 12 })}>{d.reason}</td>
                        <td style={sTD}>
                          <span style={mkBadge(d.status === 'defectuoso' ? 'amber' : d.status === 'dado_de_baja' ? 'red' : 'green')}>
                            {d.status === 'defectuoso' ? '⚠️ En revisión' : d.status === 'dado_de_baja' ? '🗑 Dado de baja' : '✅ Reingresado'}
                          </span>
                        </td>
                        <td style={sTD}>
                          {/* Solo las piezas en revisión tienen acciones disponibles */}
                          {d.status === 'defectuoso' ? (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button style={Object.assign({}, mkBtn('teal'), { padding: '4px 8px', fontSize: 11 })} onClick={function() { onReingress(d.id); }}>↑ Reingresar</button>
                              <button style={Object.assign({}, mkBtn('red'),  { padding: '4px 8px', fontSize: 11 })} onClick={function() { onUpdateStatus(d.id, 'dado_de_baja'); }}>🗑 Dar de baja</button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: '#999' }}>Sin acciones</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        }
        <defPag.Pager />
      </div>

      {/* Leyenda de acciones */}
      {defectives.length > 0 && (
        <div style={Object.assign({}, sCard, { marginTop: 16, background: '#f9f8f5' })}>
          <p style={{ fontWeight: 600, fontSize: 14, margin: '0 0 10px' }}>ℹ️ Acciones disponibles</p>
          <div style={{ fontSize: 13, color: '#666', lineHeight: 1.8 }}>
            <p style={{ margin: '0 0 4px' }}>⬆️ <b>Reingresar:</b> la pieza fue reparada — vuelve al inventario disponible para venta</p>
            <p style={{ margin: 0 }}>🗑 <b>Dar de baja:</b> la pieza no tiene reparación — se registra como pérdida definitiva</p>
          </div>
        </div>
      )}
    </div>
  );
}
