/**
 * Capa de abstracción de base de datos.
 *
 * AHORA:    usa localStorage del navegador.
 * FUTURO:   reemplazar load/save con llamadas a una API REST
 *           (Node.js + PostgreSQL / Supabase) sin tocar el resto del código.
 *
 * Ejemplo de migración futura:
 *   export const load = async (key) => {
 *     const res = await fetch(`/api/${key}`)
 *     return res.json()
 *   }
 *   export const save = async (key, data) => {
 *     await fetch(`/api/${key}`, { method:'PUT', body:JSON.stringify(data) })
 *   }
 */

// ── Claves de almacenamiento ─────────────────────────────
export const KEYS = {
  PRODUCTS:    'mnpos-prods-v5',
  SALES:       'mnpos-sales-v5',
  ACCOUNTS:    'mnpos-accounts-v2',
  RETURNS:     'mnpos-returns-v2',
  LAST_BACKUP: 'mnpos-last-backup',
}

// ── Cargar datos ─────────────────────────────────────────
export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

// ── Guardar datos ────────────────────────────────────────
export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.error('Error al guardar:', key, e)
  }
}

// ── Eliminar clave ───────────────────────────────────────
export function remove(key) {
  try {
    localStorage.removeItem(key)
  } catch { /* silencioso */ }
}
