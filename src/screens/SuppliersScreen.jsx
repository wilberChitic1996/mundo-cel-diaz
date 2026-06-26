// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA: SuppliersScreen (Proveedores y Compras)
//
// Dos tabs:
//
//   🏭 Proveedores
//     Tabla de proveedores activos con botones de editar y archivar.
//     Modal para crear/editar: nombre, NIT, teléfono, correo, dirección, notas.
//
//   📦 Historial de compras
//     Tabla de compras registradas con proveedor, artículos y total.
//     Modal para registrar nueva compra:
//       1. Seleccionar proveedor (lista o nombre libre)
//       2. Buscar producto del catálogo y agregarlo a la orden
//       3. Ajustar cantidad y costo unitario por ítem
//       4. Checkbox "Act. costo" → actualiza el costo del producto en inventario
//       Al confirmar: guarda la compra en Supabase, incrementa el stock de
//       cada producto y opcionalmente actualiza el costo.
//
// Dependencias:
//   - suppliersAPI.getAll()        → trae proveedores activos
//   - suppliersAPI.getPurchases()  → trae historial de compras
//   - suppliersAPI.create(data)    → crea proveedor
//   - suppliersAPI.update(id,data) → edita proveedor o lo archiva (active:false)
//   - suppliersAPI.createPurchase(data) → registra compra y actualiza stock
//
// Props:
//   products      {Array}    — catálogo para el buscador de productos en compra
//   session       {Object}   — sesión activa
//   showFlash     {Function} — (msg, type) notificación flash
//   onStockUpdate {Function} — llamada después de registrar una compra (recarga stock)
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { TEAL, NAVY, sCard, sInput, sLabel, sTH, sTD, mkBtn, mkBadge } from '../styles/theme.js';
import { Q, fmtD, fmtT } from '../utils/formatters.js';
import { suppliersAPI } from '../utils/api.js';
import { usePaginator } from '../hooks/usePaginator.jsx';

var H1 = { fontSize: 'clamp(17px,4vw,22px)', fontWeight: 600, margin: 0, color: 'var(--text-primary,#1a1a1a)' };

export default function SuppliersScreen({ products, session, showFlash, onStockUpdate }) {
  products      = products      || [];
  session       = session       || {};
  showFlash     = showFlash     || function() {};
  onStockUpdate = onStockUpdate || function() {};

  // Tab activo: "proveedores" o "compras"
  var _tab       = useState('proveedores'); var tab       = _tab[0];   var setTab       = _tab[1];
  // Datos cargados desde Supabase
  var _suppliers = useState([]);            var suppliers = _suppliers[0]; var setSuppliers = _suppliers[1];
  var _purchases = useState([]);            var purchases = _purchases[0]; var setPurchases = _purchases[1];
  var _loading   = useState(true);          var loading   = _loading[0];  var setLoading   = _loading[1];

  // ── Modal de proveedor ──
  var _ms     = useState(false); var showSupModal = _ms[0];  var setShowSupModal = _ms[1];
  var _editSup = useState(null); var editSup      = _editSup[0]; var setEditSup  = _editSup[1];
  var _sName  = useState('');    var sName   = _sName[0];   var setSName   = _sName[1];
  var _sNit   = useState('');    var sNit    = _sNit[0];    var setSnit    = _sNit[1];
  var _sPhone = useState('');    var sPhone  = _sPhone[0];  var setSPhone  = _sPhone[1];
  var _sEmail = useState('');    var sEmail  = _sEmail[0];  var setSEmail  = _sEmail[1];
  var _sAddr  = useState('');    var sAddr   = _sAddr[0];   var setSAddr   = _sAddr[1];
  var _sNotes = useState('');    var sNotes  = _sNotes[0];  var setSNotes  = _sNotes[1];

  // ── Modal de nueva compra ──
  var _mp     = useState(false); var showPurchModal = _mp[0];   var setShowPurchModal = _mp[1];
  var _pSup   = useState('');    var pSup    = _pSup[0];    var setPSup    = _pSup[1];
  var _pSupId = useState('');    var pSupId  = _pSupId[0];  var setPSupId  = _pSupId[1];
  var _pNotes = useState('');    var pNotes  = _pNotes[0];  var setPNotes  = _pNotes[1];
  var _pItems = useState([]);    var pItems  = _pItems[0];  var setPItems  = _pItems[1];
  var _saving = useState(false); var saving  = _saving[0];  var setSaving  = _saving[1];

  // Búsqueda de producto dentro del modal de compra
  var _prodQ   = useState('');   var prodQ   = _prodQ[0];   var setProdQ   = _prodQ[1];
  var _prodRes = useState([]);   var prodRes = _prodRes[0]; var setProdRes = _prodRes[1];

  // Cargar proveedores y compras al montar
  useEffect(function() {
    Promise.all([
      suppliersAPI.getAll().catch(function() { return []; }),
      suppliersAPI.getPurchases().catch(function() { return []; }),
    ]).then(function(res) {
      setSuppliers(res[0] || []);
      setPurchases(res[1] || []);
      setLoading(false);
    });
  }, []);

  // Filtrar productos en tiempo real al escribir en el buscador de la compra
  useEffect(function() {
    if (!prodQ.trim()) { setProdRes([]); return; }
    var q = prodQ.toLowerCase();
    setProdRes(products.filter(function(p) {
      return p.unit !== 'serv'
        && ((p.name || '').toLowerCase().indexOf(q) >= 0 || (p.code || '').toLowerCase().indexOf(q) >= 0);
    }).slice(0, 6));
  }, [prodQ, products]);

  // Abre el modal de proveedor en modo "nuevo"
  function openNewSup() {
    setEditSup(null); setSName(''); setSnit(''); setSPhone(''); setSEmail(''); setSAddr(''); setSNotes('');
    setShowSupModal(true);
  }

  // Abre el modal de proveedor en modo "editar"
  function openEditSup(s) {
    setEditSup(s); setSName(s.name || ''); setSnit(s.nit || ''); setSPhone(s.phone || '');
    setSEmail(s.email || ''); setSAddr(s.address || ''); setSNotes(s.notes || '');
    setShowSupModal(true);
  }

  // Guarda o actualiza el proveedor
  function saveSup() {
    if (!sName.trim()) { alert('Nombre requerido'); return; }
    setSaving(true);
    var data = { name: sName.trim(), nit: sNit.trim() || null, phone: sPhone.trim(), email: sEmail.trim(), address: sAddr.trim(), notes: sNotes.trim() };
    var prom = editSup ? suppliersAPI.update(editSup.id, data) : suppliersAPI.create(data);
    prom.then(function(s) {
      if (editSup) {
        setSuppliers(function(prev) { return prev.map(function(x) { return x.id === s.id ? s : x; }); });
      } else {
        setSuppliers(function(prev) { return [s].concat(prev); });
      }
      showFlash('✓ Proveedor guardado', 'ok');
      setShowSupModal(false); setSaving(false);
    }).catch(function() { setSaving(false); alert('Error al guardar'); });
  }

  // Archiva (desactiva) un proveedor
  function deactivateSup(id) {
    if (!window.confirm('¿Archivar este proveedor?')) return;
    suppliersAPI.update(id, { active: false }).then(function() {
      setSuppliers(function(prev) { return prev.filter(function(s) { return s.id !== id; }); });
      showFlash('Proveedor archivado', 'ok');
    });
  }

  // Abre el modal de nueva compra
  function openNewPurch() {
    setPSup(''); setPSupId(''); setPNotes(''); setPItems([]); setProdQ(''); setProdRes([]);
    setShowPurchModal(true);
  }

  // Agrega un producto al listado de ítems de la compra
  function addProductToOrder(prod) {
    setPItems(function(prev) {
      var exists = prev.find(function(x) { return x.productId === prod.id; });
      if (exists) {
        return prev.map(function(x) {
          return x.productId === prod.id ? Object.assign({}, x, { qty: x.qty + 1, subtotal: (x.qty + 1) * x.cost }) : x;
        });
      }
      return prev.concat([{ productId: prod.id, productName: prod.name, productCode: prod.code, qty: 1, cost: Number(prod.cost || 0), subtotal: Number(prod.cost || 0), updateCost: false }]);
    });
    setProdQ(''); setProdRes([]);
  }

  // Actualiza un campo de un ítem de la compra
  function updateItem(idx, field, val) {
    setPItems(function(prev) {
      var arr = prev.slice();
      arr[idx] = Object.assign({}, arr[idx]);
      arr[idx][field] = field === 'updateCost' ? val : (Number(val) || 0);
      if (field === 'qty' || field === 'cost') arr[idx].subtotal = arr[idx].qty * arr[idx].cost;
      return arr;
    });
  }

  function removeItem(idx) { setPItems(function(prev) { return prev.filter(function(_, i) { return i !== idx; }); }); }

  // Confirma y guarda la compra en Supabase
  function savePurchase() {
    if (!pSup.trim()) { alert('Seleccione un proveedor'); return; }
    if (!pItems.length) { alert('Agregue al menos un producto'); return; }
    setSaving(true);
    suppliersAPI.createPurchase({ supplierId: pSupId || null, supplierName: pSup, items: pItems, notes: pNotes })
      .then(function(p) {
        setPurchases(function(prev) { return [p].concat(prev); });
        onStockUpdate();
        showFlash('✓ Compra registrada y stock actualizado', 'ok');
        setShowPurchModal(false); setSaving(false);
      })
      .catch(function(e) {
        setSaving(false);
        alert(e && e.error ? e.error : 'Error al registrar compra');
      });
  }

  // Total de la compra en curso
  var pTotal = pItems.reduce(function(s, i) { return s + i.subtotal; }, 0);

  var supPag = usePaginator(suppliers, 20);
  var purPag = usePaginator(purchases, 20);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Cargando…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <p style={H1}>🏭 Proveedores y Compras</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {tab === 'proveedores' && <button style={mkBtn('teal')} onClick={openNewSup}>+ Nuevo proveedor</button>}
          {tab === 'compras'     && <button style={mkBtn('teal')} onClick={openNewPurch}>+ Registrar compra</button>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
        {[['proveedores', '🏭 Proveedores (' + suppliers.length + ')'], ['compras', '📦 Historial de compras (' + purchases.length + ')']].map(function(t) {
          return (
            <button key={t[0]} style={Object.assign({}, mkBtn(tab === t[0] ? 'teal' : 'gray'), { padding: '6px 14px', fontSize: 13 })} onClick={function() { setTab(t[0]); }}>{t[1]}</button>
          );
        })}
      </div>

      {/* ── Tab proveedores ── */}
      {tab === 'proveedores' && (
        <div style={sCard}>
          {suppliers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>🏭</p>
              <p style={{ fontSize: 15, marginBottom: 4 }}>Sin proveedores registrados</p>
              <p style={{ fontSize: 13 }}>Agrega tu primer proveedor para registrar compras y actualizar stock</p>
            </div>
          ) : (
            <div className="tbl-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['#', 'Proveedor', 'Teléfono', 'Correo', 'Dirección', 'Notas', ''].map(function(h) {
                      return <th key={h} style={h === '#' ? Object.assign({}, sTH, { width: 40, textAlign: 'center' }) : sTH}>{h}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {supPag.paged.map(function(s, index) {
                    return (
                      <tr key={s.id}>
                        <td style={Object.assign({}, sTD, { textAlign: 'center', color: '#999', fontSize: 12 })}>{supPag.offset + index + 1}</td>
                        <td style={Object.assign({}, sTD, { fontWeight: 600 })}>{s.name}</td>
                        <td style={sTD}>{s.phone   || '—'}</td>
                        <td style={sTD}>{s.email   || '—'}</td>
                        <td style={sTD}>{s.address || '—'}</td>
                        <td style={Object.assign({}, sTD, { color: '#666', fontSize: 12 })}>{s.notes || '—'}</td>
                        <td style={sTD}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button style={Object.assign({}, mkBtn('gray'), { padding: '2px 8px', fontSize: 12 })} onClick={function() { openEditSup(s); }}>✏️</button>
                            <button style={Object.assign({}, mkBtn('red'),  { padding: '2px 8px', fontSize: 12 })} onClick={function() { deactivateSup(s.id); }}>✕</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <supPag.Pager />
        </div>
      )}

      {/* ── Tab historial de compras ── */}
      {tab === 'compras' && (
        <div style={sCard}>
          {purchases.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>📦</p>
              <p style={{ fontSize: 15 }}>Sin compras registradas aún</p>
            </div>
          ) : (
            <div className="tbl-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['#', 'Fecha', 'Proveedor', 'Artículos', 'Total', 'Registrado por'].map(function(h) {
                      return <th key={h} style={h === '#' ? Object.assign({}, sTH, { width: 40, textAlign: 'center' }) : sTH}>{h}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {purPag.paged.map(function(p, index) {
                    var items = p.purchase_items || [];
                    return (
                      <tr key={p.id}>
                        <td style={Object.assign({}, sTD, { textAlign: 'center', color: '#999', fontSize: 12 })}>{purPag.offset + index + 1}</td>
                        <td style={sTD}>{fmtD(p.created_at)} {fmtT(p.created_at)}</td>
                        <td style={Object.assign({}, sTD, { fontWeight: 600 })}>{p.supplier_name}</td>
                        <td style={sTD}>
                          <div style={{ fontSize: 12 }}>
                            {items.slice(0, 3).map(function(it, i) { return <div key={i}>{it.product_name} ×{it.qty}</div>; })}
                            {items.length > 3 && <div style={{ color: '#999' }}>+{items.length - 3} más…</div>}
                          </div>
                        </td>
                        <td style={Object.assign({}, sTD, { fontWeight: 700, color: TEAL })}>Q {Number(p.total).toFixed(2)}</td>
                        <td style={sTD}>{p.registered_by}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <purPag.Pager />
        </div>
      )}

      {/* ── Modal: Crear/Editar proveedor ── */}
      {showSupModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 460 }}>
            <p style={{ fontWeight: 700, fontSize: 18, margin: '0 0 18px', color: NAVY }}>{editSup ? 'Editar proveedor' : 'Nuevo proveedor'}</p>
            {[
              ['Nombre *',       sName,  setSName,  'Ej: Distribuidora XYZ'],
              ['NIT (tributario)', sNit, setSnit,   'Ej: 1234567-8 (opcional)'],
              ['Teléfono',       sPhone, setSPhone,  'Ej: 5555-0000'],
              ['Correo',         sEmail, setSEmail,  'Ej: ventas@proveedor.com'],
              ['Dirección',      sAddr,  setSAddr,   'Ej: Zona 4, Guatemala'],
              ['Notas',          sNotes, setSNotes,  'Observaciones…'],
            ].map(function(f) {
              return (
                <div key={f[0]} style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{f[0]}</label>
                  <input style={sInput} value={f[1]} placeholder={f[3]} onChange={function(e) { f[2](e.target.value); }} />
                </div>
              );
            })}
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button style={Object.assign({}, mkBtn('gray'), { flex: 1 })} onClick={function() { setShowSupModal(false); }}>Cancelar</button>
              <button style={Object.assign({}, mkBtn('teal'), { flex: 1 })} onClick={saveSup} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Registrar compra ── */}
      {showPurchModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: 16, overflowY: 'auto' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 600, margin: '20px auto' }}>
            <p style={{ fontWeight: 700, fontSize: 18, margin: '0 0 18px', color: NAVY }}>📦 Registrar Compra</p>

            <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 5 }}>Proveedor *</label>
            <select
              style={Object.assign({}, sInput, { background: '#fff' })}
              value={pSupId}
              onChange={function(e) {
                var id  = e.target.value;
                var sup = suppliers.find(function(s) { return s.id === id; });
                setPSupId(id); setPSup(sup ? sup.name : '');
              }}
            >
              <option value="">— Seleccionar proveedor —</option>
              {suppliers.map(function(s) { return <option key={s.id} value={s.id}>{s.name}</option>; })}
              <option value="__otro__">Otro (escribir manualmente)</option>
            </select>
            {pSupId === '__otro__' && (
              <input style={Object.assign({}, sInput, { marginTop: 6 })} placeholder="Nombre del proveedor" value={pSup} onChange={function(e) { setPSup(e.target.value); }} />
            )}

            <label style={{ display: 'block', fontWeight: 600, fontSize: 13, margin: '14px 0 5px' }}>Buscar producto para agregar</label>
            <div style={{ position: 'relative' }}>
              <input style={sInput} value={prodQ} placeholder="Buscar por nombre o código…" onChange={function(e) { setProdQ(e.target.value); }} />
              {prodRes.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #ddd', borderRadius: 8, zIndex: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', marginTop: 2 }}>
                  {prodRes.map(function(p) {
                    return (
                      <div key={p.id} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }} onClick={function() { addProductToOrder(p); }}>
                        <span><b>{p.code}</b> — {p.name}</span>
                        <span style={{ color: TEAL, fontWeight: 600 }}>Stock: {p.stock}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tabla de ítems de la compra */}
            {pItems.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <p style={{ fontWeight: 600, fontSize: 13, margin: '0 0 8px' }}>Artículos de la compra</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      {['Producto', 'Cant.', 'Costo unit.', 'Subtotal', 'Act. costo', ''].map(function(h) {
                        return <th key={h} style={Object.assign({}, sTH, { fontSize: 11 })}>{h}</th>;
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {pItems.map(function(it, i) {
                      return (
                        <tr key={i}>
                          <td style={sTD}>
                            <div style={{ fontWeight: 500 }}>{it.productName}</div>
                            <div style={{ fontSize: 11, color: '#999' }}>{it.productCode}</div>
                          </td>
                          <td style={sTD}>
                            <input type="number" min="1" style={{ width: 56, padding: '4px 6px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 }} value={it.qty} onChange={function(e) { updateItem(i, 'qty', e.target.value); }} />
                          </td>
                          <td style={sTD}>
                            <input type="number" min="0" step="0.01" style={{ width: 76, padding: '4px 6px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 }} value={it.cost} onChange={function(e) { updateItem(i, 'cost', e.target.value); }} />
                          </td>
                          <td style={Object.assign({}, sTD, { fontWeight: 700, color: TEAL })}>Q {it.subtotal.toFixed(2)}</td>
                          <td style={Object.assign({}, sTD, { textAlign: 'center' })}>
                            <input type="checkbox" checked={!!it.updateCost} onChange={function(e) { updateItem(i, 'updateCost', e.target.checked); }} title="Actualizar costo del producto" />
                          </td>
                          <td style={sTD}>
                            <button style={Object.assign({}, mkBtn('red'), { padding: '2px 6px', fontSize: 12 })} onClick={function() { removeItem(i); }}>✕</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ textAlign: 'right', marginTop: 10, fontWeight: 700, fontSize: 15 }}>
                  Total: <span style={{ color: TEAL }}>Q {pTotal.toFixed(2)}</span>
                </div>
                <p style={{ fontSize: 11, color: '#999', marginTop: 4 }}>☑ "Act. costo" actualiza el costo del producto en inventario</p>
              </div>
            )}

            <label style={{ display: 'block', fontWeight: 600, fontSize: 13, margin: '14px 0 5px' }}>Notas (opcional)</label>
            <input style={sInput} placeholder="Ej: factura #1234, pago en efectivo…" value={pNotes} onChange={function(e) { setPNotes(e.target.value); }} />

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button style={Object.assign({}, mkBtn('gray'), { flex: 1 })} onClick={function() { setShowPurchModal(false); }}>Cancelar</button>
              <button style={Object.assign({}, mkBtn('teal'), { flex: 1 })} onClick={savePurchase} disabled={saving || !pItems.length}>
                {saving ? 'Guardando…' : '✓ Confirmar compra'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
