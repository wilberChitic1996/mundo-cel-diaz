// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA: AyudaScreen (Manual de Usuario)
//
// Manual interactivo con acordeones (secciones que se abren/cierran).
// El contenido visible se filtra según el rol del usuario:
//   - admin:   ve todo
//   - cajero:  ve POS, Cuentas, Reparaciones, Clientes, Caja
//   - auditor: ve Cuadres y Respaldo
//
// Props:
//   session {Object} — sesión del usuario (se usa session.role para filtrar)
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { TEAL, NAVY } from '../styles/theme.js';
import { APP_NAME } from '../constants/index.js';

// Secciones del manual con pasos y consejos por módulo
var SECCIONES = [
  {
    id: 'instalar', ic: '📲', titulo: 'Instalar la app en tu teléfono',
    pasos: [
      "En ANDROID: abrí el sitio en Chrome, tocá el menú ⋮ (arriba a la derecha) y elegí 'Instalar aplicación'. El ícono puede tardar unos segundos en aparecer — buscalo también en el cajón de aplicaciones (deslizando hacia arriba).",
      "En iPHONE: abrí el sitio en Safari, tocá el botón Compartir (el cuadrito con la flecha ↑, abajo al centro), deslizá hacia abajo y tocá 'Añadir a pantalla de inicio' y luego 'Añadir'. En iPhone NO aparece un botón 'Instalar' — así funciona Apple; este es el camino oficial.",
      "Listo: la app queda con su ícono y abre a pantalla completa, como cualquier aplicación.",
    ],
    tips: [
      "Si en Android no aparece el ícono, revisá que Chrome tenga permiso de 'crear accesos directos' (Ajustes → Aplicaciones → Chrome → Permisos).",
      "Si instalaste dos veces y hay íconos duplicados, mantené presionado uno y tocá 'Quitar/Desinstalar'.",
      "En iPhone usá Safari — otros navegadores en iPhone no siempre ofrecen la opción.",
    ],
  },
  {
    id: 'pos', ic: '🛒', titulo: 'Nueva Venta (Punto de Venta)',
    pasos: [
      "Tocá '🛒 Nueva Venta' en el menú lateral.",
      "Buscá el producto por nombre o código en la barra de búsqueda.",
      "Tocá el producto para agregarlo al carrito. Podés cambiar la cantidad tocando los botones + y −.",
      "Elegí el método de pago: Efectivo, Tarjeta o Transferencia.",
      "Si el cliente paga al contado, escribí cuánto entrega y el sistema calcula el vuelto.",
      "Si la venta es al crédito (fiado), seleccioná 'Crédito' y escribí el nombre del cliente. Esto crea una cuenta por cobrar automáticamente.",
      "Tocá '✓ Cobrar' para finalizar. El sistema imprime el comprobante y actualiza el stock.",
    ],
    tips: [
      "Podés aplicar descuento a un producto tocando su precio en el carrito.",
      "Para buscar más rápido, escaneá el código de barras si tenés un lector.",
    ],
  },
  {
    id: 'inventario', ic: '🗄️', titulo: 'Inventario',
    pasos: [
      "En '🗄️ Inventario' ves todos los productos con su stock actual.",
      "El stock cambia automáticamente al hacer ventas, devoluciones o compras a proveedores.",
      "Si un producto llega a su stock mínimo, aparece una alerta naranja en el Dashboard.",
      "Para ver el historial de precios y movimientos de un producto, tocá el producto y luego 'Ver historial'.",
    ],
    tips: [
      "Para agregar productos nuevos, andá a '📦 Productos' (solo administrador).",
      "El 'Costo' de un producto es el precio al que lo compraste. Sirve para calcular la ganancia en los Cuadres.",
      "La 'Estantería' es donde guardás el producto físicamente (ej: 'Vitrina 2, fila 3').",
    ],
  },
  {
    id: 'cuentas', ic: '💳', titulo: 'Cuentas por Cobrar',
    pasos: [
      "Acá aparecen todos los clientes que compraron al fiado.",
      "El estado puede ser: Pendiente (no han pagado nada), Abono parcial (pagaron una parte) o Pagado (saldo en cero).",
      "Para registrar un pago, tocá 'Atender →' en la cuenta del cliente.",
      "Escribí el monto recibido, el método (Efectivo/Transferencia/Tarjeta) y tocá '✓ Registrar pago'.",
      "Si querés enviarle un recordatorio de cobro por WhatsApp, tocá el botón 💬 verde.",
      "Para enviar recordatorio a varios clientes a la vez, usá el botón '📱 Recordatorio masivo'.",
    ],
    tips: [
      "La sección 'Antigüedad de cuentas' muestra cuánto tiempo llevan sin pagar (0-30, 31-60, 61-90, +90 días).",
      "Podés exportar la lista de cuentas a Excel o PDF para llevar tu control.",
    ],
  },
  {
    id: 'reparaciones', ic: '🔧', titulo: 'Reparaciones',
    pasos: [
      "Al recibir un equipo, tocá '+ Nueva Reparación' y llenás: cliente, marca, modelo, problema y técnico asignado.",
      "El flujo de estados es: Recibido → En revisión → Esperando repuesto → Listo → Entregado.",
      "Para cambiar el estado, abrí la reparación y tocá el estado nuevo.",
      "Cuando el equipo esté 'Listo', el Dashboard muestra una alerta para avisarte.",
      "Al marcar 'Entregado' y cobrar, podés enviar el comprobante por WhatsApp al cliente.",
    ],
    tips: [
      "Podés crear una Garantía automáticamente desde la pantalla de reparación.",
      "Las reparaciones vencidas (sin actualizar en varios días) aparecen en alerta roja en el Dashboard.",
    ],
  },
  {
    id: 'clientes', ic: '👥', titulo: 'Clientes',
    pasos: [
      "Guardá los datos de tus clientes: nombre, teléfono, NIT y dirección.",
      "El teléfono es importante — se usa para enviar comprobantes y recordatorios por WhatsApp automáticamente.",
      "Desde el perfil de un cliente podés ver todas sus compras, cuentas y reparaciones.",
      "Para agregar un cliente nuevo, tocá '+ Nuevo Cliente'.",
    ],
    tips: [
      "También podés crear clientes directamente desde la pantalla de Nueva Venta al hacer una venta al crédito.",
    ],
  },
  {
    id: 'cuadres', ic: '📈', titulo: 'Cuadres y Reportes',
    pasos: [
      "Elegí el período: Hoy, Esta semana, Este mes, Mes anterior o un rango personalizado.",
      "Verás el total de ventas, ingresos por método de pago, devoluciones y ganancia bruta.",
      "La 'Ganancia bruta' solo aparece si cargaste el costo de los productos en el inventario.",
      "Podés imprimir el cuadre completo o exportarlo a Excel desde los botones en la parte superior.",
    ],
    tips: [
      "El cuadre es diferente al cierre de caja. El cierre de caja es del día; el cuadre puede abarcar cualquier período.",
      "La sección 'Más rentables' muestra qué productos generaron más ganancia en el período.",
    ],
  },
  {
    id: 'caja', ic: '💵', titulo: 'Apertura y Cierre de Caja',
    pasos: [
      "Al inicio del día, andá a '💵 Caja' y tocá 'Abrir caja'. Ingresá el efectivo inicial (fondo de cambio).",
      "Durante el día, el sistema lleva el saldo automáticamente.",
      "Al final del día, tocá 'Cerrar caja'. El sistema muestra el resumen del día y genera un respaldo automático.",
      "El cierre imprime un voucher con el detalle de ventas, abonos y reembolsos del día.",
    ],
    tips: [
      "Si el efectivo físico no cuadra con el sistema, revisá si hay ventas sin registrar o reembolsos.",
    ],
  },
  {
    id: 'respaldo', ic: '💾', titulo: 'Respaldo de Datos',
    pasos: [
      "Tus datos están guardados en la nube (Supabase) de forma automática.",
      "Para bajar una copia local, andá a '💾 Respaldo' y tocá 'Descargar Excel completo'.",
      "El sistema también hace un respaldo automático cada vez que cerrás la caja.",
      "Se recomienda hacer un respaldo manual una vez por semana.",
    ],
    tips: [
      "El archivo Excel tiene 13 hojas: Productos, Ventas, Detalle de Ventas, Cuentas, Pagos, Clientes, Reparaciones y más.",
      "Si aparece la alerta amarilla de respaldo en el Dashboard, significa que hace más de 7 días que no respaldás.",
    ],
  },
];

// Qué secciones puede ver cada rol
var ROL_SECCIONES = {
  cajero:  ['instalar', 'pos', 'cuentas', 'reparaciones', 'clientes', 'caja'],
  auditor: ['instalar', 'cuadres', 'respaldo'],
};

// Estilos reutilizables dentro de esta pantalla
var sCard = { background: '#fff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.09)', padding: '20px 24px' };
var H1    = { fontSize: 'clamp(17px,4vw,22px)', fontWeight: 600, margin: '0 0 16px', color: '#1a1a1a' };

export default function AyudaScreen({ session }) {
  session = session || {};

  var _open = useState(null);
  var openSec    = _open[0];
  var setOpenSec = _open[1];

  // Alternar la sección abierta (si ya está abierta, la cierra)
  function toggle(id) { setOpenSec(openSec === id ? null : id); }

  // Filtrar secciones según el rol del usuario
  var visible = SECCIONES.filter(function(s) {
    var permitidos = ROL_SECCIONES[session.role];
    if (!permitidos) return true; // admin y superadmin ven todo
    return permitidos.indexOf(s.id) >= 0;
  });

  return (
    <div>
      <p style={H1}>📖 Manual de Usuario</p>

      {/* Encabezado con gradiente */}
      <div style={Object.assign({}, sCard, { marginBottom: 16, background: 'linear-gradient(135deg,' + NAVY + ' 0%,#1a3a2a 100%)', padding: '16px 20px' })}>
        <p style={{ color: '#fff', fontWeight: 700, fontSize: 15, margin: '0 0 4px' }}>Bienvenido a la guía de {APP_NAME}</p>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, margin: 0 }}>Tocá cada sección para ver los pasos y consejos. Si tenés dudas, contactá a tu administrador.</p>
      </div>

      {/* Lista de acordeones por módulo */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visible.map(function(sec) {
          var isOpen = openSec === sec.id;
          return (
            <div key={sec.id} style={{ borderRadius: 12, border: '1px solid ' + (isOpen ? '#1D9E75' : 'rgba(0,0,0,0.1)'), overflow: 'hidden', transition: 'border-color 0.2s' }}>
              {/* Cabecera del acordeón */}
              <button
                onClick={function() { toggle(sec.id); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: isOpen ? '#f0faf6' : '#fff', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <span style={{ fontWeight: 700, fontSize: 15, color: isOpen ? TEAL : NAVY }}>{sec.ic} {sec.titulo}</span>
                <span style={{ fontSize: 18, color: isOpen ? TEAL : '#aaa', transition: 'transform 0.2s', display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'none' }}>›</span>
              </button>

              {/* Contenido expandido: pasos y consejos */}
              {isOpen && (
                <div style={{ padding: '0 18px 18px', background: '#fff' }}>
                  <p style={{ fontWeight: 600, fontSize: 13, color: '#555', margin: '0 0 10px', borderBottom: '1px solid #eee', paddingBottom: 8 }}>Pasos</p>
                  <ol style={{ margin: '0 0 16px', paddingLeft: 20 }}>
                    {sec.pasos.map(function(p, i) {
                      return <li key={i} style={{ fontSize: 14, color: '#333', marginBottom: 8, lineHeight: 1.6 }}>{p}</li>;
                    })}
                  </ol>
                  {sec.tips && sec.tips.length > 0 && (
                    <div style={{ background: '#f0faf6', borderRadius: 8, padding: '10px 14px', borderLeft: '3px solid ' + TEAL }}>
                      <p style={{ fontWeight: 700, fontSize: 12, color: TEAL, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>💡 Consejos</p>
                      {sec.tips.map(function(t, i) {
                        return <p key={i} style={{ fontSize: 13, color: '#444', margin: i < sec.tips.length - 1 ? '0 0 6px' : 0, lineHeight: 1.5 }}>• {t}</p>;
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Enlace de contacto con soporte */}
      <div style={Object.assign({}, sCard, { marginTop: 16, textAlign: 'center', background: '#f5f4f0' })}>
        <p style={{ fontSize: 13, color: '#666', margin: '0 0 4px' }}>¿Necesitás más ayuda?</p>
        <a
          href={'https://wa.me/50254707112?text=' + encodeURIComponent('Hola, necesito ayuda con el sistema ' + APP_NAME + '.')}
          target="_blank"
          rel="noreferrer"
          style={{ color: TEAL, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}
        >
          💬 Contactar soporte por WhatsApp →
        </a>
      </div>
    </div>
  );
}
