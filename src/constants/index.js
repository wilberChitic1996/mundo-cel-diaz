// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTES GLOBALES DEL SISTEMA
// Fuente única de verdad para nombres, versiones y configuración general.
// Si necesitás cambiar el nombre del sistema o la versión, hazlo aquí.
// ══════════════════════════════════════════════════════════════════════════════

// Nombre y versión del sistema
export const APP_NAME     = 'PraxisGT';
export const APP_VERSION  = '2.2';
export const APP_TAGLINE  = 'Sistema de Gestión Empresarial · Guatemala';

// Nombre de negocio por defecto cuando no hay configuración cargada
export const STORE_FALLBACK = 'Mi Negocio';

// ── Permisos por rol ──────────────────────────────────────────────────────────
// Cada rol tiene acceso a un conjunto de vistas. Si agregás una nueva pantalla,
// añadí su ID aquí en los roles que correspondan.
export const PERMS = {
  superadmin: ['superadmin'],
  admin:      ['dashboard','pos','caja','accounts','returns','defective','products','catalogos','inventory','history','backup','users','clients','repairs','cuadres','audit','warranties','storeconfig','suppliers','ayuda','migracion'],
  cajero:     ['dashboard','pos','caja','accounts','returns','history','clients','repairs','warranties','ayuda'],
  auditor:    ['dashboard','caja','history','inventory','cuadres','ayuda'],
};

// Etiquetas y colores de rol para mostrar en la UI
export const ROLE_LABEL = { superadmin: 'Super Admin', admin: 'Administrador', cajero: 'Cajero', auditor: 'Auditor' };
export const ROLE_COLOR = { superadmin: '#9B59B6', admin: '#1D9E75', cajero: '#378ADD', auditor: '#7F77DD' };

// ── Módulos visibles en la landing page ──────────────────────────────────────
// Estos son los módulos que se muestran en la página pública de presentación.
// No afectan la lógica del sistema, solo la descripción comercial.
export const PLATFORM_FEATURES = [
  { ic: '🛒', title: 'Punto de Venta',        desc: 'Registra ventas en segundos. Efectivo, tarjeta, transferencia. Genera recibos y comprobantes al instante.' },
  { ic: '💳', title: 'Cuentas por Cobrar',     desc: 'Controla ventas a crédito, abonos y saldos pendientes. Envía recordatorios por WhatsApp con un clic.' },
  { ic: '🔧', title: 'Taller de Reparaciones', desc: 'Órdenes de servicio completas con seguimiento de estado, repuestos, costos y fecha de entrega.' },
  { ic: '📦', title: 'Inventario Inteligente', desc: 'Stock en tiempo real. Alertas de bajo inventario. Historial de cambios de precio y movimientos.' },
  { ic: '👥', title: 'Clientes',               desc: 'Base de datos de clientes con historial completo de compras, reparaciones y cuentas pendientes.' },
  { ic: '📊', title: 'Reportes y Cuadres',     desc: 'Gráficas de ventas, ingresos diarios, top productos y cierre de caja con arqueo formal.' },
  { ic: '🏭', title: 'Proveedores y Compras',  desc: 'Registra compras, actualiza stock automáticamente y lleva el historial de tus proveedores.' },
  { ic: '🛡️', title: 'Garantías',              desc: 'Registra garantías de ventas y reparaciones. Alertas automáticas de vencimiento.' },
  { ic: '💵', title: 'Caja y Arqueo',          desc: 'Control de caja chica, ingresos, egresos y cierre formal de caja con reporte imprimible.' },
  { ic: '🔄', title: 'Devoluciones',           desc: 'Gestiona devoluciones de ventas con registro de motivo, estado del producto y reembolso.' },
  { ic: '📋', title: 'Auditoría',              desc: 'Registro completo de todas las acciones del sistema por usuario, fecha y módulo.' },
];

// ── Claves de almacenamiento local ────────────────────────────────────────────
// Se usan para guardar datos en el navegador del usuario (localStorage/sessionStorage).
// Si cambiás el nombre de una clave, los datos viejos quedan huérfanos en el navegador.
export const SESS_KEY = 'mnpos-session-v1'; // Clave de sesión activa
export const PK  = 'mnpos-prods-v5';        // Cache de productos (IndexedDB)
export const SK  = 'mnpos-sales-v5';        // Cache de ventas
export const AK  = 'mnpos-accounts-v2';     // Cache de cuentas por cobrar
export const RK  = 'mnpos-returns-v2';      // Cache de devoluciones
export const DFK = 'mnpos-defective-v1';    // Cache de defectuosos
export const CK  = 'mnpos-clients-v1';      // Cache de clientes
