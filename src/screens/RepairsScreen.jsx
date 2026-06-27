// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA: RepairsScreen (Órdenes de Reparación / Taller)
//
// Gestión completa del flujo de reparaciones de dispositivos móviles.
//
// Flujo de estados:
//   recibido → en_revision → listo → entregado
//
// Vistas:
//   - Lista de órdenes (con filtros por estado)
//   - Formulario nueva orden
//   - Vista detalle (stepper visual, datos del cliente, dispositivo, repuestos)
//
// Formulario de nueva orden:
//   - Búsqueda de cliente registrado con dropdown
//   - Datos del dispositivo: marca (REP_BRANDS), modelo, IMEI
//   - Problema reportado y diagnóstico técnico
//   - Técnico asignado, costo estimado, fecha de entrega prometida
//   - Selector de repuestos del inventario con buscador
//   - Nota interna (no aparece en el ticket impreso)
//
// Al registrar:
//   - Genera código REP-XXXXXX correlativo
//   - Llama saveRepair(rep) para persistir
//   - Imprime ticket vía printRepairTicket(rep)
//
// Props:
//   repairs              {Array}    — lista de órdenes de reparación
//   clients              {Array}    — clientes registrados para búsqueda
//   products             {Array}    — inventario (excluyendo servicios) para repuestos
//   saveRepair           {Function} — persiste nueva orden
//   updateRepairStatus   {Function} — (id, newStatus) actualiza estado
//   session              {Object}   — sesión activa (userId, name, role)
//   showFlash            {Function} — (msg, type) notificación flash
//   onCobrar             {Function} — llama al POS para cobrar la reparación
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { TEAL, NAVY, sCard, sInput, sLabel, sTH, sTD, mkBtn, mkBadge } from '../styles/theme.js';
import { fmtD, fmtT } from '../utils/formatters.js';
import { exportExcel, exportPDF } from '../utils/export.js';
import { usePaginator } from '../hooks/usePaginator.jsx';
import { getStore } from '../utils/receipt.js';
import { APP_NAME, STORE_FALLBACK } from '../constants/index.js';
import HelpTip from '../components/ui/HelpTip.jsx';

// ── Constantes del módulo ──────────────────────────────────────────────────

// Estados posibles de una reparación con etiqueta, color e ícono
var REP_STATUS = {
  recibido:    { label: 'Recibido',     color: 'blue',  icon: '📥' },
  en_revision: { label: 'En revisión',  color: 'amber', icon: '🔧' },
  listo:       { label: 'Listo',        color: 'teal',  icon: '✅' },
  entregado:   { label: 'Entregado',    color: 'green', icon: '📦' },
};

// Marcas más comunes de dispositivos móviles
var REP_BRANDS = ['Apple', 'Samsung', 'Xiaomi', 'Motorola', 'Huawei', 'LG', 'Sony', 'Oppo', 'Vivo', 'Nokia', 'Otro'];

// Estilo del título H1
var H1 = { fontSize: 'clamp(17px,4vw,22px)', fontWeight: 600, margin: '0 0 20px', color: 'var(--text-primary,#1a1a1a)' };

// ── Utilidades ────────────────────────────────────────────────────────────

// Genera un código correlativo REP-000001, REP-000002, ...
function genRepCode(repairs) {
  var n = (repairs || []).length + 1;
  return 'REP-' + String(n).padStart(6, '0');
}

// Genera un UUID v4 simplificado para IDs locales
function gid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// Abre ventana de impresión con la orden de trabajo en formato HTML
function printRepairTicket(rep) {
  var _si = getStore();
  var _sn = _si.store_name || STORE_FALLBACK;
  var statusInfo = REP_STATUS[rep.status] || { label: rep.status, icon: '•' };

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Orden ' + rep.repCode + '</title>' +
    '<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:12px;color:#222;max-width:700px;margin:0 auto;padding:24px;}' +
    '.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1D9E75;padding-bottom:14px;margin-bottom:18px;}' +
    '.brand h1{font-size:20px;font-weight:900;color:#1a2535;}.brand p{font-size:10px;color:#1D9E75;font-weight:700;letter-spacing:2px;margin-top:2px;}' +
    '.rep-num .label{font-size:10px;color:#999;text-transform:uppercase;letter-spacing:1px;}.rep-num .num{font-size:22px;font-weight:900;color:#1D9E75;margin-top:2px;}' +
    '.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;padding:12px;background:#f8f9fa;border-radius:8px;border-left:4px solid #1D9E75;}' +
    '.block .lbl{font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;}.block .val{font-size:13px;font-weight:700;}.block .sub{font-size:11px;color:#666;margin-top:1px;}' +
    '.status-bar{background:#1a2535;color:#fff;padding:10px 16px;border-radius:8px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;}' +
    '.section{margin-bottom:14px;border:1px solid #eee;border-radius:8px;overflow:hidden;}' +
    '.section-title{background:#f0efeb;padding:8px 12px;font-weight:700;font-size:12px;color:#444;border-bottom:1px solid #eee;}' +
    '.section-body{padding:12px;}' +
    '.parts-table{width:100%;border-collapse:collapse;}.parts-table th{background:#1D9E75;color:#fff;padding:6px 8px;text-align:left;font-size:11px;}.parts-table td{padding:6px 8px;border-bottom:1px solid #eee;font-size:12px;}' +
    '.footer{border-top:2px dashed #ccc;padding-top:14px;margin-top:16px;display:flex;justify-content:space-between;font-size:11px;color:#999;}' +
    '.firma{margin-top:32px;border-top:1px solid #ccc;padding-top:8px;text-align:center;font-size:11px;color:#999;}' +
    '@media print{body{padding:12px;}}' +
    '</style></head><body>' +
    '<div class="header">' +
      '<div class="brand"><h1>' + _sn + '</h1><p>' + (rep.status === 'entregado' ? 'COMPROBANTE DE ENTREGA' : 'ORDEN DE TRABAJO · RECEPCIÓN') + '</p></div>' +
      '<div style="display:flex;align-items:flex-start;gap:14px;">' +
        '<div class="rep-num"><div class="label">N° Orden</div><div class="num">' + rep.repCode + '</div></div>' +
        '<div style="text-align:center;margin-top:4px;"><div id="qrr" style="display:inline-block;"></div><div style="font-size:9px;color:#999;margin-top:3px;">ESCANEAR</div></div>' +
      '</div>' +
    '</div>' +
    '<div class="status-bar"><span>Estado: <b>' + statusInfo.icon + ' ' + statusInfo.label + '</b></span>' +
      '<span>Registrada: ' + new Date(rep.createdAt).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' }) + '</span>' +
      (rep.promisedDate ? '<span>Entrega prometida: <b>' + new Date(rep.promisedDate + 'T00:00:00').toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' }) + '</b></span>' : '') +
    '</div>' +
    '<div class="grid">' +
      '<div class="block"><div class="lbl">Cliente</div><div class="val">' + rep.clientName + '</div>' +
        (rep.clientPhone ? '<div class="sub">Tel: ' + rep.clientPhone + '</div>' : '') +
        (rep.clientCli ? '<div class="sub">' + rep.clientCli + '</div>' : '') + '</div>' +
      '<div class="block"><div class="lbl">Dispositivo</div><div class="val">' + rep.brand + ' ' + rep.model + '</div>' +
        (rep.imei ? '<div class="sub">IMEI: ' + rep.imei + '</div>' : '') + '</div>' +
      '<div class="block"><div class="lbl">Técnico asignado</div><div class="val">' + (rep.techName || 'Sin asignar') + '</div></div>' +
      '<div class="block"><div class="lbl">Costo estimado</div><div class="val" style="color:#1D9E75;">Q ' + (rep.estimatedCost ? Number(rep.estimatedCost).toFixed(2) : 'Por definir') + '</div></div>' +
    '</div>' +
    '<div class="section"><div class="section-title">⚠️ Problema reportado por el cliente</div><div class="section-body">' + rep.problemDesc + '</div></div>' +
    (rep.diagnosis ? '<div class="section"><div class="section-title">🔍 Diagnóstico técnico</div><div class="section-body">' + rep.diagnosis + '</div></div>' : '') +
    (rep.parts && rep.parts.length > 0 ?
      '<div class="section"><div class="section-title">🔩 Repuestos utilizados</div><div class="section-body"><table class="parts-table"><thead><tr><th>Código</th><th>Repuesto</th><th>Cant.</th><th>Precio</th></tr></thead><tbody>' +
      rep.parts.map(function(p) { return '<tr><td style="font-family:monospace;">' + p.code + '</td><td>' + p.name + '</td><td>' + p.qty + '</td><td>Q ' + Number(p.price).toFixed(2) + '</td></tr>'; }).join('') +
      '</tbody></table></div></div>' : '') +
    (rep.internalNote ? '<div class="section"><div class="section-title">📝 Nota interna</div><div class="section-body" style="color:#666;">' + rep.internalNote + '</div></div>' : '') +
    '<div class="footer"><div><b>' + _sn + '</b> · Guatemala</div><div>Ref: ' + rep.repCode + ' · ' + rep.id.slice(0, 8).toUpperCase() + '</div></div>' +
    '<div class="firma">Firma del cliente: _____________________________ &nbsp;&nbsp;&nbsp; Fecha entrega: _______________</div>' +
    '<p style="text-align:center;margin:10px 0 0;font-size:9px;color:#bbb;">Comprobante interno · No es documento tributario (no válido como factura)</p>' +
    '</body></html>';

  var w = window.open('', '_blank', 'width=800,height=700');
  var qrTxt = _sn + ' | Orden: ' + rep.repCode + ' | ' + rep.clientName + ' | ' + rep.brand + ' ' + rep.model;
  w.document.write(html +
    '<scr' + 'ipt src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></scr' + 'ipt>' +
    '<scr' + 'ipt>window.onload=function(){try{new QRCode(document.getElementById("qrr"),{text:' + JSON.stringify(qrTxt) + ',width:85,height:85,colorDark:"#1a2535",colorLight:"#fff"});}catch(e){}setTimeout(function(){window.print();},800);};</scr' + 'ipt>');
  w.document.close();
}

// ── Componente MetricBox (métrica local, solo para esta pantalla) ──────────
function MetricBox({ label, value, color }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '14px 16px', borderTop: '3px solid ' + color }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────
export default function RepairsScreen({ repairs, clients, products, saveRepair, updateRepairStatus, session, showFlash, onCobrar, initialRepairId, navTo }) {
  navTo = navTo || function() {};
  repairs   = repairs   || [];
  clients   = clients   || [];
  products  = products  || [];
  session   = session   || {};
  showFlash = showFlash || function() {};
  onCobrar  = onCobrar  || function() {};

  // Vista actual: 'list' o 'detail' (controlada por selRep)
  var _view = useState(initialRepairId ? 'detail' : 'list'); var repView = _view[0]; var setRepView = _view[1];
  var _sel  = useState(initialRepairId||null);               var selRep  = _sel[0];  var setSelRep  = _sel[1];
  var _sf   = useState(false);      var showForm = _sf[0];  var setShowForm = _sf[1];
  var _fil  = useState('activas');  var filter   = _fil[0]; var setFilter   = _fil[1];

  // ── Estado del formulario de nueva orden ──
  var _fn    = useState('');   var fClientQ    = _fn[0];    var setFClientQ    = _fn[1];
  var _fci   = useState(null); var fClientId   = _fci[0];   var setFClientId   = _fci[1];
  var _fcn   = useState('');   var fClientName = _fcn[0];   var setFClientName = _fcn[1];
  var _fcp   = useState('');   var fClientPhone= _fcp[0];   var setFClientPhone= _fcp[1];
  var _fb    = useState('');   var fBrand      = _fb[0];    var setFBrand      = _fb[1];
  var _fm    = useState('');   var fModel      = _fm[0];    var setFModel      = _fm[1];
  var _fi    = useState('');   var fImei       = _fi[0];    var setFImei       = _fi[1];
  var _fp    = useState('');   var fProblem    = _fp[0];    var setFProblem    = _fp[1];
  var _fd    = useState('');   var fDiag       = _fd[0];    var setFDiag       = _fd[1];
  var _ft    = useState('');   var fTech       = _ft[0];    var setFTech       = _ft[1];
  var _fc    = useState('');   var fCost       = _fc[0];    var setFCost       = _fc[1];
  var _fdate = useState('');   var fDate       = _fdate[0]; var setFDate       = _fdate[1];
  var _fnote = useState('');   var fNote       = _fnote[0]; var setFNote       = _fnote[1];
  var _fparts= useState([]);   var fParts      = _fparts[0];var setFParts      = _fparts[1];
  var _ferr  = useState('');   var fErr        = _ferr[0];  var setFErr        = _ferr[1];

  // Dropdown de clientes y buscador de repuestos
  var _cdrop = useState(false); var showCliDrop     = _cdrop[0]; var setShowCliDrop     = _cdrop[1];
  var _pq    = useState('');    var partQ           = _pq[0];    var setPartQ           = _pq[1];
  var _pshow = useState(false); var showPartPicker  = _pshow[0]; var setShowPartPicker  = _pshow[1];

  // ── Filtrado de lista ──────────────────────────────────────────────────
  var filtered = repairs.filter(function(r) {
    if (filter === 'activas')     return r.status !== 'entregado';
    if (filter === 'entregado')   return r.status === 'entregado';
    if (filter === 'listo')       return r.status === 'listo';
    if (filter === 'en_revision') return r.status === 'en_revision';
    if (filter === 'recibido')    return r.status === 'recibido';
    return true;
  });
  var repPag = usePaginator(filtered, 15);

  // ── Búsqueda de cliente en formulario ─────────────────────────────────
  var cliResults = fClientQ.trim().length > 0
    ? clients.filter(function(c) {
        var q = fClientQ.toLowerCase();
        return (c.name || '').toLowerCase().includes(q)
          || (c.dpi || '').includes(fClientQ)
          || (c.cliCode || '').toLowerCase().includes(q)
          || (c.phone || '').includes(fClientQ);
      }).slice(0, 5)
    : [];

  function selectClient(c) {
    setFClientId(c.id);
    setFClientName(c.name);
    setFClientPhone(c.phone || '');
    setFClientQ(c.name);
    setShowCliDrop(false);
  }

  // ── Manejo de repuestos en formulario ─────────────────────────────────
  function addPartObj(p) {
    setFParts(function(prev) {
      var ex = prev.find(function(x) { return x.code === p.code; });
      if (ex) return prev.map(function(x) { return x.code === p.code ? Object.assign({}, x, { qty: x.qty + 1 }) : x; });
      return prev.concat([{ code: p.code, name: p.name, price: p.price, qty: 1 }]);
    });
  }
  function removePart(code) {
    setFParts(function(prev) { return prev.filter(function(x) { return x.code !== code; }); });
  }

  var partResults = products.filter(function(p) {
    if (p.unit === 'serv') return false;
    if (!partQ.trim()) return true;
    var ql = partQ.toLowerCase();
    return (p.name || '').toLowerCase().includes(ql)
      || (p.code || '').toLowerCase().includes(ql)
      || (p.category || '').toLowerCase().includes(ql);
  }).slice(0, 30);

  // ── Reset y cierre del formulario ─────────────────────────────────────
  function resetForm() {
    setFClientQ(''); setFClientId(null); setFClientName(''); setFClientPhone('');
    setFBrand(''); setFModel(''); setFImei(''); setFProblem(''); setFDiag('');
    setFTech(''); setFCost(''); setFDate(''); setFNote(''); setFParts([]); setFErr('');
    setPartQ(''); setShowPartPicker(false);
  }
  function closeForm() { resetForm(); setShowForm(false); }

  // ── Registrar nueva orden ──────────────────────────────────────────────
  function submitRepair() {
    if (!fClientName.trim()) { setFErr('El nombre del cliente es obligatorio'); return; }
    if (!fBrand.trim() || !fModel.trim()) { setFErr('Marca y modelo del dispositivo son obligatorios'); return; }
    if (!fProblem.trim()) { setFErr('Describí el problema reportado'); return; }

    var rep = {
      id: gid(),
      repCode: genRepCode(repairs),
      clientId: fClientId || null,
      clientName: fClientName.trim(),
      clientPhone: fClientPhone.trim(),
      clientCli: fClientId ? ((clients.find(function(c) { return c.id === fClientId; }) || {}).cliCode || '') : '',
      brand: fBrand.trim(),
      model: fModel.trim(),
      imei: fImei.trim(),
      problemDesc: fProblem.trim(),
      diagnosis: fDiag.trim(),
      techName: fTech.trim() || session.name,
      estimatedCost: parseFloat(fCost) || 0,
      promisedDate: fDate || null,
      internalNote: fNote.trim(),
      parts: fParts,
      status: 'recibido',
      createdAt: new Date().toISOString(),
      registradoPor: { userId: session.userId, name: session.name, role: session.role },
    };

    saveRepair(rep);
    showFlash('✓ Orden ' + rep.repCode + ' registrada', 'ok');
    closeForm();
  }

  // ══════════════════════════════════════════════════════════════════════
  // VISTA DETALLE — cuando se selecciona una orden
  // ══════════════════════════════════════════════════════════════════════
  if (selRep) {
    var rep = repairs.find(function(r) { return r.id === selRep; });
    if (!rep) { setSelRep(null); return null; }

    var statusInfo  = REP_STATUS[rep.status] || { label: rep.status, icon: '•', color: 'gray' };
    var nextStatus  = { recibido: 'en_revision', en_revision: 'listo', listo: 'entregado' };
    var nextLabel   = { recibido: '🔧 Iniciar revisión', en_revision: '✅ Marcar como listo', listo: '📦 Marcar como entregado' };

    return (
      <div>
        {/* Barra de acciones */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <button style={mkBtn('gray')} onClick={function() { setSelRep(null); }}>← Volver</button>
          <button style={mkBtn('teal')} onClick={function() { printRepairTicket(rep); }}>🖨 Imprimir / PDF</button>
          {rep.status !== 'entregado' && (
            <button style={mkBtn('blue')} onClick={function() { updateRepairStatus(rep.id, nextStatus[rep.status]); showFlash('✓ Estado actualizado', 'ok'); }}>
              {nextLabel[rep.status]}
            </button>
          )}
          {(rep.status === 'listo' || rep.status === 'entregado') && (
            <button style={mkBtn('teal')} onClick={function() { onCobrar(rep); setSelRep(null); }}>💰 Cobrar reparación</button>
          )}
        </div>

        <div style={sCard}>
          {/* Encabezado de la orden */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <p style={{ fontWeight: 800, fontSize: 20, margin: 0, color: TEAL }}>{rep.repCode}</p>
                <span style={mkBadge(statusInfo.color)}>{statusInfo.icon} {statusInfo.label}</span>
              </div>
              <p style={{ fontSize: 13, color: '#666', margin: '0 0 2px' }}>Registrada: {fmtD(rep.createdAt)} {fmtT(rep.createdAt)}</p>
              {rep.registradoPor && <p style={{ fontSize: 12, color: '#999', margin: 0 }}>Por: <b>{rep.registradoPor.name}</b></p>}
            </div>
            <div style={{ textAlign: 'right' }}>
              {rep.promisedDate && <p style={{ fontSize: 12, color: '#666', margin: '0 0 4px' }}>Entrega prometida: <b>{new Date(rep.promisedDate + 'T00:00:00').toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })}</b></p>}
              <p style={{ fontSize: 22, fontWeight: 700, color: TEAL, margin: 0 }}>Q {Number(rep.estimatedCost || 0).toFixed(2)}</p>
            </div>
          </div>

          {/* Stepper visual del flujo de estados */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 20, background: '#f5f4f0', borderRadius: 10, overflow: 'hidden' }}>
            {['recibido', 'en_revision', 'listo', 'entregado'].map(function(s, i) {
              var info = REP_STATUS[s];
              var isDone = ['recibido', 'en_revision', 'listo', 'entregado'].indexOf(rep.status) >= i;
              return (
                <div key={s} style={{ flex: 1, padding: '10px 4px', textAlign: 'center', background: isDone ? TEAL : 'transparent', color: isDone ? '#fff' : '#999', fontSize: 11, fontWeight: isDone ? 700 : 400, borderRight: i < 3 ? '1px solid rgba(255,255,255,0.2)' : 'none' }}>
                  <div style={{ fontSize: 16 }}>{info.icon}</div>
                  <div style={{ marginTop: 2 }}>{info.label}</div>
                </div>
              );
            })}
          </div>

          {/* Tarjetas de información */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div style={{ background: '#f9f8f5', borderRadius: 8, padding: 14 }}>
              <p style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 8px' }}>Cliente</p>
              <p style={{ fontWeight: 700, fontSize: 15, margin: '0 0 2px' }}>{rep.clientName}</p>
              {rep.clientPhone && <p style={{ fontSize: 13, color: '#666', margin: '0 0 2px' }}>📞 {rep.clientPhone}</p>}
              {rep.clientCli   && <p style={{ fontSize: 12, color: TEAL, margin: 0, fontFamily: 'monospace' }}>{rep.clientCli}</p>}
            </div>
            <div style={{ background: '#f9f8f5', borderRadius: 8, padding: 14 }}>
              <p style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 8px' }}>Dispositivo</p>
              <p style={{ fontWeight: 700, fontSize: 15, margin: '0 0 2px' }}>{rep.brand} {rep.model}</p>
              {rep.imei && <p style={{ fontSize: 12, color: '#666', margin: 0, fontFamily: 'monospace' }}>IMEI: {rep.imei}</p>}
            </div>
            <div style={{ background: '#f9f8f5', borderRadius: 8, padding: 14 }}>
              <p style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 6px' }}>Técnico asignado</p>
              <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>{rep.techName || 'Sin asignar'}</p>
            </div>
            <div style={{ background: '#EAF3DE', borderRadius: 8, padding: 14 }}>
              <p style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 6px' }}>Costo estimado</p>
              <p style={{ fontWeight: 700, fontSize: 18, color: TEAL, margin: 0 }}>Q {Number(rep.estimatedCost || 0).toFixed(2)}</p>
            </div>
          </div>

          {/* Problema y diagnóstico */}
          <div style={{ marginBottom: 12, background: '#FCEBEB', borderRadius: 8, padding: '10px 14px', border: '1px solid #F09595' }}>
            <p style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', margin: '0 0 4px' }}>⚠️ Problema reportado</p>
            <p style={{ fontSize: 14, color: '#791F1F', margin: 0, fontWeight: 500 }}>{rep.problemDesc}</p>
          </div>

          {rep.diagnosis && (
            <div style={{ marginBottom: 12, background: '#E6F1FB', borderRadius: 8, padding: '10px 14px', border: '1px solid #a8ccee' }}>
              <p style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', margin: '0 0 4px' }}>🔍 Diagnóstico técnico</p>
              <p style={{ fontSize: 14, color: '#0C447C', margin: 0 }}>{rep.diagnosis}</p>
            </div>
          )}

          {/* Tabla de repuestos utilizados */}
          {rep.parts && rep.parts.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontWeight: 600, margin: '0 0 8px', fontSize: 13 }}>🔩 Repuestos utilizados</p>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Código', 'Repuesto', 'Cant.', 'Precio', 'Subtotal'].map(function(h) { return <th key={h} style={sTH}>{h}</th>; })}</tr></thead>
                <tbody>
                  {rep.parts.map(function(p, i) {
                    return (
                      <tr key={i}>
                        <td style={Object.assign({}, sTD, { fontFamily: 'monospace', fontSize: 12 })}>{p.code}</td>
                        <td style={Object.assign({}, sTD, { fontWeight: 500 })}>{p.name}</td>
                        <td style={sTD}>{p.qty}</td>
                        <td style={sTD}>Q {Number(p.price).toFixed(2)}</td>
                        <td style={Object.assign({}, sTD, { fontWeight: 700, color: TEAL })}>Q {Number(p.price * p.qty).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Nota interna */}
          {rep.internalNote && (
            <div style={{ background: '#FFF8E1', borderRadius: 8, padding: '10px 14px', border: '1px solid #FFD54F' }}>
              <p style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', margin: '0 0 4px' }}>📝 Nota interna</p>
              <p style={{ fontSize: 13, color: '#666', margin: 0 }}>{rep.internalNote}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // VISTA LISTA
  // ══════════════════════════════════════════════════════════════════════

  // Métricas del panel superior
  var totalActivas   = repairs.filter(function(r) { return r.status !== 'entregado'; }).length;
  var totalListas    = repairs.filter(function(r) { return r.status === 'listo'; }).length;
  var totalEntregadas= repairs.filter(function(r) { return r.status === 'entregado'; }).length;

  return (
    <div>
      {/* Encabezado y botones de acción */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <p style={Object.assign({}, H1, { margin: 0 })}>
          🔧 Reparaciones
          <HelpTip text={'Gestión de equipos en taller.\n\nEstados del flujo:\n• Recibido → En revisión → Listo → Entregado\n\nCada reparación lleva: cliente, equipo, problema, técnico asignado y costo.'} />
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!showForm && <>
            <button style={Object.assign({}, mkBtn('teal'), { padding: '6px 12px', fontSize: 12 })} onClick={function() {
              var cols = ['Cliente', 'Equipo', 'Problema', 'Técnico', 'Estado', 'Costo', 'Fecha'];
              var rows = repairs.map(function(r) { return [r.clientName || '', r.brand + ' ' + r.model, r.problemDesc || '', r.techName || '', r.status || '', 'Q' + Number(r.estimatedCost || 0).toFixed(2), fmtD(r.createdAt)]; });
              exportExcel(rows, cols, 'reparaciones');
            }}>📊 Excel</button>
            <button style={Object.assign({}, mkBtn('blue'), { padding: '6px 12px', fontSize: 12 })} onClick={function() {
              var cols = ['Cliente', 'Equipo', 'Problema', 'Técnico', 'Estado', 'Costo', 'Fecha'];
              var rows = repairs.map(function(r) { return [r.clientName || '', r.brand + ' ' + r.model, r.problemDesc || '', r.techName || '', r.status || '', 'Q' + Number(r.estimatedCost || 0).toFixed(2), fmtD(r.createdAt)]; });
              exportPDF('Órdenes de Reparación', cols, rows, 'reparaciones');
            }}>📄 PDF</button>
          </>}
          <button style={mkBtn(showForm ? 'red' : 'teal')} onClick={function() { if (showForm) { closeForm(); } else { resetForm(); setShowForm(true); } }}>
            {showForm ? '✕ Cancelar' : '+ Nueva orden'}
          </button>
        </div>
      </div>

      {/* ── FORMULARIO NUEVA ORDEN ──────────────────────────────────────── */}
      {showForm && (
        <div style={Object.assign({}, sCard, { marginBottom: 16, borderColor: TEAL, borderWidth: '1.5px' })}>
          <p style={{ fontWeight: 700, margin: '0 0 16px', fontSize: 15 }}>📋 Nueva Orden de Reparación</p>
          {fErr && <p style={{ color: '#E24B4A', fontSize: 13, margin: '0 0 12px' }}>⚠ {fErr}</p>}

          {/* Sección: datos del cliente */}
          <p style={{ fontWeight: 600, fontSize: 13, color: '#555', margin: '0 0 10px', borderBottom: '1px solid #eee', paddingBottom: 6 }}>👤 Datos del cliente</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={sLabel}>Buscar cliente registrado</label>
              <div style={{ position: 'relative' }}>
                <input style={sInput} value={fClientQ} placeholder="Nombre, DPI o código CLI..."
                  onChange={function(e) { setFClientQ(e.target.value); setFClientName(e.target.value); setFClientId(null); setShowCliDrop(true); }}
                  onFocus={function() { setShowCliDrop(true); }}
                  onBlur={function() { setTimeout(function() { setShowCliDrop(false); }, 200); }}
                />
                {showCliDrop && fClientQ.trim().length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, marginTop: 2 }}>
                    {cliResults.map(function(c) {
                      return (
                        <div key={c.id} onMouseDown={function() { selectClient(c); }} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>
                          <b>{c.name}</b>
                          <span style={{ fontSize: 11, color: '#999', fontFamily: 'monospace' }}> {c.cliCode}{c.phone ? ' · ' + c.phone : ''}</span>
                        </div>
                      );
                    })}
                    {cliResults.length === 0 && <div style={{ padding: '8px 12px', fontSize: 12, color: '#999' }}>Sin resultados — podés escribir el nombre directamente</div>}
                  </div>
                )}
              </div>
              {fClientId && <div style={{ marginTop: 4, fontSize: 11, color: TEAL }}>✓ Cliente registrado vinculado</div>}
            </div>
            <div>
              <label style={sLabel}>Teléfono de contacto</label>
              <input style={sInput} value={fClientPhone} placeholder="Ej: 55551234" onChange={function(e) { setFClientPhone(e.target.value); }} />
            </div>
          </div>

          {/* Sección: dispositivo */}
          <p style={{ fontWeight: 600, fontSize: 13, color: '#555', margin: '0 0 10px', borderBottom: '1px solid #eee', paddingBottom: 6 }}>📱 Dispositivo</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={sLabel}>Marca</label>
              <select style={sInput} value={fBrand} onChange={function(e) { setFErr(''); setFBrand(e.target.value); }}>
                <option value="">— Seleccioná —</option>
                {REP_BRANDS.map(function(b) { return <option key={b}>{b}</option>; })}
              </select>
            </div>
            <div>
              <label style={sLabel}>Modelo</label>
              <input style={sInput} value={fModel} placeholder="Ej: iPhone 11, Galaxy A32..." onChange={function(e) { setFErr(''); setFModel(e.target.value); }} />
            </div>
            <div>
              <label style={sLabel}>IMEI (opcional)</label>
              <input style={sInput} value={fImei} placeholder="15 dígitos" onChange={function(e) { setFImei(e.target.value); }} />
            </div>
          </div>

          {/* Sección: problema y diagnóstico */}
          <p style={{ fontWeight: 600, fontSize: 13, color: '#555', margin: '0 0 10px', borderBottom: '1px solid #eee', paddingBottom: 6 }}>🔍 Problema y diagnóstico</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={sLabel}>Problema reportado por el cliente *</label>
              <textarea style={Object.assign({}, sInput, { height: 72, resize: 'vertical' })} value={fProblem} placeholder="¿Qué le pasa al equipo según el cliente?"
                onChange={function(e) { setFErr(''); setFProblem(e.target.value); }} />
            </div>
            <div>
              <label style={sLabel}>Diagnóstico técnico (opcional)</label>
              <textarea style={Object.assign({}, sInput, { height: 72, resize: 'vertical' })} value={fDiag} placeholder="Diagnóstico interno del técnico..."
                onChange={function(e) { setFDiag(e.target.value); }} />
            </div>
          </div>

          {/* Sección: asignación y costos */}
          <p style={{ fontWeight: 600, fontSize: 13, color: '#555', margin: '0 0 10px', borderBottom: '1px solid #eee', paddingBottom: 6 }}>⚙️ Asignación y costos</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={sLabel}>Técnico asignado</label>
              <input style={sInput} value={fTech} placeholder={'Por defecto: ' + session.name} onChange={function(e) { setFTech(e.target.value); }} />
            </div>
            <div>
              <label style={sLabel}>Costo estimado (Q)</label>
              <input type="number" style={sInput} value={fCost} placeholder="0.00" onChange={function(e) { setFCost(e.target.value); }} />
            </div>
            <div>
              <label style={sLabel}>Fecha de entrega prometida</label>
              <input type="date" style={sInput} value={fDate} onChange={function(e) { setFDate(e.target.value); }} />
            </div>
          </div>

          {/* Sección: repuestos del inventario */}
          <p style={{ fontWeight: 600, fontSize: 13, color: '#555', margin: '0 0 10px', borderBottom: '1px solid #eee', paddingBottom: 6 }}>🔩 Repuestos del inventario (opcional)</p>
          <div style={{ marginBottom: 14 }}>
            <div style={{ marginBottom: 8, position: 'relative' }}>
              <input style={Object.assign({}, sInput, { paddingRight: 90 })} placeholder="🔍 Buscar repuesto por nombre, código o categoría..."
                value={partQ}
                onChange={function(e) { setPartQ(e.target.value); setShowPartPicker(true); }}
                onFocus={function() { setShowPartPicker(true); }}
                onBlur={function() { setTimeout(function() { setShowPartPicker(false); }, 200); }}
              />
              {partQ && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#999', cursor: 'pointer' }} onMouseDown={function() { setPartQ(''); setShowPartPicker(false); }}>✕ limpiar</span>}
              {showPartPicker && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.12)', zIndex: 200, marginTop: 2, maxHeight: 240, overflowY: 'auto' }}>
                  {partResults.length === 0
                    ? <div style={{ padding: '10px 14px', fontSize: 13, color: '#999' }}>Sin productos en inventario</div>
                    : partResults.map(function(p) {
                        var ya = fParts.find(function(x) { return x.code === p.code; });
                        return (
                          <div key={p.code} onMouseDown={function() { addPartObj(p); setPartQ(''); }}
                            style={{ padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: ya ? '#F0FDF4' : '#fff' }}>
                            <div>
                              <span style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</span>
                              <span style={{ fontSize: 11, color: '#999', marginLeft: 8, fontFamily: 'monospace' }}>{p.code}</span>
                              {p.category && <span style={{ fontSize: 11, color: '#aaa', marginLeft: 6 }}>{p.category}</span>}
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: TEAL }}>Q {Number(p.price).toFixed(2)}</div>
                              <div style={{ fontSize: 11, color: p.stock > 0 ? '#666' : '#E24B4A' }}>Stock: {p.stock} {ya ? '· ✓ ya agregado' : ''}</div>
                            </div>
                          </div>
                        );
                      })
                  }
                </div>
              )}
            </div>

            {/* Tabla de repuestos seleccionados */}
            {fParts.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Código', 'Repuesto', 'Cant.', 'Precio', ''].map(function(h) { return <th key={h} style={sTH}>{h}</th>; })}</tr></thead>
                <tbody>
                  {fParts.map(function(p) {
                    return (
                      <tr key={p.code}>
                        <td style={Object.assign({}, sTD, { fontFamily: 'monospace', fontSize: 12 })}>{p.code}</td>
                        <td style={Object.assign({}, sTD, { fontWeight: 500 })}>{p.name}</td>
                        <td style={sTD}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button style={{ border: '1px solid #ddd', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', background: '#fff', fontSize: 14 }}
                              onMouseDown={function(e) { e.preventDefault(); setFParts(function(prev) { return prev.map(function(x) { return x.code === p.code && x.qty > 1 ? Object.assign({}, x, { qty: x.qty - 1 }) : x; }); }); }}>−</button>
                            <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 600 }}>{p.qty}</span>
                            <button style={{ border: '1px solid #ddd', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', background: '#fff', fontSize: 14 }}
                              onMouseDown={function(e) { e.preventDefault(); setFParts(function(prev) { return prev.map(function(x) { return x.code === p.code ? Object.assign({}, x, { qty: x.qty + 1 }) : x; }); }); }}>+</button>
                          </div>
                        </td>
                        <td style={Object.assign({}, sTD, { color: TEAL })}>Q {Number(p.price).toFixed(2)}</td>
                        <td style={sTD}><span onClick={function() { removePart(p.code); }} style={{ cursor: 'pointer', color: '#E24B4A', fontSize: 16, padding: '0 4px' }}>×</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {fParts.length === 0 && <p style={{ fontSize: 12, color: '#bbb', margin: '8px 0 0' }}>No se han agregado repuestos aún.</p>}
          </div>

          {/* Nota interna */}
          <div style={{ marginBottom: 16 }}>
            <label style={sLabel}>📝 Nota interna (no se imprime en el ticket del cliente)</label>
            <input style={sInput} value={fNote} placeholder="Observaciones internas..." onChange={function(e) { setFNote(e.target.value); }} />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button style={Object.assign({}, mkBtn('teal'), { padding: '10px 24px' })} onClick={submitRepair}>✓ Registrar orden</button>
            <button style={mkBtn('gray')} onClick={closeForm}>Cancelar</button>
          </div>
        </div>
      )}

      {/* ── MÉTRICAS ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        <MetricBox label="Activas"             value={totalActivas}    color="#378ADD" />
        <MetricBox label="Listas para entregar" value={totalListas}    color={TEAL} />
        <MetricBox label="Entregadas"           value={totalEntregadas} color="#666" />
        <MetricBox label="Total órdenes"        value={repairs.length}  color="#7F77DD" />
      </div>

      {/* ── FILTROS DE ESTADO ────────────────────────────────────────────── */}
      <div style={Object.assign({}, sCard, { marginBottom: 14 })}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            ['activas',     'Activas'],
            ['recibido',    '📥 Recibidas'],
            ['en_revision', '🔧 En revisión'],
            ['listo',       '✅ Listas'],
            ['entregado',   '📦 Entregadas'],
            ['todos',       'Todas'],
          ].map(function(pair) {
            return (
              <button key={pair[0]} style={Object.assign({}, mkBtn(filter === pair[0] ? 'teal' : 'gray'), { padding: '6px 14px' })} onClick={function() { setFilter(pair[0]); }}>
                {pair[1]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── TABLA DE ÓRDENES ─────────────────────────────────────────────── */}
      <div style={sCard}>
        {filtered.length === 0
          ? <p style={{ textAlign: 'center', color: '#999', padding: 40 }}>Sin órdenes en esta categoría</p>
          : (
            <div className="tbl-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['#', 'Orden', 'Cliente', 'Dispositivo', 'Técnico', 'Estado', 'Costo', 'Entrega', ''].map(function(h) {
                    return <th key={h} style={h === '#' ? Object.assign({}, sTH, { width: 40, textAlign: 'center' }) : sTH}>{h}</th>;
                  })}</tr>
                </thead>
                <tbody>
                  {repPag.paged.slice().sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }).map(function(r, index) {
                    var info    = REP_STATUS[r.status] || { label: r.status, color: 'gray' };
                    var vencida = r.promisedDate && r.status !== 'entregado' && new Date(r.promisedDate + 'T23:59:59') < new Date();
                    return (
                      <tr key={r.id} style={{ cursor: 'pointer' }} onClick={function() { setSelRep(r.id); }}>
                        <td style={{ ...sTD, textAlign: 'center', color: '#999', fontSize: 12 }}>{repPag.offset + index + 1}</td>
                        <td style={Object.assign({}, sTD, { fontFamily: 'monospace', fontSize: 12, color: TEAL, fontWeight: 700 })}>{r.repCode}</td>
                        <td style={Object.assign({}, sTD, { fontWeight: 600 })}>
                          {(function() {
                            var cli = (r.clientId && clients.find(function(c) { return c.id === r.clientId; }))
                                   || (r.clientName && clients.find(function(c) { return c.name === r.clientName; }));
                            if (cli) return <span style={{ cursor: 'pointer', color: 'var(--teal,#1D9E75)', textDecoration: 'underline dotted' }} onClick={function(e) { e.stopPropagation(); navTo('clients', { clientId: cli.id }); }}>{r.clientName}</span>;
                            return r.clientName;
                          })()}
                          {r.clientCli && <div style={{ fontSize: 10, color: '#999', fontFamily: 'monospace' }}>{r.clientCli}</div>}
                        </td>
                        <td style={sTD}>
                          <div style={{ fontWeight: 500 }}>{r.brand} {r.model}</div>
                          {r.imei && <div style={{ fontSize: 10, color: '#999', fontFamily: 'monospace' }}>{r.imei}</div>}
                        </td>
                        <td style={Object.assign({}, sTD, { color: '#666' })}>{r.techName || '—'}</td>
                        <td style={sTD}><span style={mkBadge(info.color)}>{REP_STATUS[r.status] ? REP_STATUS[r.status].icon + ' ' + REP_STATUS[r.status].label : r.status}</span></td>
                        <td style={Object.assign({}, sTD, { fontWeight: 600, color: TEAL })}>Q {Number(r.estimatedCost || 0).toFixed(2)}</td>
                        <td style={sTD}>
                          {r.promisedDate
                            ? <span style={{ color: vencida ? '#E24B4A' : 'inherit', fontWeight: vencida ? 700 : 400 }}>
                                {vencida ? '⚠ ' : ''}{new Date(r.promisedDate + 'T00:00:00').toLocaleDateString('es-GT', { day: '2-digit', month: 'short' })}
                              </span>
                            : '—'}
                        </td>
                        <td style={Object.assign({}, sTD, { color: '#999', fontSize: 12 })}>Ver →</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        }
        {filtered.length > 0 && React.createElement(repPag.Pager)}
      </div>
    </div>
  );
}
