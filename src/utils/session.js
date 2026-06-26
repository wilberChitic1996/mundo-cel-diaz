// ══════════════════════════════════════════════════════════════════════════════
// MANEJO DE SESIÓN DEL USUARIO
//
// La sesión se guarda en sessionStorage (se borra al cerrar el navegador).
// Contiene el usuario autenticado y expira automáticamente a las 8 horas.
//
// Funciones disponibles:
//   getSession()        → devuelve la sesión activa o null si expiró/no existe
//   createSession(user) → crea una nueva sesión para el usuario
//   clearSession()      → cierra la sesión (logout)
// ══════════════════════════════════════════════════════════════════════════════

import { SESS_KEY } from '../constants/index.js';

// Duración de la sesión: 8 horas en milisegundos
var SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

/**
 * Devuelve la sesión activa del usuario.
 * Si no hay sesión o ya expiró, devuelve null y limpia el storage.
 */
export function getSession() {
  try {
    var s = JSON.parse(sessionStorage.getItem(SESS_KEY) || 'null');
    if (!s) return null;
    // Verificar si la sesión expiró
    if (Date.now() > s.expiresAt) {
      sessionStorage.removeItem(SESS_KEY);
      return null;
    }
    return s;
  } catch (e) {
    return null;
  }
}

/**
 * Crea una nueva sesión para el usuario autenticado.
 * Guarda en sessionStorage y devuelve el objeto de sesión.
 */
export function createSession(user) {
  var s = {
    userId:    user.id,
    name:      user.name,
    email:     user.email,
    role:      user.role,
    tenant_id: user.tenant_id || null,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  };
  sessionStorage.setItem(SESS_KEY, JSON.stringify(s));
  return s;
}

/**
 * Cierra la sesión del usuario (logout).
 * Elimina los datos de sessionStorage.
 */
export function clearSession() {
  sessionStorage.removeItem(SESS_KEY);
}

/**
 * Verifica si un rol tiene acceso a una vista específica.
 * Usa la tabla de permisos definida en constants/index.js.
 */
export function canAccess(role, view) {
  // Importar PERMS aquí para evitar dependencia circular
  var PERMS = {
    superadmin: ['superadmin'],
    admin:      ['dashboard','pos','caja','accounts','returns','defective','products','catalogos','inventory','history','backup','users','clients','repairs','cuadres','audit','warranties','storeconfig','suppliers','ayuda'],
    cajero:     ['dashboard','pos','caja','accounts','returns','history','clients','repairs','warranties','ayuda'],
    auditor:    ['dashboard','caja','history','inventory','cuadres','ayuda'],
  };
  var p = PERMS[role] || [];
  return p.indexOf(view) >= 0;
}
