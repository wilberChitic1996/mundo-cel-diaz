// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA: ClientsScreen (Clientes)
//
// Base de datos de clientes del negocio con vista de lista y perfil 360°.
//
// Vista lista:
//   - KPIs: total clientes, con deuda activa, frecuentes
//   - Buscador por nombre, NIT, DPI, código CLI o teléfono
//   - Tabla paginada con código, nombre, NIT, teléfono, compras y deuda
//   - Clic en fila → vista perfil
//   - Botón "+ Nuevo cliente" → formulario inline
//
// Vista perfil 360°:
//   - Datos del cliente (NIT, DPI, teléfono, dirección)
//   - KPIs: compras totales, total comprado, deuda, devoluciones
//   - Cuentas pendientes con saldo
//   - Historial de compras (últimas 10)
//   - Historial de devoluciones
//
// Validaciones del formulario:
//   - Nombre obligatorio
//   - DPI: exactamente 13 dígitos si se ingresa (opcional)
//   - DPI único (no puede duplicarse entre clientes)
//
// Props:
//   clients    {Array}    — lista de clientes registrados
//   sales      {Array}    — ventas (para historial y frecuencia)
//   accounts   {Array}    — cuentas (para deuda por cliente)
//   returns    {Array}    — devoluciones (para historial)
//   saveClient {Function} — (clienteObj, esEdicion) guarda o actualiza
//   session    {Object}   — sesión activa { userId, name, role }
//   showFlash  {Function} — (msg, type) muestra notificación flash
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { TEAL, NAVY, sCard, sInput, sLabel, sTH, sTD, mkBtn, mkBadge } from '../styles/theme.js';
import { Q, fmtD } from '../utils/formatters.js';
import { usePaginator } from '../hooks/usePaginator.jsx';
import HelpTip from '../components/ui/HelpTip.jsx';

var H1 = { fontSize: 'clamp(17px,4vw,22px)', fontWeight: 600, margin: 0, color: 'var(--text-primary,#1a1a1a)' };

// Genera un código CLI único (CLI-000001, CLI-000002…)
function genCliCode(clients) {
  if (!clients || !clients.length) return 'CLI-000001';
  var nums = clients.map(function(c) { var m = (c.cliCode || '').match(/CLI-(\d+)/); return m ? parseInt(m[1]) : 0; });
  var max  = Math.max.apply(null, nums);
  return 'CLI-' + String(max + 1).padStart(6, '0');
}

// Valida que el DPI tenga exactamente 13 dígitos (o esté vacío)
function validarDPI(dpi) {
  if (!dpi || !dpi.trim()) return true;
  return /^\d{13}$/.test(dpi.trim());
}

// ID temporal local hasta que Supabase devuelve el ID real
function gid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// Tarjeta de métrica simple
function MetricBox({ label, value, color }) {
  return (
    <div style={Object.assign({}, sCard, { textAlign: 'center' })}>
      <p style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: color || NAVY }}>{value}</p>
      <p style={{ fontSize: 12, color: '#888', margin: 0 }}>{label}</p>
    </div>
  );
}


// Comparacion de nombre tolerante (espacios/mayusculas) para registros historicos sin clientId
function sameName(a, b) { return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase(); }

export default function ClientsScreen({ clients, sales, accounts, returns, saveClient, session, showFlash, initialSearch, initialClientId }) {
  clients  = clients  || [];
  sales    = sales    || [];
  accounts = accounts || [];
  returns  = returns  || [];
  session  = session  || {};

  // Búsqueda en la lista
  var _q   = useState(initialSearch||'');    var q       = _q[0];   var setQ       = _q[1];
  // ID del cliente cuyo perfil se está viendo (null = vista lista)
  var _sel = useState(initialClientId||null);  var selCli  = _sel[0]; var setSelCli  = _sel[1];
  // Formulario visible o no
  var _sf  = useState(false); var showForm = _sf[0]; var setShowForm = _sf[1];
  // Cliente que se está editando (null = nuevo)
  var _eu  = useState(null);  var editCli = _eu[0];  var setEditCli  = _eu[1];

  // Campos del formulario
  var _fn  = useState(''); var fName  = _fn[0];  var setFName  = _fn[1];
  var _fd  = useState(''); var fDpi   = _fd[0];  var setFDpi   = _fd[1];
  var _fn2 = useState(''); var fNit   = _fn2[0]; var setFNit   = _fn2[1];
  var _ft  = useState(''); var fTel   = _ft[0];  var setFTel   = _ft[1];
  var _fa  = useState(''); var fAddr  = _fa[0];  var setFAddr  = _fa[1];
  var _fem = useState(''); var fEmail = _fem[0]; var setFEmail = _fem[1];
  var _fe  = useState(''); var fErr   = _fe[0];  var setFErr   = _fe[1];

  // Clientes que coinciden con la búsqueda
  var filtered = clients.filter(function(c) {
    if (!q.trim()) return true;
    var ql = q.toLowerCase();
    return (c.name  || '').toLowerCase().indexOf(ql) >= 0
      || (c.dpi   || '').indexOf(q.trim()) >= 0
      || (c.nit   || '').toLowerCase().indexOf(ql) >= 0
      || (c.cliCode || '').toLowerCase().indexOf(ql) >= 0
      || (c.phone || '').indexOf(q.trim()) >= 0
      || (c.email || '').toLowerCase().indexOf(ql) >= 0;
  });
  var cliPag = usePaginator(filtered, 20);

  // Limpia y cierra el formulario
  function resetForm() {
    setFName(''); setFDpi(''); setFNit(''); setFTel(''); setFAddr(''); setFEmail('');
    setFErr(''); setEditCli(null); setShowForm(false);
  }

  // Guarda o actualiza un cliente tras validar
  function doSave() {
    if (!fName.trim()) { setFErr('El nombre es obligatorio'); return; }
    if (fDpi.trim() && !validarDPI(fDpi)) { setFErr('El DPI debe tener exactamente 13 dígitos'); return; }
    if (fDpi.trim()) {
      var dup = clients.find(function(c) { return c.dpi === fDpi.trim() && (!editCli || c.id !== editCli.id); });
      if (dup) { setFErr('Ya existe un cliente con ese DPI: ' + dup.name + ' (' + dup.cliCode + ')'); return; }
    }
    var cliCode = editCli ? editCli.cliCode : genCliCode(clients);
    var obj = {
      id:        editCli ? editCli.id : gid(),
      cliCode,
      name:      fName.trim(),
      dpi:       fDpi.trim()  || '',
      nit:       (fNit.trim().toUpperCase()) || 'CF',
      phone:     fTel.trim()  || '',
      address:   fAddr.trim() || '',
      email:     fEmail.trim() || '',
      active:    true,
      createdAt: editCli ? editCli.createdAt : new Date().toISOString(),
      createdBy: editCli ? editCli.createdBy : { userId: session.userId, name: session.name, role: session.role },
    };
    saveClient(obj, !!editCli);
    showFlash(editCli ? '✓ Cliente actualizado' : '✓ Cliente registrado — ' + cliCode, 'ok');
    resetForm();
  }

  // Abre el formulario pre-rellenado para editar un cliente
  function startEdit(c) {
    setEditCli(c);
    setFName(c.name);
    setFDpi(c.dpi || '');
    setFNit(c.nit && c.nit !== 'CF' ? c.nit : '');
    setFTel(c.phone || '');
    setFAddr(c.address || '');
    setFEmail(c.email || '');
    setFErr('');
    setShowForm(true);
  }

  // ── Vista perfil 360° ──
  if (selCli) {
    var cli = clients.find(function(c) { return c.id === selCli; });
    if (!cli) { setSelCli(null); return null; }

    var cliSales    = sales.filter(function(s)    { return s.clientId === cli.id || (sameName(s.client, cli.name) && !s.clientId); });
    var cliAccs     = accounts.filter(function(a) { return a.clientId === cli.id || (sameName(a.client, cli.name) && !a.clientId); });
    var cliRets     = returns.filter(function(r)  { return r.clientId === cli.id || (sameName(r.client, cli.name) && !r.clientId); });
    var totalComprado  = cliSales.reduce(function(s, x) { return s + x.total; }, 0);
    var totalPendiente = cliAccs.filter(function(a) { return a.status !== 'pagado'; }).reduce(function(s, a) { return s + a.balance; }, 0);
    var esFrecuente    = cliSales.length >= 5 || totalComprado >= 1000;
    var ultimaVisita   = cliSales.length > 0 ? cliSales.slice().sort(function(a, b) { return new Date(b.date) - new Date(a.date); })[0].date : null;

    return (
      <div>
        <button style={Object.assign({}, mkBtn('gray'), { marginBottom: 16 })} onClick={function() { setSelCli(null); }}>← Volver</button>

        {/* Encabezado del perfil */}
        <div style={Object.assign({}, sCard, { marginBottom: 16 })}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <p style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{cli.name}</p>
                {esFrecuente && <span style={mkBadge('amber')}>⭐ Cliente frecuente</span>}
                {totalPendiente > 0 && <span style={mkBadge('red')}>⚠ Deuda: {Q(totalPendiente)}</span>}
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#666', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace', background: '#f5f4f0', padding: '2px 8px', borderRadius: 6, fontWeight: 600, color: TEAL }}>{cli.cliCode}</span>
                <span>🧾 NIT: <b>{cli.nit || 'CF'}</b></span>
                {cli.dpi   && <span>🪪 DPI: {cli.dpi}</span>}
                {cli.phone && <span>📱 {cli.phone}</span>}
                {cli.email && <span>✉️ {cli.email}</span>}
                {cli.address && <span>📍 {cli.address}</span>}
              </div>
            </div>
            <button style={Object.assign({}, mkBtn('blue'), { padding: '6px 12px', fontSize: 12 })} onClick={function() { startEdit(cli); setSelCli(null); }}>✏ Editar</button>
          </div>

          {/* KPIs del cliente */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <MetricBox label="Total compras"   value={cliSales.length}   color={TEAL}     />
            <MetricBox label="Total comprado"  value={Q(totalComprado)}  color="#378ADD"  />
            <MetricBox label="Deuda pendiente" value={Q(totalPendiente)} color={totalPendiente > 0 ? '#E24B4A' : TEAL} />
            <MetricBox label="Devoluciones"    value={cliRets.length}    color="#7F77DD"  />
          </div>
          {ultimaVisita && (
            <p style={{ fontSize: 12, color: '#999', margin: '12px 0 0' }}>
              Última visita: {fmtD(ultimaVisita)} — Registrado: {fmtD(cli.createdAt)}
            </p>
          )}
        </div>

        {/* Cuentas pendientes */}
        {cliAccs.filter(function(a) { return a.status !== 'pagado'; }).length > 0 && (
          <div style={Object.assign({}, sCard, { marginBottom: 16, borderLeft: '4px solid #E24B4A' })}>
            <p style={{ fontWeight: 600, margin: '0 0 10px', fontSize: 14, color: '#E24B4A' }}>⚠ Cuentas pendientes</p>
            {cliAccs.filter(function(a) { return a.status !== 'pagado'; }).map(function(a) {
              return (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,0.05)', fontSize: 14 }}>
                  <span>{fmtD(a.date)} — {(a.items || []).length} artículos</span>
                  <span style={{ fontWeight: 700, color: '#E24B4A' }}>{Q(a.balance)}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Historial de compras */}
        {cliSales.length > 0 && (
          <div style={Object.assign({}, sCard, { marginBottom: 16 })}>
            <p style={{ fontWeight: 600, margin: '0 0 12px', fontSize: 15 }}>🛒 Historial de compras</p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Fecha', 'Artículos', 'Método', 'Total', 'Estado'].map(function(h) { return <th key={h} style={sTH}>{h}</th>; })}</tr>
              </thead>
              <tbody>
                {cliSales.slice(0, 10).map(function(s) {
                  // Una venta a crédito (status 'cuenta') no es "Cobrada": su estado real lo da la cuenta por cobrar.
                  var esCredito = s.payType === 'credito' || s.payType === 'parcial' || s.status === 'cuenta';
                  var esParcial = s.payType === 'parcial';
                  var metodoLabel = esParcial ? 'Crédito parcial' : (esCredito ? 'A crédito' : s.method);
                  var acc = esCredito ? cliAccs.find(function(a) { return a.sale_id === s.id; }) : null;
                  var estadoBadge = !esCredito
                    ? <span style={mkBadge('green')}>✓ Cobrada</span>
                    : (acc && acc.status === 'pagado'
                        ? <span style={mkBadge('green')}>✓ Pagada</span>
                        : <span style={mkBadge('amber')}>⏳ Pendiente</span>);
                  return (
                    <tr key={s.id}>
                      <td style={sTD}>{fmtD(s.date)}</td>
                      <td style={Object.assign({}, sTD, { color: '#666' })}>{(s.items || []).length} art.</td>
                      <td style={sTD}><span style={mkBadge(esCredito ? 'amber' : 'teal')}>{metodoLabel}</span></td>
                      <td style={Object.assign({}, sTD, { fontWeight: 700, color: TEAL })}>{Q(s.total)}</td>
                      <td style={sTD}>{estadoBadge}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Historial de devoluciones */}
        {cliRets.length > 0 && (
          <div style={sCard}>
            <p style={{ fontWeight: 600, margin: '0 0 12px', fontSize: 15 }}>🔄 Devoluciones</p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Fecha', 'Motivo', 'Estado artículo', 'Reembolso'].map(function(h) { return <th key={h} style={sTH}>{h}</th>; })}</tr>
              </thead>
              <tbody>
                {cliRets.map(function(r) {
                  return (
                    <tr key={r.id}>
                      <td style={sTD}>{fmtD(r.date)}</td>
                      <td style={sTD}>{r.reason}</td>
                      <td style={sTD}><span style={mkBadge(r.itemCondition === 'bueno' ? 'green' : 'amber')}>{r.itemCondition === 'bueno' ? 'Buen estado' : 'Defectuoso'}</span></td>
                      <td style={Object.assign({}, sTD, { fontWeight: 600, color: r.refundAmount > 0 ? '#E24B4A' : '#999' })}>
                        {r.refundAmount > 0 ? Q(r.refundAmount) : 'Sin reembolso'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {cliSales.length === 0 && cliAccs.length === 0 && cliRets.length === 0 && (
          <div style={Object.assign({}, sCard, { textAlign: 'center', padding: 48, color: '#999' })}>
            Sin transacciones registradas aún para este cliente.
          </div>
        )}
      </div>
    );
  }

  // KPIs globales
  var totalClientes = clients.length;
  var conDeuda = clients.filter(function(c) {
    return accounts.filter(function(a) {
      return (a.clientId === c.id || (sameName(a.client, c.name) && !a.clientId)) && a.status !== 'pagado';
    }).length > 0;
  }).length;
  var frecuentes = clients.filter(function(c) {
    var cs = sales.filter(function(s) { return s.clientId === c.id || (sameName(s.client, c.name) && !s.clientId); });
    return cs.length >= 5 || cs.reduce(function(s, x) { return s + x.total; }, 0) >= 1000;
  }).length;

  // ── Vista lista ──
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <p style={H1}>
          👥 Clientes
          <HelpTip text={'Base de datos de clientes del negocio.\n\nCada cliente puede tener nombre, teléfono, NIT y dirección. El teléfono se usa para enviar comprobantes y recordatorios de cobro por WhatsApp automáticamente.\n\nDesde aquí podés ver el historial de compras de cada cliente.'} />
        </p>
        <button style={mkBtn('teal')} onClick={function() { resetForm(); setShowForm(true); }}>+ Nuevo cliente</button>
      </div>

      {/* Formulario de nuevo/editar cliente */}
      {showForm && (
        <div style={Object.assign({}, sCard, { marginBottom: 16, borderColor: TEAL, borderWidth: '1.5px' })}>
          <p style={{ fontWeight: 600, margin: '0 0 14px', fontSize: 15 }}>{editCli ? '✏️ Editar cliente' : '➕ Nuevo cliente'}</p>
          {fErr && <div style={{ background: '#FCEBEB', borderRadius: 8, padding: '8px 14px', marginBottom: 12, color: '#791F1F', fontSize: 13 }}>⚠ {fErr}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={sLabel}>Nombre completo *</label>
              <input style={sInput} value={fName} placeholder="Nombre del cliente" onChange={function(e) { setFErr(''); setFName(e.target.value); }} />
            </div>
            <div>
              <label style={sLabel}>NIT (para factura) <span style={{ color: '#888', fontWeight: 400 }}>— sin NIT escribe CF</span></label>
              <input style={sInput} value={fNit} placeholder="CF o ej: 1234567-8" onChange={function(e) { setFNit(e.target.value.toUpperCase()); }} />
              {fNit && fNit !== 'CF' && <p style={{ fontSize: 11, color: '#666', margin: '3px 0 0' }}>Se guardará como: {fNit.trim().toUpperCase() || 'CF'}</p>}
            </div>
            <div>
              <label style={sLabel}>DPI (13 dígitos, opcional)</label>
              <input style={sInput} value={fDpi} placeholder="Solo si lo tiene" maxLength={13} onChange={function(e) { setFErr(''); setFDpi(e.target.value.replace(/\D/g, '')); }} />
              {fDpi && !validarDPI(fDpi) && <p style={{ fontSize: 11, color: '#E24B4A', margin: '3px 0 0' }}>⚠ Debe tener 13 dígitos ({fDpi.length}/13)</p>}
              {fDpi && validarDPI(fDpi) && fDpi.length === 13 && <p style={{ fontSize: 11, color: TEAL, margin: '3px 0 0' }}>✓ DPI válido</p>}
            </div>
            <div>
              <label style={sLabel}>Teléfono</label>
              <input style={sInput} value={fTel} placeholder="Ej: 55551234" onChange={function(e) { setFTel(e.target.value); }} />
            </div>
            <div>
              <label style={sLabel}>Dirección</label>
              <input style={sInput} value={fAddr} placeholder="Opcional" onChange={function(e) { setFAddr(e.target.value); }} />
            </div>
            <div>
              <label style={sLabel}>Correo electrónico</label>
              <input type="email" style={sInput} value={fEmail} placeholder="Para enviar facturas (opcional)" onChange={function(e) { setFEmail(e.target.value); }} />
            </div>
          </div>

          {!editCli && (
            <div style={{ background: '#f5f4f0', borderRadius: 8, padding: '8px 14px', marginBottom: 14, fontSize: 12, color: '#666' }}>
              💡 Si el cliente no tiene DPI, se le asignará un código único automático (CLI-000001, CLI-000002…)
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={mkBtn('teal')} onClick={doSave}>{editCli ? 'Guardar cambios' : 'Registrar cliente'}</button>
            <button style={mkBtn('gray')} onClick={resetForm}>Cancelar</button>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        <MetricBox label="Total clientes"      value={totalClientes} color={TEAL}      />
        <MetricBox label="Con deuda activa"    value={conDeuda}      color="#E24B4A"   />
        <MetricBox label="Clientes frecuentes" value={frecuentes}    color="#E65100"   />
      </div>

      {/* Buscador */}
      <div style={Object.assign({}, sCard, { marginBottom: 14 })}>
        <input style={sInput} value={q} placeholder="🔍 Buscar por nombre, NIT, DPI, código CLI o teléfono..." onChange={function(e) { setQ(e.target.value); }} />
      </div>

      {/* Tabla de clientes */}
      <div style={sCard}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>
            {q ? 'Sin resultados para "' + q + '"' : 'Sin clientes registrados aún'}
          </div>
        ) : (
          <div className="tbl-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['#', 'Código', 'Nombre', 'NIT', 'Teléfono', 'Compras', 'Deuda', ''].map(function(h) {
                    return <th key={h} style={h === '#' ? Object.assign({}, sTH, { width: 40, textAlign: 'center' }) : sTH}>{h}</th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {cliPag.paged.map(function(c, index) {
                  var cliSalesArr = sales.filter(function(s) { return s.clientId === c.id || (sameName(s.client, c.name) && !s.clientId); });
                  var cliDeuda    = accounts.filter(function(a) { return (a.clientId === c.id || (sameName(a.client, c.name) && !a.clientId)) && a.status !== 'pagado'; }).reduce(function(s, a) { return s + a.balance; }, 0);
                  var esFrecuente = cliSalesArr.length >= 5 || cliSalesArr.reduce(function(s, x) { return s + x.total; }, 0) >= 1000;
                  return (
                    <tr key={c.id} style={{ cursor: 'pointer' }} onClick={function() { setSelCli(c.id); }}>
                      <td style={Object.assign({}, sTD, { textAlign: 'center', color: '#999', fontSize: 12 })}>{cliPag.offset + index + 1}</td>
                      <td style={Object.assign({}, sTD, { fontFamily: 'monospace', fontSize: 12, color: TEAL, fontWeight: 600 })}>{c.cliCode}</td>
                      <td style={Object.assign({}, sTD, { fontWeight: 600 })}>
                        {c.name}
                        {esFrecuente && <span style={Object.assign({}, mkBadge('amber'), { marginLeft: 6 })}>⭐</span>}
                      </td>
                      <td style={Object.assign({}, sTD, { fontFamily: 'monospace', fontSize: 12 })}>{c.nit || <span style={{ color: '#bbb' }}>CF</span>}</td>
                      <td style={Object.assign({}, sTD, { color: '#666' })}>{c.phone || '—'}</td>
                      <td style={sTD}>{cliSalesArr.length} compras</td>
                      <td style={sTD}>{cliDeuda > 0 ? <span style={mkBadge('red')}>{Q(cliDeuda)}</span> : <span style={mkBadge('green')}>✓ Al día</span>}</td>
                      <td style={Object.assign({}, sTD, { color: '#999', fontSize: 12 })}>Ver →</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > 0 && React.createElement(cliPag.Pager)}
      </div>
    </div>
  );
}
