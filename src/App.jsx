import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { db } from './utils/db.js';
import { authAPI, productsAPI, salesAPI, accountsAPI, returnsAPI, defectivesAPI, usersAPI, checkAPI, clientsAPI, repairsAPI, auditAPI, warrantiesAPI, cajaAPI, settingsAPI, suppliersAPI, adminAPI, categoriesAPI, locationsAPI, backupAPI, variantsAPI } from './utils/api.js';
// Sincroniza la config de tienda con el módulo de impresión (receipt.js usa su propio estado).
import { setStore as setReceiptStore, printVoucher as printVoucherDoc, descargarImagen as descargarBoletaImagen, buildReceiptHTML } from './utils/receipt.js';


// ── Pantallas extraídas a módulos independientes ──────────────────────────────
import LandingPage     from './screens/LandingPage.jsx';
import LoginScreen     from './screens/LoginScreen.jsx';
import UsersScreen     from './screens/UsersScreen.jsx';
import DashboardScreen from './screens/DashboardScreen.jsx';
import CajaScreen      from './screens/CajaScreen.jsx';
import POSScreen       from './screens/POSScreen.jsx';
import AccountsScreen  from './screens/AccountsScreen.jsx';
import ReturnsScreen   from './screens/ReturnsScreen.jsx';
import DefectiveScreen from './screens/DefectiveScreen.jsx';
import CatalogosScreen from './screens/CatalogosScreen.jsx';
import ProductsScreen  from './screens/ProductsScreen.jsx';
import InventoryScreen from './screens/InventoryScreen.jsx';
import HistoryScreen   from './screens/HistoryScreen.jsx';
import AyudaScreen     from './screens/AyudaScreen.jsx';
import BackupScreen    from './screens/BackupScreen.jsx';
import MigracionScreen from './screens/MigracionScreen.jsx';
import ClientsScreen   from './screens/ClientsScreen.jsx';
import WarrantiesScreen from './screens/WarrantiesScreen.jsx';
import SuppliersScreen from './screens/SuppliersScreen.jsx';
import StoreConfigScreen from './screens/StoreConfigScreen.jsx';
import SuperAdminPanel from './screens/SuperAdminPanel.jsx';
import OnboardingWizard from './screens/OnboardingWizard.jsx';
import AuditScreen     from './screens/AuditScreen.jsx';
import RepairsScreen   from './screens/RepairsScreen.jsx';
import CuadresScreen   from './screens/CuadresScreen.jsx';
import PushPermissionBanner from './components/ui/PushPermissionBanner.jsx';
import usePushNotifications from './hooks/usePushNotifications.js';
const TEAL    = "#1D9E75";
const NAVY    = "#1a2535";
const APP_NAME = "PraxisGT";
const APP_VERSION = "2.2";
const APP_TAGLINE = "Sistema de Gestión Empresarial · Guatemala";
const STORE_FALLBACK = "Mi Negocio";

// ── Módulos del sistema — fuente única de verdad para landing page y stats ──
const PLATFORM_FEATURES = [
  {ic:"🛒", title:"Punto de Venta",         desc:"Registra ventas en segundos. Efectivo, tarjeta, transferencia. Genera recibos y comprobantes al instante."},
  {ic:"💳", title:"Cuentas por Cobrar",      desc:"Controla ventas a crédito, abonos y saldos pendientes. Envía recordatorios por WhatsApp con un clic."},
  {ic:"🔧", title:"Taller de Reparaciones",  desc:"Órdenes de servicio completas con seguimiento de estado, repuestos, costos y fecha de entrega."},
  {ic:"📦", title:"Inventario Inteligente",  desc:"Stock en tiempo real. Alertas de bajo inventario. Historial de cambios de precio y movimientos."},
  {ic:"👥", title:"Clientes",                desc:"Base de datos de clientes con historial completo de compras, reparaciones y cuentas pendientes."},
  {ic:"📊", title:"Reportes y Cuadres",      desc:"Gráficas de ventas, ingresos diarios, top productos y cierre de caja con arqueo formal."},
  {ic:"🏭", title:"Proveedores y Compras",   desc:"Registra compras, actualiza stock automáticamente y lleva el historial de tus proveedores."},
  {ic:"🛡️", title:"Garantías",               desc:"Registra garantías de ventas y reparaciones. Alertas automáticas de vencimiento."},
  {ic:"💵", title:"Caja y Arqueo",           desc:"Control de caja chica, ingresos, egresos y cierre formal de caja con reporte imprimible."},
  {ic:"🔄", title:"Devoluciones",            desc:"Gestiona devoluciones de ventas con registro de motivo, estado del producto y reembolso."},
  {ic:"📋", title:"Auditoría",               desc:"Registro completo de todas las acciones del sistema por usuario, fecha y módulo."},
];
const PK   = "mnpos-prods-v5";
const SK   = "mnpos-sales-v5";
const AK   = "mnpos-accounts-v2";
const RK   = "mnpos-returns-v2";
const DFK  = "mnpos-defective-v1";
const CK   = "mnpos-clients-v1";

const gid  = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);

// Estado global de configuración de tienda (se actualiza desde App al cargar)
var _STORE = {store_name:"",store_tagline:"",store_phone:"",store_address:"",store_email:"",store_logo_url:""};
function getStore(){ return _STORE; }
function setStore(cfg){ _STORE=Object.assign({},_STORE,cfg); }

// ── WhatsApp helpers ──
function limpiarTel(tel){
  if(!tel)return "";
  var t=String(tel).replace(/\D/g,"");
  // Guatemala: 8 dígitos sin código → agregar 502
  if(t.length===8)return "502"+t;
  // Ya tiene código de país
  if(t.length>8)return t;
  return t;
}
function waBoletaVenta(sale,si){
  si=si||getStore(); var sn=si.store_name||STORE_FALLBACK; var st=si.store_tagline||APP_TAGLINE;
  var items=(sale.items||[]).map(function(i){return "  • "+i.name+" x"+i.qty+" — Q"+Number(i.price*i.qty).toFixed(2);}).join("\n");
  return "✅ *"+sn+"*\n"+st+"\n\n📋 *Boleta de compra*\n📅 "+fmtD(sale.date)+"\n👤 "+sale.client+"\n\n*Productos:*\n"+items+"\n\n💰 *Total: Q"+Number(sale.total).toFixed(2)+"*\nMétodo: "+(sale.method||"Efectivo")+"\n\n¡Gracias por su compra! 🙏";
}
// Mensaje de WhatsApp según el tipo de comprobante (venta / abono / devolución).
function waComprobante(sale,docType,opts){
  opts=opts||{};
  var si=getStore(); var sn=si.store_name||STORE_FALLBACK; var st=si.store_tagline||APP_TAGLINE;
  if(docType==="abono"){
    return "✅ *"+sn+"*\n"+st+"\n\n💵 *Comprobante de Abono*\n📅 "+fmtD(sale.date)+"\n👤 "+sale.client+"\n\nAbono recibido: Q"+Number(opts.abonoHoy||0).toFixed(2)+"\nTotal cuenta: Q"+Number(sale.total).toFixed(2)+"\nPagado acumulado: Q"+Number(opts.pagado||sale.paid||0).toFixed(2)+"\n*Saldo pendiente: Q"+Number(opts.saldo||sale.balance||0).toFixed(2)+"*\nMétodo: "+(sale.method||"Efectivo")+"\n\n¡Gracias por su pago! 🙏";
  }
  if(docType==="devolucion"){
    return "✅ *"+sn+"*\n"+st+"\n\n🔄 *Comprobante de Devolución*\n📅 "+fmtD(sale.date)+"\n👤 "+sale.client+"\n\nMonto reembolsado: Q"+Number(sale.total).toFixed(2)+"\nMétodo: "+(sale.method||"Efectivo")+"\n\n¡Gracias! 🙏";
  }
  return waBoletaVenta(sale);
}
function waRecordatorio(acc,si){
  si=si||getStore(); var sn=si.store_name||STORE_FALLBACK;
  return "Hola *"+acc.client+"*, le saludamos de *"+sn+"*.\n\nLe recordamos que tiene un saldo pendiente de *Q"+Number(acc.balance).toFixed(2)+"* de su compra del "+fmtD(acc.date||acc.created_at)+".\n\nTotal de la compra: Q"+Number(acc.total).toFixed(2)+"\nYa abonado: Q"+Number(acc.paid).toFixed(2)+"\n*Saldo pendiente: Q"+Number(acc.balance).toFixed(2)+"*\n\nPor favor comuníquese con nosotros para coordinar su pago. ¡Gracias! 🙏";
}
function abrirWA(tel, mensaje){
  var t=limpiarTel(tel);
  var url=t
    ?"https://wa.me/"+t+"?text="+encodeURIComponent(mensaje)
    :"https://wa.me/?text="+encodeURIComponent(mensaje);
  var a=document.createElement("a");
  a.href=url; a.target="_blank"; a.rel="noopener noreferrer";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
function pedirTelYEnviar(nombre, getMensaje, opts){
  var tel=window.prompt("📱 Número de WhatsApp de "+nombre+"\n(8 dígitos Guatemala, ej: 55551234)\nDejar vacío para abrir sin número:");
  if(tel===null)return;
  compartirWhatsApp(tel.trim(), getMensaje, opts);
}

// buildReceiptHTML se importa desde ./utils/receipt.js (builder unificado E3).

async function compartirWhatsApp(tel, getMensaje, opts){
  opts=opts||{};
  var sale=opts.sale;
  var mensaje=getMensaje();
  if(sale){
    try{
      // Renderizar recibo en un div oculto (html2canvas no puede capturar iframes)
      var wrapper=document.createElement("div");
      wrapper.style.cssText="position:fixed;left:-9999px;top:0;background:#fff;z-index:-1;width:650px;";
      wrapper.innerHTML=buildReceiptHTML(sale, opts.receiptOpts||{});
      document.body.appendChild(wrapper);
      await new Promise(function(r){setTimeout(r,400);});
      var canvas=await html2canvas(wrapper.firstChild,{scale:2,useCORS:true,backgroundColor:"#ffffff",logging:false});
      document.body.removeChild(wrapper);
      var blob=await new Promise(function(r){canvas.toBlob(r,"image/png",0.95);});
      var _shareName=(getStore().store_name||APP_NAME).replace(/\s+/g,"-").toLowerCase();
      var file=new File([blob],"boleta-"+_shareName+".png",{type:"image/png"});
      // Web Share API (móvil — adjunta imagen)
      if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
        await navigator.share({files:[file],title:"Boleta "+(getStore().store_name||APP_NAME),text:mensaje});
        return;
      }
      // Fallback escritorio: descargar imagen y avisar al usuario
      var imgUrl=URL.createObjectURL(blob);
      var dl=document.createElement("a");
      dl.href=imgUrl; dl.download="boleta-"+_shareName+".png";
      document.body.appendChild(dl); dl.click(); document.body.removeChild(dl);
      setTimeout(function(){URL.revokeObjectURL(imgUrl);},5000);
      abrirWA(tel, mensaje);
      setTimeout(function(){
        alert("📎 La imagen de la boleta se descargó.\nAdjúntala manualmente en WhatsApp al abrir el chat.");
      },800);
      return;
    }catch(err){
      console.warn("[WA] Error generando imagen:",err);
    }
  }
  abrirWA(tel, mensaje);
}
const Q    = function(n){ return "Q " + Number(n).toFixed(2); };
const fmtD = function(d){ return new Date(d).toLocaleDateString("es-GT",{day:"2-digit",month:"short",year:"numeric"}); };
const fmtT = function(d){ return new Date(d).toLocaleTimeString("es-GT",{hour:"2-digit",minute:"2-digit"}); };

function genCliCode(clients){
  if(!clients||!clients.length) return "CLI-000001";
  var nums=clients.map(function(c){ var m=(c.cliCode||"").match(/CLI-(\d+)/); return m?parseInt(m[1]):0; });
  var max=Math.max.apply(null,nums);
  return "CLI-"+String(max+1).padStart(6,"0");
}

function validarDPI(dpi){
  if(!dpi||!dpi.trim()) return true; // opcional
  return /^\d{13}$/.test(dpi.trim());
}

// db importado desde src/utils/db.js

var DEMO = [
  {id:"p01",code:"A001",name:"Pantalla iPhone 11",    category:"Pantallas",  price:450,cost:280,stock:8,  shelf:"A-01",unit:"uni"},
  {id:"p02",code:"A002",name:"Pantalla Samsung A32",  category:"Pantallas",  price:320,cost:190,stock:5,  shelf:"A-02",unit:"uni"},
  {id:"p03",code:"B001",name:"Batería iPhone 11",     category:"Baterías",   price:180,cost:90, stock:12, shelf:"B-01",unit:"uni"},
  {id:"p04",code:"B002",name:"Batería Samsung A32",   category:"Baterías",   price:150,cost:75, stock:10, shelf:"B-02",unit:"uni"},
  {id:"p05",code:"C001",name:"Conector Type-C",       category:"Conectores", price:80, cost:35, stock:20, shelf:"C-01",unit:"uni"},
  {id:"p06",code:"C002",name:"Conector Lightning",    category:"Conectores", price:90, cost:40, stock:15, shelf:"C-02",unit:"uni"},
  {id:"p07",code:"D001",name:"Mano de obra básica",   category:"Servicios",  price:75, cost:0,  stock:999,shelf:"D-01",unit:"serv"},
  {id:"p08",code:"D002",name:"Mano de obra avanzada", category:"Servicios",  price:150,cost:0,  stock:999,shelf:"D-02",unit:"serv"},
  {id:"p09",code:"E001",name:"Vidrio templado",       category:"Accesorios", price:45, cost:15, stock:30, shelf:"E-01",unit:"uni"},
  {id:"p10",code:"E002",name:"Funda silicona",        category:"Accesorios", price:35, cost:12, stock:25, shelf:"E-02",unit:"uni"},
];

var sC  = {background:"var(--bg-card,#fff)",borderRadius:14,border:"1px solid var(--border-card,rgba(0,0,0,0.07))",padding:"20px 24px",boxShadow:"var(--shadow-md,0 2px 12px rgba(0,0,0,0.06))"};
var sI  = {width:"100%",padding:"9px 12px",borderRadius:9,border:"1px solid var(--border-input,rgba(0,0,0,0.18))",fontSize:14,background:"var(--bg-input,#fff)",color:"var(--text-primary,#1a1a1a)",boxSizing:"border-box",transition:"border-color 0.18s,box-shadow 0.18s"};
var sL  = {fontSize:12,fontWeight:500,color:"var(--text-secondary,#6b7280)",marginBottom:5,display:"block",letterSpacing:"0.02em"};
var sTH = {textAlign:"left",padding:"9px 12px",color:"var(--text-secondary,#6b7280)",fontSize:11,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",borderBottom:"1px solid var(--border-table,rgba(0,0,0,0.07))",background:"var(--bg-table-head,#f8f9fa)",whiteSpace:"nowrap"};
var sTD = {padding:"11px 12px",borderBottom:"1px solid var(--border-row,rgba(0,0,0,0.04))",color:"var(--text-primary,#111827)",fontSize:13.5};
var sQB = {cursor:"pointer",background:"#f0efeb",width:26,height:26,borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,userSelect:"none",flexShrink:0,border:"1px solid rgba(0,0,0,0.1)"};
var H1  = {fontSize:"clamp(17px,4vw,22px)",fontWeight:600,margin:"0 0 16px",color:"var(--text-primary,#1a1a1a)"};

function mB(c) {
  var colors = {teal:TEAL,red:"#E24B4A",blue:"#378ADD",purple:"#7F77DD",gray:"#eeede9",green:"#2E7D32",amber:"#E65100"};
  var bg = colors[c] || "#eeede9";
  return {padding:"8px 14px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:500,background:bg,color:(c==="gray")?"#1a1a1a":"#fff"};
}
function mBg(c) {
  var m = {teal:["#E1F5EE","#085041"],green:["#EAF3DE","#27500A"],red:["#FCEBEB","#791F1F"],amber:["#FAEEDA","#633806"],purple:["#EEEDFE","#3C3489"],blue:["#E6F1FB","#0C447C"],gray:["#F1EFE8","#444441"]};
  var pair = m[c] || m["teal"];
  return {display:"inline-block",padding:"2px 9px",borderRadius:20,fontSize:12,background:pair[0],color:pair[1],fontWeight:500};
}


/* ══════════════════════════════════════════════════════════════════════
   AUTENTICACIÓN — Fase 2: Login, Logout, RBAC, Usuarios
   Inserta DESPUÉS de las constantes para que TEAL esté disponible.
   ══════════════════════════════════════════════════════════════════════ */

var UK       = "mnpos-users-v1";
var SESS_KEY = "mnpos-session-v1";

var PERMS = {
  superadmin: ["superadmin"],
  admin:      ["dashboard","pos","caja","accounts","returns","defective","products","catalogos","inventory","history","backup","users","clients","repairs","cuadres","audit","warranties","storeconfig","suppliers","ayuda","migracion"],
  cajero:     ["dashboard","pos","caja","accounts","returns","history","clients","repairs","warranties","ayuda"],
  auditor:    ["dashboard","caja","history","inventory","cuadres","ayuda"],
};
var ROLE_LABEL = { superadmin:"Super Admin", admin:"Administrador", cajero:"Cajero", auditor:"Auditor" };
var ROLE_COLOR = { superadmin:"#9B59B6", admin:TEAL, cajero:"#378ADD", auditor:"#7F77DD" };

function canAccess(role, view) {
  var p = PERMS[role] || [];
  return p.indexOf(view) >= 0;
}

async function hashPass(password) {
  try {
    var enc = new TextEncoder();
    var buf = await crypto.subtle.digest("SHA-256", enc.encode(password + "mnpos_salt_2026"));
    return Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,"0");}).join("");
  } catch(e) {
    return btoa(unescape(encodeURIComponent(password + "mnpos_salt_2026")));
  }
}
function getSession() {
  try {
    var s = JSON.parse(sessionStorage.getItem(SESS_KEY) || "null");
    if(!s) return null;
    if(Date.now() > s.expiresAt) { sessionStorage.removeItem(SESS_KEY); return null; }
    return s;
  } catch(e){ return null; }
}
function createSession(user) {
  var s = {userId:user.id,name:user.name,email:user.email,role:user.role,expiresAt:Date.now()+8*60*60*1000};
  sessionStorage.setItem(SESS_KEY, JSON.stringify(s));
  return s;
}
function clearSession() {
  // Revoca el refresh token en el servidor y lo borra de localStorage (no solo sessionStorage),
  // para que "Cerrar sesión" realmente termine el acceso (antes el token de 30d sobrevivía).
  try { var _rt = localStorage.getItem('mnpos-refresh-token'); if (_rt) { authAPI.logout(_rt).catch(function(){}); localStorage.removeItem('mnpos-refresh-token'); } } catch(e) {}
  sessionStorage.removeItem(SESS_KEY);
}

/* ══════════════════════════════════════════════════════════════════════
   LANDING PAGE
   ══════════════════════════════════════════════════════════════════════ */

/* ── Theme CSS ── */
var THEME_CSS = `
/* ── Variables de tema ─────────────────────────────────────── */
[data-theme="light"] {
  --bg-main: #f0eee8;
  --bg-card: #ffffff;
  --bg-input: #ffffff;
  --bg-sidebar: #1a2535;
  --bg-hover: rgba(255,255,255,0.1);
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --text-muted: #9ca3af;
  --border-card: rgba(0,0,0,0.07);
  --border-input: rgba(0,0,0,0.18);
  --border-table: rgba(0,0,0,0.07);
  --border-row: rgba(0,0,0,0.04);
  --bg-table-head: #f8f9fa;
  --bg-alt: #f8f9fa;
  --bg-row: transparent;
  --bg-error: #FEF2F2;
  --text-error: #991b1b;
  --shadow: rgba(0,0,0,0.06);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.07);
  --teal: #1D9E75;
}
[data-theme="dark"] {
  --bg-main: #0d1520;
  --bg-card: #1a2535;
  --bg-input: #243044;
  --bg-sidebar: #0d1520;
  --bg-hover: rgba(255,255,255,0.08);
  --text-primary: #e2e8f0;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --border-card: rgba(255,255,255,0.08);
  --border-input: rgba(255,255,255,0.14);
  --border-table: rgba(255,255,255,0.07);
  --border-row: rgba(255,255,255,0.04);
  --bg-table-head: #1e2d42;
  --bg-alt: #1e2d42;
  --bg-row: transparent;
  --bg-error: #3b1f1f;
  --text-error: #fca5a5;
  --shadow: rgba(0,0,0,0.3);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.25);
  --teal: #1D9E75;
}

/* ── Reset & base ─────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; }
body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }

/* ── Selección de texto ──────────────────────────────────── */
::selection { background: rgba(29,158,117,0.18); }

/* ── Scrollbar personalizado ─────────────────────────────── */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.28); }
[data-theme="dark"] ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); }

/* ── Botones: transición global ──────────────────────────── */
button {
  transition: background 0.15s ease, box-shadow 0.15s ease, transform 0.12s ease, opacity 0.15s ease;
  font-family: inherit;
}
button:active:not(:disabled) { transform: scale(0.97); }
button:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Inputs: focus ring teal ─────────────────────────────── */
input, select, textarea {
  font-family: inherit;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}
input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: #1D9E75 !important;
  box-shadow: 0 0 0 3px rgba(29,158,117,0.14) !important;
}

/* ── Filas de tabla: hover suave ─────────────────────────── */
tbody tr { transition: background 0.12s ease; }
tbody tr:hover { background: rgba(29,158,117,0.04) !important; }
[data-theme="dark"] tbody tr:hover { background: rgba(29,158,117,0.07) !important; }

/* ── Sidebar: transición en items ────────────────────────── */
.sidebar-nav-item {
  transition: background 0.14s ease, color 0.14s ease, transform 0.1s ease !important;
  border-radius: 10px !important;
  margin: 1px 8px !important;
}
.sidebar-nav-item:hover { background: rgba(255,255,255,0.08) !important; }

/* ── Animación de entrada de pantalla ────────────────────── */
@keyframes screenEnter {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.screen-enter { animation: screenEnter 0.2s ease both; }

/* ── Flash: animación slide-up ───────────────────────────── */
@keyframes flashSlide {
  from { opacity: 0; transform: translateY(16px) translateX(-50%); }
  to   { opacity: 1; transform: translateY(0) translateX(-50%); }
}
.flash-msg { animation: flashSlide 0.22s ease both; }

/* ── Columnas responsive en formularios ──────────────────── */
@media(max-width:900px) { .rg-4 { grid-template-columns: repeat(2,1fr) !important; } }
@media(max-width:560px) { .rg-4 { grid-template-columns: 1fr !important; } }

/* ── Mobile layout ───────────────────────────────────────── */
@media(max-width:768px) {
  .sidebar-mobile {
    position: fixed !important;
    left: -220px;
    top: 0;
    z-index: 200;
    transition: left 0.26s cubic-bezier(0.4,0,0.2,1);
    box-shadow: none;
  }
  .sidebar-mobile.open {
    left: 0 !important;
    box-shadow: 6px 0 28px rgba(0,0,0,0.4);
  }
  .sidebar-overlay { display: block !important; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 199; backdrop-filter: blur(2px); }
  .mobile-header   { display: flex !important; }
  .main-content    { padding-top: 60px !important; }
}
`;

/* ── ErrorBoundary — evita pantalla blanca ante crashes de render ── */
class ErrorBoundary extends React.Component {
  constructor(props){
    super(props);
    this.state={hasError:false,error:null};
  }
  static getDerivedStateFromError(error){
    return {hasError:true,error:error};
  }
  componentDidCatch(error,info){
    console.error("[ErrorBoundary]",error,info);
    try { import('./utils/sentry.js').then(function(m){ m.Sentry.captureException(error, { extra: info }); }); } catch(_e) {}
  }
  render(){
    if(this.state.hasError){
      return (
        <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f5f4f0"}}>
          <div style={{background:"#fff",borderRadius:16,padding:"36px 40px",maxWidth:460,width:"90%",textAlign:"center",boxShadow:"0 8px 32px rgba(0,0,0,0.12)"}}>
            <div style={{fontSize:48,marginBottom:12}}>⚠️</div>
            <p style={{fontSize:18,fontWeight:700,margin:"0 0 8px",color:"#1a1a1a"}}>Ocurrió un error inesperado</p>
            <p style={{fontSize:13,color:"#666",margin:"0 0 24px",lineHeight:1.6}}>La pantalla no pudo cargarse correctamente. Podés intentar recargar la página.</p>
            <button onClick={function(){window.location.reload();}} style={{padding:"12px 28px",borderRadius:8,border:"none",background:"#1D9E75",color:"#fff",fontSize:14,cursor:"pointer",fontWeight:700}}>
              🔄 Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ── AppWrapper — controla autenticación ── */
function AppWrapper() {
  var _s=useState(function(){return getSession();}); var session=_s[0]; var setSession=_s[1];
  var _th=useState(function(){return localStorage.getItem("mnpos-theme")||"light";}); var theme=_th[0]; var setTheme=_th[1];
  var _sb=useState(false); var sidebarOpen=_sb[0]; var setSidebarOpen=_sb[1];
  var _pi=useState(false); var showInstall=_pi[0]; var setShowInstall=_pi[1];
  var _land=useState(true); var showLanding=_land[0]; var setShowLanding=_land[1];

  useEffect(function(){
    if(window.__pwaInstallPrompt) setShowInstall(true);
    function onReady(){ setShowInstall(true); }
    window.addEventListener('pwa-install-ready', onReady);
    window.addEventListener('appinstalled', function(){ setShowInstall(false); });
    return function(){ window.removeEventListener('pwa-install-ready', onReady); };
  },[]);

  function installPWA(){
    if(!window.__pwaInstallPrompt) return;
    window.__pwaInstallPrompt.prompt();
    window.__pwaInstallPrompt.userChoice.then(function(r){
      if(r.outcome==='accepted') setShowInstall(false);
      window.__pwaInstallPrompt=null;
    });
  }

  function toggleTheme(){
    var next=theme==="light"?"dark":"light";
    setTheme(next);
    localStorage.setItem("mnpos-theme",next);
  }

  useEffect(function(){
    async function initAdmin(){
      var users=await db.load(UK,[]);
      if(!users||users.length===0){
        var hash=await hashPass("Admin2026#");
        await db.save(UK,[{id:gid(),name:"Administrador",email:"admin@demo.com",passwordHash:hash,role:"admin",active:true,createdAt:new Date().toISOString()}]);
        console.log("Admin creado exitosamente");
      }
    }
    initAdmin();
  },[]);

  /* ── Atajos globales de teclado ── */
  useEffect(function(){
    function onGlobalKey(e){
      // / para enfocar búsqueda (si está en POS)
      if(e.key==="/" && e.target.tagName!=="INPUT" && e.target.tagName!=="TEXTAREA"){
        var search=document.querySelector('input[placeholder*="Buscar por nombre"]');
        if(search){e.preventDefault();search.focus();}
      }
      // Escape para limpiar búsqueda
      if(e.key==="Escape"){
        var active=document.activeElement;
        if(active&&active.tagName==="INPUT"){active.blur();}
      }
    }
    document.addEventListener("keydown",onGlobalKey);
    return function(){document.removeEventListener("keydown",onGlobalKey);};
  },[]);

  /* ── Detector de modo mouse vs teclado (patrón profesional) ── */
  useEffect(function(){
    var usingMouse = true;
    document.body.classList.add("using-mouse");

    function onMouseDown(){
      if(!usingMouse){
        usingMouse = true;
        document.body.classList.remove("using-keyboard");
        document.body.classList.add("using-mouse");
      }
    }
    function onKeyDown(e){
      // Solo activar modo teclado con teclas de navegación
      var navKeys = ["Tab","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Enter"," ","Escape"];
      if(navKeys.indexOf(e.key) >= 0 && usingMouse){
        usingMouse = false;
        document.body.classList.remove("using-mouse");
        document.body.classList.add("using-keyboard");
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return function(){
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  },[]);

  return (
    <div data-theme={theme} style={{minHeight:"100vh"}}>
      <style dangerouslySetInnerHTML={{__html:THEME_CSS}}/>
      {showInstall&&(
        <div style={{position:"fixed",bottom:16,left:"50%",transform:"translateX(-50%)",zIndex:9999,background:"#1a2535",color:"#fff",borderRadius:14,padding:"12px 18px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 8px 32px rgba(0,0,0,0.35)",maxWidth:360,width:"calc(100% - 32px)",boxSizing:"border-box"}}>
          <img src="/icon-192.png" alt="" style={{width:36,height:36,borderRadius:8,flexShrink:0}}/>
          <div style={{flex:1,minWidth:0}}>
            <p style={{margin:0,fontWeight:700,fontSize:13}}>Instalar {APP_NAME}</p>
            <p style={{margin:0,fontSize:11,opacity:0.7}}>Acceso rápido desde tu pantalla de inicio</p>
          </div>
          <button onClick={installPWA} style={{background:"#1D9E75",color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0}}>Instalar</button>
          <button onClick={function(){setShowInstall(false);}} style={{background:"transparent",color:"rgba(255,255,255,0.5)",border:"none",fontSize:18,cursor:"pointer",padding:"0 4px",flexShrink:0}}>✕</button>
        </div>
      )}
      {!session
        ? (showLanding
            ? <LandingPage onLogin={function(){setShowLanding(false);}}/>
            : <LoginScreen onLogin={function(s){setSession(s);}} onBack={function(){setShowLanding(true);}}/>)
        : <ErrorBoundary><App session={session} onLogout={function(){clearSession();setSession(null);setShowLanding(true);}} theme={theme} toggleTheme={toggleTheme} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}/></ErrorBoundary>
      }
    </div>
  );
}

/* ── MetricBox ── */
function MetricBox(props) {
  var accent = props.color || TEAL;
  return (
    <div style={{background:"var(--bg-card,#fff)",borderRadius:14,padding:"18px 20px",border:"1px solid var(--border-card,rgba(0,0,0,0.07))",boxShadow:"var(--shadow-md,0 2px 12px rgba(0,0,0,0.06))",display:"flex",flexDirection:"column",gap:6,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,width:3,height:"100%",background:accent,borderRadius:"14px 0 0 14px"}}/>
      <p style={{fontSize:11,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",color:"var(--text-secondary,#6b7280)",margin:0}}>{props.label}</p>
      <p style={{fontSize:24,fontWeight:700,margin:0,color:accent,lineHeight:1}}>{props.value}</p>
      {props.sub&&<p style={{fontSize:11,color:"var(--text-muted,#9ca3af)",margin:0}}>{props.sub}</p>}
    </div>
  );
}

/* ── Tooltip de ayuda ── */
function HelpTip(props) {
  var _s=useState(false); var show=_s[0]; var setShow=_s[1];
  return (
    <span style={{position:"relative",display:"inline-block",marginLeft:6,verticalAlign:"middle"}}>
      <span
        onMouseEnter={function(){setShow(true);}}
        onMouseLeave={function(){setShow(false);}}
        onClick={function(){setShow(!show);}}
        style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:18,height:18,borderRadius:"50%",background:"#e0e0e0",color:"#555",fontSize:11,fontWeight:700,cursor:"pointer",userSelect:"none",flexShrink:0}}
      >?</span>
      {show&&(
        <span style={{position:"absolute",zIndex:9999,bottom:"calc(100% + 6px)",left:"50%",transform:"translateX(-50%)",background:"#1a2535",color:"#fff",fontSize:12,lineHeight:1.5,padding:"8px 12px",borderRadius:8,whiteSpace:"pre-wrap",minWidth:200,maxWidth:280,boxShadow:"0 4px 16px rgba(0,0,0,0.25)",pointerEvents:"none"}}>
          {props.text}
          <span style={{position:"absolute",bottom:-5,left:"50%",transform:"translateX(-50%)",width:10,height:10,background:"#1a2535",clipPath:"polygon(0 0,100% 0,50% 100%)"}}/>
        </span>
      )}
    </span>
  );
}

/* ── ProductForm ── */
var UNIT_OPTIONS = [
  {v:"uni",  l:"Unidad (uni)"},
  {v:"pza",  l:"Pieza (pza)"},
  {v:"serv", l:"Servicio (serv)"},
];
function normalizeProductField(k, v) {
  if(typeof v !== "string") return v;
  v = v.trim();
  if(k === "name")     return v.charAt(0).toUpperCase() + v.slice(1);
  if(k === "category") return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase().replace(/^\w/, function(c){ return v.charAt(0).toUpperCase(); });
  if(k === "shelf")    return v.toUpperCase();
  if(k === "code")     return v.toUpperCase();
  return v;
}
function titleCase(str){
  str = str.trim();
  return str.charAt(0).toUpperCase() + str.slice(1);
}
function ProductForm(props) {
  var product=props.product; var onSave=props.onSave; var onCancel=props.onCancel;
  var categories=props.categories||[];
  var locations=props.locations||[];
  var _s=useState(Object.assign({},product)); var form=_s[0]; var setForm=_s[1];
  var _e=useState(""); var err=_e[0]; var setErr=_e[1];

  function set(k,v){
    setErr("");
    setForm(function(f){ var n=Object.assign({},f); n[k]=v; return n; });
  }
  function doSave(){
    if(!form.name||!form.name.trim()){setErr("El nombre es obligatorio");return;}
    if(!form.category_id){setErr("La categoría es obligatoria — elígela de la lista");return;}
    if(!form.price||isNaN(parseFloat(form.price))){setErr("El precio es obligatorio");return;}
    // Resolver nombres seleccionados para guardar también los campos legacy
    // (category / shelf) y que las tablas existentes sigan funcionando.
    var selCat = categories.find(function(c){return String(c.id)===String(form.category_id);});
    var selLoc = locations.find(function(l){return String(l.id)===String(form.location_id);});
    var pos = (form.position||"").trim();
    var shelfTxt = selLoc ? (selLoc.name + (pos ? " · " + pos : "")) : pos;
    onSave(Object.assign({},form,{
      name:        titleCase(form.name||""),
      category_id: form.category_id,
      category:    selCat ? selCat.name : "",
      location_id: form.location_id || null,
      position:    pos || null,
      shelf:       shelfTxt,
      code:        (form.code||"").trim().toUpperCase(),
      unit:        form.unit||"uni",
      price:       parseFloat(form.price)||0,
      cost:        parseFloat(form.cost)||0,
      stock:       parseInt(form.stock)||0,
      minStock:    parseInt(form.minStock)||0,
    }));
  }
  return (
      <div style={Object.assign({},sC,{marginBottom:16,borderColor:TEAL,borderWidth:"1.5px"})}>
        <p style={{fontWeight:600,margin:"0 0 14px",fontSize:15}}>{product.id?"✏️ Editar":"➕ Nuevo Producto"}</p>
        {err&&<p style={{color:"#E24B4A",fontSize:13,margin:"0 0 10px"}}>⚠ {err}</p>}
        <div className="rg-4" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:14}}>
          {/* Nombre */}
          <div>
            <label style={sL}>Nombre *</label>
            <input type="text" style={sI} value={form.name||""} placeholder="Ej: Pantalla Samsung A24"
              onChange={function(e){set("name",e.target.value);}}/>
          </div>
          {/* Categoría — lista cerrada (administrable en Catálogos) */}
          <div>
            <label style={sL}>Categoría *</label>
            <select style={Object.assign({},sI,{background:"#fff"})} value={form.category_id||""}
              onChange={function(e){set("category_id",e.target.value);}}>
              <option value="">— Elegir categoría —</option>
              {categories.map(function(c){return <option key={c.id} value={c.id}>{(c.icon?c.icon+" ":"")+c.name}</option>;})}
            </select>
            {categories.length===0&&<p style={{fontSize:11,color:"#E65100",margin:"3px 0 0"}}>No hay categorías. Créalas en "Catálogos".</p>}
          </div>
          {/* Ubicación (estante) — lista cerrada */}
          <div>
            <label style={sL}>Estante / Ubicación</label>
            <select style={Object.assign({},sI,{background:"#fff"})} value={form.location_id||""}
              onChange={function(e){set("location_id",e.target.value);}}>
              <option value="">— Sin ubicación —</option>
              {locations.map(function(l){return <option key={l.id} value={l.id}>{l.name}</option>;})}
            </select>
          </div>
          {/* Posición dentro del estante (bandeja/gaveta) */}
          <div>
            <label style={sL}>Posición</label>
            <input type="text" style={sI} value={form.position||""} placeholder="Ej: B3, A2-2"
              onChange={function(e){set("position",e.target.value);}}
              onBlur={function(e){set("position",(e.target.value||"").trim());}}/>
          </div>
          {/* Código */}
          <div>
            <label style={sL}>Código</label>
            <input type="text" style={sI} value={form.code||""} placeholder="Ej: MCD-001"
              onChange={function(e){set("code",e.target.value);}}
              onBlur={function(e){set("code",(e.target.value||"").trim().toUpperCase());}}/>
          </div>
          {/* Precio */}
          <div>
            <label style={sL}>Precio venta (Q) *</label>
            <input type="number" style={sI} value={form.price||""} placeholder="0.00"
              onChange={function(e){set("price",e.target.value);}}/>
          </div>
          {/* Costo */}
          <div>
            <label style={sL}>Costo (Q)</label>
            <input type="number" style={sI} value={form.cost||""} placeholder="0.00"
              onChange={function(e){set("cost",e.target.value);}}/>
          </div>
          {/* Stock */}
          <div>
            <label style={sL}>Stock actual</label>
            <input type="number" style={sI} value={form.stock||""} placeholder="0"
              onChange={function(e){set("stock",e.target.value);}}/>
          </div>
          {/* Unidad — dropdown fijo */}
          <div>
            <label style={sL}>Unidad</label>
            <select style={Object.assign({},sI,{background:"#fff"})} value={form.unit||"uni"}
              onChange={function(e){set("unit",e.target.value);}}>
              {UNIT_OPTIONS.map(function(o){return <option key={o.v} value={o.v}>{o.l}</option>;})}
            </select>
          </div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button style={mB("teal")} onClick={doSave}>{product.id?"Guardar cambios":"Agregar"}</button>
          <button style={mB("gray")} onClick={onCancel}>Cancelar</button>
        </div>
      </div>
  );
}

/* ── Sidebar ── */
function Sidebar(props) {
  var storeInfo=props.storeInfo||{};
  var view=props.view; var setView=props.setView;
  var cartLen=props.cartLen; var pendingLen=props.pendingLen;
  var products=props.products; var sales=props.sales;
  var session=props.session||{}; var onLogout=props.onLogout||function(){}; var isOnline=props.isOnline||false;
  var theme=props.theme||"light"; var toggleTheme=props.toggleTheme||function(){};
  var sidebarOpen=props.sidebarOpen||false; var setSidebarOpen=props.setSidebarOpen||function(){};
  var onSearch=props.onSearch||function(){};
  var NAV = [
    {id:"dashboard", ic:"📊", lb:"Dashboard"},
    {id:"pos",       ic:"🛒", lb:"Nueva Venta"},
    {id:"caja",      ic:"💵", lb:"Caja"},
    {id:"clients",   ic:"👤", lb:"Clientes"},
    {id:"repairs",   ic:"🔧", lb:"Reparaciones"},
    {id:"accounts",  ic:"💳", lb:"Cuentas"},
    {id:"returns",   ic:"🔄", lb:"Devoluciones"},
    {id:"defective", ic:"🔩", lb:"Piezas Defect."},
    {id:"products",  ic:"📦", lb:"Productos"},
    {id:"catalogos", ic:"🏷️", lb:"Catálogos"},
    {id:"inventory", ic:"🗄️", lb:"Inventario"},
    {id:"history",   ic:"📋", lb:"Historial"},
    {id:"warranties", ic:"🛡️", lb:"Garantías"},
    {id:"cuadres",   ic:"📈", lb:"Cuadres"},
    {id:"audit",     ic:"🔍", lb:"Auditoría"},
    {id:"backup",    ic:"💾", lb:"Respaldo"},
    {id:"migracion", ic:"📒", lb:"Pasar mi cuaderno"},
    {id:"users",       ic:"👥", lb:"Usuarios"},
    {id:"suppliers",   ic:"🏭", lb:"Proveedores"},
    {id:"storeconfig", ic:"⚙️", lb:"Mi Tienda"},
    {id:"ayuda",       ic:"📖", lb:"Ayuda"},
  ];
  return (
      <div className={"sidebar-mobile"+(sidebarOpen?" open":"")} style={{width:200,background:NAVY,display:"flex",flexDirection:"column",flexShrink:0,position:"sticky",top:0,height:"100vh"}}>
        <div style={{padding:"0",borderBottom:"1px solid rgba(255,255,255,0.1)",overflow:"hidden"}}>
          <div style={{background:"linear-gradient(145deg,#1f3248 0%,#152539 60%,#0e1e2e 100%)",padding:"18px 16px 14px",position:"relative"}}>
            <div style={{position:"absolute",top:0,right:0,width:80,height:80,borderRadius:"0 0 0 80px",background:"rgba(29,158,117,0.12)"}}/>
            <div style={{position:"absolute",bottom:0,left:0,width:50,height:50,borderRadius:"0 50px 0 0",background:"rgba(29,158,117,0.07)"}}/>
            <div style={{display:"flex",alignItems:"center",gap:11,marginBottom:10,position:"relative"}}>
              <div style={{
                width:42,height:42,borderRadius:12,flexShrink:0,
                background:"linear-gradient(135deg,"+TEAL+" 0%,#0a7a56 100%)",
                display:"flex",alignItems:"center",justifyContent:"center",
                boxShadow:"0 4px 14px rgba(29,158,117,0.5)",
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="5" y="2" width="14" height="20" rx="2.5" stroke="white" strokeWidth="1.8"/>
                  <circle cx="12" cy="17.5" r="1.4" fill="white"/>
                  <line x1="9" y1="5.5" x2="15" y2="5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="10.5" y1="9.5" x2="13.5" y2="9.5" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <p style={{color:"#fff",fontSize:13,fontWeight:800,margin:0,lineHeight:1.3,letterSpacing:"-0.2px"}}>{storeInfo.store_name||STORE_FALLBACK}</p>
                <p style={{color:TEAL,fontSize:9,fontWeight:700,margin:0,letterSpacing:"1.5px",textTransform:"uppercase"}}>Sistema de Gestión</p>
              </div>
            </div>
            <div style={{height:"1px",background:"linear-gradient(90deg,"+TEAL+"99,transparent)",marginBottom:8,position:"relative"}}/>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",position:"relative"}}>
              <p style={{color:"rgba(255,255,255,0.38)",fontSize:8.5,margin:0,letterSpacing:"1.2px",textTransform:"uppercase"}}>{APP_NAME}</p>
              <p style={{color:"rgba(255,255,255,0.2)",fontSize:8,margin:0,letterSpacing:"0.5px"}}>v{APP_VERSION}</p>
            </div>
          </div>
        </div>
        <nav style={{flex:1,padding:"10px 0",overflowY:"auto"}} onKeyDown={function(e){
        var items=document.querySelectorAll(".sidebar-nav-item");
        var arr=Array.from(items);
        var cur=document.activeElement;
        var idx=arr.indexOf(cur);
        if(e.key==="ArrowDown"){e.preventDefault();var next=arr[idx+1]||arr[0];next&&next.focus();}
        else if(e.key==="ArrowUp"){e.preventDefault();var prev=arr[idx-1]||arr[arr.length-1];prev&&prev.focus();}
      }}>
          {NAV.filter(function(item){return canAccess(session.role||"cajero",item.id);}).map(function(item){
            var isActive=view===item.id;
            return (
                <div key={item.id} className="sidebar-nav-item" tabIndex={isActive?0:-1} onClick={function(){setView(item.id);setSidebarOpen(false);}} onKeyDown={function(e){if(e.key==="Enter")setView(item.id);}} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",cursor:"pointer",background:isActive?"rgba(29,158,117,0.18)":"transparent",color:isActive?"#fff":"rgba(255,255,255,0.52)",fontSize:13,borderRadius:10,marginBottom:1,fontWeight:isActive?600:400}}>
                  <span style={{fontSize:14}}>{item.ic}</span>
                  <span style={{flex:1}}>{item.lb}</span>
                  {item.id==="pos"&&cartLen>0&&<span style={{background:TEAL,color:"#fff",borderRadius:10,fontSize:10,padding:"1px 5px",fontWeight:700}}>{cartLen}</span>}
                  {item.id==="accounts"&&pendingLen>0&&<span style={{background:"#E24B4A",color:"#fff",borderRadius:10,fontSize:10,padding:"1px 5px",fontWeight:700}}>{pendingLen}</span>}
                </div>
            );
          })}
        </nav>
        <div style={{borderTop:"1px solid rgba(255,255,255,0.08)"}}>
          {session.name&&(
              <div style={{padding:"10px 16px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                <p style={{color:"#fff",fontSize:12,fontWeight:600,margin:"0 0 3px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{session.name}</p>
                <span style={{display:"inline-block",background:ROLE_COLOR[session.role]||TEAL,color:"#fff",borderRadius:10,fontSize:9,padding:"2px 7px",fontWeight:700,letterSpacing:"0.5px",textTransform:"uppercase",marginBottom:6}}>{ROLE_LABEL[session.role]||session.role}</span>
                <br/>
                <button onClick={onLogout} style={{padding:"5px 0",width:"100%",borderRadius:6,border:"1px solid rgba(255,255,255,0.15)",background:"transparent",color:"rgba(255,255,255,0.45)",cursor:"pointer",fontSize:11,fontWeight:500}}>Cerrar sesión</button>
              </div>
          )}
          <div style={{padding:"8px 16px"}}>
            <button onClick={onSearch} style={{width:"100%",padding:"6px 0",borderRadius:6,border:"1px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.6)",cursor:"pointer",fontSize:11,fontWeight:500,marginBottom:6}}>
              🔍 Buscar <span style={{fontSize:9,opacity:0.5,marginLeft:4}}>Ctrl+K</span>
            </button>
            <button onClick={toggleTheme} style={{width:"100%",padding:"6px 0",borderRadius:6,border:"1px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.6)",cursor:"pointer",fontSize:11,fontWeight:500,marginBottom:6}}>
              {theme==="light"?"🌙 Modo oscuro":"☀️ Modo claro"}
            </button>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.2)",lineHeight:1.9}}>{products.length} prod · {sales.length} ventas</div>
            <div style={{fontSize:9,marginTop:2,color:isOnline?"#1D9E75":"rgba(255,255,255,0.15)"}}>● {isOnline?"Conectado a la nube":"Modo local"}</div>
          </div>
        </div>
      </div>
  );
}

/* ── Hook responsive ────────────────────────────────────────────────── */
function useIsMobile(bp){ bp=bp||768; var _w=useState(function(){return window.innerWidth<=bp;}); var isMobile=_w[0]; var setIsMobile=_w[1]; useEffect(function(){ function h(){setIsMobile(window.innerWidth<=bp);} window.addEventListener("resize",h); return function(){window.removeEventListener("resize",h);}; },[bp]); return isMobile; }

/* ── Paginador reutilizable ─────────────────────────────────────────── */
function usePaginator(items, perPage){
  var _p=useState(1); var page=_p[0]; var setPage=_p[1];
  var total=Math.ceil(items.length/perPage)||1;
  var safePage=Math.min(page,total);
  var paged=items.slice((safePage-1)*perPage, safePage*perPage);
  function Pager(){
    if(total<=1)return null;
    var pages=[];
    for(var i=1;i<=total;i++)pages.push(i);
    return (
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",marginTop:8,borderTop:"1px solid rgba(0,0,0,0.07)"}}>
        <span style={{fontSize:12,color:"#999"}}>{items.length} registros · Pág. {safePage} de {total}</span>
        <div style={{display:"flex",gap:4}}>
          <button disabled={safePage<=1} onClick={function(){setPage(1);}} style={Object.assign({},mB("gray"),{padding:"4px 8px",fontSize:11,opacity:safePage<=1?0.4:1})}>«</button>
          <button disabled={safePage<=1} onClick={function(){setPage(safePage-1);}} style={Object.assign({},mB("gray"),{padding:"4px 8px",fontSize:11,opacity:safePage<=1?0.4:1})}>‹</button>
          {pages.filter(function(p){return Math.abs(p-safePage)<=2;}).map(function(p){
            return <button key={p} onClick={function(){setPage(p);}} style={Object.assign({},mB(p===safePage?"teal":"gray"),{padding:"4px 9px",fontSize:11,minWidth:28})}>{p}</button>;
          })}
          <button disabled={safePage>=total} onClick={function(){setPage(safePage+1);}} style={Object.assign({},mB("gray"),{padding:"4px 8px",fontSize:11,opacity:safePage>=total?0.4:1})}>›</button>
          <button disabled={safePage>=total} onClick={function(){setPage(total);}} style={Object.assign({},mB("gray"),{padding:"4px 8px",fontSize:11,opacity:safePage>=total?0.4:1})}>»</button>
        </div>
      </div>
    );
  }
  var offset=(safePage-1)*perPage;
  return {paged:paged, Pager:Pager, resetPage:function(){setPage(1);}, offset:offset};
}

/* ── Tabla paginada reutilizable ────────────────────────────────────────
   Uso:
     var pag = usePaginator(items, 20);
     <PagTable pag={pag} cols={[
       { label:"Nombre", render: function(row){ return row.name; } },
       { label:"Total",  render: function(row){ return "Q "+row.total; } },
     ]} empty="Sin registros aún"/>
   - Columna # incluida automáticamente con numeración continua entre páginas
   - Pager incluido al pie
   - Para ocultar # en una columna específica, no se puede; está fijo al inicio
────────────────────────────────────────────────────────────────────────── */
function PagTable(props){
  var pag=props.pag; var cols=props.cols||[]; var empty=props.empty||"Sin registros";
  var onRowClick=props.onRowClick||null;
  if(!pag.paged.length) return <p style={{textAlign:"center",color:"#999",padding:40}}>{empty}</p>;
  return (
    <div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr>
              <th style={Object.assign({},sTH,{width:40,textAlign:"center"})}>#</th>
              {cols.map(function(c,i){ return <th key={i} style={c.thStyle?Object.assign({},sTH,c.thStyle):sTH}>{c.label}</th>; })}
            </tr>
          </thead>
          <tbody>
            {pag.paged.map(function(row,i){
              return (
                <tr key={row.id||i} onClick={onRowClick?function(){onRowClick(row);}:undefined}
                    style={onRowClick?{cursor:"pointer"}:undefined}>
                  <td style={{padding:"10px 8px",textAlign:"center",color:"#bbb",fontSize:12,borderBottom:"1px solid rgba(0,0,0,0.05)"}}>{pag.offset+i+1}</td>
                  {cols.map(function(c,ci){
                    return <td key={ci} style={c.tdStyle?Object.assign({},sTD,c.tdStyle):sTD}>{c.render(row,i)}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <pag.Pager/>
    </div>
  );
}

/* ── Búsqueda global ────────────────────────────────────────────────── */
function GlobalSearch(props){
  var onClose=props.onClose; var setView=props.setView;
  var sales=props.sales||[]; var clients=props.clients||[];
  var products=props.products||[]; var repairs=props.repairs||[];
  var setSelectedSale=props.setSelectedSale;
  var _q=useState(""); var q=_q[0]; var setQ=_q[1];
  var ref=useRef(null);
  useEffect(function(){if(ref.current)ref.current.focus();},[]);
  useEffect(function(){
    function handler(e){if(e.key==="Escape")onClose();}
    document.addEventListener("keydown",handler);
    return function(){document.removeEventListener("keydown",handler);};
  },[]);
  var ql=q.toLowerCase().trim();
  var results=[];
  if(ql.length>=2){
    clients.filter(function(c){return (c.name||"").toLowerCase().indexOf(ql)>=0||(c.phone||"").indexOf(ql)>=0||(c.cli_code||"").toLowerCase().indexOf(ql)>=0;}).slice(0,4).forEach(function(c){
      results.push({type:"Cliente",icon:"👤",title:c.name,sub:(c.phone||"")+" · "+c.cli_code,action:function(){setView("clients");onClose();}});
    });
    products.filter(function(p){return (p.name||"").toLowerCase().indexOf(ql)>=0||(p.code||"").toLowerCase().indexOf(ql)>=0;}).slice(0,4).forEach(function(p){
      results.push({type:"Producto",icon:"📦",title:p.name,sub:"Stock: "+p.stock+" · Q"+Number(p.price).toFixed(2),action:function(){setView("products");onClose();}});
    });
    sales.filter(function(s){return (s.client||"").toLowerCase().indexOf(ql)>=0;}).slice(0,4).forEach(function(s){
      results.push({type:"Venta",icon:"🛒",title:s.client,sub:fmtD(s.date)+" · Q"+Number(s.total).toFixed(2),action:function(){if(setSelectedSale)setSelectedSale(s);setView("history");onClose();}});
    });
    repairs.filter(function(r){return (r.client_name||"").toLowerCase().indexOf(ql)>=0||(r.brand||"").toLowerCase().indexOf(ql)>=0||(r.model||"").toLowerCase().indexOf(ql)>=0||(r.rep_code||"").toLowerCase().indexOf(ql)>=0;}).slice(0,4).forEach(function(r){
      results.push({type:"Reparación",icon:"🔧",title:(r.client_name||"")+" — "+r.brand+" "+r.model,sub:r.rep_code+" · "+r.status,action:function(){setView("repairs");onClose();}});
    });
  }
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:9999,display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:80}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:16,boxShadow:"0 20px 60px rgba(0,0,0,0.3)",width:"100%",maxWidth:560,overflow:"hidden"}} onClick={function(e){e.stopPropagation();}}>
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 18px",borderBottom:"1px solid rgba(0,0,0,0.08)"}}>
          <span style={{fontSize:18}}>🔍</span>
          <input ref={ref} style={{flex:1,border:"none",outline:"none",fontSize:16,background:"transparent"}} placeholder="Buscar clientes, productos, ventas, reparaciones..." value={q} onChange={function(e){setQ(e.target.value);}}/>
          <span style={{fontSize:11,color:"#bbb",background:"#f4f4f4",borderRadius:6,padding:"3px 7px",fontFamily:"monospace"}}>ESC</span>
        </div>
        <div style={{maxHeight:380,overflowY:"auto",padding:ql.length>=2?"8px 0":"20px",minHeight:60}}>
          {ql.length<2&&<p style={{textAlign:"center",color:"#bbb",fontSize:13,margin:0}}>Escribe al menos 2 caracteres para buscar</p>}
          {ql.length>=2&&results.length===0&&<p style={{textAlign:"center",color:"#bbb",fontSize:13,margin:0,padding:16}}>Sin resultados para "{q}"</p>}
          {results.map(function(r,i){
            return (
              <div key={i} onClick={r.action} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 18px",cursor:"pointer",borderBottom:"1px solid rgba(0,0,0,0.04)"}}
                onMouseEnter={function(e){e.currentTarget.style.background="#f8f8f8";}}
                onMouseLeave={function(e){e.currentTarget.style.background="transparent";}}>
                <span style={{fontSize:20,flexShrink:0}}>{r.icon}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.title}</div>
                  <div style={{fontSize:12,color:"#888",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.sub}</div>
                </div>
                <span style={mBg("teal")}>{r.type}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   PANTALLAS — nivel módulo (estables)
   ══════════════════════════════════════ */

function App(props) {
  var session=props.session||{}; var onLogout=props.onLogout||function(){};
  var theme=props.theme||"light"; var toggleTheme=props.toggleTheme||function(){};
  var sidebarOpen=props.sidebarOpen||false; var setSidebarOpen=props.setSidebarOpen||function(){};
  var _p=useState([]); var products=_p[0]; var setProducts=_p[1];
  var _cats=useState([]); var categories=_cats[0]; var setCategories=_cats[1];
  var _locs=useState([]); var locations=_locs[0]; var setLocations=_locs[1];
  var _s=useState([]); var sales=_s[0]; var setSales=_s[1];
  var _a=useState([]); var accounts=_a[0]; var setAccounts=_a[1];
  var _r=useState([]); var returns=_r[0]; var setReturns=_r[1];
  var _d=useState([]); var defectives=_d[0]; var setDefectives=_d[1];
  var _cl=useState([]); var clients=_cl[0]; var setClients=_cl[1];
  var _rep=useState([]); var repairs=_rep[0]; var setRepairs=_rep[1];
  var _war=useState([]); var warranties=_war[0]; var setWarranties=_war[1];
  var _ld=useState(false); var loaded=_ld[0]; var setLoaded=_ld[1];
  var _on=useState(false); var isOnline=_on[0]; var setIsOnline=_on[1];
  var _si=useState({store_name:"",store_tagline:"",store_phone:"",store_address:"",store_email:"",store_logo_url:""});
  var storeInfo=_si[0]; var setStoreInfo=_si[1];
  // Boleta post-venta: {sale, opts} cuando hay una venta recién cobrada para ofrecer comprobante.
  var _psr=useState(null); var postSale=_psr[0]; var setPostSale=_psr[1];
  // Si el negocio quiere que se ofrezca la boleta al cobrar (configurable). Por defecto sí.
  var _ofr=useState(true); var offerReceipt=_ofr[0]; var setOfferReceipt=_ofr[1];
  var _ob=useState(false); var showOnboarding=_ob[0]; var setShowOnboarding=_ob[1];
  var _sub=useState(null); var subInfo=_sub[0]; var setSubInfo=_sub[1];

  useEffect(function(){
    function handleGlobalKey(e){
      if((e.ctrlKey||e.metaKey)&&e.key==="k"){e.preventDefault();setGsOpen(true);}
    }
    document.addEventListener("keydown",handleGlobalKey);
    return function(){document.removeEventListener("keydown",handleGlobalKey);};
  },[]);

  useEffect(function(){
    async function loadAll(){
      var online = await checkAPI();
      setIsOnline(online);
      try {
        var [prods, sls, accs, rets, defs, clis, reps] = await Promise.all([
          productsAPI.getAll(),
          salesAPI.getAll(),
          accountsAPI.getAll(),
          returnsAPI.getAll(),
          defectivesAPI.getAll(),
          clientsAPI.getAll(),
          repairsAPI.getAll(),
        ]);
        var wars = await warrantiesAPI.getAll().catch(function(){return [];});
        var cfg  = await settingsAPI.getAll().catch(function(){return {};});
        categoriesAPI.getAll().then(function(c){setCategories(c||[]);}).catch(function(){});
        locationsAPI.getAll().then(function(l){setLocations(l||[]);}).catch(function(){});
        if(cfg&&cfg.store_name){ setStoreInfo(function(prev){return Object.assign({},prev,cfg);}); setStore(cfg); setReceiptStore(cfg); }
        if(cfg){ setOfferReceipt(cfg.offer_receipt!=="false"); }
        if(session.role==="admin"&&(!cfg||cfg.onboarding_done!=="true")){
          if((prods||[]).length>0){
            settingsAPI.update({onboarding_done:"true"}).catch(function(){});
          } else {
            setShowOnboarding(true);
          }
        }
        if(session.role!=="superadmin"){
          adminAPI.getSubscription().then(function(s){ setSubInfo(s); }).catch(function(){});
        }
        var normalProds = (prods||[]).map(function(p){return Object.assign({},p,{id:p.id,code:p.code,name:p.name,category:p.category||'',shelf:p.shelf||'',price:Number(p.price),cost:Number(p.cost),stock:Number(p.stock),unit:p.unit||'uni'});});
        var normalSales = (sls||[]).map(function(s){return Object.assign({},s,{items:s.sale_items||[],total:Number(s.total),date:s.created_at,registradoPor:s.registrado_por||null,payType:s.pay_type||'completo',status:s.status||'completado'});});
        var normalAccs  = (accs||[]).map(function(a){return Object.assign({},a,{items:a.account_items||[],payments:(a.account_payments||[]).map(function(_pp){return Object.assign({},_pp,{date:_pp.date||_pp.created_at,amount:Number(_pp.amount),registradoPor:_pp.registrado_por||_pp.registradoPor||null});}),total:Number(a.total),paid:Number(a.paid),balance:Number(a.balance),clientId:a.client_id,date:a.created_at,registradoPor:a.registrado_por||null});});
        var normalRets  = (rets||[]).map(function(r){return Object.assign({},r,{items:r.return_items||[],refundAmount:Number(r.refund_amount),itemCondition:r.item_condition,refundMethod:r.refund_method,date:r.created_at,saleId:r.sale_id||null,registradoPor:r.registrado_por||null});});
        var normalDefs  = (defs||[]).map(function(d){return Object.assign({},d,{price:Number(d.price||0),date:d.created_at});});
        var normalClis  = (clis||[]).map(function(c){return Object.assign({},c,{cliCode:c.cli_code,createdAt:c.created_at});});
        var normalReps  = (reps||[]).map(function(r){return Object.assign({},r,{repCode:r.rep_code,clientId:r.client_id,clientName:r.client_name,clientPhone:r.client_phone,clientCli:r.client_cli,problemDesc:r.problem_desc,techName:r.tech_name,estimatedCost:Number(r.estimated_cost||0),promisedDate:r.promised_date,internalNote:r.internal_note,registradoPor:r.registrado_por||{},parts:r.parts||[],createdAt:r.created_at,finalCost:r.final_cost!=null?Number(r.final_cost):null,receptionChecklist:r.reception_checklist||null,receptionPhotos:r.reception_photos||[],deliveryPhotos:r.delivery_photos||[]});});
        // Modo consulta sin internet (v1): snapshot LOCAL (localStorage) del
        // catálogo y clientes para poder CONSULTAR si se cae la conexión.
        // No toca la base de datos; si el almacenamiento está lleno, se ignora.
        try {
          localStorage.setItem('mnpos-offline-cache', JSON.stringify({
            savedAt: new Date().toISOString(),
            products: normalProds,
            clients: normalClis,
          }));
        } catch(_e) { /* cuota llena o storage no disponible — sin snapshot */ }
        setProducts(normalProds);
        setSales(normalSales);
        setAccounts(normalAccs);
        setReturns(normalRets);
        setDefectives(normalDefs);
        setClients(normalClis);
        setRepairs(normalReps);
        setWarranties((wars||[]).map(function(w){return Object.assign({},w,{entityType:w.entity_type,entityId:w.entity_id,startDate:w.start_date,endDate:w.end_date,createdBy:w.created_by});}));
      } catch(e) {
        console.error("Error cargando datos del servidor:", e);
        // Modo consulta sin internet (v1): si hay snapshot local, mostrar el
        // catálogo/clientes de la última sincronización en vez de pantalla vacía.
        var _hydrated = false;
        try {
          var _snap = JSON.parse(localStorage.getItem('mnpos-offline-cache') || 'null');
          if (_snap && _snap.products && _snap.products.length) {
            setProducts(_snap.products);
            setClients(_snap.clients || []);
            _hydrated = true;
            var _when = _snap.savedAt ? new Date(_snap.savedAt).toLocaleString('es-GT') : '';
            showFlash("📴 Sin conexión — mostrando datos de la última sincronización" + (_when ? " (" + _when + ")" : "") + ". No se pueden registrar operaciones hasta reconectar.", "warn");
          }
        } catch(_e) { /* snapshot corrupto o ausente */ }
        if (!_hydrated) {
          showFlash("⚠️ Error al conectar con el servidor. Verifica tu conexión e intenta recargar la página.","err");
        }
      }
      setLoaded(true);
    }
    loadAll();
  },[]);

  var _v=useState(function(){ return canAccess(session.role,"pos")?"pos":"dashboard"; }); var view=_v[0]; var setView=_v[1];
  var _fl=useState({msg:"",type:"ok"}); var flash=_fl[0]; var setFlash=_fl[1];
  var _ss=useState(null); var selSale=_ss[0]; var setSelSale=_ss[1];
  var _gs=useState(false); var gsOpen=_gs[0]; var setGsOpen=_gs[1];
  // deepLink: { search } para pre-filtrar pantallas al navegar desde otro módulo
  var _dl=useState(null); var deepLink=_dl[0]; var setDeepLink=_dl[1];

  // navTo(screen, params) — navega y pasa parámetros iniciales a la pantalla destino
  function navTo(screen, params) {
    setDeepLink(params || null);
    setView(screen);
  }

  // ── Push notifications ──
  var push = usePushNotifications(session);

  // ── Silent JWT refresh (7 min before expiry) ──
  useEffect(function() {
    var refreshTimer = null;
    function scheduleRefresh() {
      var rt = localStorage.getItem('mnpos-refresh-token');
      if (!rt) return;
      var msTillExpiry = session.expiresAt - Date.now();
      var delay = Math.max(msTillExpiry - 7 * 60 * 1000, 5000);
      refreshTimer = setTimeout(function() {
        import('./utils/session.js').then(function(m) {
          m.tryRefreshSession().then(function(newSession) {
            if (newSession) {
              var update = Object.assign({}, session, { token: newSession.token, expiresAt: newSession.expiresAt });
              sessionStorage.setItem('mnpos-session-v1', JSON.stringify(update));
            }
          });
        });
      }, delay);
    }
    scheduleRefresh();
    return function() { clearTimeout(refreshTimer); };
  }, [session.expiresAt]);

  // ── Timeout de inactividad ──
  var INACTIVITY_MS = 15 * 60 * 1000; // 15 minutos de inactividad
  var WARNING_SEC   = 60;           // segundos de cuenta regresiva antes de cerrar sesión
  var _tw=useState(false); var showWarning=_tw[0]; var setShowWarning=_tw[1];
  var _cd=useState(WARNING_SEC); var countdown=_cd[0]; var setCountdown=_cd[1];
  var inactivityTimer = React.useRef(null);
  var countdownTimer  = React.useRef(null);

  var resetInactivityTimer = useCallback(function(){
    if(showWarning) return;
    clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(function(){
      setShowWarning(true);
      setCountdown(WARNING_SEC);
    }, INACTIVITY_MS);
  }, [showWarning]);

  useEffect(function(){
    var events = ["mousemove","mousedown","keydown","touchstart","scroll","click"];
    events.forEach(function(e){ document.addEventListener(e, resetInactivityTimer, true); });
    resetInactivityTimer();
    return function(){
      events.forEach(function(e){ document.removeEventListener(e, resetInactivityTimer, true); });
      clearTimeout(inactivityTimer.current);
      clearInterval(countdownTimer.current);
    };
  }, [resetInactivityTimer]);

  useEffect(function(){
    if(!showWarning){ clearInterval(countdownTimer.current); return; }
    countdownTimer.current = setInterval(function(){
      setCountdown(function(c){
        if(c <= 1){
          clearInterval(countdownTimer.current);
          clearSession();
          onLogout();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return function(){ clearInterval(countdownTimer.current); };
  }, [showWarning]);

  function handleContinueSession(){
    setShowWarning(false);
    setCountdown(WARNING_SEC);
    clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(function(){
      setShowWarning(true);
      setCountdown(WARNING_SEC);
    }, INACTIVITY_MS);
  }

  var _ca=useState([]); var cart=_ca[0]; var setCart=_ca[1];
  var _pq=useState(""); var posQ=_pq[0]; var setPosQ=_pq[1];
  var _pm=useState("Efectivo"); var payMethod=_pm[0]; var setPayMethod=_pm[1];
  var _sm=useState(""); var secondMethod=_sm[0]; var setSecondMethod=_sm[1];
  var _sa=useState(""); var secondAmount=_sa[0]; var setSecondAmount=_sa[1];
  var _pt=useState("completo"); var payType=_pt[0]; var setPayType=_pt[1];
  var _ci=useState(""); var cashIn=_ci[0]; var setCashIn=_ci[1];
  var _ip=useState(""); var initialPay=_ip[0]; var setInitialPay=_ip[1];
  var _cn=useState(""); var clientName=_cn[0]; var setClientName=_cn[1];
  var _sci=useState(null); var selectedClientId=_sci[0]; var setSelectedClientId=_sci[1];
  var _sn=useState(""); var saleNote=_sn[0]; var setSaleNote=_sn[1];
  var _crep=useState(null); var cobrandoRepId=_crep[0]; var setCobrandoRepId=_crep[1];

  // Re-fetch de cuentas por cobrar (usado por el módulo de migración del cuaderno).
  async function reloadAccounts(){
    try{
      var freshAccs = await accountsAPI.getAll();
      var na=(freshAccs||[]).map(function(a){return Object.assign({},a,{items:a.account_items||[],payments:(a.account_payments||[]).map(function(_pp){return Object.assign({},_pp,{date:_pp.date||_pp.created_at,amount:Number(_pp.amount),registradoPor:_pp.registrado_por||_pp.registradoPor||null});}),total:Number(a.total),paid:Number(a.paid),balance:Number(a.balance),clientId:a.client_id,date:a.created_at,registradoPor:a.registrado_por||null});});
      setAccounts(na);
    }catch(_e){/* sin conexión: se refresca en la próxima carga */}
  }
  function showFlash(msg,type){
    setFlash({msg:msg,type:type||"ok"});
    setTimeout(function(){setFlash({msg:"",type:"ok"});},4000);
  }

  var filteredPOS=products.filter(function(p){
    if(!posQ)return true;
    var q=posQ.toLowerCase();
    return (p.name||"").toLowerCase().includes(q)||(p.code||"").toLowerCase().includes(q)||(p.shelf||"").toLowerCase().includes(q);
  });

  // Variantes por producto (color/capacidad): se consultan UNA vez y se cachean.
  var variantsCache = React.useRef({});
  var _vp=useState(null); var variantPick=_vp[0]; var setVariantPick=_vp[1];

  function pushCartLine(p, variant){
    var vLabel = variant ? [variant.color, variant.capacity].filter(Boolean).join(' ') : '';
    var name   = variant && vLabel ? p.name + ' (' + vLabel + ')' : p.name;
    var price  = variant && variant.price != null ? Number(variant.price) : p.price;
    var lineId = variant ? p.id + ':' + variant.id : p.id;
    setCart(function(c){
      var ex=c.find(function(i){return !i.serial_id && (i.lineId||i.id)===lineId;});
      if(ex) return ex.qty>=p.stock?c:c.map(function(i){return !i.serial_id&&(i.lineId||i.id)===lineId?Object.assign({},i,{qty:i.qty+1}):i;});
      return c.concat([{id:p.id,code:p.code,name:name,price:price,shelf:p.shelf,unit:p.unit,qty:1,maxStock:p.stock,lineId:lineId,variant_id:variant?variant.id:null}]);
    });
  }

  function addToCart(p){
    if(p.stock<=0&&p.unit!=="serv"){showFlash('⚠️ Sin stock: '+p.name,'warn');return;}
    if(p.serial_id){
      setCart(function(c){
        if(c.find(function(i){return i.serial_id===p.serial_id;})){showFlash('⚠️ Serial ya en carrito','warn');return c;}
        return c.concat([{id:p.id,code:p.code,name:p.name,price:p.price,shelf:p.shelf,unit:p.unit,qty:1,maxStock:1,serial_id:p.serial_id,imei:p.imei}]);
      });
      return;
    }
    // ¿Tiene variantes? (cacheado; si la consulta falla se agrega normal, sin bloquear la venta)
    var cached = variantsCache.current[p.id];
    if (cached === undefined && p.unit !== 'serv') {
      variantsAPI.list(p.id).then(function(vs){
        var act=(vs||[]).filter(function(v){return v.active!==false;});
        variantsCache.current[p.id]=act;
        if(act.length>0) setVariantPick({product:p,variants:act});
        else pushCartLine(p,null);
      }).catch(function(){ variantsCache.current[p.id]=[]; pushCartLine(p,null); });
      return;
    }
    if (cached && cached.length>0) { setVariantPick({product:p,variants:cached}); return; }
    pushCartLine(p,null);
  }
  // Identidad de LÍNEA del carrito: con seriales/IMEI puede haber varias líneas
  // del mismo producto (mismo id); la clave de línea es el serial si existe.
  function lineKey(i){ return i.serial_id||i.lineId||i.id; }
  function changeQty(key,d){ setCart(function(c){return c.map(function(i){return lineKey(i)===key?Object.assign({},i,{qty:Math.max(1,Math.min(i.qty+d,i.maxStock))}):i;});}); }
  function removeFromCart(key){ setCart(function(c){return c.filter(function(i){return lineKey(i)!==key;});}); }

  function applyDiscount(itemKey, newPrice){
    setCart(function(c){return c.map(function(i){
      if(lineKey(i)!==itemKey) return i;
      var orig=i.originalPrice||i.price;
      return Object.assign({},i,{
        price:newPrice,
        originalPrice:orig,
        discountBy:session.name,
        discountByRole:session.role,
        discountAt:new Date().toISOString()
      });
    });});
  }

  var cartTotal=cart.reduce(function(s,i){return s+i.price*i.qty;},0);
  var cashVal=parseFloat(cashIn)||0;
  var vuelto=payMethod==="Efectivo"&&payType==="completo"&&cashIn?cashVal-cartTotal:null;
  var ivaPercent=parseFloat((storeInfo&&storeInfo.iva_percent)||0)||0;
  var ivaAmount=ivaPercent>0?cartTotal-cartTotal/(1+ivaPercent/100):0;
  var subtotalNeto=cartTotal-ivaAmount;
  var initPaidVal=parseFloat(initialPay)||0;

  function resetPOS(){ setCart([]);setCashIn("");setClientName("");setInitialPay("");setPayType("completo");setPayMethod("Efectivo");setSecondMethod("");setSecondAmount("");setSelectedClientId(null);setSaleNote("");setCobrandoRepId(null); idemRef.current=null; variantsCache.current={}; }

  var checkoutInProgress=useRef(false);
  // Llave anti-duplicado del cobro: se genera UNA vez por carrito y se reusa en
  // los reintentos (si la primera venta sí entró pero la respuesta se perdió,
  // el reintento con la MISMA llave no duplica). Se limpia en resetPOS().
  var idemRef=useRef(null);
  async function checkout(){
    if(!cart.length)return;
    if(!clientName.trim()){showFlash("El nombre del cliente es obligatorio","err");return;}
    if(checkoutInProgress.current)return;
    // Sin internet: avisar de inmediato en vez de esperar el timeout (30s)
    if(typeof navigator!=="undefined" && navigator.onLine===false){
      showFlash("📴 Sin internet — no se puede cobrar hasta reconectar. El catálogo mostrado es de la última sincronización.","err");
      return;
    }
    // Pago dividido: el segundo monto debe ser mayor a 0 y menor al total
    if(secondMethod){
      var _segVal=parseFloat(secondAmount);
      if(!isFinite(_segVal)||_segVal<=0||_segVal>=cartTotal){showFlash("El monto del segundo método debe ser mayor a 0 y menor al total","err");return;}
    }
    checkoutInProgress.current=true;
    var client=clientName.trim();
    var items=cart.map(function(i){return {id:i.id,code:i.code,name:i.name,price:i.price,qty:i.qty,shelf:i.shelf,originalPrice:i.originalPrice||null,discountBy:i.discountBy||null,discountByRole:i.discountByRole||null,discountAt:i.discountAt||null};});
    var registradoPor={userId:session.userId,name:session.name,role:session.role};
    var nota=saleNote.trim()||null;
    function deduct(){ setProducts(function(p){return p.map(function(x){ if(x.unit==="serv")return x; var q=cart.reduce(function(acc,i){return i.id===x.id?acc+i.qty:acc;},0); return q>0?Object.assign({},x,{stock:x.stock-q}):x; }); }); }
    if(!idemRef.current) idemRef.current=gid()+"-"+Date.now();
    var idempotencyKey=idemRef.current;
    if(payType==="completo"){
      var _createdSale=null;
      try {
        _createdSale = await salesAPI.create({client:client,clientId:selectedClientId||null,total:cartTotal,method:payMethod,items:cart,nota:nota,idempotencyKey:idempotencyKey,ivaPct:ivaPercent,secondMethod:secondMethod||null,secondAmount:secondAmount?parseFloat(secondAmount):null,repairId:cobrandoRepId||null});
      } catch(e){
        var errMsg=e&&e.error?e.error:null;
        showFlash("⛔ "+(errMsg||"Error al registrar la venta. Verifica tu conexión."),"err");
        checkoutInProgress.current=false;
        return;
      }
      // Refresco APARTE: si falla, la venta YA esta confirmada (no mostrar error de venta ni permitir re-cobro)
      try {
        var freshSales = await salesAPI.getAll();
        var ns = (freshSales||[]).map(function(s){return Object.assign({},s,{items:s.sale_items||[],total:Number(s.total),date:s.created_at,registradoPor:s.registrado_por||null,payType:s.pay_type||'completo',status:s.status||'completado'});});
        setSales(ns);
      } catch(_re){ /* se refresca en la proxima carga */ }
      deduct();
      showFlash("✓ Venta cobrada — "+Q(cartTotal),"ok");
      if(offerReceipt){
        var _rsale={id:(_createdSale&&_createdSale.id)||idempotencyKey,client:client,total:cartTotal,method:payMethod,items:cart.slice(),date:(_createdSale&&_createdSale.created_at)||new Date().toISOString(),nota:nota,registradoPor:registradoPor};
        setPostSale({sale:_rsale,opts:{usuario:session.name,usuarioRole:session.role}});
      }
    } else {
      var paid=payType==="parcial"?Math.max(0,Math.min(initPaidVal,cartTotal)):0;
      var balance=cartTotal-paid;
      var _createdAcc=null;
      try{
        _createdAcc = await salesAPI.create({client:client,clientId:selectedClientId||null,total:cartTotal,method:payMethod,items:cart,payType:payType,initialPay:paid,nota:nota,idempotencyKey:idempotencyKey,ivaPct:ivaPercent,secondMethod:secondMethod||null,secondAmount:secondAmount?parseFloat(secondAmount):null,repairId:cobrandoRepId||null});
      }catch(e){
        var errMsg2=e&&e.error?e.error:null;
        showFlash("⛔ "+(errMsg2||"Error al registrar la cuenta. Verifica tu conexión."),"err");
        checkoutInProgress.current=false;
        return;
      }
      // Refresco APARTE: si falla, la cuenta YA esta confirmada (no tratar como error de cobro)
      try {
        var freshAccs = await accountsAPI.getAll();
        var na=(freshAccs||[]).map(function(a){return Object.assign({},a,{items:a.account_items||[],payments:(a.account_payments||[]).map(function(_pp){return Object.assign({},_pp,{date:_pp.date||_pp.created_at,amount:Number(_pp.amount),registradoPor:_pp.registrado_por||_pp.registradoPor||null});}),total:Number(a.total),paid:Number(a.paid),balance:Number(a.balance),clientId:a.client_id,date:a.created_at,registradoPor:a.registrado_por||null});});
        setAccounts(na);
        // También refrescar las ventas para que la venta a crédito aparezca al instante en el historial del cliente.
        var freshSales2 = await salesAPI.getAll();
        var ns2 = (freshSales2||[]).map(function(s){return Object.assign({},s,{items:s.sale_items||[],total:Number(s.total),date:s.created_at,registradoPor:s.registrado_por||null,payType:s.pay_type||'completo',status:s.status||'completado'});});
        setSales(ns2);
      }catch(_re){ /* se refresca en la proxima carga */ }
      deduct();
      showFlash(payType==="pendiente"?"⏳ Pendiente — "+Q(cartTotal)+" por cobrar":"💰 Abono "+Q(paid)+" — Saldo: "+Q(balance),"warn");
      if(offerReceipt){
        var _estado=payType==="pendiente"?"pendiente":"parcial";
        var _rsale2={id:(_createdAcc&&_createdAcc.id)||idempotencyKey,client:client,total:cartTotal,method:payMethod,items:cart.slice(),date:new Date().toISOString(),nota:nota,registradoPor:registradoPor,paid:paid,balance:balance};
        setPostSale({sale:_rsale2,opts:{usuario:session.name,usuarioRole:session.role,estado:_estado,abonoHoy:payType==="parcial"?paid:null,pagado:paid,saldo:balance}});
      }
    }
    // Si la venta provino de una reparación, marcarla como entregada para que no se cobre de nuevo
    if(cobrandoRepId){ try{ await updateRepairStatus(cobrandoRepId,'entregado'); }catch(_e){ /* no bloquear el cierre de venta */ } }
    resetPOS();
    checkoutInProgress.current=false;
  }

  async function addPayment(accountId,amount,method,note,idempotencyKey){
    try{
      await accountsAPI.addPayment(accountId,{amount:amount,method:method||'Efectivo',note:note||'',idempotencyKey:idempotencyKey||gid()});
      var freshAccs2 = await accountsAPI.getAll();
      var na2=(freshAccs2||[]).map(function(a){return Object.assign({},a,{items:a.account_items||[],payments:(a.account_payments||[]).map(function(_pp){return Object.assign({},_pp,{date:_pp.date||_pp.created_at,amount:Number(_pp.amount),registradoPor:_pp.registrado_por||_pp.registradoPor||null});}),total:Number(a.total),paid:Number(a.paid),balance:Number(a.balance),clientId:a.client_id,date:a.created_at,registradoPor:a.registrado_por||null});});
      setAccounts(na2);
      showFlash("✓ Pago registrado","ok");
      // Ofrecer comprobante de abono (reutiliza el modal post-venta — E1)
      var _acc=na2.find(function(a){return a.id===accountId;});
      if(_acc){
        setPostSale({
          sale:{id:_acc.id,client:_acc.client,total:Number(_acc.total),method:method||"Efectivo",items:_acc.items||[],date:new Date().toISOString(),registradoPor:{userId:session.userId,name:session.name,role:session.role},paid:Number(_acc.paid),balance:Number(_acc.balance)},
          opts:{usuario:session.name,usuarioRole:session.role,estado:Number(_acc.balance)<=0.009?"pagado":"parcial",abonoHoy:Number(amount),pagado:Number(_acc.paid),saldo:Number(_acc.balance),docType:"abono",docLabel:"Comprobante de Abono"}
        });
      }
      return true;
    }catch(e){
      var em=e&&e.error?e.error:null;
      showFlash("⛔ "+(em||"Error al registrar el pago. Verifica tu conexión."),"err");
      return false;
    }
  }

  async function processReturn(data){
    var total=(data.items||[]).reduce(function(s,i){return s+i.price*i.qty;},0);
    var newId=gid();
    var registradoPor={userId:session.userId,name:session.name,role:session.role};
    var ret=Object.assign({},data,{id:newId,date:new Date().toISOString(),total:total,registradoPor:registradoPor});

    try{
      await returnsAPI.create({
        client:data.client,
        clientId:data.clientId||null,
        saleId:data.saleId||null,
        reason:data.reason,
        refundMethod:data.refundMethod,
        refundAmount:data.refundAmount,
        itemCondition:data.itemCondition,
        items:data.items
      });
      var [freshRets, freshDefs, freshProds] = await Promise.all([
        returnsAPI.getAll(),
        defectivesAPI.getAll(),
        productsAPI.getAll(),
      ]);
      // 'Credito en cuenta' reduce la deuda en el servidor -> refrescar Cuentas al instante
      if (data.refundMethod === 'Crédito en cuenta') { reloadAccounts(); }
      setReturns((freshRets||[]).map(function(r){return Object.assign({},r,{items:r.return_items||[],refundAmount:Number(r.refund_amount),itemCondition:r.item_condition,refundMethod:r.refund_method,date:r.created_at,saleId:r.sale_id||null,registradoPor:r.registrado_por||null});}));
      setDefectives((freshDefs||[]).map(function(d){return Object.assign({},d,{price:Number(d.price||0),date:d.created_at});}));
      setProducts((freshProds||[]).map(function(p){return Object.assign({},p,{price:Number(p.price),cost:Number(p.cost),stock:Number(p.stock)});}));
    }catch(e){
      var emR=e&&e.error?e.error:null;
      showFlash("⛔ "+(emR||"Error al registrar la devolución. Verifica tu conexión."),"err");
      return;
    }
    var msg=data.itemCondition==="bueno"
        ?"🔄 Devolución registrada — artículo reintegrado al stock"
        :"🔄 Devolución registrada — artículo enviado a Piezas Defectuosas";
    showFlash(msg,"ok");
    // Ofrecer comprobante de devolución (reutiliza el modal post-venta — E2)
    setPostSale({
      sale:{id:newId,client:data.client||"Cliente",total:Number(data.refundAmount||total),method:data.refundMethod||"Efectivo",items:(data.items||[]),date:new Date().toISOString(),registradoPor:registradoPor},
      opts:{usuario:session.name,usuarioRole:session.role,docType:"devolucion",docLabel:"Comprobante de Devolución",tipo:"devolucion",verifyId:data.saleId||null}
    });
  }

  async function updateDefectiveStatus(id,status){
    try{
      await defectivesAPI.update(id,status);
      var freshDefs = await defectivesAPI.getAll();
      setDefectives((freshDefs||[]).map(function(d){return Object.assign({},d,{price:Number(d.price||0),date:d.created_at});}));
      if(status==="reingresado"){
        var freshProds2 = await productsAPI.getAll();
        setProducts((freshProds2||[]).map(function(p){return Object.assign({},p,{price:Number(p.price),cost:Number(p.cost),stock:Number(p.stock)});}));
      }
    }catch(e){
      var emD=e&&e.error?e.error:null;
      showFlash("⛔ "+(emD||"Error al actualizar. Verifica tu conexión."),"err");
    }
  }

  async function reingresarDefective(id){
    await updateDefectiveStatus(id,'reingresado');
    showFlash("✅ Pieza reingresada al inventario","ok");
  }
  async function saveProduct(prod){
    var isNew=!prod.id;
    // Normalización de segunda capa — por si llega desde otro flujo (importación, etc.)
    function tc(s){ s=(s||"").trim(); return s.charAt(0).toUpperCase()+s.slice(1); }
    var clean={
      code:        (prod.code||"").trim().toUpperCase(),
      name:        tc(prod.name||""),
      category:    tc(prod.category||""),
      category_id: prod.category_id||null,
      location_id: prod.location_id||null,
      position:    (prod.position||"").trim()||null,
      shelf:       (prod.shelf||"").trim(),
      price:       prod.price||0,
      cost:        prod.cost||0,
      stock:       prod.stock||0,
      unit:        prod.unit||"uni",
    };
    try{
      if(!isNew){
        await productsAPI.update(prod.id,clean);
        setProducts(function(p){return p.map(function(x){return x.id===prod.id?Object.assign({},prod,clean):x;});});
      } else {
        var saved=await productsAPI.create(clean);
        setProducts(function(p){return p.concat([Object.assign({},prod,clean,{id:saved.id})]);});
      }
    }catch(e){
      var emP=e&&e.error?e.error:null;
      showFlash("⛔ "+(emP||"Error al guardar el producto. Verifica tu conexión."),"err");
    }
  }
  async function deleteProduct(id){
    try{
      await productsAPI.remove(id);
      setProducts(function(p){return p.filter(function(x){return x.id!==id;});});
      showFlash("Producto eliminado","ok");
    }catch(e){
      var emDel=e&&e.error?e.error:null;
      showFlash("⛔ "+(emDel||"Error al eliminar. Verifica tu conexión."),"err");
    }
  }

  function reloadCatalogos(){
    categoriesAPI.getAll().then(function(c){setCategories(c||[]);}).catch(function(){});
    locationsAPI.getAll().then(function(l){setLocations(l||[]);}).catch(function(){});
  }

  async function importProducts(prods, rowErrs, callback){
    var count=0; var catsCreated=0; var importErrors=[];
    var catCache={};
    categories.forEach(function(c){ catCache[c.name.toLowerCase()]=c.id; });

    for(var i=0;i<prods.length;i++){
      var prod=prods[i];
      try{
        var catId=null;
        var catName=(prod.category||"").trim();
        if(catName){
          var catKey=catName.toLowerCase();
          if(catCache[catKey]){
            catId=catCache[catKey];
          } else {
            try{
              var newCat=await categoriesAPI.create({name:catName});
              catCache[catKey]=newCat.id;
              catId=newCat.id;
              catsCreated++;
              setCategories(function(c){return c.concat([newCat]);});
            }catch(ce){
              var freshCats=await categoriesAPI.getAll();
              var found=(freshCats||[]).find(function(c){return c.name.toLowerCase()===catKey;});
              if(found){ catCache[catKey]=found.id; catId=found.id; setCategories(freshCats); }
            }
          }
        }
        var savedImp=await productsAPI.create({
          name:prod.name, category:catName, category_id:catId,
          shelf:prod.shelf||"", price:prod.price,
          cost:prod.cost||0, stock:0, unit:prod.unit||"uni",
          min_stock: prod.min_stock || prod.minStock || 5,
        });
        // Llevar el stock al valor real y registrar el movimiento inicial.
        // Si falla, reflejar 0 en pantalla y AVISAR (antes se tragaba el error y la
        // pantalla mostraba stock que la BD no tenia).
        var _stockFinal = 0;
        if((prod.stock||0)>0){
          try{ await productsAPI.adjustStock(savedImp.id,{new_stock:prod.stock,reason:"Carga inicial por importación Excel"}); _stockFinal=prod.stock; }
          catch(se){ importErrors.push("("+prod.name+"): guardado pero el stock inicial no se aplicó — ajustalo manualmente"); }
        }
        setProducts(function(p){return p.concat([Object.assign({},prod,{id:savedImp.id,code:savedImp.code,category_id:catId,stock:_stockFinal})]);});
        count++;
      }catch(e){
        console.warn("Error importando:",prod.name,e);
        importErrors.push("("+prod.name+"): "+((e&&e.message)||"error al guardar"));
      }
    }
    if(callback) callback(count,catsCreated,importErrors);
    var msg="✅ "+count+" productos importados";
    if(catsCreated>0) msg+=" ("+catsCreated+" categorías nuevas)";
    var allW=(rowErrs||[]).length+importErrors.length;
    if(allW>0) msg+=" — ⚠️ "+allW+" aviso(s)";
    showFlash(msg,count>0?"ok":"warn");
  }

  async function saveWarranty(data){
    try{
      var w=await warrantiesAPI.create(data);
      setWarranties(function(p){return [Object.assign({},w,{entityType:w.entity_type,entityId:w.entity_id,startDate:w.start_date,endDate:w.end_date})].concat(p);});
      showFlash("✅ Garantía registrada","ok");
      return w;
    }catch(e){ showFlash("⛔ "+((e&&e.error)||"Error registrando garantía"),"err"); }
  }

  async function updateWarranty(id, data){
    try{
      var w=await warrantiesAPI.update(id, data);
      setWarranties(function(p){return p.map(function(x){return x.id===id?Object.assign({},x,w,{entityType:w.entity_type||x.entityType,entityId:w.entity_id||x.entityId,startDate:w.start_date||x.startDate,endDate:w.end_date||x.endDate}):x;});});
      showFlash("✅ Garantía actualizada","ok");
    }catch(e){ showFlash("⛔ "+((e&&e.error)||"Error actualizando garantía"),"err"); }
  }

  async function saveRepair(rep){
    try{
      await repairsAPI.create({id:rep.id,repCode:rep.repCode,clientId:rep.clientId||null,clientName:rep.clientName,clientPhone:rep.clientPhone||null,clientCli:rep.clientCli||null,brand:rep.brand,model:rep.model,imei:rep.imei||null,problemDesc:rep.problemDesc,diagnosis:rep.diagnosis||null,techName:rep.techName||null,estimatedCost:rep.estimatedCost||0,promisedDate:rep.promisedDate||null,internalNote:rep.internalNote||null,status:rep.status||'recibido',registradoPor:rep.registradoPor||{},parts:rep.parts||[],receptionChecklist:rep.receptionChecklist||null,receptionPhotos:null,createdAt:rep.createdAt});
      var fr=await repairsAPI.getAll();
      setRepairs((fr||[]).map(function(r){return Object.assign({},r,{repCode:r.rep_code,clientId:r.client_id,clientName:r.client_name,clientPhone:r.client_phone,clientCli:r.client_cli,problemDesc:r.problem_desc,techName:r.tech_name,estimatedCost:Number(r.estimated_cost||0),promisedDate:r.promised_date,internalNote:r.internal_note,registradoPor:r.registrado_por||{},parts:r.parts||[],createdAt:r.created_at,finalCost:r.final_cost!=null?Number(r.final_cost):null,receptionChecklist:r.reception_checklist||null,receptionPhotos:r.reception_photos||[],deliveryPhotos:r.delivery_photos||[]});}));
      return true;
    }catch(e){
      var emRep=e&&e.error?e.error:null;
      showFlash("⛔ "+(emRep||"Error al guardar la reparación. Verifica tu conexión."),"err");
      return false;
    }
  }
  async function updateRepairStatus(id, status){
    try{
      await repairsAPI.updateStatus(id, status);
      var fr2=await repairsAPI.getAll();
      setRepairs((fr2||[]).map(function(r){return Object.assign({},r,{repCode:r.rep_code,clientId:r.client_id,clientName:r.client_name,clientPhone:r.client_phone,clientCli:r.client_cli,problemDesc:r.problem_desc,techName:r.tech_name,estimatedCost:Number(r.estimated_cost||0),promisedDate:r.promised_date,internalNote:r.internal_note,registradoPor:r.registrado_por||{},parts:r.parts||[],createdAt:r.created_at,finalCost:r.final_cost!=null?Number(r.final_cost):null,receptionChecklist:r.reception_checklist||null,receptionPhotos:r.reception_photos||[],deliveryPhotos:r.delivery_photos||[]});}));
    }catch(e){
      var emRS=e&&e.error?e.error:null;
      showFlash("⛔ "+(emRS||"Error al actualizar la reparación. Verifica tu conexión."),"err");
    }
  }
  function cobrarReparacion(rep){
    // Monto a cobrar: costo final si está definido, si no el estimado (Opción A)
    var monto=parseFloat(rep.finalCost)||parseFloat(rep.estimatedCost)||0;
    if(monto<=0){
      showFlash("⚠ Esta reparación no tiene monto. Editá el 'Costo final cobrado' antes de cobrar.","warn");
      return false;
    }
    // Carga una sola línea de servicio con el monto de la reparación (no obliga a elegir producto)
    setClientName(rep.clientName);
    setSelectedClientId(rep.clientId||null);
    setSaleNote("Reparación "+rep.repCode+" — "+rep.brand+" "+rep.model);
    setCobrandoRepId(rep.id);
    setCart([{id:gid(),code:rep.repCode||"REP",name:"Reparación — "+rep.brand+" "+rep.model,price:monto,qty:1,shelf:"",unit:"serv",maxStock:999}]);
    setView("pos");
    showFlash("✓ Reparación "+rep.repCode+" cargada (Q"+monto.toFixed(2)+")","ok");
    return true;
  }
  async function reloadRepairs(){
    try{
      var fr=await repairsAPI.getAll();
      setRepairs((fr||[]).map(function(r){return Object.assign({},r,{repCode:r.rep_code,clientId:r.client_id,clientName:r.client_name,clientPhone:r.client_phone,clientCli:r.client_cli,problemDesc:r.problem_desc,techName:r.tech_name,estimatedCost:Number(r.estimated_cost||0),promisedDate:r.promised_date,internalNote:r.internal_note,registradoPor:r.registrado_por||{},parts:r.parts||[],createdAt:r.created_at,finalCost:r.final_cost!=null?Number(r.final_cost):null,receptionChecklist:r.reception_checklist||null,receptionPhotos:r.reception_photos||[],deliveryPhotos:r.delivery_photos||[]});}));
    }catch(e){ /* silencioso */ }
  }

  async function saveClient(obj, isEdit){
    try{
      var cliData={cliCode:obj.cliCode,name:obj.name,dpi:obj.dpi||null,nit:obj.nit||"CF",phone:obj.phone||null,address:obj.address||null,email:obj.email||null,active:obj.active!==false};
      if(isEdit){ await clientsAPI.update(obj.id,cliData); }
      else { await clientsAPI.create(Object.assign({},cliData,{id:obj.id,active:true,createdAt:obj.createdAt})); }
      var fc=await clientsAPI.getAll();
      setClients((fc||[]).map(function(c){return Object.assign({},c,{cliCode:c.cli_code,createdAt:c.created_at});}));
    }catch(e){
      var emC=e&&e.error?e.error:null;
      showFlash("⛔ "+(emC||"Error al guardar el cliente. Verifica tu conexión."),"err");
    }
  }

  async function exportJSON(){
    var now=new Date();
    var CFG={timeout:60000};
    var failed=[];
    function grab(name,promise){ return promise.catch(function(){ failed.push(name); return null; }); }
    var r=await Promise.all([
      grab("Productos",   productsAPI.getAll(CFG)),
      grab("Ventas",      salesAPI.getAll(CFG)),
      grab("Cuentas",     accountsAPI.getAll(CFG)),
      grab("Devoluciones",returnsAPI.getAll(CFG)),
      grab("Defectuosos", defectivesAPI.getAll(CFG)),
      grab("Clientes",    clientsAPI.getAll(CFG)),
      grab("Reparaciones",repairsAPI.getAll(CFG)),
      grab("Garantías",   warrantiesAPI.getAll(CFG)),
      grab("Proveedores", suppliersAPI.getAll(CFG)),
      grab("Compras",     suppliersAPI.getPurchases(CFG)),
    ]);
    if(failed.length===r.length){
      showFlash("⛔ No se pudo conectar con el servidor. Revisá tu internet e intentá de nuevo.","err");
      throw new Error("backup-fetch-failed");
    }
    var prods=r[0]||[],sls=r[1]||[],accs=r[2]||[],rets=r[3]||[],defs=r[4]||[],clis=r[5]||[],reps=r[6]||[],wars=r[7]||[],sups=r[8]||[],purs=r[9]||[];
    var data={version:"2.2",exportDate:now.toISOString(),negocio:getStore().store_name||STORE_FALLBACK,incomplete:failed.length>0?failed:undefined,products:prods,sales:sls,accounts:accs,returns:rets,defectives:defs,clients:clis,repairs:reps,warranties:wars,suppliers:sups,purchases:purs};
    var blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    var url=URL.createObjectURL(blob);
    var a=document.createElement("a");a.href=url;a.download=(getStore().store_name||"backup").replace(/\s+/g,"_")+"_"+now.toISOString().slice(0,10)+".json";
    document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
    localStorage.setItem("mnpos-last-backup",now.toISOString());
  }

  async function exportExcel(){
    var now = new Date();
    var CFG = { timeout: 90000 };
    var failed = [];
    function grab(name, promise){ return promise.catch(function(){ failed.push(name); return null; }); }

    var results = await Promise.all([
      grab("Productos",    productsAPI.getAll(CFG)),
      grab("Ventas",       salesAPI.getAll(CFG)),
      grab("Cuentas",      accountsAPI.getAll(CFG)),
      grab("Devoluciones", returnsAPI.getAll(CFG)),
      grab("Defectuosos",  defectivesAPI.getAll(CFG)),
      grab("Clientes",     clientsAPI.getAll(CFG)),
      grab("Reparaciones", repairsAPI.getAll(CFG)),
      grab("Garantías",    warrantiesAPI.getAll(CFG)),
      grab("Proveedores",  suppliersAPI.getAll(CFG)),
      grab("Compras",      suppliersAPI.getPurchases(CFG)),
      grab("Usuarios",     usersAPI.getAll(CFG)),
      grab("Caja",         cajaAPI.getSesiones()),
    ]);

    if(failed.length === results.length){
      showFlash("⛔ No se pudo conectar con el servidor. Verificá tu internet e intentá de nuevo.","err");
      throw new Error("backup-failed");
    }

    var prods  = results[0]  || [];
    var sls    = results[1]  || [];
    var accs   = results[2]  || [];
    var rets   = results[3]  || [];
    var defs   = results[4]  || [];
    var clis   = results[5]  || [];
    var reps   = results[6]  || [];
    var wars   = results[7]  || [];
    var sups   = results[8]  || [];
    var purs   = results[9]  || [];
    var usrs   = results[10] || [];
    var caja   = results[11] || [];

    var wb = XLSX.utils.book_new();
    var storeName = getStore().store_name || STORE_FALLBACK;
    function mkSheet(data) {
      var ws = XLSX.utils.aoa_to_sheet(data);
      ws['!views'] = [{ state: 'normal', topLeftCell: 'A1', activeCell: 'A1' }];
      return ws;
    }

    // ── Totales para el resumen ──
    var totalVentas     = sls.reduce(function(s,x){ return s+Number(x.total||0); }, 0);
    var pendAcc         = accs.filter(function(a){ return a.status !== "pagado"; });
    var totalPorCobrar  = pendAcc.reduce(function(s,a){ return s+Number(a.balance||0); }, 0);
    var totalReemb      = rets.reduce(function(s,r){ return s+Number(r.refund_amount||0); }, 0);
    var totalCompras    = purs.reduce(function(s,p){ return s+Number(p.total||0); }, 0);
    var valorInventario = prods.reduce(function(s,p){ return s+Number(p.cost||0)*Number(p.stock||0); }, 0);
    var repsActivas     = reps.filter(function(r){ return r.status !== "entregado"; }).length;

    // ══════════════════════════════════════════════════════════════
    //  HOJA 1 — RESUMEN
    // ══════════════════════════════════════════════════════════════
    var resumenData = [
      [storeName + " — Respaldo Completo"],
      ["Generado:", fmtD(now) + " " + fmtT(now)],
      [],
      ["MÓDULO", "REGISTROS", "DETALLE", "ESTADO"],
      ["Productos",          prods.length,    "Valor inventario (costo): Q " + valorInventario.toFixed(2),    failed.indexOf("Productos")    >= 0 ? "⚠ FALLÓ" : "OK"],
      ["Clientes",           clis.length,     "",                                                               failed.indexOf("Clientes")     >= 0 ? "⚠ FALLÓ" : "OK"],
      ["Ventas",             sls.length,      "Total vendido: Q " + totalVentas.toFixed(2),                    failed.indexOf("Ventas")       >= 0 ? "⚠ FALLÓ" : "OK"],
      ["Cuentas por cobrar", pendAcc.length,  "Saldo pendiente: Q " + totalPorCobrar.toFixed(2),               failed.indexOf("Cuentas")      >= 0 ? "⚠ FALLÓ" : "OK"],
      ["Devoluciones",       rets.length,     "Total reembolsado: Q " + totalReemb.toFixed(2),                 failed.indexOf("Devoluciones") >= 0 ? "⚠ FALLÓ" : "OK"],
      ["Reparaciones",       reps.length,     "En proceso: " + repsActivas,                                    failed.indexOf("Reparaciones") >= 0 ? "⚠ FALLÓ" : "OK"],
      ["Garantías",          wars.length,     "",                                                               failed.indexOf("Garantías")    >= 0 ? "⚠ FALLÓ" : "OK"],
      ["Proveedores",        sups.length,     "",                                                               failed.indexOf("Proveedores")  >= 0 ? "⚠ FALLÓ" : "OK"],
      ["Compras",            purs.length,     "Total comprado: Q " + totalCompras.toFixed(2),                  failed.indexOf("Compras")      >= 0 ? "⚠ FALLÓ" : "OK"],
      ["Piezas defectuosas", defs.length,     "",                                                               failed.indexOf("Defectuosos")  >= 0 ? "⚠ FALLÓ" : "OK"],
      ["Usuarios del sistema",usrs.length,    "",                                                               failed.indexOf("Usuarios")     >= 0 ? "⚠ FALLÓ" : "OK"],
      ["Sesiones de caja",   caja.length,     "",                                                               failed.indexOf("Caja")         >= 0 ? "⚠ FALLÓ" : "OK"],
    ];
    if(failed.length > 0){
      resumenData.push([]);
      resumenData.push(["⚠ MÓDULOS CON FALLO (respaldá de nuevo después de revisar tu conexión):"]);
      resumenData.push([failed.join(", ")]);
    }
    XLSX.utils.book_append_sheet(wb, mkSheet(resumenData), "Resumen");

    // ══════════════════════════════════════════════════════════════
    //  HOJA 2 — PRODUCTOS
    //  Campos DB: code, name, category, shelf, unit, stock, min_stock, price, cost
    // ══════════════════════════════════════════════════════════════
    var prodRows = [["Código","Nombre","Categoría","Estantería","Unidad","Stock","Stock mínimo","Precio venta (Q)","Costo (Q)","Margen %","Valor en stock (Q)"]];
    prods.slice().sort(function(a,b){ return (a.code||"").localeCompare(b.code||""); }).forEach(function(p){
      var esServ = p.unit === "serv";
      var mg = (!esServ && Number(p.price) > 0 && Number(p.cost) > 0) ? Math.round((p.price - p.cost) / p.price * 100) + "%" : "N/A";
      prodRows.push([
        p.code || "", p.name || "", p.category || "", p.shelf || "",
        esServ ? "Servicio" : "Unidad",
        esServ ? "—" : Number(p.stock || 0),
        esServ ? "—" : Number(p.min_stock || 0),
        Number(p.price || 0).toFixed(2),
        Number(p.cost || 0).toFixed(2),
        mg,
        esServ ? "—" : (Number(p.cost || 0) * Number(p.stock || 0)).toFixed(2),
      ]);
    });
    XLSX.utils.book_append_sheet(wb, mkSheet(prodRows), "Productos");

    // ══════════════════════════════════════════════════════════════
    //  HOJA 3 — VENTAS (cabecera)
    //  Campos DB: id, created_at, client, method, total, status, registrado_por {name,role}
    // ══════════════════════════════════════════════════════════════
    var ventasRows = [["ID","Fecha","Hora","Cliente","Tipo","Método pago","Total (Q)","Estado","Registrado por","Rol"]];
    sls.forEach(function(s){
      var rp = s.registrado_por || {};
      var tipo = s.pay_type === 'credito' ? 'Crédito' : s.pay_type === 'parcial' ? 'Crédito parcial' : 'Contado';
      var estado = s.status === 'cuenta' ? 'Por cobrar' : s.status === 'completado' ? 'Completado' : (s.status || '');
      ventasRows.push([
        s.id || "", fmtD(s.created_at), fmtT(s.created_at),
        s.client || "", tipo, s.method || "", Number(s.total || 0).toFixed(2),
        estado, rp.name || "", rp.role || "",
      ]);
    });
    XLSX.utils.book_append_sheet(wb, mkSheet(ventasRows), "Ventas");

    // ══════════════════════════════════════════════════════════════
    //  HOJA 4 — DETALLE DE VENTAS (artículo por artículo)
    //  sale_items: sale_id, code, name, price, qty, subtotal
    // ══════════════════════════════════════════════════════════════
    var detalleVentasRows = [["ID Venta","Fecha","Cliente","Código producto","Producto","Cant.","Precio unit. (Q)","Subtotal (Q)"]];
    sls.forEach(function(s){
      var items = s.sale_items || [];
      items.forEach(function(it){
        detalleVentasRows.push([
          s.id || "", fmtD(s.created_at), s.client || "",
          it.code || "", it.name || "", Number(it.qty || 0),
          Number(it.price || 0).toFixed(2),
          Number(it.subtotal || (it.price * it.qty) || 0).toFixed(2),
        ]);
      });
    });
    XLSX.utils.book_append_sheet(wb, mkSheet(detalleVentasRows), "Detalle Ventas");

    // ══════════════════════════════════════════════════════════════
    //  HOJA 5 — CUENTAS POR COBRAR
    //  Campos DB: id, created_at, client, total, paid, balance, status, method, registrado_por
    // ══════════════════════════════════════════════════════════════
    var cuentasRows = [["ID","Fecha","Hora","Cliente","Total (Q)","Pagado (Q)","Saldo (Q)","Estado","Método","Registrado por"]];
    accs.forEach(function(a){
      var rp = a.registrado_por || {};
      cuentasRows.push([
        a.id || "", fmtD(a.created_at), fmtT(a.created_at),
        a.client || "", Number(a.total || 0).toFixed(2),
        Number(a.paid || 0).toFixed(2), Number(a.balance || 0).toFixed(2),
        a.status || "", a.method || "", rp.name || "",
      ]);
    });
    XLSX.utils.book_append_sheet(wb, mkSheet(cuentasRows), "Cuentas");

    // ══════════════════════════════════════════════════════════════
    //  HOJA 6 — ARTÍCULOS DE CUENTAS
    //  account_items: account_id, code, name, price, qty
    // ══════════════════════════════════════════════════════════════
    var artCuentasRows = [["ID Cuenta","Cliente","Código producto","Producto","Precio (Q)","Cant.","Subtotal (Q)"]];
    accs.forEach(function(a){
      var items = a.account_items || [];
      items.forEach(function(it){
        artCuentasRows.push([
          a.id || "", a.client || "", it.code || "", it.name || "",
          Number(it.price || 0).toFixed(2), Number(it.qty || 0),
          (Number(it.price || 0) * Number(it.qty || 0)).toFixed(2),
        ]);
      });
    });
    XLSX.utils.book_append_sheet(wb, mkSheet(artCuentasRows), "Artículos Cuentas");

    // ══════════════════════════════════════════════════════════════
    //  HOJA 7 — HISTORIAL DE PAGOS / ABONOS
    //  account_payments: account_id, amount, method, note, created_at, registrado_por
    // ══════════════════════════════════════════════════════════════
    var pagosRows = [["ID Cuenta","Cliente","Fecha pago","Hora","Monto (Q)","Método","Nota","Registrado por"]];
    accs.forEach(function(a){
      var pmts = a.account_payments || [];
      pmts.forEach(function(p){
        var rp = p.registrado_por || {};
        pagosRows.push([
          a.id || "", a.client || "", fmtD(p.created_at), fmtT(p.created_at),
          Number(p.amount || 0).toFixed(2), p.method || "", p.note || "", rp.name || "",
        ]);
      });
    });
    XLSX.utils.book_append_sheet(wb, mkSheet(pagosRows), "Historial Pagos");

    // ══════════════════════════════════════════════════════════════
    //  HOJA 8 — DEVOLUCIONES
    //  Campos DB: id, created_at, client, sale_id, reason, refund_method, refund_amount, item_condition, total
    // ══════════════════════════════════════════════════════════════
    var devRows = [["ID","Fecha","Hora","Cliente","ID Venta origen","Motivo","Condición","Método reembolso","Monto reembolso (Q)","Total artículos (Q)"]];
    rets.forEach(function(r){
      devRows.push([
        r.id || "", fmtD(r.created_at), fmtT(r.created_at), r.client || "",
        r.sale_id || "—", r.reason || "", r.item_condition || "",
        r.refund_method || "", Number(r.refund_amount || 0).toFixed(2),
        Number(r.total || 0).toFixed(2),
      ]);
    });
    XLSX.utils.book_append_sheet(wb, mkSheet(devRows), "Devoluciones");

    // ══════════════════════════════════════════════════════════════
    //  HOJA 9 — ARTÍCULOS DE DEVOLUCIONES
    //  return_items: return_id, code, name, price, qty
    // ══════════════════════════════════════════════════════════════
    var artDevRows = [["ID Devolución","Cliente","Código producto","Producto","Precio (Q)","Cant.","Subtotal (Q)"]];
    rets.forEach(function(r){
      var items = r.return_items || [];
      items.forEach(function(it){
        artDevRows.push([
          r.id || "", r.client || "", it.code || "", it.name || "",
          Number(it.price || 0).toFixed(2), Number(it.qty || 0),
          (Number(it.price || 0) * Number(it.qty || 0)).toFixed(2),
        ]);
      });
    });
    XLSX.utils.book_append_sheet(wb, mkSheet(artDevRows), "Artículos Devoluciones");

    // ══════════════════════════════════════════════════════════════
    //  HOJA 10 — CLIENTES
    //  Campos DB: cli_code, name, dpi, phone, address, active, created_at
    // ══════════════════════════════════════════════════════════════
    var cliRows = [["Código","Nombre","DPI","Teléfono","Dirección","Activo","Fecha registro"]];
    clis.forEach(function(c){
      cliRows.push([
        c.cli_code || "", c.name || "", c.dpi || "", c.phone || "",
        c.address || "", c.active ? "Sí" : "No", fmtD(c.created_at),
      ]);
    });
    XLSX.utils.book_append_sheet(wb, mkSheet(cliRows), "Clientes");

    // ══════════════════════════════════════════════════════════════
    //  HOJA 11 — REPARACIONES
    //  Campos DB: rep_code, created_at, client_name, client_phone, brand, model,
    //             imei, problem_desc, diagnosis, tech_name, estimated_cost,
    //             promised_date, internal_note, status, parts
    // ══════════════════════════════════════════════════════════════
    var repRows = [["Código","Fecha","Hora","Cliente","Teléfono","Marca","Modelo","IMEI","Problema","Diagnóstico","Técnico","Costo estimado (Q)","Fecha prometida","Nota interna","Estado"]];
    reps.forEach(function(r){
      repRows.push([
        r.rep_code || "", fmtD(r.created_at), fmtT(r.created_at),
        r.client_name || "", r.client_phone || "",
        r.brand || "", r.model || "", r.imei || "",
        r.problem_desc || "", r.diagnosis || "", r.tech_name || "",
        Number(r.estimated_cost || 0).toFixed(2),
        r.promised_date || "", r.internal_note || "", r.status || "",
      ]);
    });
    XLSX.utils.book_append_sheet(wb, mkSheet(repRows), "Reparaciones");

    // ══════════════════════════════════════════════════════════════
    //  HOJA 12 — GARANTÍAS
    //  Campos DB: id, entity_type, entity_id, client, description, start_date, end_date, status
    // ══════════════════════════════════════════════════════════════
    var warRows = [["ID","Tipo","ID entidad","Cliente","Descripción","Inicio","Vencimiento","Estado"]];
    wars.forEach(function(w){
      warRows.push([
        w.id || "", w.entity_type || "", w.entity_id || "",
        w.client || "", w.description || "",
        w.start_date || "", w.end_date || "", w.status || "",
      ]);
    });
    XLSX.utils.book_append_sheet(wb, mkSheet(warRows), "Garantías");

    // ══════════════════════════════════════════════════════════════
    //  HOJA 13 — PIEZAS DEFECTUOSAS
    //  Campos DB: id, created_at, code, name, qty, price, reason, status, return_id
    // ══════════════════════════════════════════════════════════════
    var defRows = [["ID","Fecha","Código","Pieza / Producto","Cant.","Precio (Q)","Motivo","Estado","ID Devolución origen"]];
    defs.forEach(function(d){
      defRows.push([
        d.id || "", fmtD(d.created_at), d.code || "", d.name || "",
        Number(d.qty || 0), Number(d.price || 0).toFixed(2),
        d.reason || "", d.status || "", d.return_id || "—",
      ]);
    });
    XLSX.utils.book_append_sheet(wb, mkSheet(defRows), "Piezas Defectuosas");

    // ══════════════════════════════════════════════════════════════
    //  HOJA 14 — PROVEEDORES
    //  Campos DB: name, phone, email, address, notes
    // ══════════════════════════════════════════════════════════════
    var supRows = [["Nombre","Teléfono","Email","Dirección","Notas"]];
    sups.forEach(function(s){
      supRows.push([s.name || "", s.phone || "", s.email || "", s.address || "", s.notes || ""]);
    });
    XLSX.utils.book_append_sheet(wb, mkSheet(supRows), "Proveedores");

    // ══════════════════════════════════════════════════════════════
    //  HOJA 15 — COMPRAS (cabecera)
    //  Campos DB: id, created_at, supplier_name, total, notes, registered_by
    // ══════════════════════════════════════════════════════════════
    var comprasRows = [["ID","Fecha","Hora","Proveedor","Total (Q)","Notas","Registrado por"]];
    purs.forEach(function(p){
      comprasRows.push([
        p.id || "", fmtD(p.created_at), fmtT(p.created_at),
        p.supplier_name || "", Number(p.total || 0).toFixed(2),
        p.notes || "", p.registered_by || "",
      ]);
    });
    XLSX.utils.book_append_sheet(wb, mkSheet(comprasRows), "Compras");

    // ══════════════════════════════════════════════════════════════
    //  HOJA 16 — DETALLE DE COMPRAS (artículo por artículo)
    //  purchase_items: purchase_id, product_name, product_code, qty, cost, subtotal
    // ══════════════════════════════════════════════════════════════
    var detalleComprasRows = [["ID Compra","Fecha","Proveedor","Código producto","Producto","Cant.","Costo unit. (Q)","Subtotal (Q)"]];
    purs.forEach(function(p){
      var items = p.purchase_items || [];
      items.forEach(function(it){
        detalleComprasRows.push([
          p.id || "", fmtD(p.created_at), p.supplier_name || "",
          it.product_code || "", it.product_name || "",
          Number(it.qty || 0), Number(it.cost || 0).toFixed(2),
          Number(it.subtotal || 0).toFixed(2),
        ]);
      });
    });
    XLSX.utils.book_append_sheet(wb, mkSheet(detalleComprasRows), "Detalle Compras");

    // ══════════════════════════════════════════════════════════════
    //  HOJA 17 — USUARIOS DEL SISTEMA
    //  Campos DB: id, name, email, role, active, last_login, created_at, sec_question
    // ══════════════════════════════════════════════════════════════
    var usrRows = [["ID","Nombre","Email","Rol","Activo","Último ingreso","Fecha creación","Pregunta de seguridad"]];
    usrs.forEach(function(u){
      usrRows.push([
        u.id || "", u.name || "", u.email || "",
        ROLE_LABEL[u.role] || u.role || "", u.active ? "Sí" : "No",
        u.last_login ? fmtD(u.last_login) + " " + fmtT(u.last_login) : "Nunca",
        fmtD(u.created_at), u.sec_question || "—",
      ]);
    });
    XLSX.utils.book_append_sheet(wb, mkSheet(usrRows), "Usuarios");

    // ══════════════════════════════════════════════════════════════
    //  HOJA 18 — SESIONES DE CAJA
    //  Campos DB: id, created_at, fondo_inicial, nota_apertura, opened_by, opened_role,
    //             closed_at, closed_by, closed_role, efectivo_contado, nota_cierre
    // ══════════════════════════════════════════════════════════════
    var cajaRows = [["ID","Fecha apertura","Fondo inicial (Q)","Abierta por","Rol","Nota apertura","Fecha cierre","Cerrada por","Efectivo contado (Q)","Nota cierre"]];
    caja.forEach(function(s){
      cajaRows.push([
        s.id || "", fmtD(s.created_at) + " " + fmtT(s.created_at),
        Number(s.fondo_inicial || 0).toFixed(2), s.opened_by || "", s.opened_role || "",
        s.nota_apertura || "",
        s.closed_at ? fmtD(s.closed_at) + " " + fmtT(s.closed_at) : "Abierta",
        s.closed_by || "", s.efectivo_contado !== null && s.efectivo_contado !== undefined ? Number(s.efectivo_contado).toFixed(2) : "—",
        s.nota_cierre || "",
      ]);
    });
    XLSX.utils.book_append_sheet(wb, mkSheet(cajaRows), "Sesiones Caja");

    // ── Generar archivo ──
    XLSX.writeFile(wb, storeName.replace(/\s+/g, "_") + "_respaldo_" + now.toISOString().slice(0, 10) + ".xls", { bookType: 'xls' });
    localStorage.setItem("mnpos-last-backup", now.toISOString());

    if(failed.length > 0){
      showFlash("⚠ Respaldo descargado con " + failed.length + " módulo(s) faltante(s): " + failed.join(", ") + ". Revisá Resumen en el Excel.", "err");
    } else {
      showFlash("✓ Respaldo completo — 18 hojas, todos los módulos descargados", "ok");
    }
  }

  function importData(text){
    try{
      var d=JSON.parse(text);
      if(!d.products||!d.sales)return false;
      if(d.products)setProducts(d.products);
      if(d.sales)setSales(d.sales);
      if(d.accounts)setAccounts(d.accounts||[]);
      if(d.returns)setReturns(d.returns||[]);
      if(d.defectives)setDefectives(d.defectives||[]);
      if(d.clients)setClients(d.clients||[]);
      if(d.repairs)setRepairs(d.repairs||[]);
      return true;
    }catch(e){return false;}
  }

  var todayStr=new Date().toDateString();
  // Todas las ventas del día (efectivo + crédito), excluye anuladas
  var todaySales=sales.filter(function(s){return new Date(s.date).toDateString()===todayStr&&s.status!=='anulado';});
  var pendingAccs=accounts.filter(function(a){return a.status!=="pagado";});
  var totalPend=pendingAccs.reduce(function(s,a){return s+a.balance;},0);
  var pqs={};
  sales.forEach(function(s){(s.items||[]).forEach(function(i){pqs[i.name]=(pqs[i.name]||0)+i.qty;});});
  var top5=Object.keys(pqs).map(function(k){return [k,pqs[k]];}).sort(function(a,b){return b[1]-a[1];}).slice(0,5);

  // Superadmin: vista dedicada sin sidebar ni módulos POS
  if(session.role==="superadmin"){
    return (
      <div style={{minHeight:"100vh",background:"var(--bg-main,#eceae4)"}}>
        <div style={{background:NAVY,padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          <span style={{color:"#fff",fontWeight:800,fontSize:16}}>🏢 {APP_NAME} — Panel de Control</span>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={toggleTheme} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.3)",color:"#fff",padding:"6px 14px",borderRadius:6,cursor:"pointer",fontSize:13}}>
              {theme==="light"?"🌙 Modo oscuro":"☀️ Modo claro"}
            </button>
            <button onClick={onLogout} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.3)",color:"#fff",padding:"6px 14px",borderRadius:6,cursor:"pointer",fontSize:13}}>Cerrar sesión</button>
          </div>
        </div>
        <SuperAdminPanel session={session} theme={theme}/>
      </div>
    );
  }

  return (
      <div style={{display:"flex",minHeight:"100vh",background:"var(--bg-main,#eceae4)"}}>

        {/* ── Modal de inactividad ── */}
        {showWarning&&(
          <div style={{position:"fixed",top:0,left:0,width:"100%",height:"100%",background:"rgba(0,0,0,0.65)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{background:"#fff",borderRadius:16,padding:"36px 40px",maxWidth:400,width:"90%",textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
              <div style={{fontSize:48,marginBottom:12}}>⏱️</div>
              <p style={{fontSize:20,fontWeight:700,margin:"0 0 8px",color:"#1a1a1a"}}>¿Seguís ahí?</p>
              <p style={{fontSize:14,color:"#666",margin:"0 0 20px",lineHeight:1.6}}>Tu sesión se cerrará automáticamente por inactividad.</p>
              <div style={{background:"#f5f4f0",borderRadius:12,padding:"16px",marginBottom:24}}>
                <p style={{fontSize:13,color:"#666",margin:"0 0 4px"}}>Cierre de sesión en</p>
                <p style={{fontSize:40,fontWeight:800,margin:0,color:countdown<=10?"#E24B4A":TEAL}}>{countdown}s</p>
              </div>
              <div style={{display:"flex",gap:12}}>
                <button onClick={function(){clearSession();onLogout();}} style={{flex:1,padding:"11px",borderRadius:8,border:"1px solid rgba(0,0,0,0.15)",background:"#fff",color:"#666",fontSize:14,cursor:"pointer",fontWeight:500}}>
                  Cerrar sesión
                </button>
                <button onClick={handleContinueSession} style={{flex:2,padding:"11px",borderRadius:8,border:"none",background:TEAL,color:"#fff",fontSize:14,cursor:"pointer",fontWeight:700}}>
                  ✓ Continuar sesión
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: ofrecer boleta tras una venta */}
        {postSale&&(
          <div style={{position:"fixed",inset:0,zIndex:9500,background:"rgba(20,30,45,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={function(){setPostSale(null);}}>
            <div style={{background:"#fff",borderRadius:14,padding:24,maxWidth:380,width:"100%",boxShadow:"0 12px 40px rgba(0,0,0,0.25)"}} onClick={function(e){e.stopPropagation();}}>
              {/* Checkmark de exito animado (solo visual) */}
              <style dangerouslySetInnerHTML={{__html:`
                @keyframes ok-pop { 0% { transform: scale(0); opacity: 0; } 60% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
                @keyframes ok-ring { 0% { box-shadow: 0 0 0 0 rgba(29,158,117,0.45); } 100% { box-shadow: 0 0 0 18px rgba(29,158,117,0); } }
                .ok-badge { width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg,#1D9E75,#00c48c); color: #fff; font-size: 30px; font-weight: 900; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; animation: ok-pop 0.45s cubic-bezier(0.34,1.56,0.64,1) both, ok-ring 0.9s 0.25s ease-out both; }
                @media (prefers-reduced-motion: reduce) { .ok-badge { animation: none; } }
              `}} />
              <div className="ok-badge">✓</div>
              <p style={{textAlign:"center",fontWeight:800,fontSize:17,margin:"0 0 4px",color:"#1a2535"}}>{(function(){var _dt=postSale.opts&&postSale.opts.docType; return _dt==="abono"?"Abono registrado":_dt==="devolucion"?"Devolución registrada":"Venta registrada";})()}</p>
              <p style={{textAlign:"center",fontSize:13,color:"#777",margin:"0 0 18px"}}>{Q(postSale.sale.total)} · {postSale.sale.client||"Cliente ocasional"}<br/>¿Entregar comprobante al cliente?</p>
              <div style={{display:"grid",gap:8}}>
                <button style={Object.assign({},mB("teal"),{padding:"11px"})} onClick={function(){printVoucherDoc(postSale.sale,postSale.opts);}}>🖨 Imprimir / PDF</button>
                <button style={Object.assign({},mB("blue"),{padding:"11px"})} onClick={function(){descargarBoletaImagen(postSale.sale,postSale.opts).then(function(ok){showFlash(ok?"🖼 Imagen de boleta descargada":"⛔ No se pudo generar la imagen",ok?"ok":"err");});}}>🖼 Descargar imagen</button>
                <button style={Object.assign({},mB("green"),{background:"#25D366",padding:"11px"})} onClick={function(){var _ps=postSale; var _dt=_ps.opts&&_ps.opts.docType; pedirTelYEnviar(_ps.sale.client,function(){return waComprobante(_ps.sale,_dt,_ps.opts);},{sale:_ps.sale,receiptOpts:_ps.opts});}}>💬 Enviar por WhatsApp</button>
                {postSale.opts&&(postSale.opts.estado==="pendiente"||postSale.opts.estado==="parcial")&&(
                  <button style={Object.assign({},mB("amber"),{padding:"10px",background:"#F59E0B",color:"#fff"})} onClick={function(){setPostSale(null);navTo("accounts",{search:postSale.sale.client||""});}}>💳 Ver cuenta por cobrar →</button>
                )}
                <button style={Object.assign({},mB("gray"),{padding:"10px"})} onClick={function(){setPostSale(null);}}>No entregar</button>
              </div>
            </div>
          </div>
        )}

        {/* Onboarding wizard */}
        {showOnboarding&&<OnboardingWizard session={session} showFlash={showFlash} onDone={function(){setShowOnboarding(false); var _cfg=Object.assign({},getStore()); setStoreInfo(function(prev){return Object.assign({},prev,_cfg);}); setReceiptStore(_cfg);}}/>}

        {/* Banner de suscripción vencida/por vencer */}
        {subInfo&&subInfo.daysLeft!==null&&subInfo.daysLeft<=7&&<div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:9000,background:subInfo.daysLeft<0?"#E24B4A":"#F39C12",color:"#fff",padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,boxShadow:"0 -2px 12px rgba(0,0,0,0.2)"}}>
          <span style={{fontWeight:700,fontSize:13}}>
            {subInfo.daysLeft<0?"⚠ Tu suscripción ha vencido.":"⚠ Tu suscripción vence en "+subInfo.daysLeft+" día(s)."}
            {" "}Contactá al administrador para renovar.
          </span>
          <a href={"https://wa.me/50254707112?text=Hola%2C%20necesito%20renovar%20mi%20suscripci%C3%B3n%20de%20"+(subInfo.tenantName||"mi negocio")} target="_blank" rel="noreferrer" style={{background:"#fff",color:"#1a2535",padding:"6px 14px",borderRadius:8,fontWeight:700,fontSize:12,textDecoration:"none",flexShrink:0}}>
            Renovar ahora
          </a>
        </div>}

        {/* Overlay móvil */}
        {sidebarOpen&&<div className="sidebar-overlay" onClick={function(){setSidebarOpen(false);}} style={{display:"none"}}/>}
        {/* Header móvil */}
        <div className="mobile-header" style={{display:"none",position:"fixed",top:0,left:0,right:0,zIndex:98,background:NAVY,padding:"10px 16px",alignItems:"center",justifyContent:"space-between",boxShadow:"0 2px 8px rgba(0,0,0,0.3)"}}>
          <button onClick={function(){setSidebarOpen(!sidebarOpen);}} style={{background:"transparent",border:"none",color:"#fff",fontSize:22,cursor:"pointer",padding:"4px 8px",lineHeight:1}}>☰</button>
          <span style={{color:"#fff",fontWeight:700,fontSize:15,letterSpacing:"-0.3px"}}>{storeInfo.store_name||STORE_FALLBACK}</span>
          <span style={{color:TEAL,fontSize:11,fontWeight:600}}>v{APP_VERSION}</span>
        </div>
        <Sidebar view={view} setView={setView} cartCount={cart.length} pendingCount={pendingAccs.length} products={products} sales={sales} session={session} onLogout={onLogout} isOnline={isOnline} theme={theme} toggleTheme={toggleTheme} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} onSearch={function(){setGsOpen(true);}} storeInfo={storeInfo}/>
        {gsOpen&&<GlobalSearch onClose={function(){setGsOpen(false);}} setView={setView} sales={sales} clients={clients} products={products} repairs={repairs} setSelectedSale={setSelSale}/>}
        {/* Banner global de mensajes: el POS ya dibuja el suyo; en el resto de pantallas era invisible */}
          {view!=="pos" && flash && flash.msg && (
            <div className="flash-msg" style={{position:"fixed",top:14,left:"50%",transform:"translateX(-50%)",zIndex:3000,padding:"10px 22px",borderRadius:10,fontWeight:600,fontSize:14,boxShadow:"0 6px 22px rgba(0,0,0,0.25)",maxWidth:"90vw",
              background: flash.type==="err"?"#FDECEA":flash.type==="warn"?"#FFF7E0":"#E1F5EE",
              color:      flash.type==="err"?"#8A1F1F":flash.type==="warn"?"#7A5800":"#0A5C44",
              border: "1.5px solid " + (flash.type==="err"?"#F0A9A9":flash.type==="warn"?"#EFD48A":"#9BDAC4")
            }}>{flash.msg}</div>
          )}
          {/* Selector de variante (color/capacidad) al agregar al carrito */}
          {variantPick && (
            <div style={{position:"fixed",top:0,left:0,width:"100%",height:"100%",background:"rgba(0,0,0,0.5)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
              <div style={{background:"var(--card,#fff)",borderRadius:12,padding:20,width:380,maxWidth:"100%",maxHeight:"80vh",overflowY:"auto",boxShadow:"0 10px 40px rgba(0,0,0,0.3)"}}>
                <p style={{fontWeight:800,fontSize:16,margin:"0 0 4px"}}>🎨 {variantPick.product.name}</p>
                <p style={{fontSize:13,color:"#666",margin:"0 0 12px"}}>¿Cuál variante se está vendiendo?</p>
                {variantPick.variants.map(function(v){
                  var lbl=[v.color,v.capacity].filter(Boolean).join(' ')||v.sku||'Variante';
                  return (
                    <button key={v.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",padding:"10px 14px",marginBottom:8,borderRadius:8,border:"1.5px solid #d8d4cb",background:"transparent",cursor:"pointer",fontSize:14,fontWeight:600,color:"inherit"}}
                      onClick={function(){pushCartLine(variantPick.product,v);setVariantPick(null);}}>
                      <span>{lbl} <span style={{fontSize:11,color:"#999",fontWeight:400}}>({Number(v.stock||0)} disp.)</span></span>
                      <span style={{color:TEAL}}>{v.price!=null?'Q '+Number(v.price).toFixed(2):'Q '+Number(variantPick.product.price).toFixed(2)}</span>
                    </button>
                  );
                })}
                <button style={{width:"100%",padding:"9px 14px",marginBottom:8,borderRadius:8,border:"1.5px dashed #bbb",background:"transparent",cursor:"pointer",fontSize:13,color:"#666"}}
                  onClick={function(){pushCartLine(variantPick.product,null);setVariantPick(null);}}>
                  Sin especificar variante
                </button>
                <button style={{width:"100%",padding:"8px",borderRadius:8,border:"none",background:"transparent",cursor:"pointer",fontSize:13,color:"#999"}}
                  onClick={function(){setVariantPick(null);}}>Cancelar</button>
              </div>
            </div>
          )}
          <div key={view} style={{flex:1,padding:"clamp(12px,3vw,28px)",overflowY:"auto",minWidth:0}} className="main-content screen-enter">
          {view==="dashboard"&&canAccess(session.role,"dashboard")&&<DashboardScreen sales={sales} todaySales={todaySales} pendingAccs={pendingAccs} totalPend={totalPend} products={products} top5={top5} setSelectedSale={setSelSale} setView={setView} navTo={navTo} accounts={accounts} returns={returns} repairs={repairs} warranties={warranties} loaded={loaded}/>}
          {view==="pos"      &&canAccess(session.role,"pos")&&<POSScreen products={products} filteredPOS={filteredPOS} cart={cart} posQ={posQ} setPosQ={setPosQ} payMethod={payMethod} setPayMethod={setPayMethod} secondMethod={secondMethod} setSecondMethod={setSecondMethod} secondAmount={secondAmount} setSecondAmount={setSecondAmount} payType={payType} setPayType={setPayType} cashIn={cashIn} setCashIn={setCashIn} initialPay={initialPay} setInitialPay={setInitialPay} clientName={clientName} setClientName={setClientName} selectedClientId={selectedClientId} setSelectedClientId={setSelectedClientId} saleNote={saleNote} setSaleNote={setSaleNote} cartTotal={cartTotal} vuelto={vuelto} initPaidVal={initPaidVal} addToCart={addToCart} changeQty={changeQty} removeFromCart={removeFromCart} applyDiscount={applyDiscount} checkout={checkout} resetPOS={resetPOS} flash={flash} clients={clients} accounts={accounts} ivaPercent={ivaPercent} ivaAmount={ivaAmount} subtotalNeto={subtotalNeto}/>}
          {view==="caja"     &&canAccess(session.role,"caja")&&<CajaScreen sales={sales} accounts={accounts} returns={returns} session={session} onBackup={function(){ backupAPI.create().catch(function(){}); }}/>}
          {view==="accounts" &&canAccess(session.role,"accounts")&&<AccountsScreen accounts={accounts} pendingAccs={pendingAccs} totalPend={totalPend} addPayment={addPayment} showFlash={showFlash} products={products} session={session} clients={clients} navTo={navTo} initialSearch={view==="accounts"&&deepLink?deepLink.search||'':''}/>}
          {view==="returns"  &&canAccess(session.role,"returns")&&<ReturnsScreen returns={returns} products={products} onProcess={processReturn} showFlash={showFlash} clients={clients} sales={sales} initialClient={view==="returns"&&deepLink?deepLink.client||'':''}/>}
          {view==="defective"&&canAccess(session.role,"defective")&&<DefectiveScreen defectives={defectives} onUpdateStatus={updateDefectiveStatus} onReingress={reingresarDefective}/>}
          {view==="products" &&canAccess(session.role,"products")&&<ProductsScreen products={products} categories={categories} locations={locations} saveProduct={saveProduct} deleteProduct={deleteProduct} importProducts={importProducts} showFlash={showFlash} setProducts={setProducts} initialSearch={view==="products"&&deepLink?deepLink.search||'':''}/>}
          {view==="catalogos"&&canAccess(session.role,"catalogos")&&<CatalogosScreen categories={categories} locations={locations} products={products} reloadCatalogos={reloadCatalogos} showFlash={showFlash}/>}
          {view==="inventory"&&canAccess(session.role,"inventory")&&<InventoryScreen products={products}/>}
          {view==="history"  &&canAccess(session.role,"history")&&<HistoryScreen sales={sales} selectedSale={selSale} setSelectedSale={setSelSale} accounts={accounts} returns={returns} products={products} session={session} clients={clients} navTo={navTo}/>}
          {view==="cuadres"  &&canAccess(session.role,"cuadres")&&<CuadresScreen sales={sales} accounts={accounts} returns={returns} products={products} repairs={repairs} session={session} showFlash={showFlash}/>}
          {view==="backup"   &&canAccess(session.role,"backup")&&<BackupScreen products={products} sales={sales} accounts={accounts} returns={returns} defectives={defectives} clients={clients} repairs={repairs} warranties={warranties} onExportJSON={exportJSON} onExportExcel={exportExcel}/>}
          {view==="migracion"&&canAccess(session.role,"migracion")&&<MigracionScreen session={session} showFlash={showFlash} onChanged={reloadAccounts} clients={clients} accounts={accounts}/>}
          {view==="users"    &&canAccess(session.role,"users")&&<UsersScreen session={session} showFlash={showFlash}/>}
          {view==="clients"  &&canAccess(session.role,"clients")&&<ClientsScreen clients={clients} sales={sales} accounts={accounts} returns={returns} saveClient={saveClient} session={session} showFlash={showFlash} initialSearch={view==="clients"&&deepLink?deepLink.search||'':''} initialClientId={view==="clients"&&deepLink?deepLink.clientId||null:null}/>}
          {view==="repairs"    &&canAccess(session.role,"repairs")&&<RepairsScreen repairs={repairs} clients={clients} products={products} saveRepair={saveRepair} updateRepairStatus={updateRepairStatus} reloadRepairs={reloadRepairs} onCobrar={cobrarReparacion} session={session} showFlash={showFlash} warranties={warranties} saveWarranty={saveWarranty} initialSearch={view==="repairs"&&deepLink?deepLink.search||'':''} initialRepairId={view==="repairs"&&deepLink?deepLink.repairId||null:null} navTo={navTo}/>}
          {view==="warranties" &&canAccess(session.role,"warranties")&&<WarrantiesScreen warranties={warranties} sales={sales} repairs={repairs} updateWarranty={updateWarranty} saveWarranty={saveWarranty} session={session} clients={clients} navTo={navTo} initialSearch={view==="warranties"&&deepLink?deepLink.search||'':''} initialWarrantyId={view==="warranties"&&deepLink?deepLink.warrantyId||null:null}/>}
          {view==="audit"      &&canAccess(session.role,"audit")&&<AuditScreen session={session}/>}
          {view==="suppliers"  &&canAccess(session.role,"suppliers")&&<SuppliersScreen products={products} session={session} showFlash={showFlash} onStockUpdate={function(){ productsAPI.getAll().then(function(p){ setProducts((p||[]).map(function(x){return Object.assign({},x,{price:Number(x.price),cost:Number(x.cost),stock:Number(x.stock)});})); }); }}/>}
          {view==="storeconfig"&&canAccess(session.role,"storeconfig")&&<StoreConfigScreen storeInfo={storeInfo} setStoreInfo={setStoreInfo} session={session} showFlash={showFlash}/>}
          {view==="ayuda"      &&canAccess(session.role,"ayuda")&&<AyudaScreen session={session}/>}
        </div>
        {push.status === 'idle' && <PushPermissionBanner onAllow={push.requestPermission} onDismiss={push.dismiss} />}
      </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   MÓDULO AUDITORÍA
   ══════════════════════════════════════════════════════════════════════ */
var AUDIT_ACTIONS = {
  venta_completada:    "Venta",
  cuenta_creada:       "Cuenta por cobrar",
  abono_registrado:    "Abono",
  producto_creado:     "Producto creado",
  producto_editado:    "Producto editado",
  producto_eliminado:  "Producto eliminado",
  usuario_creado:      "Usuario creado",
  usuario_editado:     "Usuario editado",
  cliente_creado:      "Cliente creado",
  cliente_editado:     "Cliente editado",
  cliente_eliminado:   "Cliente eliminado",
  reparacion_creada:   "Reparación creada",
  reparacion_editada:  "Reparación editada",
  reparacion_estado:   "Estado reparación",
  reparacion_eliminada:"Reparación eliminada",
  devolucion_registrada:"Devolución",
  defectuoso_estado:   "Defectuoso actualizado",
};
var AUDIT_COLORS = {
  venta_completada:    "teal",
  cuenta_creada:       "blue",
  abono_registrado:    "green",
  producto_creado:     "purple",
  producto_editado:    "amber",
  producto_eliminado:  "red",
  usuario_creado:      "purple",
  usuario_editado:     "amber",
  cliente_creado:      "teal",
  cliente_editado:     "amber",
  cliente_eliminado:   "red",
  reparacion_creada:   "blue",
  reparacion_editada:  "amber",
  reparacion_estado:   "teal",
  reparacion_eliminada:"red",
  devolucion_registrada:"orange",
  defectuoso_estado:   "gray",
};

export default AppWrapper;
