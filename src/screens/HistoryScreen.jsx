// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA: HistoryScreen (Historial de Movimientos)
//
// Registro unificado de todas las transacciones del negocio:
//   • Ventas directas       — cobros completados en POS
//   • Ventas a crédito      — ventas al fiado (status='cuenta')
//   • Abonos / Cancelaciones — pagos parciales o totales de cuentas
//   • Devoluciones          — reembolsos procesados
//
// Funcionalidades:
//   - Filtro por tipo de movimiento (todos | venta | crédito | abono | devolución)
//   - Filtro por período: hoy, semana, mes, mes anterior, rango personalizado
//   - Orden ascendente/descendente por fecha
//   - Exportación a Excel y PDF
//   - Vista de detalle de venta (tabla de ítems) al hacer clic en una fila
//   - Impresión de comprobante y envío por WhatsApp desde la vista detalle o tabla
//
// Las ventas con status='cuenta' se omiten del bloque de ventas para no
// duplicarlas — aparecen solo en el bloque "Ventas a crédito".
//
// Props:
//   sales          {Array}    — historial de ventas
//   selectedSale   {Object|null} — venta seleccionada para ver detalle
//   setSelectedSale {Function}
//   accounts       {Array}    — cuentas por cobrar (para abonos)
//   returns        {Array}    — devoluciones (para reembolsos)
//   products       {Array}    — catálogo de productos (para imprimir ubicación)
//   session        {Object}   — sesión activa { name, role }
//   clients        {Array}    — lista de clientes (para recuperar teléfono en WhatsApp)
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { TEAL, NAVY, sCard, sInput, sLabel, sTH, sTD, mkBtn, mkBadge } from '../styles/theme.js';
import { Q, fmtD, fmtT } from '../utils/formatters.js';
import { exportExcel, exportPDF } from '../utils/export.js';
import { printVoucher, compartirWhatsApp } from '../utils/receipt.js';
import { pedirTelYEnviar } from '../utils/whatsapp.js';
import { waBoletaVenta } from '../utils/whatsapp.js';
import { usePaginator } from '../hooks/usePaginator.jsx';
import { ROLE_LABEL } from '../constants/index.js';
import HelpTip from '../components/ui/HelpTip.jsx';

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

export default function HistoryScreen({ sales, selectedSale, setSelectedSale, accounts, returns, products, session, clients, navTo }) {
  navTo = navTo || function() {};
  sales    = sales    || [];
  accounts = accounts || [];
  returns  = returns  || [];
  products = products || [];
  session  = session  || {};
  clients  = clients  || [];

  // Filtros de la lista
  var _hf   = useState('todos');  var hfilter  = _hf[0];  var setHfilter  = _hf[1];
  var _ho   = useState('desc');   var horder   = _ho[0];  var setHorder   = _ho[1];
  var _hrng = useState('todos');  var hRango   = _hrng[0]; var setHRango   = _hrng[1];
  var _hdf  = useState('');       var hDateFrom = _hdf[0]; var setHDateFrom = _hdf[1];
  var _hdt  = useState('');       var hDateTo   = _hdt[0]; var setHDateTo   = _hdt[1];

  var hNow = new Date();

  // Determina si una fecha cae dentro del período seleccionado
  function hInRange(dateStr) {
    if (hRango === 'todos') return true;
    var d = new Date(dateStr);
    if (hRango === 'hoy') return d.toDateString() === hNow.toDateString();
    if (hRango === 'semana') {
      var ws = new Date(hNow);
      ws.setDate(hNow.getDate() - hNow.getDay());
      ws.setHours(0, 0, 0, 0);
      return d >= ws && d <= hNow;
    }
    if (hRango === 'mes') return d.getMonth() === hNow.getMonth() && d.getFullYear() === hNow.getFullYear();
    if (hRango === 'mes_ant') {
      var pm = hNow.getMonth() === 0 ? 11 : hNow.getMonth() - 1;
      var py = hNow.getMonth() === 0 ? hNow.getFullYear() - 1 : hNow.getFullYear();
      return d.getMonth() === pm && d.getFullYear() === py;
    }
    if (hRango === 'custom' && hDateFrom && hDateTo) {
      var f = new Date(hDateFrom + 'T00:00:00');
      var t = new Date(hDateTo  + 'T23:59:59');
      return d >= f && d <= t;
    }
    return true;
  }

  // Construir el listado unificado de movimientos
  var movs = [];

  // Ventas directas (excluir las que son 'cuenta' para no duplicar con cuentas)
  sales.forEach(function(s) {
    if (s.status === 'cuenta') return;
    movs.push({
      k: 'v' + s.id, date: s.date, tipo: 'Venta', color: 'teal',
      cliente: s.client, metodo: s.method,
      atendio: (s.registradoPor && s.registradoPor.name) ? s.registradoPor.name : (session.name || '—'),
      monto: Number(s.total), signo: 1, kind: 'sale', obj: s,
    });
  });

  // Cuentas por cobrar y sus abonos
  accounts.forEach(function(a) {
    movs.push({
      k: 'a' + a.id, date: a.date, tipo: 'Venta a credito', color: 'purple',
      cliente: a.client, metodo: 'Credito',
      atendio: (a.registradoPor && a.registradoPor.name) ? a.registradoPor.name : (session.name || '—'),
      monto: Number(a.total), signo: 1, kind: 'credito', obj: a,
    });
    var _ac = 0;
    (a.payments || []).forEach(function(p) {
      _ac += Number(p.amount);
      var _sd  = Math.max(0, Number(a.total) - _ac);
      var _fin = _sd <= 0.009;
      movs.push({
        k: 'p' + (p.id || (a.id + _ac)),
        date: p.date,
        tipo: _fin ? 'Abono final' : 'Abono',
        color: _fin ? 'green' : 'amber',
        cliente: a.client, metodo: p.method,
        atendio: (p.registradoPor && p.registradoPor.name) ? p.registradoPor.name : (session.name || '—'),
        monto: Number(p.amount), signo: 1, kind: 'abono', obj: a,
        pdata: { estado: _fin ? 'pagado' : 'parcial', abonoHoy: Number(p.amount), pagado: _ac, saldo: _sd },
      });
    });
  });

  // Devoluciones con reembolso
  returns.forEach(function(r) {
    if (Number(r.refundAmount) > 0) {
      movs.push({
        k: 'r' + r.id, date: r.date, tipo: 'Devolucion', color: 'red',
        cliente: r.client, metodo: r.refundMethod,
        atendio: (r.registradoPor && r.registradoPor.name) ? r.registradoPor.name : '—',
        monto: Number(r.refundAmount), signo: -1, kind: 'devolucion', obj: r,
      });
    }
  });

  // Ordenar por fecha
  movs.sort(function(a, b) {
    return horder === 'desc' ? (new Date(b.date) - new Date(a.date)) : (new Date(a.date) - new Date(b.date));
  });

  // Aplicar filtros de tipo y período
  var fmovs = movs.filter(function(m) {
    if (hfilter !== 'todos' && m.kind !== hfilter) return false;
    return hInRange(m.date);
  });

  var histPag = usePaginator(fmovs, 25);

  // Totales globales (sin filtro de período/tipo)
  // "Entradas" = efectivo que entró: ventas de contado + abonos cobrados.
  // La venta a crédito (kind 'credito') NO se suma: aún no es efectivo, entra vía sus abonos.
  // (Sumarla además de sus abonos era doble conteo.)
  var totEnt = movs.filter(function(m) { return m.signo > 0 && m.kind !== 'credito'; }).reduce(function(x, m) { return x + m.monto; }, 0);
  var totSal = movs.filter(function(m) { return m.signo < 0; }).reduce(function(x, m) { return x + m.monto; }, 0);

  // Imprimir comprobante según el tipo de movimiento
  function imprimirMov(m) {
    if (m.kind === 'sale') {
      printVoucher(m.obj, { usuario: session.name, usuarioRole: session.role, products });
    } else if (m.kind === 'credito') {
      printVoucher(m.obj, {
        estado: m.obj.status === 'pagado' ? 'pagado' : m.obj.status === 'parcial' ? 'parcial' : 'pendiente',
        pagado: m.obj.paid, saldo: m.obj.balance,
        usuario: session.name, usuarioRole: session.role, products, payments: m.obj.payments,
      });
    } else if (m.kind === 'abono') {
      printVoucher(m.obj, {
        estado: m.pdata.estado, abonoHoy: m.pdata.abonoHoy, pagado: m.pdata.pagado, saldo: m.pdata.saldo,
        usuario: session.name, usuarioRole: session.role, products, payments: m.obj.payments,
      });
    }
  }

  // Resumen de artículos de un movimiento (productos/servicios de la venta, crédito o devolución)
  function artLista(m) {
    return (m.obj && m.obj.items) ? m.obj.items : [];
  }
  // Versión en texto plano para exportar a Excel/PDF
  function artTexto(m) {
    return artLista(m).map(function(it) { return (it.name || it.code || '?') + ' x' + it.qty; }).join('; ') || '—';
  }

  var hfilters = [['todos', 'Todos'], ['sale', 'Ventas'], ['credito', 'Créditos'], ['abono', 'Abonos'], ['devolucion', 'Devoluciones']];

  // ── Vista detalle de una venta ──
  if (selectedSale) {
    return (
      <div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <button style={mkBtn('gray')} onClick={function() { setSelectedSale(null); }}>← Volver</button>
          <button style={mkBtn('teal')} onClick={function() { printVoucher(selectedSale, { usuario: session.name, usuarioRole: session.role, products }); }}>🖨 Imprimir / PDF</button>
          <button
            style={Object.assign({}, mkBtn('green'), { background: '#25D366' })}
            onClick={function() {
              var tel    = selectedSale.clientPhone || (selectedSale.clientId && (clients.find(function(c) { return c.id === selectedSale.clientId; }) || {}).phone) || '';
              var getMsj = function() { return waBoletaVenta(selectedSale); };
              var waopts = { sale: selectedSale, receiptOpts: { usuario: session.name, usuarioRole: session.role } };
              if (tel) { compartirWhatsApp(tel, getMsj, waopts); } else { pedirTelYEnviar(selectedSale.client, getMsj, waopts); }
            }}
          >💬 WhatsApp</button>
        </div>

        <div style={sCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <p style={{ fontWeight: 600, fontSize: 16, margin: '0 0 4px' }}>Detalle de Venta</p>
              <p style={{ fontSize: 13, color: '#666', margin: '0 0 2px' }}>{fmtD(selectedSale.date)} {fmtT(selectedSale.date)}</p>
              <p style={{ fontSize: 13, margin: '2px 0' }}>👤 <b>{selectedSale.client}</b></p>
              {selectedSale.nota && <p style={{ fontSize: 13, color: '#666', margin: '4px 0 0' }}>📝 {selectedSale.nota}</p>}
              {selectedSale.registradoPor && (
                <p style={{ fontSize: 12, color: '#999', margin: '4px 0 0' }}>
                  Registrado por: <b style={{ color: '#666' }}>{selectedSale.registradoPor.name}</b>
                  <span style={Object.assign({}, mkBadge('gray'), { marginLeft: 6 })}>{ROLE_LABEL[selectedSale.registradoPor.role] || selectedSale.registradoPor.role}</span>
                </p>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={mkBadge('teal')}>{selectedSale.method}</span>
              <p style={{ fontSize: 22, fontWeight: 700, color: TEAL, margin: '6px 0 0' }}>{Q(selectedSale.total)}</p>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Código', 'Producto', 'Cant.', 'Precio unit.', 'Subtotal'].map(function(h) {
                  return <th key={h} style={sTH}>{h}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {(selectedSale.items || []).map(function(it, i) {
                var hasDisc = it.originalPrice && it.price < it.originalPrice;
                return (
                  <tr key={i}>
                    <td style={Object.assign({}, sTD, { fontFamily: 'monospace', fontSize: 12 })}>{it.code}</td>
                    <td style={Object.assign({}, sTD, { fontWeight: 600 })}>
                      {it.name}
                      {hasDisc && <span style={Object.assign({}, mkBadge('amber'), { marginLeft: 6, fontSize: 10 })}>% Desc.</span>}
                    </td>
                    <td style={sTD}>{it.qty}</td>
                    <td style={sTD}>
                      {hasDisc && <div style={{ fontSize: 10, color: '#999', textDecoration: 'line-through' }}>{Q(it.originalPrice)}</div>}
                      <div style={{ color: hasDisc ? '#E65100' : 'inherit' }}>{Q(it.price)}</div>
                      {hasDisc && <div style={{ fontSize: 10, color: '#E65100' }}>Por: {it.discountBy}</div>}
                    </td>
                    <td style={Object.assign({}, sTD, { fontWeight: 700, color: TEAL })}>{Q(it.price * it.qty)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.1)', marginTop: 8, paddingTop: 10, textAlign: 'right' }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: TEAL }}>Total: {Q(selectedSale.total)}</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Vista lista de movimientos ──
  return (
    <div>
      {/* Encabezado con exportación */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <p style={H1}>
          📋 Historial de Movimientos
          <HelpTip text={'Registro de todas las transacciones del negocio.\n\n• Ventas: cobros en caja\n• Créditos: ventas al fiado\n• Abonos: pagos parciales de créditos\n• Devoluciones: productos devueltos\n\nPodés filtrar por tipo, fecha o rango personalizado y exportar a Excel o PDF.'} />
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#666' }}>{fmovs.length} registros</span>
          <button
            style={Object.assign({}, mkBtn('teal'), { padding: '6px 12px', fontSize: 12 })}
            onClick={function() {
              exportExcel(
                fmovs.map(function(m) { return [fmtD(m.date) + ' ' + fmtT(m.date), m.tipo, m.cliente || '', artTexto(m), m.metodo || '', m.atendio || '', (m.signo < 0 ? '-' : '+') + m.monto.toFixed(2)]; }),
                ['Fecha', 'Tipo', 'Cliente', 'Artículos', 'Método', 'Atendió', 'Monto'],
                'historial_movimientos'
              );
            }}
          >📊 Excel</button>
          <button
            style={Object.assign({}, mkBtn('blue'), { padding: '6px 12px', fontSize: 12 })}
            onClick={function() {
              exportPDF(
                'Historial de Movimientos',
                ['Fecha', 'Tipo', 'Cliente', 'Artículos', 'Método', 'Atendió', 'Monto'],
                fmovs.map(function(m) { return [fmtD(m.date) + ' ' + fmtT(m.date), m.tipo, m.cliente || '', artTexto(m), m.metodo || '', m.atendio || '', (m.signo < 0 ? '-Q' : '+Q') + m.monto.toFixed(2)]; }),
                'historial_movimientos'
              );
            }}
          >📄 PDF</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 18 }}>
        <MetricBox label="Entradas (ventas + abonos)" value={Q(totEnt)}    color={TEAL}     />
        <MetricBox label="Salidas (devoluciones)"     value={Q(totSal)}    color="#E24B4A"  />
        <MetricBox label="Movimientos totales"        value={movs.length}  color="#378ADD"  />
      </div>

      {/* Filtros */}
      <div style={Object.assign({}, sCard, { marginBottom: 14 })}>
        {/* Filtro por período */}
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#888', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📅 Período</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[['todos', 'Todos'], ['hoy', 'Hoy'], ['semana', 'Esta semana'], ['mes', 'Este mes'], ['mes_ant', 'Mes anterior'], ['custom', 'Personalizado']].map(function(pair) {
              return (
                <button key={pair[0]} style={Object.assign({}, mkBtn(hRango === pair[0] ? 'teal' : 'gray'), { padding: '5px 12px', fontSize: 12 })} onClick={function() { setHRango(pair[0]); }}>{pair[1]}</button>
              );
            })}
          </div>
          {hRango === 'custom' && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
              <div>
                <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 3 }}>Desde</label>
                <input type="date" style={Object.assign({}, sInput, { width: 155, fontSize: 13 })} value={hDateFrom} onChange={function(e) { setHDateFrom(e.target.value); }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 3 }}>Hasta</label>
                <input type="date" style={Object.assign({}, sInput, { width: 155, fontSize: 13 })} value={hDateTo} onChange={function(e) { setHDateTo(e.target.value); }} />
              </div>
            </div>
          )}
        </div>

        {/* Filtro por tipo + orden */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid #f0ede8' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {hfilters.map(function(pair) {
              return <button key={pair[0]} style={Object.assign({}, mkBtn(hfilter === pair[0] ? 'teal' : 'gray'), { padding: '6px 14px' })} onClick={function() { setHfilter(pair[0]); }}>{pair[1]}</button>;
            })}
          </div>
          <button
            style={Object.assign({}, mkBtn('gray'), { padding: '6px 14px', whiteSpace: 'nowrap' })}
            onClick={function() { setHorder(horder === 'desc' ? 'asc' : 'desc'); }}
          >{horder === 'desc' ? '↓ Recientes primero' : '↑ Antiguos primero'}</button>
        </div>
      </div>

      {/* Tabla de movimientos */}
      <div style={sCard}>
        {fmovs.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999', padding: 48 }}>Sin movimientos en esta categoría</p>
        ) : (
          <div className="tbl-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['#', 'Fecha', 'Hora', 'Tipo', 'Cliente', 'Artículos', 'Método', 'Atendió', 'Monto', ''].map(function(h) {
                    return <th key={h} style={h === '#' ? Object.assign({}, sTH, { width: 40, textAlign: 'center' }) : sTH}>{h}</th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {histPag.paged.map(function(m, index) {
                  var clickable = m.kind === 'sale';
                  return (
                    <tr
                      key={m.k}
                      style={{ cursor: clickable ? 'pointer' : 'default' }}
                      onClick={clickable ? function() { setSelectedSale(m.obj); } : undefined}
                    >
                      <td style={Object.assign({}, sTD, { textAlign: 'center', color: '#999', fontSize: 12 })}>{histPag.offset + index + 1}</td>
                      <td style={sTD}>{fmtD(m.date)}</td>
                      <td style={sTD}>{fmtT(m.date)}</td>
                      <td style={sTD}><span style={mkBadge(m.color)}>{m.tipo}</span></td>
                      <td style={Object.assign({}, sTD, { fontWeight: 500 })}>
                        {(function() {
                          // Buscar por clientId primero; si no, buscar por nombre exacto (para registros históricos sin clientId)
                          var cli = (m.obj && m.obj.clientId && clients.find(function(c) { return c.id === m.obj.clientId; }))
                                 || (m.cliente && clients.find(function(c) { return c.name === m.cliente; }));
                          if (cli) return <span style={{ cursor: 'pointer', color: 'var(--teal,#1D9E75)', textDecoration: 'underline dotted' }} onClick={function(e) { e.stopPropagation(); navTo('clients', { clientId: cli.id }); }}>{m.cliente}</span>;
                          return m.cliente;
                        })()}
                      </td>
                      <td style={Object.assign({}, sTD, { fontSize: 12, color: '#555', maxWidth: 240 })}>
                        {(function() {
                          var its = artLista(m);
                          if (!its.length) return <span style={{ color: '#bbb' }}>—</span>;
                          var full  = its.map(function(it) { return (it.name || it.code || '?') + ' ×' + it.qty; }).join(', ');
                          var shown = its.slice(0, 2).map(function(it) { return (it.name || it.code || '?') + ' ×' + it.qty; }).join(', ');
                          var extra = its.length > 2 ? ' +' + (its.length - 2) + ' más' : '';
                          return <span title={full} style={{ display: 'inline-block', maxWidth: 240, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'bottom' }}>{shown}{extra}</span>;
                        })()}
                      </td>
                      <td style={Object.assign({}, sTD, { fontSize: 12, color: '#666' })}>{m.metodo}</td>
                      <td style={Object.assign({}, sTD, { fontSize: 12, color: '#666' })}>{m.atendio}</td>
                      <td style={Object.assign({}, sTD, { fontWeight: 700, color: m.signo < 0 ? '#E24B4A' : TEAL })}>
                        {m.signo < 0 ? '- ' : '+ '}{Q(m.monto)}
                      </td>
                      <td style={sTD}>
                        {m.kind === 'devolucion'
                          ? <span style={{ fontSize: 12, color: '#bbb' }}>—</span>
                          : <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                style={Object.assign({}, mkBtn('blue'), { padding: '4px 10px', fontSize: 11 })}
                                onClick={function(e) { e.stopPropagation(); imprimirMov(m); }}
                              >🖨</button>
                              {m.kind === 'sale' && (
                                <button
                                  style={Object.assign({}, mkBtn('green'), { background: '#25D366', padding: '4px 10px', fontSize: 11 })}
                                  onClick={function(e) {
                                    e.stopPropagation();
                                    var tel    = (clients.find(function(c) { return c.id === m.obj.clientId; }) || {}).phone || '';
                                    var getMsj = function() { return waBoletaVenta(m.obj); };
                                    var waopts = { sale: m.obj, receiptOpts: {} };
                                    if (tel) { compartirWhatsApp(tel, getMsj, waopts); } else { pedirTelYEnviar(m.obj.client, getMsj, waopts); }
                                  }}
                                >💬</button>
                              )}
                            </div>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {fmovs.length > 0 && React.createElement(histPag.Pager)}
      </div>
    </div>
  );
}
