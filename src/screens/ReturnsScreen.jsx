// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA: ReturnsScreen (Devoluciones)
//
// Gestión de devoluciones de productos en 3 pasos:
//
//   Paso 1 — Buscar cliente
//     Dropdown de búsqueda por nombre, DPI o código de cliente.
//     Puede continuar sin vincular cliente (devolucion de "Cliente general").
//
//   Paso 2 — Elegir venta a devolver
//     Muestra las ventas del cliente seleccionado con estado de devolución:
//       • "Disponible" — sin devolución previa
//       • "Parcial (x/y arts.)" — devolución incompleta
//       • "Devuelta completa" — no seleccionable
//     También puede saltarse y continuar sin venta específica.
//
//   Paso 3 — Formulario de devolución
//     • Filas de productos (código auto-completa desde inventario)
//     • Motivo de la devolución
//     • Estado del artículo: "bueno" → vuelve al inventario | "defectuoso" → va a Piezas Defectuosas
//     • Método de reembolso: Efectivo, Tarjeta, Crédito en cuenta, Sin reembolso
//     • Monto a reembolsar (por defecto igual al valor de artículos)
//
// Debajo del formulario: 3 métricas KPI + tabla paginada de todas las devoluciones.
//
// Props:
//   returns    {Array}    — historial de devoluciones ya registradas
//   products   {Array}    — productos del catálogo (para auto-completar código)
//   clients    {Array}    — lista de clientes registrados
//   sales      {Array}    — ventas para el paso 2 (buscar ventas del cliente)
//   onProcess  {Function} — (devolucionObj) — llamada al confirmar la devolución
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { TEAL, NAVY, sCard, sInput, sLabel, sTH, sTD, mkBtn, mkBadge } from '../styles/theme.js';
import { Q, fmtD, fmtT } from '../utils/formatters.js';
import { usePaginator } from '../hooks/usePaginator.jsx';

// Estado inicial del formulario de devolución
var BLANK = {
  clientId:      null,
  client:        '',
  items:         [{ code: '', name: '', qty: 1, price: 0 }],
  reason:        '',
  refundMethod:  'Efectivo',
  refundAmount:  '',
  itemCondition: 'bueno',
};

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

export default function ReturnsScreen({ returns, products, clients, sales, onProcess, initialClient }) {
  returns  = returns  || [];
  products = products || [];
  clients  = clients  || [];
  sales    = sales    || [];

  // Controla si el formulario de nueva devolución está visible
  // (si venimos de un reclamo de garantía, abre el flujo con el cliente prellenado)
  var _sh   = useState(!!initialClient); var show    = _sh[0];   var setShow    = _sh[1];
  // Datos del formulario en curso
  var _fo   = useState(BLANK); var form    = _fo[0];   var setForm    = _fo[1];
  // Mensaje de error de validación
  var _er   = useState('');    var err     = _er[0];   var setErr     = _er[1];
  // Texto de búsqueda del cliente
  var _cq   = useState(initialClient || ''); var cliQ = _cq[0]; var setCliQ = _cq[1];
  // Controla visibilidad del dropdown de resultados
  var _cd   = useState(!!initialClient); var showDrop = _cd[0]; var setShowDrop = _cd[1];
  // Cliente seleccionado (objeto completo)
  var _sc   = useState(null);  var selCli  = _sc[0];   var setSelCli  = _sc[1];
  // Paso actual del flujo: "search" | "sale" | "form"
  var _st   = useState('search'); var step  = _st[0];  var setStep    = _st[1];
  // Venta seleccionada para devolver
  var _ss   = useState(null);  var selSale = _ss[0];   var setSelSale = _ss[1];

  // Resultados de búsqueda de cliente (máx 5)
  var cliResults = cliQ.trim().length > 0
    ? clients.filter(function(c) {
        var q = cliQ.toLowerCase();
        return (c.name || '').toLowerCase().indexOf(q) >= 0
          || (c.dpi  || '').indexOf(cliQ.trim()) >= 0
          || (c.cliCode || '').toLowerCase().indexOf(q) >= 0;
      }).slice(0, 5)
    : [];

  // Ventas del cliente seleccionado, enriquecidas con datos de devoluciones previas
  var cliSales = selCli
    ? sales.filter(function(s) {
        return s.clientId === selCli.id || (s.client === selCli.name && !s.clientId);
      }).slice().sort(function(a, b) {
        return new Date(b.date) - new Date(a.date);
      }).map(function(s) {
        // Calcular cantidad ya devuelta por código en esta venta
        var returnedQty = {};
        returns.filter(function(r) { return r.saleId === s.id; }).forEach(function(r) {
          (r.items || []).forEach(function(it) {
            returnedQty[it.code] = (returnedQty[it.code] || 0) + (it.qty || 0);
          });
        });
        var totalOriginal  = (s.items || []).reduce(function(a, it) { return a + it.qty; }, 0);
        var totalDevuelto  = (s.items || []).reduce(function(a, it) { return a + (returnedQty[it.code] || 0); }, 0);
        var fullyReturned  = totalDevuelto >= totalOriginal;
        var partiallyReturned = totalDevuelto > 0 && !fullyReturned;
        return Object.assign({}, s, { returnedQty, fullyReturned, partiallyReturned, totalDevuelto, totalOriginal });
      })
    : [];

  // Selecciona un cliente desde el dropdown → avanza al paso 2
  function pickClient(c) {
    setSelCli(c);
    setCliQ(c.name);
    setShowDrop(false);
    setForm(function(f) { return Object.assign({}, f, { clientId: c.id, client: c.name }); });
    setStep('sale');
  }

  // Selecciona una venta → pre-carga artículos restantes por devolver → paso 3
  function pickSale(s) {
    if (s.fullyReturned) return;
    setSelSale(s);
    var items = (s.items || []).map(function(it) {
      var yaDevuelto = s.returnedQty[it.code] || 0;
      var restante   = it.qty - yaDevuelto;
      // variant_id/serial_id: viajan con el ítem para que el servidor reingrese la
      // variante correcta y libere el IMEI devuelto (ventas nuevas los traen).
      return restante > 0 ? { code: it.code, name: it.name, qty: restante, price: it.price, variant_id: it.variant_id || null, serial_id: it.serial_id || null } : null;
    }).filter(Boolean);
    setForm(function(f) { return Object.assign({}, f, { items }); });
    setStep('form');
  }

  // Reinicia todo el flujo y cierra el formulario
  function resetFlow() {
    setSelCli(null); setSelSale(null); setCliQ('');
    setStep('search'); setForm(BLANK); setErr(''); setShow(false);
  }

  // Helpers de mutación del formulario
  function setF(k, v) { setForm(function(f) { var n = Object.assign({}, f); n[k] = v; return n; }); }
  function setItem(i, k, v) {
    setForm(function(f) {
      return Object.assign({}, f, {
        items: f.items.map(function(it, idx) {
          if (idx !== i) return it;
          var o = Object.assign({}, it); o[k] = v; return o;
        }),
      });
    });
  }
  function addItem() { setForm(function(f) { return Object.assign({}, f, { items: f.items.concat([{ code: '', name: '', qty: 1, price: 0 }]) }); }); }
  function delItem(i) { setForm(function(f) { return Object.assign({}, f, { items: f.items.filter(function(_, idx) { return idx !== i; }) }); }); }

  // Auto-completa nombre/precio desde el catálogo cuando se escribe un código
  function fillCode(i, code) {
    var p = products.find(function(x) { return x.code === code.toUpperCase(); });
    if (p) {
      setForm(function(f) {
        return Object.assign({}, f, {
          items: f.items.map(function(it, idx) {
            return idx === i ? Object.assign({}, it, { code: p.code, name: p.name, price: p.price }) : it;
          }),
        });
      });
    } else {
      setItem(i, 'code', code);
    }
  }

  // Valor total de todos los artículos del formulario
  var itemsTotal = form.items.reduce(function(s, it) {
    return s + (parseFloat(it.price) || 0) * (parseInt(it.qty) || 0);
  }, 0);

  // Confirma y registra la devolución
  function doReturn() {
    var valid = form.items.filter(function(it) { return it.name.trim() && it.qty > 0; });
    if (!valid.length) { setErr('Agregá al menos un producto válido'); return; }
    if (!form.reason.trim()) { setErr('Indicá el motivo'); return; }
    // Monto de reembolso: vacío/no numérico → valor de los artículos; "0" explícito
    // vale 0; nunca negativo; topado al valor de los artículos devueltos.
    var _ra = parseFloat(form.refundAmount);
    var refAmt = form.refundMethod === 'Sin reembolso' ? 0 : (isNaN(_ra) ? itemsTotal : Math.max(0, Math.min(_ra, itemsTotal)));
    onProcess({
      clientId:      form.clientId || null,
      client:        form.client.trim() || 'Cliente general',
      saleId:        selSale ? selSale.id : null,
      items:         valid,
      reason:        form.reason,
      refundMethod:  form.refundMethod,
      refundAmount:  refAmt,
      itemCondition: form.itemCondition,
    });
    resetFlow();
  }

  // KPIs del historial
  var totalReembolsado = returns.filter(function(r) { return r.refundAmount > 0; })
    .reduce(function(s, r) { return s + r.refundAmount; }, 0);
  var totalSinReemb = returns.filter(function(r) { return r.refundMethod === 'Sin reembolso' || r.refundAmount === 0; }).length;

  var retPag = usePaginator(returns, 20);

  return (
    <div>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <p style={H1}>🔄 Devoluciones</p>
        <button
          style={mkBtn(show ? 'red' : 'teal')}
          onClick={function() { if (show) { resetFlow(); } else { setShow(true); } }}
        >
          {show ? '✕ Cancelar' : '+ Nueva devolución'}
        </button>
      </div>

      {/* ── FORMULARIO DE NUEVA DEVOLUCIÓN ── */}
      {show && (
        <div style={Object.assign({}, sCard, { marginBottom: 16, borderColor: '#378ADD', borderWidth: '1.5px' })}>
          <p style={{ fontWeight: 700, margin: '0 0 16px', fontSize: 15 }}>🔄 Registrar devolución</p>

          {/* PASO 1: Buscar cliente */}
          {step === 'search' && (
            <div>
              <p style={{ fontSize: 13, color: '#555', margin: '0 0 12px' }}>Paso 1 — Buscá al cliente por nombre, DPI o código</p>
              <div style={{ position: 'relative', marginBottom: 16 }}>
                <input
                  style={sInput}
                  value={cliQ}
                  placeholder="Nombre, DPI o código CLI..."
                  onChange={function(e) { setCliQ(e.target.value); setShowDrop(true); }}
                  onFocus={function() { setShowDrop(true); }}
                  onBlur={function() { setTimeout(function() { setShowDrop(false); }, 200); }}
                />
                {showDrop && cliQ.trim().length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, marginTop: 2 }}>
                    {cliResults.map(function(c) {
                      return (
                        <div
                          key={c.id}
                          onMouseDown={function() { pickClient(c); }}
                          style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between' }}
                        >
                          <div>
                            <b style={{ fontSize: 13 }}>{c.name}</b>
                            <span style={{ fontSize: 11, color: '#999', fontFamily: 'monospace', marginLeft: 6 }}>
                              {c.cliCode}{c.dpi ? ' · DPI: ' + c.dpi : ''}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {cliResults.length === 0 && (
                      <div style={{ padding: '10px 14px', fontSize: 12, color: '#999' }}>Sin resultados — podés continuar sin vincular cliente</div>
                    )}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  style={mkBtn('blue')}
                  onClick={function() {
                    if (!cliQ.trim()) { setErr('Ingresá el nombre del cliente'); return; }
                    setForm(function(f) { return Object.assign({}, f, { client: cliQ.trim() }); });
                    setStep('form');
                  }}
                >Continuar sin vincular →</button>
              </div>
              {err && <p style={{ color: '#E24B4A', fontSize: 13, marginTop: 10 }}>⚠ {err}</p>}
            </div>
          )}

          {/* PASO 2: Elegir venta a devolver */}
          {step === 'sale' && selCli && (
            <div>
              {/* Chip del cliente seleccionado */}
              <div style={{ background: '#E1F5EE', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 700, color: '#085041' }}>{selCli.name}</span>
                  <span style={{ fontSize: 11, color: '#0F6E56', marginLeft: 8, fontFamily: 'monospace' }}>
                    {selCli.cliCode}{selCli.dpi ? ' · DPI: ' + selCli.dpi : ''}
                  </span>
                </div>
                <span
                  onClick={function() { setSelCli(null); setCliQ(''); setStep('search'); }}
                  style={{ cursor: 'pointer', color: '#E24B4A', fontWeight: 700 }}
                >× Cambiar</span>
              </div>

              <p style={{ fontSize: 13, color: '#555', margin: '0 0 12px' }}>Paso 2 — Seleccioná la venta a devolver (o saltá este paso)</p>

              {cliSales.length === 0 ? (
                <div style={{ background: '#f5f4f0', borderRadius: 8, padding: '12px 14px', marginBottom: 12, fontSize: 13, color: '#666' }}>
                  Sin ventas registradas para este cliente
                </div>
              ) : (
                <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 12 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Fecha', 'Artículos', 'Total', 'Método', 'Estado devolución', ''].map(function(h) {
                          return <th key={h} style={sTH}>{h}</th>;
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {cliSales.map(function(s) {
                        return (
                          <tr
                            key={s.id}
                            style={{ cursor: s.fullyReturned ? 'not-allowed' : 'pointer', opacity: s.fullyReturned ? 0.5 : 1 }}
                            onClick={function() { pickSale(s); }}
                          >
                            <td style={sTD}>{fmtD(s.date)} {fmtT(s.date)}</td>
                            <td style={Object.assign({}, sTD, { color: '#666' })}>{(s.items || []).length} art.</td>
                            <td style={Object.assign({}, sTD, { fontWeight: 700, color: TEAL })}>{Q(s.total)}</td>
                            <td style={sTD}><span style={mkBadge('teal')}>{s.method}</span></td>
                            <td style={sTD}>
                              {s.fullyReturned
                                ? <span style={mkBadge('red')}>✓ Devuelta completa</span>
                                : s.partiallyReturned
                                  ? <span style={mkBadge('amber')}>⚠ Parcial ({s.totalDevuelto}/{s.totalOriginal} arts.)</span>
                                  : <span style={mkBadge('green')}>Disponible</span>
                              }
                            </td>
                            <td style={Object.assign({}, sTD, { color: s.fullyReturned ? '#999' : TEAL, fontSize: 12 })}>
                              {s.fullyReturned ? 'No disponible' : 'Seleccionar →'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <button
                style={Object.assign({}, mkBtn('gray'), { fontSize: 12 })}
                onClick={function() { setStep('form'); }}
              >Continuar sin elegir venta específica →</button>
            </div>
          )}

          {/* PASO 3: Formulario de devolución */}
          {step === 'form' && (
            <div>
              {/* Info del cliente + venta vinculada */}
              {selCli && (
                <div style={{ background: '#E1F5EE', borderRadius: 8, padding: '8px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: '#085041', fontSize: 13 }}>
                    {selCli.name}
                    {selCli.cliCode && <span style={{ fontFamily: 'monospace', fontWeight: 400, color: '#0F6E56', marginLeft: 6 }}>{selCli.cliCode}</span>}
                  </span>
                  {selSale && <span style={{ fontSize: 12, color: '#0F6E56' }}>Venta: {fmtD(selSale.date)} — {Q(selSale.total)}</span>}
                </div>
              )}

              {/* Si no hay cliente seleccionado, pide nombre manual */}
              {!selCli && (
                <div style={{ marginBottom: 12 }}>
                  <label style={sLabel}>👤 Cliente</label>
                  <input style={sInput} value={form.client} placeholder="Nombre del cliente" onChange={function(e) { setF('client', e.target.value); }} />
                </div>
              )}

              {err && <p style={{ color: '#E24B4A', fontSize: 13, margin: '0 0 10px' }}>⚠ {err}</p>}

              <div style={{ marginBottom: 12 }}>
                <label style={sLabel}>📋 Motivo de devolución</label>
                <input style={sInput} value={form.reason} placeholder="Ej: Pantalla defectuosa" onChange={function(e) { setErr(''); setF('reason', e.target.value); }} />
              </div>

              {/* Filas de productos a devolver */}
              <p style={{ fontWeight: 500, margin: '0 0 8px', fontSize: 13, color: '#666' }}>Productos a devolver</p>
              {form.items.map(function(it, i) {
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 80px 100px 28px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <input style={sInput} placeholder="Código" value={it.code} onChange={function(e) { fillCode(i, e.target.value); }} />
                    <input style={sInput} placeholder="Nombre del producto" value={it.name} onChange={function(e) { setErr(''); setItem(i, 'name', e.target.value); }} />
                    <input type="number" style={sInput} placeholder="Cant." value={it.qty} min={1} onChange={function(e) { setItem(i, 'qty', parseInt(e.target.value) || 1); }} />
                    <input type="number" style={sInput} placeholder="Precio Q" value={it.price || ''} onChange={function(e) { setItem(i, 'price', parseFloat(e.target.value) || 0); }} />
                    {form.items.length > 1 && (
                      <span style={{ cursor: 'pointer', color: '#E24B4A', fontSize: 20, textAlign: 'center' }} onClick={function() { delItem(i); }}>×</span>
                    )}
                  </div>
                );
              })}
              <button style={Object.assign({}, mkBtn('gray'), { padding: '5px 12px', fontSize: 12, marginBottom: 16 })} onClick={addItem}>+ Agregar fila</button>

              {itemsTotal > 0 && (
                <div style={{ background: '#f5f4f0', borderRadius: 8, padding: '8px 14px', marginBottom: 14, fontSize: 13 }}>
                  Valor total de artículos: <b>{Q(itemsTotal)}</b>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                {/* Estado del artículo devuelto */}
                <div>
                  <label style={sLabel}>💰 Estado del artículo devuelto</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[['bueno', '✅ Buen estado'], ['defectuoso', '⚠️ Defectuoso']].map(function(pair) {
                      var active = form.itemCondition === pair[0];
                      return (
                        <div
                          key={pair[0]}
                          onClick={function() { setF('itemCondition', pair[0]); }}
                          style={{
                            padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                            border: '2px solid ' + (active ? TEAL : 'rgba(0,0,0,0.15)'),
                            background: active ? '#E1F5EE' : '#fff',
                            fontSize: 13, fontWeight: active ? 600 : 400,
                            color: active ? '#085041' : '#444', textAlign: 'center',
                          }}
                        >{pair[1]}</div>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: 11, color: '#888', margin: '6px 0 0' }}>
                    {form.itemCondition === 'bueno' ? '✓ Volverá al inventario' : '⚠ Irá a Piezas Defectuosas'}
                  </p>
                </div>

                {/* Método y monto de reembolso */}
                <div>
                  <label style={sLabel}>💵 Reembolso al cliente</label>
                  <select
                    style={Object.assign({}, sInput, { marginBottom: 8 })}
                    value={form.refundMethod}
                    onChange={function(e) { setF('refundMethod', e.target.value); }}
                  >
                    <option>Efectivo</option>
                    <option>Tarjeta</option>
                    <option>Crédito en cuenta</option>
                    <option>Sin reembolso</option>
                  </select>
                  {form.refundMethod !== 'Sin reembolso' && (
                    <div>
                      <label style={sLabel}>Monto a reembolsar (Q)</label>
                      <input
                        type="number" style={sInput}
                        value={form.refundAmount}
                        placeholder={'Total: ' + itemsTotal.toFixed(2)}
                        onChange={function(e) { setF('refundAmount', e.target.value); }}
                      />
                    </div>
                  )}
                  {form.refundMethod === 'Sin reembolso' && (
                    <div style={{ background: '#f5f4f0', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: '#666' }}>
                      No se devolverá dinero
                    </div>
                  )}
                </div>
              </div>

              <button style={Object.assign({}, mkBtn('blue'), { padding: '10px 24px', fontSize: 14 })} onClick={doReturn}>
                ✓ Registrar devolución
              </button>
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        <MetricBox label="Total devoluciones" value={returns.length}      color="#7F77DD" />
        <MetricBox label="Total reembolsado"  value={Q(totalReembolsado)} color="#E24B4A" />
        <MetricBox label="Sin reembolso"      value={totalSinReemb}       color="#666"    />
      </div>

      {/* Tabla de historial */}
      <div style={sCard}>
        {returns.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999', padding: 40 }}>Sin devoluciones registradas</p>
        ) : (
          <div className="tbl-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['#', 'Fecha', 'Cliente', 'Motivo', 'Estado artículo', 'Reembolso', 'Monto reimb.', 'Valor artícs.'].map(function(h) {
                    return (
                      <th key={h} style={h === '#' ? Object.assign({}, sTH, { width: 40, textAlign: 'center' }) : sTH}>{h}</th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {retPag.paged.map(function(r, index) {
                  var cond = r.itemCondition || 'bueno';
                  return (
                    <tr key={r.id}>
                      <td style={Object.assign({}, sTD, { textAlign: 'center', color: '#999', fontSize: 12 })}>{retPag.offset + index + 1}</td>
                      <td style={sTD}>{fmtD(r.date)}</td>
                      <td style={Object.assign({}, sTD, { fontWeight: 600 })}>{r.client}</td>
                      <td style={sTD}>{r.reason}</td>
                      <td style={sTD}>
                        <span style={mkBadge(cond === 'bueno' ? 'green' : 'amber')}>
                          {cond === 'bueno' ? '✅ Buen estado' : '⚠️ Defectuoso'}
                        </span>
                      </td>
                      <td style={sTD}><span style={mkBadge('blue')}>{r.refundMethod}</span></td>
                      <td style={Object.assign({}, sTD, { fontWeight: 700, color: r.refundAmount > 0 ? '#E24B4A' : '#999' })}>
                        {r.refundAmount > 0 ? Q(r.refundAmount) : '—'}
                      </td>
                      <td style={Object.assign({}, sTD, { color: '#666' })}>{Q(r.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <retPag.Pager />
      </div>
    </div>
  );
}
