// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA: CatalogosScreen (Catálogos — Categorías y Ubicaciones)
//
// Permite al administrador gestionar las listas cerradas que usan los productos:
//   - Categorías: agrupan productos por tipo (Baterías, Pantallas, Fundas…)
//   - Ubicaciones: representan estantes físicos (Vitrina 1, Bodega…)
//
// Los productos solo pueden usar valores de estas listas, así el inventario
// mantiene datos consistentes y sin erratas.
//
// Regla de integridad: no se puede eliminar una categoría o ubicación si
// hay productos que la usan (se muestra el conteo para ayudar).
//
// Props:
//   categories      {Array}    — lista de categorías del sistema
//   locations       {Array}    — lista de ubicaciones/estantes
//   products        {Array}    — lista de productos (para contar uso)
//   reloadCatalogos {Function} — recarga categories y locations desde el servidor
//   showFlash       {Function} — muestra notificación flotante (msg, tipo)
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { TEAL, sCard, sInput, sLabel, sTH, sTD, mkBtn } from '../styles/theme.js';
import { categoriesAPI, locationsAPI } from '../utils/api.js';

var H1 = { fontSize: 'clamp(17px,4vw,22px)', fontWeight: 600, margin: '0 0 16px', color: 'var(--text-primary,#1a1a1a)' };

export default function CatalogosScreen({ categories, locations, products, reloadCatalogos, showFlash }) {
  categories      = categories      || [];
  locations       = locations       || [];
  products        = products        || [];
  reloadCatalogos = reloadCatalogos || function() {};
  showFlash       = showFlash       || function() {};

  // Tab activo: "categorias" o "ubicaciones"
  var _t    = useState('categorias'); var tab    = _t[0]; var setTab    = _t[1];
  // Texto del nuevo campo a agregar
  var _nc   = useState('');           var newCat = _nc[0]; var setNewCat = _nc[1];
  var _nl   = useState('');           var newLoc = _nl[0]; var setNewLoc = _nl[1];
  // Bloquea el botón mientras espera respuesta del servidor
  var _busy = useState(false);        var busy   = _busy[0]; var setBusy   = _busy[1];

  // Cuenta cuántos productos usan una categoría (para bloquear borrado)
  function contarPorCategoria(id, nombre) {
    // Cuenta tambien productos legacy que solo llevan el nombre en texto (sin category_id)
    var nm = String(nombre || '').trim().toLowerCase();
    return products.filter(function(p) {
      return String(p.category_id) === String(id) || (!p.category_id && nm && String(p.category || '').trim().toLowerCase() === nm);
    }).length;
  }

  // Cuenta cuántos productos usan una ubicación (para bloquear borrado)
  function contarPorUbicacion(id, nombre) {
    // Cuenta tambien productos legacy que solo llevan el mueble en shelf (sin location_id)
    var nm = String(nombre || '').trim().toLowerCase();
    return products.filter(function(p) {
      if (String(p.location_id) === String(id)) return true;
      if (p.location_id || !nm) return false;
      var sh = String(p.shelf || '').trim().toLowerCase();
      return sh === nm || sh.indexOf(nm + ' ') === 0;
    }).length;
  }

  // ── Acciones de Categorías ──────────────────────────────────────────────────

  async function agregarCategoria() {
    var nombre = (newCat || '').trim();
    if (!nombre) return;
    // Verificar que no exista ya con ese nombre (sin distinguir mayúsculas)
    if (categories.find(function(c) { return c.name.toLowerCase() === nombre.toLowerCase(); })) {
      showFlash('⚠️ Ya existe la categoría "' + nombre + '"', 'err');
      return;
    }
    setBusy(true);
    try {
      await categoriesAPI.create({ name: nombre });
      setNewCat('');
      reloadCatalogos();
      showFlash('✅ Categoría creada', 'ok');
    } catch (e) {
      showFlash('⛔ ' + ((e && e.error) || 'Error al crear categoría'), 'err');
    }
    setBusy(false);
  }

  async function eliminarCategoria(c) {
    if (contarPorCategoria(c.id, c.name) > 0) {
      showFlash('⚠️ No se puede eliminar: hay productos en "' + c.name + '"', 'err');
      return;
    }
    if (!window.confirm('¿Eliminar la categoría "' + c.name + '"?')) return;
    try {
      await categoriesAPI.remove(c.id);
      reloadCatalogos();
      showFlash('Categoría eliminada', 'ok');
    } catch (e) {
      showFlash('⛔ ' + ((e && e.error) || 'Error al eliminar'), 'err');
    }
  }

  async function renombrarCategoria(c) {
    var nuevoNombre = window.prompt('Nuevo nombre para la categoría:', c.name);
    if (nuevoNombre === null) return;
    nuevoNombre = nuevoNombre.trim();
    if (!nuevoNombre || nuevoNombre === c.name) return;
    try {
      await categoriesAPI.update(c.id, { name: nuevoNombre });
      reloadCatalogos();
      showFlash('✅ Categoría actualizada', 'ok');
    } catch (e) {
      showFlash('⛔ ' + ((e && e.error) || 'Error al actualizar'), 'err');
    }
  }

  // ── Acciones de Ubicaciones ─────────────────────────────────────────────────

  async function agregarUbicacion() {
    var nombre = (newLoc || '').trim();
    if (!nombre) return;
    if (locations.find(function(l) { return l.name.toLowerCase() === nombre.toLowerCase(); })) {
      showFlash('⚠️ Ya existe la ubicación "' + nombre + '"', 'err');
      return;
    }
    setBusy(true);
    try {
      await locationsAPI.create({ name: nombre });
      setNewLoc('');
      reloadCatalogos();
      showFlash('✅ Ubicación creada', 'ok');
    } catch (e) {
      showFlash('⛔ ' + ((e && e.error) || 'Error al crear ubicación'), 'err');
    }
    setBusy(false);
  }

  async function eliminarUbicacion(l) {
    if (contarPorUbicacion(l.id, l.name) > 0) {
      showFlash('⚠️ No se puede eliminar: hay productos en "' + l.name + '"', 'err');
      return;
    }
    if (!window.confirm('¿Eliminar la ubicación "' + l.name + '"?')) return;
    try {
      await locationsAPI.remove(l.id);
      reloadCatalogos();
      showFlash('Ubicación eliminada', 'ok');
    } catch (e) {
      showFlash('⛔ ' + ((e && e.error) || 'Error al eliminar'), 'err');
    }
  }

  async function renombrarUbicacion(l) {
    var nuevoNombre = window.prompt('Nuevo nombre para la ubicación:', l.name);
    if (nuevoNombre === null) return;
    nuevoNombre = nuevoNombre.trim();
    if (!nuevoNombre || nuevoNombre === l.name) return;
    try {
      await locationsAPI.update(l.id, { name: nuevoNombre });
      reloadCatalogos();
      showFlash('✅ Ubicación actualizada', 'ok');
    } catch (e) {
      showFlash('⛔ ' + ((e && e.error) || 'Error al actualizar'), 'err');
    }
  }

  // Estilo del botón de tab (activo en verde, inactivo en gris)
  function estiloTab(activo) {
    return {
      padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
      fontSize: 14, fontWeight: 600,
      background: activo ? TEAL : '#eef1f4',
      color:      activo ? '#fff' : '#555',
    };
  }

  return (
    <div>
      <p style={H1}>🏷️ Catálogos</p>
      <p style={{ color: '#777', fontSize: 13, margin: '0 0 16px' }}>
        Administra las categorías y ubicaciones (estanterías). Los productos solo pueden usar valores de estas listas.
      </p>

      {/* Pestañas de navegación */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <button style={estiloTab(tab === 'categorias')} onClick={function() { setTab('categorias'); }}>
          Categorías ({categories.length})
        </button>
        <button style={estiloTab(tab === 'ubicaciones')} onClick={function() { setTab('ubicaciones'); }}>
          Ubicaciones ({locations.length})
        </button>
      </div>

      {/* ── Pestaña: Categorías ── */}
      {tab === 'categorias' && (
        <div style={sCard}>
          {/* Formulario para agregar nueva categoría */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <input
              style={Object.assign({}, sInput, { maxWidth: 320 })}
              placeholder="Nueva categoría (ej: Baterías)"
              value={newCat}
              onChange={function(e) { setNewCat(e.target.value); }}
              onKeyDown={function(e) { if (e.key === 'Enter') agregarCategoria(); }}
            />
            <button style={mkBtn('teal')} disabled={busy} onClick={agregarCategoria}>+ Agregar</button>
          </div>

          {/* Tabla de categorías existentes */}
          {categories.length === 0
            ? <p style={{ color: '#999', fontSize: 13 }}>Aún no hay categorías. Crea la primera arriba.</p>
            : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Categoría', 'Productos', ''].map(function(h) {
                      return <th key={h} style={sTH}>{h}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {categories.map(function(c) {
                    return (
                      <tr key={c.id}>
                        <td style={Object.assign({}, sTD, { fontWeight: 600 })}>
                          {(c.icon ? c.icon + ' ' : '') + c.name}
                        </td>
                        <td style={sTD}>{contarPorCategoria(c.id, c.name)}</td>
                        <td style={Object.assign({}, sTD, { textAlign: 'right' })}>
                          <button
                            style={Object.assign({}, mkBtn('blue'), { padding: '4px 10px', fontSize: 12, marginRight: 6 })}
                            onClick={function() { renombrarCategoria(c); }}
                          >✏</button>
                          <button
                            style={Object.assign({}, mkBtn('red'), { padding: '4px 10px', fontSize: 12 })}
                            onClick={function() { eliminarCategoria(c); }}
                          >🗑</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          }
        </div>
      )}

      {/* ── Pestaña: Ubicaciones ── */}
      {tab === 'ubicaciones' && (
        <div style={sCard}>
          <p style={{ fontSize: 12, color: '#888', margin: '0 0 12px' }}>
            El estante es el mueble (vitrina, rack, bodega). La posición exacta (bandeja/gaveta) se asigna en cada producto.
          </p>

          {/* Formulario para agregar nueva ubicación */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <input
              style={Object.assign({}, sInput, { maxWidth: 320 })}
              placeholder="Nuevo estante (ej: Vitrina 1, Bodega)"
              value={newLoc}
              onChange={function(e) { setNewLoc(e.target.value); }}
              onKeyDown={function(e) { if (e.key === 'Enter') agregarUbicacion(); }}
            />
            <button style={mkBtn('teal')} disabled={busy} onClick={agregarUbicacion}>+ Agregar</button>
          </div>

          {/* Tabla de ubicaciones existentes */}
          {locations.length === 0
            ? <p style={{ color: '#999', fontSize: 13 }}>Aún no hay ubicaciones. Crea la primera arriba.</p>
            : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Estante / Ubicación', 'Productos', ''].map(function(h) {
                      return <th key={h} style={sTH}>{h}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {locations.map(function(l) {
                    return (
                      <tr key={l.id}>
                        <td style={Object.assign({}, sTD, { fontWeight: 600 })}>{l.name}</td>
                        <td style={sTD}>{contarPorUbicacion(l.id, l.name)}</td>
                        <td style={Object.assign({}, sTD, { textAlign: 'right' })}>
                          <button
                            style={Object.assign({}, mkBtn('blue'), { padding: '4px 10px', fontSize: 12, marginRight: 6 })}
                            onClick={function() { renombrarUbicacion(l); }}
                          >✏</button>
                          <button
                            style={Object.assign({}, mkBtn('red'), { padding: '4px 10px', fontSize: 12 })}
                            onClick={function() { eliminarUbicacion(l); }}
                          >🗑</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          }
        </div>
      )}
    </div>
  );
}
