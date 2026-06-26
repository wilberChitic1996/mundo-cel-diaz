// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE: HelpTip
//
// Muestra un ícono "?" que al pasar el mouse (o hacer clic en móvil)
// despliega un tooltip con texto explicativo.
//
// Props:
//   text {string} — texto que aparece en el tooltip
//
// Uso:
//   <HelpTip text="El stock mínimo dispara una alerta cuando el inventario baja." />
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';

export default function HelpTip({ text }) {
  var _s = useState(false);
  var show    = _s[0];
  var setShow = _s[1];

  return (
    <span style={{ position: 'relative', display: 'inline-block', marginLeft: 6, verticalAlign: 'middle' }}>
      {/* Botón "?" */}
      <span
        onMouseEnter={function() { setShow(true); }}
        onMouseLeave={function() { setShow(false); }}
        onClick={function()      { setShow(!show); }}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 18, height: 18, borderRadius: '50%',
          background: '#e0e0e0', color: '#555',
          fontSize: 11, fontWeight: 700,
          cursor: 'pointer', userSelect: 'none', flexShrink: 0,
        }}
      >
        ?
      </span>

      {/* Tooltip — aparece encima del ícono */}
      {show && (
        <span style={{
          position: 'absolute', zIndex: 9999,
          bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
          background: '#1a2535', color: '#fff',
          fontSize: 12, lineHeight: 1.5,
          padding: '8px 12px', borderRadius: 8,
          whiteSpace: 'pre-wrap', minWidth: 200, maxWidth: 280,
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          pointerEvents: 'none',
        }}>
          {text}
          {/* Triángulo apuntando hacia abajo */}
          <span style={{
            position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)',
            width: 10, height: 10, background: '#1a2535',
            clipPath: 'polygon(0 0,100% 0,50% 100%)',
          }} />
        </span>
      )}
    </span>
  );
}
