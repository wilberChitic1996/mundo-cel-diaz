// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA: WarrantiesScreen (Garantías)
//
// Registro y seguimiento de garantías de productos o reparaciones.
//
// Vista lista:
//   - KPIs: vigentes, vencidas, reclamadas
//   - Buscador por cliente, descripción o referencia
//   - Filtros por estado: todas / vigentes / vencidas / reclamadas
//   - Tabla paginada con alerta visual cuando quedan ≤7 días
//
// Vista detalle (al hacer clic en una fila):
//   - Datos de la garantía
//   - Días restantes o vencidos
//   - Botón para marcar como "Reclamada"
//   - Botón para reactivar si está vencida pero la fecha aún está vigente
//
// Formulario de nueva garantía:
//   - Tipo: Reparación | Venta | Otro
//   - N° orden o código de referencia (opcional)
//   - Nombre del cliente (obligatorio)
//   - Descripción de qué cubre (obligatorio)
//   - Duración en meses (1, 3, 6, 12, 24)
//   - Fecha de inicio
//   La fecha de vencimiento se calcula automáticamente.
//
// Props:
//   warranties    {Array}    — lista de garantías registradas
//   sales         {Array}    — ventas (reservado para futuros vínculos)
//   repairs       {Array}    — reparaciones (reservado para futuros vínculos)
//   saveWarranty  {Function} — (garantíaObj) guarda una nueva garantía
//   updateWarranty {Function} — (id, cambios) actualiza estado
//   session       {Object}   — sesión activa
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { TEAL, NAVY, sCard, sInput, sLabel, sTH, sTD, mkBtn, mkBadge } from '../styles/theme.js';
import { Q, fmtD } from '../utils/formatters.js';
import { usePaginator } from '../hooks/usePaginator.jsx';

var H1 = { fontSize: 'clamp(17px,4vw,22px)', fontWeight: 600, margin: 0, color: 'var(--text-primary,#1a1a1a)' };

// Tarjeta de métrica simple
function MetricBox({ label, value, color }) {
  return (
    <div style={Object.assign({}, sCard, { textAlign: 'center' })}>
      <p style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: color || NAVY }}>{value}</p>
      <p style={{ fontSize: 12, color: '#888', margin: 0 }}>{label}</p>
    </div>
  );
}

export default function WarrantiesScreen({ warranties, sales, repairs, saveWarranty, updateWarranty, session, initialSearch, initialWarrantyId, clients, navTo }) {
  navTo   = navTo   || function() {};
  clients = clients || [];
  warranties = warranties || [];
  sales      = sales      || [];
  repairs    = repairs    || [];
  session    = session    || {};

  // ID de la garantía en vista detalle (null = vista lista)
  var _sel = useState(initialWarrantyId||null); var selWar   = _sel[0];  var setSelWar    = _sel[1];
  // Formulario visible o no
  var _sf  = useState(false);   var showForm = _sf[0];   var setShowForm  = _sf[1];
  // Filtro de estado
  var _fil = useState('todas'); var filter   = _fil[0];  var setFilter    = _fil[1];
  // Búsqueda
  var _q   = useState(initialSearch||''); var q = _q[0]; var setQ         = _q[1];

  // Campos del formulario
  var _fet = useState('repair');                         var fEntityType = _fet[0]; var setFEntityType = _fet[1];
  var _fei = useState('');                               var fEntityId   = _fei[0]; var setFEntityId   = _fei[1];
  var _fcl = useState('');                               var fClient     = _fcl[0]; var setFClient     = _fcl[1];
  var _fd  = useState('');                               var fDesc       = _fd[0];  var setFDesc       = _fd[1];
  var _fsm = useState(3);                                var fMonths     = _fsm[0]; var setFMonths     = _fsm[1];
  var _fsd = useState(new Date().toISOString().slice(0, 10)); var fStart = _fsd[0]; var setFStart      = _fsd[1];
  var _ferr = useState('');                              var fErr        = _ferr[0]; var setFErr        = _ferr[1];

  var now = new Date();

  // Garantías filtradas por estado y búsqueda
  var displayed = warranties.filter(function(w) {
    if (filter === 'vigente')   return w.status === 'vigente';
    if (filter === 'vencida')   return w.status === 'vencida' || new Date(w.endDate) < now;
    if (filter === 'reclamada') return w.status === 'reclamada';
    return true;
  }).filter(function(w) {
    if (!q) return true;
    var ql = q.toLowerCase();
    return (w.client      || '').toLowerCase().indexOf(ql) >= 0
      || (w.description   || '').toLowerCase().indexOf(ql) >= 0
      || (w.entityId      || '').toLowerCase().indexOf(ql) >= 0;
  });
  var warPag = usePaginator(displayed, 20);

  // KPIs globales
  var vigentes   = warranties.filter(function(w) { return w.status === 'vigente'   && new Date(w.endDate) >= now; }).length;
  var vencidas   = warranties.filter(function(w) { return w.status === 'vencida'   || new Date(w.endDate) < now; }).length;
  var reclamadas = warranties.filter(function(w) { return w.status === 'reclamada'; }).length;

  // Limpia el formulario sin cerrarlo aún
  function resetForm() {
    setFEntityType('repair'); setFEntityId(''); setFClient(''); setFDesc('');
    setFMonths(3); setFStart(new Date().toISOString().slice(0, 10)); setFErr('');
  }

  // Valida y guarda una nueva garantía
  async function submitWarranty() {
    if (!fClient.trim()) { setFErr('El nombre del cliente es requerido'); return; }
    if (!fDesc.trim())   { setFErr('Describí qué cubre la garantía'); return; }
    var start = new Date(fStart + 'T00:00:00');
    var end   = new Date(start);
    end.setMonth(end.getMonth() + parseInt(fMonths, 10));
    await saveWarranty({
      entityType:  fEntityType,
      entityId:    fEntityId.trim() || null,
      client:      fClient.trim(),
      description: fDesc.trim(),
      startDate:   fStart,
      endDate:     end.toISOString().slice(0, 10),
      months:      parseInt(fMonths, 10),
    });
    resetForm();
    setShowForm(false);
  }

  // ── Vista detalle de garantía ──
  if (selWar) {
    var war = warranties.find(function(w) { return w.id === selWar; });
    if (!war) { setSelWar(null); return null; }
    var warEnd       = new Date(war.endDate);
    var diasRestantes = Math.ceil((warEnd - now) / 86400000);
    var isVigente    = war.status !== 'reclamada' && warEnd >= now;

    return (
      <div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <button style={mkBtn('gray')} onClick={function() { setSelWar(null); }}>← Volver</button>
          {isVigente && (
            <button style={mkBtn('amber')} onClick={async function() { await updateWarranty(war.id, { status: 'reclamada' }); }}>
              ⚠️ Marcar como reclamada
            </button>
          )}
          {war.status !== 'vigente' && warEnd >= now && (
            <button style={mkBtn('teal')} onClick={async function() { await updateWarranty(war.id, { status: 'vigente' }); }}>
              ✓ Reactivar garantía
            </button>
          )}
        </div>

        <div style={sCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <p style={{ fontWeight: 800, fontSize: 18, margin: '0 0 4px' }}>🛡️ {war.client}</p>
              <p style={{ fontSize: 13, color: '#666', margin: '0 0 2px' }}>{war.description}</p>
              {war.entityType && war.entityId && (
                <p style={{ fontSize: 12, color: TEAL, margin: 0, fontFamily: 'monospace' }}>
                  {war.entityType === 'repair' ? 'Reparación' : 'Venta'}: {war.entityId}
                </p>
              )}
            </div>
            <span style={mkBadge(war.status === 'reclamada' ? 'red' : isVigente ? 'green' : 'amber')}>
              {war.status === 'reclamada' ? 'Reclamada' : isVigente ? 'Vigente' : 'Vencida'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div style={{ background: '#f9f8f5', borderRadius: 8, padding: 12 }}>
              <p style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', margin: '0 0 4px' }}>Inicio</p>
              <p style={{ fontWeight: 700, margin: 0 }}>{fmtD(war.startDate)}</p>
            </div>
            <div style={{ background: '#f9f8f5', borderRadius: 8, padding: 12 }}>
              <p style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', margin: '0 0 4px' }}>Vencimiento</p>
              <p style={{ fontWeight: 700, margin: 0 }}>{fmtD(war.endDate)}</p>
            </div>
            <div style={{ background: isVigente ? '#EAF3DE' : '#FCEBEB', borderRadius: 8, padding: 12 }}>
              <p style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', margin: '0 0 4px' }}>
                {diasRestantes > 0 ? 'Días restantes' : 'Vencida hace'}
              </p>
              <p style={{ fontWeight: 800, fontSize: 18, color: isVigente ? TEAL : '#E24B4A', margin: 0 }}>
                {Math.abs(diasRestantes)} días
              </p>
            </div>
          </div>

          {war.status === 'reclamada' && (
            <div style={{ background: '#FCEBEB', borderRadius: 8, padding: '10px 14px', border: '1px solid #F09595' }}>
              <p style={{ margin: 0, color: '#791F1F', fontSize: 13, fontWeight: 600 }}>⚠️ Esta garantía fue reclamada por el cliente.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Vista lista ──
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <p style={H1}>🛡️ Garantías</p>
        <button
          style={mkBtn(showForm ? 'red' : 'teal')}
          onClick={function() {
            if (showForm) { resetForm(); setShowForm(false); } else { resetForm(); setShowForm(true); }
          }}
        >{showForm ? '✕ Cancelar' : '+ Nueva garantía'}</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 16 }}>
        <MetricBox label="Vigentes"   value={vigentes}   color={TEAL}      />
        <MetricBox label="Vencidas"   value={vencidas}   color="#E24B4A"   />
        <MetricBox label="Reclamadas" value={reclamadas} color="#E65100"   />
      </div>

      {/* Formulario de nueva garantía */}
      {showForm && (
        <div style={Object.assign({}, sCard, { marginBottom: 16, borderColor: TEAL, borderWidth: '1.5px' })}>
          <p style={{ fontWeight: 700, margin: '0 0 16px', fontSize: 15 }}>📋 Nueva Garantía</p>
          {fErr && <p style={{ color: '#E24B4A', fontSize: 13, margin: '0 0 12px' }}>⚠ {fErr}</p>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={sLabel}>Tipo</label>
              <select style={Object.assign({}, sInput, { background: '#fff' })} value={fEntityType} onChange={function(e) { setFEntityType(e.target.value); }}>
                <option value="repair">Reparación</option>
                <option value="sale">Venta</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div>
              <label style={sLabel}>N° Orden / Código de referencia</label>
              <input style={sInput} value={fEntityId} placeholder="Ej: REP-001 o V-0042" onChange={function(e) { setFEntityId(e.target.value); }} />
            </div>
            <div>
              <label style={sLabel}>Cliente *</label>
              <input style={sInput} value={fClient} placeholder="Nombre del cliente" onChange={function(e) { setFClient(e.target.value); }} />
            </div>
            <div>
              <label style={sLabel}>Duración (meses)</label>
              <select style={Object.assign({}, sInput, { background: '#fff' })} value={fMonths} onChange={function(e) { setFMonths(e.target.value); }}>
                <option value={1}>1 mes</option>
                <option value={3}>3 meses</option>
                <option value={6}>6 meses</option>
                <option value={12}>12 meses</option>
                <option value={24}>24 meses</option>
              </select>
            </div>
            <div>
              <label style={sLabel}>Fecha de inicio</label>
              <input type="date" style={sInput} value={fStart} onChange={function(e) { setFStart(e.target.value); }} />
            </div>
            <div>
              <label style={sLabel}>Qué cubre la garantía *</label>
              <input style={sInput} value={fDesc} placeholder="Ej: Pantalla, batería, reparación de placa" onChange={function(e) { setFDesc(e.target.value); }} />
            </div>
          </div>
          <button style={mkBtn('teal')} onClick={submitWarranty}>✓ Registrar garantía</button>
        </div>
      )}

      {/* Filtros y búsqueda */}
      <div style={Object.assign({}, sCard, { marginBottom: 14 })}>
        <input
          style={Object.assign({}, sInput, { marginBottom: 12 })}
          placeholder="🔍  Buscar por cliente, descripción o referencia..."
          value={q}
          onChange={function(e) { setQ(e.target.value); }}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[['todas', 'Todas'], ['vigente', 'Vigentes'], ['vencida', 'Vencidas'], ['reclamada', 'Reclamadas']].map(function(p) {
            return (
              <button key={p[0]} style={Object.assign({}, mkBtn(filter === p[0] ? 'teal' : 'gray'), { padding: '6px 14px' })} onClick={function() { setFilter(p[0]); }}>{p[1]}</button>
            );
          })}
        </div>
      </div>

      {/* Tabla de garantías */}
      <div style={sCard}>
        {displayed.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999', padding: 40 }}>Sin garantías en esta categoría</p>
        ) : (
          <div className="tbl-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['#', 'Cliente', 'Descripción', 'Referencia', 'Inicio', 'Vencimiento', 'Estado', ''].map(function(h) {
                    return <th key={h} style={h === '#' ? Object.assign({}, sTH, { width: 40, textAlign: 'center' }) : sTH}>{h}</th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {warPag.paged.map(function(w, index) {
                  var wEnd  = new Date(w.endDate);
                  var dias  = Math.ceil((wEnd - now) / 86400000);
                  var isVig = w.status !== 'reclamada' && wEnd >= now;
                  return (
                    <tr key={w.id} style={{ cursor: 'pointer' }} onClick={function() { setSelWar(w.id); }}>
                      <td style={Object.assign({}, sTD, { textAlign: 'center', color: '#999', fontSize: 12 })}>{warPag.offset + index + 1}</td>
                      <td style={Object.assign({}, sTD, { fontWeight: 600 })}>
                        {(function() {
                          var cli = w.clientId && clients.find(function(c) { return c.id === w.clientId; });
                          if (cli) return <span style={{ cursor: 'pointer', color: 'var(--teal,#1D9E75)', textDecoration: 'underline dotted' }} onClick={function(e) { e.stopPropagation(); navTo('clients', { clientId: cli.id }); }}>{w.client}</span>;
                          return w.client;
                        })()}
                      </td>
                      <td style={Object.assign({}, sTD, { color: '#666', maxWidth: 180 })}>{w.description}</td>
                      <td style={Object.assign({}, sTD, { fontFamily: 'monospace', fontSize: 12, color: TEAL })}>{w.entityId || '—'}</td>
                      <td style={sTD}>{fmtD(w.startDate)}</td>
                      <td style={sTD}>{fmtD(w.endDate)}</td>
                      <td style={sTD}>
                        <span style={mkBadge(w.status === 'reclamada' ? 'red' : isVig ? (dias <= 7 ? 'amber' : 'green') : 'red')}>
                          {w.status === 'reclamada' ? 'Reclamada' : isVig ? (dias <= 7 ? '⚠ ' + dias + 'd' : '✓ Vigente') : 'Vencida'}
                        </span>
                      </td>
                      <td style={sTD}>
                        <button style={Object.assign({}, mkBtn('teal'), { padding: '4px 10px', fontSize: 11 })} onClick={function(e) { e.stopPropagation(); setSelWar(w.id); }}>Ver →</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <warPag.Pager />
      </div>
    </div>
  );
}
