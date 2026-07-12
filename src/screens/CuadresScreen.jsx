// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA: CuadresScreen (Cuadres y Reportes de Cierre)
//
// Genera un resumen financiero del negocio para el período seleccionado.
//
// Períodos disponibles:
//   Hoy | Esta semana | Últimos 15 días | Este mes | Mes anterior | Personalizado
//
// Métricas calculadas:
//   - Ventas cobradas y ventas a crédito del período
//   - Ingresos por método de pago: Efectivo, Tarjeta, Transferencia
//   - Abonos cobrados (de cuentas por cobrar)
//   - Reembolsos por devolución (desglosados por método)
//   - Ganancia bruta estimada (si se configuraron costos en el inventario)
//   - Top 5 más vendidos (por unidades) y top 5 más rentables (por ganancia Q)
//
// Función printCuadre():
//   Genera e imprime/descarga PDF con todos los datos del período,
//   incluyendo tabla de ventas individual y resumen por método de pago.
//
// Props:
//   sales      {Array}  — ventas completadas y créditos
//   accounts   {Array}  — cuentas por cobrar (con payments[])
//   returns    {Array}  — devoluciones del período
//   products   {Array}  — inventario (para calcular costos de venta)
//   repairs    {Array}  — reparaciones (para mostrar activas/listas)
//   session    {Object} — sesión activa (name, role)
//   showFlash  {Function} — (msg, type) notificación flash
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { TEAL, NAVY, sCard, sInput, sLabel, sTH, sTD, mkBtn, mkBadge } from '../styles/theme.js';
import { fmtD, fmtT } from '../utils/formatters.js';
import { getStore } from '../utils/receipt.js';
import { suppliersAPI } from '../utils/api.js';
import { APP_NAME, APP_VERSION, STORE_FALLBACK, ROLE_LABEL } from '../constants/index.js';
import HelpTip from '../components/ui/HelpTip.jsx';
import { exportExcel } from '../utils/export.js';

// Formatea un número como "Q 1,234.56"
var Q = function(n) { return 'Q ' + Number(n).toFixed(2); };

// Estilo del título H1
var H1 = { fontSize: 'clamp(17px,4vw,22px)', fontWeight: 600, margin: '0 0 20px', color: 'var(--text-primary,#1a1a1a)' };

// ── Componente MetricBox (local, solo para esta pantalla) ─────────────────
function MetricBox({ label, value, color }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '14px 16px', borderTop: '3px solid ' + color }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────
export default function CuadresScreen({ sales, accounts, returns, products, repairs, session, showFlash }) {
  sales    = sales    || [];
  accounts = accounts || [];
  returns  = returns  || [];
  products = products || [];
  repairs  = repairs  || [];
  session  = session  || {};
  showFlash = showFlash || function() {};

  var now = new Date();

  // Selector de rango temporal
  var _rng  = useState('hoy'); var rango    = _rng[0];  var setRango    = _rng[1];
  var _df   = useState('');    var dateFrom = _df[0];   var setDateFrom = _df[1];
  var _dt   = useState('');    var dateTo   = _dt[0];   var setDateTo   = _dt[1];

  // ── Helpers de rango ────────────────────────────────────────────────────

  // Etiqueta legible del período seleccionado
  function getRangeLabel() {
    if (rango === 'hoy')      return 'Hoy — ' + now.toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' });
    if (rango === 'semana')   return 'Esta semana';
    if (rango === 'quincenal') return 'Últimos 15 días';
    if (rango === 'mes')      return now.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' });
    if (rango === 'mes_ant') {
      var d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' });
    }
    if (rango === 'custom' && dateFrom && dateTo) return dateFrom + ' al ' + dateTo;
    return 'Período seleccionado';
  }

  // Devuelve true si la fecha está dentro del rango seleccionado
  function inRange(dateStr) {
    var d = new Date(dateStr);
    if (rango === 'hoy') return d.toDateString() === now.toDateString();
    if (rango === 'semana') {
      var wStart = new Date(now);
      // Semana estandar lunes-domingo (antes empezaba domingo)
      wStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      wStart.setHours(0, 0, 0, 0);
      return d >= wStart && d <= now;
    }
    if (rango === 'quincenal') {
      var q15 = new Date(now);
      q15.setDate(now.getDate() - 14); // 15 dias calendario INCLUYENDO hoy
      q15.setHours(0, 0, 0, 0);
      return d >= q15 && d <= now;
    }
    if (rango === 'mes') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (rango === 'mes_ant') {
      var pm = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      var py = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      return d.getMonth() === pm && d.getFullYear() === py;
    }
    if (rango === 'custom' && dateFrom && dateTo) {
      var from = new Date(dateFrom + 'T00:00:00');
      var to   = new Date(dateTo   + 'T23:59:59');
      return d >= from && d <= to;
    }
    return false;
  }

  // Compras del tenant (para el IVA crédito). Se cargan aquí para no tocar App.jsx;
  // el API ya filtra por tenant (withTenant), así que solo llegan las del negocio en sesión.
  var _purch = useState([]); var purchases = _purch[0]; var setPurchasesC = _purch[1];
  useEffect(function() {
    suppliersAPI.getPurchases().then(function(d) { setPurchasesC(d || []); }).catch(function() {});
  }, []);

  // ── Cálculos del período ────────────────────────────────────────────────

  // Ventas cobradas del período
  var periodSales        = sales.filter(function(s) { return inRange(s.date) && s.status === 'completado'; });
  // Ventas a crédito del período
  var periodSalesCredito = sales.filter(function(s) { return inRange(s.date) && s.status === 'cuenta'; });
  // Crédito otorgado = monto FINANCIADO (total − abono inicial). El abono inicial ya se
  // reporta en "Abonos cobrados"; sumarlo también aquí lo mostraba dos veces.
  var abonoInicialPorVenta = {};
  accounts.forEach(function(a) {
    if (!a.sale_id) return;
    (a.payments || []).forEach(function(p) {
      if ((p.note || '') === 'Abono inicial') abonoInicialPorVenta[a.sale_id] = (abonoInicialPorVenta[a.sale_id] || 0) + Number(p.amount || 0);
    });
  });
  var totalVentasCredito = periodSalesCredito.reduce(function(s, x) { return s + Math.max(0, x.total - (abonoInicialPorVenta[x.id] || 0)); }, 0);

  // ── IVA del período: débito (ventas) vs crédito (compras con factura) ──
  // GT: precio con IVA incluido → desglose hacia atrás. Débito = todas las ventas emitidas
  // en el período (contado + crédito). Crédito = IVA de las compras que tuvieron factura.
  var ivaPctCuadre   = parseFloat((getStore().iva_percent) || 0) || 0;
  var baseVentasIva  = periodSales.concat(periodSalesCredito).reduce(function(s, x) { return s + Number(x.total || 0); }, 0);
  var ivaDebito      = ivaPctCuadre > 0 ? baseVentasIva - baseVentasIva / (1 + ivaPctCuadre / 100) : 0;
  var periodCompras  = purchases.filter(function(p) { return inRange(p.created_at); });
  var comprasFactura = periodCompras.filter(function(p) { return p.has_factura; });
  var ivaCredito     = comprasFactura.reduce(function(s, p) { return s + Number(p.iva_amount || 0); }, 0);
  var ivaNeto        = ivaDebito - ivaCredito;

  // Ingresos por método de pago (ventas cobradas)
  var byMethod = { Efectivo: 0, Tarjeta: 0, Transferencia: 0 };
  periodSales.forEach(function(s) {
    // Pago dividido: repartir entre los dos métodos (antes se sumaba todo al primero)
    var seg = Number(s.second_amount || 0);
    var m1 = byMethod[s.method] !== undefined ? s.method : 'Transferencia';
    if (s.second_method && seg > 0) {
      var m2 = byMethod[s.second_method] !== undefined ? s.second_method : 'Transferencia';
      byMethod[m1] += s.total - seg;
      byMethod[m2] += seg;
    } else {
      byMethod[m1] += s.total;
    }
  });

  // Abonos recibidos en el período (de cuentas por cobrar), desglosados por método
  var abonosPeriod = 0, abonosEfectivo = 0, abonosTarjeta = 0, abonosTransferencia = 0;
  accounts.forEach(function(a) {
    (a.payments || []).forEach(function(p) {
      if (inRange(p.date)) {
        var amt = Number(p.amount || 0);
        abonosPeriod += amt;
        if (p.method === 'Efectivo')       abonosEfectivo += amt;
        else if (p.method === 'Tarjeta')   abonosTarjeta  += amt;
        else                                abonosTransferencia += amt;
      }
    });
  });

  // Devoluciones del período con sus reembolsos
  var retsPeriod = returns.filter(function(r) { return inRange(r.date); });
  var reembolsosPeriod = 0, reembolsosEfectivo = 0, reembolsosTarjeta = 0;
  var reembolsosTransferencia = 0, reembolsosCreditoCuenta = 0;
  retsPeriod.forEach(function(r) {
    var amt = Number(r.refundAmount || 0);
    if (amt <= 0) return;
    reembolsosPeriod += amt;
    if      (r.refundMethod === 'Efectivo')          reembolsosEfectivo       += amt;
    else if (r.refundMethod === 'Tarjeta')            reembolsosTarjeta        += amt;
    else if (r.refundMethod === 'Crédito en cuenta') reembolsosCreditoCuenta  += amt;
    else                                              reembolsosTransferencia  += amt;
  });

  // Devoluciones sin reembolso (cambio o sin dinero)
  var sinReembolso = retsPeriod.filter(function(r) { return !r.refundAmount || r.refundAmount <= 0 || r.refundMethod === 'Sin reembolso'; }).length;
  // Diferencia retenida en reembolsos parciales (total artículo > reembolso)
  var diferenciaReembolsos = retsPeriod.filter(function(r) { return r.refundAmount > 0 && r.total > r.refundAmount; }).reduce(function(s, r) { return s + (r.total - r.refundAmount); }, 0);
  // Artículos defectuosos (no regresan a inventario)
  var retsDefectuosas = retsPeriod.filter(function(r) { return r.itemCondition === 'defectuoso'; });

  // Totales netos
  var totalVentas = periodSales.reduce(function(s, x) { return s + x.total; }, 0);
  // Reembolsos que salen de caja (excluye crédito en cuenta, que es saldo interno)
  var reembolsosCaja         = reembolsosPeriod - reembolsosCreditoCuenta;
  var totalEfectivo          = byMethod.Efectivo      + abonosEfectivo      - reembolsosEfectivo;
  var totalTarjeta           = byMethod.Tarjeta       + abonosTarjeta       - reembolsosTarjeta;
  var totalTransferencia     = byMethod.Transferencia + abonosTransferencia - reembolsosTransferencia;
  var totalIngresosBruto     = totalVentas + abonosPeriod;
  var totalIngresosNeto      = totalIngresosBruto - reembolsosCaja;
  var totalIngresos          = totalIngresosNeto;

  // Costo de ventas y ganancia bruta (solo si productos tienen costo configurado)
  var costoVentas = 0;
  periodSales.forEach(function(s) {
    (s.items || []).forEach(function(it) {
      var prod = products.find(function(p) { return p.id === it.id || p.code === it.code; });
      if (prod && prod.cost > 0) costoVentas += prod.cost * it.qty;
    });
  });
  // Recuperamos el costo de artículos devueltos en buen estado (regresan al inventario)
  var costoRecuperado = 0;
  retsPeriod.filter(function(r) { return r.itemCondition !== 'defectuoso'; }).forEach(function(r) {
    (r.items || []).forEach(function(it) {
      var prod = products.find(function(p) { return p.code === it.code; });
      if (prod && prod.cost > 0) costoRecuperado += prod.cost * it.qty;
    });
  });
  var gananciaBruta = totalVentas - reembolsosCaja - costoVentas + costoRecuperado;

  // Reparaciones activas y listas
  var repActivas = repairs.filter(function(r) { return r.status !== 'entregado'; }).length;
  var repListas  = repairs.filter(function(r) { return r.status === 'listo'; }).length;

  // Top 5 más vendidos por unidades
  var qtyMap = {};
  // Incluye también las ventas a crédito: esas unidades igual salieron del inventario.
  periodSales.concat(periodSalesCredito).forEach(function(s) { (s.items || []).forEach(function(it) { qtyMap[it.name] = (qtyMap[it.name] || 0) + it.qty; }); });
  var top5 = Object.keys(qtyMap).map(function(k) { return [k, qtyMap[k]]; }).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 5);

  // Top 5 más rentables por ganancia Q
  var profitMap = {};
  periodSales.forEach(function(s) {
    (s.items || []).forEach(function(it) {
      var prod   = products.find(function(p) { return p.id === it.id || p.code === it.code; });
      // Sin costo cargado no se puede medir rentabilidad real: excluir del ranking
      // (antes aparecía como 100% ganancia y distorsionaba el top).
      if (!prod || !(prod.cost > 0)) return;
      var cost   = prod.cost;
      var profit = (Number(it.price || 0) - cost) * Number(it.qty || 0);
      if (!profitMap[it.name]) profitMap[it.name] = { name: it.name, qty: 0, revenue: 0, profit: 0 };
      profitMap[it.name].qty     += Number(it.qty || 0);
      profitMap[it.name].revenue += Number(it.price || 0) * Number(it.qty || 0);
      profitMap[it.name].profit  += profit;
    });
  });
  var topProfitable = Object.values(profitMap).sort(function(a, b) { return b.profit - a.profit; }).slice(0, 5);
  var margenPct = costoVentas > 0 && totalVentas > 0 ? Math.round((gananciaBruta / totalVentas) * 100) : null;

  // ── Función de impresión / PDF ─────────────────────────────────────────
  function printCuadre() {
    var _si = getStore();
    var _sn = _si.store_name || STORE_FALLBACK;

    var allPeriodSales    = periodSales.concat(periodSalesCredito).slice().sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
    var totalTransacciones = allPeriodSales.length;
    // Pie de la tabla = suma real de las filas mostradas (totales completos de cada venta),
    // no mezclar con el credito financiado de las metricas.
    var totalVentasBrutas  = allPeriodSales.reduce(function(s2, x) { return s2 + Number(x.total || 0); }, 0);

    var salesRows = allPeriodSales.map(function(s) {
      var isCredito = s.status === 'cuenta';
      return '<tr>' +
        '<td>' + new Date(s.date).toLocaleDateString('es-GT', { day: '2-digit', month: 'short' }) + '</td>' +
        '<td>' + new Date(s.date).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' }) + '</td>' +
        '<td>' + s.client + '</td>' +
        '<td>' + (s.items || []).length + ' art.</td>' +
        '<td><span style="background:' + (isCredito ? '#FFF3E0' : '#E1F5EE') + ';color:' + (isCredito ? '#E65100' : '#085041') + ';padding:2px 8px;border-radius:12px;font-size:11px;">' + (isCredito ? 'Crédito' : s.method) + '</span></td>' +
        '<td style="text-align:right;font-weight:700;color:' + (isCredito ? '#E65100' : '#1D9E75') + ';">Q ' + Number(s.total).toFixed(2) + '</td>' +
        '</tr>';
    }).join('');

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cuadre — ' + _sn + '</title>' +
      '<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:12px;color:#222;padding:24px;max-width:900px;margin:0 auto;}' +
      '.header{border-bottom:3px solid #1D9E75;padding-bottom:14px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-start;}' +
      '.brand h1{font-size:20px;font-weight:900;color:#1a2535;}.brand p{font-size:10px;color:#1D9E75;font-weight:700;letter-spacing:2px;}' +
      '.period{text-align:right;}.period .lbl{font-size:10px;color:#999;text-transform:uppercase;}.period .val{font-size:16px;font-weight:700;color:#1D9E75;margin-top:2px;}' +
      '.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;}' +
      '.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;}' +
      '.metric{background:#f8f9fa;border-radius:8px;padding:12px;border-left:4px solid #1D9E75;}' +
      '.metric .lbl{font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;}' +
      '.metric .val{font-size:18px;font-weight:800;color:#1D9E75;}' +
      '.metric.red .val{color:#E24B4A;}.metric.gray .val{color:#444;}.metric.navy .val{color:#1a2535;}' +
      '.section{margin-bottom:20px;}' +
      '.section-title{font-size:13px;font-weight:700;color:#444;border-bottom:1px solid #eee;padding-bottom:6px;margin-bottom:12px;}' +
      'table{width:100%;border-collapse:collapse;}' +
      'thead th{background:#1a2535;color:#fff;padding:7px 10px;text-align:left;font-size:11px;font-weight:600;}' +
      'tbody tr:nth-child(even){background:#f9f9f9;}' +
      'td{padding:6px 10px;border-bottom:1px solid #eee;font-size:12px;}' +
      '.footer{border-top:2px dashed #ccc;padding-top:14px;margin-top:20px;display:flex;justify-content:space-between;font-size:11px;color:#999;}' +
      '@media print{body{padding:12px;}}' +
      '</style></head><body>' +

      '<div class="header">' +
        '<div class="brand"><h1>' + _sn + '</h1><p>CUADRE / REPORTE DE CIERRE</p></div>' +
        '<div class="period"><div class="lbl">Período</div><div class="val">' + getRangeLabel() + '</div>' +
          '<div style="font-size:11px;color:#999;margin-top:4px;">Generado por: ' + session.name + ' · ' + (ROLE_LABEL[session.role] || session.role) + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="section"><div class="section-title">📊 Resumen de ingresos</div>' +
      '<div class="grid4">' +
        '<div class="metric"><div class="lbl">Transacciones</div><div class="val">' + totalTransacciones + '</div></div>' +
        '<div class="metric"><div class="lbl">Ventas cobradas (contado)</div><div class="val">Q ' + totalVentas.toFixed(2) + '</div></div>' +
        (totalVentasCredito > 0 ? '<div class="metric" style="border-left-color:#E65100;"><div class="lbl">Crédito otorgado</div><div class="val" style="color:#E65100;">Q ' + totalVentasCredito.toFixed(2) + '</div></div>' : '') +
        '<div class="metric"><div class="lbl">Abonos cobrados</div><div class="val">Q ' + abonosPeriod.toFixed(2) + '</div></div>' +
        '<div class="metric" style="border-left-color:#2E7D32;"><div class="lbl">Ingresos netos</div><div class="val" style="color:#2E7D32;">Q ' + totalIngresosNeto.toFixed(2) + '</div></div>' +
      '</div></div>' +
      (totalVentasCredito > 0 ? '<div style="background:#FFF3E0;border-left:4px solid #E65100;border-radius:8px;padding:10px 14px;margin-bottom:20px;font-size:11px;color:#7A3700;"><b>Nota:</b> Q ' + totalVentasCredito.toFixed(2) + ' quedaron financiados al crédito (total menos abono inicial; ' + periodSalesCredito.length + ' venta' + (periodSalesCredito.length !== 1 ? 's' : '') + ') — aún pendientes de cobro.</div>' : '') +

      '<div class="section"><div class="section-title">💵 Por método de pago (neto)</div>' +
      '<div class="grid3">' +
        '<div class="metric"><div class="lbl">Efectivo neto</div><div class="val">Q ' + totalEfectivo.toFixed(2) + '</div>' +
          '<div style="font-size:10px;color:#999;margin-top:4px;">+ventas Q' + byMethod.Efectivo.toFixed(2) + ' +abonos Q' + abonosEfectivo.toFixed(2) + ' −reemb. Q' + reembolsosEfectivo.toFixed(2) + '</div></div>' +
        '<div class="metric navy"><div class="lbl">Tarjeta neto</div><div class="val">Q ' + totalTarjeta.toFixed(2) + '</div>' +
          '<div style="font-size:10px;color:#999;margin-top:4px;">+ventas Q' + byMethod.Tarjeta.toFixed(2) + ' +abonos Q' + abonosTarjeta.toFixed(2) + ' −reemb. Q' + reembolsosTarjeta.toFixed(2) + '</div></div>' +
        '<div class="metric gray"><div class="lbl">Transferencia neto</div><div class="val">Q ' + totalTransferencia.toFixed(2) + '</div>' +
          '<div style="font-size:10px;color:#999;margin-top:4px;">+ventas Q' + byMethod.Transferencia.toFixed(2) + ' +abonos Q' + abonosTransferencia.toFixed(2) + ' −reemb. Q' + reembolsosTransferencia.toFixed(2) + '</div></div>' +
      '</div></div>' +

      (costoVentas > 0 ?
        '<div class="section"><div class="section-title">📉 Costos y ganancia bruta</div>' +
        '<div class="grid4">' +
          '<div class="metric"><div class="lbl">Ventas brutas</div><div class="val">Q ' + totalVentas.toFixed(2) + '</div></div>' +
          '<div class="metric red"><div class="lbl">Costo productos</div><div class="val">Q ' + costoVentas.toFixed(2) + '</div></div>' +
          '<div class="metric red"><div class="lbl">Reembolsos salida</div><div class="val">Q ' + reembolsosCaja.toFixed(2) + '</div></div>' +
          '<div class="metric" style="border-left-color:#2E7D32;"><div class="lbl">Ganancia bruta</div><div class="val" style="color:#2E7D32;">Q ' + gananciaBruta.toFixed(2) + '</div></div>' +
        '</div></div>' : '') +

      (retsPeriod.length > 0 ?
        '<div class="section"><div class="section-title">🔄 Devoluciones del período</div>' +
        '<div class="grid4">' +
          '<div class="metric red"><div class="lbl">Total reembolsado</div><div class="val">Q ' + reembolsosPeriod.toFixed(2) + '</div></div>' +
          '<div class="metric red"><div class="lbl">Reemb. en efectivo</div><div class="val">Q ' + reembolsosEfectivo.toFixed(2) + '</div></div>' +
          (reembolsosTarjeta > 0 ? '<div class="metric red"><div class="lbl">Reemb. en tarjeta</div><div class="val">Q ' + reembolsosTarjeta.toFixed(2) + '</div></div>' : '') +
          (reembolsosCreditoCuenta > 0 ? '<div class="metric gray"><div class="lbl">Crédito en cuenta</div><div class="val">Q ' + reembolsosCreditoCuenta.toFixed(2) + '</div><div style="font-size:10px;color:#999;margin-top:3px;">Saldo a favor del cliente — no sale de caja</div></div>' : '') +
          (diferenciaReembolsos > 0 ? '<div class="metric" style="border-left-color:#F59E0B;"><div class="lbl">Reembolsos parciales (diferencia retenida)</div><div class="val" style="color:#D97706;">Q ' + diferenciaReembolsos.toFixed(2) + '</div></div>' : '') +
          (sinReembolso > 0 ? '<div class="metric gray"><div class="lbl">Sin reembolso</div><div class="val">' + sinReembolso + '</div></div>' : '') +
          '<div class="metric gray"><div class="lbl">Buen estado (reingresado)</div><div class="val">' + (retsPeriod.length - retsDefectuosas.length) + '</div></div>' +
          (retsDefectuosas.length > 0 ? '<div class="metric red"><div class="lbl">Defectuosos (baja)</div><div class="val">' + retsDefectuosas.length + '</div></div>' : '') +
        '</div></div>' : '') +

      (top5.length > 0 ?
        '<div class="section"><div class="section-title">🏆 Más vendidos del período</div>' +
        '<table><thead><tr><th>#</th><th>Producto</th><th>Unidades vendidas</th></tr></thead><tbody>' +
        top5.map(function(item, i) { return '<tr><td>' + (i + 1) + '</td><td>' + item[0] + '</td><td style="font-weight:700;color:#1D9E75;">' + item[1] + ' uds</td></tr>'; }).join('') +
        '</tbody></table></div>' : '') +

      (allPeriodSales.length > 0 ?
        '<div class="section"><div class="section-title">📋 Detalle de ventas</div>' +
        '<table><thead><tr><th>Fecha</th><th>Hora</th><th>Cliente</th><th>Artículos</th><th>Método</th><th style="text-align:right;">Total</th></tr></thead>' +
        '<tbody>' + salesRows + '</tbody>' +
        '<tfoot><tr style="background:#1a2535;color:#fff;"><td colspan="5" style="padding:8px 10px;font-weight:700;">TOTAL DEL PERÍODO</td>' +
        '<td style="padding:8px 10px;text-align:right;font-weight:800;font-size:14px;">Q ' + totalVentasBrutas.toFixed(2) + '</td></tr></tfoot>' +
        '</table></div>' :
        '<div class="section" style="text-align:center;color:#999;padding:40px;">Sin ventas en el período seleccionado</div>') +

      '<div class="footer">' +
        '<div><b>' + (_sn || APP_NAME) + '</b> · ' + APP_NAME + ' v' + APP_VERSION + '</div>' +
        '<div>Impreso: ' + now.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + now.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' }) + '</div>' +
      '</div>' +
      '</body></html>';

    var w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { showFlash('⚠️ El navegador bloqueó la ventana emergente. Permití los popups para este sitio e intentá de nuevo.', 'err'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    // Impresión desde la ventana padre (CSP-safe, sin script inline).
    setTimeout(function() { try { w.print(); } catch (e) {} }, 400);
  }

  function exportCuadreExcel() {
    var label = getRangeLabel();
    var allPeriodSales = periodSales.concat(periodSalesCredito).slice().sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
    var cols = ['Fecha', 'Hora', 'Cliente', 'Artículos', 'Método', 'Total Q', 'Estado'];
    var rows = allPeriodSales.map(function(s) {
      return [
        new Date(s.date).toLocaleDateString('es-GT'),
        new Date(s.date).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' }),
        s.client,
        (s.items || []).length,
        s.status === 'cuenta' ? 'Crédito' : s.method,
        Number(s.total).toFixed(2),
        s.status,
      ];
    });
    // Append summary rows below
    rows.push([]);
    rows.push(['RESUMEN DEL PERÍODO', label]);
    rows.push(['Ventas cobradas', totalVentas.toFixed(2)]);
    rows.push(['Crédito otorgado (total − abono inicial)', totalVentasCredito.toFixed(2)]);
    rows.push(['Abonos recibidos', abonosPeriod.toFixed(2)]);
    rows.push(['Reembolsos (caja)', reembolsosCaja.toFixed(2)]);
    rows.push(['Ingresos netos', totalIngresos.toFixed(2)]);
    rows.push(['Efectivo (neto)', totalEfectivo.toFixed(2)]);
    rows.push(['Tarjeta (neto)', totalTarjeta.toFixed(2)]);
    rows.push(['Transferencia (neto)', totalTransferencia.toFixed(2)]);
    rows.push(['Ganancia bruta estimada', gananciaBruta.toFixed(2)]);
    exportExcel(rows, cols, 'Cuadre_' + label.replace(/[\s/]/g, '_'));
    showFlash('✅ Excel exportado', 'ok');
  }

  var rangos = [
    ['hoy',      'Hoy'],
    ['semana',   'Esta semana'],
    ['quincenal','Últimos 15 días'],
    ['mes',      'Este mes'],
    ['mes_ant',  'Mes anterior'],
    ['custom',   'Personalizado'],
  ];

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════
  return (
    <div>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <p style={H1}>
          📈 Cuadres y Reportes
          <HelpTip text={'Resumen financiero del negocio por período.\n\n• Ventas brutas: total cobrado en el período\n• Ingresos netos: ventas + abonos recibidos − reembolsos\n• Ganancia bruta: ingresos − costo de productos (solo si cargaste costos al inventario)\n• Antigüedad de cuentas: cuánto tiempo llevan pendientes los créditos\n\nPodés imprimir el cuadre o exportarlo a Excel desde aquí.'} />
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={Object.assign({}, mkBtn('green'), { padding: '10px 20px' })} onClick={exportCuadreExcel}>📊 Excel</button>
          <button style={Object.assign({}, mkBtn('teal'), { padding: '10px 20px' })} onClick={printCuadre}>🖨 Imprimir / PDF</button>
        </div>
      </div>

      {/* Selector de período */}
      <div style={Object.assign({}, sCard, { marginBottom: 16 })}>
        <p style={{ fontWeight: 600, fontSize: 13, margin: '0 0 12px', color: '#555' }}>📅 Período del cuadre</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: rango === 'custom' ? 12 : 0 }}>
          {rangos.map(function(pair) {
            return (
              <button key={pair[0]} style={Object.assign({}, mkBtn(rango === pair[0] ? 'teal' : 'gray'), { padding: '7px 16px' })} onClick={function() { setRango(pair[0]); }}>
                {pair[1]}
              </button>
            );
          })}
        </div>
        {rango === 'custom' && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 10 }}>
            <div><label style={sLabel}>Desde</label><input type="date" style={Object.assign({}, sInput, { width: 160 })} value={dateFrom} onChange={function(e) { setDateFrom(e.target.value); }} /></div>
            <div><label style={sLabel}>Hasta</label><input type="date" style={Object.assign({}, sInput, { width: 160 })} value={dateTo}   onChange={function(e) { setDateTo(e.target.value); }} /></div>
          </div>
        )}
      </div>

      {/* Banner del período activo con total neto */}
      <div style={{ background: 'linear-gradient(135deg,' + NAVY + ' 0%,#1a3a2a 100%)', borderRadius: 12, padding: '14px 20px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Período activo</p>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 16, margin: '2px 0 0' }}>{getRangeLabel()}</p>
        </div>
        <p style={{ color: TEAL, fontSize: 28, fontWeight: 800, margin: 0 }}>Q {totalIngresos.toFixed(2)}</p>
      </div>

      {/* Métricas principales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 16 }}>
        <MetricBox label="Ventas totales"              value={periodSales.length + periodSalesCredito.length} color="#378ADD" />
        <MetricBox label="Ventas cobradas (contado)"  value={Q(totalVentas)}        color={TEAL} />
        <MetricBox label="Crédito otorgado"            value={Q(totalVentasCredito)}  color="#F59E0B" />
        <MetricBox label="Abonos cobrados"             value={Q(abonosPeriod)}        color="#7F77DD" />
      </div>

      {/* Desglose por método de pago */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
        <div style={sCard}>
          <p style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', margin: '0 0 8px' }}>💵 Efectivo neto</p>
          <p style={{ fontSize: 26, fontWeight: 800, color: totalEfectivo >= 0 ? TEAL : '#E24B4A', margin: 0 }}>Q {totalEfectivo.toFixed(2)}</p>
          <p style={{ fontSize: 11, color: '#999', margin: '4px 0 0' }}>Ventas Q{byMethod.Efectivo.toFixed(2)} + abonos Q{abonosEfectivo.toFixed(2)} − reemb. Q{reembolsosEfectivo.toFixed(2)}</p>
        </div>
        <div style={sCard}>
          <p style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', margin: '0 0 8px' }}>💳 Tarjeta neto</p>
          <p style={{ fontSize: 26, fontWeight: 800, color: '#378ADD', margin: 0 }}>Q {totalTarjeta.toFixed(2)}</p>
          <p style={{ fontSize: 11, color: '#999', margin: '4px 0 0' }}>Ventas Q{byMethod.Tarjeta.toFixed(2)} + abonos Q{abonosTarjeta.toFixed(2)} − reemb. Q{reembolsosTarjeta.toFixed(2)}</p>
        </div>
        <div style={sCard}>
          <p style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', margin: '0 0 8px' }}>🏦 Transferencia neto</p>
          <p style={{ fontSize: 26, fontWeight: 800, color: '#555', margin: 0 }}>Q {totalTransferencia.toFixed(2)}</p>
          <p style={{ fontSize: 11, color: '#999', margin: '4px 0 0' }}>Ventas Q{byMethod.Transferencia.toFixed(2)} + abonos Q{abonosTransferencia.toFixed(2)} − reemb. Q{reembolsosTransferencia.toFixed(2)}</p>
        </div>

        {/* Ganancia bruta (si hay costos) o reparaciones activas (si no) */}
        {costoVentas > 0 ? (
          <div style={sCard}>
            <p style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', margin: '0 0 10px' }}>📉 Ganancia bruta estimada</p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div><p style={{ fontSize: 11, color: '#999', margin: '0 0 2px' }}>Ventas</p><p style={{ fontWeight: 700, color: TEAL }}>Q {totalVentas.toFixed(2)}</p></div>
              <span style={{ color: '#E24B4A', fontSize: 18 }}>−</span>
              <div><p style={{ fontSize: 11, color: '#999', margin: '0 0 2px' }}>Costo</p><p style={{ fontWeight: 700, color: '#E24B4A' }}>Q {costoVentas.toFixed(2)}</p></div>
              <span style={{ color: '#E24B4A', fontSize: 18 }}>−</span>
              <div><p style={{ fontSize: 11, color: '#999', margin: '0 0 2px' }}>Reembolsos</p><p style={{ fontWeight: 700, color: '#E24B4A' }}>Q {reembolsosCaja.toFixed(2)}</p></div>
              <span style={{ color: '#2E7D32', fontSize: 18 }}>=</span>
              <div><p style={{ fontSize: 11, color: '#999', margin: '0 0 2px' }}>Ganancia</p><p style={{ fontWeight: 800, fontSize: 18, color: '#2E7D32' }}>Q {gananciaBruta.toFixed(2)}</p></div>
            </div>
          </div>
        ) : (
          <div style={sCard}>
            <p style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', margin: '0 0 8px' }}>🔧 Reparaciones activas</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: '#378ADD', margin: 0 }}>{repActivas}</p>
            <p style={{ fontSize: 11, color: repListas > 0 ? TEAL : '#999', margin: '4px 0 0' }}>
              {repListas > 0 ? '✅ ' + repListas + ' listas para entregar' : 'Sin órdenes listas aún'}
            </p>
          </div>
        )}

        {/* Resumen de devoluciones del período */}
        {retsPeriod.length > 0 && (
          <div style={sCard}>
            <p style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', margin: '0 0 10px' }}>🔄 Resumen devoluciones</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#666' }}>Total devuelto</span><span style={{ fontWeight: 700, color: '#E24B4A' }}>Q {reembolsosPeriod.toFixed(2)}</span></div>
              {reembolsosCreditoCuenta > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#666' }}>Crédito en cuenta (no sale de caja)</span><span style={{ fontWeight: 700, color: '#F59E0B' }}>Q {reembolsosCreditoCuenta.toFixed(2)}</span></div>}
              {diferenciaReembolsos > 0  && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#666' }}>Reembolsos parciales — diferencia retenida</span><span style={{ fontWeight: 700, color: '#2E7D32' }}>Q {diferenciaReembolsos.toFixed(2)}</span></div>}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#666' }}>Artículos buen estado (reingresados)</span><span style={{ fontWeight: 700 }}>{retsPeriod.length - retsDefectuosas.length}</span></div>
              {retsDefectuosas.length > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#666' }}>Artículos defectuosos (baja)</span><span style={{ fontWeight: 700, color: '#E24B4A' }}>{retsDefectuosas.length}</span></div>}
              {sinReembolso > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#666' }}>Sin reembolso</span><span style={{ fontWeight: 700, color: '#999' }}>{sinReembolso}</span></div>}
            </div>
          </div>
        )}
      </div>

      {/* Banner de margen bruto (solo si hay costos configurados) */}
      {margenPct !== null && (
        <div style={{ background: 'linear-gradient(135deg,#0d6e4a 0%,#1D9E75 100%)', borderRadius: 12, padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>Margen bruto del período</p>
            <p style={{ color: '#fff', fontSize: 13, margin: '4px 0 0' }}>Ventas <b>Q{totalVentas.toFixed(2)}</b> − Costo <b>Q{costoVentas.toFixed(2)}</b> − Reembolsos <b>Q{reembolsosCaja.toFixed(2)}</b></p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: '#fff', fontWeight: 800, fontSize: 32, margin: 0, lineHeight: 1 }}>{margenPct}%</p>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, margin: '2px 0 0' }}>Ganancia Q{gananciaBruta.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Top más vendidos y más rentables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={sCard}>
          <p style={{ fontWeight: 700, fontSize: 14, margin: '0 0 12px', color: NAVY }}>🏆 Más vendidos <span style={{ fontWeight: 400, color: '#999', fontSize: 12 }}>(unidades)</span></p>
          {top5.length === 0
            ? <p style={{ color: '#999', fontSize: 13 }}>Sin ventas en el período</p>
            : top5.map(function(item, i) {
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: 13 }}>
                    <span style={{ color: '#666' }}><b style={{ color: TEAL, marginRight: 6 }}>{i + 1}.</b>{item[0]}</span>
                    <span style={{ fontWeight: 700, color: TEAL, background: '#f0fdf8', padding: '2px 8px', borderRadius: 6 }}>{item[1]} uds</span>
                  </div>
                );
              })
          }
        </div>
        <div style={sCard}>
          <p style={{ fontWeight: 700, fontSize: 14, margin: '0 0 12px', color: NAVY }}>💰 Más rentables <span style={{ fontWeight: 400, color: '#999', fontSize: 12 }}>(ganancia Q)</span></p>
          {topProfitable.length === 0
            ? <p style={{ color: '#999', fontSize: 13 }}>Sin datos de costo configurados</p>
            : topProfitable.map(function(item, i) {
                var mg = item.revenue > 0 ? Math.round((item.profit / item.revenue) * 100) : 0;
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: 13 }}>
                    <span style={{ color: '#666', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><b style={{ color: '#27AE60', marginRight: 6 }}>{i + 1}.</b>{item.name}</span>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                      <span style={{ fontWeight: 700, color: '#27AE60' }}>Q{item.profit.toFixed(2)}</span>
                      <span style={{ fontSize: 11, color: '#999', marginLeft: 6 }}>{mg}%</span>
                    </div>
                  </div>
                );
              })
          }
          {topProfitable.length === 0 && costoVentas === 0 && <p style={{ fontSize: 11, color: '#aaa', marginTop: 8 }}>Configurá el costo de los productos para ver este reporte.</p>}
        </div>
      </div>

      {/* Resumen de IVA del período (débito vs crédito) */}
      {ivaPctCuadre > 0 && (
        <div style={Object.assign({}, sCard, { marginBottom: 16 })}>
          <p style={{ fontWeight: 600, fontSize: 14, margin: '0 0 12px' }}>🧾 Resumen de IVA del período <span style={{ fontWeight: 400, color: '#999', fontSize: 12 }}>({ivaPctCuadre}%)</span></p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
            <MetricBox label="IVA débito (ventas)" value={Q(ivaDebito)} color="#378ADD" />
            <MetricBox label={'IVA crédito (compras c/factura: ' + comprasFactura.length + ')'} value={Q(ivaCredito)} color="#2E7D32" />
            <MetricBox label={ivaNeto >= 0 ? 'IVA a pagar' : 'Saldo a favor'} value={Q(Math.abs(ivaNeto))} color={ivaNeto >= 0 ? '#E65100' : '#2E7D32'} />
          </div>
          <p style={{ fontSize: 11, color: '#999', marginTop: 10 }}>Débito = IVA de las ventas del período (contado + crédito). Crédito = IVA de las compras con factura. Estimación de control interno; no sustituye la declaración formal ante la SAT.</p>
        </div>
      )}

      {/* Detalle de ventas del período */}
      <div style={sCard}>
        <p style={{ fontWeight: 600, fontSize: 14, margin: '0 0 12px' }}>📋 Ventas cobradas (contado) <span style={{ fontWeight: 400, color: '#999', fontSize: 12 }}>({periodSales.length}{periodSalesCredito.length > 0 ? ' · +' + periodSalesCredito.length + ' a crédito en el PDF/Excel' : ''})</span></p>
        {periodSales.length === 0
          ? <p style={{ color: '#999', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Sin ventas en el período seleccionado</p>
          : (
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Fecha', 'Hora', 'Cliente', 'Método', 'Total'].map(function(h) { return <th key={h} style={sTH}>{h}</th>; })}</tr></thead>
                <tbody>
                  {periodSales.slice().sort(function(a, b) { return new Date(b.date) - new Date(a.date); }).map(function(s) {
                    return (
                      <tr key={s.id}>
                        <td style={sTD}>{fmtD(s.date)}</td>
                        <td style={sTD}>{fmtT(s.date)}</td>
                        <td style={Object.assign({}, sTD, { fontWeight: 500 })}>{s.client}</td>
                        <td style={sTD}><span style={mkBadge('teal')}>{s.method}</span></td>
                        <td style={Object.assign({}, sTD, { fontWeight: 700, color: TEAL })}>{Q(s.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ borderTop: '2px solid rgba(0,0,0,0.1)', marginTop: 8, paddingTop: 8, textAlign: 'right', fontSize: 14, fontWeight: 700, color: TEAL }}>
                Total: {Q(totalVentas)}
              </div>
            </div>
          )
        }
      </div>
    </div>
  );
}
