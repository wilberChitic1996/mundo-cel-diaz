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
import { getStore } from '../utils/receipt.js';
import { STORE_FALLBACK, APP_NAME } from '../constants/index.js';
import { usePaginator } from '../hooks/usePaginator.jsx';
import { exportExcel } from '../utils/export.js';

// Comprobante INTERNO de compra a proveedor (control del negocio, no se entrega al cliente).
function printCompra(p) {
  var _sn = getStore().store_name || STORE_FALLBACK;
  var items = p.purchase_items || [];
  var fecha = new Date(p.created_at).toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' });
  var hora  = new Date(p.created_at).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
  var folio = String(p.id || '').toUpperCase().slice(-8);

  // Crédito fiscal (solo si la compra tuvo factura del proveedor).
  var conFactura = !!p.has_factura;
  var ivaCred    = conFactura ? (Number(p.iva_amount) || 0) : 0;
  var baseSinIva = Number(p.total || 0) - ivaCred;

  var filas = items.map(function(it) {
    var costo = it.cost != null ? Number(it.cost) : (it.qty ? Number(it.subtotal) / Number(it.qty) : 0);
    var sub   = it.subtotal != null ? Number(it.subtotal) : costo * Number(it.qty || 0);
    return '<tr><td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:12px;">' + (it.product_name || it.name || '—') + '</td>' +
      '<td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:center;font-size:12px;">' + (it.qty || 0) + '</td>' +
      '<td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:right;font-size:12px;">Q ' + costo.toFixed(2) + '</td>' +
      '<td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:right;font-size:12px;font-weight:700;">Q ' + sub.toFixed(2) + '</td></tr>';
  }).join('');

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Compra ' + folio + '</title>' +
    '<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:12px;color:#222;max-width:700px;margin:0 auto;padding:24px;}' +
    '.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1D9E75;padding-bottom:14px;margin-bottom:18px;}' +
    '.brand h1{font-size:20px;font-weight:900;color:#1a2535;}.brand p{font-size:10px;color:#1D9E75;font-weight:700;letter-spacing:2px;margin-top:2px;}' +
    '.num .label{font-size:10px;color:#999;text-transform:uppercase;letter-spacing:1px;}.num .val{font-size:20px;font-weight:900;color:#1D9E75;}' +
    '.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;padding:12px;background:#f8f9fa;border-radius:8px;border-left:4px solid #1D9E75;}' +
    '.block .lbl{font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;}.block .val{font-size:13px;font-weight:700;}' +
    'table{width:100%;border-collapse:collapse;margin-bottom:14px;}thead tr{background:#1a2535;}thead th{padding:8px 10px;color:#fff;font-size:11px;text-transform:uppercase;text-align:left;}' +
    '.total{display:flex;justify-content:flex-end;}.total-box{min-width:240px;border:1px solid #eee;border-radius:8px;overflow:hidden;}.total-row{display:flex;justify-content:space-between;padding:9px 14px;background:#1D9E75;color:#fff;font-weight:700;font-size:14px;}' +
    '.aviso{background:#FFF8E1;border:1px solid #FFD54F;border-radius:8px;padding:8px 12px;margin-top:16px;font-size:11px;color:#8a6d00;text-align:center;}' +
    '@media print{body{padding:12px;}}</style></head><body>' +
    '<div class="header">' +
      '<div class="brand"><h1>' + _sn + '</h1><p>' + (conFactura ? 'COMPRA CON FACTURA · CRÉDITO FISCAL' : 'COMPROBANTE DE COMPRA · USO INTERNO') + '</p></div>' +
      '<div class="num"><div class="label">N° Compra</div><div class="val"># ' + folio + '</div></div>' +
    '</div>' +
    '<div class="grid">' +
      '<div class="block"><div class="lbl">Proveedor</div><div class="val">' + (p.supplier_name || '—') + '</div></div>' +
      '<div class="block"><div class="lbl">Fecha</div><div class="val">' + fecha + '</div><div style="font-size:11px;color:#666;">' + hora + ' hrs</div></div>' +
      '<div class="block"><div class="lbl">Registrado por</div><div class="val">' + (p.registered_by || '—') + '</div></div>' +
      '<div class="block"><div class="lbl">Artículos</div><div class="val">' + items.length + ' línea(s)</div></div>' +
      (conFactura
        ? '<div class="block"><div class="lbl">NIT proveedor</div><div class="val">' + (p.supplier_nit || '—') + '</div></div>' +
          '<div class="block"><div class="lbl">N° factura</div><div class="val">' + (p.factura_numero || '—') + '</div></div>'
        : '') +
    '</div>' +
    '<table><thead><tr><th>Producto</th><th style="text-align:center;">Cant.</th><th style="text-align:right;">Costo unit.</th><th style="text-align:right;">Subtotal</th></tr></thead><tbody>' + filas + '</tbody></table>' +
    '<div class="total"><div class="total-box">' +
      (conFactura && ivaCred > 0
        ? '<div class="total-row" style="background:#fff;color:#222;font-weight:400;font-size:12px;border-bottom:1px solid #eee;"><span>Base (sin IVA)</span><span>Q ' + baseSinIva.toFixed(2) + '</span></div>' +
          '<div class="total-row" style="background:#fff;color:#222;font-weight:400;font-size:12px;border-bottom:1px solid #eee;"><span>IVA crédito</span><span>Q ' + ivaCred.toFixed(2) + '</span></div>'
        : '') +
      '<div class="total-row"><span>TOTAL COMPRA</span><span>Q ' + Number(p.total).toFixed(2) + '</span></div>' +
    '</div></div>' +
    '<div class="aviso">📦 Documento interno de control de inventario. No es comprobante de venta ni documento tributario.' + (conFactura ? ' El crédito fiscal proviene de la factura del proveedor (NIT y N° arriba).' : '') + '</div>' +
    '</body></html>';

  // Impresión desde la ventana padre (CSP-safe, sin script inline).
  var w = window.open('', '_blank', 'width=800,height=700');
  if (w) {
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(function() { try { w.print(); } catch (e) {} }, 400);
  }
}

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
  var _pHasF  = useState(false); var pHasFactura = _pHasF[0]; var setPHasFactura = _pHasF[1];
  var _pNit   = useState('');    var pNit    = _pNit[0];    var setPNit    = _pNit[1];
  var _pFacNum= useState('');    var pFacNum = _pFacNum[0]; var setPFacNum = _pFacNum[1];
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
    setPHasFactura(false); setPNit(''); setPFacNum('');
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
    var _ivaPctC  = parseFloat((getStore().iva_percent) || 0) || 0;
    var _ivaCredC = (pHasFactura && _ivaPctC > 0) ? pTotal - pTotal / (1 + _ivaPctC / 100) : 0;
    suppliersAPI.createPurchase({ supplierId: pSupId || null, supplierName: pSup, items: pItems, notes: pNotes, hasFactura: pHasFactura, supplierNit: pNit.trim() || null, facturaNumero: pFacNum.trim() || null, ivaAmount: _ivaCredC })
      .then(function(p) {
        setPurchases(function(prev) { return [p].concat(prev); });
        onStockUpdate();
        showFlash('✓ Compra registrada y stock actualizado', 'ok');
        setShowPurchModal(false); setSaving(false);
        // Ofrecer el comprobante al momento (igual queda el botón 🖨 en el historial)
        if (window.confirm('Compra registrada.\n\n¿Imprimir el comprobante de la compra ahora?')) {
          printCompra(p);
        }
      })
      .catch(function(e) {
        setSaving(false);
        alert(e && e.error ? e.error : 'Error al registrar compra');
      });
  }

  // Total de la compra en curso
  var pTotal = pItems.reduce(function(s, i) { return s + i.subtotal; }, 0);
  // IVA crédito fiscal (solo si la compra es con factura). GT: precio con IVA incluido → desglose hacia atrás.
  var ivaPctCompra     = parseFloat((getStore().iva_percent) || 0) || 0;
  var ivaCreditoCompra = (pHasFactura && ivaPctCompra > 0) ? pTotal - pTotal / (1 + ivaPctCompra / 100) : 0;

  var supPag = usePaginator(suppliers, 20);
  var purPag = usePaginator(purchases, 20);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Cargando…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <p style={H1}>🏭 Proveedores y Compras</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {tab === 'proveedores' && (
            <button style={mkBtn('green')} onClick={function() {
              var rows = suppliers.map(function(s) { return [s.name, s.phone || '', s.email || '', s.address || '', s.active ? 'Activo' : 'Inactivo']; });
              exportExcel(rows, ['Nombre', 'Teléfono', 'Email', 'Dirección', 'Estado'], 'Proveedores');
              showFlash('✅ Excel exportado', 'ok');
            }}>📊 Excel</button>
          )}
          {tab === 'compras' && (
            <button style={mkBtn('green')} onClick={function() {
              var rows = purchases.map(function(p) { return [fmtD(p.date), p.supplier_name, (p.items || []).length, Q(p.total), p.notes || '']; });
              exportExcel(rows, ['Fecha', 'Proveedor', 'Artículos', 'Total', 'Notas'], 'Compras');
              showFlash('✅ Excel exportado', 'ok');
            }}>📊 Excel</button>
          )}
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
                    {['#', 'Fecha', 'Proveedor', 'Artículos', 'Total', 'Registrado por', ''].map(function(h) {
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
                        <td style={Object.assign({}, sTD, { textAlign: 'right' })}>
                          <button style={Object.assign({}, mkBtn('blue'), { padding: '4px 10px', fontSize: 11 })} onClick={function() { printCompra(p); }}>🖨</button>
                        </td>
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
            <input style={sInput} placeholder="Ej: pago en efectivo, orden #…" value={pNotes} onChange={function(e) { setPNotes(e.target.value); }} />

            {/* ── Crédito fiscal: solo si la compra tuvo factura del proveedor ── */}
            <div style={{ marginTop: 14, padding: 12, background: '#f8f9fa', borderRadius: 8, border: '1px solid #eee' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={pHasFactura} onChange={function(e) { setPHasFactura(e.target.checked); }} />
                🧾 Compra con factura (crédito fiscal)
              </label>
              {pHasFactura && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 3 }}>NIT del proveedor</label>
                      <input style={sInput} placeholder="NIT en la factura" value={pNit} onChange={function(e) { setPNit(e.target.value); }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 3 }}>N° de factura</label>
                      <input style={sInput} placeholder="Serie y número" value={pFacNum} onChange={function(e) { setPFacNum(e.target.value); }} />
                    </div>
                  </div>
                  {ivaPctCompra > 0
                    ? <p style={{ fontSize: 12, color: '#1D9E75', fontWeight: 700, marginTop: 8 }}>
                        IVA crédito ({ivaPctCompra}%): Q {ivaCreditoCompra.toFixed(2)}
                        <span style={{ color: '#999', fontWeight: 400 }}> · base sin IVA: Q {(pTotal - ivaCreditoCompra).toFixed(2)}</span>
                      </p>
                    : <p style={{ fontSize: 11, color: '#999', marginTop: 8 }}>Configurá el IVA del negocio para calcular el crédito fiscal.</p>}
                </div>
              )}
            </div>

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
