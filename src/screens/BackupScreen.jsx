import React, { useState, useEffect, useCallback } from 'react';
import { TEAL, NAVY, sCard, sTH, sTD, mkBtn, mkBadge, H1 } from '../styles/theme.js';
import { fmtD, fmtT } from '../utils/formatters.js';
import { exportExcel } from '../utils/export.js';
import { backupAPI } from '../utils/api.js';

var PAGE_SIZE = 20;

function fmtSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(2) + ' MB';
}

function hoursAgo(isoStr) {
  if (!isoStr) return null;
  return Math.round((Date.now() - new Date(isoStr).getTime()) / 3600000);
}

function healthColor(hours) {
  if (hours === null) return '#ccc';
  if (hours <= 26) return '#22c55e';
  if (hours <= 50) return '#f59e0b';
  return '#ef4444';
}

function StatusBadge({ status }) {
  var colorMap  = { success: 'green', pending: 'amber', failed: 'red' };
  var labelMap  = { success: 'Exitoso', pending: 'Pendiente', failed: 'Fallido' };
  return <span style={mkBadge(colorMap[status] || 'gray')}>{labelMap[status] || status}</span>;
}

function TypeBadge({ type }) {
  var colorMap = { manual: 'blue', auto: 'teal' };
  var labelMap = { manual: 'Manual', auto: 'Automático' };
  return <span style={mkBadge(colorMap[type] || 'gray')}>{labelMap[type] || type}</span>;
}

export default function BackupScreen() {
  var _health   = useState(null);  var health   = _health[0];   var setHealth   = _health[1];
  var _backups  = useState([]);    var backups  = _backups[0];  var setBackups  = _backups[1];
  var _loading  = useState(true);  var loading  = _loading[0];  var setLoading  = _loading[1];
  var _creating = useState(false); var creating = _creating[0]; var setCreating = _creating[1];
  var _exporting= useState(false); var exporting= _exporting[0];var setExporting= _exporting[1];
  var _msg      = useState(null);  var msg      = _msg[0];      var setMsg      = _msg[1];
  var _page     = useState(0);     var page     = _page[0];     var setPage     = _page[1];
  var _dlBusy   = useState({});    var dlBusy   = _dlBusy[0];  var setDlBusy   = _dlBusy[1];

  var load = useCallback(async function() {
    setLoading(true);
    try {
      var results = await Promise.allSettled([backupAPI.health(), backupAPI.list()]);
      if (results[0].status === 'fulfilled') setHealth(results[0].value);
      if (results[1].status === 'fulfilled') setBackups((results[1].value && results[1].value.backups) || []);
    } catch (e) {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(function() { load(); }, [load]);

  function showMsg(text, type) {
    setMsg({ text: text, type: type || 'ok' });
    setTimeout(function() { setMsg(null); }, 5000);
  }

  async function handleCreate() {
    setCreating(true);
    try {
      await backupAPI.create();
      showMsg('Backup creado exitosamente', 'ok');
      load();
    } catch (err) {
      showMsg(err && err.error ? err.error : 'Error al crear backup', 'error');
    } finally {
      setCreating(false);
    }
  }

  async function handleDownload(backup) {
    setDlBusy(function(prev) { return Object.assign({}, prev, { [backup.id]: true }); });
    try {
      var res = await backupAPI.download(backup.id);
      if (res && res.url) {
        window.open(res.url, '_blank', 'noopener');
      } else {
        showMsg('No se pudo obtener el enlace de descarga', 'error');
      }
    } catch (err) {
      showMsg(err && err.error ? err.error : 'Error al descargar', 'error');
    } finally {
      setDlBusy(function(prev) { return Object.assign({}, prev, { [backup.id]: false }); });
    }
  }

  // Crea un backup y descarga el JSON resultante
  async function handleExportJSON() {
    setExporting(true);
    try {
      var created = await backupAPI.create();
      var backupId = created && (created.id || (created.backup && created.backup.id));
      if (!backupId) throw new Error('No se obtuvo ID del backup');
      var res = await backupAPI.download(backupId);
      if (res && res.url) {
        window.open(res.url, '_blank', 'noopener');
        showMsg('JSON descargado exitosamente', 'ok');
        load();
      } else {
        showMsg('Backup creado pero no se pudo obtener el enlace', 'error');
      }
    } catch (err) {
      showMsg(err && err.error ? err.error : 'Error al exportar JSON', 'error');
    } finally {
      setExporting(false);
    }
  }

  // Exporta el historial de backups a Excel
  function handleExportExcel() {
    var cols = ['Fecha', 'Hora', 'Tipo', 'Estado', 'Tamaño', 'Registros totales'];
    var rows = backups.map(function(b) {
      var total = 0;
      if (b.record_counts) Object.values(b.record_counts).forEach(function(n) { total += (n || 0); });
      return [
        fmtD(new Date(b.created_at)),
        fmtT(new Date(b.created_at)),
        b.type === 'auto' ? 'Automático' : 'Manual',
        b.status === 'success' ? 'Exitoso' : b.status === 'failed' ? 'Fallido' : 'Pendiente',
        fmtSize(b.size_bytes),
        total || '—',
      ];
    });
    exportExcel(rows, cols, 'historial-backups-' + new Date().toISOString().slice(0, 10));
  }

  function showError(errMsg) {
    alert('Error del backup:\n\n' + (errMsg || 'Sin detalle disponible'));
  }

  // Paginación
  var totalPages = Math.ceil(backups.length / PAGE_SIZE);
  var pageBackups = backups.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Estado de salud
  var lastSuccess      = health && health.last_success;
  var lastSuccessHours = lastSuccess ? hoursAgo(lastSuccess.created_at) : null;
  var dotColor         = healthColor(lastSuccessHours);
  var healthLabel      = lastSuccess
    ? (lastSuccessHours === 0 ? 'Hace menos de 1 hora' : 'Hace ' + lastSuccessHours + ' hora' + (lastSuccessHours === 1 ? '' : 's'))
    : 'Sin backups exitosos registrados';

  return (
    <div>
      <p style={H1}>Respaldo de datos</p>

      {msg && (
        <div style={{
          background: msg.type === 'ok' ? '#EAF3DE' : '#FCEBEB',
          border: '1px solid ' + (msg.type === 'ok' ? '#97C459' : '#F09595'),
          color:  msg.type === 'ok' ? '#27500A' : '#791F1F',
          borderRadius: 9, padding: '10px 16px', marginBottom: 16, fontSize: 14, fontWeight: 500,
        }}>
          {msg.text}
        </div>
      )}

      {/* Health card + acciones */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24, alignItems: 'stretch' }}>

        {/* Health card */}
        <div style={Object.assign({}, sCard, { flex: '1 1 300px' })}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Estado de backups
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{
              width: 12, height: 12, borderRadius: '50%',
              background: loading ? '#ccc' : dotColor,
              flexShrink: 0,
              boxShadow: '0 0 0 3px ' + (loading ? '#eee' : dotColor) + '33',
            }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
              {loading ? 'Cargando…' : ('Último backup exitoso: ' + healthLabel)}
            </span>
          </div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            Próximo backup automático: <b>Hoy a las 2:00 AM</b> (hora Guatemala)
          </div>
          {lastSuccess && (
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
              Tamaño: {fmtSize(lastSuccess.size_bytes)}
            </div>
          )}
        </div>

        {/* Botones de acción */}
        <div style={Object.assign({}, sCard, { display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10, flex: '0 0 auto', minWidth: 220 })}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            Exportar datos
          </div>
          <button
            style={Object.assign({}, mkBtn('teal'), { fontSize: 13, opacity: creating ? 0.7 : 1, cursor: creating ? 'not-allowed' : 'pointer' })}
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? 'Creando backup…' : '💾 Crear backup ahora'}
          </button>
          <button
            style={Object.assign({}, mkBtn('blue'), { fontSize: 13, opacity: exporting ? 0.7 : 1, cursor: exporting ? 'not-allowed' : 'pointer' })}
            onClick={handleExportJSON}
            disabled={exporting}
          >
            {exporting ? 'Generando JSON…' : '⬇ Descargar JSON completo'}
          </button>
          <button
            style={Object.assign({}, mkBtn('gray'), { fontSize: 13, opacity: backups.length === 0 ? 0.5 : 1, cursor: backups.length === 0 ? 'not-allowed' : 'pointer' })}
            onClick={handleExportExcel}
            disabled={backups.length === 0}
          >
            📊 Exportar historial (Excel)
          </button>
        </div>
      </div>

      {/* Tabla de historial */}
      <div style={Object.assign({}, sCard, { padding: 0, overflow: 'hidden' })}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: '#111827' }}>Historial de backups</span>
          <button style={Object.assign({}, mkBtn('gray'), { fontSize: 12 })} onClick={load} disabled={loading}>
            {loading ? 'Cargando…' : 'Actualizar'}
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Cargando historial…</div>
        ) : backups.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
            Sin backups registrados. Crea el primero usando el botón de arriba.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Fecha / Hora', 'Tipo', 'Tamaño', 'Registros', 'Estado', 'Acciones'].map(function(h) {
                    return <th key={h} style={sTH}>{h}</th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {pageBackups.map(function(b) {
                  var totalRecords = 0;
                  if (b.record_counts) Object.values(b.record_counts).forEach(function(n) { totalRecords += (n || 0); });
                  return (
                    <tr key={b.id}>
                      <td style={sTD}>
                        <span style={{ fontWeight: 500 }}>{fmtD(new Date(b.created_at))}</span>
                        <span style={{ color: '#9ca3af', fontSize: 12, marginLeft: 6 }}>{fmtT(new Date(b.created_at))}</span>
                      </td>
                      <td style={sTD}><TypeBadge type={b.type} /></td>
                      <td style={sTD}>{fmtSize(b.size_bytes)}</td>
                      <td style={sTD}>
                        {totalRecords > 0
                          ? <span title={b.record_counts ? JSON.stringify(b.record_counts, null, 2) : ''}>{totalRecords.toLocaleString()} registros</span>
                          : '—'}
                      </td>
                      <td style={sTD}><StatusBadge status={b.status} /></td>
                      <td style={sTD}>
                        {b.status === 'success' && b.storage_path ? (
                          <button
                            style={Object.assign({}, mkBtn('blue'), { fontSize: 12, padding: '5px 12px', opacity: dlBusy[b.id] ? 0.6 : 1, cursor: dlBusy[b.id] ? 'not-allowed' : 'pointer' })}
                            onClick={function() { handleDownload(b); }}
                            disabled={!!dlBusy[b.id]}
                          >
                            {dlBusy[b.id] ? '…' : 'Descargar'}
                          </button>
                        ) : b.status === 'failed' ? (
                          <button
                            style={{ fontSize: 12, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                            onClick={function() { showError(b.error_msg); }}
                          >
                            Ver error
                          </button>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
            <button style={Object.assign({}, mkBtn('gray'), { fontSize: 12, opacity: page === 0 ? 0.4 : 1 })} onClick={function() { setPage(function(p) { return Math.max(0, p - 1); }); }} disabled={page === 0}>Anterior</button>
            <span style={{ fontSize: 13, color: '#6b7280' }}>{page + 1} / {totalPages}</span>
            <button style={Object.assign({}, mkBtn('gray'), { fontSize: 12, opacity: page >= totalPages - 1 ? 0.4 : 1 })} onClick={function() { setPage(function(p) { return Math.min(totalPages - 1, p + 1); }); }} disabled={page >= totalPages - 1}>Siguiente</button>
          </div>
        )}
      </div>

      <div style={{ marginTop: 20, background: '#f8f9fa', borderRadius: 10, padding: '14px 18px', border: '1px solid rgba(0,0,0,0.06)' }}>
        <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
          Los backups automáticos se realizan cada día a las 2:00 AM (hora Guatemala). Se conservan los últimos 30 días.
          Cada backup incluye: clientes, productos, ventas, cuentas, reparaciones, garantías, devoluciones, proveedores, categorías, ubicaciones y configuración de tienda.
          Las contraseñas nunca se incluyen en los backups.
        </p>
      </div>
    </div>
  );
}
