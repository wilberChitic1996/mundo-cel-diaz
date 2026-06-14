// ── Generador de IDs únicos ──────────────────────────────
export const gid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

// ── Formato de moneda guatemalteca ───────────────────────
export const Q = (n) => `Q ${Number(n).toFixed(2)}`

// ── Formato de fecha ─────────────────────────────────────
export const fmtD = (d) =>
  new Date(d).toLocaleDateString('es-GT', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

// ── Formato de hora ──────────────────────────────────────
export const fmtT = (d) =>
  new Date(d).toLocaleTimeString('es-GT', {
    hour: '2-digit', minute: '2-digit',
  })
