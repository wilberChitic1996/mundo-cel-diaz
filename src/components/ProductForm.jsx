// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE: ProductForm (Formulario de Producto)
//
// Formulario inline para crear o editar un producto.
// Aparece encima de la tabla en ProductsScreen.
//
// Validaciones:
//   - Nombre obligatorio
//   - Categoría obligatoria (debe elegirse de la lista)
//   - Precio de venta obligatorio y mayor a cero
//
// Al guardar, resuelve category_id → nombre de categoría y
// location_id + position → campo legacy "shelf" (ej: "Vitrina 1 · B3").
// Esto mantiene compatibilidad con código antiguo que aún lee "shelf" como texto.
//
// Props:
//   product    {Object}   — producto a editar (o {} para crear nuevo)
//   categories {Array}    — lista de categorías disponibles
//   locations  {Array}    — lista de ubicaciones disponibles
//   onSave     {Function} — (productoGuardado) — llamada al confirmar
//   onCancel   {Function} — llamada al cancelar
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { TEAL, sCard, sInput, sLabel, mkBtn } from '../styles/theme.js';

// Opciones de unidad de medida
var UNIT_OPTIONS = [
  { v: 'uni',  l: 'Unidad (uni)'   },
  { v: 'pza',  l: 'Pieza (pza)'    },
  { v: 'serv', l: 'Servicio (serv)' },
];

// Convierte la primera letra a mayúscula
function titleCase(str) {
  str = str.trim();
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default function ProductForm({ product, categories, locations, onSave, onCancel }) {
  product    = product    || {};
  categories = categories || [];
  locations  = locations  || [];

  // Estado del formulario — inicializado con los datos del producto a editar
  var _s = useState(Object.assign({}, product));
  var form    = _s[0];
  var setForm = _s[1];

  // Mensaje de error de validación
  var _e = useState('');
  var err    = _e[0];
  var setErr = _e[1];

  // Actualiza un campo del formulario y limpia el error
  function set(campo, valor) {
    setErr('');
    setForm(function(f) {
      var nuevo = Object.assign({}, f);
      nuevo[campo] = valor;
      return nuevo;
    });
  }

  function guardar() {
    if (!form.name || !form.name.trim()) {
      setErr('El nombre es obligatorio');
      return;
    }
    if (!form.category_id) {
      setErr('La categoría es obligatoria — elígela de la lista');
      return;
    }
    if (!form.price || isNaN(parseFloat(form.price)) || parseFloat(form.price) <= 0) {
      setErr('El precio es obligatorio y debe ser mayor que 0');
      return;
    }

    // Resolver nombres legibles desde los IDs para mantener compatibilidad
    var selCat = categories.find(function(c) { return String(c.id) === String(form.category_id); });
    var selLoc = locations.find(function(l)  { return String(l.id) === String(form.location_id); });
    var pos      = (form.position || '').trim();
    // Endurecimiento de la posición — evita que vuelva a entrar basura en la ubicación.
    // (El bug histórico: escribir "2-5" en Posición SIN elegir estante guardaba "2-5" como shelf.)
    if (pos) {
      if (!selLoc) {
        setErr('Elegí un estante para la posición (no dejes "Sin ubicación" con una posición escrita).');
        return;
      }
      if (pos.indexOf('·') !== -1) {
        setErr('La posición no puede contener el carácter "·".');
        return;
      }
      if (pos.length > 12) {
        setErr('La posición es muy larga (máximo 12 caracteres).');
        return;
      }
      if (!/^[A-Za-z0-9\- ]+$/.test(pos)) {
        setErr('Posición inválida. Usá solo letras, números, guion o espacio (ej: B3, A2-2, 5).');
        return;
      }
    }
    // Construir el campo shelf de texto (ej: "Vitrina 1 · B3")
    var shelfTxt = selLoc ? (selLoc.name + (pos ? ' · ' + pos : '')) : pos;

    onSave(Object.assign({}, form, {
      name:        titleCase(form.name || ''),
      category_id: form.category_id,
      category:    selCat ? selCat.name : '',
      location_id: form.location_id || null,
      position:    pos || null,
      shelf:       shelfTxt,
      code:        (form.code  || '').trim().toUpperCase(),
      unit:        form.unit   || 'uni',
      price:       parseFloat(form.price)    || 0,
      cost:        parseFloat(form.cost)     || 0,
      stock:       parseInt(form.stock)      || 0,
      minStock:    parseInt(form.minStock)   || 0,
    }));
  }

  return (
    <div style={Object.assign({}, sCard, { marginBottom: 16, borderColor: TEAL, borderWidth: '1.5px' })}>
      <p style={{ fontWeight: 600, margin: '0 0 14px', fontSize: 15 }}>
        {product.id ? '✏️ Editar' : '➕ Nuevo Producto'}
      </p>
      {err && <p style={{ color: '#E24B4A', fontSize: 13, margin: '0 0 10px' }}>⚠ {err}</p>}

      <div className="rg-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 14 }}>
        {/* Nombre */}
        <div>
          <label style={sLabel}>Nombre *</label>
          <input
            type="text" style={sInput}
            value={form.name || ''} placeholder="Ej: Pantalla Samsung A24"
            onChange={function(e) { set('name', e.target.value); }}
          />
        </div>

        {/* Categoría — lista cerrada (administrable en Catálogos) */}
        <div>
          <label style={sLabel}>Categoría *</label>
          <select
            style={Object.assign({}, sInput, { background: '#fff' })}
            value={form.category_id || ''}
            onChange={function(e) { set('category_id', e.target.value); }}
          >
            <option value="">— Elegir categoría —</option>
            {categories.map(function(c) {
              return <option key={c.id} value={c.id}>{(c.icon ? c.icon + ' ' : '') + c.name}</option>;
            })}
          </select>
          {categories.length === 0 && (
            <p style={{ fontSize: 11, color: '#E65100', margin: '3px 0 0' }}>
              No hay categorías. Créalas en "Catálogos".
            </p>
          )}
        </div>

        {/* Ubicación (estante) — lista cerrada */}
        <div>
          <label style={sLabel}>Estante / Ubicación</label>
          <select
            style={Object.assign({}, sInput, { background: '#fff' })}
            value={form.location_id || ''}
            onChange={function(e) { set('location_id', e.target.value); }}
          >
            <option value="">— Sin ubicación —</option>
            {locations.map(function(l) {
              return <option key={l.id} value={l.id}>{l.name}</option>;
            })}
          </select>
        </div>

        {/* Posición dentro del estante (bandeja, gaveta, fila) */}
        <div>
          <label style={sLabel}>Posición</label>
          <input
            type="text" style={sInput} maxLength={12}
            value={form.position || ''} placeholder="Ej: B3, A2-2"
            onChange={function(e) { set('position', e.target.value); }}
            onBlur={function(e)   { set('position', (e.target.value || '').trim()); }}
          />
        </div>

        {/* Código de producto — lo asigna el sistema automáticamente (no editable) */}
        <div>
          <label style={sLabel}>Código</label>
          <input
            type="text"
            style={Object.assign({}, sInput, { background: '#f3f4f6', color: '#6b7280', cursor: 'not-allowed' })}
            value={form.code || ''}
            placeholder="Se asigna automáticamente"
            readOnly disabled
          />
          {!product.id && (
            <p style={{ fontSize: 11, color: '#6b7280', margin: '3px 0 0' }}>
              El sistema genera el código (ej: MCD0001).
            </p>
          )}
        </div>

        {/* Precio de venta */}
        <div>
          <label style={sLabel}>Precio venta (Q) *</label>
          <input
            type="number" style={sInput}
            value={form.price || ''} placeholder="0.00"
            onChange={function(e) { set('price', e.target.value); }}
          />
        </div>

        {/* Costo de compra (para calcular margen en reportes) */}
        <div>
          <label style={sLabel}>Costo (Q)</label>
          <input
            type="number" style={sInput}
            value={form.cost || ''} placeholder="0.00"
            onChange={function(e) { set('cost', e.target.value); }}
          />
        </div>

        {/* Stock actual */}
        <div>
          <label style={sLabel}>Stock actual</label>
          <input
            type="number" style={sInput}
            value={form.stock || ''} placeholder="0"
            onChange={function(e) { set('stock', e.target.value); }}
          />
        </div>

        {/* Unidad de medida */}
        <div>
          <label style={sLabel}>Unidad</label>
          <select
            style={Object.assign({}, sInput, { background: '#fff' })}
            value={form.unit || 'uni'}
            onChange={function(e) { set('unit', e.target.value); }}
          >
            {UNIT_OPTIONS.map(function(o) { return <option key={o.v} value={o.v}>{o.l}</option>; })}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button style={mkBtn('teal')} onClick={guardar}>
          {product.id ? 'Guardar cambios' : 'Agregar'}
        </button>
        <button style={mkBtn('gray')} onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}
