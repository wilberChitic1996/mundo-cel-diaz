// ══════════════════════════════════════════════════════════════════════════════
// HOOK: useIsMobile
//
// Detecta si la pantalla es móvil (menor al breakpoint dado).
// Se actualiza automáticamente cuando el usuario redimensiona la ventana.
//
// Uso:
//   var isMobile = useIsMobile();        // breakpoint por defecto: 768px
//   var isMobile = useIsMobile(1024);    // breakpoint personalizado
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';

export function useIsMobile(bp) {
  bp = bp || 768;
  var _w = useState(function() { return window.innerWidth <= bp; });
  var isMobile = _w[0];
  var setIsMobile = _w[1];

  useEffect(function() {
    function handleResize() { setIsMobile(window.innerWidth <= bp); }
    window.addEventListener('resize', handleResize);
    // Limpiar el event listener al desmontar el componente
    return function() { window.removeEventListener('resize', handleResize); };
  }, [bp]);

  return isMobile;
}
