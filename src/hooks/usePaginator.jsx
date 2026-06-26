// ══════════════════════════════════════════════════════════════════════════════
// HOOK: usePaginator
//
// Maneja la paginación de cualquier lista de elementos.
// Devuelve la página actual, el componente Pager (botones de navegación)
// y una función para resetear a la página 1.
//
// Uso:
//   var pag = usePaginator(listaCompleta, 20);
//   // pag.paged   → elementos de la página actual
//   // pag.Pager   → componente <Pager/> con los botones
//   // pag.offset  → índice absoluto del primer elemento (para numeración)
//   // pag.resetPage() → vuelve a la página 1 (llamar cuando cambia el filtro)
//
// Ejemplo con PagTable:
//   <PagTable pag={pag} cols={[...]} empty="Sin registros"/>
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';

// Estilos de botones de paginación (inline para no depender de CSS externo)
function mkBtnStyle(active) {
  return {
    padding: '4px 9px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 500,
    background: active ? '#1D9E75' : '#eeede9',
    color: active ? '#fff' : '#1a1a1a',
    minWidth: 28,
  };
}
function mkNavBtnStyle(disabled) {
  return {
    padding: '4px 8px',
    borderRadius: 8,
    border: 'none',
    cursor: disabled ? 'default' : 'pointer',
    fontSize: 11,
    fontWeight: 500,
    background: '#eeede9',
    color: '#1a1a1a',
    opacity: disabled ? 0.4 : 1,
  };
}

export function usePaginator(items, perPage) {
  var _p = useState(1);
  var page = _p[0];
  var setPage = _p[1];

  var total    = Math.ceil(items.length / perPage) || 1;
  var safePage = Math.min(page, total);
  var paged    = items.slice((safePage - 1) * perPage, safePage * perPage);
  var offset   = (safePage - 1) * perPage;

  // Componente de botones de navegación entre páginas
  function Pager() {
    if (total <= 1) return null;

    // Mostrar solo páginas cercanas a la actual (máx 5 botones)
    var pages = [];
    for (var i = 1; i <= total; i++) pages.push(i);
    var visiblePages = pages.filter(function(p) { return Math.abs(p - safePage) <= 2; });

    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', marginTop: 8, borderTop: '1px solid rgba(0,0,0,0.07)' }}>
        {/* Contador de registros */}
        <span style={{ fontSize: 12, color: '#999' }}>
          {items.length} registros · Pág. {safePage} de {total}
        </span>
        {/* Botones de navegación */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button disabled={safePage <= 1} onClick={function() { setPage(1); }}            style={mkNavBtnStyle(safePage <= 1)}>«</button>
          <button disabled={safePage <= 1} onClick={function() { setPage(safePage - 1); }} style={mkNavBtnStyle(safePage <= 1)}>‹</button>
          {visiblePages.map(function(p) {
            return (
              <button key={p} onClick={function() { setPage(p); }} style={mkBtnStyle(p === safePage)}>
                {p}
              </button>
            );
          })}
          <button disabled={safePage >= total} onClick={function() { setPage(safePage + 1); }} style={mkNavBtnStyle(safePage >= total)}>›</button>
          <button disabled={safePage >= total} onClick={function() { setPage(total); }}         style={mkNavBtnStyle(safePage >= total)}>»</button>
        </div>
      </div>
    );
  }

  return {
    paged:     paged,
    Pager:     Pager,
    offset:    offset,
    resetPage: function() { setPage(1); },
  };
}
