// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA: DashboardScreen (Panel de Control)
//
// Vista general del negocio en tiempo real. Muestra:
//
//   Alertas (rojo):
//     - Reparaciones vencidas (fecha prometida ya pasó)
//     - Productos sin stock
//     - Cuentas con más de 30 días sin pago
//     - Garantías por vencer en los próximos 7 días
//
//   KPIs del día:
//     - Ventas de hoy (cantidad de transacciones)
//     - Vendido hoy (valor total, incluye crédito)
//     - Saldo de caja (efectivo cobrado − reembolsos en efectivo)
//     - Por cobrar (total de cuentas pendientes)
//
//   Tarjetas de estado:
//     - Reparaciones activas / listas para entregar
//     - Productos con stock bajo el mínimo
//     - Cuentas pendientes de cobro
//
//   Gráficas (Recharts):
//     - Ingresos diarios (AreaChart) — 7, 14 o 30 días
//     - Métodos de pago (PieChart)
//     - Productos más vendidos — top 5 (BarChart horizontal)
//     - Tendencia mensual — últimos 6 meses (BarChart)
//
//   Listas rápidas:
//     - Pendientes de cobro (top 5 cuentas)
//     - Últimas ventas de hoy (top 5)
//
// Props:
//   sales          {Array}    — todas las ventas
//   todaySales     {Array}    — ventas del día de hoy
//   accounts       {Array}    — todas las cuentas por cobrar
//   pendingAccs    {Array}    — cuentas con saldo pendiente
//   totalPend      {number}   — suma de saldos pendientes
//   products       {Array}    — todos los productos
//   top5           {Array[]}  — [[nombre, unidades],...] — top 5 más vendidos
//   returns        {Array}    — devoluciones del sistema
//   repairs        {Array}    — reparaciones del sistema
//   warranties     {Array}    — garantías del sistema
//   setSelectedSale {Function} — (venta) — abre el detalle de una venta
//   setView        {Function} — (pantalla) — navega a otra pantalla
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis,
  CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TEAL, NAVY, sCard, mkBtn, mkBadge } from '../styles/theme.js';
import { Q, fmtD, fmtT } from '../utils/formatters.js';
import HelpTip from '../components/ui/HelpTip.jsx';
import RemindersWidget from '../components/ui/RemindersWidget.jsx';

// Nombres cortos de días y meses en español
var DIAS   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
var MESES  = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Colores por método de pago
var METODO_COLORES = {
  Efectivo:      '#1D9E75',
  Tarjeta:       '#378ADD',
  Transferencia: '#7C4DFF',
  Mixto:         '#E65100',
  Crédito:       '#F59E0B',
};

// Colores para el gráfico de barras horizontal (top productos)
var BARRA_COLORES = [TEAL, '#378ADD', '#7C4DFF', '#E65100', '#F59E0B'];

var H1 = { fontSize: 'clamp(17px,4vw,22px)', fontWeight: 600, margin: '0 0 16px', color: 'var(--text-primary,#1a1a1a)' };

// ── Hook: número que "cuenta" hacia su valor (solo visual, no toca datos) ───
function useCountUp(target, ms) {
  var _s = useState(target);
  var shown = _s[0]; var setShown = _s[1];
  var prevRef = useRef(0);
  useEffect(function() {
    var from = prevRef.current;
    var to = Number(target) || 0;
    prevRef.current = to;
    if (from === to) { setShown(to); return; }
    var t0 = null; var raf;
    function tick(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / (ms || 900));
      var ease = 1 - Math.pow(1 - p, 3); // ease-out
      setShown(from + (to - from) * ease);
      if (p < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return function() { cancelAnimationFrame(raf); };
  }, [target, ms]);
  return shown;
}

// ── Componente de métrica simple (con contador animado opcional) ────────────
function MetricBox({ label, value, color, num, fmt }) {
  // Si viene `num`, el valor mostrado "cuenta" hacia el número (fmt lo formatea).
  var animated = useCountUp(num !== undefined ? num : 0, 900);
  var display = num !== undefined ? (fmt ? fmt(animated) : Math.round(animated)) : value;
  return (
    <div style={{ background: '#f5f4f0', borderRadius: 10, padding: 16, border: '1px solid rgba(0,0,0,0.07)' }}>
      <p style={{ fontSize: 12, color: '#666', margin: '0 0 6px' }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 600, margin: 0, color: color || '#1a1a1a' }}>{display}</p>
    </div>
  );
}

// ── Skeleton: placeholder animado mientras cargan los datos (solo visual) ───
function SkelBox() {
  return (
    <div style={{ background: '#f5f4f0', borderRadius: 10, padding: 16, border: '1px solid rgba(0,0,0,0.07)' }}>
      <div className="skel-pulse" style={{ height: 12, width: '55%', borderRadius: 6, marginBottom: 10 }} />
      <div className="skel-pulse" style={{ height: 22, width: '75%', borderRadius: 6 }} />
    </div>
  );
}

// ── Tooltip personalizado para gráfica de ingresos ─────────────────────────
function TooltipIngresos(p) {
  if (!p.active || !p.payload || !p.payload.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
      <p style={{ margin: '0 0 4px', fontWeight: 700, color: NAVY }}>{p.label}</p>
      <p style={{ margin: 0, color: TEAL }}>Q {Number(p.payload[0].value).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</p>
      {p.payload[1] && (
        <p style={{ margin: 0, color: '#666' }}>{p.payload[1].value} venta{p.payload[1].value !== 1 ? 's' : ''}</p>
      )}
    </div>
  );
}

// ── Tooltip personalizado para PieChart de métodos ─────────────────────────
function TooltipPie(p) {
  if (!p.active || !p.payload || !p.payload.length) return null;
  var d = p.payload[0];
  return (
    <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
      <p style={{ margin: '0 0 4px', fontWeight: 700, color: d.payload.color }}>{d.name}</p>
      <p style={{ margin: 0 }}>Q {Number(d.value).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</p>
    </div>
  );
}

// ── Pantalla principal ──────────────────────────────────────────────────────
export default function DashboardScreen({
  sales, todaySales, accounts, pendingAccs, totalPend,
  products, top5, returns: devos, repairs, warranties,
  setSelectedSale, setView, navTo, loaded,
}) {
  navTo = navTo || function(s) { setView(s); };
  if (loaded === undefined) loaded = true; // retrocompatible: sin prop, se comporta como antes
  sales       = sales       || [];
  todaySales  = todaySales  || [];
  accounts    = accounts    || [];
  pendingAccs = pendingAccs || [];
  totalPend   = totalPend   || 0;
  products    = products    || [];
  top5        = top5        || [];
  devos       = devos       || [];
  repairs     = repairs     || [];
  warranties  = warranties  || [];
  setSelectedSale = setSelectedSale || function() {};
  setView         = setView         || function() {};

  // Rango de la gráfica de ingresos diarios: "7d", "14d" o "30d"
  var _r = useState('7d');
  var chartRange    = _r[0];
  var setChartRange = _r[1];

  var ahora      = new Date();
  var hoyStr     = ahora.toDateString();

  // Ventas completadas (cobradas) vs. en crédito
  var ventasCobradas  = todaySales.filter(function(s) { return s.status === 'completado'; });
  var totalVendido    = todaySales.reduce(function(s, x) { return s + x.total; }, 0);
  var totalCobrado    = ventasCobradas.reduce(function(s, x) { return s + x.total; }, 0);

  // Saldo de caja = efectivo cobrado hoy − reembolsos en efectivo de hoy
  var cajaDia     = ventasCobradas.filter(function(s) { return s.method === 'Efectivo'; }).reduce(function(s, x) { return s + x.total; }, 0);
  var reembolsos  = devos.filter(function(r) { return new Date(r.date).toDateString() === hoyStr && r.refundMethod === 'Efectivo' && r.refundAmount > 0; }).reduce(function(s, r) { return s + r.refundAmount; }, 0);
  var saldoCaja   = cajaDia - reembolsos;

  // ── Datos para gráfica de ingresos diarios ─────────────────────────────────
  var diasChart  = chartRange === '30d' ? 30 : chartRange === '14d' ? 14 : 7;
  var datosChart = Array.from({ length: diasChart }, function(_, i) {
    var d = new Date();
    d.setDate(d.getDate() - (diasChart - 1 - i));
    d.setHours(0, 0, 0, 0);
    var dStr     = d.toDateString();
    var ventasDia = sales.filter(function(s) { return new Date(s.date).toDateString() === dStr && s.status !== 'anulado'; });
    var ingresos  = ventasDia.reduce(function(a, s) { return a + s.total; }, 0);
    var etiqueta  = diasChart === 7 ? DIAS[d.getDay()] : (d.getDate() + '/' + (d.getMonth() + 1));
    return { label: etiqueta, ingresos: Math.round(ingresos * 100) / 100, ventas: ventasDia.length, isToday: dStr === hoyStr };
  });

  // ── Datos para gráfica de tendencia mensual (últimos 6 meses) ─────────────
  var ultimos6Meses = Array.from({ length: 6 }, function(_, i) {
    var d      = new Date(ahora.getFullYear(), ahora.getMonth() - 5 + i, 1);
    var inicio = new Date(d.getFullYear(), d.getMonth(), 1);
    var fin    = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    var rev    = sales.filter(function(s) {
      var sd = new Date(s.date);
      return sd >= inicio && sd <= fin && s.status !== 'anulado';
    }).reduce(function(a, s) { return a + s.total; }, 0);
    return { label: MESES[d.getMonth()], ingresos: Math.round(rev * 100) / 100 };
  });

  // ── Datos PieChart (métodos de pago, sin anuladas) ─────────────────────────
  var metodosMap = {};
  sales.forEach(function(s) {
    if (s.status === 'anulado') return;
    var clave = s.status === 'cuenta' ? 'Crédito' : (s.method || 'Efectivo');
    metodosMap[clave] = (metodosMap[clave] || 0) + s.total;
  });
  var metodosPie = Object.keys(metodosMap).map(function(m) {
    return { name: m, value: Math.round(metodosMap[m] * 100) / 100, color: METODO_COLORES[m] || '#888' };
  });

  // ── Top 5 para BarChart horizontal ────────────────────────────────────────
  var top5Bar = top5.slice(0, 5).map(function(item) {
    return { name: item[0].length > 16 ? item[0].slice(0, 14) + '…' : item[0], unidades: item[1] };
  });

  // ── Estado de reparaciones ─────────────────────────────────────────────────
  var repsActivas  = repairs.filter(function(r) { return r.status !== 'entregado'; });
  var repsListas   = repairs.filter(function(r) { return r.status === 'listo'; });
  var repsVencidas = repairs.filter(function(r) {
    return r.status !== 'entregado' && r.promisedDate && new Date(r.promisedDate + 'T23:59:59') < ahora;
  });

  // ── Stock bajo mínimo / sin stock ─────────────────────────────────────────
  var stockAlertas = products.filter(function(p) { return p.unit !== 'serv' && p.minStock > 0 && p.stock <= p.minStock; });
  var stockCero    = products.filter(function(p) { return p.unit !== 'serv' && p.stock === 0; });

  // ── Cuentas vencidas (>30 días sin pago) ──────────────────────────────────
  var cuentasVencidas = pendingAccs.filter(function(a) { return (ahora - new Date(a.date)) > 30 * 86400000; });

  // ── Garantías por vencer en ≤7 días ───────────────────────────────────────
  var garantiasPorVencer = warranties.filter(function(w) {
    if (w.status === 'reclamada') return false;
    var diff = (new Date(w.endDate) - ahora) / 86400000;
    return diff <= 7;
  });

  var hayAlertas = repsVencidas.length > 0 || stockCero.length > 0 || cuentasVencidas.length > 0 || garantiasPorVencer.length > 0;

  // ── Recordatorio de respaldo ───────────────────────────────────────────────
  var ultimoBackupTs = null;
  try { ultimoBackupTs = localStorage.getItem('mnpos-last-backup'); } catch (e) {}
  var diasSinBackup    = ultimoBackupTs ? Math.floor((new Date() - new Date(ultimoBackupTs)) / 86400000) : null;
  var alertaBackup     = diasSinBackup === null || diasSinBackup >= 7;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <p style={H1}>
        📊 Panel de Control
        <HelpTip text={'Vista general del negocio en tiempo real.\n\n• Ventas hoy: cantidad de transacciones del día (efectivo + crédito)\n• Vendido hoy: valor total de lo vendido hoy (incluye crédito)\n• Saldo de caja: efectivo cobrado hoy menos reembolsos en efectivo\n• Por cobrar: total de créditos pendientes de pago\n\nLas alertas rojas indican reparaciones vencidas, productos sin stock o cuentas con más de 30 días sin pagar.'} />
      </p>

      {/* Alertas críticas */}
      {hayAlertas && (
        <div style={{ background: '#FCEBEB', border: '1px solid #F09595', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
          <p style={{ fontWeight: 700, fontSize: 13, color: '#791F1F', margin: '0 0 8px' }}>⚠ Atención requerida</p>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {repsVencidas.length > 0 && (
              <span style={{ fontSize: 13, color: '#791F1F', cursor: 'pointer' }} onClick={function() { navTo('repairs', { filter: 'activas' }); }}>
                🔧 {repsVencidas.length} reparación{repsVencidas.length > 1 ? 'es' : ''} vencida{repsVencidas.length > 1 ? 's' : ''} →
              </span>
            )}
            {stockCero.length > 0 && (
              <span style={{ fontSize: 13, color: '#791F1F', cursor: 'pointer' }} onClick={function() { navTo('products', { search: 'sin stock' }); }}>
                📦 {stockCero.length} producto{stockCero.length > 1 ? 's' : ''} sin stock →
              </span>
            )}
            {cuentasVencidas.length > 0 && (
              <span style={{ fontSize: 13, color: '#791F1F', cursor: 'pointer' }} onClick={function() { navTo('accounts', { filter: 'aging-2' }); }}>
                💳 {cuentasVencidas.length} cuenta{cuentasVencidas.length > 1 ? 's' : ''} +30 días →
              </span>
            )}
            {garantiasPorVencer.length > 0 && (
              <span style={{ fontSize: 13, color: '#791F1F', cursor: 'pointer' }} onClick={function() { navTo('warranties', { search: '' }); }}>
                🛡️ {garantiasPorVencer.length} garantía{garantiasPorVencer.length > 1 ? 's' : ''} por vencer →
              </span>
            )}
          </div>
        </div>
      )}

      {/* Recordatorio de respaldo semanal */}
      {alertaBackup && (
        <div style={{ background: '#FFF8E6', border: '1px solid #F5C842', borderRadius: 10, padding: '10px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#7A5000' }}>
            💾 {ultimoBackupTs ? 'Hace ' + diasSinBackup + ' días sin respaldo — ' : 'Sin respaldo registrado — '}
            se recomienda respaldar semanalmente.
          </span>
          <span
            style={{ fontSize: 12, color: '#7A5000', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
            onClick={function() { setView('backup'); }}
          >Ir a Respaldo →</span>
        </div>
      )}

      {/* Animación de los skeletons (placeholders de carga) */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes skel-shine { 0% { opacity: 0.45; } 50% { opacity: 1; } 100% { opacity: 0.45; } }
        .skel-pulse { background: #e2e0da; animation: skel-shine 1.3s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .skel-pulse { animation: none; } }
      ` }} />

      {/* KPIs principales — contadores animados; skeletons mientras carga */}
      {!loaded ? (
        <div className="rg-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 16 }}>
          <SkelBox /><SkelBox /><SkelBox /><SkelBox />
        </div>
      ) : (
        <div className="rg-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 16 }}>
          <MetricBox label="Ventas hoy"     num={todaySales.length}                       color={TEAL} />
          <MetricBox label="Vendido hoy"    num={totalVendido} fmt={Q}                    color="#378ADD" />
          <MetricBox label="Saldo caja hoy" num={saldoCaja}    fmt={Q}                    color={saldoCaja >= 0 ? TEAL : '#E24B4A'} />
          <MetricBox label="Por cobrar"     num={totalPend}    fmt={Q}                    color="#E24B4A" />
        </div>
      )}

      {/* Tarjetas de estado rápido */}
      <div className="rg-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 16 }}>
        {/* Reparaciones */}
        <div onClick={function() { setView('repairs'); }} style={Object.assign({}, sCard, { cursor: 'pointer', borderLeft: '4px solid #378ADD' })}>
          <p style={{ fontSize: 12, color: '#666', margin: '0 0 6px' }}>🔧 Reparaciones activas</p>
          <p style={{ fontSize: 26, fontWeight: 700, margin: 0, color: '#378ADD' }}>{repsActivas.length}</p>
          {repsListas.length > 0 && (
            <p style={{ fontSize: 11, color: TEAL, margin: '4px 0 0' }}>✅ {repsListas.length} listas para entregar</p>
          )}
        </div>
        {/* Stock bajo */}
        <div onClick={function() { setView('products'); }} style={Object.assign({}, sCard, { cursor: 'pointer', borderLeft: '4px solid ' + (stockAlertas.length > 0 ? '#E65100' : '#ccc') })}>
          <p style={{ fontSize: 12, color: '#666', margin: '0 0 6px' }}>📦 Stock bajo mínimo</p>
          <p style={{ fontSize: 26, fontWeight: 700, margin: 0, color: stockAlertas.length > 0 ? '#E65100' : '#999' }}>{stockAlertas.length}</p>
          {stockAlertas.length > 0 && (
            <p style={{ fontSize: 11, color: '#E65100', margin: '4px 0 0' }}>
              {stockAlertas.slice(0, 2).map(function(p) { return p.name; }).join(', ')}
              {stockAlertas.length > 2 ? '…' : ''}
            </p>
          )}
        </div>
        {/* Cuentas pendientes */}
        <div onClick={function() { setView('accounts'); }} style={Object.assign({}, sCard, { cursor: 'pointer', borderLeft: '4px solid ' + (pendingAccs.length > 0 ? '#E24B4A' : '#ccc') })}>
          <p style={{ fontSize: 12, color: '#666', margin: '0 0 6px' }}>💳 Cuentas pendientes</p>
          <p style={{ fontSize: 26, fontWeight: 700, margin: 0, color: pendingAccs.length > 0 ? '#E24B4A' : '#999' }}>{pendingAccs.length}</p>
          {cuentasVencidas.length > 0 && (
            <p style={{ fontSize: 11, color: '#E24B4A', margin: '4px 0 0' }}>{cuentasVencidas.length} con +30 días</p>
          )}
        </div>
      </div>

      {/* Gráfica principal: ingresos diarios */}
      <div style={Object.assign({}, sCard, { marginBottom: 16 })}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <p style={{ fontWeight: 600, fontSize: 15, margin: 0 }}>📈 Ingresos diarios</p>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['7d', '7 días'], ['14d', '14 días'], ['30d', '30 días']].map(function(r) {
              return (
                <button key={r[0]} style={Object.assign({}, mkBtn(chartRange === r[0] ? 'teal' : 'gray'), { padding: '4px 12px', fontSize: 12 })} onClick={function() { setChartRange(r[0]); }}>
                  {r[1]}
                </button>
              );
            })}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={datosChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={TEAL} stopOpacity={0.25} />
                <stop offset="95%" stopColor={TEAL} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} tickFormatter={function(v) { return 'Q' + v; }} width={55} />
            <Tooltip content={TooltipIngresos} />
            <Area
              type="monotone" dataKey="ingresos" stroke={TEAL} strokeWidth={2.5} fill="url(#gradIngresos)"
              dot={function(p) {
                return p.payload.isToday
                  ? <circle key={p.key} cx={p.cx} cy={p.cy} r={5} fill={TEAL} stroke="#fff" strokeWidth={2} />
                  : <circle key={p.key} cx={p.cx} cy={p.cy} r={3} fill={TEAL} opacity={0.6} />;
              }}
              activeDot={{ r: 6, fill: TEAL }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Métodos de pago + Top productos */}
      <div className="rg-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        {/* PieChart — métodos de pago */}
        <div style={sCard}>
          <p style={{ fontWeight: 600, fontSize: 15, margin: '0 0 12px' }}>💰 Por método de pago</p>
          {metodosPie.length === 0
            ? <p style={{ color: '#999', fontSize: 13, textAlign: 'center', padding: 32 }}>Sin ventas aún</p>
            : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={metodosPie} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                      {metodosPie.map(function(entry, i) { return <Cell key={i} fill={entry.color} />; })}
                    </Pie>
                    <Tooltip content={TooltipPie} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Leyenda con porcentajes */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', justifyContent: 'center', marginTop: 8 }}>
                  {metodosPie.map(function(m, i) {
                    var totalPie = metodosPie.reduce(function(a, x) { return a + x.value; }, 0) || 1;
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: m.color, flexShrink: 0 }} />
                        <span style={{ color: '#555' }}>{m.name}</span>
                        <span style={{ fontWeight: 700, color: m.color }}>{Math.round(m.value / totalPie * 100)}%</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )
          }
        </div>

        {/* BarChart horizontal — top 5 productos más vendidos */}
        <div style={sCard}>
          <p style={{ fontWeight: 600, fontSize: 15, margin: '0 0 12px' }}>🏆 Productos más vendidos</p>
          {top5Bar.length === 0
            ? <p style={{ color: '#999', fontSize: 13, textAlign: 'center', padding: 32 }}>Sin ventas aún</p>
            : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={top5Bar} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#555' }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip cursor={{ fill: 'rgba(29,158,117,0.05)' }} formatter={function(v) { return [v + ' uds', 'Vendidos']; }} />
                  <Bar dataKey="unidades" radius={[0, 4, 4, 0]}>
                    {top5Bar.map(function(_, i) { return <Cell key={i} fill={BARRA_COLORES[i % BARRA_COLORES.length]} />; })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>
      </div>

      {/* Tendencia mensual — últimos 6 meses */}
      <div style={Object.assign({}, sCard, { marginBottom: 16 })}>
        <p style={{ fontWeight: 600, fontSize: 15, margin: '0 0 12px' }}>📅 Tendencia mensual (6 meses)</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={ultimos6Meses} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} tickFormatter={function(v) { return 'Q' + v; }} width={55} />
            <Tooltip formatter={function(v) { return ['Q ' + Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2 }), 'Ingresos']; }} />
            <Bar dataKey="ingresos" radius={[4, 4, 0, 0]} fill={TEAL} opacity={0.85} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Listas rápidas: pendientes de cobro + ventas de hoy */}
      <div className="rg-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        {/* Cuentas pendientes */}
        <div style={sCard}>
          <p style={{ fontWeight: 600, margin: '0 0 10px', fontSize: 15 }}>💳 Pendientes de cobro</p>
          {pendingAccs.length === 0
            ? <p style={{ color: TEAL, fontSize: 14 }}>✓ Sin cuentas pendientes</p>
            : pendingAccs.slice(0, 5).map(function(a) {
              return (
                <div key={a.id} onClick={function() { setView('accounts'); }}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: 14, cursor: 'pointer' }}
                >
                  <div>
                    <span style={{ fontWeight: 500 }}>{a.client}</span>
                    <span style={{ fontSize: 11, color: '#999', marginLeft: 6 }}>{fmtD(a.date)}</span>
                  </div>
                  <span style={mkBadge(a.status === 'parcial' ? 'amber' : 'red')}>{Q(a.balance)}</span>
                </div>
              );
            })
          }
        </div>

        {/* Últimas ventas de hoy */}
        <div style={sCard}>
          <p style={{ fontWeight: 600, margin: '0 0 10px', fontSize: 15 }}>🕐 Últimas ventas de hoy</p>
          {todaySales.length === 0
            ? <p style={{ color: '#999', fontSize: 14 }}>Sin ventas hoy</p>
            : todaySales.slice(0, 5).map(function(s) {
              return (
                <div key={s.id} onClick={function() { setSelectedSale(s); setView('history'); }}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: 14, cursor: 'pointer' }}
                >
                  <div>
                    <span style={{ fontWeight: 500 }}>{s.client}</span>
                    <span style={{ fontSize: 11, color: '#999', marginLeft: 6 }}>{fmtT(s.date)}</span>
                  </div>
                  <span style={{ fontWeight: 600, color: TEAL }}>{Q(s.total)}</span>
                </div>
              );
            })
          }
        </div>
      </div>

      {/* Recordatorios del servidor: cuentas, garantías, reparaciones */}
      <RemindersWidget setView={setView} />
    </div>
  );
}
