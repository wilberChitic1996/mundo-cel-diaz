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

  var sn = si.store_name    || STORE_FALLBACK;
  var st = si.store_tagline || APP_TAGLINE;

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
          '<div style="display:flex;justify-content:space-between;padding:7px 12px;font-size:12px;border-bottom:1px solid #eee;"><span>Total</span><span>Q ' + Number(sale.total).toFixed(2) + '</span></div>' +
          '<div style="display:flex;justify-content:space-between;padding:7px 12px;background:#1D9E75;color:#fff;font-weight:700;font-size:14px;"><span>TOTAL</span><span>Q ' + Number(sale.total).toFixed(2) + '</span></div>' +
        '</div>' +
      '</div>' +
      '<div style="border-top:2px dashed #ccc;padding-top:12px;font-size:10px;color:#999;display:flex;justify-content:space-between;">' +
        '<span>Generado por ' + sn + ' POS</span><span>' + fecha + ' · ' + hora + '</span>' +
      '</div>' +
      '<div style="text-align:center;margin-top:16px;font-size:13px;color:#1D9E75;font-weight:700;letter-spacing:1px;">¡Gracias por su compra!</div>' +
    '</div>'
  );
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
