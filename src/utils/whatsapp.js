// ══════════════════════════════════════════════════════════════════════════════
// UTILIDADES DE WHATSAPP
//
// Funciones para generar y enviar mensajes de WhatsApp.
// Todos los mensajes se abren en una nueva pestaña (wa.me).
//
// Funciones disponibles:
//   limpiarTel(tel)           → normaliza un número de teléfono (agrega 502 si es Guatemala)
//   abrirWA(tel, mensaje)     → abre WhatsApp con el número y mensaje dados
//   waBoletaVenta(sale, si)   → genera el texto de una boleta de venta
//   waRecordatorio(acc, si)   → genera el texto de recordatorio de deuda
//   pedirTelYEnviar(...)      → pide el número al usuario y envía el mensaje
// ══════════════════════════════════════════════════════════════════════════════

import { fmtD } from './formatters.js';
import { STORE_FALLBACK, APP_TAGLINE } from '../constants/index.js';

/**
 * Normaliza un número de teléfono para WhatsApp.
 * Si el número tiene 8 dígitos (Guatemala), agrega el código 502 al inicio.
 */
export function limpiarTel(tel) {
  if (!tel) return '';
  var t = String(tel).replace(/\D/g, ''); // Quitar todo lo que no sea número
  if (t.length === 8) return '502' + t;   // Guatemala: agregar código de país
  if (t.length > 8)  return t;            // Ya tiene código de país
  return t;
}

/**
 * Abre WhatsApp en una nueva pestaña con el mensaje pre-cargado.
 * Si hay número de teléfono, abre el chat directo; si no, abre el compositor general.
 */
export function abrirWA(tel, mensaje) {
  var t = limpiarTel(tel);
  var url = t
    ? 'https://wa.me/' + t + '?text=' + encodeURIComponent(mensaje)
    : 'https://wa.me/?text=' + encodeURIComponent(mensaje);
  // Crear un enlace temporal y hacer click para abrir en nueva pestaña
  var a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Genera el texto de una boleta de venta para WhatsApp.
 * @param {Object} sale - Objeto de venta con items, client, total, method, date
 * @param {Object} si   - Información de la tienda (store_name, store_tagline)
 */
export function waBoletaVenta(sale, si) {
  si = si || {};
  var sn = si.store_name || STORE_FALLBACK;
  var st = si.store_tagline || APP_TAGLINE;
  var items = (sale.items || []).map(function(i) {
    return '  • ' + i.name + ' x' + i.qty + ' — Q' + Number(i.price * i.qty).toFixed(2);
  }).join('\n');
  return (
    '✅ *' + sn + '*\n' + st + '\n\n' +
    '📋 *Boleta de compra*\n' +
    '📅 ' + fmtD(sale.date) + '\n' +
    '👤 ' + sale.client + '\n\n' +
    '*Productos:*\n' + items + '\n\n' +
    '💰 *Total: Q' + Number(sale.total).toFixed(2) + '*\n' +
    'Método: ' + (sale.method || 'Efectivo') + '\n\n' +
    '¡Gracias por su compra! 🙏'
  );
}

/**
 * Genera el texto de un recordatorio de deuda para WhatsApp.
 * @param {Object} acc - Objeto de cuenta por cobrar con client, balance, total, paid, date
 * @param {Object} si  - Información de la tienda
 */
export function waRecordatorio(acc, si) {
  si = si || {};
  var sn = si.store_name || STORE_FALLBACK;
  return (
    'Hola *' + acc.client + '*, le saludamos de *' + sn + '*.\n\n' +
    'Le recordamos que tiene un saldo pendiente de *Q' + Number(acc.balance).toFixed(2) + '* ' +
    'de su compra del ' + fmtD(acc.date || acc.created_at) + '.\n\n' +
    'Total de la compra: Q' + Number(acc.total).toFixed(2) + '\n' +
    'Ya abonado: Q' + Number(acc.paid).toFixed(2) + '\n' +
    '*Saldo pendiente: Q' + Number(acc.balance).toFixed(2) + '*\n\n' +
    'Por favor comuníquese con nosotros para coordinar su pago. ¡Gracias! 🙏'
  );
}

/**
 * Pide el número de WhatsApp al usuario mediante un prompt del navegador,
 * luego llama a compartirWhatsApp con ese número.
 * @param {string}   nombre     - Nombre del destinatario (para el prompt)
 * @param {Function} getMensaje - Función que devuelve el texto del mensaje
 * @param {Object}   opts       - Opciones adicionales para compartirWhatsApp
 */
export function pedirTelYEnviar(nombre, getMensaje, opts) {
  var tel = window.prompt(
    '📱 Número de WhatsApp de ' + nombre + '\n' +
    '(8 dígitos Guatemala, ej: 55551234)\n' +
    'Dejar vacío para abrir sin número:'
  );
  if (tel === null) return; // El usuario canceló el prompt
  // La función compartirWhatsApp se importa donde se use para evitar dependencias circulares
  abrirWA(tel.trim(), getMensaje());
}
