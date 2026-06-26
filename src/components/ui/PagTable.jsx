// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE: PagTable (Tabla Paginada)
//
// Tabla genérica con paginación incorporada.
// Se usa en conjunto con el hook usePaginator.
//
// Props:
//   pag       {Object}   — resultado de usePaginator(items, perPage)
//   cols      {Array}    — definición de columnas:
//                          [{ label: "Nombre", render: (row) => row.name, thStyle?, tdStyle? }]
//   empty     {string}   — texto cuando no hay registros (por defecto: "Sin registros")
//   onRowClick {Function} — callback al hacer clic en una fila (opcional)
//
// La columna "#" con numeración absoluta entre páginas se agrega automáticamente.
//
// Uso:
//   var pag = usePaginator(ventas, 20);
//   <PagTable
//     pag={pag}
//     cols={[
//       { label: "Cliente", render: (row) => row.client },
//       { label: "Total",   render: (row) => "Q " + row.total },
//     ]}
//     empty="No hay ventas aún"
//   />
// ══════════════════════════════════════════════════════════════════════════════

import React from 'react';

// Estilos de tabla (inline para no depender de CSS externo)
var sTH = {
  textAlign: 'left', padding: '10px 12px',
  color: '#666', fontSize: 13,
  borderBottom: '1px solid rgba(0,0,0,0.08)',
  fontWeight: 500,
};
var sTD = {
  padding: '10px 12px',
  borderBottom: '1px solid rgba(0,0,0,0.05)',
  color: '#1a1a1a', fontSize: 14,
};

export default function PagTable({ pag, cols, empty, onRowClick }) {
  cols  = cols  || [];
  empty = empty || 'Sin registros';

  // Si no hay datos, mostrar mensaje vacío
  if (!pag.paged.length) {
    return <p style={{ textAlign: 'center', color: '#999', padding: 40 }}>{empty}</p>;
  }

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {/* Columna de numeración absoluta (continúa entre páginas) */}
              <th style={Object.assign({}, sTH, { width: 40, textAlign: 'center' })}>#</th>
              {cols.map(function(c, i) {
                return <th key={i} style={c.thStyle ? Object.assign({}, sTH, c.thStyle) : sTH}>{c.label}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {pag.paged.map(function(row, i) {
              return (
                <tr
                  key={row.id || i}
                  onClick={onRowClick ? function() { onRowClick(row); } : undefined}
                  style={onRowClick ? { cursor: 'pointer' } : undefined}
                >
                  {/* Número absoluto: continúa desde la página anterior */}
                  <td style={{ padding: '10px 8px', textAlign: 'center', color: '#bbb', fontSize: 12, borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                    {pag.offset + i + 1}
                  </td>
                  {cols.map(function(c, ci) {
                    return (
                      <td key={ci} style={c.tdStyle ? Object.assign({}, sTD, c.tdStyle) : sTD}>
                        {c.render(row, i)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Botones de paginación al pie de la tabla */}
      <pag.Pager />
    </div>
  );
}
