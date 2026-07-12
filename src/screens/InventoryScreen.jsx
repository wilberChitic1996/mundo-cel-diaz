// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA: InventoryScreen (Inventario)
//
// Vista de solo lectura del inventario organizado por sección de estantería.
// Tiene dos modos de visualización que el usuario puede alternar:
//
//   ▦ Resumen por sección
//     Muestra tarjetas agrupadas por sección del estante (A, B, C…).
//     Cada tarjeta muestra: cuántos productos hay, stock total y alertas de bajo stock.
//     Al hacer clic en una tarjeta se pasa automáticamente a Vista Lista filtrada.
//
//   ☰ Lista completa
//     Tabla paginada con todos los productos (sin servicios).
//     Permite buscar por nombre/código/ubicación y filtrar por sección.
//
// También permite exportar la lista completa a Excel o PDF.
//
// Props:
//   products {Array} — lista de productos (incluye servicios, los filtra internamente)
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { TEAL, NAVY, mkBtn, mkBadge } from '../styles/theme.js';
import { Q } from '../utils/formatters.js';
import { exportExcel, exportPDF } from '../utils/export.js';
import HelpTip from '../components/ui/HelpTip.jsx';

// Cuántos productos se muestran por página en la vista lista
var ITEMS_POR_PAGINA = 20;

var H1 = { fontSize: 'clamp(17px,4vw,22px)', fontWeight: 600, margin: 0, color: 'var(--text-primary,#1a1a1a)' };

export default function InventoryScreen({ products }) {
  products = products || [];

  // Búsqueda en la vista lista
  var _q   = useState('');        var busqueda  = _q[0];   var setBusqueda  = _q[1];
  // Vista activa: "resumen" o "lista"
  var _vw  = useState('resumen'); var vista     = _vw[0];  var setVista     = _vw[1];
  // Filtro por sección en la vista lista ('' = todas)
  var _sec = useState('');        var secFiltro = _sec[0]; var setSecFiltro = _sec[1];
  // Página actual de la lista
  var _pg  = useState(0);         var pagina    = _pg[0];  var setPagina    = _pg[1];

  // Solo productos físicos (excluir servicios que no tienen stock)
  var noServ  = products.filter(function(p) { return p.unit !== 'serv'; });
  var totalUd = noServ.reduce(function(s, p) { return s + p.stock; }, 0);

  // Construir mapa de secciones para la vista Resumen
  // La sección es la parte antes del guión en la ubicación (ej: "A" de "A3-2")
  var seccionesMap = {};
  noServ.forEach(function(p) {
    var sec = (p.shelf || 'Sin sección').split('-')[0] || 'Sin sección';
    if (!seccionesMap[sec]) seccionesMap[sec] = { count: 0, stock: 0, alertas: 0 };
    seccionesMap[sec].count++;
    seccionesMap[sec].stock  += p.stock;
    if (p.stock <= (Number(p.min_stock) > 0 ? Number(p.min_stock) : 4)) seccionesMap[sec].alertas++;
  });

  // Productos filtrados para la vista Lista
  var listaFiltrada = noServ.filter(function(p) {
    var q      = busqueda.toLowerCase();
    var matchQ = !q
      || (p.name  || '').toLowerCase().indexOf(q) >= 0
      || (p.code  || '').toLowerCase().indexOf(q) >= 0
      || (p.shelf || '').toLowerCase().indexOf(q) >= 0;
    var sec    = (p.shelf || 'Sin sección').split('-')[0] || 'Sin sección';
    var matchS = !secFiltro || sec === secFiltro;
    return matchQ && matchS;
  }).slice().sort(function(a, b) { return (a.shelf || '').localeCompare(b.shelf || ''); });

  var totalPaginas = Math.ceil(listaFiltrada.length / ITEMS_POR_PAGINA);
  var itemsPagina  = listaFiltrada.slice(pagina * ITEMS_POR_PAGINA, (pagina + 1) * ITEMS_POR_PAGINA);

  // Buscar en lista y cambiar a vista lista
  function buscar(q) { setBusqueda(q); setPagina(0); if (q) setVista('lista'); }

  // Hacer clic en sección: filtrar lista por esa sección
  function irSeccion(s) {
    setSecFiltro(s === secFiltro ? '' : s);
    setVista('lista');
    setPagina(0);
    setBusqueda('');
  }

  // Estilo de botón de tab
  function estiloTab(activo) {
    return {
      padding: '7px 16px', borderRadius: 6, cursor: 'pointer',
      border:      '1px solid ' + (activo ? TEAL : '#ddd'),
      background:  activo ? TEAL : '#fff',
      color:       activo ? '#fff' : '#555',
      fontWeight:  activo ? 700  : 400,
      fontSize:    13,
    };
  }

  return (
    <div>
      {/* Encabezado con exportaciones */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <p style={H1}>
          🗄️ Inventario
          <HelpTip text={'Lista completa de productos.\n\n• Vista Resumen: secciones con conteo y alertas\n• Vista Lista: tabla completa paginada con búsqueda y filtros'} />
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ background: '#f5f4f0', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: '#666' }}>
            <b>{noServ.length}</b> productos · <b style={{ color: TEAL }}>{totalUd}</b> uds
          </div>
          <button
            style={Object.assign({}, mkBtn('teal'), { padding: '6px 12px', fontSize: 12 })}
            onClick={function() {
              exportExcel(
                noServ.map(function(p) { return [p.code || '', p.name, p.category || '', p.shelf || '', p.stock, p.price.toFixed(2), p.cost.toFixed(2)]; }),
                ['Código', 'Nombre', 'Categoría', 'Ubicación', 'Stock', 'Precio', 'Costo'],
                'inventario'
              );
            }}
          >📊 Excel</button>
          <button
            style={Object.assign({}, mkBtn('blue'), { padding: '6px 12px', fontSize: 12 })}
            onClick={function() {
              exportPDF(
                'Inventario de Productos',
                ['Código', 'Nombre', 'Categoría', 'Ubic.', 'Stock', 'Precio', 'Costo'],
                noServ.map(function(p) { return [p.code || '', p.name, p.category || '', p.shelf || '', p.stock, 'Q' + p.price.toFixed(2), 'Q' + p.cost.toFixed(2)]; }),
                'inventario'
              );
            }}
          >📄 PDF</button>
        </div>
      </div>

      {/* Tabs de vista */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          style={estiloTab(vista === 'resumen')}
          onClick={function() { setVista('resumen'); setBusqueda(''); setSecFiltro(''); setPagina(0); }}
        >▦ Resumen por sección</button>
        <button
          style={estiloTab(vista === 'lista')}
          onClick={function() { setVista('lista'); setPagina(0); }}
        >☰ Lista completa</button>
      </div>

      {/* ── VISTA RESUMEN ── */}
      {vista === 'resumen' && (
        <div>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
            Tocá una sección para ver sus productos en detalle.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
            {Object.keys(seccionesMap).sort().map(function(sec) {
              var s = seccionesMap[sec];
              return (
                <div
                  key={sec}
                  onClick={function() { irSeccion(sec); }}
                  style={{
                    background: '#fff', borderRadius: 12, padding: 16, cursor: 'pointer', transition: 'box-shadow 0.15s',
                    border: '1px solid ' + (s.alertas > 0 ? '#F59E0B' : 'rgba(0,0,0,0.08)'),
                  }}
                  onMouseEnter={function(e) { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
                  onMouseLeave={function(e) { e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <p style={{ fontWeight: 700, fontSize: 15, margin: 0, color: NAVY }}>Sección {sec}</p>
                    {s.alertas > 0 && <span style={mkBadge('amber')}>{s.alertas}</span>}
                  </div>
                  <p style={{ fontSize: 13, color: '#666', margin: '0 0 4px' }}>{s.count} producto{s.count !== 1 ? 's' : ''}</p>
                  <p style={{ fontSize: 13, color: TEAL, fontWeight: 700, margin: 0 }}>{s.stock} uds en stock</p>
                  <p style={{ fontSize: 11, color: '#aaa', margin: '8px 0 0' }}>Ver productos →</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── VISTA LISTA ── */}
      {vista === 'lista' && (
        <div>
          {/* Filtros */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Buscar por nombre, código o ubicación..."
              value={busqueda}
              onChange={function(e) { buscar(e.target.value); }}
              style={{ flex: 1, minWidth: 200, padding: '9px 14px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, outline: 'none' }}
            />
            <select
              value={secFiltro}
              onChange={function(e) { setSecFiltro(e.target.value); setPagina(0); setBusqueda(''); }}
              style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, background: '#fff', color: '#333' }}
            >
              <option value="">Todas las secciones</option>
              {Object.keys(seccionesMap).sort().map(function(s) {
                return <option key={s} value={s}>Sección {s}</option>;
              })}
            </select>
            {(busqueda || secFiltro) && (
              <button
                onClick={function() { setBusqueda(''); setSecFiltro(''); setPagina(0); }}
                style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid #ddd', background: '#f5f4f0', cursor: 'pointer', fontSize: 13, color: '#666' }}
              >✕ Limpiar</button>
            )}
          </div>
          <p style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
            {listaFiltrada.length} producto{listaFiltrada.length !== 1 ? 's' : ''}
            {secFiltro ? ' en Sección ' + secFiltro : ''}
            {busqueda ? ' · búsqueda: "' + busqueda + '"' : ''}
          </p>

          {/* Tabla de inventario */}
          <div className="tbl-wrap" style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', maxHeight: 'calc(100vh - 320px)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: NAVY }}>
                  {['Ubicación', 'Código', 'Producto', 'Categoría', 'Stock', 'Precio'].map(function(h) {
                    return (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#fff', fontSize: 12, fontWeight: 700, background: NAVY }}>
                        {h}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {itemsPagina.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#aaa', fontSize: 14 }}>Sin resultados</td>
                  </tr>
                )}
                {itemsPagina.map(function(p, i) {
                  return (
                    <tr key={p.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                      <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 12, color: '#888' }}>{p.shelf || '—'}</td>
                      <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 12, color: '#555' }}>{p.code  || '—'}</td>
                      <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 500, color: NAVY }}>{p.name}</td>
                      <td style={{ padding: '9px 14px', fontSize: 12, color: '#666' }}>{p.category || '—'}</td>
                      <td style={{ padding: '9px 14px' }}>
                        <span style={mkBadge(p.stock === 0 ? 'red' : p.stock <= (Number(p.min_stock) > 0 ? Number(p.min_stock) : 4) ? 'amber' : 'green')}>{p.stock}</span>
                      </td>
                      <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 600, color: NAVY }}>Q{Number(p.price).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
              <button
                disabled={pagina === 0}
                onClick={function() { setPagina(pagina - 1); }}
                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #ddd', background: pagina === 0 ? '#f5f5f5' : '#fff', cursor: pagina === 0 ? 'default' : 'pointer', color: pagina === 0 ? '#ccc' : '#333' }}
              >‹ Anterior</button>
              <span style={{ fontSize: 13, color: '#666' }}>Página {pagina + 1} de {totalPaginas}</span>
              <button
                disabled={pagina >= totalPaginas - 1}
                onClick={function() { setPagina(pagina + 1); }}
                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #ddd', background: pagina >= totalPaginas - 1 ? '#f5f5f5' : '#fff', cursor: pagina >= totalPaginas - 1 ? 'default' : 'pointer', color: pagina >= totalPaginas - 1 ? '#ccc' : '#333' }}
              >Siguiente ›</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
