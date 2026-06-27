// ── Colores principales ──────────────────────────────────
export const TEAL   = '#1D9E75'
export const NAVY   = '#1a2535'

// ── Estilos reutilizables ────────────────────────────────
export const sCard = {
  background: 'var(--bg-card,#fff)',
  borderRadius: 14,
  border: '1px solid var(--border-card,rgba(0,0,0,0.07))',
  padding: '20px 24px',
  boxShadow: 'var(--shadow-md,0 2px 12px rgba(0,0,0,0.06))',
}

export const sInput = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 9,
  border: '1px solid var(--border-input,rgba(0,0,0,0.18))',
  fontSize: 14,
  background: 'var(--bg-input,#fff)',
  color: 'var(--text-primary,#111827)',
  boxSizing: 'border-box',
  transition: 'border-color 0.18s,box-shadow 0.18s',
}

export const sLabel = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--text-secondary,#6b7280)',
  marginBottom: 5,
  display: 'block',
  letterSpacing: '0.02em',
}

export const sTH = {
  textAlign: 'left',
  padding: '9px 12px',
  color: 'var(--text-secondary,#6b7280)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  borderBottom: '1px solid var(--border-table,rgba(0,0,0,0.07))',
  background: 'var(--bg-table-head,#f8f9fa)',
  whiteSpace: 'nowrap',
}

export const sTD = {
  padding: '11px 12px',
  borderBottom: '1px solid var(--border-row,rgba(0,0,0,0.04))',
  color: 'var(--text-primary,#111827)',
  fontSize: 13.5,
}

export const sQtyBtn = {
  cursor: 'pointer',
  background: 'var(--bg-alt,#f0efeb)',
  width: 28,
  height: 28,
  borderRadius: 7,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 16,
  userSelect: 'none',
  flexShrink: 0,
  border: '1px solid var(--border-card,rgba(0,0,0,0.1))',
}

export const H1 = {
  fontSize: 'clamp(17px,4vw,22px)',
  fontWeight: 700,
  margin: '0 0 20px',
  color: 'var(--text-primary,#111827)',
  letterSpacing: '-0.3px',
}

// ── Helpers de estilo dinámico ───────────────────────────
export function mkBtn(c = 'teal') {
  const backgrounds = {
    teal:   TEAL,
    red:    '#E24B4A',
    blue:   '#378ADD',
    purple: '#7F77DD',
    gray:   'var(--bg-alt,#eeede9)',
    green:  '#2E7D32',
    amber:  '#E65100',
  }
  return {
    padding: '8px 16px',
    borderRadius: 9,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    background: backgrounds[c] ?? 'var(--bg-alt,#eeede9)',
    color: c === 'gray' ? 'var(--text-primary,#111827)' : '#fff',
    letterSpacing: '0.01em',
  }
}

export function mkBadge(c = 'teal') {
  const map = {
    teal:   ['#E1F5EE', '#085041'],
    green:  ['#EAF3DE', '#27500A'],
    red:    ['#FCEBEB', '#791F1F'],
    amber:  ['#FAEEDA', '#633806'],
    purple: ['#EEEDFE', '#3C3489'],
    blue:   ['#E6F1FB', '#0C447C'],
    gray:   ['#F1EFE8', '#444441'],
  }
  const [bg, color] = map[c] ?? map.teal
  return {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 20,
    fontSize: 11.5,
    fontWeight: 600,
    background: bg,
    color,
    letterSpacing: '0.01em',
  }
}
