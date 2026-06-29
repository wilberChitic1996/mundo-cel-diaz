// ══════════════════════════════════════════════════════════════════════════════
// GENERADOR DE RECIBOS Y COMPARTIR POR WHATSAPP
//
// buildReceiptHTML: genera el HTML del recibo de venta para imprimir o compartir.
// compartirWhatsApp: combina el recibo con el mensaje de WhatsApp.
//   - En móvil: usa Web Share API para adjuntar la imagen del recibo.
//   - En escritorio: descarga la imagen y abre WhatsApp con el mensaje.
//
// Dependencias externas: html2canvas (convierte el HTML en imagen PNG).
// ══════════════════════════════════════════════════════════════════════════════

import html2canvas from 'html2canvas';
import { qrDataUrl } from './qr.js';
import { fmtD } from './formatters.js';
import { abrirWA } from './whatsapp.js';
import { STORE_FALLBACK, APP_TAGLINE, APP_NAME } from '../constants/index.js';

// Estado de configuración de la tienda (se actualiza desde App al cargar settings)
var _STORE = { store_name: '', store_tagline: '', store_phone: '', store_address: '', store_email: '', store_logo_url: '' };

/** Devuelve la configuración actual de la tienda. */
export function getStore() { return _STORE; }

/** Actualiza la configuración de la tienda (se llama desde App cuando carga los settings). */
export function setStore(cfg) { _STORE = Object.assign({}, _STORE, cfg); }

/**
 * Genera el HTML completo de un recibo de venta.
 *
 * @param {Object} sale - Objeto de venta (items, client, date, total, method, etc.)
 * @param {Object} opts - Opciones opcionales:
 *   - estado: 'pendiente' | 'parcial' | 'pagado' (para cuentas por cobrar)
 *   - pagado: monto ya abonado
 *   - saldo:  saldo pendiente
 *   - usuario: nombre del cajero
 * @param {Object} si - Información de tienda (si es null, usa la configuración global)
 */
export function buildReceiptHTML(sale, opts, si) {
  opts = opts || {};
  si   = si   || getStore();

  var sn      = si.store_name    || STORE_FALLBACK;
  var st      = si.store_tagline || APP_TAGLINE;
  var ivaPct  = parseFloat(si.iva_percent || '0') || 0;
  var total   = Number(sale.total) || 0;
  // Guatemala: precios con IVA incluido — desglozar hacia atrás
  var ivaAmt  = ivaPct > 0 ? total - total / (1 + ivaPct / 100) : 0;
  var subtot  = total - ivaAmt;

  // Generar filas de la tabla de productos
  var items = (sale.items || []).map(function(it) {
    return (
      '<tr>' +
        '<td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;font-weight:600;">' + it.name + '</td>' +
        '<td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;font-size:12px;">' + it.qty + '</td>' +
        '<td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;font-size:12px;">Q ' + Number(it.price).toFixed(2) + '</td>' +
        '<td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;font-size:12px;font-weight:700;">Q ' + Number(it.price * it.qty).toFixed(2) + '</td>' +
      '</tr>'
    );
  }).join('');

  var fecha = new Date(sale.date || sale.created_at).toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' });
  var hora  = new Date(sale.date || sale.created_at).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });

  // Banner de estado para cuentas por cobrar (pendiente / abono / cancelado)
  var estadoHTML = '';
  if (opts.estado === 'pendiente') estadoHTML = '<div style="text-align:center;padding:8px;margin-bottom:14px;background:#FCEBEB;color:#791F1F;border-radius:6px;font-weight:900;font-size:15px;letter-spacing:2px;">PENDIENTE DE PAGO</div>';
  else if (opts.estado === 'parcial') estadoHTML = '<div style="text-align:center;padding:8px;margin-bottom:14px;background:#FAEEDA;color:#633806;border-radius:6px;font-weight:900;font-size:15px;letter-spacing:2px;">ABONO — SALDO PENDIENTE</div>';
  else if (opts.estado === 'pagado')  estadoHTML = '<div style="text-align:center;padding:8px;margin-bottom:14px;background:#EAF3DE;color:#27500A;border-radius:6px;font-weight:900;font-size:15px;letter-spacing:2px;">✓ CUENTA CANCELADA</div>';

  // Filas de abono y saldo para cuentas por cobrar
  var saldoHTML = '';
  if (opts.estado) {
    saldoHTML =
      '<tr style="background:#f0f9f5;"><td colspan="3" style="padding:8px 10px;font-weight:700;font-size:13px;">Abonado</td><td style="padding:8px 10px;text-align:right;font-weight:700;font-size:13px;color:#1D9E75;">Q ' + Number(opts.pagado || sale.paid || 0).toFixed(2) + '</td></tr>' +
      '<tr style="background:#fff0f0;"><td colspan="3" style="padding:8px 10px;font-weight:900;font-size:14px;">Saldo pendiente</td><td style="padding:8px 10px;text-align:right;font-weight:900;font-size:14px;color:#E24B4A;">Q ' + Number(opts.saldo || sale.balance || 0).toFixed(2) + '</td></tr>';
  }

  // HTML completo del recibo
  return (
    '<div style="font-family:Arial,sans-serif;font-size:12px;background:#fff;width:600px;padding:24px;box-sizing:border-box;">' +
      '<div style="border-bottom:3px solid #1D9E75;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start;">' +
        '<div>' +
          '<div style="font-size:20px;font-weight:900;color:#1a2535;">' + sn + '</div>' +
          '<div style="font-size:9px;color:#1D9E75;font-weight:700;letter-spacing:2px;margin-top:2px;">SISTEMA DE GESTIÓN</div>' +
          '<div style="font-size:9px;color:#999;margin-top:3px;">' + st + '</div>' +
        '</div>' +
        '<div style="text-align:right;">' +
          '<div style="font-size:9px;color:#999;text-transform:uppercase;">' + (opts.estado ? 'Comprobante de Cuenta' : 'Comprobante de Venta') + '</div>' +
          '<div style="font-size:20px;font-weight:900;color:#1D9E75;"># ' + String(sale.id || '').toUpperCase().slice(-8) + '</div>' +
        '</div>' +
      '</div>' +
      estadoHTML +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;padding:12px;background:#f8f9fa;border-radius:8px;border-left:4px solid #1D9E75;">' +
        '<div><div style="font-size:9px;color:#999;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Cliente</div><div style="font-size:12px;font-weight:700;color:#222;">' + sale.client + '</div></div>' +
        '<div><div style="font-size:9px;color:#999;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Fecha</div><div style="font-size:12px;font-weight:700;color:#222;">' + fecha + '</div><div style="font-size:10px;color:#666;">' + hora + ' hrs</div></div>' +
        '<div><div style="font-size:9px;color:#999;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Método</div><div style="font-size:12px;font-weight:700;color:#222;">' + (sale.method || 'Efectivo') + '</div></div>' +
        '<div><div style="font-size:9px;color:#999;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Atendido por</div><div style="font-size:12px;font-weight:700;color:#222;">' + ((sale.registradoPor && sale.registradoPor.name) || opts.usuario || '—') + '</div></div>' +
      '</div>' +
      '<table style="width:100%;border-collapse:collapse;margin-bottom:12px;">' +
        '<thead><tr style="background:#1a2535;">' +
          '<th style="padding:8px 10px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;text-align:left;">Producto</th>' +
          '<th style="padding:8px 10px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;text-align:center;">Cant.</th>' +
          '<th style="padding:8px 10px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;text-align:right;">Precio</th>' +
          '<th style="padding:8px 10px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;text-align:right;">Subtotal</th>' +
        '</tr></thead>' +
        '<tbody>' + items + saldoHTML + '</tbody>' +
      '</table>' +
      '<div style="display:flex;justify-content:flex-end;margin-bottom:16px;">' +
        '<div style="border:1px solid #eee;border-radius:8px;overflow:hidden;min-width:220px;">' +
          (ivaPct > 0
            ? '<div style="display:flex;justify-content:space-between;padding:6px 12px;font-size:11px;border-bottom:1px solid #eee;color:#666;"><span>Subtotal (sin IVA)</span><span>Q ' + subtot.toFixed(2) + '</span></div>' +
              '<div style="display:flex;justify-content:space-between;padding:6px 12px;font-size:11px;border-bottom:1px solid #eee;color:#666;"><span>IVA (' + ivaPct + '%)</span><span>Q ' + ivaAmt.toFixed(2) + '</span></div>'
            : '') +
          '<div style="display:flex;justify-content:space-between;padding:7px 12px;background:#1D9E75;color:#fff;font-weight:700;font-size:14px;"><span>TOTAL</span><span>Q ' + total.toFixed(2) + '</span></div>' +
        '</div>' +
      '</div>' +
      '<div style="border-top:2px dashed #ccc;padding-top:12px;font-size:10px;color:#999;display:flex;justify-content:space-between;">' +
        '<span>Generado por ' + sn + ' POS</span><span>' + fecha + ' · ' + hora + '</span>' +
      '</div>' +
      '<div style="text-align:center;margin-top:16px;font-size:13px;color:#1D9E75;font-weight:700;letter-spacing:1px;">¡Gracias por su compra!</div>' +
      '<div style="text-align:center;margin-top:6px;font-size:9px;color:#bbb;">Comprobante interno · No es documento tributario (no válido como factura)</div>' +
    '</div>'
  );
}

/**
 * Descarga la boleta de una venta como imagen PNG (alternativa al PDF).
 * Reutiliza buildReceiptHTML + html2canvas (mismo render que el envío por WhatsApp).
 *
 * @param {Object} sale - Venta a renderizar
 * @param {Object} opts - Opciones de recibo (usuario, estado, etc.)
 * @returns {Promise<boolean>} true si se descargó, false si falló
 */
export async function descargarImagen(sale, opts) {
  opts = opts || {};
  try {
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;background:#fff;z-index:-1;width:650px;';
    wrapper.innerHTML = buildReceiptHTML(sale, opts);
    document.body.appendChild(wrapper);
    await new Promise(function(r) { setTimeout(r, 400); });

    var canvas = await html2canvas(wrapper.firstChild, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
    document.body.removeChild(wrapper);

    var blob = await new Promise(function(r) { canvas.toBlob(r, 'image/png', 0.95); });
    var _name = (getStore().store_name || APP_NAME).replace(/\s+/g, '-').toLowerCase();
    var _folio = String(sale.id || '').toUpperCase().slice(-8);
    var imgUrl = URL.createObjectURL(blob);
    var dl = document.createElement('a');
    dl.href = imgUrl;
    dl.download = 'boleta-' + _name + '-' + _folio + '.png';
    document.body.appendChild(dl);
    dl.click();
    document.body.removeChild(dl);
    setTimeout(function() { URL.revokeObjectURL(imgUrl); }, 5000);
    return true;
  } catch (err) {
    console.warn('[BOLETA] Error generando imagen:', err);
    return false;
  }
}

/**
 * Comparte un mensaje de WhatsApp, opcionalmente adjuntando la imagen del recibo.
 *
 * Flujo:
 *  1. Si se pasa opts.sale, renderiza el recibo en un div oculto y lo convierte a imagen.
 *  2. En móvil: usa Web Share API para adjuntar la imagen.
 *  3. En escritorio: descarga la imagen y abre WhatsApp con el texto.
 *  4. Si falla la imagen (error o no hay sale), abre WhatsApp solo con texto.
 *
 * @param {string}   tel        - Número de teléfono del destinatario
 * @param {Function} getMensaje - Función que devuelve el texto del mensaje
 * @param {Object}   opts       - { sale, receiptOpts } — sale activa la generación de imagen
 */
/**
 * Genera la ventana de impresión de un comprobante de venta o cuenta.
 *
 * @param {Object} sale - Objeto de venta o cuenta
 * @param {Object} opts - Opciones:
 *   - estado: 'pendiente' | 'parcial' | 'pagado' | 'cancelacion'
 *   - abonoHoy: monto del abono registrado hoy (null si es venta directa)
 *   - pagado: total acumulado pagado
 *   - saldo: saldo pendiente
 *   - usuario: nombre del cajero/vendedor
 *   - usuarioRole: rol del cajero (admin, cajero, etc.)
 *   - products: lista de productos (para mostrar ubicación en estante)
 *   - payments: historial de abonos (para cuentas)
 */
export function printVoucher(sale, opts) {
  opts = opts || {};
  var _E = opts.estado || '';
  var _sello = '', _selloCss = '';
  if (_E === 'pendiente') {
    _sello = 'PENDIENTE DE PAGO';
    _selloCss = 'background:#FCEBEB;color:#791F1F;border:2px solid #E24B4A;';
  } else if (_E === 'parcial') {
    _sello = opts.abonoHoy != null ? 'CONSTANCIA DE ABONO' : 'ABONO - SALDO PENDIENTE';
    _selloCss = 'background:#FAEEDA;color:#633806;border:2px solid #E65100;';
  } else if (_E === 'pagado' || _E === 'cancelacion') {
    _sello = opts.abonoHoy != null ? 'CANCELADO - ULTIMO ABONO' : 'CUENTA CANCELADA';
    _selloCss = 'background:#EAF3DE;color:#27500A;border:2px solid #2E7D32;';
  }
  var _docLabel = _E ? 'Comprobante de Cuenta' : 'Comprobante de Venta';
  var _pmap = {};
  (opts.products || []).forEach(function(pp) { _pmap[pp.code] = pp.shelf; });

  var itemsHTML = (sale.items || []).map(function(it) {
    var hasDisc = it.originalPrice && it.price < it.originalPrice;
    var _shelf = it.shelf || _pmap[it.code] || '—';
    return '<tr>' +
      '<td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:12px;font-weight:600;">' + it.name +
        '<br><span style="font-family:monospace;font-size:10px;color:#888;">SKU: ' + it.code + ' &nbsp;·&nbsp; Estant.: ' + _shelf + '</span>' +
        (hasDisc ? '<br><span style="font-size:10px;color:#E65100;">Descuento aplicado por: ' + it.discountBy + '</span>' : '') +
      '</td>' +
      '<td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:center;font-size:12px;">' + it.qty + '</td>' +
      '<td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:right;font-size:12px;">' +
        (hasDisc ? '<span style="text-decoration:line-through;color:#bbb;font-size:10px;">Q ' + Number(it.originalPrice).toFixed(2) + '</span><br>' : '') +
        '<span style="color:' + (hasDisc ? '#E65100' : '#333') + ';">Q ' + Number(it.price).toFixed(2) + '</span></td>' +
      '<td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:right;font-size:12px;font-weight:700;">Q ' + Number(it.price * it.qty).toFixed(2) + '</td>' +
    '</tr>';
  }).join('');

  var subtotal = (sale.items || []).reduce(function(s, it) { return s + (it.originalPrice || it.price) * it.qty; }, 0);
  var totalDesc = subtotal - sale.total;
  var ventaNum  = sale.id.toUpperCase().slice(-8);
  var fecha     = new Date(sale.date).toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' });
  var hora      = new Date(sale.date).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
  var _store    = getStore();
  var _rSn      = _store.store_name    || STORE_FALLBACK;
  var _rSt      = _store.store_tagline || APP_TAGLINE;
  var _rPhone   = _store.store_phone   || '';
  var _rAddr    = _store.store_address || '';
  var _rEmail   = _store.store_email   || '';

  // Línea de contacto del negocio (solo lo que esté configurado en la BD — nada inventado)
  var _contactBits = [];
  if (_rAddr)  _contactBits.push('📍 ' + _rAddr);
  if (_rPhone) _contactBits.push('📞 ' + _rPhone);
  if (_rEmail) _contactBits.push('✉ ' + _rEmail);
  var _contactLine = _contactBits.length
    ? '<p class="sub" style="margin-top:3px;">' + _contactBits.join(' &nbsp;·&nbsp; ') + '</p>'
    : '';

  // URL de verificación pública del comprobante (el QR apunta aquí)
  var _origin    = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
  var _verifyUrl = _origin + '/?verify=' + encodeURIComponent(sale.id);

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Comprobante ' + ventaNum + '</title>' +
  '<style>' +
    '*{margin:0;padding:0;box-sizing:border-box;}' +
    'body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#222;background:#fff;max-width:700px;margin:0 auto;padding:24px;}' +
    '.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1D9E75;padding-bottom:16px;margin-bottom:20px;}' +
    '.brand h1{font-size:22px;font-weight:900;color:#1a2535;letter-spacing:-0.5px;}' +
    '.brand p{font-size:10px;color:#1D9E75;font-weight:700;letter-spacing:2px;margin-top:2px;}' +
    '.brand .sub{font-size:10px;color:#999;font-weight:400;letter-spacing:0;margin-top:4px;}' +
    '.venta-num{text-align:right;}' +
    '.venta-num .label{font-size:10px;color:#999;text-transform:uppercase;letter-spacing:1px;}' +
    '.venta-num .num{font-size:22px;font-weight:900;color:#1D9E75;margin-top:2px;}' +
    '.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;padding:14px;background:#f8f9fa;border-radius:8px;border-left:4px solid #1D9E75;}' +
    '.info-block .label{font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;}' +
    '.info-block .val{font-size:13px;font-weight:700;color:#222;}' +
    '.info-block .val-sub{font-size:11px;color:#666;margin-top:1px;}' +
    'table{width:100%;border-collapse:collapse;margin-bottom:16px;}' +
    'thead tr{background:#1a2535;}' +
    'thead th{padding:9px 10px;text-align:left;color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;}' +
    'tbody tr:nth-child(even){background:#f9f9f9;}' +
    '.totals{display:flex;justify-content:flex-end;margin-bottom:20px;}' +
    '.totals-box{width:260px;border:1px solid #eee;border-radius:8px;overflow:hidden;}' +
    '.totals-row{display:flex;justify-content:space-between;padding:8px 14px;font-size:12px;border-bottom:1px solid #eee;}' +
    '.totals-row:last-child{background:#1D9E75;color:#fff;font-weight:700;font-size:14px;border-bottom:none;}' +
    '.nota-box{background:#FFFDE7;border:1px solid #FFD54F;border-radius:6px;padding:10px 14px;margin-bottom:20px;font-size:12px;}' +
    '.footer{border-top:2px dashed #ccc;padding-top:16px;display:flex;justify-content:space-between;align-items:center;}' +
    '.footer-left{font-size:11px;color:#999;line-height:1.8;}' +
    '.footer-right{text-align:right;font-size:11px;color:#999;line-height:1.8;}' +
    '.footer strong{color:#1D9E75;}' +
    '.gracias{text-align:center;margin:20px 0 0;font-size:13px;color:#1D9E75;font-weight:700;letter-spacing:1px;}' +
    '@media print{body{padding:12px;}button{display:none!important;}}' +
  '</style></head><body>' +
  '<div class="header">' +
    '<div class="brand"><h1>' + _rSn + '</h1><p>' + _rSt + '</p>' + _contactLine + '</div>' +
    '<div class="venta-num"><div class="label">' + _docLabel + '</div><div class="num"># ' + ventaNum + '</div></div>' +
    '<div style="text-align:center;margin-top:4px;"><img src="' + qrDataUrl(_verifyUrl) + '" width="90" height="90" alt="QR" style="display:inline-block;image-rendering:pixelated;" /><div style="font-size:9px;color:#999;margin-top:3px;letter-spacing:0.5px;">ESCANEAR PARA VERIFICAR</div></div>' +
  '</div>' +
  (_sello ? '<div style="text-align:center;margin:0 0 16px;padding:10px;border-radius:8px;font-size:17px;font-weight:900;letter-spacing:2px;' + _selloCss + '">' + _sello + '</div>' : '') +
  '<div class="info-grid">' +
    '<div class="info-block"><div class="label">Cliente</div><div class="val">' + sale.client + '</div>' + (sale.clientId ? '<div class="val-sub">Código: ' + sale.clientId.slice(0, 8).toUpperCase() + '</div>' : '') + '</div>' +
    '<div class="info-block"><div class="label">Fecha y Hora</div><div class="val">' + fecha + '</div><div class="val-sub">' + hora + ' hrs</div></div>' +
    '<div class="info-block"><div class="label">Método de Pago</div><div class="val">' + sale.method + '</div></div>' +
    '<div class="info-block"><div class="label">Atendido por</div><div class="val">' + ((sale.registradoPor && sale.registradoPor.name) ? sale.registradoPor.name : (opts.usuario || '—')) + '</div>' +
      '<div class="val-sub">' + (function() { var _r = (sale.registradoPor && sale.registradoPor.role) ? sale.registradoPor.role : (opts.usuarioRole || ''); return _r === 'admin' ? 'Administrador' : _r === 'cajero' ? 'Cajero' : _r === 'auditor' ? 'Auditor' : ''; })() + '</div>' +
    '</div>' +
  '</div>' +
  (sale.nota ? '<div class="nota-box"><strong>📝 Nota:</strong> ' + sale.nota + '</div>' : '') +
  '<table><thead><tr>' +
    '<th>Descripción / Producto</th>' +
    '<th style="text-align:center;width:60px;">Cant.</th>' +
    '<th style="text-align:right;width:100px;">Precio Unit.</th>' +
    '<th style="text-align:right;width:100px;">Subtotal</th>' +
  '</tr></thead><tbody>' + itemsHTML + '</tbody></table>' +
  '<div class="totals"><div class="totals-box">' +
    (totalDesc > 0
      ? '<div class="totals-row"><span>Precio lista:</span><span>Q ' + subtotal.toFixed(2) + '</span></div>' +
        '<div class="totals-row"><span style="color:#E65100">Descuentos:</span><span style="color:#E65100">- Q ' + totalDesc.toFixed(2) + '</span></div>'
      : '') +
    '<div class="totals-row"><span>TOTAL:</span><span>Q ' + Number(sale.total).toFixed(2) + '</span></div>' +
  '</div></div>' +
  (_E
    ? '<div class="totals" style="margin-top:-10px;"><div class="totals-box" style="width:280px;">' +
        '<div class="totals-row"><span>Total cuenta:</span><span>Q ' + Number(sale.total).toFixed(2) + '</span></div>' +
        (opts.abonoHoy != null ? '<div class="totals-row" style="color:#E65100;"><span>Abono de hoy:</span><span>+ Q ' + Number(opts.abonoHoy).toFixed(2) + '</span></div>' : '') +
        '<div class="totals-row"><span>Pagado acumulado:</span><span>Q ' + Number(opts.pagado || 0).toFixed(2) + '</span></div>' +
        '<div class="totals-row" style="background:' + (Number(opts.saldo || 0) > 0 ? '#E24B4A' : '#2E7D32') + ';color:#fff;font-weight:700;"><span>SALDO:</span><span>Q ' + Number(opts.saldo || 0).toFixed(2) + '</span></div>' +
      '</div></div>'
    : '') +
  (opts.payments && opts.payments.length
    ? '<div style="margin:0 0 18px;">' +
        '<div style="font-size:12px;font-weight:700;color:#1a2535;margin:0 0 6px;border-bottom:2px solid #1D9E75;padding-bottom:4px;">HISTORIAL DE ABONOS</div>' +
        '<table style="width:100%;border-collapse:collapse;font-size:11px;"><thead><tr style="background:#f0f0f0;">' +
          '<th style="padding:5px 8px;text-align:left;">Fecha</th><th style="padding:5px 8px;text-align:left;">Metodo</th><th style="padding:5px 8px;text-align:left;">Nota</th><th style="padding:5px 8px;text-align:right;">Monto</th>' +
        '</tr></thead><tbody>' +
        opts.payments.map(function(_p) {
          return '<tr><td style="padding:5px 8px;border-bottom:1px solid #eee;">' + new Date(_p.date).toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + new Date(_p.date).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' }) + '</td>' +
            '<td style="padding:5px 8px;border-bottom:1px solid #eee;">' + (_p.method || '-') + '</td>' +
            '<td style="padding:5px 8px;border-bottom:1px solid #eee;color:#666;">' + (_p.note || '-') + '</td>' +
            '<td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:#1D9E75;">Q ' + Number(_p.amount).toFixed(2) + '</td></tr>';
        }).join('') +
        '</tbody></table></div>'
    : '') +
  '<div class="footer">' +
    '<div class="footer-left"><strong>' + _rSn + '</strong>' +
      (_rAddr ? '<br>' + _rAddr : '') +
      (_rPhone ? '<br>Tel: ' + _rPhone : '') +
      (_rEmail ? '<br>' + _rEmail : '') +
      '<br><span style="color:#bbb;font-size:9px;">Comprobante generado por ' + APP_NAME + '</span></div>' +
    '<div class="footer-right">Cantidad de artículos: <strong>' + (sale.items || []).reduce(function(s, i) { return s + i.qty; }, 0) + '</strong><br>Líneas de producto: <strong>' + (sale.items || []).length + '</strong><br><span style="font-family:monospace;font-size:9px;">Ref: ' + String(sale.id).toUpperCase() + '</span></div>' +
  '</div>' +
  '<p class="gracias">¡Gracias por su preferencia!</p>' +
  '<p style="text-align:center;margin:8px 0 0;font-size:9px;color:#bbb;">Comprobante interno · No es documento tributario (no válido como factura)</p>' +
  '</body></html>';

  // QR embebido como imagen (arriba) e impresión disparada desde la ventana padre:
  // sin scripts inline ni CDN → compatible con la CSP estricta (A11).
  var w = window.open('', '_blank', 'width=800,height=700');
  if (w) {
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(function() { try { w.print(); } catch (e) {} }, 400);
  }
}

export async function compartirWhatsApp(tel, getMensaje, opts) {
  opts = opts || {};
  var sale = opts.sale;
  var mensaje = getMensaje();

  if (sale) {
    try {
      // Renderizar el HTML del recibo en un div oculto fuera de la pantalla
      var wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;background:#fff;z-index:-1;width:650px;';
      wrapper.innerHTML = buildReceiptHTML(sale, opts.receiptOpts || {});
      document.body.appendChild(wrapper);

      // Esperar un momento para que el DOM renderice los estilos
      await new Promise(function(r) { setTimeout(r, 400); });

      // Convertir el HTML a imagen PNG usando html2canvas
      var canvas = await html2canvas(wrapper.firstChild, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      document.body.removeChild(wrapper);

      var blob = await new Promise(function(r) { canvas.toBlob(r, 'image/png', 0.95); });
      var _shareName = (getStore().store_name || APP_NAME).replace(/\s+/g, '-').toLowerCase();
      var file = new File([blob], 'boleta-' + _shareName + '.png', { type: 'image/png' });

      // En móvil: Web Share API puede adjuntar archivos directamente a WhatsApp
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Boleta ' + (getStore().store_name || APP_NAME),
          text:  mensaje,
        });
        return;
      }

      // En escritorio: descargar la imagen y abrir WhatsApp con el texto
      var imgUrl = URL.createObjectURL(blob);
      var dl = document.createElement('a');
      dl.href = imgUrl;
      dl.download = 'boleta-' + _shareName + '.png';
      document.body.appendChild(dl);
      dl.click();
      document.body.removeChild(dl);
      setTimeout(function() { URL.revokeObjectURL(imgUrl); }, 5000);

      abrirWA(tel, mensaje);
      setTimeout(function() {
        alert('📎 La imagen de la boleta se descargó.\nAdjúntala manualmente en WhatsApp al abrir el chat.');
      }, 800);
      return;

    } catch (err) {
      // Si falla la generación de imagen, continuar con solo texto
      console.warn('[WA] Error generando imagen:', err);
    }
  }

  // Fallback: abrir WhatsApp solo con texto (sin imagen)
  abrirWA(tel, mensaje);
}
