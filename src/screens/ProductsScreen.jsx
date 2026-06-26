// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA: ProductsScreen (Productos y Servicios)
//
// Lista completa de productos con búsqueda, filtro por categoría y orden.
// Acciones disponibles por fila:
//   ✏  Editar datos del producto (nombre, precio, categoría, etc.)
//   📈  Ver historial de cambios de precio
//   📦  Ajustar stock manualmente con motivo registrado
//   📋  Ver historial de movimientos de stock
//   🗑  Eliminar el producto
//
// También permite:
//   - Agregar un producto desde el formulario inline
//   - Importar productos desde un archivo Excel (.xlsx)
//   - Descargar plantilla Excel con las categorías disponibles
//
// Props:
//   products       {Array}    — lista de productos
//   categories     {Array}    — categorías disponibles (para filtro y formulario)
//   locations      {Array}    — ubicaciones disponibles (para formulario)
//   saveProduct    {Function} — (producto) — crea o actualiza un producto
//   deleteProduct  {Function} — (id) — elimina un producto
//   importProducts {Function} — (prods, rowErrs, callback) — importa desde Excel
//   showFlash      {Function} — muestra notificación flotante (msg, tipo)
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { TEAL, NAVY, sCard, sInput, sLabel, sTH, sTD, mkBtn, mkBadge } from '../styles/theme.js';
import { fmtD, fmtT, Q } from '../utils/formatters.js';
import { productsAPI } from '../utils/api.js';
import { usePaginator } from '../hooks/usePaginator.jsx';
import { ROLE_LABEL } from '../constants/index.js';
import ProductForm from '../components/ProductForm.jsx';

// Opciones de unidad de medida para el formulario
var UNIT_OPTIONS = [
  { v: 'uni',  l: 'Unidad (uni)' },
  { v: 'pza',  l: 'Pieza (pza)'  },
  { v: 'serv', l: 'Servicio (serv)' },
];

// Motivos predefinidos para ajuste manual de stock
var MOTIVOS_AJUSTE = [
  'Corrección de inventario',
  'Daño / producto defectuoso',
  'Robo / pérdida',
  'Inventario físico',
  'Otro',
];

var H1 = { fontSize: 'clamp(17px,4vw,22px)', fontWeight: 600, margin: '0 0 20px', color: 'var(--text-primary,#1a1a1a)' };

export default function ProductsScreen({ products, categories, locations, saveProduct, deleteProduct, importProducts, showFlash }) {
  products       = products       || [];
  categories     = categories     || [];
  locations      = locations      || [];
  saveProduct    = saveProduct    || function() {};
  deleteProduct  = deleteProduct  || function() {};
  importProducts = importProducts || function() {};
  showFlash      = showFlash      || function() {};

  // Búsqueda y filtros de la lista
  var _s   = useState('');       var search = _s[0];   var setSearch = _s[1];
  var _c   = useState('Todas');  var cat    = _c[0];   var setCat    = _c[1];
  var _o   = useState('name');   var sort   = _o[0];   var setSort   = _o[1];

  // Formulario inline de edición/creación
  var _e   = useState(null);     var editProd = _e[0]; var setEditProd = _e[1];

  // Estado de importación desde Excel
  var _im  = useState(false);    var importing  = _im[0];  var setImporting  = _im[1];
  var _imM = useState('');       var importMsg  = _imM[0]; var setImportMsg  = _imM[1];

  // Modal historial de precios
  var _ph  = useState(null);     var priceHistProd    = _ph[0];   var setPriceHistProd    = _ph[1];
  var _phd = useState([]);       var priceHistData    = _phd[0];  var setPriceHistData    = _phd[1];
  var _phl = useState(false);    var priceHistLoading = _phl[0];  var setPriceHistLoading = _phl[1];

  // Modal ajuste de stock
  var _adjP = useState(null);    var adjProd   = _adjP[0];  var setAdjProd   = _adjP[1];
  var _adjQ = useState('');      var adjQty    = _adjQ[0];  var setAdjQty    = _adjQ[1];
  var _adjR = useState('');      var adjReason = _adjR[0];  var setAdjReason = _adjR[1];
  var _adjB = useState(false);   var adjBusy   = _adjB[0];  var setAdjBusy   = _adjB[1];
  var _adjE = useState('');      var adjErr    = _adjE[0];  var setAdjErr    = _adjE[1];

  // Modal historial de stock
  var _shP = useState(null);     var stockHistProd    = _shP[0];  var setStockHistProd    = _shP[1];
  var _shD = useState([]);       var stockHistData    = _shD[0];  var setStockHistData    = _shD[1];
  var _shL = useState(false);    var stockHistLoading = _shL[0];  var setStockHistLoading = _shL[1];

  // ── Abre modal de ajuste de stock ──────────────────────────────────────────
  function abrirAjusteStock(p) {
    setAdjProd(p);
    setAdjQty(String(p.stock));
    setAdjReason('');
    setAdjErr('');
  }

  // ── Guarda el ajuste de stock en el servidor ───────────────────────────────
  async function guardarAjusteStock() {
    var qty = parseInt(adjQty);
    if (isNaN(qty) || qty < 0) { setAdjErr('Cantidad inválida'); return; }
    if (!adjReason.trim())     { setAdjErr('El motivo es obligatorio'); return; }
    setAdjBusy(true);
    try {
      await productsAPI.adjustStock(adjProd.id, { new_stock: qty, reason: adjReason });
      setAdjProd(null);
      setAdjQty('');
      setAdjReason('');
      showFlash('✅ Stock actualizado a ' + qty, 'ok');
    } catch (e) {
      setAdjErr((e && e.error) || 'Error al ajustar stock');
    }
    setAdjBusy(false);
  }

  // ── Abre modal de historial de stock ───────────────────────────────────────
  function abrirHistorialStock(p) {
    setStockHistProd(p);
    setStockHistData([]);
    setStockHistLoading(true);
    productsAPI.stockHistory(p.id)
      .then(function(d) { setStockHistData(d || []); setStockHistLoading(false); })
      .catch(function()  { setStockHistLoading(false); });
  }

  // ── Abre modal de historial de precios ─────────────────────────────────────
  function abrirHistorialPrecios(p) {
    setPriceHistProd(p);
    setPriceHistData([]);
    setPriceHistLoading(true);
    productsAPI.priceHistory(p.id)
      .then(function(d) { setPriceHistData(d || []); setPriceHistLoading(false); })
      .catch(function()  { setPriceHistData([]); setPriceHistLoading(false); });
  }

  // ── Procesa el archivo Excel de importación ────────────────────────────────
  function procesarImportExcel(file) {
    if (!file) return;
    setImporting(true);
    setImportMsg('');

    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var wb  = XLSX.read(e.target.result, { type: 'binary' });
        var ws  = wb.Sheets[wb.SheetNames[0]];
        var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        // Normaliza un string para comparar encabezados (sin tildes ni mayúsculas)
        function norm(s) {
          return String(s == null ? '' : s).trim().toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '');
        }

        // Encontrar la fila de encabezados (la primera que contenga "nombre" o "name")
        var hRow = -1, headers = [];
        for (var i = 0; i < aoa.length; i++) {
          var r = (aoa[i] || []).map(norm);
          if (r.some(function(c) { return c.indexOf('nombre') >= 0 || c === 'name'; })) {
            hRow = i;
            headers = r;
            break;
          }
        }

        // Resolver índice de columna por alias
        function col() {
          for (var a = 0; a < arguments.length; a++) {
            for (var h = 0; h < headers.length; h++) {
              if (headers[h] && headers[h].indexOf(arguments[a]) >= 0) return h;
            }
          }
          return -1;
        }
        function get(row, idx) { return (idx >= 0 && row) ? row[idx] : ''; }

        var VALID_UNITS  = ['uni', 'pza', 'serv'];
        var rowErrs      = [];
        var prods        = [];
        var existNames   = new Set(products.map(function(p) { return (p.name || '').trim().toLowerCase(); }));

        if (hRow >= 0) {
          var ci = {
            name:     col('nombre', 'name', 'producto', 'descripcion'),
            category: col('categoria', 'category', 'rubro'),
            shelf:    col('estanteria', 'shelf', 'ubicacion', 'posicion'),
            price:    col('precio venta', 'precio de venta', 'precio', 'price'),
            cost:     col('costo', 'cost', 'coste'),
            stock:    col('stock', 'existencia', 'cantidad'),
            unit:     col('unidad', 'unit', 'medida'),
          };
          var seenInFile = new Set();

          for (var d = hRow + 1; d < aoa.length; d++) {
            var row  = aoa[d] || [];
            var name = String(get(row, ci.name) || '').trim();
            if (!name) continue;
            if (prods.length >= 500) {
              rowErrs.push('Fila ' + (d + 1) + ': límite de 500 filas alcanzado — filas restantes ignoradas.');
              break;
            }
            var rowNum = 'Fila ' + (d + 1) + ' (' + name + ')';
            var rowOk  = true;

            if (existNames.has(name.toLowerCase())) {
              rowErrs.push(rowNum + ': ya existe un producto con ese nombre — omitido.');
              rowOk = false;
            }
            if (rowOk && seenInFile.has(name.toLowerCase())) {
              rowErrs.push(rowNum + ': nombre repetido en el archivo — omitido.');
              rowOk = false;
            }

            var price = parseFloat(get(row, ci.price)) || 0;
            if (rowOk && price <= 0) {
              rowErrs.push(rowNum + ': precio venta debe ser mayor a 0 — omitido.');
              rowOk = false;
            }

            var rawUnit = String(get(row, ci.unit) || 'uni').trim().toLowerCase();
            var unit    = VALID_UNITS.includes(rawUnit) ? rawUnit : 'uni';
            if (rawUnit && !VALID_UNITS.includes(rawUnit)) {
              rowErrs.push(rowNum + ': unidad "' + rawUnit + '" no reconocida — se usó "uni". Válidos: uni, pza, serv.');
            }

            if (!rowOk) continue;
            seenInFile.add(name.toLowerCase());
            prods.push({
              name:     name,
              category: String(get(row, ci.category) || '').trim(),
              shelf:    String(get(row, ci.shelf)    || '').trim(),
              price:    price,
              cost:     parseFloat(get(row, ci.cost))  || 0,
              stock:    parseInt(get(row, ci.stock))   || 0,
              minStock: 5,
              unit:     unit,
            });
          }
        }

        if (prods.length === 0 && rowErrs.length === 0) {
          setImportMsg('❌ No se encontraron productos válidos. Verificá que usás la plantilla correcta.');
          setImporting(false);
          return;
        }
        if (prods.length === 0) {
          setImportMsg('❌ Ningún producto pasó la validación:\n' + rowErrs.slice(0, 5).join('\n') + (rowErrs.length > 5 ? ' (y ' + (rowErrs.length - 5) + ' más)' : ''));
          setImporting(false);
          return;
        }

        importProducts(prods, rowErrs, function(count, catsCreated, importErrors) {
          setImporting(false);
          var allErrs = rowErrs.concat(importErrors || []);
          var msg = count > 0
            ? '✅ ' + count + ' producto' + (count !== 1 ? 's importados' : ' importado')
              + (catsCreated > 0 ? ' (' + catsCreated + ' categoría' + (catsCreated !== 1 ? 's nuevas)' : ' nueva)') : ')')
            : '⚠️ No se importó ningún producto.';
          if (allErrs.length > 0) {
            msg += '\n\n⚠️ ' + allErrs.length + ' aviso(s):\n' + allErrs.slice(0, 10).join('\n')
                + (allErrs.length > 10 ? '\n… y ' + (allErrs.length - 10) + ' más.' : '');
          }
          setImportMsg(msg.trim());
          setTimeout(function() { setImportMsg(''); }, 20000);
        });

      } catch (err) {
        setImportMsg('❌ Archivo inválido: ' + err.message);
        setImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  }

  // ── Descarga plantilla Excel para importación ──────────────────────────────
  function descargarPlantilla() {
    var catNames = categories.map(function(c) { return c.name; });
    var catNota  = 'Categorías disponibles: '
      + (catNames.length > 0 ? catNames.join(', ') : '(ninguna aún)')
      + ' — Podés escribir una categoría nueva y se creará automáticamente.';
    var wsPlantilla = XLSX.utils.aoa_to_sheet([
      ['NOTA: ' + catNota],
      ['NOTA: Unidad válida: uni (unidad), pza (pieza), serv (servicio). Precio venta > 0. Máximo 500 filas. No se importarán nombres repetidos.'],
      [],
      ['Nombre *', 'Categoría *', 'Precio venta *', 'Costo', 'Stock inicial', 'Unidad (uni/pza/serv)', 'Posición en estantería'],
      ['Ejemplo: Pantalla Samsung A32', catNames[0] || 'Accesorios', '350', '200', '5', 'uni', 'B3-2'],
      ['Ejemplo: Funda iPhone 15 Pro', 'Fundas', '85', '40', '10', 'pza', 'A1-1'],
    ]);
    var wsCats = XLSX.utils.aoa_to_sheet(
      [['Categorías configuradas (podés agregar nuevas en la columna Categoría del archivo Productos)']].concat(
        catNames.length > 0
          ? catNames.map(function(c) { return [c]; })
          : [['(sin categorías aún — creá una desde Catálogos o escríbela directamente en el Excel)']]
      )
    );
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsPlantilla, 'Productos');
    XLSX.utils.book_append_sheet(wb, wsCats, 'Categorías');
    XLSX.writeFile(wb, 'plantilla_productos.xlsx');
  }

  // ── Filtrado y ordenamiento de la lista ────────────────────────────────────
  var categoriasFiltro = ['Todas'].concat(
    Array.from(new Set(products.map(function(p) { return p.category; })))
  );

  var filtrados = products.filter(function(p) {
    var q = search.toLowerCase();
    return (
      (!search
        || (p.name  || '').toLowerCase().includes(q)
        || (p.code  || '').toLowerCase().includes(q)
        || (p.shelf || '').toLowerCase().includes(q))
      && (cat === 'Todas' || p.category === cat)
    );
  }).sort(function(a, b) {
    if (sort === 'code')  return (a.code  || '').localeCompare(b.code  || '');
    if (sort === 'stock') return a.stock - b.stock;
    if (sort === 'price') return a.price  - b.price;
    return (a.name || '').localeCompare(b.name || '');
  });

  var prodPag = usePaginator(filtrados, 25);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Encabezado con acciones globales */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <p style={H1}>📦 Productos y Servicios</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={mkBtn('gray')} title="Descargar plantilla Excel con categorías válidas" onClick={descargarPlantilla}>
            📄 Plantilla
          </button>
          <label style={Object.assign({}, mkBtn('blue'), {
            cursor: importing ? 'not-allowed' : 'pointer',
            opacity: importing ? 0.6 : 1,
            display: 'flex', alignItems: 'center', gap: 6,
          })}>
            {importing ? '⏳ Importando...' : '📥 Importar Excel'}
            <input
              type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
              disabled={importing}
              onChange={function(e) { procesarImportExcel(e.target.files[0]); e.target.value = ''; }}
            />
          </label>
          <button
            style={mkBtn('teal')}
            onClick={function() { setEditProd({ name: '', category_id: '', location_id: '', position: '', price: '', cost: '', stock: '', unit: 'uni' }); }}
          >
            + Agregar
          </button>
        </div>
      </div>

      {/* Mensaje de resultado de importación */}
      {importMsg && (
        <div style={{
          background: importMsg.startsWith('✅') ? '#EAF3DE' : '#FCEBEB',
          border: '1px solid ' + (importMsg.startsWith('✅') ? '#97C459' : '#F09595'),
          borderRadius: 8, padding: '10px 16px', marginBottom: 12,
          color: importMsg.startsWith('✅') ? '#27500A' : '#791F1F',
          fontSize: 14, fontWeight: 500,
        }}>{importMsg}</div>
      )}

      {/* Formulario inline de edición/creación */}
      {editProd && (
        <ProductForm
          product={editProd}
          categories={categories}
          locations={locations}
          onSave={function(p) { saveProduct(p); setEditProd(null); }}
          onCancel={function() { setEditProd(null); }}
        />
      )}

      {/* Barra de filtros */}
      <div style={Object.assign({}, sCard, { marginBottom: 14 })}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            style={Object.assign({}, sInput, { width: 240, flex: 'none' })}
            placeholder="Buscar..."
            value={search}
            onChange={function(e) { setSearch(e.target.value); prodPag.resetPage(); }}
          />
          <select style={Object.assign({}, sInput, { width: 150, flex: 'none' })} value={cat} onChange={function(e) { setCat(e.target.value); }}>
            {categoriasFiltro.map(function(c) { return <option key={c}>{c}</option>; })}
          </select>
          <select style={Object.assign({}, sInput, { width: 160, flex: 'none' })} value={sort} onChange={function(e) { setSort(e.target.value); }}>
            <option value="name">Nombre A→Z</option>
            <option value="code">Código</option>
            <option value="stock">Stock ↑</option>
            <option value="price">Precio ↑</option>
          </select>
          <span style={{ fontSize: 13, color: '#666' }}>{filtrados.length} items</span>
        </div>
      </div>

      {/* Tabla de productos */}
      <div style={sCard}>
        <div className="tbl-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['#', 'Código', 'Nombre', 'Categoría', 'Estantería', 'Precio', 'Costo', 'Margen', 'Stock', ''].map(function(h) {
                  return (
                    <th key={h} style={h === '#' ? Object.assign({}, sTH, { width: 40, textAlign: 'center' }) : sTH}>
                      {h}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {prodPag.paged.map(function(p, index) {
                var margen = p.cost > 0 ? Math.round((p.price - p.cost) / p.price * 100) : 0;
                return (
                  <tr key={p.id}>
                    <td style={Object.assign({}, sTD, { textAlign: 'center', color: '#999', fontSize: 12 })}>
                      {prodPag.offset + index + 1}
                    </td>
                    <td style={Object.assign({}, sTD, { fontFamily: 'monospace', fontSize: 12 })}>{p.code}</td>
                    <td style={Object.assign({}, sTD, { fontWeight: 600 })}>
                      {p.name} <span style={{ fontSize: 11, color: '#999', fontWeight: 400 }}>{p.unit}</span>
                    </td>
                    <td style={sTD}><span style={mkBadge('teal')}>{p.category}</span></td>
                    <td style={Object.assign({}, sTD, { fontFamily: 'monospace', fontSize: 12 })}>{p.shelf}</td>
                    <td style={Object.assign({}, sTD, { color: TEAL, fontWeight: 600 })}>{Q(p.price)}</td>
                    <td style={sTD}>{p.cost > 0 ? Q(p.cost) : '—'}</td>
                    <td style={sTD}>
                      {p.cost > 0
                        ? <span style={mkBadge(margen >= 30 ? 'green' : margen >= 15 ? 'amber' : 'red')}>{margen}%</span>
                        : '—'}
                    </td>
                    <td style={sTD}>
                      <span style={mkBadge(p.unit === 'serv' ? 'blue' : p.stock === 0 ? 'red' : p.stock < 5 ? 'amber' : 'green')}>
                        {p.unit === 'serv' ? 'Serv.' : p.stock}
                      </span>
                    </td>
                    <td style={sTD}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {/* Editar */}
                        <button
                          style={Object.assign({}, mkBtn('blue'), { padding: '4px 10px', fontSize: 12 })}
                          onClick={function() {
                            var ed = Object.assign({}, p);
                            // Resolver category_id si el producto aún usa el campo legacy
                            if (!ed.category_id && ed.category) {
                              var mc = categories.find(function(c) { return c.name.toLowerCase() === String(ed.category).toLowerCase(); });
                              if (mc) ed.category_id = mc.id;
                            }
                            // Resolver location_id si usa el campo legacy de texto
                            if (!ed.location_id && ed.shelf) {
                              var ls = String(ed.shelf).split(' · ');
                              var ml = locations.find(function(l) { return l.name.toLowerCase() === ls[0].toLowerCase(); });
                              if (ml) { ed.location_id = ml.id; if (ls[1] && !ed.position) ed.position = ls[1]; }
                            }
                            setEditProd(ed);
                          }}
                        >✏</button>
                        {/* Historial de precios */}
                        <button
                          style={Object.assign({}, mkBtn('purple'), { padding: '4px 10px', fontSize: 12 })}
                          onClick={function() { abrirHistorialPrecios(p); }}
                        >📈</button>
                        {/* Ajustar stock */}
                        <button
                          style={Object.assign({}, mkBtn('amber'), { padding: '4px 10px', fontSize: 12 })}
                          title="Ajustar stock"
                          onClick={function() { abrirAjusteStock(p); }}
                        >📦</button>
                        {/* Historial de stock */}
                        <button
                          style={Object.assign({}, mkBtn('purple'), { padding: '4px 10px', fontSize: 12 })}
                          title="Historial de stock"
                          onClick={function() { abrirHistorialStock(p); }}
                        >📋</button>
                        {/* Eliminar */}
                        <button
                          style={Object.assign({}, mkBtn('red'), { padding: '4px 10px', fontSize: 12 })}
                          onClick={function() {
                            if (window.confirm('¿Eliminar "' + p.name + '"? Esta acción no se puede deshacer.')) {
                              deleteProduct(p.id);
                            }
                          }}
                        >🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={9} style={Object.assign({}, sTD, { textAlign: 'center', color: '#999', padding: 32 })}>
                    Sin resultados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <prodPag.Pager />
      </div>

      {/* ── Modal: Historial de Precios ── */}
      {priceHistProd && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', maxWidth: 580, width: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: 16, margin: '0 0 4px' }}>📈 Historial de precios</p>
                <p style={{ fontSize: 13, color: '#666', margin: 0 }}>
                  {priceHistProd.name} <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#999' }}>({priceHistProd.code})</span>
                </p>
              </div>
              <button style={mkBtn('gray')} onClick={function() { setPriceHistProd(null); }}>✕ Cerrar</button>
            </div>
            <div style={{ background: '#f8f8f6', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: '#666' }}>Precio actual</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: TEAL }}>{Q(priceHistProd.price)}</span>
            </div>
            {priceHistLoading ? (
              <p style={{ textAlign: 'center', color: '#999', padding: 24 }}>Cargando...</p>
            ) : priceHistData.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#999', padding: 24 }}>
                Sin cambios de precio registrados.<br />
                <span style={{ fontSize: 12 }}>Los cambios quedan registrados a partir de ahora.</span>
              </p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Fecha', 'Precio anterior', 'Precio nuevo', 'Cambio', 'Usuario'].map(function(h) {
                      return <th key={h} style={sTH}>{h}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {priceHistData.map(function(r, i) {
                    var diff = Number(r.after) - Number(r.before);
                    var pct  = Number(r.before) > 0 ? Math.round(diff / Number(r.before) * 100) : 0;
                    var sube = diff > 0;
                    return (
                      <tr key={i}>
                        <td style={Object.assign({}, sTD, { fontSize: 12 })}>
                          {fmtD(r.date)}<br />
                          <span style={{ color: '#999', fontSize: 11 }}>{fmtT(r.date)}</span>
                        </td>
                        <td style={Object.assign({}, sTD, { color: '#666' })}>{Q(r.before)}</td>
                        <td style={Object.assign({}, sTD, { fontWeight: 600, color: TEAL })}>{Q(r.after)}</td>
                        <td style={sTD}>
                          <span style={mkBadge(diff === 0 ? 'gray' : sube ? 'green' : 'red')}>
                            {sube ? '+' : ''}{pct}%
                          </span>
                        </td>
                        <td style={Object.assign({}, sTD, { fontSize: 12 })}>
                          {r.user || '—'}<br />
                          <span style={Object.assign({}, mkBadge(r.role === 'admin' ? 'teal' : 'blue'), { fontSize: 10 })}>
                            {ROLE_LABEL[r.role] || r.role || ''}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Ajustar Stock ── */}
      {adjProd && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', maxWidth: 440, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: 16, margin: '0 0 4px' }}>📦 Ajustar Stock</p>
                <p style={{ fontSize: 13, color: '#666', margin: 0 }}>
                  {adjProd.name} <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#999' }}>({adjProd.code})</span>
                </p>
                <p style={{ fontSize: 12, color: '#999', margin: '4px 0 0' }}>Stock actual: <strong>{adjProd.stock}</strong></p>
              </div>
              <button style={mkBtn('gray')} onClick={function() { setAdjProd(null); }}>✕</button>
            </div>

            {adjErr && <p style={{ color: '#E24B4A', fontSize: 13, margin: '0 0 10px' }}>⚠ {adjErr}</p>}

            <div style={{ marginBottom: 12 }}>
              <label style={sLabel}>Nueva cantidad *</label>
              <input
                type="number" min="0" style={sInput} value={adjQty}
                onChange={function(e) { setAdjQty(e.target.value); setAdjErr(''); }}
              />
              {/* Indicador visual de entrada o salida */}
              {adjQty !== '' && !isNaN(parseInt(adjQty)) && (
                <p style={{ fontSize: 12, margin: '4px 0 0', color: parseInt(adjQty) > adjProd.stock ? '#27ae60' : parseInt(adjQty) < adjProd.stock ? '#E24B4A' : '#999' }}>
                  {parseInt(adjQty) > adjProd.stock
                    ? '▲ Entrada de +' + (parseInt(adjQty) - adjProd.stock)
                    : parseInt(adjQty) < adjProd.stock
                    ? '▼ Salida de '  + (adjProd.stock - parseInt(adjQty))
                    : 'Sin cambio'}
                </p>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={sLabel}>Motivo *</label>
              <select
                style={Object.assign({}, sInput, { background: '#fff' })}
                value={adjReason}
                onChange={function(e) { setAdjReason(e.target.value); setAdjErr(''); }}
              >
                <option value="">— Seleccionar motivo —</option>
                {MOTIVOS_AJUSTE.map(function(m) { return <option key={m} value={m}>{m}</option>; })}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button style={mkBtn('teal')} disabled={adjBusy} onClick={guardarAjusteStock}>
                {adjBusy ? 'Guardando...' : 'Guardar ajuste'}
              </button>
              <button style={mkBtn('gray')} onClick={function() { setAdjProd(null); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Historial de Stock ── */}
      {stockHistProd && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', maxWidth: 620, width: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: 16, margin: '0 0 4px' }}>📋 Historial de Stock</p>
                <p style={{ fontSize: 13, color: '#666', margin: 0 }}>{stockHistProd.name}</p>
              </div>
              <button style={mkBtn('gray')} onClick={function() { setStockHistProd(null); }}>✕ Cerrar</button>
            </div>
            {stockHistLoading ? (
              <p style={{ color: '#999', textAlign: 'center' }}>Cargando...</p>
            ) : stockHistData.length === 0 ? (
              <p style={{ color: '#999', fontSize: 13, textAlign: 'center' }}>
                Sin movimientos registrados aún. Los ajustes manuales y movimientos futuros aparecerán aquí.
              </p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Fecha', 'Tipo', 'Antes', 'Cambio', 'Después', 'Motivo', 'Usuario'].map(function(h) {
                      return <th key={h} style={sTH}>{h}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {stockHistData.map(function(m) {
                    var sube = m.qty_change > 0;
                    return (
                      <tr key={m.id}>
                        <td style={Object.assign({}, sTD, { fontSize: 11, color: '#888' })}>
                          {new Date(m.created_at).toLocaleDateString('es-GT')}<br />
                          {new Date(m.created_at).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={sTD}>
                          <span style={mkBadge(m.type === 'venta' ? 'red' : m.type === 'compra' ? 'green' : m.type === 'devolucion' ? 'blue' : 'amber')}>
                            {m.type}
                          </span>
                        </td>
                        <td style={Object.assign({}, sTD, { textAlign: 'center', fontFamily: 'monospace' })}>{m.qty_before}</td>
                        <td style={Object.assign({}, sTD, { textAlign: 'center', fontWeight: 700, color: sube ? '#27ae60' : '#E24B4A', fontFamily: 'monospace' })}>
                          {sube ? '+' : ''}{m.qty_change}
                        </td>
                        <td style={Object.assign({}, sTD, { textAlign: 'center', fontFamily: 'monospace', fontWeight: 700 })}>{m.qty_after}</td>
                        <td style={Object.assign({}, sTD, { fontSize: 12, color: '#666' })}>{m.reason || '—'}</td>
                        <td style={Object.assign({}, sTD, { fontSize: 12 })}>
                          {m.user_name || '—'}<br />
                          <span style={Object.assign({}, mkBadge(m.user_role === 'admin' ? 'teal' : 'blue'), { fontSize: 10 })}>
                            {ROLE_LABEL[m.user_role] || m.user_role || ''}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
