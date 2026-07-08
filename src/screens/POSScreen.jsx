// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA: POSScreen (Punto de Venta)
//
// Interfaz de cobro rápido. Divide la pantalla en dos paneles:
//   Izquierda: catálogo de productos con buscador
//   Derecha:   carrito + formulario de cobro
//
// En móvil: cambia a tabs "Productos" / "Carrito" (el grid se oculta).
//
// El estado del carrito y POS vive en App.jsx — este componente solo
// recibe props y callbacks. No tiene estado propio de lógica de negocio,
// solo estado de UI (dropdown de cliente, descuento por ítem, tabs móvil).
//
// Tipos de cobro:
//   • "completo"  — cobro total inmediato
//   • "parcial"   — abono inicial, genera cuenta por cobrar con saldo
//   • "pendiente" — sin cobro, queda como deuda pendiente completa
//
// Props:
//   products          {Array}    — catálogo de productos
//   filteredPOS       {Array}    — productos ya filtrados por búsqueda posQ
//   cart              {Array}    — artículos en el carrito
//   posQ              {string}   — texto de búsqueda del catálogo
//   setPosQ           {Function}
//   payMethod         {string}   — 'Efectivo' | 'Tarjeta' | 'Transferencia'
//   setPayMethod      {Function}
//   payType           {string}   — 'completo' | 'parcial' | 'pendiente'
//   setPayType        {Function}
//   cashIn            {string}   — efectivo recibido (para calcular vuelto)
//   setCashIn         {Function}
//   initialPay        {string}   — monto del abono inicial (payType='parcial')
//   setInitialPay     {Function}
//   clientName        {string}   — nombre libre del cliente
//   setClientName     {Function}
//   selectedClientId  {string|null} — ID del cliente seleccionado del listado
//   setSelectedClientId {Function}
//   saleNote          {string}   — nota/descripción libre de la venta
//   setSaleNote       {Function}
//   cartTotal         {number}   — suma total del carrito
//   vuelto            {number|null} — vuelto calculado (cashIn - cartTotal)
//   initPaidVal       {number}   — valor numérico de initialPay
//   addToCart         {Function} — (product) agrega al carrito
//   changeQty         {Function} — (itemId, delta) modifica cantidad
//   removeFromCart    {Function} — (itemId) elimina del carrito
//   applyDiscount     {Function} — (itemId, newPrice) aplica descuento
//   checkout          {Function} — procesa la venta
//   resetPOS          {Function} — limpia el carrito
//   flash             {Object}   — { msg, type } para mensajes de éxito/error
//   clients           {Array}    — lista de clientes para el buscador
//   accounts          {Array}    — cuentas para mostrar deuda del cliente
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { TEAL, sCard, sInput, sLabel, mkBtn, mkBadge } from '../styles/theme.js';
import { Q } from '../utils/formatters.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { serialsAPI } from '../utils/api.js';

// Estilo de los botones +/- de cantidad en el carrito
var sQB = {
  cursor: 'pointer', background: '#f0efeb', width: 26, height: 26,
  borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 16, userSelect: 'none', flexShrink: 0, border: '1px solid rgba(0,0,0,0.1)',
};

// Colores del banner de flash (ok / warn / err)
var FC = { ok: '#EAF3DE', warn: '#FAEEDA', err: '#FDECEA' };
var FT = { ok: '#27500A', warn: '#633806', err: '#7B1010' };
var FB = { ok: '#97C459', warn: '#EF9F27', err: '#E53935' };

export default function POSScreen({
  products, filteredPOS, cart,
  posQ, setPosQ,
  payMethod, setPayMethod,
  secondMethod, setSecondMethod,
  secondAmount, setSecondAmount,
  payType, setPayType,
  cashIn, setCashIn,
  initialPay, setInitialPay,
  clientName, setClientName,
  selectedClientId, setSelectedClientId,
  saleNote, setSaleNote,
  cartTotal, vuelto, initPaidVal,
  addToCart, changeQty, removeFromCart, applyDiscount,
  checkout, resetPOS, flash,
  clients, accounts,
  ivaPercent, ivaAmount, subtotalNeto,
}) {
  clients  = clients  || [];
  accounts = accounts || [];
  saleNote = saleNote || '';
  setSaleNote = setSaleNote || function() {};

  // Búsqueda de cliente en el carrito
  var _cq  = useState('');    var cliQ     = _cq[0];  var setCliQ     = _cq[1];
  var _cdd = useState(false); var showDrop = _cdd[0]; var setShowDrop = _cdd[1];

  // Descuento inline por ítem: qué ítem está en edición y su nuevo precio
  var _di = useState(null); var discountItemId = _di[0]; var setDiscountItemId = _di[1];
  var _dv = useState('');   var discountVal    = _dv[0]; var setDiscountVal    = _dv[1];

  // Selector de serial / IMEI al agregar producto
  var _spk = useState(null);  var serialPickProd    = _spk[0]; var setSerialPickProd    = _spk[1];
  var _spd = useState([]);    var serialPickList    = _spd[0]; var setSerialPickList    = _spd[1];
  var _spl = useState(false); var serialPickLoading = _spl[0]; var setSerialPickLoading = _spl[1];

  // Tabs en móvil: "productos" o "carrito"
  var isMobile = useIsMobile();
  var _pt  = useState('productos'); var posTab = _pt[0]; var setPosTab = _pt[1];

  // Maneja clic en producto: verifica si tiene seriales disponibles
  async function handleProductClick(p) {
    if (p.unit === 'serv' || p.stock === 0) { addToCart(p); return; }
    setSerialPickLoading(true);
    try {
      var seriales = await serialsAPI.list(p.id, 'disponible');
      if (!seriales || seriales.length === 0) {
        addToCart(p);
      } else {
        setSerialPickProd(p);
        setSerialPickList(seriales);
      }
    } catch (_) {
      addToCart(p);
    }
    setSerialPickLoading(false);
  }

  // Aplica el descuento al ítem y cierra el editor
  function applyDiscountLocal(itemId) {
    var newPrice = parseFloat(discountVal);
    if (!newPrice || newPrice <= 0) { setDiscountItemId(null); setDiscountVal(''); return; }
    // Un "descuento" no puede SUBIR el precio por encima del de lista
    var _it = cart.find(function(c) { return (c.serial_id || c.id) === itemId; });
    var _orig = _it ? Number(_it.originalPrice || _it.price) : null;
    if (_orig !== null && newPrice > _orig) {
      alert('El nuevo precio (' + newPrice + ') no puede ser mayor al precio de lista (' + _orig + ')');
      return;
    }
    applyDiscount(itemId, newPrice);
    setDiscountItemId(null);
    setDiscountVal('');
  }

  // Clientes que coinciden con la búsqueda (máx 5)
  var cliResults = cliQ.trim().length > 0
    ? clients.filter(function(c) {
        var q = cliQ.toLowerCase();
        return (c.name  || '').toLowerCase().indexOf(q) >= 0
          || (c.dpi   || '').indexOf(cliQ.trim()) >= 0
          || (c.cliCode || '').toLowerCase().indexOf(q) >= 0
          || (c.phone || '').indexOf(cliQ.trim()) >= 0;
      }).slice(0, 5)
    : [];

  // Cliente actualmente vinculado a la venta
  var selCli = selectedClientId ? clients.find(function(c) { return c.id === selectedClientId; }) : null;

  // Deuda pendiente del cliente seleccionado (para mostrar alerta)
  var deudaCliente = selCli
    ? accounts.filter(function(a) {
        return (a.clientId === selCli.id || (a.client === selCli.name && !a.clientId)) && a.status !== 'pagado';
      }).reduce(function(s, a) { return s + a.balance; }, 0)
    : 0;

  function selectClient(c) {
    setSelectedClientId(c.id);
    setClientName(c.name);
    setCliQ('');
    setShowDrop(false);
  }
  function clearClient() {
    setSelectedClientId(null);
    setClientName('');
    setCliQ('');
    setShowDrop(false);
  }
  function handleCliInput(val) {
    setCliQ(val);
    setClientName(val);
    setSelectedClientId(null);
    setShowDrop(true);
  }

  return (
    <div>
      <p style={{ fontSize: 'clamp(17px,4vw,22px)', fontWeight: 600, margin: '0 0 14px', color: 'var(--text-primary,#1a1a1a)' }}>
        🛒 Nueva Venta
      </p>

      {/* Banner de confirmación o error */}
      {flash && flash.msg && (
        <div style={{
          background: FC[flash.type] || FC.ok,
          border: '1px solid ' + (FB[flash.type] || FB.ok),
          borderRadius: 8, padding: '10px 16px', marginBottom: 14,
          color: FT[flash.type] || FT.ok, fontSize: 14,
        }}>{flash.msg}</div>
      )}

      {/* Tabs en móvil */}
      {isMobile && (
        <div style={{ display: 'flex', gap: 0, marginBottom: 14, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.12)' }}>
          <button
            onClick={function() { setPosTab('productos'); }}
            style={{ flex: 1, padding: 11, fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 0, background: posTab === 'productos' ? TEAL : '#f4f4f4', color: posTab === 'productos' ? '#fff' : '#555', cursor: 'pointer' }}
          >📦 Productos</button>
          <button
            onClick={function() { setPosTab('carrito'); }}
            style={{ flex: 1, padding: 11, fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 0, background: posTab === 'carrito' ? TEAL : '#f4f4f4', color: posTab === 'carrito' ? '#fff' : '#555', cursor: 'pointer', position: 'relative' }}
          >
            🛒 Carrito {cart.length > 0 && <span style={{ background: '#E24B4A', color: '#fff', borderRadius: 10, fontSize: 10, padding: '1px 6px', fontWeight: 700, marginLeft: 4 }}>{cart.length}</span>}
          </button>
        </div>
      )}

      <div style={isMobile ? {} : { display: 'grid', gridTemplateColumns: '1fr 340px', gap: 18 }}>

        {/* ── Panel izquierdo: catálogo ── */}
        <div style={Object.assign({}, sCard, isMobile && posTab !== 'productos' ? { display: 'none' } : {})}>
          <input
            style={Object.assign({}, sInput, { marginBottom: 14 })}
            placeholder="🔍  Buscar por nombre, código o estantería..."
            value={posQ}
            onChange={function(e) { setPosQ(e.target.value); }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(148px,1fr))', gap: 10, maxHeight: 460, overflowY: 'auto', paddingRight: 2 }}>
            {filteredPOS.map(function(p) {
              var inC    = cart.find(function(i) { return i.id === p.id; });
              var agotado = p.stock === 0 && p.unit !== 'serv';
              return (
                <div
                  key={p.id}
                  onClick={function() { handleProductClick(p); }}
                  style={{
                    padding: 12, borderRadius: 10, cursor: agotado ? 'not-allowed' : 'pointer',
                    border: '1.5px solid ' + (inC ? TEAL : 'rgba(0,0,0,0.1)'),
                    background: agotado ? '#f5f4f0' : '#fff',
                    opacity: agotado ? 0.52 : 1, position: 'relative',
                  }}
                >
                  {inC && (
                    <div style={{ position: 'absolute', top: 6, right: 6, background: TEAL, color: '#fff', borderRadius: 10, fontSize: 10, padding: '1px 6px', fontWeight: 700 }}>
                      {inC.qty}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: '#999', marginBottom: 3, fontFamily: 'monospace' }}>{p.code} · {p.shelf}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 5, lineHeight: 1.35 }}>{p.name}</div>
                  <div style={{ fontSize: 15, color: TEAL, fontWeight: 700 }}>{Q(p.price)}</div>
                  <div style={{ fontSize: 10, marginTop: 4, color: agotado ? '#E24B4A' : p.stock < 5 ? '#854F0B' : '#999' }}>
                    {p.unit === 'serv' ? 'Servicio' : agotado ? 'Sin stock' : 'Stock: ' + p.stock}
                  </div>
                </div>
              );
            })}
            {filteredPOS.length === 0 && <p style={{ color: '#999', fontSize: 14 }}>Sin resultados</p>}
          </div>
        </div>

        {/* ── Panel derecho: carrito y cobro ── */}
        <div style={Object.assign({}, sCard, { display: 'flex', flexDirection: 'column' }, isMobile && posTab !== 'carrito' ? { display: 'none' } : {})}>
          <p style={{ fontWeight: 600, margin: '0 0 14px', fontSize: 15 }}>
            Carrito <span style={{ fontWeight: 400, color: '#999', fontSize: 13 }}>({cart.length})</span>
          </p>

          {/* Lista de ítems del carrito */}
          {cart.length === 0
            ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 13, textAlign: 'center', minHeight: 180 }}>
                Seleccioná productos del catálogo
              </div>
            : <div style={{ flex: 1, overflowY: 'auto', marginBottom: 14 }}>
                {cart.map(function(item) {
                  var isEditing  = discountItemId === (item.serial_id || item.id);
                  var hasDiscount = item.originalPrice && item.price < item.originalPrice;
                  return (
                    <div key={item.serial_id || item.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ flex: 1, marginRight: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{item.name}</div>
                          <div style={{ fontSize: 10, color: '#999', fontFamily: 'monospace' }}>{item.code}</div>
                          {item.imei && <div style={{ fontSize: 10, color: '#1D9E75', fontFamily: 'monospace', marginTop: 2 }}>IMEI: {item.imei}</div>}
                          {hasDiscount && <div style={{ fontSize: 10, color: '#E65100', marginTop: 2 }}>Desc. auto. por: {item.discountBy || 'usuario'}</div>}
                        </div>
                        <span style={{ cursor: 'pointer', color: '#E24B4A', fontSize: 18, lineHeight: 1, flexShrink: 0 }} onClick={function() { removeFromCart(item.serial_id || item.id); }}>×</span>
                      </div>

                      {/* Controles de cantidad y precio */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={sQB} onClick={function() { changeQty(item.serial_id || item.id, -1); }}>−</div>
                          <span style={{ fontSize: 14, fontWeight: 600, minWidth: 22, textAlign: 'center' }}>{item.qty}</span>
                          <div style={sQB} onClick={function() { changeQty(item.serial_id || item.id, 1); }}>+</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          {hasDiscount && <div style={{ fontSize: 10, color: '#999', textDecoration: 'line-through' }}>{Q(item.originalPrice * item.qty)}</div>}
                          <span style={{ fontSize: 14, fontWeight: 700, color: hasDiscount ? '#E65100' : TEAL }}>{Q(item.price * item.qty)}</span>
                        </div>
                      </div>

                      {/* Editor de descuento por ítem */}
                      {!isEditing ? (
                        <div style={{ marginTop: 6, textAlign: 'right' }}>
                          <span
                            onClick={function() { setDiscountItemId(item.serial_id || item.id); setDiscountVal(item.price.toFixed(2)); }}
                            style={{ fontSize: 10, color: '#E65100', cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            {hasDiscount ? 'Editar descuento' : '% Aplicar descuento'}
                          </span>
                        </div>
                      ) : (
                        <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 10, color: '#666', marginBottom: 2 }}>Precio c/descuento (precio lista: {Q(item.originalPrice || item.price)})</div>
                            <input
                              type="number"
                              style={Object.assign({}, sInput, { padding: '5px 8px', fontSize: 12 })}
                              value={discountVal}
                              placeholder="Nuevo precio Q"
                              onChange={function(e) { setDiscountVal(e.target.value); }}
                              onKeyDown={function(e) {
                                if (e.key === 'Enter') applyDiscountLocal(item.serial_id || item.id);
                                if (e.key === 'Escape') { setDiscountItemId(null); setDiscountVal(''); }
                              }}
                              autoFocus
                            />
                          </div>
                          <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
                            <button style={Object.assign({}, mkBtn('teal'), { padding: '4px 8px', fontSize: 11 })} onClick={function() { applyDiscountLocal(item.serial_id || item.id); }}>✓</button>
                            <button style={Object.assign({}, mkBtn('gray'), { padding: '4px 8px', fontSize: 11 })} onClick={function() { setDiscountItemId(null); setDiscountVal(''); }}>✕</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
          }

          {/* ── Sección de cobro ── */}
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: 14 }}>
            {ivaPercent > 0 && cart.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', marginBottom: 2 }}>
                  <span>Subtotal (sin IVA)</span>
                  <span>{Q(subtotalNeto || (cartTotal - ivaAmount))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', marginBottom: 4 }}>
                  <span>IVA ({ivaPercent}%)</span>
                  <span>{Q(ivaAmount)}</span>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 19, fontWeight: 700, marginBottom: 14 }}>
              <span>Total</span>
              <span style={{ color: TEAL }}>{Q(cartTotal)}</span>
            </div>

            {/* Selección de cliente */}
            <div style={{ marginBottom: 10 }}>
              <label style={sLabel}>👤 Cliente</label>
              {selCli ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1.5px solid ' + TEAL, background: '#E1F5EE' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#085041' }}>{selCli.name}</div>
                      <div style={{ fontSize: 11, color: '#0F6E56', fontFamily: 'monospace' }}>{selCli.cliCode}{selCli.dpi ? ' · DPI: ' + selCli.dpi : ''}</div>
                    </div>
                    <span onClick={clearClient} style={{ cursor: 'pointer', color: '#E24B4A', fontSize: 16, fontWeight: 700, padding: '2px 6px' }}>×</span>
                  </div>
                  {deudaCliente > 0 && (
                    <div style={{ background: '#FCEBEB', border: '1px solid #F09595', borderRadius: 6, padding: '6px 10px', marginTop: 6, fontSize: 12, color: '#791F1F' }}>
                      ⚠ Este cliente tiene <b>{Q(deudaCliente)}</b> pendiente de pago
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <input
                    style={sInput}
                    value={cliQ || clientName}
                    placeholder="Buscar cliente por nombre, DPI o código..."
                    onChange={function(e) { handleCliInput(e.target.value); }}
                    onFocus={function() { setShowDrop(true); }}
                    onBlur={function() { setTimeout(function() { setShowDrop(false); }, 200); }}
                  />
                  {showDrop && cliQ.trim().length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 200, overflowY: 'auto', marginTop: 2 }}>
                      {cliResults.map(function(c) {
                        var deuda = accounts.filter(function(a) {
                          return (a.clientId === c.id || (a.client === c.name && !a.clientId)) && a.status !== 'pagado';
                        }).reduce(function(s, a) { return s + a.balance; }, 0);
                        return (
                          <div key={c.id} onMouseDown={function() { selectClient(c); }} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                              <div style={{ fontSize: 11, color: '#999', fontFamily: 'monospace' }}>{c.cliCode}{c.dpi ? ' · ' + c.dpi : ''}{c.phone ? ' · ' + c.phone : ''}</div>
                            </div>
                            {deuda > 0 && <span style={mkBadge('red')}>{Q(deuda)}</span>}
                          </div>
                        );
                      })}
                      {cliResults.length === 0 && (
                        <div style={{ padding: '10px 14px', fontSize: 13, color: '#999' }}>
                          No se encontró "{cliQ}" — se registrará como cliente ocasional
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tipo de cobro */}
            <div style={{ marginBottom: 10 }}>
              <label style={sLabel}>Tipo de cobro</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {[['completo', '✓ Completo'], ['parcial', '💰 Abono'], ['pendiente', '⏳ Pendiente']].map(function(pair) {
                  return (
                    <button
                      key={pair[0]}
                      onClick={function() { setPayType(pair[0]); }}
                      style={Object.assign({}, mkBtn(payType === pair[0] ? 'teal' : 'gray'), { padding: '7px 4px', fontSize: 12, border: payType === pair[0] ? 'none' : '1px solid rgba(0,0,0,0.15)' })}
                    >{pair[1]}</button>
                  );
                })}
              </div>
            </div>

            {/* Campo de abono inicial (solo en modo parcial) */}
            {payType === 'parcial' && (
              <div style={{ marginBottom: 10 }}>
                <label style={sLabel}>Abono inicial (Q)</label>
                <input type="number" min="0" style={sInput} value={initialPay} placeholder={'Máx: ' + cartTotal.toFixed(2)} onChange={function(e) { var v=e.target.value; if(parseFloat(v)<0) v='0'; setInitialPay(v); }} />
                {initPaidVal > 0 && <div style={{ marginTop: 5, fontSize: 13, fontWeight: 500, color: '#E24B4A' }}>Saldo: {Q(Math.max(0, cartTotal - initPaidVal))}</div>}
              </div>
            )}

            {/* Método de pago (oculto si es pendiente) */}
            {payType !== 'pendiente' && (
              <div style={{ marginBottom: 10 }}>
                <label style={sLabel}>Método de pago</label>
                <select style={sInput} value={payMethod} onChange={function(e) { setPayMethod(e.target.value); }}>
                  <option>Efectivo</option>
                  <option>Tarjeta</option>
                  <option>Transferencia</option>
                </select>
              </div>
            )}

            {/* Segundo método de pago (pago dividido) */}
            {payType === 'completo' && cart.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <label style={{ ...sLabel, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!secondMethod} onChange={function(e) { var def = ['Efectivo','Tarjeta','Transferencia'].find(function(m){ return m !== payMethod; }); setSecondMethod(e.target.checked ? def : ''); setSecondAmount(''); }} />
                  Dividir pago en dos métodos
                </label>
                {!!secondMethod && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <select style={{ ...sInput, flex: 1 }} value={secondMethod} onChange={function(e) { setSecondMethod(e.target.value); }}>
                      {['Efectivo','Tarjeta','Transferencia'].filter(function(m){ return m !== payMethod; }).map(function(m){ return <option key={m}>{m}</option>; })}
                    </select>
                    <input type="number" style={{ ...sInput, flex: 1 }} placeholder={'Monto 2do método'} value={secondAmount} onChange={function(e) { setSecondAmount(e.target.value); }} />
                  </div>
                )}
                {!!secondMethod && secondAmount && (
                  <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>
                    {payMethod}: {Q(cartTotal - (parseFloat(secondAmount) || 0))} + {secondMethod}: {Q(parseFloat(secondAmount) || 0)}
                  </div>
                )}
              </div>
            )}

            {/* Campo de efectivo y cálculo de vuelto */}
            {payMethod === 'Efectivo' && payType === 'completo' && !secondMethod && cart.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <label style={sLabel}>Efectivo recibido (Q)</label>
                <input type="number" style={sInput} value={cashIn} placeholder="0.00" onChange={function(e) { setCashIn(e.target.value); }} />
                {vuelto !== null && (
                  <div style={{ marginTop: 5, fontSize: 13, fontWeight: 600, color: vuelto >= 0 ? TEAL : '#E24B4A' }}>
                    {vuelto >= 0 ? '✓ Vuelto: ' + Q(vuelto) : '✗ Faltan: ' + Q(Math.abs(vuelto))}
                  </div>
                )}
              </div>
            )}

            {/* Nota libre */}
            <div style={{ marginBottom: 10 }}>
              <label style={sLabel}>📝 Nota / descripción (opcional)</label>
              <input style={sInput} value={saleNote} placeholder="Ej: Reparación pantalla, garantía 30 días..." onChange={function(e) { setSaleNote(e.target.value); }} />
            </div>

            {/* Botón de cobro */}
            <button
              style={Object.assign({}, mkBtn(payType === 'pendiente' ? 'purple' : payType === 'parcial' ? 'blue' : 'teal'), { width: '100%', padding: 12, fontSize: 15, opacity: cart.length === 0 ? 0.5 : 1 })}
              onClick={checkout}
            >
              {payType === 'pendiente' ? '⏳ Dejar Pendiente' : payType === 'parcial' ? '💰 Registrar Abono' : '✓ Cobrar Venta'}
            </button>
            {cart.length > 0 && (
              <button
                style={Object.assign({}, mkBtn('gray'), { width: '100%', marginTop: 8, padding: 9, fontSize: 13 })}
                onClick={resetPOS}
              >Limpiar carrito</button>
            )}
          </div>
        </div>
      </div>
      {/* ── Modal: Selector de Serial / IMEI ── */}
      {serialPickProd && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px 20px', maxWidth: 440, width: '100%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: 15, margin: '0 0 3px' }}>🔢 Seleccionar IMEI / Serial</p>
                <p style={{ fontSize: 12, color: '#666', margin: 0 }}>{serialPickProd.name}</p>
              </div>
              <button style={mkBtn('gray')} onClick={function() { setSerialPickProd(null); setSerialPickList([]); }}>✕</button>
            </div>
            {serialPickLoading ? (
              <p style={{ textAlign: 'center', color: '#999', padding: 20 }}>Cargando seriales...</p>
            ) : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <button
                    style={Object.assign({}, mkBtn('gray'), { width: '100%', fontSize: 13 })}
                    onClick={function() { setSerialPickProd(null); setSerialPickList([]); addToCart(serialPickProd); }}
                  >
                    Agregar sin serial específico
                  </button>
                </div>
                <div style={{ borderTop: '1px solid #eee', paddingTop: 12 }}>
                  <p style={{ fontSize: 12, color: '#666', margin: '0 0 8px', fontWeight: 600 }}>Seriales disponibles ({serialPickList.length})</p>
                  {serialPickList.map(function(s) {
                    return (
                      <div
                        key={s.id}
                        onClick={function() {
                          addToCart(Object.assign({}, serialPickProd, { serial_id: s.id, imei: s.imei }));
                          setSerialPickProd(null);
                          setSerialPickList([]);
                        }}
                        style={{ padding: '10px 14px', border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 8, marginBottom: 6, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 14 }}>{s.imei}</span>
                        <span style={{ fontSize: 11, color: '#999' }}>{s.notes || ''}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
