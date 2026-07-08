// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA: CajaScreen (Apertura y Cierre de Caja)
//
// Gestiona el ciclo diario de la caja registradora:
//
//   Apertura:
//     El cajero (o admin) ingresa el fondo inicial antes de empezar a operar.
//     Solo puede haber una sesión de caja activa a la vez.
//
//   Durante la sesión:
//     - Movimientos de efectivo en tiempo real (ventas, abonos, reembolsos, gastos)
//     - Registro de gastos de caja (suministros, servicios, transporte, etc.)
//
//   Cierre:
//     El usuario cuenta el efectivo físico, el sistema muestra la diferencia
//     (sobrante o faltante) y genera un comprobante imprimible.
//     Al cerrar se ejecuta un respaldo automático.
//
//   Historial:
//     Muestra las últimas sesiones de caja (abiertas y cerradas).
//
// Pestañas:
//   📋 Movimientos — entradas y salidas del día en efectivo
//   💸 Gastos      — gastos registrados en la sesión activa
//   📂 Historial   — últimas sesiones de caja
//
// Props:
//   sales    {Array}  — ventas del sistema
//   accounts {Array}  — cuentas por cobrar (para extraer abonos en efectivo)
//   returns  {Array}  — devoluciones (para extraer reembolsos en efectivo)
//   session  {Object} — sesión del usuario activo (role, name)
//   onBackup {Function} — dispara el respaldo automático tras el cierre
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { TEAL, NAVY, sCard, sInput, sLabel, sTH, sTD, mkBtn, mkBadge } from '../styles/theme.js';
import { Q, fmtT } from '../utils/formatters.js';
import { cajaAPI } from '../utils/api.js';
import { getStore } from '../utils/receipt.js';
import { STORE_FALLBACK } from '../constants/index.js';

// Categorías predefinidas para los gastos de caja
var GASTOS_CAT = ['general', 'suministros', 'servicios', 'transporte', 'alimentación', 'otro'];

var H1 = { fontSize: 'clamp(17px,4vw,22px)', fontWeight: 600, margin: 0, color: 'var(--text-primary,#1a1a1a)' };

// ── Componente de métrica simple (local) ───────────────────────────────────
function MetricBox({ label, value, color }) {
  return (
    <div style={{ background: '#f5f4f0', borderRadius: 10, padding: 16, border: '1px solid rgba(0,0,0,0.07)' }}>
      <p style={{ fontSize: 12, color: '#666', margin: '0 0 6px' }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 600, margin: 0, color: color || '#1a1a1a' }}>{value}</p>
    </div>
  );
}

export default function CajaScreen({ sales, accounts, returns: devos, session, onBackup }) {
  sales    = sales    || [];
  accounts = accounts || [];
  devos    = devos    || [];
  session  = session  || {};
  onBackup = onBackup || function() {};

  // ── Estado de la sesión de caja ───────────────────────────────────────────
  var _sa = useState(null);  var sesionActiva  = _sa[0];  var setSesionActiva  = _sa[1];
  var _sl = useState(true);  var cargando      = _sl[0];  var setCargando      = _sl[1];
  var _g  = useState([]);    var gastos        = _g[0];   var setGastos        = _g[1];
  var _t  = useState('movimientos'); var tab   = _t[0];   var setTab           = _t[1];
  var _hs = useState([]);    var histSesiones  = _hs[0];  var setHistSesiones  = _hs[1];

  // ── Modal apertura ────────────────────────────────────────────────────────
  var _ma   = useState(false); var showApertura  = _ma[0];   var setShowApertura  = _ma[1];
  var _fi   = useState('');    var fondoInput    = _fi[0];   var setFondoInput    = _fi[1];
  var _na   = useState('');    var notaApertura  = _na[0];   var setNotaApertura  = _na[1];

  // ── Modal gasto ───────────────────────────────────────────────────────────
  var _mg   = useState(false); var showGasto     = _mg[0];   var setShowGasto     = _mg[1];
  var _gc   = useState('');    var gastoConcepto = _gc[0];   var setGastoConcepto = _gc[1];
  var _gm   = useState('');    var gastoMonto    = _gm[0];   var setGastoMonto    = _gm[1];
  var _gcat = useState('general'); var gastoCat  = _gcat[0]; var setGastoCat      = _gcat[1];

  // ── Modal cierre ──────────────────────────────────────────────────────────
  var _mc   = useState(false); var showCierre     = _mc[0];   var setShowCierre     = _mc[1];
  var _ec   = useState('');    var efectivoContado = _ec[0];  var setEfectivoContado = _ec[1];
  var _ncr  = useState('');    var notaCierre      = _ncr[0]; var setNotaCierre      = _ncr[1];
  var _sv   = useState(false); var guardando       = _sv[0];  var setGuardando       = _sv[1];

  // Carga inicial: sesión activa e historial
  useEffect(function() {
    setCargando(true);
    Promise.all([
      cajaAPI.getSesionActiva().catch(function() { return null; }),
      cajaAPI.getSesiones().catch(function() { return []; }),
    ]).then(function(res) {
      setSesionActiva(res[0]);
      setHistSesiones(res[1] || []);
      if (res[0]) {
        cajaAPI.getGastos(res[0].id).catch(function() { return []; }).then(function(g) { setGastos(g || []); });
      }
      setCargando(false);
    });
  }, []);

  // ── Construir lista de movimientos del día ─────────────────────────────────
  var hoyStr = new Date().toDateString();
  var movimientos = [];

  // Ventas cobradas hoy — solo la PORCIÓN pagada en efectivo.
  // Pago dividido: si hay second_method, al método principal le corresponde
  // (total − second_amount) y al segundo método second_amount.
  sales.forEach(function(s) {
    if (new Date(s.date).toDateString() !== hoyStr || s.status !== 'completado') return;
    var seg = Number(s.second_amount || 0);
    var efectivo = 0;
    if (s.method === 'Efectivo') efectivo += s.total - (s.second_method ? seg : 0);
    if (s.second_method === 'Efectivo') efectivo += seg;
    if (efectivo > 0) {
      movimientos.push({ id: s.id, date: s.date, desc: 'Venta', detail: s.client, amount: efectivo, type: 'entrada', note: s.second_method ? 'Pago dividido (solo porción en efectivo)' : (s.nota || '') });
    }
  });

  // Abonos en efectivo a cuentas por cobrar
  accounts.forEach(function(a) {
    (a.payments || []).forEach(function(p) {
      if (p.method === 'Efectivo' && new Date(p.date).toDateString() === hoyStr) {
        movimientos.push({ id: p.id, date: p.date, desc: 'Abono cuenta', detail: a.client, amount: Number(p.amount), type: 'entrada', note: p.note || '' });
      }
    });
  });

  // Reembolsos en efectivo de devoluciones
  devos.forEach(function(r) {
    if (r.refundMethod === 'Efectivo' && r.refundAmount > 0 && new Date(r.date).toDateString() === hoyStr) {
      movimientos.push({ id: r.id, date: r.date, desc: 'Reembolso devolución', detail: r.client, amount: r.refundAmount, type: 'salida', note: r.reason });
    }
  });

  // Gastos de caja registrados en esta sesión
  gastos.forEach(function(g) {
    movimientos.push({ id: g.id, date: g.created_at, desc: 'Gasto: ' + g.concepto, detail: g.registrado_por, amount: Number(g.monto), type: 'salida', note: g.categoria });
  });

  movimientos.sort(function(a, b) { return new Date(b.date) - new Date(a.date); });

  // Totales de la sesión
  var totalEntradas  = movimientos.filter(function(m) { return m.type === 'entrada'; }).reduce(function(s, m) { return s + m.amount; }, 0);
  var totalSalidas   = movimientos.filter(function(m) { return m.type === 'salida';  }).reduce(function(s, m) { return s + m.amount; }, 0);
  var totalGastos    = gastos.reduce(function(s, g) { return s + Number(g.monto); }, 0);
  var fondo          = sesionActiva ? Number(sesionActiva.fondo_inicial || 0) : 0;
  var saldoEsperado  = fondo + totalEntradas - totalSalidas;

  // ── Acciones ───────────────────────────────────────────────────────────────

  function abrirCaja() {
    var f = parseFloat(fondoInput) || 0;
    setGuardando(true);
    cajaAPI.abrir({ fondo_inicial: f, nota: notaApertura }).then(function(s) {
      setSesionActiva(s);
      setGastos([]);
      setShowApertura(false);
      setFondoInput('');
      setNotaApertura('');
      setGuardando(false);
    }).catch(function(e) {
      alert(e && e.error ? e.error : 'Error al abrir caja');
      setGuardando(false);
    });
  }

  function registrarGasto() {
    if (!gastoConcepto || !gastoMonto) { alert('Complete concepto y monto'); return; }
    setGuardando(true);
    cajaAPI.crearGasto({
      sesion_id: sesionActiva && sesionActiva.id,
      concepto:  gastoConcepto,
      monto:     parseFloat(gastoMonto),
      categoria: gastoCat,
    }).then(function(g) {
      setGastos(function(prev) { return [g].concat(prev); });
      setShowGasto(false);
      setGastoConcepto('');
      setGastoMonto('');
      setGastoCat('general');
      setGuardando(false);
    }).catch(function() {
      setGuardando(false);
      alert('Error al registrar gasto');
    });
  }

  function eliminarGasto(id) {
    if (!window.confirm('¿Eliminar este gasto?')) return;
    cajaAPI.eliminarGasto(id).then(function() {
      setGastos(function(prev) { return prev.filter(function(g) { return g.id !== id; }); });
    });
  }

  function cerrarCaja() {
    if (!sesionActiva) return;
    setGuardando(true);
    cajaAPI.cerrar(sesionActiva.id, {
      efectivo_contado: efectivoContado ? parseFloat(efectivoContado) : null,
      nota:             notaCierre,
    }).then(function(s) {
      imprimirCierreCaja(s);
      setSesionActiva(null);
      setHistSesiones(function(prev) { return [s].concat(prev); });
      setGastos([]);
      setShowCierre(false);
      setEfectivoContado('');
      setNotaCierre('');
      setGuardando(false);
      // Respaldo automático al cerrar caja
      onBackup();
    }).catch(function(e) {
      alert(e && e.error ? e.error : 'Error al cerrar caja');
      setGuardando(false);
    });
  }

  // ── Genera e imprime el comprobante de cierre ──────────────────────────────
  function imprimirCierreCaja(s) {
    var si        = getStore();
    var storeName = si.store_name || STORE_FALLBACK;
    var contado   = s.efectivo_contado != null ? Number(s.efectivo_contado) : null;
    var diferencia = contado != null ? contado - saldoEsperado : null;

    var ventasEfectivo = movimientos.filter(function(m) { return m.type === 'entrada' && m.desc === 'Venta'; }).reduce(function(a, m) { return a + m.amount; }, 0);
    var abonosEfectivo = movimientos.filter(function(m) { return m.type === 'entrada' && m.desc === 'Abono cuenta'; }).reduce(function(a, m) { return a + m.amount; }, 0);
    var reembolsosEf   = movimientos.filter(function(m) { return m.type === 'salida' && (m.desc || '').startsWith('Reembolso'); }).reduce(function(a, m) { return a + m.amount; }, 0);

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cierre de Caja</title>'
      + '<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:13px;color:#222;padding:24px;max-width:700px;margin:0 auto;}'
      + '.hdr{border-bottom:3px solid #1D9E75;padding-bottom:12px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:flex-start;}'
      + '.brand h1{font-size:20px;font-weight:900;color:#1a2535;}.brand p{font-size:10px;color:#1D9E75;font-weight:700;letter-spacing:2px;}'
      + '.badge{display:inline-block;padding:3px 12px;border-radius:12px;font-weight:700;font-size:13px;}'
      + '.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;font-size:13px;}'
      + '.row.total{font-weight:800;font-size:16px;color:#1D9E75;padding-top:12px;border-bottom:none;}'
      + '.row.neg{color:#E24B4A;}.row.pos{color:#2E7D32;}'
      + '.section{margin-bottom:18px;}.section-title{font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#666;margin-bottom:10px;}'
      + '.footer{border-top:2px dashed #ccc;margin-top:18px;padding-top:12px;font-size:11px;color:#999;display:flex;justify-content:space-between;}'
      + '@media print{body{padding:10px;}}</style></head><body>'
      + '<div class="hdr">'
        + '<div class="brand"><h1>' + storeName + '</h1><p>CIERRE DE CAJA</p></div>'
        + '<div style="text-align:right;">'
          + '<div style="font-size:10px;color:#999;">Fecha cierre</div>'
          + '<div style="font-size:15px;font-weight:700;">' + new Date(s.closed_at || new Date()).toLocaleString('es-GT') + '</div>'
          + '<div style="margin-top:6px;"><span class="badge" style="background:#E1F5EE;color:#085041;">CERRADA</span></div>'
        + '</div>'
      + '</div>'
      + '<div class="section"><div class="section-title">Detalles de la sesión</div>'
        + '<div class="row"><span>Abierta por</span><span>' + s.opened_by + ' (' + s.opened_role + ')</span></div>'
        + '<div class="row"><span>Cerrada por</span><span>' + (s.closed_by || session.name) + ' (' + (s.closed_role || session.role) + ')</span></div>'
        + '<div class="row"><span>Apertura</span><span>' + new Date(s.created_at).toLocaleString('es-GT') + '</span></div>'
      + '</div>'
      + '<div class="section"><div class="section-title">Resumen financiero</div>'
        + '<div class="row"><span>Fondo inicial</span><span>Q ' + Number(s.fondo_inicial || 0).toFixed(2) + '</span></div>'
        + '<div class="row"><span>Ventas en efectivo</span><span>Q ' + ventasEfectivo.toFixed(2) + '</span></div>'
        + '<div class="row"><span>Abonos en efectivo</span><span>Q ' + abonosEfectivo.toFixed(2) + '</span></div>'
        + '<div class="row neg"><span>Reembolsos</span><span>−Q ' + reembolsosEf.toFixed(2) + '</span></div>'
        + '<div class="row neg"><span>Gastos de caja</span><span>−Q ' + totalGastos.toFixed(2) + '</span></div>'
        + '<div class="row total"><span>Saldo esperado</span><span>Q ' + saldoEsperado.toFixed(2) + '</span></div>'
        + (contado != null ? '<div class="row"><span>Efectivo contado</span><span>Q ' + contado.toFixed(2) + '</span></div>' : '')
        + (diferencia != null ? '<div class="row ' + (diferencia >= 0 ? 'pos' : 'neg') + '"><span>Diferencia (sobrante/faltante)</span><span>' + (diferencia >= 0 ? '+' : '') + 'Q ' + diferencia.toFixed(2) + '</span></div>' : '')
      + '</div>'
      + (gastos.length > 0
        ? '<div class="section"><div class="section-title">Detalle de gastos</div>'
          + gastos.map(function(g) {
            return '<div class="row"><span>' + g.concepto + ' <span style="color:#999;font-size:11px;">[' + g.categoria + ']</span></span><span>Q ' + Number(g.monto).toFixed(2) + '</span></div>';
          }).join('')
          + '</div>'
        : '')
      + (s.nota_cierre ? '<div class="section"><div class="section-title">Nota del cierre</div><p style="color:#555;">' + s.nota_cierre + '</p></div>' : '')
      + '<div class="footer"><span>' + storeName + ' — Sistema POS</span><span>Generado el ' + new Date().toLocaleString('es-GT') + '</span></div>'
      + '</body></html>';

    var ventana = window.open('', '_blank', 'width=750,height=900');
    if (ventana) {
      ventana.document.write(html);
      ventana.document.close();
      setTimeout(function() { ventana.print(); }, 400);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (cargando) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Cargando caja…</div>;
  }

  return (
    <div>
      {/* Encabezado con acciones */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <p style={H1}>💵 Caja</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!sesionActiva ? (
            <button style={mkBtn('teal')} onClick={function() { setShowApertura(true); }}>🔓 Abrir Caja</button>
          ) : (
            <>
              <button style={mkBtn('gray')} onClick={function() { setShowGasto(true); }}>💸 Registrar Gasto</button>
              <button style={Object.assign({}, mkBtn('red'), { background: '#E24B4A' })} onClick={function() { setShowCierre(true); }}>🔒 Cerrar Caja</button>
            </>
          )}
        </div>
      </div>

      {/* Banner de estado de caja */}
      {sesionActiva ? (
        <div style={{ background: '#E1F5EE', border: '1px solid #1D9E75', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <span style={{ fontWeight: 700, color: TEAL, fontSize: 15 }}>🟢 Caja abierta</span>
            <span style={{ color: '#555', fontSize: 13, marginLeft: 12 }}>
              por {sesionActiva.opened_by} · {new Date(sesionActiva.created_at).toLocaleString('es-GT')}
            </span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: NAVY }}>
            Fondo inicial: Q {Number(sesionActiva.fondo_inicial || 0).toFixed(2)}
          </span>
        </div>
      ) : (
        <div style={{ background: '#FFF3CD', border: '1px solid #F59E0B', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
          <span style={{ fontWeight: 700, color: '#B45309', fontSize: 14 }}>⚠️ Caja cerrada — Abra la caja antes de operar</span>
        </div>
      )}

      {/* KPIs de la sesión */}
      <div className="rg-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }}>
        <MetricBox label="Fondo inicial"  value={Q(fondo)}          color="#666" />
        <MetricBox label="Entradas hoy"   value={Q(totalEntradas)}  color={TEAL} />
        <MetricBox label="Salidas hoy"    value={Q(totalSalidas)}   color="#E24B4A" />
        <MetricBox label="Saldo esperado" value={Q(saldoEsperado)}  color={saldoEsperado >= 0 ? TEAL : '#E24B4A'} />
      </div>

      {/* Pestañas */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {[
          ['movimientos', '📋 Movimientos'],
          ['gastos',      '💸 Gastos (' + gastos.length + ')'],
          ['historial',   '📂 Historial sesiones'],
        ].map(function(t) {
          return (
            <button key={t[0]} style={Object.assign({}, mkBtn(tab === t[0] ? 'teal' : 'gray'), { padding: '6px 14px', fontSize: 13 })} onClick={function() { setTab(t[0]); }}>
              {t[1]}
            </button>
          );
        })}
      </div>

      {/* Tab: Movimientos */}
      {tab === 'movimientos' && (
        <div style={sCard}>
          <p style={{ fontWeight: 600, margin: '0 0 14px', fontSize: 15 }}>Movimientos de efectivo — Hoy</p>
          {movimientos.length === 0
            ? <p style={{ textAlign: 'center', color: '#999', padding: 32 }}>Sin movimientos de efectivo hoy</p>
            : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Hora', 'Tipo', 'Detalle', 'Nota', 'Monto'].map(function(h) { return <th key={h} style={sTH}>{h}</th>; })}
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map(function(m, i) {
                    return (
                      <tr key={m.id + i}>
                        <td style={sTD}>{fmtT(m.date)}</td>
                        <td style={sTD}><span style={mkBadge(m.type === 'entrada' ? 'green' : 'red')}>{m.type === 'entrada' ? '▲ Entrada' : '▼ Salida'}</span></td>
                        <td style={Object.assign({}, sTD, { fontWeight: 500 })}>
                          {m.desc}<span style={{ fontSize: 12, color: '#666', fontWeight: 400 }}> — {m.detail}</span>
                        </td>
                        <td style={Object.assign({}, sTD, { color: '#666', fontSize: 12 })}>{m.note || '—'}</td>
                        <td style={Object.assign({}, sTD, { fontWeight: 700, color: m.type === 'entrada' ? TEAL : '#E24B4A' })}>
                          {m.type === 'entrada' ? '+' : '-'}{Q(m.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          }
          {movimientos.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(0,0,0,0.1)', marginTop: 12, paddingTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 24, fontSize: 14, flexWrap: 'wrap' }}>
              <span style={{ color: TEAL }}>Entradas: <b>{Q(totalEntradas)}</b></span>
              <span style={{ color: '#E24B4A' }}>Salidas: <b>{Q(totalSalidas)}</b></span>
              <span style={{ fontWeight: 700, color: saldoEsperado >= 0 ? TEAL : '#E24B4A' }}>Saldo esperado: <b>{Q(saldoEsperado)}</b></span>
            </div>
          )}
        </div>
      )}

      {/* Tab: Gastos */}
      {tab === 'gastos' && (
        <div style={sCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={{ fontWeight: 600, fontSize: 15, margin: 0 }}>Gastos de caja</p>
            {sesionActiva && <button style={mkBtn('teal')} onClick={function() { setShowGasto(true); }}>+ Nuevo gasto</button>}
          </div>
          {gastos.length === 0
            ? <p style={{ textAlign: 'center', color: '#999', padding: 32 }}>Sin gastos registrados en esta sesión</p>
            : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Hora', 'Concepto', 'Categoría', 'Registrado por', 'Monto', ''].map(function(h) { return <th key={h} style={sTH}>{h}</th>; })}
                  </tr>
                </thead>
                <tbody>
                  {gastos.map(function(g) {
                    return (
                      <tr key={g.id}>
                        <td style={sTD}>{fmtT(g.created_at)}</td>
                        <td style={Object.assign({}, sTD, { fontWeight: 500 })}>{g.concepto}</td>
                        <td style={sTD}><span style={mkBadge('gray')}>{g.categoria}</span></td>
                        <td style={sTD}>{g.registrado_por}</td>
                        <td style={Object.assign({}, sTD, { fontWeight: 700, color: '#E24B4A' })}>−Q {Number(g.monto).toFixed(2)}</td>
                        <td style={sTD}>
                          {session.role === 'admin' && (
                            <button style={Object.assign({}, mkBtn('red'), { padding: '2px 8px', fontSize: 12 })} onClick={function() { eliminarGasto(g.id); }}>✕</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          }
          {gastos.length > 0 && (
            <div style={{ textAlign: 'right', marginTop: 12, fontWeight: 700, color: '#E24B4A' }}>
              Total gastos: Q {totalGastos.toFixed(2)}
            </div>
          )}
        </div>
      )}

      {/* Tab: Historial de sesiones */}
      {tab === 'historial' && (
        <div style={sCard}>
          <p style={{ fontWeight: 600, fontSize: 15, margin: '0 0 14px' }}>Últimas sesiones de caja</p>
          {histSesiones.length === 0
            ? <p style={{ textAlign: 'center', color: '#999', padding: 32 }}>Sin sesiones anteriores</p>
            : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Apertura', 'Cierre', 'Abierta por', 'Cerrada por', 'Fondo', 'Efectivo contado', 'Estado'].map(function(h) {
                      return <th key={h} style={sTH}>{h}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {histSesiones.map(function(s) {
                    var cerrada = !!s.closed_at;
                    return (
                      <tr key={s.id}>
                        <td style={sTD}>{new Date(s.created_at).toLocaleString('es-GT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                        <td style={sTD}>{cerrada ? new Date(s.closed_at).toLocaleString('es-GT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td style={sTD}>{s.opened_by}</td>
                        <td style={sTD}>{s.closed_by || '—'}</td>
                        <td style={sTD}>Q {Number(s.fondo_inicial || 0).toFixed(2)}</td>
                        <td style={sTD}>{s.efectivo_contado != null ? 'Q ' + Number(s.efectivo_contado).toFixed(2) : '—'}</td>
                        <td style={sTD}><span style={mkBadge(cerrada ? 'green' : 'amber')}>{cerrada ? 'Cerrada' : 'Abierta'}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          }
        </div>
      )}

      {/* ── Modal: Apertura de caja ── */}
      {showApertura && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 420 }}>
            <p style={{ fontWeight: 700, fontSize: 18, margin: '0 0 20px', color: NAVY }}>🔓 Abrir Caja</p>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 13 }}>Fondo inicial (Q)</label>
            <input style={sInput} type="number" min="0" step="0.01" placeholder="0.00" value={fondoInput} onChange={function(e) { setFondoInput(e.target.value); }} autoFocus />
            <label style={{ display: 'block', margin: '14px 0 6px', fontWeight: 600, fontSize: 13 }}>Nota (opcional)</label>
            <input style={sInput} placeholder="Ej: fondo de Q200 verificado" value={notaApertura} onChange={function(e) { setNotaApertura(e.target.value); }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button style={Object.assign({}, mkBtn('gray'), { flex: 1 })} onClick={function() { setShowApertura(false); }}>Cancelar</button>
              <button style={Object.assign({}, mkBtn('teal'), { flex: 1 })} onClick={abrirCaja} disabled={guardando}>
                {guardando ? 'Abriendo…' : 'Abrir Caja'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Registrar Gasto ── */}
      {showGasto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 420 }}>
            <p style={{ fontWeight: 700, fontSize: 18, margin: '0 0 20px', color: NAVY }}>💸 Registrar Gasto</p>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 13 }}>Concepto *</label>
            <input style={sInput} placeholder="Ej: pago de luz, compra de bolsas…" value={gastoConcepto} onChange={function(e) { setGastoConcepto(e.target.value); }} autoFocus />
            <label style={{ display: 'block', margin: '14px 0 6px', fontWeight: 600, fontSize: 13 }}>Monto (Q) *</label>
            <input style={sInput} type="number" min="0" step="0.01" placeholder="0.00" value={gastoMonto} onChange={function(e) { setGastoMonto(e.target.value); }} />
            <label style={{ display: 'block', margin: '14px 0 6px', fontWeight: 600, fontSize: 13 }}>Categoría</label>
            <select style={sInput} value={gastoCat} onChange={function(e) { setGastoCat(e.target.value); }}>
              {GASTOS_CAT.map(function(c) { return <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>; })}
            </select>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button style={Object.assign({}, mkBtn('gray'), { flex: 1 })} onClick={function() { setShowGasto(false); }}>Cancelar</button>
              <button style={Object.assign({}, mkBtn('teal'), { flex: 1 })} onClick={registrarGasto} disabled={guardando}>
                {guardando ? 'Guardando…' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Cierre de caja ── */}
      {showCierre && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 440 }}>
            <p style={{ fontWeight: 700, fontSize: 18, margin: '0 0 16px', color: NAVY }}>🔒 Cerrar Caja</p>
            {/* Resumen financiero de la sesión */}
            <div style={{ background: '#f8f9fa', borderRadius: 8, padding: 14, marginBottom: 18, fontSize: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#666' }}>Fondo inicial</span>
                <span>Q {fondo.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#666' }}>Entradas</span>
                <span style={{ color: TEAL }}>+Q {totalEntradas.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#666' }}>Salidas (reemb + gastos)</span>
                <span style={{ color: '#E24B4A' }}>−Q {totalSalidas.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16, marginTop: 8, paddingTop: 8, borderTop: '1px solid #ddd' }}>
                <span>Saldo esperado</span>
                <span style={{ color: TEAL }}>Q {saldoEsperado.toFixed(2)}</span>
              </div>
            </div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 13 }}>Efectivo contado (arqueo)</label>
            <input
              style={sInput} type="number" min="0" step="0.01"
              placeholder={'Esperado: Q ' + saldoEsperado.toFixed(2)}
              value={efectivoContado}
              onChange={function(e) { setEfectivoContado(e.target.value); }}
            />
            {/* Indicador visual de diferencia */}
            {efectivoContado && (
              <div style={{ marginTop: 8, fontWeight: 700, fontSize: 14, color: parseFloat(efectivoContado) - saldoEsperado >= 0 ? '#2E7D32' : '#E24B4A' }}>
                Diferencia: {parseFloat(efectivoContado) - saldoEsperado >= 0 ? '+' : ''}Q {(parseFloat(efectivoContado) - saldoEsperado).toFixed(2)}
              </div>
            )}
            <label style={{ display: 'block', margin: '14px 0 6px', fontWeight: 600, fontSize: 13 }}>Nota del cierre (opcional)</label>
            <input style={sInput} placeholder="Observaciones…" value={notaCierre} onChange={function(e) { setNotaCierre(e.target.value); }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button style={Object.assign({}, mkBtn('gray'), { flex: 1 })} onClick={function() { setShowCierre(false); }}>Cancelar</button>
              <button style={Object.assign({}, mkBtn('red'), { flex: 1, background: '#E24B4A' })} onClick={cerrarCaja} disabled={guardando}>
                {guardando ? 'Cerrando…' : 'Confirmar Cierre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
