// ── Colores principales ──────────────────────────────────
export const TEAL   = '#1D9E75'
export const NAVY   = '#1a2535'

// ── Estilos reutilizables ────────────────────────────────
export const sCard = {
  background: '#fff',
  borderRadius: 12,
  border: '1px solid rgba(0,0,0,0.09)',
  padding: '20px 24px',
}

export const sInput = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid rgba(0,0,0,0.2)',
  fontSize: 14,
  background: '#fff',
  color: '#1a1a1a',
  boxSizing: 'border-box',
}

export const sLabel = {
  fontSize: 13,
  color: '#666',
  marginBottom: 4,
  display: 'block',
}

export const sTH = {
  textAlign: 'left',
  padding: '10px 12px',
  color: '#666',
  fontSize: 13,
  borderBottom: '1px solid rgba(0,0,0,0.08)',
  fontWeight: 500,
}

export const sTD = {
  padding: '10px 12px',
  borderBottom: '1px solid rgba(0,0,0,0.05)',
  color: '#1a1a1a',
  fontSize: 14,
}

export const sQtyBtn = {
  cursor: 'pointer',
  background: '#f0efeb',
  width: 26,
  height: 26,
  borderRadius: 5,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 16,
  userSelect: 'none',
  flexShrink: 0,
  border: '1px solid rgba(0,0,0,0.1)',
}

export const H1 = {
  fontSize: 22,
  fontWeight: 600,
  margin: '0 0 20px',
  color: '#1a1a1a',
}

// ── Helpers de estilo dinámico ───────────────────────────
export function mkBtn(c = 'teal') {
  const backgrounds = {
    teal:   TEAL,
    red:    '#E24B4A',
    blue:   '#378ADD',
    purple: '#7F77DD',
    gray:   '#eeede9',
  }
  return {
    padding: '8px 14px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    background: backgrounds[c] ?? '#eeede9',
    color: c === 'gray' ? '#1a1a1a' : '#fff',
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
  }
  const [bg, color] = map[c] ?? map.teal
  return {
    display: 'inline-block',
    padding: '2px 9px',
    borderRadius: 20,
    fontSize: 12,
    background: bg,
    color,
    fontWeight: 500,
  }
}
