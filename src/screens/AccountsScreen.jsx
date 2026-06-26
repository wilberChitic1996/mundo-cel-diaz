// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA: AccountsScreen (Cuentas por Cobrar)
//
// Gestiona las ventas al crédito (fiado) que los clientes aún deben pagar.
//
// Dos vistas:
//   - Lista: tabla con todas las cuentas filtradas por estado o búsqueda
//   - Detalle (selAcc): historial de pagos + formulario para registrar cuota
//
// Filtros:
//   activas   — pendientes + abono parcial (no pagadas)
//   pendiente — sin ningún pago aún
//   parcial   — con pagos pero saldo > 0
//   pagado    — saldo en cero
//   todas     — sin filtro
//
// Funciones especiales:
//   💬 Recordatorio WhatsApp individual — manda mensaje al cliente
//   📱 Recordatorio masivo — manda a varios clientes a la vez (solo admin)
//   📊 Excel / 📄 PDF — exporta la lista filtrada
//   📊 Antigüedad — muestra cuántos días llevan sin pagar (0-30, 31-60, 61-90, +90)
//
// Props:
//   accounts   {Array}    — todas las cuentas por cobrar
//   pendingAccs {Array}   — cuentas con saldo pendiente
//   totalPend  {number}   — suma de todos los saldos pendientes
//   products   {Array}    — productos (para el comprobante)
//   clients    {Array}    — lista de clientes (para buscar teléfonos)
//   session    {Object}   — sesión del usuario activo (role, name)
//   addPayment {Function} — (id, monto, método, nota) — registra un pago
//   showFlash  {Function} — muestra notificación flotante (msg, tipo)
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { TEAL, NAVY, sCard, sInput, sLabel, sTH, sTD, mkBtn, mkBadge } from '../styles/theme.js';
import { Q, fmtD, fmtT } from '../utils/formatters.js';
import { exportExcel, exportPDF } from '../utils/export.js';
import { usePaginator } from '../hooks/usePaginator.jsx';
import { abrirWA, waRecordatorio } from '../utils/whatsapp.js';
import { compartirWhatsApp, getStore } from '../utils/receipt.js';
import { pedirTelYEnviar } from '../utils/whatsapp.js';
import HelpTip from '../components/ui/HelpTip.jsx';

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

// Opciones de filtro: [valor, etiqueta]
var FILTROS = [
  ['activas',   'Activas'],
  ['pendiente', 'Pendientes'],
  ['parcial',   'Con abono'],
  ['pagado',    'Pagadas'],
  ['todas',     'Todas'],
];

export default function AccountsScreen({ accounts, pendingAccs, totalPend, products, clients, session, addPayment, showFlash }) {
  accounts    = accounts    || [];
  pendingAccs = pendingAccs || [];
  totalPend   = totalPend   || 0;
  products    = products    || [];
  clients     = clients     || [];
  session     = session     || {};
  addPayment  = addPayment  || function() {};
  showFlash   = showFlash   || function() {};

  // ID de la cuenta seleccionada para ver su detalle
  var _sel    = useState(null);         var selAcc       = _sel[0];      var setSelAcc       = _sel[1];
  // Filtro de estado activo
  var _f      = useState('activas');    var filtro       = _f[0];        var setFiltro       = _f[1];
  // Búsqueda por nombre de cliente
  var _cq     = useState('');           var clientQ      = _cq[0];       var setClientQ      = _cq[1];

  // Formulario de pago
  var _pa     = useState('');           var pmtAmount    = _pa[0];       var setPmtAmount    = _pa[1];
  var _pm     = useState('Efectivo');   var pmtMethod    = _pm[0];       var setPmtMethod    = _pm[1];
  var _pn     = useState('');           var pmtNote      = _pn[0];       var setPmtNote      = _pn[1];
  var _pe     = useState('');           var pmtErr       = _pe[0];       var setPmtErr       = _pe[1];

  // Modal recordatorio masivo
  var _wam    = useState(false);        var showWaMasivo = _wam[0];      var setShowWaMasivo = _wam[1];
  var _wsel   = useState({});           var waSel        = _wsel[0];     var setWaSel        = _wsel[1];
  var _wtel   = useState({});           var waTels       = _wtel[0];     var setWaTels       = _wtel[1];
  var _wsend  = useState(false);        var waSending    = _wsend[0];    var setWaSending    = _wsend[1];

  // Totales globales
  var totalCobrado = accounts.reduce(function(s, a) { return s + a.paid; }, 0);

  // Lista filtrada
  var filtradas = accounts.filter(function(a) {
    if (clientQ) return (a.client || '').toLowerCase().indexOf(clientQ.toLowerCase()) >= 0;
    if (filtro === 'todas')    return true;
    if (filtro === 'activas')  return a.status !== 'pagado';
    return a.status === filtro;
  });

  var saldoFiltrado  = filtradas.reduce(function(s, a) { return s + (a.balance || 0); }, 0);
  var pagadoFiltrado = filtradas.reduce(function(s, a) { return s + (a.paid    || 0); }, 0);
  var accPag         = usePaginator(filtradas, 20);

  // ── Registrar pago a una cuenta ───────────────────────────────────────────
  function registrarPago(acc) {
    var amt = parseFloat(pmtAmount);
    if (!amt || amt <= 0)       { setPmtErr('Ingresá un monto válido'); return; }
    if (amt > acc.balance + 0.01) { setPmtErr('El máximo es ' + Q(acc.balance)); return; }
    addPayment(acc.id, Math.min(amt, acc.balance), pmtMethod, pmtNote);
    setPmtAmount('');
    setPmtNote('');
    setPmtErr('');
    showFlash('✓ Pago registrado — ' + Q(amt), 'ok');
  }

  // ── Buscar teléfono de cliente por ID ─────────────────────────────────────
  function telDeCliente(clientId) {
    var cl = clients.find(function(c) { return c.id === clientId; });
    return (cl && cl.phone) || '';
  }

  // ── Vista de detalle de cuenta (formulario de pago) ───────────────────────
  if (selAcc) {
    var acc    = accounts.find(function(a) { return a.id === selAcc; });
    if (!acc)  { setSelAcc(null); return null; }
    var accTel = telDeCliente(acc.clientId);

    return (
      <div>
        {/* Botones de acción de la cuenta */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <button style={mkBtn('gray')} onClick={function() { setSelAcc(null); setPmtAmount(''); setPmtNote(''); setPmtErr(''); }}>← Volver</button>
          {acc.status !== 'pagado' && (
            <button
              style={Object.assign({}, mkBtn('green'), { background: '#25D366' })}
              onClick={function() {
                var getMsj = function() { return waRecordatorio(acc); };
                var waopts = { sale: acc, receiptOpts: { estado: acc.status, pagado: acc.paid, saldo: acc.balance } };
                if (accTel) { compartirWhatsApp(accTel, getMsj, waopts); } else { pedirTelYEnviar(acc.client, getMsj, waopts); }
              }}
            >💬 Recordatorio WhatsApp</button>
          )}
        </div>

        {/* Detalle de la cuenta */}
        <div style={sCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <p style={{ fontWeight: 700, fontSize: 18, margin: '0 0 4px' }}>👤 {acc.client}</p>
              <p style={{ fontSize: 13, color: '#666', margin: '0 0 2px' }}>Creada: {fmtD(acc.date)} {fmtT(acc.date)}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={mkBadge(acc.status === 'pagado' ? 'green' : acc.status === 'parcial' ? 'amber' : 'red')}>
                {acc.status === 'pagado' ? '✓ Pagado' : acc.status === 'parcial' ? 'Abono parcial' : 'Pendiente'}
              </span>
              <div style={{ marginTop: 10, fontSize: 13, color: '#666' }}>Total: <b>{Q(acc.total)}</b></div>
              <div style={{ fontSize: 13, color: TEAL }}>Pagado: <b>{Q(acc.paid)}</b></div>
              <div style={{ fontSize: 18, fontWeight: 700, color: acc.balance > 0 ? '#E24B4A' : TEAL }}>Saldo: {Q(acc.balance)}</div>
            </div>
          </div>

          {/* Artículos de la venta original */}
          <p style={{ fontWeight: 600, margin: '0 0 8px', fontSize: 14 }}>Productos / Servicios</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
            <thead>
              <tr>{['Código', 'Producto', 'Cant.', 'Precio', 'Subtotal'].map(function(h) { return <th key={h} style={sTH}>{h}</th>; })}</tr>
            </thead>
            <tbody>
              {(acc.items || []).map(function(it, i) {
                return (
                  <tr key={i}>
                    <td style={Object.assign({}, sTD, { fontFamily: 'monospace', fontSize: 12 })}>{it.code}</td>
                    <td style={Object.assign({}, sTD, { fontWeight: 500 })}>{it.name}</td>
                    <td style={sTD}>{it.qty}</td>
                    <td style={sTD}>{Q(it.price)}</td>
                    <td style={Object.assign({}, sTD, { fontWeight: 600, color: TEAL })}>{Q(it.price * it.qty)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Historial de pagos */}
          {acc.payments && acc.payments.length > 0 && (
            <div>
              <p style={{ fontWeight: 600, margin: '0 0 8px', fontSize: 14 }}>💰 Historial de pagos</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
                <thead>
                  <tr>{['Fecha', 'Monto', 'Método', 'Nota'].map(function(h) { return <th key={h} style={sTH}>{h}</th>; })}</tr>
                </thead>
                <tbody>
                  {acc.payments.map(function(p, i) {
                    return (
                      <tr key={i}>
                        <td style={sTD}>{fmtD(p.date)} {fmtT(p.date)}</td>
                        <td style={Object.assign({}, sTD, { fontWeight: 700, color: TEAL })}>{Q(p.amount)}</td>
                        <td style={sTD}><span style={mkBadge('teal')}>{p.method}</span></td>
                        <td style={Object.assign({}, sTD, { color: '#666' })}>{p.note || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Formulario de pago */}
          {acc.status !== 'pagado' ? (
            <div style={{ background: '#f9f8f5', borderRadius: 10, padding: 16, border: '1px solid rgba(0,0,0,0.08)' }}>
              <p style={{ fontWeight: 600, margin: '0 0 12px', fontSize: 14 }}>💳 Registrar pago / cuota</p>
              {pmtErr && <p style={{ color: '#E24B4A', fontSize: 13, margin: '0 0 10px' }}>⚠ {pmtErr}</p>}
              <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={sLabel}>Monto (Q)</label>
                  <input type="number" style={sInput} value={pmtAmount} placeholder={'Saldo: ' + acc.balance.toFixed(2)} onChange={function(e) { setPmtErr(''); setPmtAmount(e.target.value); }} />
                </div>
                <div>
                  <label style={sLabel}>Método</label>
                  <select style={sInput} value={pmtMethod} onChange={function(e) { setPmtMethod(e.target.value); }}>
                    <option>Efectivo</option>
                    <option>Tarjeta</option>
                    <option>Transferencia</option>
                  </select>
                </div>
                <div>
                  <label style={sLabel}>Nota (ej: Cuota 1)</label>
                  <input style={sInput} value={pmtNote} placeholder="Opcional" onChange={function(e) { setPmtNote(e.target.value); }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={mkBtn('teal')} onClick={function() { registrarPago(acc); }}>✓ Registrar pago</button>
                <button style={mkBtn('blue')} onClick={function() { setPmtAmount(acc.balance.toFixed(2)); setPmtNote('Pago total'); }}>
                  Pagar todo ({Q(acc.balance)})
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: '#EAF3DE', borderRadius: 10, padding: '12px 16px', textAlign: 'center', color: '#27500A', fontWeight: 600 }}>
              ✓ Cuenta totalmente pagada
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Aging (antigüedad de cuentas) ─────────────────────────────────────────
  var ahora = new Date();
  var aging = [
    { label: '0 – 30 días',  color: '#2E7D32', bg: '#EAF3DE', accs: [] },
    { label: '31 – 60 días', color: '#E65100', bg: '#FFF3E0', accs: [] },
    { label: '61 – 90 días', color: '#C62828', bg: '#FDECEA', accs: [] },
    { label: '+90 días',     color: '#7B1FA2', bg: '#F3E5F5', accs: [] },
  ];
  pendingAccs.forEach(function(a) {
    var dias = Math.floor((ahora - new Date(a.date)) / 86400000);
    if      (dias <= 30) aging[0].accs.push(a);
    else if (dias <= 60) aging[1].accs.push(a);
    else if (dias <= 90) aging[2].accs.push(a);
    else                 aging[3].accs.push(a);
  });

  // ── Vista de lista ─────────────────────────────────────────────────────────
  return (
    <div>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 10 }}>
        <p style={H1}>
          💳 Cuentas por Cobrar
          <HelpTip text={'Clientes que compraron al crédito y aún deben.\n\n• Pendiente: no han pagado nada\n• Abono parcial: pagaron una parte\n• Pagado: saldo en cero\n\nTocá "Atender →" para registrar un pago o enviar recordatorio por WhatsApp.'} />
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={Object.assign({}, mkBtn('teal'), { padding: '6px 12px', fontSize: 12 })} onClick={function() {
            exportExcel(
              filtradas.map(function(a) { return [a.client || '', fmtD(a.date), a.total.toFixed(2), a.paid.toFixed(2), a.balance.toFixed(2), a.status || '']; }),
              ['Cliente', 'Fecha', 'Total', 'Pagado', 'Saldo', 'Estado'],
              'cuentas_por_cobrar'
            );
          }}>📊 Excel</button>
          <button style={Object.assign({}, mkBtn('blue'), { padding: '6px 12px', fontSize: 12 })} onClick={function() {
            exportPDF(
              'Cuentas por Cobrar',
              ['Cliente', 'Fecha', 'Total', 'Pagado', 'Saldo', 'Estado'],
              filtradas.map(function(a) { return [a.client || '', fmtD(a.date), 'Q' + a.total.toFixed(2), 'Q' + a.paid.toFixed(2), 'Q' + a.balance.toFixed(2), a.status || '']; }),
              'cuentas_por_cobrar'
            );
          }}>📄 PDF</button>
          {(session.role === 'admin' || session.role === 'superadmin') && pendingAccs.length > 0 && (
            <button
              style={Object.assign({}, mkBtn('green'), { background: '#25D366', padding: '6px 12px', fontSize: 12 })}
              onClick={function() {
                var initSel = {}; var initTels = {};
                pendingAccs.forEach(function(a) {
                  initSel[a.id] = true;
                  var cl = clients.find(function(c) { return c.id === a.clientId; });
                  initTels[a.id] = (cl && cl.phone) || '';
                });
                setWaSel(initSel);
                setWaTels(initTels);
                setShowWaMasivo(true);
              }}
            >📱 Recordatorio masivo</button>
          )}
        </div>
      </div>

      {/* Modal recordatorio masivo */}
      {showWaMasivo && (function() {
        var selIds   = Object.keys(waSel).filter(function(id) { return waSel[id]; });
        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <p style={{ fontWeight: 700, fontSize: 17, margin: 0 }}>📱 Recordatorio masivo por WhatsApp</p>
                <button style={mkBtn('gray')} onClick={function() { setShowWaMasivo(false); setWaSending(false); }}>✕ Cerrar</button>
              </div>
              <p style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>Seleccioná los clientes que recibirán el recordatorio. Se abrirá WhatsApp para cada uno.</p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button style={Object.assign({}, mkBtn('teal'), { padding: '5px 12px', fontSize: 12 })} onClick={function() { var s = {}; pendingAccs.forEach(function(a) { s[a.id] = true; }); setWaSel(s); }}>✓ Todos</button>
                <button style={Object.assign({}, mkBtn('gray'), { padding: '5px 12px', fontSize: 12 })} onClick={function() { setWaSel({}); }}>✗ Ninguno</button>
                <span style={{ fontSize: 13, color: '#666', alignSelf: 'center', marginLeft: 4 }}>{selIds.length} de {pendingAccs.length} seleccionados</span>
              </div>
              <div style={{ borderRadius: 8, border: '1px solid #eee', overflow: 'hidden', marginBottom: 16 }}>
                {pendingAccs.map(function(a, i) {
                  return (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: i % 2 === 0 ? '#fafafa' : '#fff', borderBottom: '1px solid #f0f0f0' }}>
                      <input type="checkbox" checked={!!waSel[a.id]} onChange={function(e) { var s = Object.assign({}, waSel); s[a.id] = e.target.checked; setWaSel(s); }} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.client}</div>
                        <div style={{ fontSize: 12, color: '#E24B4A', fontWeight: 700 }}>Saldo: {Q(a.balance)}</div>
                      </div>
                      <input
                        type="tel" placeholder="Teléfono"
                        value={waTels[a.id] || ''}
                        onChange={function(e) { var t = Object.assign({}, waTels); t[a.id] = e.target.value; setWaTels(t); }}
                        style={Object.assign({}, sInput, { width: 130, padding: '6px 10px', fontSize: 12, margin: 0 })}
                      />
                    </div>
                  );
                })}
              </div>
              <button
                style={Object.assign({}, mkBtn('green'), { background: '#25D366', width: '100%', fontSize: 15, padding: '12px', opacity: selIds.length === 0 || waSending ? 0.6 : 1 })}
                disabled={selIds.length === 0 || waSending}
                onClick={function() {
                  var toSend = pendingAccs.filter(function(a) { return waSel[a.id]; });
                  if (toSend.length === 0) return;
                  setWaSending(true);
                  var store = getStore();
                  toSend.forEach(function(a, idx) {
                    setTimeout(function() {
                      var tel = waTels[a.id] || '';
                      var msg = 'Hola ' + a.client + ', le recordamos que tiene un saldo pendiente de ' + Q(a.balance) + ' en ' + (store.store_name || 'nuestro negocio') + '. Por favor comuníquese con nosotros para coordinar el pago. Gracias.';
                      abrirWA(tel, msg);
                      if (idx === toSend.length - 1) {
                        setWaSending(false);
                        showFlash('✓ Se abrió WhatsApp para ' + toSend.length + ' cliente(s)', 'ok');
                        setShowWaMasivo(false);
                      }
                    }, idx * 1200);
                  });
                }}
              >{waSending ? 'Enviando...' : '💬 Enviar recordatorio a ' + selIds.length + ' cliente(s)'}</button>
            </div>
          </div>
        );
      })()}

      {/* KPIs */}
      <div className="rg-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 16 }}>
        <MetricBox label="Total pendiente" value={Q(totalPend)}        color="#E24B4A" />
        <MetricBox label="Total cobrado"   value={Q(totalCobrado)}     color={TEAL} />
        <MetricBox label="Cuentas activas" value={pendingAccs.length}  color="#378ADD" />
      </div>

      {/* Antigüedad de cuentas */}
      {pendingAccs.length > 0 && (
        <div style={Object.assign({}, sCard, { marginBottom: 14 })}>
          <p style={{ fontWeight: 600, fontSize: 14, margin: '0 0 12px' }}>📊 Antigüedad de cuentas</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {aging.map(function(b, i) {
              var tot = b.accs.reduce(function(s, a) { return s + a.balance; }, 0);
              return (
                <div key={i} style={{ background: b.bg, borderRadius: 8, padding: '10px 12px', borderLeft: '4px solid ' + b.color }}>
                  <div style={{ fontSize: 11, color: b.color, fontWeight: 700, marginBottom: 4 }}>{b.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: b.color }}>{b.accs.length}</div>
                  <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{Q(tot)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Barra de búsqueda y filtros */}
      <div style={Object.assign({}, sCard, { marginBottom: 14 })}>
        <input style={Object.assign({}, sInput, { marginBottom: 12 })} placeholder="🔍  Buscar cuentas por cliente..." value={clientQ} onChange={function(e) { setClientQ(e.target.value); }} />
        {!clientQ && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {FILTROS.map(function(pair) {
              return (
                <button key={pair[0]} style={Object.assign({}, mkBtn(filtro === pair[0] ? 'teal' : 'gray'), { padding: '6px 14px' })} onClick={function() { setFiltro(pair[0]); }}>
                  {pair[1]}
                </button>
              );
            })}
          </div>
        )}
        {/* Resumen de cliente buscado */}
        {clientQ && filtradas.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, background: '#f9f8f5', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: 14 }}><b>{filtradas.length}</b> cuenta(s) de <b>{clientQ}</b></div>
            <div style={{ display: 'flex', gap: 24, fontSize: 14 }}>
              <span style={{ color: TEAL }}>Pagado: <b>{Q(pagadoFiltrado)}</b></span>
              <span style={{ color: saldoFiltrado > 0 ? '#E24B4A' : TEAL }}>Saldo total: <b>{Q(saldoFiltrado)}</b></span>
            </div>
          </div>
        )}
      </div>

      {/* Tabla de cuentas */}
      <div style={sCard}>
        {filtradas.length === 0
          ? <p style={{ textAlign: 'center', color: '#999', padding: 40 }}>Sin cuentas en esta categoría</p>
          : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['#', 'Fecha', 'Cliente', 'Total', 'Pagado', 'Saldo', 'Estado', ''].map(function(h) {
                    return <th key={h} style={h === '#' ? Object.assign({}, sTH, { width: 40, textAlign: 'center' }) : sTH}>{h}</th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {accPag.paged.map(function(a, index) {
                  return (
                    <tr key={a.id} style={{ cursor: 'pointer' }} onClick={function() { setSelAcc(a.id); }}>
                      <td style={Object.assign({}, sTD, { textAlign: 'center', color: '#999', fontSize: 12 })}>{accPag.offset + index + 1}</td>
                      <td style={sTD}>{fmtD(a.date)}</td>
                      <td style={Object.assign({}, sTD, { fontWeight: 600 })}>{a.client}</td>
                      <td style={sTD}>{Q(a.total)}</td>
                      <td style={Object.assign({}, sTD, { color: TEAL, fontWeight: 500 })}>{Q(a.paid)}</td>
                      <td style={Object.assign({}, sTD, { fontWeight: 700, color: a.balance > 0 ? '#E24B4A' : TEAL })}>{Q(a.balance)}</td>
                      <td style={sTD}>
                        <span style={mkBadge(a.status === 'pagado' ? 'green' : a.status === 'parcial' ? 'amber' : 'red')}>
                          {a.status === 'pagado' ? '✓ Pagado' : a.status === 'parcial' ? 'Abono parcial' : 'Pendiente'}
                        </span>
                      </td>
                      <td style={sTD}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button style={Object.assign({}, mkBtn('teal'), { padding: '4px 10px', fontSize: 11 })} onClick={function(e) { e.stopPropagation(); setSelAcc(a.id); }}>💳 Atender →</button>
                          {a.status !== 'pagado' && (
                            <button
                              style={Object.assign({}, mkBtn('green'), { background: '#25D366', padding: '4px 10px', fontSize: 11 })}
                              onClick={function(e) {
                                e.stopPropagation();
                                var tel    = telDeCliente(a.clientId);
                                var getMsj = function() { return waRecordatorio(a); };
                                var opts   = { sale: a, receiptOpts: { estado: a.status, pagado: a.paid, saldo: a.balance } };
                                if (tel) { compartirWhatsApp(tel, getMsj, opts); } else { pedirTelYEnviar(a.client, getMsj, opts); }
                              }}
                            >💬</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        }
        <accPag.Pager />
      </div>
    </div>
  );
}
