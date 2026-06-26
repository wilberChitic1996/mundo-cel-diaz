// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA: BackupScreen (Respaldo y Exportación)
//
// Permite al usuario descargar una copia de seguridad de todos los datos:
//   - Excel completo (18 hojas con todo el sistema)
//   - JSON completo (para migración o auditoría externa)
//
// También muestra cuándo fue el último respaldo y alerta si hace más de 7 días.
// El sistema guarda la fecha del último respaldo en localStorage.
//
// Props:
//   products      {Array}    — lista de productos
//   sales         {Array}    — lista de ventas
//   accounts      {Array}    — cuentas por cobrar
//   returns       {Array}    — devoluciones
//   defectives    {Array}    — productos defectuosos
//   clients       {Array}    — clientes
//   repairs       {Array}    — reparaciones
//   warranties    {Array}    — garantías
//   onExportExcel {Function} — genera y descarga el archivo Excel
//   onExportJSON  {Function} — genera y descarga el archivo JSON
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { TEAL } from '../styles/theme.js';
import { fmtD, fmtT } from '../utils/formatters.js';

// Estilos reutilizables dentro de esta pantalla
var sCard = { background: '#fff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.09)', padding: '20px 24px' };
var H1    = { fontSize: 'clamp(17px,4vw,22px)', fontWeight: 600, margin: '0 0 16px', color: '#1a1a1a' };

export default function BackupScreen({
  products, sales, accounts, returns: devos, defectives,
  clients, repairs, warranties,
  onExportExcel, onExportJSON,
}) {
  products   = products   || [];
  sales      = sales      || [];
  accounts   = accounts   || [];
  devos      = devos      || [];
  defectives = defectives || [];
  clients    = clients    || [];
  repairs    = repairs    || [];
  warranties = warranties || [];

  var _m    = useState('');    var msg    = _m[0];    var setMsg    = _m[1];
  var _busy = useState(false); var busy   = _busy[0]; var setBusy   = _busy[1];

  // Verificar cuándo fue el último respaldo (guardado en localStorage)
  var lastBackupStr = null;
  try { lastBackupStr = localStorage.getItem('mnpos-last-backup'); } catch (e) {}
  var lastBackup  = lastBackupStr ? new Date(lastBackupStr) : null;
  var daysSince   = lastBackup ? Math.floor((new Date() - lastBackup) / 86400000) : null;
  var needsBackup = daysSince === null || daysSince >= 7; // Alerta si hace 7+ días

  // Mapa de estilos para el mensaje de resultado
  var msgStyles = {
    ok:    { bg: '#EAF3DE', border: '#97C459', color: '#27500A', text: '✓ Respaldo descargado correctamente' },
    error: { bg: '#FCEBEB', border: '#F09595', color: '#791F1F', text: '✗ Error al generar respaldo' },
  };
  var bm = msgStyles[msg];

  /** Descarga el respaldo en formato Excel. */
  async function doExcelFull() {
    setBusy(true);
    try { await onExportExcel(); setMsg('ok'); } catch (e) { setMsg('error'); }
    setBusy(false);
    setTimeout(function() { setMsg(''); }, 3500);
  }

  /** Descarga el respaldo en formato JSON. */
  async function doJSON() {
    setBusy(true);
    try { await onExportJSON(); setMsg('ok'); } catch (e) { setMsg('error'); }
    setBusy(false);
    setTimeout(function() { setMsg(''); }, 3500);
  }

  // Métricas de cuántos registros hay de cada tipo
  var metrics = [
    { lb: 'Productos',    val: products.length,   c: TEAL },
    { lb: 'Clientes',     val: clients.length,    c: '#378ADD' },
    { lb: 'Ventas',       val: sales.length,      c: '#7F77DD' },
    { lb: 'Reparaciones', val: repairs.length,    c: '#E65100' },
    { lb: 'Garantías',    val: warranties.length, c: '#27AE60' },
    { lb: 'Cuentas',      val: accounts.length,   c: '#8E44AD' },
    { lb: 'Devoluciones', val: devos.length,      c: '#E24B4A' },
    { lb: 'Defectuosas',  val: defectives.length, c: '#999' },
  ];

  return (
    <div>
      <p style={H1}>💾 Respaldo y Exportación</p>

      {/* Alerta cuando hace 7+ días sin respaldo */}
      {needsBackup && (
        <div style={{ background: '#FFF8E6', border: '1px solid #F5C842', borderRadius: 10, padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22 }}>⚠️</span>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#7A5000' }}>
              {lastBackup ? 'Hace ' + daysSince + ' días sin respaldo' : 'Sin respaldo registrado'}
            </p>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: '#7A5000' }}>Se recomienda respaldar al menos una vez por semana.</p>
          </div>
        </div>
      )}

      {/* Mensaje de resultado de la última operación */}
      {bm && (
        <div style={{ background: bm.bg, border: '1px solid ' + bm.border, borderRadius: 8, padding: '10px 16px', marginBottom: 16, color: bm.color, fontSize: 14, fontWeight: 500 }}>
          {bm.text}
        </div>
      )}

      {/* Contadores de registros por módulo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 12, marginBottom: 24 }}>
        {metrics.map(function(m) {
          return (
            <div key={m.lb} style={Object.assign({}, sCard, { padding: '12px 16px' })}>
              <div style={{ fontSize: 20, fontWeight: 800, color: m.c }}>{m.val}</div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{m.lb}</div>
            </div>
          );
        })}
      </div>

      {/* Fecha del último respaldo */}
      {lastBackup && (
        <div style={{ background: '#f0f9f5', borderRadius: 8, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#444' }}>
          🕐 Último respaldo: <b>{fmtD(lastBackup)}</b> a las <b>{fmtT(lastBackup)}</b>
          {daysSince === 0 && <span style={{ marginLeft: 8, color: TEAL, fontWeight: 700 }}>✓ Al día</span>}
        </div>
      )}

      {/* Opción 1: Excel completo */}
      <div style={Object.assign({}, sCard, { marginBottom: 16, borderLeft: '4px solid ' + TEAL })}>
        <p style={{ fontWeight: 700, fontSize: 15, margin: '0 0 6px' }}>📊 Exportar a Excel completo (.xls)</p>
        <p style={{ fontSize: 13, color: '#666', margin: '0 0 12px', lineHeight: 1.6 }}>
          18 hojas con todo el detalle: Resumen · Productos · Ventas · Detalle Ventas · Cuentas · Historial Pagos · Devoluciones · Clientes · Reparaciones · Garantías · Proveedores · Compras · Piezas Defectuosas. Si algún módulo no se descarga, queda marcado en la hoja Resumen.
        </p>
        <button
          style={{ padding: '11px 28px', borderRadius: 8, border: 'none', cursor: busy ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 500, background: TEAL, color: '#fff', opacity: busy ? 0.6 : 1 }}
          onClick={doExcelFull}
          disabled={busy}
        >
          {busy ? 'Generando…' : '📊 Descargar Excel'}
        </button>
      </div>

      {/* Opción 2: JSON completo */}
      <div style={Object.assign({}, sCard, { marginBottom: 16, borderLeft: '4px solid #378ADD' })}>
        <p style={{ fontWeight: 700, fontSize: 15, margin: '0 0 6px' }}>💾 Respaldo completo (.json)</p>
        <p style={{ fontSize: 13, color: '#666', margin: '0 0 12px', lineHeight: 1.6 }}>
          Archivo con todos los datos del sistema. Útil para migración o auditoría externa.
        </p>
        <button
          style={{ padding: '11px 28px', borderRadius: 8, border: 'none', cursor: busy ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 500, background: '#378ADD', color: '#fff', opacity: busy ? 0.6 : 1 }}
          onClick={doJSON}
          disabled={busy}
        >
          {busy ? 'Generando…' : '💾 Descargar .json'}
        </button>
      </div>

      {/* Nota informativa sobre cómo funciona el respaldo */}
      <div style={{ background: '#f5f4f0', borderRadius: 10, padding: '14px 18px', border: '1px solid #e0ddd7' }}>
        <p style={{ margin: 0, fontSize: 13, color: '#888', lineHeight: 1.6 }}>
          ℹ️ <b>¿Cómo funciona el respaldo?</b> Tus datos están almacenados de forma segura en la nube (Supabase). Este respaldo es una copia local para tu propio resguardo. Para restaurar datos ante un problema, contactá al administrador del sistema.
        </p>
      </div>
    </div>
  );
}
