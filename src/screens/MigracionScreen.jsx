// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA: MigracionScreen — "📒 Pasar mi cuaderno" (solo admin, módulo temporal)
//
// Carga las DEUDAS HISTÓRICAS del cuaderno de papel como saldo inicial.
// Reglas de negocio (ver docs/MIGRACION-CUADERNO.md en el repo del API):
//   - NO son ventas nuevas: no tocan stock, ni caja, ni IVA, ni ventas del día.
//   - Cada carga es un LOTE reversible (botón Deshacer borra el lote completo).
//   - Los abonos futuros a estas deudas SÍ entran a caja por el flujo normal.
//
// Dos caminos: agregar deudas una por una (formulario) o importar un Excel
// (plantilla descargable). SIEMPRE hay previsualización antes de confirmar.
// ══════════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { migrationAPI } from '../utils/api.js';
import { Q, fmtD } from '../utils/formatters.js';
import { TEAL, sCard, sInput, sLabel, sTH, sTD, H1, mkBtn, mkBadge } from '../styles/theme.js';

var EMPTY = { client: '', phone: '', total: '', paid: '', date: '', note: '' };

// Valida una fila y devuelve {ok, error} — mismo criterio que el servidor.
function validaFila(r) {
  var total = Number(r.total), paid = Number(r.paid) || 0;
  if (!String(r.client || '').trim()) return { ok: false, error: 'Falta el nombre del cliente' };
  if (!isFinite(total) || total <= 0) return { ok: false, error: 'El total debe ser mayor que 0' };
  if (paid < 0) return { ok: false, error: 'Lo abonado no puede ser negativo' };
  if (paid > total) return { ok: false, error: 'Lo abonado no puede ser mayor que el total' };
  return { ok: true };
}

export default function MigracionScreen(props) {
  var onChanged = props.onChanged || function () {};
  var showFlash = props.showFlash || function () {};
  var clients = props.clients || [];

  var [staged, setStaged] = useState([]);       // filas listas para previsualizar
  var [omitidas, setOmitidas] = useState([]);   // filas del Excel que se saltaron (con motivo)
  var [form, setForm] = useState(EMPTY);
  var [batches, setBatches] = useState([]);
  var [busy, setBusy] = useState(false);
  var [showDrop, setShowDrop] = useState(false); // buscador de clientes (mismo patrón del POS)
  var fileRef = useRef(null);

  // Coincidencia por nombre normalizado — mismo criterio que usa el servidor para enlazar.
  function normName(n) { return String(n || '').trim().toLowerCase().replace(/\s+/g, ' '); }
  function findCliente(name) {
    var k = normName(name);
    return k ? clients.find(function (c) { return normName(c.name) === k; }) : null;
  }
  var cliQ = form.client;
  var cliResults = cliQ.trim().length > 0 ? clients.filter(function (c) {
    var q = normName(cliQ);
    return normName(c.name).includes(q) || String(c.cliCode || '').toLowerCase().includes(q) || String(c.phone || '').includes(cliQ.trim());
  }).slice(0, 8) : [];
  var cliMatch = findCliente(form.client);

  function loadBatches() {
    migrationAPI.batches().then(function (b) { setBatches(b || []); }).catch(function () {});
  }
  useEffect(loadBatches, []);

  function setF(k) { return function (e) { var v = e.target.value; setForm(function (f) { var n = Object.assign({}, f); n[k] = v; return n; }); }; }

  function addManual() {
    var v = validaFila(form);
    if (!v.ok) { showFlash('⛔ ' + v.error, 'err'); return; }
    setStaged(staged.concat([Object.assign({}, form)]));
    setForm(EMPTY);
  }

  function quitar(idx) { setStaged(staged.filter(function (_, i) { return i !== idx; })); }

  // ── Plantilla e importación Excel ──
  function descargarPlantilla() {
    var ws = XLSX.utils.aoa_to_sheet([
      ['Cliente', 'Telefono', 'Total', 'Ya abono', 'Desde (AAAA-MM-DD)', 'Nota / Que llevo'],
      ['Juan Pérez', '5555-5555', 350, 100, '2026-03-15', 'Pantalla Samsung A32'],
    ]);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Deudas');
    XLSX.writeFile(wb, 'plantilla_deudas_cuaderno.xlsx');
  }

  function importarExcel(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var wb = XLSX.read(ev.target.result, { type: 'array' });
        var rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false });
        var nuevas = [], malas = [];
        for (var i = 1; i < rows.length; i++) { // fila 0 = encabezados
          var r = rows[i] || [];
          if (!r.length || r.every(function (c) { return c == null || String(c).trim() === ''; })) continue;
          var fila = { client: String(r[0] || '').trim(), phone: String(r[1] || '').trim(), total: String(r[2] || '').replace(/[Qq,\s]/g, ''), paid: String(r[3] || '0').replace(/[Qq,\s]/g, '') || '0', date: String(r[4] || '').trim(), note: String(r[5] || '').trim() };
          var v = validaFila(fila);
          if (v.ok) nuevas.push(fila); else malas.push({ fila: i + 1, cliente: fila.client || '(sin nombre)', motivo: v.error });
        }
        setStaged(staged.concat(nuevas));
        setOmitidas(malas);
        showFlash(nuevas.length ? '✓ ' + nuevas.length + ' deuda(s) leídas del Excel' + (malas.length ? ' — ' + malas.length + ' omitida(s)' : '') : '⛔ No se pudo leer ninguna fila válida', nuevas.length ? 'ok' : 'err');
      } catch (_err) {
        showFlash('⛔ No se pudo leer el archivo. Usá la plantilla descargable.', 'err');
      }
      if (fileRef.current) fileRef.current.value = '';
    };
    reader.readAsArrayBuffer(file);
  }

  // ── Confirmar carga (previsualización → servidor) ──
  var totalDeuda = staged.reduce(function (s, r) { return s + Math.max(0, Number(r.total) - (Number(r.paid) || 0)); }, 0);

  async function confirmar() {
    if (!staged.length || busy) return;
    if (!window.confirm('Vas a cargar ' + staged.length + ' deuda(s) del cuaderno por ' + Q(totalDeuda) + ' de saldo pendiente.\n\nEsto NO toca caja, inventario ni ventas — solo crea las cuentas por cobrar. Se puede deshacer completo.\n\n¿Confirmar?')) return;
    setBusy(true);
    try {
      var debts = staged.map(function (r) {
        return { client: r.client.trim(), phone: r.phone || undefined, total: Number(r.total), paid: Number(r.paid) || 0, date: r.date || undefined, note: r.note || undefined };
      });
      var res = await migrationAPI.loadDebts(debts);
      showFlash('✓ Cargadas ' + res.created + ' deuda(s) — saldo ' + Q(res.totalDebt) + (res.clientsCreated ? ' · ' + res.clientsCreated + ' cliente(s) nuevos creados' : '') + '. Ya aparecen en Cuentas.', 'ok');
      setStaged([]); setOmitidas([]);
      loadBatches();
      onChanged();
    } catch (err) {
      showFlash('⛔ ' + ((err && err.error) || 'Error al cargar. No se guardó nada.'), 'err');
    }
    setBusy(false);
  }

  async function deshacer(b) {
    if (busy) return;
    if (!window.confirm('¿Deshacer la carga del ' + fmtD(b.migratedAt) + ' (' + b.count + ' deuda(s), ' + Q(b.totalDebt) + ')?\n\nSe borran SOLO las cuentas de ese lote (marcadas "del cuaderno"). Nada más se toca.')) return;
    setBusy(true);
    try {
      var res = await migrationAPI.undoBatch(b.batchId);
      showFlash('✓ Carga deshecha — ' + res.deleted + ' cuenta(s) eliminadas.', 'ok');
      loadBatches();
      onChanged();
    } catch (err) {
      showFlash('⛔ ' + ((err && err.error) || 'No se pudo deshacer.'), 'err');
    }
    setBusy(false);
  }

  return (
    <div className="screen-enter">
      <h1 style={H1}>📒 Pasar mi cuaderno</h1>
      <p style={{ color: 'var(--tx2)', marginTop: -6, fontSize: 13 }}>
        Cargá las deudas viejas del cuaderno como <b>saldo inicial</b>. No tocan caja, inventario ni ventas del día —
        solo aparecen en <b>Cuentas por Cobrar</b> con la etiqueta 📒 y <b>enlazadas al cliente</b> (si no existe, se crea solo). Cada carga se puede <b>deshacer completa</b>.
      </p>

      {/* ── Paso 1: agregar deudas ── */}
      <div style={Object.assign({}, sCard, { marginBottom: 14 })}>
        <h3 style={{ margin: '0 0 10px' }}>1️⃣ Agregar deudas</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ position: 'relative', minWidth: 220 }}>
            <label style={sLabel}>Cliente *</label>
            <input style={sInput} value={form.client} onChange={function (e) { setF('client')(e); setShowDrop(true); }}
              onFocus={function () { setShowDrop(true); }} onBlur={function () { setTimeout(function () { setShowDrop(false); }, 200); }}
              placeholder="Buscar cliente o escribir uno nuevo..." />
            {showDrop && cliQ.trim().length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 100, maxHeight: 200, overflowY: 'auto', marginTop: 2 }}>
                {cliResults.map(function (c) {
                  return (
                    <div key={c.id} onMouseDown={function () { setForm(function (f) { return Object.assign({}, f, { client: c.name, phone: c.phone || f.phone }); }); setShowDrop(false); }}
                      style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: '#999', fontFamily: 'monospace' }}>{c.cliCode}{c.phone ? ' · ' + c.phone : ''}</div>
                    </div>
                  );
                })}
                {cliResults.length === 0 && (
                  <div style={{ padding: '9px 12px', fontSize: 12, color: '#999' }}>No existe "{cliQ}" — se creará como cliente nuevo 🆕</div>
                )}
              </div>
            )}
            {cliQ.trim().length > 0 && (
              <div style={{ fontSize: 11, marginTop: 3, color: cliMatch ? '#0F6E56' : '#8a6d1a' }}>
                {cliMatch ? '✓ Cliente existente (' + (cliMatch.cliCode || 'ficha') + ') — la deuda irá a su perfil' : '🆕 Cliente nuevo — se creará al cargar'}
              </div>
            )}
          </div>
          <div><label style={sLabel}>Teléfono</label><input style={Object.assign({}, sInput, { width: 110 })} value={form.phone} onChange={setF('phone')} placeholder="5555-5555" /></div>
          <div><label style={sLabel}>Total Q *</label><input style={Object.assign({}, sInput, { width: 90 })} type="number" min="0" value={form.total} onChange={setF('total')} placeholder="0.00" /></div>
          <div><label style={sLabel}>Ya abonó Q</label><input style={Object.assign({}, sInput, { width: 90 })} type="number" min="0" value={form.paid} onChange={setF('paid')} placeholder="0.00" /></div>
          <div><label style={sLabel}>Desde</label><input style={Object.assign({}, sInput, { width: 140 })} type="date" value={form.date} onChange={setF('date')} /></div>
          <div style={{ flex: 1, minWidth: 160 }}><label style={sLabel}>Nota / Qué llevó</label><input style={sInput} value={form.note} onChange={setF('note')} placeholder="Ej: Pantalla Samsung A32" /></div>
          <button style={mkBtn('teal')} onClick={addManual}>+ Agregar</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button style={mkBtn('blue')} onClick={function () { fileRef.current && fileRef.current.click(); }}>📥 Importar Excel</button>
          <button style={mkBtn('gray')} onClick={descargarPlantilla}>📄 Descargar plantilla</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={importarExcel} />
        </div>
        {omitidas.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#c0392b' }}>
            ⚠️ Filas omitidas del Excel: {omitidas.map(function (o) { return 'fila ' + o.fila + ' (' + o.cliente + '): ' + o.motivo; }).join(' · ')}
          </div>
        )}
      </div>

      {/* ── Paso 2: previsualización obligatoria ── */}
      {staged.length > 0 && (
        <div style={Object.assign({}, sCard, { marginBottom: 14, border: '2px solid ' + TEAL })}>
          <h3 style={{ margin: '0 0 10px' }}>2️⃣ Revisar antes de cargar</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={sTH}>Cliente</th><th style={sTH}>Ficha</th><th style={sTH}>Teléfono</th><th style={sTH}>Total</th><th style={sTH}>Ya abonó</th><th style={sTH}>Saldo</th><th style={sTH}>Desde</th><th style={sTH}>Nota</th><th style={sTH}></th>
              </tr></thead>
              <tbody>
                {staged.map(function (r, i) {
                  var saldo = Math.max(0, Number(r.total) - (Number(r.paid) || 0));
                  return (
                    <tr key={i}>
                      <td style={sTD}>{r.client}</td>
                      <td style={sTD}>{findCliente(r.client) ? <span style={mkBadge('green')}>✓ existente</span> : <span style={mkBadge('amber')}>🆕 nuevo</span>}</td>
                      <td style={sTD}>{r.phone || '—'}</td>
                      <td style={sTD}>{Q(Number(r.total))}</td>
                      <td style={sTD}>{Q(Number(r.paid) || 0)}</td>
                      <td style={Object.assign({}, sTD, { fontWeight: 700 })}>{Q(saldo)}</td>
                      <td style={sTD}>{r.date || '—'}</td>
                      <td style={sTD}>{r.note || '—'}</td>
                      <td style={sTD}><button style={mkBtn('red')} onClick={function () { quitar(i); }}>✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700 }}>Vas a cargar {staged.length} deuda(s) · saldo pendiente total {Q(totalDeuda)}</span>
            <button style={mkBtn('teal')} disabled={busy} onClick={confirmar}>{busy ? 'Cargando…' : '✅ Confirmar carga'}</button>
            <button style={mkBtn('gray')} disabled={busy} onClick={function () { setStaged([]); setOmitidas([]); }}>Vaciar</button>
          </div>
        </div>
      )}

      {/* ── Cargas hechas (deshacer) ── */}
      <div style={sCard}>
        <h3 style={{ margin: '0 0 10px' }}>🗂️ Cargas hechas</h3>
        {batches.length === 0 ? (
          <p style={{ color: 'var(--tx2)', fontSize: 13 }}>Todavía no hay cargas del cuaderno.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={sTH}>Fecha</th><th style={sTH}>Deudas</th><th style={sTH}>Saldo pendiente</th><th style={sTH}></th></tr></thead>
              <tbody>
                {batches.map(function (b) {
                  return (
                    <tr key={b.batchId}>
                      <td style={sTD}>{fmtD(b.migratedAt)} <span style={mkBadge('purple')}>📒 del cuaderno</span></td>
                      <td style={sTD}>{b.count}</td>
                      <td style={sTD}>{Q(b.totalDebt)}</td>
                      <td style={sTD}><button style={mkBtn('red')} disabled={busy} onClick={function () { deshacer(b); }}>↩️ Deshacer</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
