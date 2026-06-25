import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { db } from './utils/db.js';
import { authAPI, productsAPI, salesAPI, accountsAPI, returnsAPI, defectivesAPI, usersAPI, checkAPI, clientsAPI, repairsAPI, auditAPI, warrantiesAPI, cajaAPI, settingsAPI, suppliersAPI, adminAPI } from './utils/api.js';

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

// Genera el HTML del recibo (versión simplificada para captura)
function buildReceiptHTML(sale, opts, si){
  opts=opts||{}; si=si||getStore();
  var sn=si.store_name||STORE_FALLBACK;
  var st=si.store_tagline||"Tecnología · Accesorios · Reparaciones · Guatemala";
  var items=(sale.items||[]).map(function(it){
    return '<tr>'+
      '<td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;font-weight:600;">'+it.name+'</td>'+
      '<td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;font-size:12px;">'+it.qty+'</td>'+
      '<td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;font-size:12px;">Q '+Number(it.price).toFixed(2)+'</td>'+
      '<td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;font-size:12px;font-weight:700;">Q '+Number(it.price*it.qty).toFixed(2)+'</td>'+
    '</tr>';
  }).join("");
  var fecha=new Date(sale.date||sale.created_at).toLocaleDateString("es-GT",{day:"2-digit",month:"long",year:"numeric"});
  var hora=new Date(sale.date||sale.created_at).toLocaleTimeString("es-GT",{hour:"2-digit",minute:"2-digit"});
  var estadoHTML="";
  if(opts.estado==="pendiente")estadoHTML='<div style="text-align:center;padding:8px;margin-bottom:14px;background:#FCEBEB;color:#791F1F;border-radius:6px;font-weight:900;font-size:15px;letter-spacing:2px;">PENDIENTE DE PAGO</div>';
  else if(opts.estado==="parcial")estadoHTML='<div style="text-align:center;padding:8px;margin-bottom:14px;background:#FAEEDA;color:#633806;border-radius:6px;font-weight:900;font-size:15px;letter-spacing:2px;">ABONO — SALDO PENDIENTE</div>';
  else if(opts.estado==="pagado")estadoHTML='<div style="text-align:center;padding:8px;margin-bottom:14px;background:#EAF3DE;color:#27500A;border-radius:6px;font-weight:900;font-size:15px;letter-spacing:2px;">✓ CUENTA CANCELADA</div>';
  var saldoHTML="";
  if(opts.estado&&opts.estado!=="")saldoHTML='<tr style="background:#f0f9f5;"><td colspan="3" style="padding:8px 10px;font-weight:700;font-size:13px;">Abonado</td><td style="padding:8px 10px;text-align:right;font-weight:700;font-size:13px;color:#1D9E75;">Q '+Number(opts.pagado||sale.paid||0).toFixed(2)+'</td></tr>'+
    '<tr style="background:#fff0f0;"><td colspan="3" style="padding:8px 10px;font-weight:900;font-size:14px;">Saldo pendiente</td><td style="padding:8px 10px;text-align:right;font-weight:900;font-size:14px;color:#E24B4A;">Q '+Number(opts.saldo||sale.balance||0).toFixed(2)+'</td></tr>';
  return '<div style="font-family:Arial,sans-serif;font-size:12px;background:#fff;width:600px;padding:24px;box-sizing:border-box;">'+
    '<div style="border-bottom:3px solid #1D9E75;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start;">'+
      '<div><div style="font-size:20px;font-weight:900;color:#1a2535;">'+sn+'</div>'+
        '<div style="font-size:9px;color:#1D9E75;font-weight:700;letter-spacing:2px;margin-top:2px;">SISTEMA DE GESTIÓN</div>'+
        '<div style="font-size:9px;color:#999;margin-top:3px;">'+st+'</div></div>'+
      '<div style="text-align:right;"><div style="font-size:9px;color:#999;text-transform:uppercase;">'+(opts.estado?"Comprobante de Cuenta":"Comprobante de Venta")+'</div>'+
        '<div style="font-size:20px;font-weight:900;color:#1D9E75;"># '+String(sale.id||"").toUpperCase().slice(-8)+'</div></div>'+
    '</div>'+
    estadoHTML+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;padding:12px;background:#f8f9fa;border-radius:8px;border-left:4px solid #1D9E75;">'+
      '<div><div style="font-size:9px;color:#999;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Cliente</div><div style="font-size:12px;font-weight:700;color:#222;">'+sale.client+'</div></div>'+
      '<div><div style="font-size:9px;color:#999;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Fecha</div><div style="font-size:12px;font-weight:700;color:#222;">'+fecha+'</div><div style="font-size:10px;color:#666;">'+hora+' hrs</div></div>'+
      '<div><div style="font-size:9px;color:#999;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Método</div><div style="font-size:12px;font-weight:700;color:#222;">'+(sale.method||"Efectivo")+'</div></div>'+
      '<div><div style="font-size:9px;color:#999;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Atendido por</div><div style="font-size:12px;font-weight:700;color:#222;">'+((sale.registradoPor&&sale.registradoPor.name)||opts.usuario||"—")+'</div></div>'+
    '</div>'+
    '<table style="width:100%;border-collapse:collapse;margin-bottom:12px;">'+
      '<thead><tr style="background:#1a2535;">'+
        '<th style="padding:8px 10px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;text-align:left;">Producto</th>'+
        '<th style="padding:8px 10px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;text-align:center;">Cant.</th>'+
        '<th style="padding:8px 10px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;text-align:right;">Precio</th>'+
        '<th style="padding:8px 10px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;text-align:right;">Subtotal</th>'+
      '</tr></thead>'+
      '<tbody>'+items+saldoHTML+'</tbody>'+
    '</table>'+
    '<div style="display:flex;justify-content:flex-end;margin-bottom:16px;">'+
      '<div style="border:1px solid #eee;border-radius:8px;overflow:hidden;min-width:220px;">'+
        '<div style="display:flex;justify-content:space-between;padding:7px 12px;font-size:12px;border-bottom:1px solid #eee;"><span>Total</span><span>Q '+Number(sale.total).toFixed(2)+'</span></div>'+
        '<div style="display:flex;justify-content:space-between;padding:7px 12px;background:#1D9E75;color:#fff;font-weight:700;font-size:14px;"><span>TOTAL</span><span>Q '+Number(sale.total).toFixed(2)+'</span></div>'+
      '</div>'+
    '</div>'+
    '<div style="border-top:2px dashed #ccc;padding-top:12px;font-size:10px;color:#999;display:flex;justify-content:space-between;"><span>Generado por '+sn+' POS</span><span>'+fecha+' · '+hora+'</span></div>'+
    '<div style="text-align:center;margin-top:16px;font-size:13px;color:#1D9E75;font-weight:700;letter-spacing:1px;">¡Gracias por su compra!</div>'+
    '</div>';
}

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

var sC  = {background:"var(--bg-card,#fff)",borderRadius:12,border:"1px solid var(--border-card,rgba(0,0,0,0.09))",padding:"20px 24px"};
var sI  = {width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid var(--border-input,rgba(0,0,0,0.2))",fontSize:14,background:"var(--bg-input,#fff)",color:"var(--text-primary,#1a1a1a)",boxSizing:"border-box"};
var sL  = {fontSize:13,color:"var(--text-secondary,#666)",marginBottom:4,display:"block"};
var sTH = {textAlign:"left",padding:"10px 12px",color:"var(--text-secondary,#666)",fontSize:13,borderBottom:"1px solid var(--border-table,rgba(0,0,0,0.08))",fontWeight:500,background:"var(--bg-table-head,transparent)"};
var sTD = {padding:"10px 12px",borderBottom:"1px solid var(--border-row,rgba(0,0,0,0.05))",color:"var(--text-primary,#1a1a1a)",fontSize:14};
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
  admin:      ["dashboard","pos","caja","accounts","returns","defective","products","inventory","history","backup","users","clients","repairs","cuadres","audit","warranties","storeconfig","suppliers","ayuda"],
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
function clearSession() { sessionStorage.removeItem(SESS_KEY); }

/* ══════════════════════════════════════════════════════════════════════
   LANDING PAGE
   ══════════════════════════════════════════════════════════════════════ */
function LandingPage(props){
  var onLogin=props.onLogin||function(){};
  var _menu=useState(false); var menuOpen=_menu[0]; var setMenuOpen=_menu[1];

  var features=PLATFORM_FEATURES;

  var plans=[
    {name:"Básico",price:"Q 299",period:"/mes",color:"#888",features:["1 usuario","POS y ventas","Inventario básico","Soporte por WhatsApp"]},
    {name:"Profesional",price:"Q 599",period:"/mes",color:TEAL,features:["5 usuarios","Todos los módulos","Reparaciones y garantías","Reportes avanzados","Soporte prioritario"],highlight:true},
    {name:"Empresarial",price:"Q 999",period:"/mes",color:"#9B59B6",features:["Usuarios ilimitados","Multi-sucursal","API y exportación","Capacitación incluida","Soporte dedicado"]},
  ];

  var scrollTo=function(id){ var el=document.getElementById(id); if(el) el.scrollIntoView({behavior:"smooth"}); setMenuOpen(false); };

  return (
    <div style={{fontFamily:"Arial,sans-serif",background:"#fff",minHeight:"100vh"}}>

      {/* ── NAVBAR ── */}
      <nav style={{position:"sticky",top:0,zIndex:100,background:"rgba(255,255,255,0.97)",backdropFilter:"blur(8px)",borderBottom:"1px solid #eee",padding:"0 clamp(16px,4vw,60px)"}}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:64}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:36,borderRadius:10,background:TEAL,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:16}}>{APP_NAME[0]}</div>
            <span style={{fontWeight:800,fontSize:18,color:NAVY}}>{APP_NAME}</span>
          </div>
          <div style={{display:"flex",gap:24,alignItems:"center"}} className="nav-links">
            {[["Funciones","features"],["Precios","precios"],["Contacto","contacto"]].map(function(l){
              return <button key={l[0]} onClick={function(){scrollTo(l[1]);}} style={{background:"none",border:"none",color:"#444",fontSize:14,fontWeight:500,cursor:"pointer",padding:"4px 0"}}>{l[0]}</button>;
            })}
            <button onClick={onLogin} style={{padding:"9px 22px",borderRadius:8,border:"none",background:TEAL,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer"}}>Iniciar sesión</button>
          </div>
          <button onClick={function(){setMenuOpen(!menuOpen);}} style={{display:"none",background:"none",border:"none",fontSize:24,cursor:"pointer",color:NAVY}} className="menu-btn">☰</button>
        </div>
        {menuOpen&&<div style={{background:"#fff",borderTop:"1px solid #eee",padding:"12px 24px",display:"flex",flexDirection:"column",gap:12}}>
          {[["Funciones","features"],["Precios","precios"],["Contacto","contacto"]].map(function(l){
            return <button key={l[0]} onClick={function(){scrollTo(l[1]);}} style={{background:"none",border:"none",color:"#444",fontSize:15,fontWeight:500,cursor:"pointer",textAlign:"left",padding:"6px 0"}}>{l[0]}</button>;
          })}
          <button onClick={onLogin} style={{padding:"11px",borderRadius:8,border:"none",background:TEAL,color:"#fff",fontWeight:700,fontSize:15,cursor:"pointer"}}>Iniciar sesión</button>
        </div>}
      </nav>

      {/* ── HERO ── */}
      <section style={{background:"linear-gradient(135deg,"+NAVY+" 0%,#243552 100%)",padding:"clamp(60px,10vw,120px) clamp(16px,4vw,60px)",textAlign:"center"}}>
        <div style={{maxWidth:700,margin:"0 auto"}}>
          <div style={{display:"inline-block",background:"rgba(29,158,117,0.2)",border:"1px solid rgba(29,158,117,0.4)",borderRadius:20,padding:"6px 16px",fontSize:12,color:TEAL,fontWeight:700,marginBottom:20,letterSpacing:1}}>SISTEMA DE GESTIÓN EMPRESARIAL — GUATEMALA</div>
          <h1 style={{color:"#fff",fontSize:"clamp(28px,5vw,52px)",fontWeight:900,margin:"0 0 20px",lineHeight:1.15}}>El sistema de gestión más completo para <span style={{color:TEAL}}>tu negocio</span></h1>
          <p style={{color:"rgba(255,255,255,0.75)",fontSize:"clamp(15px,2vw,18px)",margin:"0 0 36px",lineHeight:1.7}}>Ventas, reparaciones, inventario, cuentas por cobrar y más — todo en un solo sistema diseñado para Guatemala.</p>
          <div style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap"}}>
            <button onClick={function(){scrollTo("contacto");}} style={{padding:"14px 32px",borderRadius:10,border:"none",background:TEAL,color:"#fff",fontWeight:800,fontSize:16,cursor:"pointer",boxShadow:"0 4px 20px rgba(29,158,117,0.4)"}}>Solicitar demo gratis →</button>
            <button onClick={onLogin} style={{padding:"14px 32px",borderRadius:10,border:"1px solid rgba(255,255,255,0.3)",background:"transparent",color:"#fff",fontWeight:600,fontSize:16,cursor:"pointer"}}>Iniciar sesión</button>
          </div>
          <div style={{display:"flex",gap:24,justifyContent:"center",marginTop:40,flexWrap:"wrap"}}>
            {["✅ Sin instalación","✅ 100% en la nube","✅ Soporte en español","✅ Actualizaciones incluidas"].map(function(t){
              return <span key={t} style={{color:"rgba(255,255,255,0.65)",fontSize:13}}>{t}</span>;
            })}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section style={{background:"#f8f9fa",padding:"36px clamp(16px,4vw,60px)",borderBottom:"1px solid #eee"}}>
        <div style={{maxWidth:900,margin:"0 auto",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:20,textAlign:"center"}}>
          {[[PLATFORM_FEATURES.length+"+","Módulos integrados"],["100%","En la nube"],["24/7","Acceso desde cualquier dispositivo"],["Q0","Costo de instalación"]].map(function(s){
            return <div key={s[1]}>
              <div style={{fontSize:32,fontWeight:900,color:TEAL}}>{s[0]}</div>
              <div style={{fontSize:13,color:"#666",marginTop:4}}>{s[1]}</div>
            </div>;
          })}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{padding:"clamp(50px,8vw,100px) clamp(16px,4vw,60px)"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:48}}>
            <h2 style={{fontSize:"clamp(22px,3vw,36px)",fontWeight:800,color:NAVY,margin:"0 0 12px"}}>Todo lo que necesitás en un solo sistema</h2>
            <p style={{fontSize:16,color:"#666",margin:0}}>Diseñado para negocios en Guatemala — ventas, inventario, reparaciones y más</p>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:20}}>
            {features.map(function(f){
              return <div key={f.title} style={{background:"#f8f9fa",borderRadius:14,padding:"24px 20px",border:"1px solid #eee",transition:"box-shadow 0.2s"}}>
                <div style={{fontSize:32,marginBottom:12}}>{f.ic}</div>
                <h3 style={{margin:"0 0 8px",fontSize:15,fontWeight:700,color:NAVY}}>{f.title}</h3>
                <p style={{margin:0,fontSize:13,color:"#666",lineHeight:1.6}}>{f.desc}</p>
              </div>;
            })}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{background:"linear-gradient(135deg,#f0faf5 0%,#e8f4ff 100%)",padding:"clamp(50px,8vw,80px) clamp(16px,4vw,60px)"}}>
        <div style={{maxWidth:900,margin:"0 auto",textAlign:"center"}}>
          <h2 style={{fontSize:"clamp(22px,3vw,32px)",fontWeight:800,color:NAVY,margin:"0 0 12px"}}>Empezá en menos de 5 minutos</h2>
          <p style={{fontSize:15,color:"#666",margin:"0 0 40px"}}>Sin instalaciones, sin servidores, sin complicaciones</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:20}}>
            {[["1","Contactanos","Escribinos por WhatsApp o completa el formulario"],["2","Configuramos","Creamos tu cuenta y configuramos el sistema con tu información"],["3","Capacitación","Te explicamos cómo usar cada módulo en 30 minutos"],["4","¡Listo!","Empezás a vender y gestionar tu negocio de inmediato"]].map(function(s){
              return <div key={s[0]} style={{background:"#fff",borderRadius:14,padding:"24px 20px",boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
                <div style={{width:40,height:40,borderRadius:"50%",background:TEAL,color:"#fff",fontWeight:800,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"}}>{s[0]}</div>
                <h4 style={{margin:"0 0 8px",fontSize:15,fontWeight:700,color:NAVY}}>{s[1]}</h4>
                <p style={{margin:0,fontSize:13,color:"#666",lineHeight:1.5}}>{s[2]}</p>
              </div>;
            })}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="precios" style={{padding:"clamp(50px,8vw,100px) clamp(16px,4vw,60px)"}}>
        <div style={{maxWidth:950,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:48}}>
            <h2 style={{fontSize:"clamp(22px,3vw,36px)",fontWeight:800,color:NAVY,margin:"0 0 12px"}}>Planes y precios</h2>
            <p style={{fontSize:15,color:"#666",margin:0}}>Sin contratos anuales — pagás mes a mes y cancelás cuando quieras</p>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:20}}>
            {plans.map(function(p){
              return <div key={p.name} style={{borderRadius:16,padding:"28px 24px",border:p.highlight?"2px solid "+TEAL:"1px solid #eee",background:p.highlight?"linear-gradient(135deg,#f0faf5,#e8fff5)":"#fff",position:"relative",boxShadow:p.highlight?"0 8px 32px rgba(29,158,117,0.15)":"none"}}>
                {p.highlight&&<div style={{position:"absolute",top:-12,left:"50%",transform:"translateX(-50%)",background:TEAL,color:"#fff",padding:"4px 16px",borderRadius:20,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>MÁS POPULAR</div>}
                <h3 style={{margin:"0 0 6px",fontSize:18,fontWeight:800,color:p.color}}>{p.name}</h3>
                <div style={{margin:"0 0 20px"}}>
                  <span style={{fontSize:36,fontWeight:900,color:NAVY}}>{p.price}</span>
                  <span style={{fontSize:14,color:"#888"}}>{p.period}</span>
                </div>
                <ul style={{margin:"0 0 24px",padding:0,listStyle:"none"}}>
                  {p.features.map(function(f){ return <li key={f} style={{padding:"7px 0",fontSize:14,color:"#444",borderBottom:"1px solid #f0f0f0",display:"flex",gap:8,alignItems:"center"}}><span style={{color:p.color,fontWeight:700}}>✓</span>{f}</li>; })}
                </ul>
                <button onClick={function(){scrollTo("contacto");}} style={{width:"100%",padding:"12px",borderRadius:8,border:"none",background:p.highlight?TEAL:"#eee",color:p.highlight?"#fff":"#333",fontWeight:700,fontSize:14,cursor:"pointer"}}>
                  {p.highlight?"Empezar ahora →":"Solicitar info"}
                </button>
              </div>;
            })}
          </div>
        </div>
      </section>

      {/* ── CONTACT / CTA ── */}
      <section id="contacto" style={{background:NAVY,padding:"clamp(50px,8vw,100px) clamp(16px,4vw,60px)",textAlign:"center"}}>
        <div style={{maxWidth:600,margin:"0 auto"}}>
          <h2 style={{color:"#fff",fontSize:"clamp(22px,3vw,36px)",fontWeight:800,margin:"0 0 12px"}}>¿Listo para modernizar tu negocio?</h2>
          <p style={{color:"rgba(255,255,255,0.7)",fontSize:16,margin:"0 0 36px",lineHeight:1.7}}>Escribinos por WhatsApp y te hacemos una demo gratuita en menos de 24 horas.</p>
          <div style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap"}}>
            <a href={"https://wa.me/50254707112?text="+encodeURIComponent("Hola, me interesa "+APP_NAME+" para gestionar mi negocio. ¿Pueden darme más información?")}
               target="_blank" rel="noopener noreferrer"
               style={{display:"inline-block",padding:"15px 36px",borderRadius:10,border:"none",background:"#25D366",color:"#fff",fontWeight:800,fontSize:16,cursor:"pointer",textDecoration:"none",boxShadow:"0 4px 20px rgba(37,211,102,0.4)"}}>
              📱 Escribir por WhatsApp
            </a>
            <button onClick={onLogin} style={{padding:"15px 36px",borderRadius:10,border:"1px solid rgba(255,255,255,0.3)",background:"transparent",color:"#fff",fontWeight:600,fontSize:16,cursor:"pointer"}}>
              Iniciar sesión
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{background:"#0f1923",padding:"28px clamp(16px,4vw,60px)",textAlign:"center"}}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:28,height:28,borderRadius:8,background:TEAL,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:12}}>{APP_NAME[0]}</div>
            <span style={{color:"rgba(255,255,255,0.7)",fontSize:13,fontWeight:600}}>{APP_NAME} — {APP_TAGLINE}</span>
          </div>
          <span style={{color:"rgba(255,255,255,0.4)",fontSize:12}}>© {new Date().getFullYear()} — Guatemala</span>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{__html:`
        @media(max-width:640px){
          .nav-links{display:none!important}
          .menu-btn{display:block!important}
        }
      `}}/>
    </div>
  );
}

/* ── LoginScreen ── */
/* ── LoginScreen ── */
function LoginScreen(props) {
  var onLogin=props.onLogin; var onBack=props.onBack||function(){};
  var _e=useState(""); var email=_e[0]; var setEmail=_e[1];
  var _p=useState(""); var pass=_p[0]; var setPass=_p[1];
  var _sp=useState(false); var showPass=_sp[0]; var setShowPass=_sp[1];
  var _l=useState(false); var loading=_l[0]; var setLoading=_l[1];
  var _er=useState(""); var err=_er[0]; var setErr=_er[1];
  var _at=useState(0); var attempts=_at[0]; var setAttempts=_at[1];
  var _bl=useState(false); var blocked=_bl[0]; var setBlocked=_bl[1];

  // Flujo 2FA
  var _2fa=useState(false); var needs2fa=_2fa[0]; var setNeeds2fa=_2fa[1];
  var _2fe=useState(""); var twoFaEmail=_2fe[0]; var setTwoFaEmail=_2fe[1];
  var _2fc=useState(""); var twoFaCode=_2fc[0]; var setTwoFaCode=_2fc[1];
  var _2fl=useState(false); var twoFaLoading=_2fl[0]; var setTwoFaLoading=_2fl[1];
  var _2fer=useState(""); var twoFaErr=_2fer[0]; var setTwoFaErr=_2fer[1];

  // Flujo recuperación
  var _rm=useState("login"); var recMode=_rm[0]; var setRecMode=_rm[1];
  var _re=useState(""); var recEmail=_re[0]; var setRecEmail=_re[1];
  var _rq=useState(""); var recAnswer=_rq[0]; var setRecAnswer=_rq[1];
  var _np=useState(""); var newPass=_np[0]; var setNewPass=_np[1];
  var _np2=useState(""); var newPass2=_np2[0]; var setNewPass2=_np2[1];
  var _ru=useState(null); var recUser=_ru[0]; var setRecUser=_ru[1];
  var _snp=useState(false); var showNewPass=_snp[0]; var setShowNewPass=_snp[1];
  var _snp2=useState(false); var showNewPass2=_snp2[0]; var setShowNewPass2=_snp2[1];
  var _recErr=useState(""); var recErr=_recErr[0]; var setRecErr=_recErr[1];
  var _recOk=useState(""); var recOk=_recOk[0]; var setRecOk=_recOk[1];

  function handleKey(e){ if(e.key==="Enter") doLogin(); }

  async function doLogin(){
    if(blocked){setErr("Cuenta bloqueada 5 minutos por seguridad.");return;}
    if(!email.trim()||!pass){setErr("Ingresá tu email y contraseña.");return;}
    setLoading(true);setErr("");
    try {
      var apiResp=await authAPI.login(email.trim(),pass);
      if(apiResp&&apiResp.requires2fa){
        setLoading(false);
        setTwoFaEmail(apiResp.email);
        setNeeds2fa(true);
        return;
      }
      if(apiResp&&apiResp.user){
        setLoading(false);
        onLogin(createSession({id:apiResp.user.id,name:apiResp.user.name,email:apiResp.user.email,role:apiResp.user.role}));
        return;
      }
      setLoading(false);
      setErr("Error inesperado. Intenta de nuevo.");
    } catch(e){
      setLoading(false);
      var msg=(e&&e.error)?e.error:(e&&e.message)?e.message:"";
      var isNetwork=!msg||msg.toLowerCase().includes("network")||msg.toLowerCase().includes("conexion")||msg.toLowerCase().includes("fetch")||msg.toLowerCase().includes("failed");
      if(isNetwork){
        setErr("Sin conexión al servidor. Verifica tu internet e intenta de nuevo.");
      } else {
        var na=attempts+1;setAttempts(na);
        if(na>=5){setBlocked(true);setErr("5 intentos fallidos — bloqueado 5 minutos.");setTimeout(function(){setBlocked(false);setAttempts(0);setErr("");},5*60*1000);}
        else{setErr((msg||"Email o contraseña incorrectos.")+" Intentos restantes: "+(5-na));}
      }
    }
  }
  async function doVerify2fa(){
    if(!twoFaCode.trim()){setTwoFaErr("Ingresá el código.");return;}
    setTwoFaLoading(true);setTwoFaErr("");
    try {
      var r=await authAPI.verify2fa(twoFaEmail,twoFaCode.trim());
      if(r&&r.user){
        setTwoFaLoading(false);
        onLogin(createSession({id:r.user.id,name:r.user.name,email:r.user.email,role:r.user.role}));
      }
    } catch(e){
      setTwoFaLoading(false);
      setTwoFaErr((e&&e.error)?e.error:"Código incorrecto o expirado.");
    }
  }

  async function doFindUser(){
    setRecErr("");
    if(!recEmail.trim()){setRecErr("Ingresá tu email.");return;}
    try {
      var res=await authAPI.findUser(recEmail.trim());
      setRecUser({email:recEmail.trim().toLowerCase(),name:res.name,secQuestion:res.secQuestion,source:"api"});
      setRecMode("question");
    } catch(e) {
      var em=(e&&e.error)?e.error:"";
      if(em&&em!=="Error de conexion"){setRecErr(em);return;}
      var users=await db.load(UK,[]);
      var user=(users||[]).find(function(u){return u.email.toLowerCase()===recEmail.trim().toLowerCase()&&u.active;});
      if(!user){setRecErr("No se encontró una cuenta activa con ese email.");return;}
      if(!user.secQuestion){setRecErr("Esta cuenta no tiene pregunta de seguridad configurada. Contactá al administrador del sistema.");return;}
      setRecUser(Object.assign({},user,{source:"local"}));
      setRecMode("question");
    }
  }

  async function doVerifyAnswer(){
    setRecErr("");
    if(!recAnswer.trim()){setRecErr("Ingresá la respuesta.");return;}
    if(recUser&&recUser.source==="api"){
      try{ await authAPI.verifyAnswer(recUser.email,recAnswer.trim()); setRecMode("newpass"); }
      catch(e){ setRecErr((e&&e.error)?e.error:"Respuesta incorrecta."); }
      return;
    }
    var ansHash=await hashPass(recAnswer.trim().toLowerCase());
    if(ansHash!==recUser.secAnswerHash){setRecErr("Respuesta incorrecta.");return;}
    setRecMode("newpass");
  }

  async function doResetPass(){
    setRecErr("");
    if(!newPass||newPass.length<8){setRecErr("La contraseña debe tener mínimo 8 caracteres.");return;}
    if(newPass!==newPass2){setRecErr("Las contraseñas no coinciden.");return;}
    if(recUser&&recUser.source==="api"){
      try{ await authAPI.resetPassword(recUser.email,recAnswer.trim(),newPass); setRecOk("¡Contraseña actualizada! Ya podés iniciar sesión."); setRecMode("done"); }
      catch(e){ setRecErr((e&&e.error)?e.error:"No se pudo actualizar la contraseña."); }
      return;
    }
    var newHash=await hashPass(newPass);
    var users=await db.load(UK,[]);
    var updated=users.map(function(u){return u.id===recUser.id?Object.assign({},u,{passwordHash:newHash}):u;});
    await db.save(UK,updated);
    setRecOk("¡Contraseña actualizada! Ya podés iniciar sesión.");
    setRecMode("done");
  }

  var inBg={width:"100%",padding:"11px 14px",borderRadius:8,border:"1px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.08)",color:"#fff",fontSize:14,boxSizing:"border-box",outline:"none"};
  var lblSt={color:"rgba(255,255,255,0.6)",fontSize:12,marginBottom:6,display:"block",textTransform:"uppercase",letterSpacing:"0.5px"};
  var btnPrimary={width:"100%",padding:"12px",borderRadius:8,border:"none",cursor:"pointer",background:TEAL,color:"#fff",fontSize:15,fontWeight:700};
  var btnSecondary={width:"100%",padding:"10px",borderRadius:8,border:"1px solid rgba(255,255,255,0.15)",background:"transparent",color:"rgba(255,255,255,0.6)",fontSize:13,cursor:"pointer",marginTop:10};

  function renderPassField(label,val,setter,show,setShow){
    return (
        <div style={{marginBottom:18}}>
          <label style={lblSt}>{label}</label>
          <div style={{position:"relative"}}>
            <input type={show?"text":"password"} style={Object.assign({},inBg,{paddingRight:44})} value={val} placeholder="••••••••"
                   onChange={function(e){setter(e.target.value);setRecErr("");}} onKeyDown={function(e){if(e.key==="Enter"&&recMode==="newpass")doResetPass();}}/>
            <span onClick={function(){setShow(!show);}} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",cursor:"pointer",color:"rgba(255,255,255,0.4)",fontSize:16,userSelect:"none"}}>
            {show?"🙈":"👁"}
          </span>
          </div>
        </div>
    );
  }

  return (
      <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0e1e2e 0%,"+NAVY+" 60%,#1a3a2a 100%)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div style={{width:"100%",maxWidth:400}}>

          {/* Logo */}
          <div style={{textAlign:"center",marginBottom:32}}>
            <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:64,height:64,borderRadius:16,background:"linear-gradient(135deg,"+TEAL+",#0a6b4a)",marginBottom:16,boxShadow:"0 8px 24px rgba(29,158,117,0.4)"}}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
                <rect x="5" y="2" width="14" height="20" rx="2.5" stroke="white" strokeWidth="1.8"/>
                <circle cx="12" cy="17.5" r="1.4" fill="white"/>
                <line x1="9" y1="5.5" x2="15" y2="5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <p style={{color:"#fff",fontSize:26,fontWeight:800,margin:"0 0 4px",letterSpacing:"-0.5px"}}>{APP_NAME}</p>
            <p style={{color:TEAL,fontSize:13,fontWeight:600,margin:0,letterSpacing:"1px"}}>{APP_TAGLINE}</p>
          </div>

          <div style={{background:"rgba(255,255,255,0.05)",borderRadius:16,border:"1px solid rgba(255,255,255,0.1)",padding:32}}>

            {/* ── MODO 2FA ── */}
            {needs2fa&&(
              <div>
                <p style={{color:"#fff",fontSize:18,fontWeight:700,margin:"0 0 8px",textAlign:"center"}}>Verificación en dos pasos</p>
                <p style={{color:"#aaa",fontSize:13,textAlign:"center",margin:"0 0 24px"}}>Ingresá el código de 6 dígitos que enviamos a tu correo. Válido por 10 minutos.</p>
                {twoFaErr&&<div style={{background:"rgba(226,75,74,0.15)",border:"1px solid rgba(226,75,74,0.4)",borderRadius:8,padding:"10px 14px",marginBottom:16,color:"#F09595",fontSize:13}}>⚠ {twoFaErr}</div>}
                <input
                  value={twoFaCode} onChange={function(e){setTwoFaCode(e.target.value);}}
                  onKeyDown={function(e){if(e.key==="Enter")doVerify2fa();}}
                  placeholder="Código de 6 dígitos"
                  maxLength={6}
                  inputMode="numeric"
                  style={{width:"100%",padding:"12px 14px",borderRadius:8,border:"1px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.08)",color:"#fff",fontSize:22,textAlign:"center",letterSpacing:8,outline:"none",boxSizing:"border-box",marginBottom:16}}
                />
                <button onClick={doVerify2fa} disabled={twoFaLoading} style={{width:"100%",padding:"13px",borderRadius:8,border:"none",background:TEAL,color:"#fff",fontWeight:700,fontSize:15,cursor:"pointer"}}>
                  {twoFaLoading?"Verificando...":"Verificar código"}
                </button>
                <button onClick={function(){setNeeds2fa(false);setTwoFaCode("");setTwoFaErr("");}} style={{width:"100%",marginTop:10,padding:"10px",borderRadius:8,border:"1px solid rgba(255,255,255,0.15)",background:"transparent",color:"#aaa",fontSize:13,cursor:"pointer"}}>
                  ← Volver al login
                </button>
              </div>
            )}

            {/* ── MODO LOGIN ── */}
            {!needs2fa&&recMode==="login"&&(
                <div>
                  <p style={{color:"#fff",fontSize:18,fontWeight:700,margin:"0 0 24px",textAlign:"center"}}>Iniciar sesión</p>
                  {err&&<div style={{background:"rgba(226,75,74,0.15)",border:"1px solid rgba(226,75,74,0.4)",borderRadius:8,padding:"10px 14px",marginBottom:16,color:"#F09595",fontSize:13}}>⚠ {err}</div>}
                  <div style={{marginBottom:14}}>
                    <label style={lblSt}>Correo electrónico</label>
                    <input type="email" style={inBg} value={email} placeholder="tu@correo.com"
                           onChange={function(e){setEmail(e.target.value);setErr("");}} onKeyDown={handleKey}/>
                  </div>
                  <div style={{marginBottom:8}}>
                    <label style={lblSt}>Contraseña</label>
                    <div style={{position:"relative"}}>
                      <input type={showPass?"text":"password"} style={Object.assign({},inBg,{paddingRight:44})} value={pass} placeholder="••••••••"
                             onChange={function(e){setPass(e.target.value);setErr("");}} onKeyDown={handleKey}/>
                      <span onClick={function(){setShowPass(!showPass);}} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",cursor:"pointer",color:"rgba(255,255,255,0.4)",fontSize:16,userSelect:"none"}}>
                    {showPass?"🙈":"👁"}
                  </span>
                    </div>
                  </div>
                  <div style={{textAlign:"right",marginBottom:20}}>
                <span onClick={function(){setRecMode("recover");setRecErr("");setRecEmail("");}}
                      style={{color:TEAL,fontSize:12,cursor:"pointer",textDecoration:"underline"}}>
                  ¿Olvidaste tu contraseña?
                </span>
                  </div>
                  <button onClick={doLogin} disabled={loading||blocked}
                          style={Object.assign({},btnPrimary,{background:loading||blocked?"rgba(255,255,255,0.1)":TEAL,cursor:loading||blocked?"not-allowed":"pointer"})}>
                    {loading?"Verificando...":blocked?"🔒 Bloqueado":"Ingresar al sistema"}
                  </button>
                  <button onClick={onBack} style={{marginTop:12,width:"100%",padding:"10px",borderRadius:8,border:"1px solid rgba(255,255,255,0.2)",background:"transparent",color:"rgba(255,255,255,0.6)",fontSize:13,cursor:"pointer"}}>← Volver al inicio</button>
                </div>
            )}

            {/* ── MODO RECUPERAR — buscar email ── */}
            {recMode==="recover"&&(
                <div>
                  <p style={{color:"#fff",fontSize:18,fontWeight:700,margin:"0 0 8px",textAlign:"center"}}>Recuperar acceso</p>
                  <p style={{color:"rgba(255,255,255,0.5)",fontSize:13,margin:"0 0 24px",textAlign:"center"}}>Ingresá tu correo para verificar tu identidad</p>
                  {recErr&&<div style={{background:"rgba(226,75,74,0.15)",border:"1px solid rgba(226,75,74,0.4)",borderRadius:8,padding:"10px 14px",marginBottom:16,color:"#F09595",fontSize:13}}>⚠ {recErr}</div>}
                  <div style={{marginBottom:20}}>
                    <label style={lblSt}>Correo electrónico</label>
                    <input type="email" style={inBg} value={recEmail} placeholder="tu@correo.com"
                           onChange={function(e){setRecEmail(e.target.value);setRecErr("");}}
                           onKeyDown={function(e){if(e.key==="Enter")doFindUser();}}/>
                  </div>
                  <button onClick={doFindUser} style={btnPrimary}>Continuar</button>
                  <button onClick={function(){setRecMode("login");setRecErr("");}} style={btnSecondary}>← Volver al login</button>
                </div>
            )}

            {/* ── MODO PREGUNTA DE SEGURIDAD ── */}
            {recMode==="question"&&recUser&&(
                <div>
                  <p style={{color:"#fff",fontSize:18,fontWeight:700,margin:"0 0 8px",textAlign:"center"}}>Verificación de identidad</p>
                  <p style={{color:"rgba(255,255,255,0.5)",fontSize:13,margin:"0 0 24px",textAlign:"center"}}>Respondé tu pregunta de seguridad</p>
                  {recErr&&<div style={{background:"rgba(226,75,74,0.15)",border:"1px solid rgba(226,75,74,0.4)",borderRadius:8,padding:"10px 14px",marginBottom:16,color:"#F09595",fontSize:13}}>⚠ {recErr}</div>}
                  <div style={{background:"rgba(29,158,117,0.1)",borderRadius:8,padding:"12px 14px",marginBottom:20,border:"1px solid rgba(29,158,117,0.2)"}}>
                    <p style={{color:"rgba(255,255,255,0.5)",fontSize:11,margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.5px"}}>Pregunta de seguridad</p>
                    <p style={{color:"#fff",fontSize:14,margin:0,fontWeight:500}}>{recUser.secQuestion}</p>
                  </div>
                  <div style={{marginBottom:20}}>
                    <label style={lblSt}>Tu respuesta</label>
                    <input type="text" style={inBg} value={recAnswer} placeholder="Ingresá tu respuesta..."
                           onChange={function(e){setRecAnswer(e.target.value);setRecErr("");}}
                           onKeyDown={function(e){if(e.key==="Enter")doVerifyAnswer();}}/>
                  </div>
                  <button onClick={doVerifyAnswer} style={btnPrimary}>Verificar respuesta</button>
                  <button onClick={function(){setRecMode("login");setRecErr("");setRecAnswer("");}} style={btnSecondary}>← Volver al login</button>
                </div>
            )}

            {/* ── MODO NUEVA CONTRASEÑA ── */}
            {recMode==="newpass"&&(
                <div>
                  <p style={{color:"#fff",fontSize:18,fontWeight:700,margin:"0 0 8px",textAlign:"center"}}>Nueva contraseña</p>
                  <p style={{color:"rgba(255,255,255,0.5)",fontSize:13,margin:"0 0 24px",textAlign:"center"}}>Ingresá tu nueva contraseña (mín. 8 caracteres)</p>
                  {recErr&&<div style={{background:"rgba(226,75,74,0.15)",border:"1px solid rgba(226,75,74,0.4)",borderRadius:8,padding:"10px 14px",marginBottom:16,color:"#F09595",fontSize:13}}>⚠ {recErr}</div>}
                  {renderPassField("Nueva contraseña",newPass,setNewPass,showNewPass,setShowNewPass)}
                  {renderPassField("Confirmar contraseña",newPass2,setNewPass2,showNewPass2,setShowNewPass2)}
                  <button onClick={doResetPass} style={btnPrimary}>Guardar nueva contraseña</button>
                </div>
            )}

            {/* ── MODO DONE ── */}
            {recMode==="done"&&(
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:48,marginBottom:16}}>✅</div>
                  <p style={{color:"#fff",fontSize:18,fontWeight:700,margin:"0 0 8px"}}>¡Listo!</p>
                  <p style={{color:"rgba(255,255,255,0.6)",fontSize:14,margin:"0 0 24px"}}>{recOk}</p>
                  <button onClick={function(){setRecMode("login");setEmail(recUser.email);setPass("");setRecUser(null);setRecAnswer("");setNewPass("");setNewPass2("");}} style={btnPrimary}>
                    Ir al login
                  </button>
                </div>
            )}

          </div>
          <p style={{color:"rgba(255,255,255,0.2)",fontSize:11,textAlign:"center",marginTop:16}}>
            Sesión expira en 8 horas · Bloqueo tras 5 intentos fallidos
          </p>
        </div>
      </div>
  );
}
/* ── UsersScreen ── */
function UsersScreen(props) {
  var session=props.session; var showFlash=props.showFlash;
  var _u=useState([]); var users=_u[0]; var setUsers=_u[1];
  var _uld=useState(false); var usersLoaded=_uld[0]; var setUsersLoaded=_uld[1];
  var _sf=useState(false); var showForm=_sf[0]; var setShowForm=_sf[1];
  var _eu=useState(null); var editUser=_eu[0]; var setEditUser=_eu[1];
  var _fn=useState(""); var fName=_fn[0]; var setFName=_fn[1];
  var _fe=useState(""); var fEmail=_fe[0]; var setFEmail=_fe[1];
  var _fp=useState(""); var fPass=_fp[0]; var setFPass=_fp[1];
  var _fr=useState("cajero"); var fRole=_fr[0]; var setFRole=_fr[1];
  var _fer=useState(""); var fErr=_fer[0]; var setFErr=_fer[1];
  var _fsq=useState(""); var fSecQ=_fsq[0]; var setFSecQ=_fsq[1];
  var _fsa=useState(""); var fSecA=_fsa[0]; var setFSecA=_fsa[1];

  useEffect(function(){
    async function load(){
      var u=await db.load(UK,[]);
      setUsers(u||[]);
      try {
        var apiUsers=await usersAPI.getAll();
        if(apiUsers&&apiUsers.length>0){
          var merged=apiUsers.map(function(au){
            var local=(u||[]).find(function(lu){return lu.email.toLowerCase()===au.email.toLowerCase();});
            return {id:au.id,name:au.name,email:au.email,role:au.role,active:au.active,
              passwordHash:local?local.passwordHash:"",secQuestion:au.sec_question||(local?local.secQuestion:""),
              secAnswerHash:local?local.secAnswerHash:"",lastLogin:au.last_login||null,
              createdAt:au.created_at||new Date().toISOString()};
          });
          setUsers(merged);
          await db.save(UK,merged);
        }
      } catch(e){ console.warn("No se pudo cargar usuarios desde API:",e); }
      setUsersLoaded(true);
    }
    load();
  },[]);
  useEffect(function(){if(usersLoaded)db.save(UK,users);},[users,usersLoaded]);

  function resetForm(){setFName("");setFEmail("");setFPass("");setFRole("cajero");setFErr("");setFSecQ("");setFSecA("");setEditUser(null);setShowForm(false);}

  async function saveUser(){
    if(!fName.trim()||!fEmail.trim()){setFErr("Nombre y email son obligatorios");return;}
    var dup=users.find(function(u){return u.email.toLowerCase()===fEmail.trim().toLowerCase()&&(!editUser||u.id!==editUser.id);});
    if(dup){setFErr("Ya existe un usuario con ese email");return;}
    if(!editUser&&!fPass.trim()){setFErr("La contraseña es obligatoria para usuarios nuevos");return;}
    if(fPass&&fPass.length<8){setFErr("Contraseña: mínimo 8 caracteres");return;}
    var hash=fPass?await hashPass(fPass):(editUser?editUser.passwordHash:"");
    var secAnswerHash=fSecA?await hashPass(fSecA.trim().toLowerCase()):(editUser?editUser.secAnswerHash:"");
    var secQuestion=fSecQ||(editUser?editUser.secQuestion:"");
    if(editUser){
      setUsers(function(p){return p.map(function(u){return u.id===editUser.id?Object.assign({},u,{name:fName.trim(),email:fEmail.trim(),role:fRole,passwordHash:hash,secQuestion:secQuestion,secAnswerHash:secAnswerHash}):u;});});
      try{ var upd={name:fName.trim(),email:fEmail.trim(),role:fRole,active:editUser.active,secQuestion:fSecQ}; if(fPass)upd.password=fPass; if(fSecA)upd.secAnswer=fSecA; await usersAPI.update(editUser.id,upd); }catch(e){ console.warn("Sync Supabase user update:",e); }
      showFlash("✓ Usuario actualizado","ok");
    } else {
      setUsers(function(p){return p.concat([{id:gid(),name:fName.trim(),email:fEmail.trim(),passwordHash:hash,role:fRole,active:true,createdAt:new Date().toISOString(),secQuestion:secQuestion,secAnswerHash:secAnswerHash}]);});
      try{ await usersAPI.create({name:fName.trim(),email:fEmail.trim(),password:fPass,role:fRole,secQuestion:fSecQ,secAnswer:fSecA}); }catch(e){ console.warn("Sync Supabase user create:",e); }
      showFlash("✓ Usuario creado","ok");
    }
    resetForm();
  }

  async function toggleActive(uid){
    if(uid===session.userId){showFlash("No podés desactivar tu propia cuenta","warn");return;}
    var admins=users.filter(function(u){return u.role==="admin"&&u.active;});
    var tgt=users.find(function(u){return u.id===uid;});
    if(tgt&&tgt.role==="admin"&&admins.length<=1&&tgt.active){showFlash("Debe existir al menos un administrador activo","warn");return;}
    var newActive=!tgt.active;
    setUsers(function(p){return p.map(function(u){return u.id===uid?Object.assign({},u,{active:newActive}):u;});});
    try{ await usersAPI.update(uid,{active:newActive}); }catch(e){ console.warn("Sync Supabase toggleActive:",e); }
  }

  function startEdit(u){setEditUser(u);setFName(u.name);setFEmail(u.email);setFPass("");setFRole(u.role);setFErr("");setFSecQ(u.secQuestion||"");setFSecA("");setShowForm(true);}

  return (
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <p style={H1}>👥 Usuarios del Sistema</p>
          <button style={mB("teal")} onClick={function(){resetForm();setShowForm(true);}}>+ Nuevo usuario</button>
        </div>
        {showForm&&(
            <div style={Object.assign({},sC,{marginBottom:16,borderColor:TEAL,borderWidth:"1.5px"})}>
              <p style={{fontWeight:600,margin:"0 0 16px",fontSize:15}}>{editUser?"✏️ Editar usuario":"➕ Nuevo usuario"}</p>
              {fErr&&<p style={{color:"#E24B4A",fontSize:13,margin:"0 0 10px"}}>⚠ {fErr}</p>}
              <div className="form-grid-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                <div><label style={sL}>Nombre</label><input style={sI} value={fName} placeholder="Nombre completo" onChange={function(e){setFErr("");setFName(e.target.value);}}/></div>
                <div><label style={sL}>Email</label><input type="email" style={sI} value={fEmail} placeholder="email@ejemplo.com" onChange={function(e){setFErr("");setFEmail(e.target.value);}}/></div>
                <div><label style={sL}>{editUser?"Nueva contraseña (vacío = no cambiar)":"Contraseña (mín. 8 chars)"}</label><input type="password" style={sI} value={fPass} placeholder="••••••••" onChange={function(e){setFErr("");setFPass(e.target.value);}}/></div>
                <div><label style={sL}>Pregunta de seguridad</label>
                  <select style={sI} value={fSecQ} onChange={function(e){setFSecQ(e.target.value);}}>
                    <option value="">— Seleccioná una pregunta —</option>
                    <option value="¿Cuál es el nombre de tu primera mascota?">¿Cuál es el nombre de tu primera mascota?</option>
                    <option value="¿En qué ciudad naciste?">¿En qué ciudad naciste?</option>
                    <option value="¿Cuál es el apellido de soltera de tu madre?">¿Cuál es el apellido de soltera de tu madre?</option>
                    <option value="¿Cuál fue el nombre de tu primera escuela?">¿Cuál fue el nombre de tu primera escuela?</option>
                    <option value="¿Cuál es tu comida favorita?">¿Cuál es tu comida favorita?</option>
                  </select></div>
                <div><label style={sL}>Respuesta de seguridad</label><input type="text" style={sI} value={fSecA} placeholder="Tu respuesta (no distingue mayúsculas)" onChange={function(e){setFErr("");setFSecA(e.target.value);}}/></div>            <div><label style={sL}>Rol</label>
                <select style={sI} value={fRole} onChange={function(e){setFRole(e.target.value);}}>
                  <option value="admin">Administrador</option>
                  <option value="cajero">Cajero</option>
                  <option value="auditor">Auditor (solo lectura)</option>
                </select></div>
              </div>
              <div style={{background:"#f5f4f0",borderRadius:8,padding:"8px 14px",marginBottom:12,fontSize:12,color:"#666"}}>
                <b>Acceso del rol:</b> {(PERMS[fRole]||[]).join(" · ")}
              </div>
              <div style={{display:"flex",gap:10}}>
                <button style={mB("teal")} onClick={saveUser}>{editUser?"Guardar cambios":"Crear usuario"}</button>
                <button style={mB("gray")} onClick={resetForm}>Cancelar</button>
              </div>
            </div>
        )}
        <div className="rg-3" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
          <MetricBox label="Total usuarios"  value={users.length} color={TEAL}/>
          <MetricBox label="Activos"         value={users.filter(function(u){return u.active;}).length} color="#378ADD"/>
          <MetricBox label="Administradores" value={users.filter(function(u){return u.role==="admin";}).length} color="#7F77DD"/>
        </div>
        {(function(){var userPag=usePaginator(users,15); return (
        <div style={sC}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["#","Nombre","Email","Rol","Estado","Seguridad","Último acceso",""].map(function(h){return <th key={h} style={h==="#"?Object.assign({},sTH,{width:40,textAlign:"center"}):sTH}>{h}</th>;})}</tr></thead>
            <tbody>
            {userPag.paged.map(function(u,index){
              var isSelf=u.id===session.userId;
              return (
                  <tr key={u.id}>
                    <td style={{...sTD,textAlign:"center",color:"#999",fontSize:12}}>{userPag.offset+index+1}</td>
                    <td style={Object.assign({},sTD,{fontWeight:600})}>{u.name}{isSelf&&<span style={{fontSize:11,color:TEAL,marginLeft:6}}>(tú)</span>}</td>
                    <td style={Object.assign({},sTD,{fontFamily:"monospace",fontSize:12})}>{u.email}</td>
                    <td style={sTD}><span style={mBg(u.role==="admin"?"teal":u.role==="cajero"?"blue":"purple")}>{ROLE_LABEL[u.role]||u.role}</span></td>
                    <td style={sTD}><span style={mBg(u.active?"green":"red")}>{u.active?"✓ Activo":"✗ Inactivo"}</span></td>
                    <td style={sTD}><span style={mBg(u.secQuestion?"green":"amber")}>{u.secQuestion?"✓ Configurada":"⚠ Sin configurar"}</span></td>
                    <td style={Object.assign({},sTD,{color:"#666",fontSize:12})}>{u.lastLogin?fmtD(u.lastLogin)+" "+fmtT(u.lastLogin):"Nunca"}</td>
                    <td style={sTD}>
                      <div style={{display:"flex",gap:6}}>
                        <button style={Object.assign({},mB("blue"),{padding:"4px 8px",fontSize:11})} onClick={function(){startEdit(u);}}>✏</button>
                        <button style={Object.assign({},mB(u.active?"red":"green"),{padding:"4px 8px",fontSize:11})} onClick={function(){toggleActive(u.id);}}>{u.active?"Desactivar":"Activar"}</button>
                      </div>
                    </td>
                  </tr>
              );
            })}
            </tbody>
          </table>
          <userPag.Pager/>
        </div>
        );}())}
      </div>
  );
}

/* ── Theme CSS ── */
var THEME_CSS = `
/* Colores de tema — el resto está en src/styles/global.css */

[data-theme="light"] {
  --bg-main: #eceae4;
  --bg-card: #ffffff;
  --bg-input: #ffffff;
  --bg-sidebar: #1a2535;
  --bg-hover: rgba(255,255,255,0.1);
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --text-muted: #999999;
  --border-card: rgba(0,0,0,0.09);
  --border-input: rgba(0,0,0,0.2);
  --border-table: rgba(0,0,0,0.08);
  --border-row: rgba(0,0,0,0.05);
  --bg-table-head: #f5f4f0;
  --bg-alt: #f5f4f0;
  --bg-row: transparent;
  --bg-error: #FDECEA;
  --text-error: #791F1F;
  --shadow: rgba(0,0,0,0.05);
}
[data-theme="dark"] {
  --bg-main: #0f1923;
  --bg-card: #1a2535;
  --bg-input: #243044;
  --bg-sidebar: #0d1520;
  --bg-hover: rgba(255,255,255,0.08);
  --text-primary: #e8eaed;
  --text-secondary: #9aa0ab;
  --text-muted: #666e7a;
  --border-card: rgba(255,255,255,0.08);
  --border-input: rgba(255,255,255,0.15);
  --border-table: rgba(255,255,255,0.07);
  --border-row: rgba(255,255,255,0.04);
  --bg-table-head: #1f2e42;
  --bg-alt: #1f2e42;
  --bg-row: transparent;
  --bg-error: #3d1f1f;
  --text-error: #f4a0a0;
  --shadow: rgba(0,0,0,0.3);
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
  return (
      <div style={{background:"#f5f4f0",borderRadius:10,padding:"16px",border:"1px solid rgba(0,0,0,0.07)"}}>
        <p style={{fontSize:12,color:"#666",margin:"0 0 6px"}}>{props.label}</p>
        <p style={{fontSize:22,fontWeight:600,margin:0,color:props.color||"#1a1a1a"}}>{props.value}</p>
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
var FORM_FIELDS = [
  {k:"name",     l:"Nombre",              ph:"Ej: Pantalla...", tp:"text"  },
  {k:"category", l:"Categoría",           ph:"Pantallas",       tp:"text"  },
  {k:"shelf",    l:"Estantería",          ph:"A-01",            tp:"text"  },
  {k:"price",    l:"Precio venta (Q)",    ph:"0.00",            tp:"number"},
  {k:"cost",     l:"Costo (Q)",           ph:"0.00",            tp:"number"},
  {k:"stock",    l:"Stock actual",        ph:"0",               tp:"number"},
  {k:"minStock", l:"Stock mínimo (alerta)",ph:"5",              tp:"number"},
  {k:"unit",     l:"Unidad",              ph:"uni / serv",      tp:"text"  },
];
function ProductForm(props) {
  var product=props.product; var onSave=props.onSave; var onCancel=props.onCancel;
  var _s=useState(Object.assign({},product)); var form=_s[0]; var setForm=_s[1];
  var _e=useState(""); var err=_e[0]; var setErr=_e[1];
  function set(k,v){ setForm(function(f){ var n=Object.assign({},f); n[k]=v; return n; }); }
  function doSave(){
    if(!form.name||!form.name.trim()){setErr("El nombre es obligatorio");return;}
    onSave(Object.assign({},form,{price:parseFloat(form.price)||0,cost:parseFloat(form.cost)||0,stock:parseInt(form.stock)||0,minStock:parseInt(form.minStock)||0}));
  }
  return (
      <div style={Object.assign({},sC,{marginBottom:16,borderColor:TEAL,borderWidth:"1.5px"})}>
        <p style={{fontWeight:600,margin:"0 0 14px",fontSize:15}}>{product.id?"✏️ Editar":"➕ Nuevo Producto"}</p>
        {err&&<p style={{color:"#E24B4A",fontSize:13,margin:"0 0 10px"}}>⚠ {err}</p>}
        <div className="rg-4" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:14}}>
          {FORM_FIELDS.map(function(f){
            return (
                <div key={f.k}>
                  <label style={sL}>{f.l}</label>
                  <input type={f.tp} style={sI} value={form[f.k]||""} placeholder={f.ph}
                         onChange={function(e){setErr("");set(f.k,e.target.value);}}/>
                </div>
            );
          })}
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
    {id:"inventory", ic:"🗄️", lb:"Inventario"},
    {id:"history",   ic:"📋", lb:"Historial"},
    {id:"warranties", ic:"🛡️", lb:"Garantías"},
    {id:"cuadres",   ic:"📈", lb:"Cuadres"},
    {id:"audit",     ic:"🔍", lb:"Auditoría"},
    {id:"backup",    ic:"💾", lb:"Respaldo"},
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
                <div key={item.id} className="sidebar-nav-item" tabIndex={isActive?0:-1} onClick={function(){setView(item.id);setSidebarOpen(false);}} onKeyDown={function(e){if(e.key==="Enter")setView(item.id);}} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",cursor:"pointer",background:isActive?"rgba(255,255,255,0.1)":"transparent",color:isActive?"#fff":"rgba(255,255,255,0.52)",fontSize:13,borderLeft:isActive?"3px solid "+TEAL:"3px solid transparent",marginBottom:1}}>
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

function DashboardScreen(props) {
  var sales=props.sales; var todaySales=props.todaySales;
  var pendingAccs=props.pendingAccs; var totalPend=props.totalPend;
  var products=props.products; var top5=props.top5;
  var setSelectedSale=props.setSelectedSale; var setView=props.setView;
  var accounts=props.accounts; var returns=props.returns;
  var repairs=props.repairs||[]; var warranties=props.warranties||[];

  var _chartRange=useState("7d"); var chartRange=_chartRange[0]; var setChartRange=_chartRange[1];

  var now=new Date();
  var todaySalesCobradas=todaySales.filter(function(s){return s.status==='completado';});
  var todayRev=todaySales.reduce(function(s,x){return s+x.total;},0); // total vendido (incluye crédito)
  var todayRevCobrado=todaySalesCobradas.reduce(function(s,x){return s+x.total;},0); // solo cobrado hoy
  var todayStr=now.toDateString();

  // Ventas por día según rango seleccionado
  var DIAS=["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
  var MESES=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  var chartDays=chartRange==="30d"?30:chartRange==="14d"?14:7;
  var chartData=Array.from({length:chartDays},function(_,i){
    var d=new Date(); d.setDate(d.getDate()-(chartDays-1-i)); d.setHours(0,0,0,0);
    var dStr=d.toDateString();
    var daySales=sales.filter(function(s){return new Date(s.date).toDateString()===dStr&&s.status!=='anulado';});
    var rev=daySales.reduce(function(a,s){return a+s.total;},0);
    var cnt=daySales.length;
    var label=chartDays===7?DIAS[d.getDay()]:(d.getDate()+"/"+(d.getMonth()+1));
    return {label:label,ingresos:Math.round(rev*100)/100,ventas:cnt,isToday:dStr===todayStr};
  });

  // Ingresos últimos 6 meses (área)
  var last6months=Array.from({length:6},function(_,i){
    var d=new Date(now.getFullYear(),now.getMonth()-5+i,1);
    var mStart=new Date(d.getFullYear(),d.getMonth(),1);
    var mEnd=new Date(d.getFullYear(),d.getMonth()+1,0,23,59,59);
    var rev=sales.filter(function(s){var sd=new Date(s.date);return sd>=mStart&&sd<=mEnd&&s.status!=='anulado';}).reduce(function(a,s){return a+s.total;},0);
    return {label:MESES[d.getMonth()],ingresos:Math.round(rev*100)/100};
  });

  // Métodos de pago para PieChart (incluye crédito como categoría, excluye anuladas)
  var metodoColors={"Efectivo":"#1D9E75","Tarjeta":"#378ADD","Transferencia":"#7C4DFF","Mixto":"#E65100","Crédito":"#F59E0B"};
  var metodosMap={};
  sales.forEach(function(s){
    if(s.status==='anulado') return;
    var key = s.status==='cuenta' ? 'Crédito' : (s.method||'Efectivo');
    metodosMap[key]=(metodosMap[key]||0)+s.total;
  });
  var metodosPie=Object.keys(metodosMap).map(function(m){return {name:m,value:Math.round(metodosMap[m]*100)/100,color:metodoColors[m]||"#888"};});

  // Top 5 para BarChart
  var top5Bar=top5.slice(0,5).map(function(item){return {name:item[0].length>16?item[0].slice(0,14)+"…":item[0],unidades:item[1]};});

  var cajaDia=todaySalesCobradas.filter(function(s){return s.method==="Efectivo";}).reduce(function(s,x){return s+x.total;},0);
  var returnsDia=returns.filter(function(r){return new Date(r.date).toDateString()===todayStr&&r.refundMethod==="Efectivo"&&r.refundAmount>0;}).reduce(function(s,r){return s+r.refundAmount;},0);
  var saldoCaja=cajaDia-returnsDia;

  // Reparaciones
  var repsActivas=repairs.filter(function(r){return r.status!=="entregado";});
  var repsListas=repairs.filter(function(r){return r.status==="listo";});
  var repsVencidas=repairs.filter(function(r){
    return r.status!=="entregado"&&r.promisedDate&&new Date(r.promisedDate+"T23:59:59")<now;
  });

  // Stock
  var stockAlertas=products.filter(function(p){return p.unit!=="serv"&&p.minStock>0&&p.stock<=p.minStock;});
  var stockCero=products.filter(function(p){return p.unit!=="serv"&&p.stock===0;});

  // Cuentas vencidas >30 días
  var cuentasVencidas=pendingAccs.filter(function(a){return (now-new Date(a.date))>30*86400000;});

  // Garantías por vencer
  var warPorVencer=warranties.filter(function(w){
    if(w.status==="reclamada") return false;
    var diff=(new Date(w.endDate)-now)/86400000;
    return diff<=7;
  });

  var hasAlerts=repsVencidas.length>0||stockCero.length>0||cuentasVencidas.length>0||warPorVencer.length>0;

  // Recordatorio de respaldo semanal
  var lastBackupTs=null; try{ lastBackupTs=localStorage.getItem("mnpos-last-backup"); }catch(e){}
  var backupDaysSince=lastBackupTs?Math.floor((new Date()-new Date(lastBackupTs))/86400000):null;
  var needsBackupAlert=backupDaysSince===null||backupDaysSince>=7;

  // Tooltip personalizado para gráficas
  function CustomTooltipIngresos(p){
    if(!p.active||!p.payload||!p.payload.length) return null;
    return (
      <div style={{background:"#fff",border:"1px solid #eee",borderRadius:8,padding:"8px 12px",fontSize:12,boxShadow:"0 2px 8px rgba(0,0,0,0.12)"}}>
        <p style={{margin:"0 0 4px",fontWeight:700,color:NAVY}}>{p.label}</p>
        <p style={{margin:0,color:TEAL}}>Q {Number(p.payload[0].value).toLocaleString("es-GT",{minimumFractionDigits:2})}</p>
        {p.payload[1]&&<p style={{margin:0,color:"#666"}}>{p.payload[1].value} venta{p.payload[1].value!==1?"s":""}</p>}
      </div>
    );
  }

  function CustomTooltipPie(p){
    if(!p.active||!p.payload||!p.payload.length) return null;
    var d=p.payload[0];
    return (
      <div style={{background:"#fff",border:"1px solid #eee",borderRadius:8,padding:"8px 12px",fontSize:12,boxShadow:"0 2px 8px rgba(0,0,0,0.12)"}}>
        <p style={{margin:"0 0 4px",fontWeight:700,color:d.payload.color}}>{d.name}</p>
        <p style={{margin:0}}>Q {Number(d.value).toLocaleString("es-GT",{minimumFractionDigits:2})}</p>
      </div>
    );
  }

  return (
    <div>
      <p style={H1}>📊 Panel de Control<HelpTip text={"Vista general del negocio en tiempo real.\n\n• Ventas hoy: cantidad de transacciones del día (efectivo + crédito)\n• Vendido hoy: valor total de lo vendido hoy (incluye crédito)\n• Saldo de caja: efectivo cobrado hoy menos reembolsos en efectivo\n• Por cobrar: total de créditos pendientes de pago\n\nLas alertas rojas arriba indican reparaciones vencidas, productos sin stock o cuentas con más de 30 días sin pagar."}/></p>

      {/* Alertas */}
      {hasAlerts&&(
        <div style={{background:"#FCEBEB",border:"1px solid #F09595",borderRadius:10,padding:"12px 16px",marginBottom:16}}>
          <p style={{fontWeight:700,fontSize:13,color:"#791F1F",margin:"0 0 8px"}}>⚠ Atención requerida</p>
          <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
            {repsVencidas.length>0&&<span style={{fontSize:13,color:"#791F1F",cursor:"pointer"}} onClick={function(){setView("repairs");}}>🔧 {repsVencidas.length} reparación{repsVencidas.length>1?"es":""} vencida{repsVencidas.length>1?"s":""} →</span>}
            {stockCero.length>0&&<span style={{fontSize:13,color:"#791F1F",cursor:"pointer"}} onClick={function(){setView("products");}}>📦 {stockCero.length} producto{stockCero.length>1?"s":""} sin stock →</span>}
            {cuentasVencidas.length>0&&<span style={{fontSize:13,color:"#791F1F",cursor:"pointer"}} onClick={function(){setView("accounts");}}>💳 {cuentasVencidas.length} cuenta{cuentasVencidas.length>1?"s":""} +30 días →</span>}
            {warPorVencer.length>0&&<span style={{fontSize:13,color:"#791F1F",cursor:"pointer"}} onClick={function(){setView("warranties");}}>🛡️ {warPorVencer.length} garantía{warPorVencer.length>1?"s":""} por vencer →</span>}
          </div>
        </div>
      )}

      {/* Recordatorio respaldo */}
      {needsBackupAlert&&<div style={{background:"#FFF8E6",border:"1px solid #F5C842",borderRadius:10,padding:"10px 16px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
        <span style={{fontSize:13,color:"#7A5000"}}>💾 {lastBackupTs?"Hace "+backupDaysSince+" días sin respaldo — ":"Sin respaldo registrado — "}se recomienda respaldar semanalmente.</span>
        <span style={{fontSize:12,color:"#7A5000",fontWeight:600,cursor:"pointer",textDecoration:"underline"}} onClick={function(){props.setView&&props.setView("backup");}}>Ir a Respaldo →</span>
      </div>}

      {/* KPIs */}
      <div className="rg-4" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:16}}>
        <MetricBox label="Ventas hoy"     value={todaySales.length}      color={TEAL}/>
        <MetricBox label="Vendido hoy"    value={Q(todayRev)}            color="#378ADD"/>
        <MetricBox label="Saldo caja hoy" value={Q(saldoCaja)}           color={saldoCaja>=0?TEAL:"#E24B4A"}/>
        <MetricBox label="Por cobrar"     value={Q(totalPend)}           color="#E24B4A"/>
      </div>

      {/* Tarjetas de estado rápido */}
      <div className="rg-3" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:16}}>
        <div onClick={function(){setView("repairs");}} style={Object.assign({},sC,{cursor:"pointer",borderLeft:"4px solid #378ADD"})}>
          <p style={{fontSize:12,color:"#666",margin:"0 0 6px"}}>🔧 Reparaciones activas</p>
          <p style={{fontSize:26,fontWeight:700,margin:0,color:"#378ADD"}}>{repsActivas.length}</p>
          {repsListas.length>0&&<p style={{fontSize:11,color:TEAL,margin:"4px 0 0"}}>✅ {repsListas.length} listas para entregar</p>}
        </div>
        <div onClick={function(){setView("products");}} style={Object.assign({},sC,{cursor:"pointer",borderLeft:"4px solid "+(stockAlertas.length>0?"#E65100":"#ccc")})}>
          <p style={{fontSize:12,color:"#666",margin:"0 0 6px"}}>📦 Stock bajo mínimo</p>
          <p style={{fontSize:26,fontWeight:700,margin:0,color:stockAlertas.length>0?"#E65100":"#999"}}>{stockAlertas.length}</p>
          {stockAlertas.length>0&&<p style={{fontSize:11,color:"#E65100",margin:"4px 0 0"}}>{stockAlertas.slice(0,2).map(function(p){return p.name;}).join(", ")}{stockAlertas.length>2?"…":""}</p>}
        </div>
        <div onClick={function(){setView("accounts");}} style={Object.assign({},sC,{cursor:"pointer",borderLeft:"4px solid "+(pendingAccs.length>0?"#E24B4A":"#ccc")})}>
          <p style={{fontSize:12,color:"#666",margin:"0 0 6px"}}>💳 Cuentas pendientes</p>
          <p style={{fontSize:26,fontWeight:700,margin:0,color:pendingAccs.length>0?"#E24B4A":"#999"}}>{pendingAccs.length}</p>
          {cuentasVencidas.length>0&&<p style={{fontSize:11,color:"#E24B4A",margin:"4px 0 0"}}>{cuentasVencidas.length} con +30 días</p>}
        </div>
      </div>

      {/* Gráfica principal — ingresos por día */}
      <div style={Object.assign({},sC,{marginBottom:16})}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
          <p style={{fontWeight:600,fontSize:15,margin:0}}>📈 Ingresos diarios</p>
          <div style={{display:"flex",gap:6}}>
            {[["7d","7 días"],["14d","14 días"],["30d","30 días"]].map(function(r){
              return <button key={r[0]} style={Object.assign({},mB(chartRange===r[0]?"teal":"gray"),{padding:"4px 12px",fontSize:12})} onClick={function(){setChartRange(r[0]);}}>{r[1]}</button>;
            })}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{top:4,right:8,left:0,bottom:0}}>
            <defs>
              <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={TEAL} stopOpacity={0.25}/>
                <stop offset="95%" stopColor={TEAL} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
            <XAxis dataKey="label" tick={{fontSize:11,fill:"#999"}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fontSize:11,fill:"#999"}} axisLine={false} tickLine={false} tickFormatter={function(v){return "Q"+v;}} width={55}/>
            <Tooltip content={CustomTooltipIngresos}/>
            <Area type="monotone" dataKey="ingresos" stroke={TEAL} strokeWidth={2.5} fill="url(#gradIngresos)" dot={function(p){return p.payload.isToday?<circle key={p.key} cx={p.cx} cy={p.cy} r={5} fill={TEAL} stroke="#fff" strokeWidth={2}/>:<circle key={p.key} cx={p.cx} cy={p.cy} r={3} fill={TEAL} opacity={0.6}/>;}} activeDot={{r:6,fill:TEAL}}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Métodos de pago + Top productos */}
      <div className="rg-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
        {/* PieChart métodos de pago */}
        <div style={sC}>
          <p style={{fontWeight:600,fontSize:15,margin:"0 0 12px"}}>💰 Por método de pago</p>
          {metodosPie.length===0
            ?<p style={{color:"#999",fontSize:13,textAlign:"center",padding:32}}>Sin ventas aún</p>
            :<>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={metodosPie} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {metodosPie.map(function(entry,i){return <Cell key={i} fill={entry.color}/>;})}</Pie>
                  <Tooltip content={CustomTooltipPie}/>
                </PieChart>
              </ResponsiveContainer>
              <div style={{display:"flex",flexWrap:"wrap",gap:"6px 14px",justifyContent:"center",marginTop:8}}>
                {metodosPie.map(function(m,i){
                  var total=metodosPie.reduce(function(a,x){return a+x.value;},0)||1;
                  return (
                    <div key={i} style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}>
                      <div style={{width:10,height:10,borderRadius:3,background:m.color,flexShrink:0}}/>
                      <span style={{color:"#555"}}>{m.name}</span>
                      <span style={{fontWeight:700,color:m.color}}>{Math.round(m.value/total*100)}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          }
        </div>

        {/* BarChart top productos */}
        <div style={sC}>
          <p style={{fontWeight:600,fontSize:15,margin:"0 0 12px"}}>🏆 Productos más vendidos</p>
          {top5Bar.length===0
            ?<p style={{color:"#999",fontSize:13,textAlign:"center",padding:32}}>Sin ventas aún</p>
            :<ResponsiveContainer width="100%" height={200}>
              <BarChart data={top5Bar} layout="vertical" margin={{top:0,right:20,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0"/>
                <XAxis type="number" tick={{fontSize:11,fill:"#999"}} axisLine={false} tickLine={false}/>
                <YAxis type="category" dataKey="name" tick={{fontSize:11,fill:"#555"}} axisLine={false} tickLine={false} width={100}/>
                <Tooltip cursor={{fill:"rgba(29,158,117,0.05)"}} formatter={function(v){return [v+" uds","Vendidos"];}}/>
                <Bar dataKey="unidades" radius={[0,4,4,0]}>
                  {top5Bar.map(function(_,i){
                    var colors=[TEAL,"#378ADD","#7C4DFF","#E65100","#F59E0B"];
                    return <Cell key={i} fill={colors[i%colors.length]}/>;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          }
        </div>
      </div>

      {/* Ingresos últimos 6 meses */}
      <div style={Object.assign({},sC,{marginBottom:16})}>
        <p style={{fontWeight:600,fontSize:15,margin:"0 0 12px"}}>📅 Tendencia mensual (6 meses)</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={last6months} margin={{top:4,right:8,left:0,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
            <XAxis dataKey="label" tick={{fontSize:11,fill:"#999"}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fontSize:11,fill:"#999"}} axisLine={false} tickLine={false} tickFormatter={function(v){return "Q"+v;}} width={55}/>
            <Tooltip formatter={function(v){return ["Q "+Number(v).toLocaleString("es-GT",{minimumFractionDigits:2}),"Ingresos"];}}/>
            <Bar dataKey="ingresos" radius={[4,4,0,0]} fill={TEAL} opacity={0.85}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Cuentas pendientes + Ventas de hoy */}
      <div className="rg-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
        <div style={sC}>
          <p style={{fontWeight:600,margin:"0 0 10px",fontSize:15}}>💳 Pendientes de cobro</p>
          {pendingAccs.length===0
            ?<p style={{color:TEAL,fontSize:14}}>✓ Sin cuentas pendientes</p>
            :pendingAccs.slice(0,5).map(function(a){
              return <div key={a.id} onClick={function(){setView("accounts");}} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid rgba(0,0,0,0.06)",fontSize:14,cursor:"pointer"}}>
                <div><span style={{fontWeight:500}}>{a.client}</span><span style={{fontSize:11,color:"#999",marginLeft:6}}>{fmtD(a.date)}</span></div>
                <span style={mBg(a.status==="parcial"?"amber":"red")}>{Q(a.balance)}</span>
              </div>;
            })
          }
        </div>
        <div style={sC}>
          <p style={{fontWeight:600,margin:"0 0 10px",fontSize:15}}>🕐 Últimas ventas de hoy</p>
          {todaySales.length===0
            ?<p style={{color:"#999",fontSize:14}}>Sin ventas hoy</p>
            :todaySales.slice(0,5).map(function(s){
              return <div key={s.id} onClick={function(){setSelectedSale(s);setView("history");}} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid rgba(0,0,0,0.06)",fontSize:14,cursor:"pointer"}}>
                <div><span style={{fontWeight:500}}>{s.client}</span><span style={{fontSize:11,color:"#999",marginLeft:6}}>{fmtT(s.date)}</span></div>
                <span style={{fontWeight:600,color:TEAL}}>{Q(s.total)}</span>
              </div>;
            })
          }
        </div>
      </div>
    </div>
  );
}

/* ── Caja ── */
function CajaScreen(props) {
  var sales=props.sales; var accounts=props.accounts; var returns=props.returns;
  var session=props.session||{};
  var now=new Date();

  // Estado sesión de caja
  var _sa=useState(null);   var sesionActiva=_sa[0];    var setSesionActiva=_sa[1];
  var _sl=useState(true);   var loadingSesion=_sl[0];   var setLoadingSesion=_sl[1];
  var _gastos=useState([]); var gastos=_gastos[0];       var setGastos=_gastos[1];
  var _tab=useState("movimientos"); var tab=_tab[0];      var setTab=_tab[1];

  // Modal apertura
  var _ma=useState(false);  var showApertura=_ma[0];    var setShowApertura=_ma[1];
  var _fondo=useState(""); var fondoInput=_fondo[0];    var setFondoInput=_fondo[1];
  var _na=useState("");    var notaApertura=_na[0];      var setNotaApertura=_na[1];

  // Modal gasto
  var _mg=useState(false);  var showGasto=_mg[0];       var setShowGasto=_mg[1];
  var _gc=useState("");    var gastoConcepto=_gc[0];    var setGastoConcepto=_gc[1];
  var _gm=useState("");    var gastoMonto=_gm[0];       var setGastoMonto=_gm[1];
  var _gcat=useState("general"); var gastoCat=_gcat[0]; var setGastoCat=_gcat[1];

  // Modal cierre
  var _mc=useState(false);  var showCierre=_mc[0];      var setShowCierre=_mc[1];
  var _ec=useState("");    var efectivoContado=_ec[0]; var setEfectivoContado=_ec[1];
  var _nc=useState("");    var notaCierre=_nc[0];       var setNotaCierre=_nc[1];
  var _saving=useState(false); var saving=_saving[0];   var setSaving=_saving[1];

  // Historial sesiones
  var _hist=useState([]); var histSesiones=_hist[0];   var setHistSesiones=_hist[1];

  useEffect(function(){
    setLoadingSesion(true);
    Promise.all([
      cajaAPI.getSesionActiva().catch(function(){return null;}),
      cajaAPI.getSesiones().catch(function(){return [];}),
    ]).then(function(res){
      setSesionActiva(res[0]);
      setHistSesiones(res[1]||[]);
      if(res[0]){
        cajaAPI.getGastos(res[0].id).catch(function(){return[];}).then(function(g){setGastos(g||[]);});
      }
      setLoadingSesion(false);
    });
  },[]);

  // Movimientos de efectivo de hoy (o de la sesión activa)
  var todayStr=now.toDateString();
  var movements=[];
  sales.forEach(function(s){
    if(s.method==="Efectivo"&&new Date(s.date).toDateString()===todayStr&&s.status==='completado'){
      movements.push({id:s.id,date:s.date,desc:"Venta",detail:s.client,amount:s.total,type:"entrada"});
    }
  });
  accounts.forEach(function(a){
    (a.payments||[]).forEach(function(p){
      if(p.method==="Efectivo"&&new Date(p.date).toDateString()===todayStr){
        movements.push({id:p.id,date:p.date,desc:"Abono cuenta",detail:a.client,amount:Number(p.amount),type:"entrada",note:p.note||""});
      }
    });
  });
  returns.forEach(function(r){
    if(r.refundMethod==="Efectivo"&&r.refundAmount>0&&new Date(r.date).toDateString()===todayStr){
      movements.push({id:r.id,date:r.date,desc:"Reembolso devolución",detail:r.client,amount:r.refundAmount,type:"salida",note:r.reason});
    }
  });
  gastos.forEach(function(g){
    movements.push({id:g.id,date:g.created_at,desc:"Gasto: "+g.concepto,detail:g.registrado_por,amount:Number(g.monto),type:"salida",note:g.categoria});
  });
  movements.sort(function(a,b){return new Date(b.date)-new Date(a.date);});

  var totalEntradas=movements.filter(function(m){return m.type==="entrada";}).reduce(function(s,m){return s+m.amount;},0);
  var totalGastos=gastos.reduce(function(s,g){return s+Number(g.monto);},0);
  var totalSalidas=movements.filter(function(m){return m.type==="salida";}).reduce(function(s,m){return s+m.amount;},0);
  var fondo=sesionActiva?Number(sesionActiva.fondo_inicial||0):0;
  var saldoEsperado=fondo+totalEntradas-totalSalidas;

  function handleAbrir(){
    var f=parseFloat(fondoInput)||0;
    setSaving(true);
    cajaAPI.abrir({fondo_inicial:f,nota:notaApertura}).then(function(s){
      setSesionActiva(s);
      setGastos([]);
      setShowApertura(false);
      setFondoInput(""); setNotaApertura("");
      setSaving(false);
    }).catch(function(e){
      alert(e&&e.error?e.error:"Error al abrir caja");
      setSaving(false);
    });
  }

  function handleGasto(){
    if(!gastoConcepto||!gastoMonto){return alert("Complete concepto y monto");}
    setSaving(true);
    cajaAPI.crearGasto({sesion_id:sesionActiva&&sesionActiva.id,concepto:gastoConcepto,monto:parseFloat(gastoMonto),categoria:gastoCat})
      .then(function(g){
        setGastos(function(prev){return [g].concat(prev);});
        setShowGasto(false);
        setGastoConcepto(""); setGastoMonto(""); setGastoCat("general");
        setSaving(false);
      }).catch(function(){setSaving(false); alert("Error al registrar gasto");});
  }

  function handleEliminarGasto(id){
    if(!window.confirm("¿Eliminar este gasto?"))return;
    cajaAPI.eliminarGasto(id).then(function(){
      setGastos(function(prev){return prev.filter(function(g){return g.id!==id;});});
    });
  }

  function handleCerrar(){
    if(!sesionActiva)return;
    setSaving(true);
    cajaAPI.cerrar(sesionActiva.id,{efectivo_contado:efectivoContado?parseFloat(efectivoContado):null,nota:notaCierre})
      .then(function(s){
        printCierreCaja(s);
        setSesionActiva(null);
        setHistSesiones(function(prev){return [s].concat(prev);});
        setGastos([]);
        setShowCierre(false);
        setEfectivoContado(""); setNotaCierre("");
        setSaving(false);
        // Auto-respaldo al cerrar caja
        exportExcel().catch(function(){});
      }).catch(function(e){
        alert(e&&e.error?e.error:"Error al cerrar caja");
        setSaving(false);
      });
  }

  function printCierreCaja(s){
    var _si=getStore(); var _sn=_si.store_name||STORE_FALLBACK;
    var contado=s.efectivo_contado!=null?Number(s.efectivo_contado):null;
    var diferencia=contado!=null?contado-saldoEsperado:null;
    var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cierre de Caja</title>'+
    '<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:13px;color:#222;padding:24px;max-width:700px;margin:0 auto;}'+
    '.hdr{border-bottom:3px solid #1D9E75;padding-bottom:12px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:flex-start;}'+
    '.brand h1{font-size:20px;font-weight:900;color:#1a2535;}.brand p{font-size:10px;color:#1D9E75;font-weight:700;letter-spacing:2px;}'+
    '.badge{display:inline-block;padding:3px 12px;border-radius:12px;font-weight:700;font-size:13px;}'+
    '.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;font-size:13px;}'+
    '.row.total{font-weight:800;font-size:16px;color:#1D9E75;padding-top:12px;border-bottom:none;}'+
    '.row.neg{color:#E24B4A;}.row.pos{color:#2E7D32;}'+
    '.section{margin-bottom:18px;}.section-title{font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#666;margin-bottom:10px;}'+
    '.footer{border-top:2px dashed #ccc;margin-top:18px;padding-top:12px;font-size:11px;color:#999;display:flex;justify-content:space-between;}'+
    '@media print{body{padding:10px;}}'+
    '</style></head><body>'+
    '<div class="hdr">'+
      '<div class="brand"><h1>'+_sn+'</h1><p>CIERRE DE CAJA</p></div>'+
      '<div style="text-align:right;">'+
        '<div style="font-size:10px;color:#999;">Fecha cierre</div>'+
        '<div style="font-size:15px;font-weight:700;">'+new Date(s.closed_at||new Date()).toLocaleString("es-GT")+'</div>'+
        '<div style="margin-top:6px;"><span class="badge" style="background:#E1F5EE;color:#085041;">CERRADA</span></div>'+
      '</div>'+
    '</div>'+
    '<div class="section"><div class="section-title">Detalles de la sesión</div>'+
      '<div class="row"><span>Abierta por</span><span>'+s.opened_by+' ('+s.opened_role+')</span></div>'+
      '<div class="row"><span>Cerrada por</span><span>'+(s.closed_by||session.name)+' ('+(s.closed_role||session.role)+')</span></div>'+
      '<div class="row"><span>Apertura</span><span>'+new Date(s.created_at).toLocaleString("es-GT")+'</span></div>'+
    '</div>'+
    '<div class="section"><div class="section-title">Resumen financiero</div>'+
      '<div class="row"><span>Fondo inicial</span><span>Q '+Number(s.fondo_inicial||0).toFixed(2)+'</span></div>'+
      '<div class="row"><span>Ventas en efectivo</span><span>Q '+movements.filter(function(m){return m.type==="entrada"&&m.desc==="Venta";}).reduce(function(a,m){return a+m.amount;},0).toFixed(2)+'</span></div>'+
      '<div class="row"><span>Abonos en efectivo</span><span>Q '+movements.filter(function(m){return m.type==="entrada"&&m.desc==="Abono cuenta";}).reduce(function(a,m){return a+m.amount;},0).toFixed(2)+'</span></div>'+
      '<div class="row neg"><span>Reembolsos</span><span>−Q '+movements.filter(function(m){return m.type==="salida"&&(m.desc||"").startsWith("Reembolso");}).reduce(function(a,m){return a+m.amount;},0).toFixed(2)+'</span></div>'+
      '<div class="row neg"><span>Gastos de caja</span><span>−Q '+totalGastos.toFixed(2)+'</span></div>'+
      '<div class="row total"><span>Saldo esperado</span><span>Q '+saldoEsperado.toFixed(2)+'</span></div>'+
      (contado!=null?'<div class="row"><span>Efectivo contado</span><span>Q '+contado.toFixed(2)+'</span></div>':'')+
      (diferencia!=null?'<div class="row '+(diferencia>=0?"pos":"neg")+'"><span>Diferencia (sobrante/faltante)</span><span>'+(diferencia>=0?"+":'')+'Q '+diferencia.toFixed(2)+'</span></div>':'')+
    '</div>'+
    (gastos.length>0?'<div class="section"><div class="section-title">Detalle de gastos</div>'+
      gastos.map(function(g){return '<div class="row"><span>'+g.concepto+' <span style="color:#999;font-size:11px;">['+g.categoria+']</span></span><span>Q '+Number(g.monto).toFixed(2)+'</span></div>';}).join("")+
    '</div>':'')+
    (s.nota_cierre?'<div class="section"><div class="section-title">Nota del cierre</div><p style="color:#555;">'+s.nota_cierre+'</p></div>':'')+
    '<div class="footer"><span>'+_sn+' — Sistema POS</span><span>Generado el '+new Date().toLocaleString("es-GT")+'</span></div>'+
    '</body></html>';
    var w=window.open("","_blank","width=750,height=900");
    if(w){w.document.write(html);w.document.close();setTimeout(function(){w.print();},400);}
  }

  var GASTOS_CAT=["general","suministros","servicios","transporte","alimentación","otro"];

  if(loadingSesion){
    return <div style={{padding:40,textAlign:"center",color:"#999"}}>Cargando caja…</div>;
  }

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <p style={Object.assign({},H1,{margin:0})}>💵 Caja</p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {!sesionActiva
            ?<button style={mB("teal")} onClick={function(){setShowApertura(true);}}>🔓 Abrir Caja</button>
            :<>
              <button style={mB("gray")} onClick={function(){setShowGasto(true);}}>💸 Registrar Gasto</button>
              <button style={Object.assign({},mB("red"),{background:"#E24B4A"})} onClick={function(){setShowCierre(true);}}>🔒 Cerrar Caja</button>
            </>
          }
        </div>
      </div>

      {/* Banner estado caja */}
      {sesionActiva
        ?<div style={{background:"#E1F5EE",border:"1px solid #1D9E75",borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <div>
            <span style={{fontWeight:700,color:TEAL,fontSize:15}}>🟢 Caja abierta</span>
            <span style={{color:"#555",fontSize:13,marginLeft:12}}>por {sesionActiva.opened_by} · {new Date(sesionActiva.created_at).toLocaleString("es-GT")}</span>
          </div>
          <span style={{fontWeight:700,fontSize:15,color:NAVY}}>Fondo inicial: Q {Number(sesionActiva.fondo_inicial||0).toFixed(2)}</span>
        </div>
        :<div style={{background:"#FFF3CD",border:"1px solid #F59E0B",borderRadius:10,padding:"12px 16px",marginBottom:16}}>
          <span style={{fontWeight:700,color:"#B45309",fontSize:14}}>⚠️ Caja cerrada — Abra la caja antes de operar</span>
        </div>
      }

      {/* Métricas del día */}
      <div className="rg-4" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:18}}>
        <MetricBox label="Fondo inicial" value={Q(fondo)} color="#666"/>
        <MetricBox label="Entradas hoy"  value={Q(totalEntradas)} color={TEAL}/>
        <MetricBox label="Salidas hoy"   value={Q(totalSalidas)}  color="#E24B4A"/>
        <MetricBox label="Saldo esperado" value={Q(saldoEsperado)} color={saldoEsperado>=0?TEAL:"#E24B4A"}/>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:12}}>
        {[["movimientos","📋 Movimientos"],["gastos","💸 Gastos ("+gastos.length+")"],["historial","📂 Historial sesiones"]].map(function(t){
          return <button key={t[0]} style={Object.assign({},mB(tab===t[0]?"teal":"gray"),{padding:"6px 14px",fontSize:13})} onClick={function(){setTab(t[0]);}}>{t[1]}</button>;
        })}
      </div>

      {/* Tab movimientos */}
      {tab==="movimientos"&&(
        <div style={sC}>
          <p style={{fontWeight:600,margin:"0 0 14px",fontSize:15}}>Movimientos de efectivo — Hoy</p>
          {movements.length===0
            ?<p style={{textAlign:"center",color:"#999",padding:32}}>Sin movimientos de efectivo hoy</p>
            :<table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Hora","Tipo","Detalle","Nota","Monto"].map(function(h){return <th key={h} style={sTH}>{h}</th>;})}</tr></thead>
              <tbody>
              {movements.map(function(m,i){
                return (
                  <tr key={m.id+i}>
                    <td style={sTD}>{fmtT(m.date)}</td>
                    <td style={sTD}><span style={mBg(m.type==="entrada"?"green":"red")}>{m.type==="entrada"?"▲ Entrada":"▼ Salida"}</span></td>
                    <td style={Object.assign({},sTD,{fontWeight:500})}>{m.desc}<span style={{fontSize:12,color:"#666",fontWeight:400}}> — {m.detail}</span></td>
                    <td style={Object.assign({},sTD,{color:"#666",fontSize:12})}>{m.note||"—"}</td>
                    <td style={Object.assign({},sTD,{fontWeight:700,color:m.type==="entrada"?TEAL:"#E24B4A"})}>{m.type==="entrada"?"+":"-"}{Q(m.amount)}</td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          }
          {movements.length>0&&(
            <div style={{borderTop:"1px solid rgba(0,0,0,0.1)",marginTop:12,paddingTop:12,display:"flex",justifyContent:"flex-end",gap:24,fontSize:14,flexWrap:"wrap"}}>
              <span style={{color:TEAL}}>Entradas: <b>{Q(totalEntradas)}</b></span>
              <span style={{color:"#E24B4A"}}>Salidas: <b>{Q(totalSalidas)}</b></span>
              <span style={{fontWeight:700,color:saldoEsperado>=0?TEAL:"#E24B4A"}}>Saldo esperado: <b>{Q(saldoEsperado)}</b></span>
            </div>
          )}
        </div>
      )}

      {/* Tab gastos */}
      {tab==="gastos"&&(
        <div style={sC}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <p style={{fontWeight:600,fontSize:15,margin:0}}>Gastos de caja</p>
            {sesionActiva&&<button style={mB("teal")} onClick={function(){setShowGasto(true);}}>+ Nuevo gasto</button>}
          </div>
          {gastos.length===0
            ?<p style={{textAlign:"center",color:"#999",padding:32}}>Sin gastos registrados en esta sesión</p>
            :<table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Hora","Concepto","Categoría","Registrado por","Monto",""].map(function(h){return <th key={h} style={sTH}>{h}</th>;})}</tr></thead>
              <tbody>
              {gastos.map(function(g){
                return (
                  <tr key={g.id}>
                    <td style={sTD}>{fmtT(g.created_at)}</td>
                    <td style={Object.assign({},sTD,{fontWeight:500})}>{g.concepto}</td>
                    <td style={sTD}><span style={mBg("gray")}>{g.categoria}</span></td>
                    <td style={sTD}>{g.registrado_por}</td>
                    <td style={Object.assign({},sTD,{fontWeight:700,color:"#E24B4A"})}>−Q {Number(g.monto).toFixed(2)}</td>
                    <td style={sTD}>{session.role==="admin"&&<button style={Object.assign({},mB("red"),{padding:"2px 8px",fontSize:12})} onClick={function(){handleEliminarGasto(g.id);}}>✕</button>}</td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          }
          {gastos.length>0&&<div style={{textAlign:"right",marginTop:12,fontWeight:700,color:"#E24B4A"}}>Total gastos: Q {totalGastos.toFixed(2)}</div>}
        </div>
      )}

      {/* Tab historial */}
      {tab==="historial"&&(
        <div style={sC}>
          <p style={{fontWeight:600,fontSize:15,margin:"0 0 14px"}}>Últimas sesiones de caja</p>
          {histSesiones.length===0
            ?<p style={{textAlign:"center",color:"#999",padding:32}}>Sin sesiones anteriores</p>
            :<table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Apertura","Cierre","Abierta por","Cerrada por","Fondo","Saldo esperado","Estado"].map(function(h){return <th key={h} style={sTH}>{h}</th>;})}</tr></thead>
              <tbody>
              {histSesiones.map(function(s){
                var cerrada=!!s.closed_at;
                return (
                  <tr key={s.id}>
                    <td style={sTD}>{new Date(s.created_at).toLocaleString("es-GT",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</td>
                    <td style={sTD}>{cerrada?new Date(s.closed_at).toLocaleString("es-GT",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):"—"}</td>
                    <td style={sTD}>{s.opened_by}</td>
                    <td style={sTD}>{s.closed_by||"—"}</td>
                    <td style={sTD}>Q {Number(s.fondo_inicial||0).toFixed(2)}</td>
                    <td style={sTD}>{s.efectivo_contado!=null?"Q "+Number(s.efectivo_contado).toFixed(2):"—"}</td>
                    <td style={sTD}><span style={mBg(cerrada?"green":"yellow")}>{cerrada?"Cerrada":"Abierta"}</span></td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          }
        </div>
      )}

      {/* Modal apertura */}
      {showApertura&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
          <div style={{background:"#fff",borderRadius:14,padding:28,width:"100%",maxWidth:420}}>
            <p style={{fontWeight:700,fontSize:18,margin:"0 0 20px",color:NAVY}}>🔓 Abrir Caja</p>
            <label style={{display:"block",marginBottom:6,fontWeight:600,fontSize:13}}>Fondo inicial (Q)</label>
            <input style={sI} type="number" min="0" step="0.01" placeholder="0.00" value={fondoInput} onChange={function(e){setFondoInput(e.target.value);}} autoFocus/>
            <label style={{display:"block",margin:"14px 0 6px",fontWeight:600,fontSize:13}}>Nota (opcional)</label>
            <input style={sI} placeholder="Ej: fondo de Q200 verificado" value={notaApertura} onChange={function(e){setNotaApertura(e.target.value);}}/>
            <div style={{display:"flex",gap:10,marginTop:20}}>
              <button style={Object.assign({},mB("gray"),{flex:1})} onClick={function(){setShowApertura(false);}}>Cancelar</button>
              <button style={Object.assign({},mB("teal"),{flex:1})} onClick={handleAbrir} disabled={saving}>{saving?"Abriendo…":"Abrir Caja"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal gasto */}
      {showGasto&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
          <div style={{background:"#fff",borderRadius:14,padding:28,width:"100%",maxWidth:420}}>
            <p style={{fontWeight:700,fontSize:18,margin:"0 0 20px",color:NAVY}}>💸 Registrar Gasto</p>
            <label style={{display:"block",marginBottom:6,fontWeight:600,fontSize:13}}>Concepto *</label>
            <input style={sI} placeholder="Ej: pago de luz, compra de bolsas…" value={gastoConcepto} onChange={function(e){setGastoConcepto(e.target.value);}} autoFocus/>
            <label style={{display:"block",margin:"14px 0 6px",fontWeight:600,fontSize:13}}>Monto (Q) *</label>
            <input style={sI} type="number" min="0" step="0.01" placeholder="0.00" value={gastoMonto} onChange={function(e){setGastoMonto(e.target.value);}}/>
            <label style={{display:"block",margin:"14px 0 6px",fontWeight:600,fontSize:13}}>Categoría</label>
            <select style={sI} value={gastoCat} onChange={function(e){setGastoCat(e.target.value);}}>
              {GASTOS_CAT.map(function(c){return <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>;})}
            </select>
            <div style={{display:"flex",gap:10,marginTop:20}}>
              <button style={Object.assign({},mB("gray"),{flex:1})} onClick={function(){setShowGasto(false);}}>Cancelar</button>
              <button style={Object.assign({},mB("teal"),{flex:1})} onClick={handleGasto} disabled={saving}>{saving?"Guardando…":"Registrar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal cierre */}
      {showCierre&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
          <div style={{background:"#fff",borderRadius:14,padding:28,width:"100%",maxWidth:440}}>
            <p style={{fontWeight:700,fontSize:18,margin:"0 0 16px",color:NAVY}}>🔒 Cerrar Caja</p>
            <div style={{background:"#f8f9fa",borderRadius:8,padding:14,marginBottom:18,fontSize:14}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{color:"#666"}}>Fondo inicial</span><span>Q {fondo.toFixed(2)}</span></div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{color:"#666"}}>Entradas</span><span style={{color:TEAL}}>+Q {totalEntradas.toFixed(2)}</span></div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{color:"#666"}}>Salidas (reemb + gastos)</span><span style={{color:"#E24B4A"}}>−Q {totalSalidas.toFixed(2)}</span></div>
              <div style={{display:"flex",justifyContent:"space-between",fontWeight:800,fontSize:16,marginTop:8,paddingTop:8,borderTop:"1px solid #ddd"}}><span>Saldo esperado</span><span style={{color:TEAL}}>Q {saldoEsperado.toFixed(2)}</span></div>
            </div>
            <label style={{display:"block",marginBottom:6,fontWeight:600,fontSize:13}}>Efectivo contado (arqueo)</label>
            <input style={sI} type="number" min="0" step="0.01" placeholder={"Esperado: Q "+saldoEsperado.toFixed(2)} value={efectivoContado} onChange={function(e){setEfectivoContado(e.target.value);}}/>
            {efectivoContado&&(
              <div style={{marginTop:8,fontWeight:700,fontSize:14,color:parseFloat(efectivoContado)-saldoEsperado>=0?"#2E7D32":"#E24B4A"}}>
                Diferencia: {parseFloat(efectivoContado)-saldoEsperado>=0?"+":""}Q {(parseFloat(efectivoContado)-saldoEsperado).toFixed(2)}
              </div>
            )}
            <label style={{display:"block",margin:"14px 0 6px",fontWeight:600,fontSize:13}}>Nota del cierre (opcional)</label>
            <input style={sI} placeholder="Observaciones…" value={notaCierre} onChange={function(e){setNotaCierre(e.target.value);}}/>
            <div style={{display:"flex",gap:10,marginTop:20}}>
              <button style={Object.assign({},mB("gray"),{flex:1})} onClick={function(){setShowCierre(false);}}>Cancelar</button>
              <button style={Object.assign({},mB("red"),{flex:1,background:"#E24B4A"})} onClick={handleCerrar} disabled={saving}>{saving?"Cerrando…":"Confirmar Cierre"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── POS ── */
function POSScreen(props) {
  var products=props.products; var filteredPOS=props.filteredPOS; var cart=props.cart;
  var posQ=props.posQ; var setPosQ=props.setPosQ;
  var payMethod=props.payMethod; var setPayMethod=props.setPayMethod;
  var payType=props.payType; var setPayType=props.setPayType;
  var cashIn=props.cashIn; var setCashIn=props.setCashIn;
  var initialPay=props.initialPay; var setInitialPay=props.setInitialPay;
  var clientName=props.clientName; var setClientName=props.setClientName;
  var selectedClientId=props.selectedClientId; var setSelectedClientId=props.setSelectedClientId;
  var saleNote=props.saleNote||""; var setSaleNote=props.setSaleNote||function(){};
  var cartTotal=props.cartTotal; var vuelto=props.vuelto; var initPaidVal=props.initPaidVal;
  var addToCart=props.addToCart; var changeQty=props.changeQty; var removeFromCart=props.removeFromCart;
  var checkout=props.checkout; var resetPOS=props.resetPOS; var flash=props.flash;
  var clients=props.clients||[]; var accounts=props.accounts||[];

  // Estado local del buscador de cliente
  var _cq=useState(""); var cliQ=_cq[0]; var setCliQ=_cq[1];
  var _cdd=useState(false); var showDrop=_cdd[0]; var setShowDrop=_cdd[1];

  // Estado de descuento por ítem
  var _di=useState(null); var discountItemId=_di[0]; var setDiscountItemId=_di[1];
  var _dv=useState(""); var discountVal=_dv[0]; var setDiscountVal=_dv[1];

  // Responsive
  var isMobile=useIsMobile();
  var _pt=useState("productos"); var posTab=_pt[0]; var setPosTab=_pt[1];

  function applyDiscount(itemId){
    var newPrice=parseFloat(discountVal);
    if(!newPrice||newPrice<=0){setDiscountItemId(null);setDiscountVal("");return;}
    props.applyDiscount(itemId, newPrice);
    setDiscountItemId(null);
    setDiscountVal("");
  }

  // Clientes filtrados por búsqueda
  var cliResults=cliQ.trim().length>0?clients.filter(function(c){
    var q=cliQ.toLowerCase();
    return (c.name||"").toLowerCase().includes(q)||(c.dpi||"").includes(cliQ.trim())||(c.cliCode||"").toLowerCase().includes(q)||(c.phone||"").includes(cliQ.trim());
  }).slice(0,5):[];

  // Cliente seleccionado actualmente
  var selCli=selectedClientId?clients.find(function(c){return c.id===selectedClientId;}):null;

  // Deuda pendiente del cliente seleccionado
  var deudaCliente=selCli?accounts.filter(function(a){
    return (a.clientId===selCli.id||(a.client===selCli.name&&!a.clientId))&&a.status!=="pagado";
  }).reduce(function(s,a){return s+a.balance;},0):0;

  function selectClient(c){
    setSelectedClientId(c.id);
    setClientName(c.name);
    setCliQ("");
    setShowDrop(false);
  }

  function clearClient(){
    setSelectedClientId(null);
    setClientName("");
    setCliQ("");
    setShowDrop(false);
  }

  function handleCliInput(val){
    setCliQ(val);
    setClientName(val);
    setSelectedClientId(null);
    setShowDrop(true);
  }

  var FC={ok:"#EAF3DE",warn:"#FAEEDA",err:"#FDECEA"};
  var FT={ok:"#27500A",warn:"#633806",err:"#7B1010"};
  var FB={ok:"#97C459",warn:"#EF9F27",err:"#E53935"};
  return (
      <div>
        <p style={H1}>🛒 Nueva Venta</p>
        {flash.msg&&<div style={{background:FC[flash.type]||FC.ok,border:"1px solid "+(FB[flash.type]||FB.ok),borderRadius:8,padding:"10px 16px",marginBottom:14,color:FT[flash.type]||FT.ok,fontSize:14}}>{flash.msg}</div>}
        {isMobile&&(
          <div style={{display:"flex",gap:0,marginBottom:14,borderRadius:10,overflow:"hidden",border:"1px solid rgba(0,0,0,0.12)"}}>
            <button onClick={function(){setPosTab("productos");}} style={{flex:1,padding:"11px",fontSize:13,fontWeight:600,border:"none",borderRadius:0,background:posTab==="productos"?TEAL:"#f4f4f4",color:posTab==="productos"?"#fff":"#555",cursor:"pointer"}}>
              📦 Productos
            </button>
            <button onClick={function(){setPosTab("carrito");}} style={{flex:1,padding:"11px",fontSize:13,fontWeight:600,border:"none",borderRadius:0,background:posTab==="carrito"?TEAL:"#f4f4f4",color:posTab==="carrito"?"#fff":"#555",cursor:"pointer",position:"relative"}}>
              🛒 Carrito {cart.length>0&&<span style={{background:"#E24B4A",color:"#fff",borderRadius:10,fontSize:10,padding:"1px 6px",fontWeight:700,marginLeft:4}}>{cart.length}</span>}
            </button>
          </div>
        )}
        <div style={isMobile?{}:{display:"grid",gridTemplateColumns:"1fr 340px",gap:18}}>
          <div style={Object.assign({},sC,isMobile&&posTab!=="productos"?{display:"none"}:{})}>
            <input style={Object.assign({},sI,{marginBottom:14})} placeholder="🔍  Buscar por nombre, código o estantería..."
                   value={posQ} onChange={function(e){setPosQ(e.target.value);}}/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(148px,1fr))",gap:10,maxHeight:460,overflowY:"auto",paddingRight:2}}>
              {filteredPOS.map(function(p){
                var inC=cart.find(function(i){return i.id===p.id;});
                var agotado=p.stock===0&&p.unit!=="serv";
                return (
                    <div key={p.id} onClick={function(){addToCart(p);}} style={{padding:12,borderRadius:10,cursor:agotado?"not-allowed":"pointer",border:"1.5px solid "+(inC?TEAL:"rgba(0,0,0,0.1)"),background:agotado?"#f5f4f0":"#fff",opacity:agotado?0.52:1,position:"relative"}}>
                      {inC&&<div style={{position:"absolute",top:6,right:6,background:TEAL,color:"#fff",borderRadius:10,fontSize:10,padding:"1px 6px",fontWeight:700}}>{inC.qty}</div>}
                      <div style={{fontSize:10,color:"#999",marginBottom:3,fontFamily:"monospace"}}>{p.code} · {p.shelf}</div>
                      <div style={{fontSize:13,fontWeight:600,marginBottom:5,lineHeight:1.35}}>{p.name}</div>
                      <div style={{fontSize:15,color:TEAL,fontWeight:700}}>{Q(p.price)}</div>
                      <div style={{fontSize:10,marginTop:4,color:agotado?"#E24B4A":p.stock<5?"#854F0B":"#999"}}>{p.unit==="serv"?"Servicio":agotado?"Sin stock":"Stock: "+p.stock}</div>
                    </div>
                );
              })}
              {filteredPOS.length===0&&<p style={{color:"#999",fontSize:14}}>Sin resultados</p>}
            </div>
          </div>
          <div style={Object.assign({},sC,{display:"flex",flexDirection:"column"},isMobile&&posTab!=="carrito"?{display:"none"}:{})}>
            <p style={{fontWeight:600,margin:"0 0 14px",fontSize:15}}>Carrito <span style={{fontWeight:400,color:"#999",fontSize:13}}>({cart.length})</span></p>
            {cart.length===0
                ?<div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:"#bbb",fontSize:13,textAlign:"center",minHeight:180}}>Seleccioná productos del catálogo</div>
                :<div style={{flex:1,overflowY:"auto",marginBottom:14}}>
                  {cart.map(function(item){
                    var isEditingDiscount=discountItemId===item.id;
                    var hasDiscount=item.originalPrice&&item.price<item.originalPrice;
                    return (
                        <div key={item.id} style={{padding:"10px 0",borderBottom:"1px solid rgba(0,0,0,0.07)"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                            <div style={{flex:1,marginRight:8}}>
                              <div style={{fontSize:13,fontWeight:600,lineHeight:1.3}}>{item.name}</div>
                              <div style={{fontSize:10,color:"#999",fontFamily:"monospace"}}>{item.code}</div>
                              {hasDiscount&&<div style={{fontSize:10,color:"#E65100",marginTop:2}}>Desc. auto. por: {item.discountBy||"usuario"}</div>}
                            </div>
                            <span style={{cursor:"pointer",color:"#E24B4A",fontSize:18,lineHeight:1,flexShrink:0}} onClick={function(){removeFromCart(item.id);}}>×</span>
                          </div>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <div style={sQB} onClick={function(){changeQty(item.id,-1);}}>−</div>
                              <span style={{fontSize:14,fontWeight:600,minWidth:22,textAlign:"center"}}>{item.qty}</span>
                              <div style={sQB} onClick={function(){changeQty(item.id,1);}}>+</div>
                            </div>
                            <div style={{textAlign:"right"}}>
                              {hasDiscount&&<div style={{fontSize:10,color:"#999",textDecoration:"line-through"}}>{Q(item.originalPrice*item.qty)}</div>}
                              <span style={{fontSize:14,fontWeight:700,color:hasDiscount?"#E65100":TEAL}}>{Q(item.price*item.qty)}</span>
                            </div>
                          </div>
                          {/* Botón de descuento */}
                          {!isEditingDiscount?(
                            <div style={{marginTop:6,textAlign:"right"}}>
                              <span onClick={function(){setDiscountItemId(item.id);setDiscountVal(item.price.toFixed(2));}} style={{fontSize:10,color:"#E65100",cursor:"pointer",textDecoration:"underline"}}>
                                {hasDiscount?"Editar descuento":"% Aplicar descuento"}
                              </span>
                            </div>
                          ):(
                            <div style={{marginTop:8,display:"flex",gap:6,alignItems:"center"}}>
                              <div style={{flex:1}}>
                                <div style={{fontSize:10,color:"#666",marginBottom:2}}>Precio c/descuento (precio lista: {Q(item.originalPrice||item.price)})</div>
                                <input
                                  type="number"
                                  style={Object.assign({},sI,{padding:"5px 8px",fontSize:12})}
                                  value={discountVal}
                                  placeholder="Nuevo precio Q"
                                  onChange={function(e){setDiscountVal(e.target.value);}}
                                  onKeyDown={function(e){if(e.key==="Enter")applyDiscount(item.id);if(e.key==="Escape"){setDiscountItemId(null);setDiscountVal("");}}}
                                  autoFocus
                                />
                              </div>
                              <div style={{display:"flex",gap:4,marginTop:14}}>
                                <button style={Object.assign({},mB("teal"),{padding:"4px 8px",fontSize:11})} onClick={function(){applyDiscount(item.id);}}>✓</button>
                                <button style={Object.assign({},mB("gray"),{padding:"4px 8px",fontSize:11})} onClick={function(){setDiscountItemId(null);setDiscountVal("");}}>✕</button>
                              </div>
                            </div>
                          )}
                        </div>
                    );
                  })}
                </div>
            }
            <div style={{borderTop:"1px solid rgba(0,0,0,0.1)",paddingTop:14}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:19,fontWeight:700,marginBottom:14}}>
                <span>Total</span><span style={{color:TEAL}}>{Q(cartTotal)}</span>
              </div>
              <div style={{marginBottom:10}}>
                <label style={sL}>👤 Cliente</label>

                {/* Cliente ya seleccionado */}
                {selCli?(
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:8,border:"1.5px solid "+TEAL,background:"#E1F5EE"}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:600,color:"#085041"}}>{selCli.name}</div>
                        <div style={{fontSize:11,color:"#0F6E56",fontFamily:"monospace"}}>{selCli.cliCode}{selCli.dpi?" · DPI: "+selCli.dpi:""}</div>
                      </div>
                      <span onClick={clearClient} style={{cursor:"pointer",color:"#E24B4A",fontSize:16,fontWeight:700,padding:"2px 6px"}}>×</span>
                    </div>
                    {deudaCliente>0&&(
                      <div style={{background:"#FCEBEB",border:"1px solid #F09595",borderRadius:6,padding:"6px 10px",marginTop:6,fontSize:12,color:"#791F1F"}}>
                        ⚠ Este cliente tiene <b>{Q(deudaCliente)}</b> pendiente de pago
                      </div>
                    )}
                  </div>
                ):(
                  <div style={{position:"relative"}}>
                    <input
                      style={sI}
                      value={cliQ||clientName}
                      placeholder="Buscar cliente por nombre, DPI o código..."
                      onChange={function(e){handleCliInput(e.target.value);}}
                      onFocus={function(){setShowDrop(true);}}
                      onBlur={function(){setTimeout(function(){setShowDrop(false);},200);}}
                    />
                    {showDrop&&(cliQ.trim().length>0)&&(
                      <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:"1px solid rgba(0,0,0,0.15)",borderRadius:8,boxShadow:"0 4px 16px rgba(0,0,0,0.1)",zIndex:100,maxHeight:200,overflowY:"auto",marginTop:2}}>
                        {cliResults.map(function(c){
                          var deuda=accounts.filter(function(a){return (a.clientId===c.id||(a.client===c.name&&!a.clientId))&&a.status!=="pagado";}).reduce(function(s,a){return s+a.balance;},0);
                          return (
                            <div key={c.id} onMouseDown={function(){selectClient(c);}} style={{padding:"10px 14px",cursor:"pointer",borderBottom:"1px solid rgba(0,0,0,0.06)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                              <div>
                                <div style={{fontSize:13,fontWeight:600}}>{c.name}</div>
                                <div style={{fontSize:11,color:"#999",fontFamily:"monospace"}}>{c.cliCode}{c.dpi?" · "+c.dpi:""}{c.phone?" · "+c.phone:""}</div>
                              </div>
                              {deuda>0&&<span style={mBg("red")}>{Q(deuda)}</span>}
                            </div>
                          );
                        })}
                        {cliResults.length===0&&(
                          <div style={{padding:"10px 14px",fontSize:13,color:"#999"}}>
                            No se encontró "{cliQ}" — se registrará como cliente ocasional
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div style={{marginBottom:10}}>
                <label style={sL}>Tipo de cobro</label>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                  {[["completo","✓ Completo"],["parcial","💰 Abono"],["pendiente","⏳ Pendiente"]].map(function(pair){
                    return <button key={pair[0]} onClick={function(){setPayType(pair[0]);}} style={Object.assign({},mB(payType===pair[0]?"teal":"gray"),{padding:"7px 4px",fontSize:12,border:payType===pair[0]?"none":"1px solid rgba(0,0,0,0.15)"})}>{pair[1]}</button>;
                  })}
                </div>
              </div>
              {payType==="parcial"&&(
                  <div style={{marginBottom:10}}>
                    <label style={sL}>Abono inicial (Q)</label>
                    <input type="number" style={sI} value={initialPay} placeholder={"Máx: "+cartTotal.toFixed(2)} onChange={function(e){setInitialPay(e.target.value);}}/>
                    {initPaidVal>0&&<div style={{marginTop:5,fontSize:13,fontWeight:500,color:"#E24B4A"}}>Saldo: {Q(Math.max(0,cartTotal-initPaidVal))}</div>}
                  </div>
              )}
              {payType!=="pendiente"&&(
                  <div style={{marginBottom:10}}>
                    <label style={sL}>Método de pago</label>
                    <select style={sI} value={payMethod} onChange={function(e){setPayMethod(e.target.value);}}>
                      <option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option>
                    </select>
                  </div>
              )}
              {payMethod==="Efectivo"&&payType==="completo"&&cart.length>0&&(
                  <div style={{marginBottom:10}}>
                    <label style={sL}>Efectivo recibido (Q)</label>
                    <input type="number" style={sI} value={cashIn} placeholder="0.00" onChange={function(e){setCashIn(e.target.value);}}/>
                    {vuelto!==null&&<div style={{marginTop:5,fontSize:13,fontWeight:600,color:vuelto>=0?TEAL:"#E24B4A"}}>{vuelto>=0?"✓ Vuelto: "+Q(vuelto):"✗ Faltan: "+Q(Math.abs(vuelto))}</div>}
                  </div>
              )}
              <div style={{marginBottom:10}}>
                <label style={sL}>📝 Nota / descripción (opcional)</label>
                <input style={sI} value={saleNote} placeholder="Ej: Reparación pantalla, garantía 30 días..." onChange={function(e){setSaleNote(e.target.value);}}/>
              </div>
              <button style={Object.assign({},mB(payType==="pendiente"?"purple":payType==="parcial"?"blue":"teal"),{width:"100%",padding:"12px",fontSize:15,opacity:cart.length===0?0.5:1})} onClick={checkout}>
                {payType==="pendiente"?"⏳ Dejar Pendiente":payType==="parcial"?"💰 Registrar Abono":"✓ Cobrar Venta"}
              </button>
              {cart.length>0&&<button style={Object.assign({},mB("gray"),{width:"100%",marginTop:8,padding:"9px",fontSize:13})} onClick={resetPOS}>Limpiar carrito</button>}
            </div>
          </div>
        </div>
      </div>
  );
}

/* ── Cuentas ── */
function AccountsScreen(props) {
  var accounts=props.accounts; var pendingAccs=props.pendingAccs;
  var products=props.products||[]; var session=props.session||{};
  var totalPend=props.totalPend; var addPayment=props.addPayment; var showFlash=props.showFlash;
  var _f=useState("activas"); var filter=_f[0]; var setFilter=_f[1];
  var _s=useState(null); var selAcc=_s[0]; var setSelAcc=_s[1];
  var _a=useState(""); var pmtAmount=_a[0]; var setPmtAmount=_a[1];
  var _m=useState("Efectivo"); var pmtMethod=_m[0]; var setPmtMethod=_m[1];
  var _n=useState(""); var pmtNote=_n[0]; var setPmtNote=_n[1];
  var _r=useState(""); var pmtErr=_r[0]; var setPmtErr=_r[1];
  var _cq=useState(""); var clientQ=_cq[0]; var setClientQ=_cq[1];
  var _wam=useState(false); var showWaMasivo=_wam[0]; var setShowWaMasivo=_wam[1];
  var _wsel=useState({}); var waSel=_wsel[0]; var setWaSel=_wsel[1];
  var _wtel=useState({}); var waTels=_wtel[0]; var setWaTels=_wtel[1];
  var _wsend=useState(false); var waSending=_wsend[0]; var setWaSending=_wsend[1];
  var totalCob=accounts.reduce(function(s,a){return s+a.paid;},0);
  var filtered=accounts.filter(function(a){
    if(clientQ){return (a.client||"").toLowerCase().indexOf(clientQ.toLowerCase())>=0;}
    if(filter==="todas")return true;
    if(filter==="activas")return a.status!=="pagado";
    return a.status===filter;
  });
  var clienteSaldo=filtered.reduce(function(s,a){return s+(a.balance||0);},0);
  var clientePagado=filtered.reduce(function(s,a){return s+(a.paid||0);},0);
  var accPag=usePaginator(filtered,20);
  function doPayment(acc){
    var amt=parseFloat(pmtAmount);
    if(!amt||amt<=0){setPmtErr("Ingresá un monto válido");return;}
    if(amt>acc.balance+0.01){setPmtErr("El máximo es "+Q(acc.balance));return;}
    addPayment(acc.id,Math.min(amt,acc.balance),pmtMethod,pmtNote);
    setPmtAmount("");setPmtNote("");setPmtErr("");
    showFlash("✓ Pago registrado — "+Q(amt),"ok");
  }
  if(selAcc){
    var acc=accounts.find(function(a){return a.id===selAcc;});
    if(!acc){setSelAcc(null);return null;}
    var accTel=(props.clients&&props.clients.find(function(c){return c.id===acc.clientId;})||{}).phone||"";
    return (
        <div>
          <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
            <button style={mB("gray")} onClick={function(){setSelAcc(null);setPmtAmount("");setPmtNote("");setPmtErr("");}}>← Volver</button>
            <button style={mB("teal")} onClick={function(){printVoucher(acc,{estado:acc.status==="pagado"?"pagado":acc.status==="parcial"?"parcial":"pendiente",pagado:acc.paid,saldo:acc.balance,usuario:session.name,usuarioRole:session.role,products:products,payments:acc.payments});}}>🖨 Imprimir constancia</button>
            {acc.status!=="pagado"&&<button style={Object.assign({},mB("green"),{background:"#25D366"})} onClick={function(){
              var getMsj=function(){return waRecordatorio(acc);};
              var waopts={sale:acc,receiptOpts:{estado:acc.status,pagado:acc.paid,saldo:acc.balance}};
              if(accTel){compartirWhatsApp(accTel,getMsj,waopts);}else{pedirTelYEnviar(acc.client,getMsj,waopts);}
            }}>💬 Recordatorio WhatsApp</button>}
          </div>
          <div style={sC}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
              <div>
                <p style={{fontWeight:700,fontSize:18,margin:"0 0 4px"}}>👤 {acc.client}</p>
                <p style={{fontSize:13,color:"#666",margin:"0 0 2px"}}>Creada: {fmtD(acc.date)} {fmtT(acc.date)}</p>
              </div>
              <div style={{textAlign:"right"}}>
                <span style={mBg(acc.status==="pagado"?"green":acc.status==="parcial"?"amber":"red")}>{acc.status==="pagado"?"✓ Pagado":acc.status==="parcial"?"Abono parcial":"Pendiente"}</span>
                <div style={{marginTop:10,fontSize:13,color:"#666"}}>Total: <b>{Q(acc.total)}</b></div>
                <div style={{fontSize:13,color:TEAL}}>Pagado: <b>{Q(acc.paid)}</b></div>
                <div style={{fontSize:18,fontWeight:700,color:acc.balance>0?"#E24B4A":TEAL}}>Saldo: {Q(acc.balance)}</div>
              </div>
            </div>
            <p style={{fontWeight:600,margin:"0 0 8px",fontSize:14}}>Productos / Servicios</p>
            <table style={{width:"100%",borderCollapse:"collapse",marginBottom:16}}>
              <thead><tr>{["Código","Producto","Cant.","Precio","Subtotal"].map(function(h){return <th key={h} style={sTH}>{h}</th>;})}</tr></thead>
              <tbody>
              {(acc.items||[]).map(function(it,i){
                return <tr key={i}><td style={Object.assign({},sTD,{fontFamily:"monospace",fontSize:12})}>{it.code}</td><td style={Object.assign({},sTD,{fontWeight:500})}>{it.name}</td><td style={sTD}>{it.qty}</td><td style={sTD}>{Q(it.price)}</td><td style={Object.assign({},sTD,{fontWeight:600,color:TEAL})}>{Q(it.price*it.qty)}</td></tr>;
              })}
              </tbody>
            </table>
            {acc.payments&&acc.payments.length>0&&(
                <div>
                  <p style={{fontWeight:600,margin:"0 0 8px",fontSize:14}}>💰 Historial de pagos</p>
                  <table style={{width:"100%",borderCollapse:"collapse",marginBottom:16}}>
                    <thead><tr>{["Fecha","Monto","Método","Nota","Registrado por"].map(function(h){return <th key={h} style={sTH}>{h}</th>;})}</tr></thead>
                    <tbody>
                    {acc.payments.map(function(p,i){
                      return <tr key={i}>
                        <td style={sTD}>{fmtD(p.date)} {fmtT(p.date)}</td>
                        <td style={Object.assign({},sTD,{fontWeight:700,color:TEAL})}>{Q(p.amount)}</td>
                        <td style={sTD}><span style={mBg("teal")}>{p.method}</span></td>
                        <td style={Object.assign({},sTD,{color:"#666"})}>{p.note||"—"}</td>
                      </tr>;
                    })}
                    </tbody>
                  </table>
                </div>
            )}
            {acc.status!=="pagado"?(
                <div style={{background:"#f9f8f5",borderRadius:10,padding:16,border:"1px solid rgba(0,0,0,0.08)"}}>
                  <p style={{fontWeight:600,margin:"0 0 12px",fontSize:14}}>💳 Registrar pago / cuota</p>
                  {pmtErr&&<p style={{color:"#E24B4A",fontSize:13,margin:"0 0 10px"}}>⚠ {pmtErr}</p>}
                  <div className="form-grid-3" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
                    <div><label style={sL}>Monto (Q)</label>
                      <input type="number" style={sI} value={pmtAmount} placeholder={"Saldo: "+acc.balance.toFixed(2)} onChange={function(e){setPmtErr("");setPmtAmount(e.target.value);}}/></div>
                    <div><label style={sL}>Método</label>
                      <select style={sI} value={pmtMethod} onChange={function(e){setPmtMethod(e.target.value);}}>
                        <option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option>
                      </select></div>
                    <div><label style={sL}>Nota (ej: Cuota 1)</label>
                      <input style={sI} value={pmtNote} placeholder="Opcional" onChange={function(e){setPmtNote(e.target.value);}}/></div>
                  </div>
                  <div style={{display:"flex",gap:10}}>
                    <button style={mB("teal")} onClick={function(){doPayment(acc);}}>✓ Registrar pago</button>
                    <button style={mB("blue")} onClick={function(){setPmtAmount(acc.balance.toFixed(2));setPmtNote("Pago total");}}>Pagar todo ({Q(acc.balance)})</button>
                  </div>
                </div>
            ):(
                <div style={{background:"#EAF3DE",borderRadius:10,padding:"12px 16px",textAlign:"center",color:"#27500A",fontWeight:600}}>✓ Cuenta totalmente pagada</div>
            )}
          </div>
        </div>
    );
  }
  // Aging buckets
  var agNow=new Date();
  var aging=[
    {label:"0 – 30 días",color:"#2E7D32",bg:"#EAF3DE",accs:[]},
    {label:"31 – 60 días",color:"#E65100",bg:"#FFF3E0",accs:[]},
    {label:"61 – 90 días",color:"#C62828",bg:"#FDECEA",accs:[]},
    {label:"+90 días",    color:"#7B1FA2",bg:"#F3E5F5",accs:[]},
  ];
  pendingAccs.forEach(function(a){
    var days=Math.floor((agNow-new Date(a.date))/86400000);
    if(days<=30) aging[0].accs.push(a);
    else if(days<=60) aging[1].accs.push(a);
    else if(days<=90) aging[2].accs.push(a);
    else aging[3].accs.push(a);
  });

  return (
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4,flexWrap:"wrap",gap:10}}>
          <p style={Object.assign({},H1,{margin:0})}>💳 Cuentas por Cobrar<HelpTip text={"Clientes que compraron al crédito y aún deben.\n\n• Pendiente: no han pagado nada\n• Abono parcial: pagaron una parte\n• Pagado: saldo en cero\n\nTocá 'Atender →' para registrar un pago. Podés enviar recordatorio de cobro por WhatsApp con el botón 💬 de cada cuenta, o usar '📱 Recordatorio masivo' para enviar a varios clientes a la vez."}/></p>
          <div style={{display:"flex",gap:8}}>
            <button style={Object.assign({},mB("teal"),{padding:"6px 12px",fontSize:12})} onClick={function(){
              var cols=["Cliente","Fecha","Total","Pagado","Saldo","Estado"];
              var rows=filtered.map(function(a){return[a.client||"",fmtD(a.date),a.total.toFixed(2),a.paid.toFixed(2),a.balance.toFixed(2),a.status||""];});
              exportExcel(rows,cols,"cuentas_por_cobrar");
            }}>📊 Excel</button>
            <button style={Object.assign({},mB("blue"),{padding:"6px 12px",fontSize:12})} onClick={function(){
              var cols=["Cliente","Fecha","Total","Pagado","Saldo","Estado"];
              var rows=filtered.map(function(a){return[a.client||"",fmtD(a.date),"Q"+a.total.toFixed(2),"Q"+a.paid.toFixed(2),"Q"+a.balance.toFixed(2),a.status||""];});
              exportPDF("Cuentas por Cobrar",cols,rows,"cuentas_por_cobrar");
            }}>📄 PDF</button>
            {(session.role==="admin"||session.role==="superadmin")&&pendingAccs.length>0&&(
              <button style={Object.assign({},mB("green"),{background:"#25D366",padding:"6px 12px",fontSize:12})} onClick={function(){
                var initSel={};var initTels={};
                pendingAccs.forEach(function(a){
                  initSel[a.id]=true;
                  var cl=props.clients&&props.clients.find(function(c){return c.id===a.clientId;});
                  initTels[a.id]=(cl&&cl.phone)||"";
                });
                setWaSel(initSel);setWaTels(initTels);setShowWaMasivo(true);
              }}>📱 Recordatorio masivo</button>
            )}
          </div>
        </div>
        {showWaMasivo&&(function(){
          var selIds=Object.keys(waSel).filter(function(id){return waSel[id];});
          var allSelected=pendingAccs.length>0&&selIds.length===pendingAccs.length;
          return (
            <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.55)",zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
              <div style={{background:"#fff",borderRadius:14,padding:24,width:"100%",maxWidth:560,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 8px 40px rgba(0,0,0,0.25)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <p style={{fontWeight:700,fontSize:17,margin:0}}>📱 Recordatorio masivo por WhatsApp</p>
                  <button style={mB("gray")} onClick={function(){setShowWaMasivo(false);setWaSending(false);}}>✕ Cerrar</button>
                </div>
                <p style={{fontSize:13,color:"#555",marginBottom:12}}>Seleccioná los clientes que recibirán el recordatorio. Se abrirá WhatsApp para cada uno.</p>
                <div style={{display:"flex",gap:8,marginBottom:14}}>
                  <button style={Object.assign({},mB("teal"),{padding:"5px 12px",fontSize:12})} onClick={function(){var s={};pendingAccs.forEach(function(a){s[a.id]=true;});setWaSel(s);}}>✓ Todos</button>
                  <button style={Object.assign({},mB("gray"),{padding:"5px 12px",fontSize:12})} onClick={function(){setWaSel({});}}>✗ Ninguno</button>
                  <span style={{fontSize:13,color:"#666",alignSelf:"center",marginLeft:4}}>{selIds.length} de {pendingAccs.length} seleccionados</span>
                </div>
                <div style={{borderRadius:8,border:"1px solid #eee",overflow:"hidden",marginBottom:16}}>
                  {pendingAccs.map(function(a,i){
                    return (
                      <div key={a.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:i%2===0?"#fafafa":"#fff",borderBottom:"1px solid #f0f0f0"}}>
                        <input type="checkbox" checked={!!waSel[a.id]} onChange={function(e){var s=Object.assign({},waSel);s[a.id]=e.target.checked;setWaSel(s);}} style={{width:18,height:18,cursor:"pointer"}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:600,fontSize:14,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.client}</div>
                          <div style={{fontSize:12,color:"#E24B4A",fontWeight:700}}>Saldo: {Q(a.balance)}</div>
                        </div>
                        <input
                          type="tel"
                          placeholder="Teléfono"
                          value={waTels[a.id]||""}
                          onChange={function(e){var t=Object.assign({},waTels);t[a.id]=e.target.value;setWaTels(t);}}
                          style={Object.assign({},sI,{width:130,padding:"6px 10px",fontSize:12,margin:0})}
                        />
                      </div>
                    );
                  })}
                </div>
                <button
                  style={Object.assign({},mB("green"),{background:"#25D366",width:"100%",fontSize:15,padding:"12px",opacity:selIds.length===0||waSending?0.6:1})}
                  disabled={selIds.length===0||waSending}
                  onClick={function(){
                    var toSend=pendingAccs.filter(function(a){return waSel[a.id];});
                    if(toSend.length===0) return;
                    setWaSending(true);
                    var store=getStore();
                    toSend.forEach(function(a,idx){
                      setTimeout(function(){
                        var tel=waTels[a.id]||"";
                        var msg="Hola "+a.client+", le recordamos que tiene un saldo pendiente de "+Q(a.balance)+" en "+(store.store_name||"nuestro negocio")+". Por favor comuníquese con nosotros para coordinar el pago. Gracias.";
                        abrirWA(tel,msg);
                        if(idx===toSend.length-1){setWaSending(false);showFlash("✓ Se abrió WhatsApp para "+toSend.length+" cliente(s)","ok");setShowWaMasivo(false);}
                      },idx*1200);
                    });
                  }}
                >{waSending?"Enviando...":"💬 Enviar recordatorio a "+selIds.length+" cliente(s)"}</button>
              </div>
            </div>
          );
        })()}
        <div className="rg-3" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:16}}>
          <MetricBox label="Total pendiente" value={Q(totalPend)}       color="#E24B4A"/>
          <MetricBox label="Total cobrado"   value={Q(totalCob)}        color={TEAL}/>
          <MetricBox label="Cuentas activas" value={pendingAccs.length} color="#378ADD"/>
        </div>
        {/* Aging de cuentas */}
        {pendingAccs.length>0&&(
          <div style={Object.assign({},sC,{marginBottom:14})}>
            <p style={{fontWeight:600,fontSize:14,margin:"0 0 12px"}}>📊 Antigüedad de cuentas</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
              {aging.map(function(b,i){
                var tot=b.accs.reduce(function(s,a){return s+a.balance;},0);
                return (
                  <div key={i} style={{background:b.bg,borderRadius:8,padding:"10px 12px",borderLeft:"4px solid "+b.color}}>
                    <div style={{fontSize:11,color:b.color,fontWeight:700,marginBottom:4}}>{b.label}</div>
                    <div style={{fontSize:18,fontWeight:800,color:b.color}}>{b.accs.length}</div>
                    <div style={{fontSize:12,color:"#666",marginTop:2}}>{Q(tot)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div style={Object.assign({},sC,{marginBottom:14})}>
          <input style={Object.assign({},sI,{marginBottom:12})} placeholder="🔍  Buscar cuentas por cliente..." value={clientQ} onChange={function(e){setClientQ(e.target.value);}}/>
          {!clientQ&&(
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {[["activas","Activas"],["pendiente","Pendientes"],["parcial","Con abono"],["pagado","Pagadas"],["todas","Todas"]].map(function(pair){
                return <button key={pair[0]} style={Object.assign({},mB(filter===pair[0]?"teal":"gray"),{padding:"6px 14px"})} onClick={function(){setFilter(pair[0]);}}>{pair[1]}</button>;
              })}
            </div>
          )}
          {clientQ&&filtered.length>0&&(
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12,background:"#f9f8f5",borderRadius:8,padding:"12px 16px"}}>
              <div style={{fontSize:14}}><b>{filtered.length}</b> cuenta(s) de <b>{clientQ}</b></div>
              <div style={{display:"flex",gap:24,fontSize:14}}>
                <span style={{color:TEAL}}>Pagado: <b>{Q(clientePagado)}</b></span>
                <span style={{color:clienteSaldo>0?"#E24B4A":TEAL}}>Saldo total: <b>{Q(clienteSaldo)}</b></span>
              </div>
            </div>
          )}
        </div>
        <div style={sC}>
          {filtered.length===0?<p style={{textAlign:"center",color:"#999",padding:40}}>Sin cuentas en esta categoría</p>:(
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>{["#","Fecha","Cliente","Total","Pagado","Saldo","Estado",""].map(function(h){return <th key={h} style={h==="#"?Object.assign({},sTH,{width:40,textAlign:"center"}):sTH}>{h}</th>;})}</tr></thead>
                <tbody>
                {accPag.paged.map(function(a,index){
                  return (
                      <tr key={a.id} style={{cursor:"pointer"}} onClick={function(){setSelAcc(a.id);}}>
                        <td style={{...sTD,textAlign:"center",color:"#999",fontSize:12}}>{accPag.offset+index+1}</td>
                        <td style={sTD}>{fmtD(a.date)}</td>
                        <td style={Object.assign({},sTD,{fontWeight:600})}>{a.client}</td>
                        <td style={sTD}>{Q(a.total)}</td>
                        <td style={Object.assign({},sTD,{color:TEAL,fontWeight:500})}>{Q(a.paid)}</td>
                        <td style={Object.assign({},sTD,{fontWeight:700,color:a.balance>0?"#E24B4A":TEAL})}>{Q(a.balance)}</td>
                        <td style={sTD}><span style={mBg(a.status==="pagado"?"green":a.status==="parcial"?"amber":"red")}>{a.status==="pagado"?"✓ Pagado":a.status==="parcial"?"Abono parcial":"Pendiente"}</span></td>
                        <td style={sTD}>
                          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                            <button style={Object.assign({},mB("teal"),{padding:"4px 10px",fontSize:11})} onClick={function(e){e.stopPropagation();setSelAcc(a.id);}}>💳 Atender →</button>
                            {a.status!=="pagado"&&<button style={Object.assign({},mB("green"),{background:"#25D366",padding:"4px 10px",fontSize:11})} onClick={function(e){
                              e.stopPropagation();
                              var tel=(props.clients&&props.clients.find(function(c){return c.id===a.clientId;})||{}).phone||"";
                              var getMsj=function(){return waRecordatorio(a);};
                              var waopts={sale:a,receiptOpts:{estado:a.status,pagado:a.paid,saldo:a.balance}};
                              if(tel){compartirWhatsApp(tel,getMsj,waopts);}else{pedirTelYEnviar(a.client,getMsj,waopts);}
                            }}>💬</button>}
                          </div>
                        </td>
                      </tr>
                  );
                })}
                </tbody>
              </table>
          )}
        </div>
        {filtered.length>0&&React.createElement(accPag.Pager)}
      </div>
  );
}

/* ── Devoluciones ── */
function ReturnsScreen(props) {
  var returns=props.returns; var products=props.products; var onProcess=props.onProcess;
  var clients=props.clients||[]; var sales=props.sales||[];

  var BLANK={clientId:null,client:"",items:[{code:"",name:"",qty:1,price:0}],reason:"",refundMethod:"Efectivo",refundAmount:"",itemCondition:"bueno"};
  var _sh=useState(false); var show=_sh[0]; var setShow=_sh[1];
  var _fo=useState(BLANK); var form=_fo[0]; var setForm=_fo[1];
  var _er=useState(""); var err=_er[0]; var setErr=_er[1];

  // Búsqueda de cliente
  var _cq=useState(""); var cliQ=_cq[0]; var setCliQ=_cq[1];
  var _cdrop=useState(false); var showDrop=_cdrop[0]; var setShowDrop=_cdrop[1];
  var _selCli=useState(null); var selCli=_selCli[0]; var setSelCli=_selCli[1];
  var _step=useState("search"); var step=_step[0]; var setStep=_step[1];
  // Venta seleccionada para devolver
  var _selSale=useState(null); var selSale=_selSale[0]; var setSelSale=_selSale[1];

  var cliResults=cliQ.trim().length>0?clients.filter(function(c){
    var q=cliQ.toLowerCase();
    return (c.name||"").toLowerCase().includes(q)||(c.dpi||"").includes(cliQ.trim())||(c.cliCode||"").toLowerCase().includes(q);
  }).slice(0,5):[];

  // Ventas del cliente seleccionado, con info de devoluciones previas
  var cliSales=selCli?sales.filter(function(s){
    return s.clientId===selCli.id||(s.client===selCli.name&&!s.clientId);
  }).slice().sort(function(a,b){return new Date(b.date)-new Date(a.date);}).map(function(s){
    // Calcular qty ya devuelta por código en esta venta
    var returnedQty={};
    returns.filter(function(r){return r.saleId===s.id;}).forEach(function(r){
      (r.items||[]).forEach(function(it){ returnedQty[it.code]=(returnedQty[it.code]||0)+(it.qty||0); });
    });
    var totalOriginal=(s.items||[]).reduce(function(a,it){return a+it.qty;},0);
    var totalDevuelto=(s.items||[]).reduce(function(a,it){return a+(returnedQty[it.code]||0);},0);
    var fullyReturned=totalDevuelto>=totalOriginal;
    var partiallyReturned=totalDevuelto>0&&!fullyReturned;
    return Object.assign({},s,{returnedQty:returnedQty,fullyReturned:fullyReturned,partiallyReturned:partiallyReturned,totalDevuelto:totalDevuelto,totalOriginal:totalOriginal});
  }):[];

  function pickClient(c){
    setSelCli(c);
    setCliQ(c.name);
    setShowDrop(false);
    setForm(function(f){return Object.assign({},f,{clientId:c.id,client:c.name});});
    setStep("sale");
  }

  function pickSale(s){
    if(s.fullyReturned) return; // no se puede seleccionar — ya devuelta completa
    setSelSale(s);
    // Solo los artículos con qty restante por devolver
    var items=(s.items||[]).map(function(it){
      var yaDevuelto=s.returnedQty[it.code]||0;
      var restante=it.qty-yaDevuelto;
      return restante>0?{code:it.code,name:it.name,qty:restante,price:it.price}:null;
    }).filter(Boolean);
    setForm(function(f){return Object.assign({},f,{items:items});});
    setStep("form");
  }

  function resetFlow(){
    setSelCli(null); setSelSale(null); setCliQ(""); setStep("search");
    setForm(BLANK); setErr(""); setShow(false);
  }

  function setF(k,v){ setForm(function(f){var n=Object.assign({},f);n[k]=v;return n;}); }
  function setItem(i,k,v){ setForm(function(f){return Object.assign({},f,{items:f.items.map(function(it,idx){return idx===i?Object.assign({},it,(function(){var o={};o[k]=v;return o;})()) :it;})});}); }
  function addItem(){ setForm(function(f){return Object.assign({},f,{items:f.items.concat([{code:"",name:"",qty:1,price:0}])});}); }
  function delItem(i){ setForm(function(f){return Object.assign({},f,{items:f.items.filter(function(_,idx){return idx!==i;})});}); }
  function fillCode(i,code){
    var p=products.find(function(x){return x.code===code.toUpperCase();});
    if(p){ setForm(function(f){return Object.assign({},f,{items:f.items.map(function(it,idx){return idx===i?Object.assign({},it,{code:p.code,name:p.name,price:p.price}):it;})});}); }
    else{ setItem(i,"code",code); }
  }

  var itemsTotal=form.items.reduce(function(s,it){return s+(parseFloat(it.price)||0)*(parseInt(it.qty)||0);},0);

  function doReturn(){
    var valid=form.items.filter(function(it){return it.name.trim()&&it.qty>0;});
    if(!valid.length){setErr("Agregá al menos un producto válido");return;}
    if(!form.reason.trim()){setErr("Indicá el motivo");return;}
    var refAmt=form.refundMethod==="Sin reembolso"?0:(parseFloat(form.refundAmount)||itemsTotal);
    onProcess({clientId:form.clientId||null,client:form.client.trim()||"Cliente general",saleId:selSale?selSale.id:null,items:valid,reason:form.reason,refundMethod:form.refundMethod,refundAmount:refAmt,itemCondition:form.itemCondition});
    resetFlow();
  }

  var totalReembolsado=returns.filter(function(r){return r.refundAmount>0;}).reduce(function(s,r){return s+r.refundAmount;},0);
  var totalPendReemb=returns.filter(function(r){return r.refundMethod==="Sin reembolso"||r.refundAmount===0;}).length;
  var retPag=usePaginator(returns,20);

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <p style={H1}>🔄 Devoluciones</p>
        <button style={mB(show?"red":"teal")} onClick={function(){if(show){resetFlow();}else{setShow(true);}}}>
          {show?"✕ Cancelar":"+ Nueva devolución"}
        </button>
      </div>

      {show&&(
        <div style={Object.assign({},sC,{marginBottom:16,borderColor:"#378ADD",borderWidth:"1.5px"})}>
          <p style={{fontWeight:700,margin:"0 0 16px",fontSize:15}}>🔄 Registrar devolución</p>

          {/* PASO 1: Buscar cliente */}
          {step==="search"&&(
            <div>
              <p style={{fontSize:13,color:"#555",margin:"0 0 12px"}}>Paso 1 — Buscá al cliente por nombre, DPI o código</p>
              <div style={{position:"relative",marginBottom:16}}>
                <input style={sI} value={cliQ} placeholder="Nombre, DPI o código CLI..."
                  onChange={function(e){setCliQ(e.target.value);setShowDrop(true);}}
                  onFocus={function(){setShowDrop(true);}}
                  onBlur={function(){setTimeout(function(){setShowDrop(false);},200);}}
                />
                {showDrop&&cliQ.trim().length>0&&(
                  <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:"1px solid rgba(0,0,0,0.15)",borderRadius:8,boxShadow:"0 4px 12px rgba(0,0,0,0.1)",zIndex:100,marginTop:2}}>
                    {cliResults.map(function(c){return (
                      <div key={c.id} onMouseDown={function(){pickClient(c);}} style={{padding:"10px 14px",cursor:"pointer",borderBottom:"1px solid #f0f0f0",display:"flex",justifyContent:"space-between"}}>
                        <div><b style={{fontSize:13}}>{c.name}</b> <span style={{fontSize:11,color:"#999",fontFamily:"monospace"}}>{c.cliCode}{c.dpi?" · DPI: "+c.dpi:""}</span></div>
                      </div>
                    );})}
                    {cliResults.length===0&&<div style={{padding:"10px 14px",fontSize:12,color:"#999"}}>Sin resultados — podés continuar sin vincular cliente</div>}
                  </div>
                )}
              </div>
              <div style={{display:"flex",gap:10}}>
                <button style={mB("blue")} onClick={function(){
                  if(!cliQ.trim()){setErr("Ingresá el nombre del cliente");return;}
                  setForm(function(f){return Object.assign({},f,{client:cliQ.trim()});});
                  setStep("form");
                }}>Continuar sin vincular →</button>
              </div>
              {err&&<p style={{color:"#E24B4A",fontSize:13,marginTop:10}}>⚠ {err}</p>}
            </div>
          )}

          {/* PASO 2: Elegir venta a devolver */}
          {step==="sale"&&selCli&&(
            <div>
              <div style={{background:"#E1F5EE",borderRadius:8,padding:"10px 14px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <span style={{fontWeight:700,color:"#085041"}}>{selCli.name}</span>
                  <span style={{fontSize:11,color:"#0F6E56",marginLeft:8,fontFamily:"monospace"}}>{selCli.cliCode}{selCli.dpi?" · DPI: "+selCli.dpi:""}</span>
                </div>
                <span onClick={function(){setSelCli(null);setCliQ("");setStep("search");}} style={{cursor:"pointer",color:"#E24B4A",fontWeight:700}}>× Cambiar</span>
              </div>
              <p style={{fontSize:13,color:"#555",margin:"0 0 12px"}}>Paso 2 — Seleccioná la venta a devolver (o saltá este paso)</p>
              {cliSales.length===0?(
                <div style={{background:"#f5f4f0",borderRadius:8,padding:"12px 14px",marginBottom:12,fontSize:13,color:"#666"}}>Sin ventas registradas para este cliente</div>
              ):(
                <div style={{maxHeight:240,overflowY:"auto",marginBottom:12}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead><tr>{["Fecha","Artículos","Total","Método","Estado devolución",""].map(function(h){return <th key={h} style={sTH}>{h}</th>;})}</tr></thead>
                    <tbody>
                      {cliSales.map(function(s){
                        var rowStyle={cursor:s.fullyReturned?"not-allowed":"pointer",opacity:s.fullyReturned?0.5:1};
                        return (
                          <tr key={s.id} style={rowStyle} onClick={function(){pickSale(s);}}>
                            <td style={sTD}>{fmtD(s.date)} {fmtT(s.date)}</td>
                            <td style={Object.assign({},sTD,{color:"#666"})}>{(s.items||[]).length} art.</td>
                            <td style={Object.assign({},sTD,{fontWeight:700,color:TEAL})}>{Q(s.total)}</td>
                            <td style={sTD}><span style={mBg("teal")}>{s.method}</span></td>
                            <td style={sTD}>
                              {s.fullyReturned
                                ?<span style={mBg("red")}>✓ Devuelta completa</span>
                                :s.partiallyReturned
                                  ?<span style={mBg("amber")}>⚠ Parcial ({s.totalDevuelto}/{s.totalOriginal} arts.)</span>
                                  :<span style={mBg("green")}>Disponible</span>
                              }
                            </td>
                            <td style={Object.assign({},sTD,{color:s.fullyReturned?"#999":TEAL,fontSize:12})}>
                              {s.fullyReturned?"No disponible":"Seleccionar →"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <button style={Object.assign({},mB("gray"),{fontSize:12})} onClick={function(){setStep("form");}}>Continuar sin elegir venta específica →</button>
            </div>
          )}

          {/* PASO 3: Formulario de devolución */}
          {step==="form"&&(
            <div>
              {selCli&&(
                <div style={{background:"#E1F5EE",borderRadius:8,padding:"8px 14px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontWeight:600,color:"#085041",fontSize:13}}>{selCli.name} {selCli.cliCode&&<span style={{fontFamily:"monospace",fontWeight:400,color:"#0F6E56"}}>{selCli.cliCode}</span>}</span>
                  {selSale&&<span style={{fontSize:12,color:"#0F6E56"}}>Venta: {fmtD(selSale.date)} — {Q(selSale.total)}</span>}
                </div>
              )}
              {!selCli&&<div style={{marginBottom:12}}>
                <label style={sL}>👤 Cliente</label>
                <input style={sI} value={form.client} placeholder="Nombre del cliente" onChange={function(e){setF("client",e.target.value);}}/>
              </div>}

              {err&&<p style={{color:"#E24B4A",fontSize:13,margin:"0 0 10px"}}>⚠ {err}</p>}

              <div style={{marginBottom:12}}>
                <label style={sL}>📋 Motivo de devolución</label>
                <input style={sI} value={form.reason} placeholder="Ej: Pantalla defectuosa" onChange={function(e){setErr("");setF("reason",e.target.value);}}/>
              </div>

              <p style={{fontWeight:500,margin:"0 0 8px",fontSize:13,color:"#666"}}>Productos a devolver</p>
              {form.items.map(function(it,i){
                return (
                  <div key={i} style={{display:"grid",gridTemplateColumns:"110px 1fr 80px 100px 28px",gap:8,marginBottom:8,alignItems:"center"}}>
                    <input style={sI} placeholder="Código" value={it.code} onChange={function(e){fillCode(i,e.target.value);}}/>
                    <input style={sI} placeholder="Nombre del producto" value={it.name} onChange={function(e){setErr("");setItem(i,"name",e.target.value);}}/>
                    <input type="number" style={sI} placeholder="Cant." value={it.qty} min={1} onChange={function(e){setItem(i,"qty",parseInt(e.target.value)||1);}}/>
                    <input type="number" style={sI} placeholder="Precio Q" value={it.price||""} onChange={function(e){setItem(i,"price",parseFloat(e.target.value)||0);}}/>
                    {form.items.length>1&&<span style={{cursor:"pointer",color:"#E24B4A",fontSize:20,textAlign:"center"}} onClick={function(){delItem(i);}}>×</span>}
                  </div>
                );
              })}
              <button style={Object.assign({},mB("gray"),{padding:"5px 12px",fontSize:12,marginBottom:16})} onClick={addItem}>+ Agregar fila</button>

              {itemsTotal>0&&<div style={{background:"#f5f4f0",borderRadius:8,padding:"8px 14px",marginBottom:14,fontSize:13}}>Valor total de artículos: <b>{Q(itemsTotal)}</b></div>}

              <div className="form-grid-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
                <div>
                  <label style={sL}>💰 Estado del artículo devuelto</label>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {[["bueno","✅ Buen estado"],["defectuoso","⚠️ Defectuoso"]].map(function(pair){
                      var active=form.itemCondition===pair[0];
                      return <div key={pair[0]} onClick={function(){setF("itemCondition",pair[0]);}} style={{padding:"10px 12px",borderRadius:8,cursor:"pointer",border:"2px solid "+(active?TEAL:"rgba(0,0,0,0.15)"),background:active?"#E1F5EE":"#fff",fontSize:13,fontWeight:active?600:400,color:active?"#085041":"#444",textAlign:"center"}}>{pair[1]}</div>;
                    })}
                  </div>
                  <p style={{fontSize:11,color:"#888",margin:"6px 0 0"}}>{form.itemCondition==="bueno"?"✓ Volverá al inventario":"⚠ Irá a Piezas Defectuosas"}</p>
                </div>
                <div>
                  <label style={sL}>💵 Reembolso al cliente</label>
                  <select style={Object.assign({},sI,{marginBottom:8})} value={form.refundMethod} onChange={function(e){setF("refundMethod",e.target.value);}}>
                    <option>Efectivo</option><option>Tarjeta</option><option>Crédito en cuenta</option><option>Sin reembolso</option>
                  </select>
                  {form.refundMethod!=="Sin reembolso"&&(
                    <div>
                      <label style={sL}>Monto a reembolsar (Q)</label>
                      <input type="number" style={sI} value={form.refundAmount} placeholder={"Total: "+itemsTotal.toFixed(2)} onChange={function(e){setF("refundAmount",e.target.value);}}/>
                    </div>
                  )}
                  {form.refundMethod==="Sin reembolso"&&<div style={{background:"#f5f4f0",borderRadius:6,padding:"8px 10px",fontSize:12,color:"#666"}}>No se devolverá dinero</div>}
                </div>
              </div>
              <button style={Object.assign({},mB("blue"),{padding:"10px 24px",fontSize:14})} onClick={doReturn}>✓ Registrar devolución</button>
            </div>
          )}
        </div>
      )}

      <div className="rg-3" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
        <MetricBox label="Total devoluciones"  value={returns.length}       color="#7F77DD"/>
        <MetricBox label="Total reembolsado"   value={Q(totalReembolsado)}  color="#E24B4A"/>
        <MetricBox label="Sin reembolso"       value={totalPendReemb}       color="#666"/>
      </div>

      <div style={sC}>
        {returns.length===0?<p style={{textAlign:"center",color:"#999",padding:40}}>Sin devoluciones registradas</p>:(
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["#","Fecha","Cliente","Motivo","Estado artículo","Reembolso","Monto reimb.","Valor artícs."].map(function(h){return <th key={h} style={h==="#"?Object.assign({},sTH,{width:40,textAlign:"center"}):sTH}>{h}</th>;})}</tr></thead>
            <tbody>
              {retPag.paged.map(function(r,index){
                var cond=r.itemCondition||"bueno";
                return (
                  <tr key={r.id}>
                    <td style={{...sTD,textAlign:"center",color:"#999",fontSize:12}}>{retPag.offset+index+1}</td>
                    <td style={sTD}>{fmtD(r.date)}</td>
                    <td style={Object.assign({},sTD,{fontWeight:600})}>{r.client}</td>
                    <td style={sTD}>{r.reason}</td>
                    <td style={sTD}><span style={mBg(cond==="bueno"?"green":"amber")}>{cond==="bueno"?"✅ Buen estado":"⚠️ Defectuoso"}</span></td>
                    <td style={sTD}><span style={mBg("blue")}>{r.refundMethod}</span></td>
                    <td style={Object.assign({},sTD,{fontWeight:700,color:r.refundAmount>0?"#E24B4A":"#999"})}>{r.refundAmount>0?Q(r.refundAmount):"—"}</td>
                    <td style={Object.assign({},sTD,{color:"#666"})}>{Q(r.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <retPag.Pager/>
      </div>
    </div>
  );
}

/* ── Piezas Defectuosas ── */
function DefectiveScreen(props) {
  var defectives=props.defectives; var onUpdateStatus=props.onUpdateStatus; var onReingress=props.onReingress;
  var _f=useState("defectuoso"); var filter=_f[0]; var setFilter=_f[1];
  var filtered=defectives.filter(function(d){return filter==="todos"||d.status===filter;});
  var defPag=usePaginator(filtered,20);
  var totalPiezas=defectives.filter(function(d){return d.status==="defectuoso";}).length;
  var totalDadas=defectives.filter(function(d){return d.status==="dado_de_baja";}).length;
  var totalReing=defectives.filter(function(d){return d.status==="reingresado";}).length;
  return (
      <div>
        <p style={H1}>🔩 Piezas Defectuosas</p>
        <p style={{fontSize:14,color:"#666",margin:"-12px 0 20px",lineHeight:1.6}}>Artículos retirados del inventario por devoluciones con daño. Podés darlos de baja definitivamente o repararlos y reingresarlos al stock.</p>
        <div className="rg-3" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
          <MetricBox label="En revisión"       value={totalPiezas} color="#E24B4A"/>
          <MetricBox label="Dados de baja"     value={totalDadas}  color="#666"/>
          <MetricBox label="Reingresados"      value={totalReing}  color={TEAL}/>
        </div>
        <div style={Object.assign({},sC,{marginBottom:14})}>
          <div style={{display:"flex",gap:8}}>
            {[["defectuoso","En revisión"],["dado_de_baja","Dados de baja"],["reingresado","Reingresados"],["todos","Todos"]].map(function(pair){
              return <button key={pair[0]} style={Object.assign({},mB(filter===pair[0]?"teal":"gray"),{padding:"6px 14px"})} onClick={function(){setFilter(pair[0]);}}>{pair[1]}</button>;
            })}
          </div>
        </div>
        <div style={sC}>
          {filtered.length===0?<p style={{textAlign:"center",color:"#999",padding:40}}>Sin piezas en esta categoría</p>:(
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>{["#","Fecha","Código","Pieza","Cant.","Precio","Motivo","Estado","Acciones"].map(function(h){return <th key={h} style={h==="#"?Object.assign({},sTH,{width:40,textAlign:"center"}):sTH}>{h}</th>;})}</tr></thead>
                <tbody>
                {defPag.paged.map(function(d,index){
                  return (
                      <tr key={d.id}>
                        <td style={{...sTD,textAlign:"center",color:"#999",fontSize:12}}>{defPag.offset+index+1}</td>
                        <td style={sTD}>{fmtD(d.date)}</td>
                        <td style={Object.assign({},sTD,{fontFamily:"monospace",fontSize:12})}>{d.code}</td>
                        <td style={Object.assign({},sTD,{fontWeight:600})}>{d.name}</td>
                        <td style={sTD}>{d.qty}</td>
                        <td style={sTD}>{Q(d.price)}</td>
                        <td style={Object.assign({},sTD,{color:"#666",fontSize:12})}>{d.reason}</td>
                        <td style={sTD}>
                      <span style={mBg(d.status==="defectuoso"?"amber":d.status==="dado_de_baja"?"red":"green")}>
                        {d.status==="defectuoso"?"⚠️ En revisión":d.status==="dado_de_baja"?"🗑 Dado de baja":"✅ Reingresado"}
                      </span>
                        </td>
                        <td style={sTD}>
                          {d.status==="defectuoso"&&(
                              <div style={{display:"flex",gap:6}}>
                                <button style={Object.assign({},mB("teal"),{padding:"4px 8px",fontSize:11})} onClick={function(){onReingress(d.id);}}>↑ Reingresar</button>
                                <button style={Object.assign({},mB("red"),{padding:"4px 8px",fontSize:11})} onClick={function(){onUpdateStatus(d.id,"dado_de_baja");}}>🗑 Dar de baja</button>
                              </div>
                          )}
                          {d.status!=="defectuoso"&&<span style={{fontSize:12,color:"#999"}}>Sin acciones</span>}
                        </td>
                      </tr>
                  );
                })}
                </tbody>
              </table>
          )}
          <defPag.Pager/>
        </div>
        {defectives.length>0&&(
            <div style={Object.assign({},sC,{marginTop:16,background:"#f9f8f5"})}>
              <p style={{fontWeight:600,fontSize:14,margin:"0 0 10px"}}>ℹ️ Acciones disponibles</p>
              <div style={{fontSize:13,color:"#666",lineHeight:1.8}}>
                <p style={{margin:"0 0 4px"}}>⬆️ <b>Reingresar:</b> la pieza fue reparada — vuelve al inventario disponible para venta</p>
                <p style={{margin:0}}>🗑 <b>Dar de baja:</b> la pieza no tiene reparación — se registra como pérdida definitiva</p>
              </div>
            </div>
        )}
      </div>
  );
}

/* ── Productos ── */
function ProductsScreen(props) {
  var products=props.products; var saveProduct=props.saveProduct; var deleteProduct=props.deleteProduct;
  var importProducts=props.importProducts||function(){};
  var _s=useState(""); var search=_s[0]; var setSearch=_s[1];
  var _c=useState("Todas"); var cat=_c[0]; var setCat=_c[1];
  var _o=useState("name"); var sort=_o[0]; var setSort=_o[1];
  var _e=useState(null); var editProd=_e[0]; var setEditProd=_e[1];
  var _im=useState(false); var importing=_im[0]; var setImporting=_im[1];
  var _imMsg=useState(""); var importMsg=_imMsg[0]; var setImportMsg=_imMsg[1];
  var _ph=useState(null); var priceHistProd=_ph[0]; var setPriceHistProd=_ph[1];
  var _phd=useState([]); var priceHistData=_phd[0]; var setPriceHistData=_phd[1];
  var _phl=useState(false); var priceHistLoading=_phl[0]; var setPriceHistLoading=_phl[1];

  function openPriceHist(p){
    setPriceHistProd(p);
    setPriceHistData([]);
    setPriceHistLoading(true);
    productsAPI.priceHistory(p.id).then(function(data){
      setPriceHistData(data||[]);
      setPriceHistLoading(false);
    }).catch(function(){
      setPriceHistData([]);
      setPriceHistLoading(false);
    });
  }

  function handleImportExcel(file){
    if(!file) return;
    setImporting(true); setImportMsg("");
    var reader=new FileReader();
    reader.onload=function(e){
      try {
        var wb=XLSX.read(e.target.result,{type:"binary"});
        var ws=wb.Sheets[wb.SheetNames[0]];
        function _norm(s){return String(s==null?"":s).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
        var aoa=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
        var hRow=-1,headers=[];
        for(var _i=0;_i<aoa.length;_i++){
          var _r=(aoa[_i]||[]).map(_norm);
          if(_r.some(function(c){return c.indexOf("nombre")>=0||c==="name";})){hRow=_i;headers=_r;break;}
        }
        function _col(){for(var a=0;a<arguments.length;a++){for(var h=0;h<headers.length;h++){if(headers[h]&&headers[h].indexOf(arguments[a])>=0)return h;}}return -1;}
        function _g(row,idx){return (idx>=0&&row)?row[idx]:"";}
        var prods=[];
        if(hRow>=0){
          var _ci={name:_col("nombre","name","producto","descripcion"),category:_col("categoria","category","rubro"),shelf:_col("estanteria","shelf","ubicacion"),price:_col("precio venta","precio de venta","precio","price"),cost:_col("costo","cost","coste"),stock:_col("stock","existencia","cantidad"),unit:_col("unidad","unit","medida")};
          for(var _d=hRow+1;_d<aoa.length;_d++){
            var _row=aoa[_d]||[];
            var _nm=String(_g(_row,_ci.name)||"").trim();
            if(!_nm)continue;
            prods.push({name:_nm,category:String(_g(_row,_ci.category)||"").trim(),shelf:String(_g(_row,_ci.shelf)||"").trim(),price:parseFloat(_g(_row,_ci.price))||0,cost:parseFloat(_g(_row,_ci.cost))||0,stock:parseInt(_g(_row,_ci.stock))||0,minStock:5,unit:String(_g(_row,_ci.unit)||"uni").trim().toLowerCase()==="serv"?"serv":"uni"});
          }
        }
        if(prods.length===0){setImportMsg("\u274c No se encontraron productos v\u00e1lidos. Verific\u00e1 que us\u00e1s la plantilla correcta.");setImporting(false);return;}
        importProducts(prods,function(ok,count){
          setImporting(false);
          setImportMsg(ok?"✅ "+count+" productos importados correctamente":"❌ Error al importar. Intentá de nuevo.");
          setTimeout(function(){setImportMsg("");},5000);
        });
      } catch(err){
        setImportMsg("❌ Archivo inválido: "+err.message);
        setImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  }
  var cats=["Todas"].concat(Array.from(new Set(products.map(function(p){return p.category;}))));
  var filtered=products.filter(function(p){
    var q=search.toLowerCase();
    return(!search||(p.name||"").toLowerCase().includes(q)||(p.code||"").toLowerCase().includes(q)||(p.shelf||"").toLowerCase().includes(q))&&(cat==="Todas"||p.category===cat);
  }).sort(function(a,b){
    if(sort==="code")return (a.code||"").localeCompare(b.code||"");
    if(sort==="stock")return a.stock-b.stock;
    if(sort==="price")return a.price-b.price;
    return (a.name||"").localeCompare(b.name||"");
  });
  var prodPag=usePaginator(filtered,25);
  return (
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <p style={H1}>📦 Productos y Servicios</p>
          <div style={{display:"flex",gap:8}}>
            <label style={Object.assign({},mB("blue"),{cursor:importing?"not-allowed":"pointer",opacity:importing?0.6:1,display:"flex",alignItems:"center",gap:6})}>
              {importing?"⏳ Importando...":"📥 Importar Excel"}
              <input type="file" accept=".xlsx,.xls" style={{display:"none"}} disabled={importing}
                onChange={function(e){handleImportExcel(e.target.files[0]);e.target.value="";}}/>
            </label>
            <button style={mB("teal")} onClick={function(){setEditProd({name:"",category:"",price:"",cost:"",stock:"",shelf:"",unit:"uni"});}}>+ Agregar</button>
          </div>
        </div>
        {importMsg&&<div style={{background:importMsg.startsWith("✅")?"#EAF3DE":"#FCEBEB",border:"1px solid "+(importMsg.startsWith("✅")?"#97C459":"#F09595"),borderRadius:8,padding:"10px 16px",marginBottom:12,color:importMsg.startsWith("✅")?"#27500A":"#791F1F",fontSize:14,fontWeight:500}}>{importMsg}</div>}
        {editProd&&<ProductForm product={editProd} onSave={function(p){saveProduct(p);setEditProd(null);}} onCancel={function(){setEditProd(null);}}/>}
        <div style={Object.assign({},sC,{marginBottom:14})}>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
            <input style={Object.assign({},sI,{width:240,flex:"none"})} placeholder="Buscar..." value={search} onChange={function(e){setSearch(e.target.value);prodPag.setPage(1);}}/>
            <select style={Object.assign({},sI,{width:150,flex:"none"})} value={cat} onChange={function(e){setCat(e.target.value);}}>
              {cats.map(function(c){return <option key={c}>{c}</option>;})}
            </select>
            <select style={Object.assign({},sI,{width:160,flex:"none"})} value={sort} onChange={function(e){setSort(e.target.value);}}>
              <option value="name">Nombre A→Z</option><option value="code">Código</option>
              <option value="stock">Stock ↑</option><option value="price">Precio ↑</option>
            </select>
            <span style={{fontSize:13,color:"#666"}}>{filtered.length} items</span>
          </div>
        </div>
        <div style={sC}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["#","Código","Nombre","Categoría","Estantería","Precio","Costo","Margen","Stock",""].map(function(h){return <th key={h} style={h==="#"?Object.assign({},sTH,{width:40,textAlign:"center"}):sTH}>{h}</th>;})}</tr></thead>
            <tbody>
            {prodPag.paged.map(function(p,index){
              var mg=p.cost>0?Math.round((p.price-p.cost)/p.price*100):0;
              return (
                  <tr key={p.id}>
                    <td style={{...sTD,textAlign:"center",color:"#999",fontSize:12}}>{prodPag.offset+index+1}</td>
                    <td style={Object.assign({},sTD,{fontFamily:"monospace",fontSize:12})}>{p.code}</td>
                    <td style={Object.assign({},sTD,{fontWeight:600})}>{p.name} <span style={{fontSize:11,color:"#999",fontWeight:400}}>{p.unit}</span></td>
                    <td style={sTD}><span style={mBg("teal")}>{p.category}</span></td>
                    <td style={Object.assign({},sTD,{fontFamily:"monospace",fontSize:12})}>{p.shelf}</td>
                    <td style={Object.assign({},sTD,{color:TEAL,fontWeight:600})}>{Q(p.price)}</td>
                    <td style={sTD}>{p.cost>0?Q(p.cost):"—"}</td>
                    <td style={sTD}>{p.cost>0?<span style={mBg(mg>=30?"green":mg>=15?"amber":"red")}>{mg}%</span>:"—"}</td>
                    <td style={sTD}><span style={mBg(p.unit==="serv"?"blue":p.stock===0?"red":p.stock<5?"amber":"green")}>{p.unit==="serv"?"Serv.":p.stock}</span></td>
                    <td style={sTD}>
                      <div style={{display:"flex",gap:6}}>
                        <button style={Object.assign({},mB("blue"),{padding:"4px 10px",fontSize:12})} onClick={function(){setEditProd(Object.assign({},p));}}>✏</button>
                        <button style={Object.assign({},mB("purple"),{padding:"4px 10px",fontSize:12})} onClick={function(){openPriceHist(p);}}>📈</button>
                        <button style={Object.assign({},mB("red"),{padding:"4px 10px",fontSize:12})} onClick={function(){if(window.confirm('¿Eliminar "'+p.name+'"? Esta acción no se puede deshacer.')){deleteProduct(p.id);}}}>🗑</button>
                      </div>
                    </td>
                  </tr>
              );
            })}
            {filtered.length===0&&<tr><td colSpan={9} style={Object.assign({},sTD,{textAlign:"center",color:"#999",padding:32})}>Sin resultados</td></tr>}
            </tbody>
          </table>
          <prodPag.Pager/>
        </div>
        {priceHistProd&&(
          <div style={{position:"fixed",top:0,left:0,width:"100%",height:"100%",background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,boxSizing:"border-box"}}>
            <div style={{background:"#fff",borderRadius:16,padding:"28px 24px",maxWidth:580,width:"100%",maxHeight:"85vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
                <div>
                  <p style={{fontWeight:700,fontSize:16,margin:"0 0 4px"}}>📈 Historial de precios</p>
                  <p style={{fontSize:13,color:"#666",margin:0}}>{priceHistProd.name} <span style={{fontFamily:"monospace",fontSize:11,color:"#999"}}>({priceHistProd.code})</span></p>
                </div>
                <button style={mB("gray")} onClick={function(){setPriceHistProd(null);}}>✕ Cerrar</button>
              </div>
              <div style={{background:"#f8f8f6",borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:13,color:"#666"}}>Precio actual</span>
                <span style={{fontSize:16,fontWeight:700,color:TEAL}}>{Q(priceHistProd.price)}</span>
              </div>
              {priceHistLoading?(
                <p style={{textAlign:"center",color:"#999",padding:24}}>Cargando...</p>
              ):priceHistData.length===0?(
                <p style={{textAlign:"center",color:"#999",padding:24}}>Sin cambios de precio registrados.<br/><span style={{fontSize:12}}>Los cambios quedan registrados a partir de ahora.</span></p>
              ):(
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>{["Fecha","Precio anterior","Precio nuevo","Cambio","Usuario"].map(function(h){return <th key={h} style={sTH}>{h}</th>;})}</tr></thead>
                  <tbody>
                  {priceHistData.map(function(r,i){
                    var diff=Number(r.after)-Number(r.before);
                    var pct=Number(r.before)>0?Math.round(diff/Number(r.before)*100):0;
                    var up=diff>0;
                    return (
                      <tr key={i}>
                        <td style={Object.assign({},sTD,{fontSize:12})}>{fmtD(r.date)}<br/><span style={{color:"#999",fontSize:11}}>{fmtT(r.date)}</span></td>
                        <td style={Object.assign({},sTD,{color:"#666"})}>{Q(r.before)}</td>
                        <td style={Object.assign({},sTD,{fontWeight:600,color:TEAL})}>{Q(r.after)}</td>
                        <td style={sTD}><span style={mBg(diff===0?"gray":up?"green":"red")}>{up?"+":""}{pct}%</span></td>
                        <td style={Object.assign({},sTD,{fontSize:12})}>{r.user||"—"}<br/><span style={Object.assign({},mBg(r.role==="admin"?"teal":"blue"),{fontSize:10})}>{ROLE_LABEL[r.role]||r.role||""}</span></td>
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

/* ── Inventario ── */
function InventoryScreen(props) {
  var products=props.products;
  var secs={};
  products.filter(function(p){return p.unit!=="serv";}).forEach(function(p){
    var s=(p.shelf||"").split("-")[0];
    if(!secs[s])secs[s]=[];
    secs[s].push(p);
  });
  var total=products.filter(function(p){return p.unit!=="serv";}).reduce(function(s,p){return s+p.stock;},0);
  return (
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
          <p style={H1}>🗄️ Inventario<HelpTip text={"Lista completa de productos y servicios.\n\n• Stock: cantidad disponible en físico\n• Stock mínimo: si baja de este número aparece alerta en el Dashboard\n• Costo: precio de compra (para calcular ganancia)\n• Estantería: ubicación física del producto\n\nSolo el administrador puede crear, editar o desactivar productos."}/></p>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <div style={{background:"#f5f4f0",borderRadius:8,padding:"8px 14px",fontSize:13,color:"#666"}}>
              <b>{products.filter(function(p){return p.unit!=="serv";}).length}</b> productos · <b style={{color:TEAL}}>{total}</b> uds
            </div>
            <button style={Object.assign({},mB("teal"),{padding:"6px 12px",fontSize:12})} onClick={function(){
              var cols=["Código","Nombre","Categoría","Ubicación","Stock","Precio","Costo"];
              var rows=products.filter(function(p){return p.unit!=="serv";}).map(function(p){
                return[p.code||"",p.name,p.category||"",p.shelf||"",p.stock,p.price.toFixed(2),p.cost.toFixed(2)];
              });
              exportExcel(rows,cols,"inventario");
            }}>📊 Excel</button>
            <button style={Object.assign({},mB("blue"),{padding:"6px 12px",fontSize:12})} onClick={function(){
              var cols=["Código","Nombre","Categoría","Ubic.","Stock","Precio","Costo"];
              var rows=products.filter(function(p){return p.unit!=="serv";}).map(function(p){
                return[p.code||"",p.name,p.category||"",p.shelf||"",p.stock,"Q"+p.price.toFixed(2),"Q"+p.cost.toFixed(2)];
              });
              exportPDF("Inventario de Productos",cols,rows,"inventario");
            }}>📄 PDF</button>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(265px,1fr))",gap:16}}>
          {Object.keys(secs).sort().map(function(sec){
            var prods=secs[sec];
            var tot=prods.reduce(function(s,p){return s+p.stock;},0);
            var al=prods.filter(function(p){return p.stock<5;}).length;
            return (
                <div key={sec} style={sC}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div><p style={{fontWeight:700,fontSize:16,margin:0}}>Sección {sec}</p><p style={{fontSize:12,color:"#666",margin:"3px 0 0"}}>{prods.length} productos · {tot} uds</p></div>
                    {al>0&&<span style={mBg("amber")}>{al} alerta{al!==1?"s":""}</span>}
                  </div>
                  {prods.slice().sort(function(a,b){return a.shelf.localeCompare(b.shelf);}).map(function(p){
                    return (
                        <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid rgba(0,0,0,0.06)"}}>
                          <div style={{fontSize:13}}><span style={{fontFamily:"monospace",fontSize:10,color:"#999",marginRight:6}}>{p.shelf}</span><span>{p.name}</span></div>
                          <span style={mBg(p.stock===0?"red":p.stock<5?"amber":"green")}>{p.stock}</span>
                        </div>
                    );
                  })}
                </div>
            );
          })}
        </div>
      </div>
  );
}

/* ── Exportar Excel / PDF ── */
function exportExcel(rows, cols, filename){
  var ws = XLSX.utils.aoa_to_sheet([cols].concat(rows));
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Reporte");
  XLSX.writeFile(wb, filename+".xlsx");
}

async function exportPDF(title, cols, rows, filename){
  var jsPDF = (await import('jspdf')).jsPDF;
  var autoTable = (await import('jspdf-autotable')).default;
  var doc = new jsPDF({ orientation: rows[0]&&rows[0].length>6?"landscape":"portrait" });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.text("Generado: "+new Date().toLocaleString("es-GT"), 14, 23);
  autoTable(doc, { head:[cols], body:rows, startY:28, styles:{fontSize:8}, headStyles:{fillColor:[29,158,117]} });
  doc.save(filename+".pdf");
}

/* ── Historial ── */
function printVoucher(sale, opts){
  opts=opts||{};
  var _E=opts.estado||'';
  var _sello='',_selloCss='';
  if(_E==='pendiente'){_sello='PENDIENTE DE PAGO';_selloCss='background:#FCEBEB;color:#791F1F;border:2px solid #E24B4A;';}
  else if(_E==='parcial'){_sello=(opts.abonoHoy!=null)?'CONSTANCIA DE ABONO':'ABONO - SALDO PENDIENTE';_selloCss='background:#FAEEDA;color:#633806;border:2px solid #E65100;';}
  else if(_E==='pagado'||_E==='cancelacion'){_sello=(opts.abonoHoy!=null)?'CANCELADO - ULTIMO ABONO':'CUENTA CANCELADA';_selloCss='background:#EAF3DE;color:#27500A;border:2px solid #2E7D32;';}
  var _docLabel=_E?'Comprobante de Cuenta':'Comprobante de Venta';
  var _pmap={}; (opts.products||[]).forEach(function(pp){_pmap[pp.code]=pp.shelf;});
    var itemsHTML=(sale.items||[]).map(function(it){
      var hasDisc=it.originalPrice&&it.price<it.originalPrice;
      var _shelf=it.shelf||_pmap[it.code]||'—';
      return '<tr>'+
        '<td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:12px;font-weight:600;">'+it.name+'<br><span style="font-family:monospace;font-size:10px;color:#888;">SKU: '+it.code+' &nbsp;·&nbsp; Estant.: '+_shelf+'</span>'+
        (hasDisc?'<br><span style="font-size:10px;color:#E65100;">Descuento aplicado por: '+it.discountBy+'</span>':'')+'</td>'+
        '<td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:center;font-size:12px;">'+it.qty+'</td>'+
        '<td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:right;font-size:12px;">'+
          (hasDisc?'<span style="text-decoration:line-through;color:#bbb;font-size:10px;">Q '+Number(it.originalPrice).toFixed(2)+'</span><br>':'')+
          '<span style="color:'+(hasDisc?'#E65100':'#333')+';">Q '+Number(it.price).toFixed(2)+'</span></td>'+
        '<td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:right;font-size:12px;font-weight:700;">Q '+Number(it.price*it.qty).toFixed(2)+'</td>'+
      '</tr>';
    }).join("");

    var subtotal=(sale.items||[]).reduce(function(s,it){return s+(it.originalPrice||it.price)*it.qty;},0);
    var totalDesc=subtotal-sale.total;
    var ventaNum=sale.id.toUpperCase().slice(-8);
    var fecha=new Date(sale.date).toLocaleDateString("es-GT",{day:"2-digit",month:"long",year:"numeric"});
    var hora=new Date(sale.date).toLocaleTimeString("es-GT",{hour:"2-digit",minute:"2-digit"});

    var _rSn=getStore().store_name||STORE_FALLBACK;
    var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Comprobante '+ventaNum+'</title>'+
    '<style>'+
      '*{margin:0;padding:0;box-sizing:border-box;}'+
      'body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#222;background:#fff;max-width:700px;margin:0 auto;padding:24px;}'+
      '.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1D9E75;padding-bottom:16px;margin-bottom:20px;}'+
      '.brand h1{font-size:22px;font-weight:900;color:#1a2535;letter-spacing:-0.5px;}'+
      '.brand p{font-size:10px;color:#1D9E75;font-weight:700;letter-spacing:2px;margin-top:2px;}'+
      '.brand .sub{font-size:10px;color:#999;font-weight:400;letter-spacing:0;margin-top:4px;}'+
      '.venta-num{text-align:right;}'+
      '.venta-num .label{font-size:10px;color:#999;text-transform:uppercase;letter-spacing:1px;}'+
      '.venta-num .num{font-size:22px;font-weight:900;color:#1D9E75;margin-top:2px;}'+
      '.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;padding:14px;background:#f8f9fa;border-radius:8px;border-left:4px solid #1D9E75;}'+
      '.info-block .label{font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;}'+
      '.info-block .val{font-size:13px;font-weight:700;color:#222;}'+
      '.info-block .val-sub{font-size:11px;color:#666;margin-top:1px;}'+
      'table{width:100%;border-collapse:collapse;margin-bottom:16px;}'+
      'thead tr{background:#1a2535;}'+
      'thead th{padding:9px 10px;text-align:left;color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;}'+
      'thead th:nth-child(2),thead th:nth-child(3),thead th:nth-child(4){text-align:center;}'+
      'thead th:last-child{text-align:right;}'+
      'tbody tr:nth-child(even){background:#f9f9f9;}'+
      '.totals{display:flex;justify-content:flex-end;margin-bottom:20px;}'+
      '.totals-box{width:260px;border:1px solid #eee;border-radius:8px;overflow:hidden;}'+
      '.totals-row{display:flex;justify-content:space-between;padding:8px 14px;font-size:12px;border-bottom:1px solid #eee;}'+
      '.totals-row:last-child{background:#1D9E75;color:#fff;font-weight:700;font-size:14px;border-bottom:none;}'+
      '.totals-row .disc{color:#E65100;}'+
      '.nota-box{background:#FFFDE7;border:1px solid #FFD54F;border-radius:6px;padding:10px 14px;margin-bottom:20px;font-size:12px;}'+
      '.nota-box strong{color:#F57F17;}'+
      '.footer{border-top:2px dashed #ccc;padding-top:16px;display:flex;justify-content:space-between;align-items:center;}'+
      '.footer-left{font-size:11px;color:#999;line-height:1.8;}'+
      '.footer-right{text-align:right;font-size:11px;color:#999;line-height:1.8;}'+
      '.footer strong{color:#1D9E75;}'+
      '.gracias{text-align:center;margin:20px 0 0;font-size:13px;color:#1D9E75;font-weight:700;letter-spacing:1px;}'+
      '@media print{body{padding:12px;}button{display:none!important;}}'+
    '</style></head><body>'+

    '<div class="header">'+
      '<div class="brand">'+
        '<h1>'+_rSn+'</h1>'+
        '<p>SISTEMA DE GESTIÓN</p>'+
        '<p class="sub">Tecnología · Accesorios · Reparaciones · Guatemala</p>'+
      '</div>'+
      '<div class="venta-num">'+
        '<div class="label">'+_docLabel+'</div>'+
        '<div class="num"># '+ventaNum+'</div>'+
      '</div>'+
      '<div style="text-align:center;margin-top:4px;">'+
        '<div id="qrv" style="display:inline-block;"></div>'+
        '<div style="font-size:9px;color:#999;margin-top:3px;letter-spacing:0.5px;">ESCANEAR PARA VERIFICAR</div>'+
      '</div>'+
    '</div>'+

    (_sello?'<div style="text-align:center;margin:0 0 16px;padding:10px;border-radius:8px;font-size:17px;font-weight:900;letter-spacing:2px;'+_selloCss+'">'+_sello+'</div>':'')+
    '<div class="info-grid">'+
      '<div class="info-block">'+
        '<div class="label">Cliente</div>'+
        '<div class="val">'+sale.client+'</div>'+
        (sale.clientId?'<div class="val-sub">Código: '+sale.clientId.slice(0,8).toUpperCase()+'</div>':'')+
      '</div>'+
      '<div class="info-block">'+
        '<div class="label">Fecha y Hora</div>'+
        '<div class="val">'+fecha+'</div>'+
        '<div class="val-sub">'+hora+' hrs</div>'+
      '</div>'+
      '<div class="info-block">'+
        '<div class="label">Método de Pago</div>'+
        '<div class="val">'+sale.method+'</div>'+
      '</div>'+
      '<div class="info-block">'+
        '<div class="label">Atendido por</div>'+
        '<div class="val">'+((sale.registradoPor&&sale.registradoPor.name)?sale.registradoPor.name:(opts.usuario||'—'))+'</div>'+
        '<div class="val-sub">'+(function(){var _r=(sale.registradoPor&&sale.registradoPor.role)?sale.registradoPor.role:(opts.usuarioRole||'');return _r==='admin'?'Administrador':_r==='cajero'?'Cajero':_r==='auditor'?'Auditor':'';})()+'</div>'+
      '</div>'+
    '</div>'+

    (sale.nota?'<div class="nota-box"><strong>📝 Nota:</strong> '+sale.nota+'</div>':'')+

    '<table>'+
      '<thead><tr>'+
        '<th>Descripción / Producto</th>'+
        '<th style="text-align:center;width:60px;">Cant.</th>'+
        '<th style="text-align:right;width:100px;">Precio Unit.</th>'+
        '<th style="text-align:right;width:100px;">Subtotal</th>'+
      '</tr></thead>'+
      '<tbody>'+itemsHTML+'</tbody>'+
    '</table>'+

    '<div class="totals"><div class="totals-box">'+
      (totalDesc>0?'<div class="totals-row"><span>Precio lista:</span><span>Q '+subtotal.toFixed(2)+'</span></div>'+
      '<div class="totals-row"><span class="disc">Descuentos:</span><span class="disc">- Q '+totalDesc.toFixed(2)+'</span></div>':'')+ 
      '<div class="totals-row"><span>TOTAL:</span><span>Q '+Number(sale.total).toFixed(2)+'</span></div>'+
    '</div></div>'+

    (_E?'<div class="totals" style="margin-top:-10px;"><div class="totals-box" style="width:280px;">'+
    '<div class="totals-row"><span>Total cuenta:</span><span>Q '+Number(sale.total).toFixed(2)+'</span></div>'+
    (opts.abonoHoy!=null?'<div class="totals-row" style="color:#E65100;"><span>Abono de hoy:</span><span>+ Q '+Number(opts.abonoHoy).toFixed(2)+'</span></div>':'')+
    '<div class="totals-row"><span>Pagado acumulado:</span><span>Q '+Number(opts.pagado||0).toFixed(2)+'</span></div>'+
    '<div class="totals-row" style="background:'+(Number(opts.saldo||0)>0?'#E24B4A':'#2E7D32')+';color:#fff;font-weight:700;"><span>SALDO:</span><span>Q '+Number(opts.saldo||0).toFixed(2)+'</span></div>'+
    '</div></div>':'')+
    (opts.payments&&opts.payments.length?'<div style="margin:0 0 18px;"><div style="font-size:12px;font-weight:700;color:#1a2535;margin:0 0 6px;border-bottom:2px solid #1D9E75;padding-bottom:4px;">HISTORIAL DE ABONOS</div><table style="width:100%;border-collapse:collapse;font-size:11px;"><thead><tr style="background:#f0f0f0;"><th style="padding:5px 8px;text-align:left;">Fecha</th><th style="padding:5px 8px;text-align:left;">Metodo</th><th style="padding:5px 8px;text-align:left;">Nota</th><th style="padding:5px 8px;text-align:right;">Monto</th></tr></thead><tbody>'+opts.payments.map(function(_p){return '<tr><td style="padding:5px 8px;border-bottom:1px solid #eee;">'+new Date(_p.date).toLocaleDateString("es-GT",{day:"2-digit",month:"2-digit",year:"numeric"})+' '+new Date(_p.date).toLocaleTimeString("es-GT",{hour:"2-digit",minute:"2-digit"})+'</td><td style="padding:5px 8px;border-bottom:1px solid #eee;">'+(_p.method||'-')+'</td><td style="padding:5px 8px;border-bottom:1px solid #eee;color:#666;">'+(_p.note||'-')+'</td><td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:#1D9E75;">Q '+Number(_p.amount).toFixed(2)+'</td></tr>';}).join('')+'</tbody></table></div>':'')+
    '<div class="footer">'+
      '<div class="footer-left">'+
        '<strong>'+APP_NAME+'</strong><br>'+
        'Guatemala, C.A.<br>'+
        APP_TAGLINE+
      '</div>'+
      '<div class="footer-right">'+
        'Cantidad de artículos: <strong>'+(sale.items||[]).reduce(function(s,i){return s+i.qty;},0)+'</strong><br>'+
        'Líneas de producto: <strong>'+(sale.items||[]).length+'</strong><br>'+
        'Ref: '+sale.id.slice(0,12).toUpperCase()+
      '</div>'+
    '</div>'+
    '<p class="gracias">¡Gracias por su preferencia!</p>'+

    '</body></html>';

    var w=window.open("","_blank","width=800,height=700");
    var qrTxt=_rSn+' | #'+ventaNum+' | '+sale.client+' | '+fecha+' | Q'+Number(sale.total).toFixed(2);
    w.document.write(html+'<scr'+'ipt src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></scr'+'ipt><scr'+'ipt>window.onload=function(){try{new QRCode(document.getElementById("qrv"),{text:'+JSON.stringify(qrTxt)+',width:90,height:90,colorDark:"#1a2535",colorLight:"#fff"});}catch(e){}setTimeout(function(){window.print();},800);};</scr'+'ipt>');
    w.document.close();
  }


function HistoryScreen(props) {
  var sales=props.sales; var selectedSale=props.selectedSale; var setSelectedSale=props.setSelectedSale;
  var accounts=props.accounts||[]; var returns=props.returns||[]; var products=props.products||[]; var session=props.session||{}; var clients=props.clients||[];
  var _hf=useState("todos"); var hfilter=_hf[0]; var setHfilter=_hf[1];
  var _ho=useState("desc"); var horder=_ho[0]; var setHorder=_ho[1];
  var _hrng=useState("todos"); var hRango=_hrng[0]; var setHRango=_hrng[1];
  var _hdf=useState(""); var hDateFrom=_hdf[0]; var setHDateFrom=_hdf[1];
  var _hdt=useState(""); var hDateTo=_hdt[0]; var setHDateTo=_hdt[1];

  var hNow=new Date();
  function hInRange(dateStr){
    if(hRango==="todos") return true;
    var d=new Date(dateStr);
    if(hRango==="hoy") return d.toDateString()===hNow.toDateString();
    if(hRango==="semana"){ var ws=new Date(hNow); ws.setDate(hNow.getDate()-hNow.getDay()); ws.setHours(0,0,0,0); return d>=ws&&d<=hNow; }
    if(hRango==="mes") return d.getMonth()===hNow.getMonth()&&d.getFullYear()===hNow.getFullYear();
    if(hRango==="mes_ant"){ var pm=hNow.getMonth()===0?11:hNow.getMonth()-1; var py=hNow.getMonth()===0?hNow.getFullYear()-1:hNow.getFullYear(); return d.getMonth()===pm&&d.getFullYear()===py; }
    if(hRango==="custom"&&hDateFrom&&hDateTo){ var f=new Date(hDateFrom+"T00:00:00"); var t=new Date(hDateTo+"T23:59:59"); return d>=f&&d<=t; }
    return true;
  }

  var movs=[];
  sales.forEach(function(s){
    if(s.status==='cuenta') return; // ventas a crédito se muestran vía cuentas para evitar duplicados
    movs.push({k:"v"+s.id,date:s.date,tipo:"Venta",color:"teal",cliente:s.client,metodo:s.method,atendio:(s.registradoPor&&s.registradoPor.name)?s.registradoPor.name:(session.name||"—"),monto:Number(s.total),signo:1,kind:"sale",obj:s});
  });
  accounts.forEach(function(a){
    movs.push({k:"a"+a.id,date:a.date,tipo:"Venta a credito",color:"purple",cliente:a.client,metodo:"Credito",atendio:(a.registradoPor&&a.registradoPor.name)?a.registradoPor.name:(session.name||"—"),monto:Number(a.total),signo:1,kind:"credito",obj:a});
    var _ac=0;
    (a.payments||[]).forEach(function(p){
      _ac+=Number(p.amount);
      var _sd=Math.max(0,Number(a.total)-_ac);
      var _fin=_sd<=0.009;
      movs.push({k:"p"+(p.id||(a.id+_ac)),date:p.date,tipo:_fin?"Cancelacion":"Abono",color:_fin?"green":"amber",cliente:a.client,metodo:p.method,atendio:(p.registradoPor&&p.registradoPor.name)?p.registradoPor.name:(session.name||"—"),monto:Number(p.amount),signo:1,kind:"abono",obj:a,pdata:{estado:_fin?"pagado":"parcial",abonoHoy:Number(p.amount),pagado:_ac,saldo:_sd}});
    });
  });
  returns.forEach(function(r){if(Number(r.refundAmount)>0){movs.push({k:"r"+r.id,date:r.date,tipo:"Devolucion",color:"red",cliente:r.client,metodo:r.refundMethod,atendio:(r.registradoPor&&r.registradoPor.name)?r.registradoPor.name:"—",monto:Number(r.refundAmount),signo:-1,kind:"devolucion",obj:r});}});
  movs.sort(function(a,b){return horder==="desc"?(new Date(b.date)-new Date(a.date)):(new Date(a.date)-new Date(b.date));});
  var fmovs=movs.filter(function(m){
    if(hfilter!=="todos"&&m.kind!==hfilter) return false;
    return hInRange(m.date);
  });
  var histPag=usePaginator(fmovs,25);

  if(selectedSale){
    return (
        <div>
          <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
            <button style={mB("gray")} onClick={function(){setSelectedSale(null);}}>← Volver</button>
            <button style={mB("teal")} onClick={function(){printVoucher(selectedSale,{usuario:session.name,usuarioRole:session.role,products:products});}}>🖨 Imprimir / PDF</button>
            <button style={Object.assign({},mB("green"),{background:"#25D366"})} onClick={function(){
              var tel=selectedSale.clientPhone||(selectedSale.clientId&&(clients.find(function(c){return c.id===selectedSale.clientId;})||{}).phone)||"";
              var getMsj=function(){return waBoletaVenta(selectedSale);};
              var waopts={sale:selectedSale,receiptOpts:{usuario:session.name,usuarioRole:session.role}};
              if(tel){compartirWhatsApp(tel,getMsj,waopts);}else{pedirTelYEnviar(selectedSale.client,getMsj,waopts);}
            }}>💬 WhatsApp</button>
          </div>
          <div style={sC}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
              <div>
                <p style={{fontWeight:600,fontSize:16,margin:"0 0 4px"}}>Detalle de Venta</p>
                <p style={{fontSize:13,color:"#666",margin:"0 0 2px"}}>{fmtD(selectedSale.date)} {fmtT(selectedSale.date)}</p>
                <p style={{fontSize:13,margin:"2px 0"}}>👤 <b>{selectedSale.client}</b></p>
                {selectedSale.nota&&<p style={{fontSize:13,color:"#666",margin:"4px 0 0"}}>📝 {selectedSale.nota}</p>}
                {selectedSale.registradoPor&&<p style={{fontSize:12,color:"#999",margin:"4px 0 0"}}>Registrado por: <b style={{color:"#666"}}>{selectedSale.registradoPor.name}</b> <span style={mBg("gray")}>{ROLE_LABEL[selectedSale.registradoPor.role]||selectedSale.registradoPor.role}</span></p>}
              </div>
              <div style={{textAlign:"right"}}>
                <span style={mBg("teal")}>{selectedSale.method}</span>
                <p style={{fontSize:22,fontWeight:700,color:TEAL,margin:"6px 0 0"}}>{Q(selectedSale.total)}</p>
              </div>
            </div>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Código","Producto","Cant.","Precio unit.","Subtotal"].map(function(h){return <th key={h} style={sTH}>{h}</th>;})}</tr></thead>
              <tbody>
              {(selectedSale.items||[]).map(function(it,i){
                var hasDisc=it.originalPrice&&it.price<it.originalPrice;
                return <tr key={i}>
                  <td style={Object.assign({},sTD,{fontFamily:"monospace",fontSize:12})}>{it.code}</td>
                  <td style={Object.assign({},sTD,{fontWeight:600})}>
                    {it.name}
                    {hasDisc&&<span style={Object.assign({},mBg("amber"),{marginLeft:6,fontSize:10})}>% Desc.</span>}
                  </td>
                  <td style={sTD}>{it.qty}</td>
                  <td style={sTD}>
                    {hasDisc&&<div style={{fontSize:10,color:"#999",textDecoration:"line-through"}}>{Q(it.originalPrice)}</div>}
                    <div style={{color:hasDisc?"#E65100":"inherit"}}>{Q(it.price)}</div>
                    {hasDisc&&<div style={{fontSize:10,color:"#E65100"}}>Por: {it.discountBy}</div>}
                  </td>
                  <td style={Object.assign({},sTD,{fontWeight:700,color:TEAL})}>{Q(it.price*it.qty)}</td>
                </tr>;
              })}
              </tbody>
            </table>
            <div style={{borderTop:"1px solid rgba(0,0,0,0.1)",marginTop:8,paddingTop:10,textAlign:"right"}}>
              <span style={{fontSize:16,fontWeight:700,color:TEAL}}>Total: {Q(selectedSale.total)}</span>
            </div>
          </div>
        </div>
    );
  }

  var totEnt=movs.filter(function(m){return m.signo>0;}).reduce(function(x,m){return x+m.monto;},0);
  var totSal=movs.filter(function(m){return m.signo<0;}).reduce(function(x,m){return x+m.monto;},0);
  function imprimirMov(m){
    if(m.kind==="sale")printVoucher(m.obj,{usuario:session.name,usuarioRole:session.role,products:products});
    else if(m.kind==="credito")printVoucher(m.obj,{estado:m.obj.status==="pagado"?"pagado":m.obj.status==="parcial"?"parcial":"pendiente",pagado:m.obj.paid,saldo:m.obj.balance,usuario:session.name,usuarioRole:session.role,products:products,payments:m.obj.payments});
    else if(m.kind==="abono")printVoucher(m.obj,{estado:m.pdata.estado,abonoHoy:m.pdata.abonoHoy,pagado:m.pdata.pagado,saldo:m.pdata.saldo,usuario:session.name,usuarioRole:session.role,products:products,payments:m.obj.payments});
  }
  var hfilters=[["todos","Todos"],["sale","Ventas"],["credito","Creditos"],["abono","Abonos"],["devolucion","Devoluciones"]];
  return (
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
          <p style={H1}>📋 Historial de Movimientos<HelpTip text={"Registro de todas las transacciones del negocio.\n\n• Ventas: cobros en caja\n• Créditos: ventas al fiado\n• Abonos: pagos parciales de créditos\n• Devoluciones: productos devueltos\n\nPodés filtrar por tipo, fecha o rango personalizado y exportar a Excel o PDF."}/></p>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:13,color:"#666"}}>{fmovs.length} registros</span>
            <button style={Object.assign({},mB("teal"),{padding:"6px 12px",fontSize:12})} onClick={function(){
              var cols=["Fecha","Tipo","Cliente","Método","Atendió","Monto"];
              var rows=fmovs.map(function(m){return[fmtD(m.date)+" "+fmtT(m.date),m.tipo,m.cliente||"",m.metodo||"",m.atendio||"",(m.signo<0?"-":"+")+m.monto.toFixed(2)];});
              exportExcel(rows,cols,"historial_movimientos");
            }}>📊 Excel</button>
            <button style={Object.assign({},mB("blue"),{padding:"6px 12px",fontSize:12})} onClick={function(){
              var cols=["Fecha","Tipo","Cliente","Método","Atendió","Monto"];
              var rows=fmovs.map(function(m){return[fmtD(m.date)+" "+fmtT(m.date),m.tipo,m.cliente||"",m.metodo||"",m.atendio||"",(m.signo<0?"-Q":"+Q")+m.monto.toFixed(2)];});
              exportPDF("Historial de Movimientos",cols,rows,"historial_movimientos");
            }}>📄 PDF</button>
          </div>
        </div>
        <div className="rg-3" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:18}}>
          <MetricBox label="Entradas (ventas + abonos)" value={Q(totEnt)} color={TEAL}/>
          <MetricBox label="Salidas (devoluciones)" value={Q(totSal)} color="#E24B4A"/>
          <MetricBox label="Movimientos totales" value={movs.length} color="#378ADD"/>
        </div>
        <div style={Object.assign({},sC,{marginBottom:14})}>
          {/* Filtro por período */}
          <div style={{marginBottom:12}}>
            <p style={{fontSize:12,fontWeight:600,color:"#888",margin:"0 0 8px",textTransform:"uppercase",letterSpacing:"0.5px"}}>📅 Período</p>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {[["todos","Todos"],["hoy","Hoy"],["semana","Esta semana"],["mes","Este mes"],["mes_ant","Mes anterior"],["custom","Personalizado"]].map(function(pair){
                return <button key={pair[0]} style={Object.assign({},mB(hRango===pair[0]?"teal":"gray"),{padding:"5px 12px",fontSize:12})} onClick={function(){setHRango(pair[0]);}}>{pair[1]}</button>;
              })}
            </div>
            {hRango==="custom"&&<div style={{display:"flex",gap:12,alignItems:"center",marginTop:10,flexWrap:"wrap"}}>
              <div><label style={{fontSize:12,color:"#666",display:"block",marginBottom:3}}>Desde</label><input type="date" style={Object.assign({},sI,{width:155,fontSize:13})} value={hDateFrom} onChange={function(e){setHDateFrom(e.target.value);}}/></div>
              <div><label style={{fontSize:12,color:"#666",display:"block",marginBottom:3}}>Hasta</label><input type="date" style={Object.assign({},sI,{width:155,fontSize:13})} value={hDateTo} onChange={function(e){setHDateTo(e.target.value);}}/></div>
            </div>}
          </div>
          {/* Filtro por tipo + orden */}
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",justifyContent:"space-between",paddingTop:10,borderTop:"1px solid #f0ede8"}}>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {hfilters.map(function(pair){
                return <button key={pair[0]} style={Object.assign({},mB(hfilter===pair[0]?"teal":"gray"),{padding:"6px 14px"})} onClick={function(){setHfilter(pair[0]);}}>{pair[1]}</button>;
              })}
            </div>
            <button style={Object.assign({},mB("gray"),{padding:"6px 14px",whiteSpace:"nowrap"})} onClick={function(){setHorder(horder==="desc"?"asc":"desc");}}>{horder==="desc"?"↓ Recientes primero":"↑ Antiguos primero"}</button>
          </div>
        </div>
        <div style={sC}>
          {fmovs.length===0?<p style={{textAlign:"center",color:"#999",padding:48}}>Sin movimientos en esta categoria</p>:(
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>{["#","Fecha","Hora","Tipo","Cliente","Metodo","Atendio","Monto",""].map(function(h){return <th key={h} style={h==="#"?Object.assign({},sTH,{width:40,textAlign:"center"}):sTH}>{h}</th>;})}</tr></thead>
                <tbody>
                {histPag.paged.map(function(m,index){
                  var clickable=m.kind==="sale";
                  return (
                      <tr key={m.k} style={{cursor:clickable?"pointer":"default"}} onClick={clickable?function(){setSelectedSale(m.obj);}:undefined}>
                        <td style={{...sTD,textAlign:"center",color:"#999",fontSize:12}}>{histPag.offset+index+1}</td>
                        <td style={sTD}>{fmtD(m.date)}</td>
                        <td style={sTD}>{fmtT(m.date)}</td>
                        <td style={sTD}><span style={mBg(m.color)}>{m.tipo}</span></td>
                        <td style={Object.assign({},sTD,{fontWeight:500})}>{m.cliente}</td>
                        <td style={Object.assign({},sTD,{fontSize:12,color:"#666"})}>{m.metodo}</td>
                        <td style={Object.assign({},sTD,{fontSize:12,color:"#666"})}>{m.atendio}</td>
                        <td style={Object.assign({},sTD,{fontWeight:700,color:m.signo<0?"#E24B4A":TEAL})}>{m.signo<0?"- ":"+ "}{Q(m.monto)}</td>
                        <td style={sTD}>
                          {m.kind==="devolucion"
                            ?<span style={{fontSize:12,color:"#bbb"}}>—</span>
                            :<div style={{display:"flex",gap:6}}>
                              <button style={Object.assign({},mB("blue"),{padding:"4px 10px",fontSize:11})} onClick={function(e){e.stopPropagation();imprimirMov(m);}}>🖨</button>
                              {m.kind==="sale"&&<button style={Object.assign({},mB("green"),{background:"#25D366",padding:"4px 10px",fontSize:11})} onClick={function(e){
                                e.stopPropagation();
                                var tel=(clients.find(function(c){return c.id===m.obj.clientId;})||{}).phone||"";
                                var getMsj=function(){return waBoletaVenta(m.obj);};
                                var waopts={sale:m.obj,receiptOpts:{}};
                                if(tel){compartirWhatsApp(tel,getMsj,waopts);}else{pedirTelYEnviar(m.obj.client,getMsj,waopts);}
                              }}>💬</button>}
                            </div>}
                        </td>
                      </tr>
                  );
                })}
                </tbody>
              </table>
          )}
        </div>
        {fmovs.length>0&&React.createElement(histPag.Pager)}
      </div>
  );
}

/* ── Ayuda / Manual de usuario ── */
function AyudaScreen(props) {
  var session=props.session||{};
  var _open=useState(null); var openSec=_open[0]; var setOpenSec=_open[1];
  function toggle(id){ setOpenSec(openSec===id?null:id); }

  var secciones=[
    {id:"pos", ic:"🛒", titulo:"Nueva Venta (Punto de Venta)", pasos:[
      "Tocá '🛒 Nueva Venta' en el menú lateral.",
      "Buscá el producto por nombre o código en la barra de búsqueda.",
      "Tocá el producto para agregarlo al carrito. Podés cambiar la cantidad tocando los botones + y −.",
      "Elegí el método de pago: Efectivo, Tarjeta o Transferencia.",
      "Si el cliente paga al contado, escribí cuánto entrega y el sistema calcula el vuelto.",
      "Si la venta es al crédito (fiado), seleccioná 'Crédito' y escribí el nombre del cliente. Esto crea una cuenta por cobrar automáticamente.",
      "Tocá '✓ Cobrar' para finalizar. El sistema imprime el comprobante y actualiza el stock.",
    ], tips:[
      "Podés aplicar descuento a un producto tocando su precio en el carrito.",
      "Para buscar más rápido, escaneá el código de barras si tenés un lector.",
    ]},
    {id:"inventario", ic:"🗄️", titulo:"Inventario", pasos:[
      "En '🗄️ Inventario' ves todos los productos con su stock actual.",
      "El stock cambia automáticamente al hacer ventas, devoluciones o compras a proveedores.",
      "Si un producto llega a su stock mínimo, aparece una alerta naranja en el Dashboard.",
      "Para ver el historial de precios y movimientos de un producto, tocá el producto y luego 'Ver historial'.",
    ], tips:[
      "Para agregar productos nuevos, andá a '📦 Productos' (solo administrador).",
      "El 'Costo' de un producto es el precio al que lo compraste. Sirve para calcular la ganancia en los Cuadres.",
      "La 'Estantería' es donde guardás el producto físicamente (ej: 'Vitrina 2, fila 3').",
    ]},
    {id:"cuentas", ic:"💳", titulo:"Cuentas por Cobrar", pasos:[
      "Acá aparecen todos los clientes que compraron al fiado.",
      "El estado puede ser: Pendiente (no han pagado nada), Abono parcial (pagaron una parte) o Pagado (saldo en cero).",
      "Para registrar un pago, tocá 'Atender →' en la cuenta del cliente.",
      "Escribí el monto recibido, el método (Efectivo/Transferencia/Tarjeta) y tocá '✓ Registrar pago'.",
      "Si querés enviarle un recordatorio de cobro por WhatsApp, tocá el botón 💬 verde.",
      "Para enviar recordatorio a varios clientes a la vez, usá el botón '📱 Recordatorio masivo'.",
    ], tips:[
      "La sección 'Antigüedad de cuentas' muestra cuánto tiempo llevan sin pagar (0-30, 31-60, 61-90, +90 días).",
      "Podés exportar la lista de cuentas a Excel o PDF para llevar tu control.",
    ]},
    {id:"reparaciones", ic:"🔧", titulo:"Reparaciones", pasos:[
      "Al recibir un equipo, tocá '+ Nueva Reparación' y llenás: cliente, marca, modelo, problema y técnico asignado.",
      "El flujo de estados es: Recibido → En revisión → Esperando repuesto → Listo → Entregado.",
      "Para cambiar el estado, abrí la reparación y tocá el estado nuevo.",
      "Cuando el equipo esté 'Listo', el Dashboard muestra una alerta para avisarte.",
      "Al marcar 'Entregado' y cobrar, podés enviar el comprobante por WhatsApp al cliente.",
    ], tips:[
      "Podés crear una Garantía automáticamente desde la pantalla de reparación.",
      "Las reparaciones vencidas (sin actualizar en varios días) aparecen en alerta roja en el Dashboard.",
    ]},
    {id:"clientes", ic:"👥", titulo:"Clientes", pasos:[
      "Guardá los datos de tus clientes: nombre, teléfono, NIT y dirección.",
      "El teléfono es importante — se usa para enviar comprobantes y recordatorios por WhatsApp automáticamente.",
      "Desde el perfil de un cliente podés ver todas sus compras, cuentas y reparaciones.",
      "Para agregar un cliente nuevo, tocá '+ Nuevo Cliente'.",
    ], tips:[
      "También podés crear clientes directamente desde la pantalla de Nueva Venta al hacer una venta al crédito.",
    ]},
    {id:"cuadres", ic:"📈", titulo:"Cuadres y Reportes", pasos:[
      "Elegí el período: Hoy, Esta semana, Este mes, Mes anterior o un rango personalizado.",
      "Verás el total de ventas, ingresos por método de pago, devoluciones y ganancia bruta.",
      "La 'Ganancia bruta' solo aparece si cargaste el costo de los productos en el inventario.",
      "Podés imprimir el cuadre completo o exportarlo a Excel desde los botones en la parte superior.",
    ], tips:[
      "El cuadre es diferente al cierre de caja. El cierre de caja es del día; el cuadre puede abarcar cualquier período.",
      "La sección 'Más rentables' muestra qué productos generaron más ganancia en el período.",
    ]},
    {id:"caja", ic:"💵", titulo:"Apertura y Cierre de Caja", pasos:[
      "Al inicio del día, andá a '💵 Caja' y tocá 'Abrir caja'. Ingresá el efectivo inicial (fondo de cambio).",
      "Durante el día, el sistema lleva el saldo automáticamente.",
      "Al final del día, tocá 'Cerrar caja'. El sistema muestra el resumen del día y genera un respaldo automático.",
      "El cierre imprime un voucher con el detalle de ventas, abonos y reembolsos del día.",
    ], tips:[
      "Si el efectivo físico no cuadra con el sistema, revisá si hay ventas sin registrar o reembolsos.",
    ]},
    {id:"respaldo", ic:"💾", titulo:"Respaldo de Datos", pasos:[
      "Tus datos están guardados en la nube (Supabase) de forma automática.",
      "Para bajar una copia local, andá a '💾 Respaldo' y tocá 'Descargar Excel completo'.",
      "El sistema también hace un respaldo automático cada vez que cerrás la caja.",
      "Se recomienda hacer un respaldo manual una vez por semana.",
    ], tips:[
      "El archivo Excel tiene 13 hojas: Productos, Ventas, Detalle de Ventas, Cuentas, Pagos, Clientes, Reparaciones y más.",
      "Si aparece la alerta amarilla de respaldo en el Dashboard, significa que hace más de 7 días que no respaldás.",
    ]},
  ];

  var visible=secciones.filter(function(s){
    if(session.role==="cajero") return ["pos","cuentas","reparaciones","clientes","caja"].indexOf(s.id)>=0;
    if(session.role==="auditor") return ["cuadres","respaldo"].indexOf(s.id)>=0;
    return true;
  });

  return (
    <div>
      <p style={H1}>📖 Manual de Usuario</p>
      <div style={Object.assign({},sC,{marginBottom:16,background:"linear-gradient(135deg,"+NAVY+" 0%,#1a3a2a 100%)",padding:"16px 20px"})}>
        <p style={{color:"#fff",fontWeight:700,fontSize:15,margin:"0 0 4px"}}>Bienvenido a la guía de {APP_NAME}</p>
        <p style={{color:"rgba(255,255,255,0.7)",fontSize:13,margin:0}}>Tocá cada sección para ver los pasos y consejos. Si tenés dudas, contactá a tu administrador.</p>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {visible.map(function(sec){
          var isOpen=openSec===sec.id;
          return (
            <div key={sec.id} style={{borderRadius:12,border:"1px solid "+(isOpen?"#1D9E75":"rgba(0,0,0,0.1)"),overflow:"hidden",transition:"border-color 0.2s"}}>
              <button
                onClick={function(){toggle(sec.id);}}
                style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",background:isOpen?"#f0faf6":"#fff",border:"none",cursor:"pointer",textAlign:"left"}}
              >
                <span style={{fontWeight:700,fontSize:15,color:isOpen?TEAL:NAVY}}>{sec.ic} {sec.titulo}</span>
                <span style={{fontSize:18,color:isOpen?TEAL:"#aaa",transition:"transform 0.2s",display:"inline-block",transform:isOpen?"rotate(90deg)":"none"}}>›</span>
              </button>
              {isOpen&&(
                <div style={{padding:"0 18px 18px",background:"#fff"}}>
                  <p style={{fontWeight:600,fontSize:13,color:"#555",margin:"0 0 10px",borderBottom:"1px solid #eee",paddingBottom:8}}>Pasos</p>
                  <ol style={{margin:"0 0 16px",paddingLeft:20}}>
                    {sec.pasos.map(function(p,i){
                      return <li key={i} style={{fontSize:14,color:"#333",marginBottom:8,lineHeight:1.6}}>{p}</li>;
                    })}
                  </ol>
                  {sec.tips&&sec.tips.length>0&&(
                    <div style={{background:"#f0faf6",borderRadius:8,padding:"10px 14px",borderLeft:"3px solid "+TEAL}}>
                      <p style={{fontWeight:700,fontSize:12,color:TEAL,margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.5px"}}>💡 Consejos</p>
                      {sec.tips.map(function(t,i){
                        return <p key={i} style={{fontSize:13,color:"#444",margin:i<sec.tips.length-1?"0 0 6px":0,lineHeight:1.5}}>• {t}</p>;
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={Object.assign({},sC,{marginTop:16,textAlign:"center",background:"#f5f4f0"})}>
        <p style={{fontSize:13,color:"#666",margin:"0 0 4px"}}>¿Necesitás más ayuda?</p>
        <a href={"https://wa.me/50254707112?text="+encodeURIComponent("Hola, necesito ayuda con el sistema "+APP_NAME+".")} target="_blank" rel="noreferrer" style={{color:TEAL,fontWeight:700,fontSize:14,textDecoration:"none"}}>💬 Contactar soporte por WhatsApp →</a>
      </div>
    </div>
  );
}

/* ── Respaldo ── */
function BackupScreen(props) {
  var products=props.products||[]; var sales=props.sales||[];
  var accounts=props.accounts||[]; var returns=props.returns||[]; var defectives=props.defectives||[];
  var clients=props.clients||[]; var repairs=props.repairs||[]; var warranties=props.warranties||[];
  var onExportJSON=props.onExportJSON; var onExportExcel=props.onExportExcel;
  var _m=useState(""); var msg=_m[0]; var setMsg=_m[1];
  var _busy=useState(false); var busy=_busy[0]; var setBusy=_busy[1];

  var lastBackupStr=null;
  try{ lastBackupStr=localStorage.getItem("mnpos-last-backup"); }catch(e){}
  var lastBackup=lastBackupStr?new Date(lastBackupStr):null;
  var daysSince=lastBackup?Math.floor((new Date()-lastBackup)/86400000):null;
  var needsBackup=daysSince===null||daysSince>=7;

  var bm={ok:{bg:"#EAF3DE",border:"#97C459",color:"#27500A",text:"✓ Respaldo descargado correctamente"},error:{bg:"#FCEBEB",border:"#F09595",color:"#791F1F",text:"✗ Error al generar respaldo"}}[msg];

  async function doExcelFull(){
    setBusy(true);
    try { await onExportExcel(); setMsg("ok"); } catch(e){ setMsg("error"); }
    setBusy(false);
    setTimeout(function(){setMsg("");},3500);
  }
  async function doJSON(){
    setBusy(true);
    try { await onExportJSON(); setMsg("ok"); } catch(e){ setMsg("error"); }
    setBusy(false);
    setTimeout(function(){setMsg("");},3500);
  }

  var metrics=[
    {lb:"Productos",    val:products.length,    c:TEAL},
    {lb:"Clientes",     val:clients.length,     c:"#378ADD"},
    {lb:"Ventas",       val:sales.length,       c:"#7F77DD"},
    {lb:"Reparaciones", val:repairs.length,     c:"#E65100"},
    {lb:"Garantías",    val:warranties.length,  c:"#27AE60"},
    {lb:"Cuentas",      val:accounts.length,    c:"#8E44AD"},
    {lb:"Devoluciones", val:returns.length,     c:"#E24B4A"},
    {lb:"Defectuosas",  val:defectives.length,  c:"#999"},
  ];

  return (
    <div>
      <p style={H1}>💾 Respaldo y Exportación</p>

      {/* Alerta si no hay respaldo reciente */}
      {needsBackup&&<div style={{background:"#FFF8E6",border:"1px solid #F5C842",borderRadius:10,padding:"12px 18px",marginBottom:20,display:"flex",alignItems:"center",gap:12}}>
        <span style={{fontSize:22}}>⚠️</span>
        <div>
          <p style={{margin:0,fontWeight:700,fontSize:14,color:"#7A5000"}}>{lastBackup?"Hace "+daysSince+" días sin respaldo":"Sin respaldo registrado"}</p>
          <p style={{margin:"3px 0 0",fontSize:12,color:"#7A5000"}}>Se recomienda respaldar al menos una vez por semana.</p>
        </div>
      </div>}

      {bm&&<div style={{background:bm.bg,border:"1px solid "+bm.border,borderRadius:8,padding:"10px 16px",marginBottom:16,color:bm.color,fontSize:14,fontWeight:500}}>{bm.text}</div>}

      {/* Métricas de lo que se va a respaldar */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:12,marginBottom:24}}>
        {metrics.map(function(m){ return <div key={m.lb} style={Object.assign({},sC,{padding:"12px 16px"})}>
          <div style={{fontSize:20,fontWeight:800,color:m.c}}>{m.val}</div>
          <div style={{fontSize:11,color:"#888",marginTop:2}}>{m.lb}</div>
        </div>; })}
      </div>

      {/* Último respaldo */}
      {lastBackup&&<div style={{background:"#f0f9f5",borderRadius:8,padding:"10px 16px",marginBottom:20,fontSize:13,color:"#444"}}>
        🕐 Último respaldo: <b>{fmtD(lastBackup)}</b> a las <b>{fmtT(lastBackup)}</b>
        {daysSince===0&&<span style={{marginLeft:8,color:TEAL,fontWeight:700}}>✓ Al día</span>}
      </div>}

      {/* Excel completo */}
      <div style={Object.assign({},sC,{marginBottom:16,borderLeft:"4px solid "+TEAL})}>
        <p style={{fontWeight:700,fontSize:15,margin:"0 0 6px"}}>📊 Exportar a Excel completo (.xls)</p>
        <p style={{fontSize:13,color:"#666",margin:"0 0 12px",lineHeight:1.6}}>
          18 hojas con todo el detalle: Resumen · Productos · Ventas · Detalle Ventas · Cuentas · Historial Pagos · Devoluciones · Clientes · Reparaciones · Garantías · Proveedores · Compras · Piezas Defectuosas. Si algún módulo no se descarga, queda marcado en la hoja Resumen.
        </p>
        <button style={Object.assign({},mB("teal"),{padding:"11px 28px",fontSize:14,opacity:busy?0.6:1})} onClick={doExcelFull} disabled={busy}>
          {busy?"Generando…":"📊 Descargar Excel"}
        </button>
      </div>

      {/* JSON */}
      <div style={Object.assign({},sC,{marginBottom:16,borderLeft:"4px solid #378ADD"})}>
        <p style={{fontWeight:700,fontSize:15,margin:"0 0 6px"}}>💾 Respaldo completo (.json)</p>
        <p style={{fontSize:13,color:"#666",margin:"0 0 12px",lineHeight:1.6}}>
          Archivo con todos los datos del sistema. Útil para migración o auditoría externa.
        </p>
        <button style={Object.assign({},mB("blue"),{padding:"11px 28px",fontSize:14,opacity:busy?0.6:1})} onClick={doJSON} disabled={busy}>
          {busy?"Generando…":"💾 Descargar .json"}
        </button>
      </div>

      {/* Nota sobre restauración */}
      <div style={{background:"#f5f4f0",borderRadius:10,padding:"14px 18px",border:"1px solid #e0ddd7"}}>
        <p style={{margin:0,fontSize:13,color:"#888",lineHeight:1.6}}>
          ℹ️ <b>¿Cómo funciona el respaldo?</b> Tus datos están almacenados de forma segura en la nube (Supabase). Este respaldo es una copia local para tu propio resguardo. Para restaurar datos ante un problema, contactá al administrador del sistema.
        </p>
      </div>
    </div>
  );
}

/* ══ CLIENTES ══════════════════════════════════════════════════════════ */
function ClientsScreen(props) {
  var clients=props.clients; var sales=props.sales; var accounts=props.accounts;
  var returns=props.returns; var saveClient=props.saveClient; var session=props.session;
  var showFlash=props.showFlash;

  var _q=useState(""); var q=_q[0]; var setQ=_q[1];
  var _sel=useState(null); var selCli=_sel[0]; var setSelCli=_sel[1];
  var _sf=useState(false); var showForm=_sf[0]; var setShowForm=_sf[1];
  var _eu=useState(null); var editCli=_eu[0]; var setEditCli=_eu[1];
  var _fn=useState(""); var fName=_fn[0]; var setFName=_fn[1];
  var _fd=useState(""); var fDpi=_fd[0]; var setFDpi=_fd[1];
  var _ft=useState(""); var fTel=_ft[0]; var setFTel=_ft[1];
  var _fa=useState(""); var fAddr=_fa[0]; var setFAddr=_fa[1];
  var _fe=useState(""); var fErr=_fe[0]; var setFErr=_fe[1];

  var filtered=clients.filter(function(c){
    if(!q.trim()) return true;
    var ql=q.toLowerCase();
    return (c.name||"").toLowerCase().includes(ql)||(c.dpi||"").includes(q.trim())||(c.cliCode||"").toLowerCase().includes(ql)||(c.phone||"").includes(q.trim());
  });
  var cliPag=usePaginator(filtered,20);

  function resetForm(){setFName("");setFDpi("");setFTel("");setFAddr("");setFErr("");setEditCli(null);setShowForm(false);}

  function doSave(){
    if(!fName.trim()){setFErr("El nombre es obligatorio");return;}
    if(fDpi.trim()&&!validarDPI(fDpi)){setFErr("El DPI debe tener exactamente 13 dígitos");return;}
    if(fDpi.trim()){
      var dup=clients.find(function(c){return c.dpi===fDpi.trim()&&(!editCli||c.id!==editCli.id);});
      if(dup){setFErr("Ya existe un cliente con ese DPI: "+dup.name+" ("+dup.cliCode+")");return;}
    }
    var cliCode=editCli?editCli.cliCode:genCliCode(clients);
    var obj={
      id:editCli?editCli.id:gid(),
      cliCode:cliCode,
      name:fName.trim(),
      dpi:fDpi.trim()||"",
      phone:fTel.trim()||"",
      address:fAddr.trim()||"",
      active:true,
      createdAt:editCli?editCli.createdAt:new Date().toISOString(),
      createdBy:editCli?editCli.createdBy:{userId:session.userId,name:session.name,role:session.role},
    };
    saveClient(obj,!!editCli);
    showFlash(editCli?"✓ Cliente actualizado":"✓ Cliente registrado — "+cliCode,"ok");
    resetForm();
  }

  function startEdit(c){setEditCli(c);setFName(c.name);setFDpi(c.dpi||"");setFTel(c.phone||"");setFAddr(c.address||"");setFErr("");setShowForm(true);}

  // Vista perfil 360°
  if(selCli){
    var cli=clients.find(function(c){return c.id===selCli;});
    if(!cli){setSelCli(null);return null;}
    var cliSales=sales.filter(function(s){return s.clientId===cli.id||(s.client===cli.name&&!s.clientId);});
    var cliAccs=accounts.filter(function(a){return a.clientId===cli.id||(a.client===cli.name&&!a.clientId);});
    var cliRets=returns.filter(function(r){return r.clientId===cli.id||(r.client===cli.name&&!r.clientId);});
    var totalComprado=cliSales.reduce(function(s,x){return s+x.total;},0);
    var totalPendiente=cliAccs.filter(function(a){return a.status!=="pagado";}).reduce(function(s,a){return s+a.balance;},0);
    var esFrecuente=cliSales.length>=5||totalComprado>=1000;
    var ultimaVisita=cliSales.length>0?cliSales.slice().sort(function(a,b){return new Date(b.date)-new Date(a.date);})[0].date:null;

    return (
      <div>
        <button style={Object.assign({},mB("gray"),{marginBottom:16})} onClick={function(){setSelCli(null);}}>← Volver</button>
        <div style={Object.assign({},sC,{marginBottom:16})}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                <p style={{fontSize:22,fontWeight:700,margin:0}}>{cli.name}</p>
                {esFrecuente&&<span style={mBg("amber")}>⭐ Cliente frecuente</span>}
                {totalPendiente>0&&<span style={mBg("red")}>⚠ Deuda: {Q(totalPendiente)}</span>}
              </div>
              <div style={{display:"flex",gap:16,fontSize:13,color:"#666",flexWrap:"wrap"}}>
                <span style={{fontFamily:"monospace",background:"#f5f4f0",padding:"2px 8px",borderRadius:6,fontWeight:600,color:TEAL}}>{cli.cliCode}</span>
                {cli.dpi&&<span>🪪 DPI: {cli.dpi}</span>}
                {cli.phone&&<span>📱 {cli.phone}</span>}
                {cli.address&&<span>📍 {cli.address}</span>}
              </div>
            </div>
            <button style={Object.assign({},mB("blue"),{padding:"6px 12px",fontSize:12})} onClick={function(){startEdit(cli);setSelCli(null);}}>✏ Editar</button>
          </div>
          <div className="rg-4" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
            <MetricBox label="Total compras"     value={cliSales.length}    color={TEAL}/>
            <MetricBox label="Total comprado"    value={Q(totalComprado)}   color="#378ADD"/>
            <MetricBox label="Deuda pendiente"   value={Q(totalPendiente)}  color={totalPendiente>0?"#E24B4A":TEAL}/>
            <MetricBox label="Devoluciones"      value={cliRets.length}     color="#7F77DD"/>
          </div>
          {ultimaVisita&&<p style={{fontSize:12,color:"#999",margin:"12px 0 0"}}>Última visita: {fmtD(ultimaVisita)} — Registrado: {fmtD(cli.createdAt)}</p>}
        </div>

        {cliAccs.filter(function(a){return a.status!=="pagado";}).length>0&&(
          <div style={Object.assign({},sC,{marginBottom:16,borderLeft:"4px solid #E24B4A"})}>
            <p style={{fontWeight:600,margin:"0 0 10px",fontSize:14,color:"#E24B4A"}}>⚠ Cuentas pendientes</p>
            {cliAccs.filter(function(a){return a.status!=="pagado";}).map(function(a){
              return <div key={a.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid rgba(0,0,0,0.05)",fontSize:14}}>
                <span>{fmtD(a.date)} — {(a.items||[]).length} artículos</span>
                <span style={{fontWeight:700,color:"#E24B4A"}}>{Q(a.balance)}</span>
              </div>;
            })}
          </div>
        )}

        {cliSales.length>0&&(
          <div style={Object.assign({},sC,{marginBottom:16})}>
            <p style={{fontWeight:600,margin:"0 0 12px",fontSize:15}}>🛒 Historial de compras</p>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Fecha","Artículos","Método","Total","Estado"].map(function(h){return <th key={h} style={sTH}>{h}</th>;})}</tr></thead>
              <tbody>{cliSales.slice(0,10).map(function(s){
                return <tr key={s.id}>
                  <td style={sTD}>{fmtD(s.date)}</td>
                  <td style={Object.assign({},sTD,{color:"#666"})}>{(s.items||[]).length} art.</td>
                  <td style={sTD}><span style={mBg("teal")}>{s.method}</span></td>
                  <td style={Object.assign({},sTD,{fontWeight:700,color:TEAL})}>{Q(s.total)}</td>
                  <td style={sTD}><span style={mBg("green")}>✓ Cobrada</span></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        )}

        {cliRets.length>0&&(
          <div style={sC}>
            <p style={{fontWeight:600,margin:"0 0 12px",fontSize:15}}>🔄 Devoluciones</p>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Fecha","Motivo","Estado artículo","Reembolso"].map(function(h){return <th key={h} style={sTH}>{h}</th>;})}</tr></thead>
              <tbody>{cliRets.map(function(r){
                return <tr key={r.id}>
                  <td style={sTD}>{fmtD(r.date)}</td>
                  <td style={sTD}>{r.reason}</td>
                  <td style={sTD}><span style={mBg(r.itemCondition==="bueno"?"green":"amber")}>{r.itemCondition==="bueno"?"Buen estado":"Defectuoso"}</span></td>
                  <td style={Object.assign({},sTD,{fontWeight:600,color:r.refundAmount>0?"#E24B4A":"#999"})}>{r.refundAmount>0?Q(r.refundAmount):"Sin reembolso"}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        )}

        {cliSales.length===0&&cliAccs.length===0&&cliRets.length===0&&(
          <div style={Object.assign({},sC,{textAlign:"center",padding:48,color:"#999"})}>Sin transacciones registradas aún para este cliente.</div>
        )}
      </div>
    );
  }

  var totalClientes=clients.length;
  var conDeuda=clients.filter(function(c){return accounts.filter(function(a){return (a.clientId===c.id||(a.client===c.name&&!a.clientId))&&a.status!=="pagado";}).length>0;}).length;
  var frecuentes=clients.filter(function(c){var cs=sales.filter(function(s){return s.clientId===c.id||(s.client===c.name&&!s.clientId);});return cs.length>=5||cs.reduce(function(s,x){return s+x.total;},0)>=1000;}).length;

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <p style={H1}>👥 Clientes<HelpTip text={"Base de datos de clientes del negocio.\n\nCada cliente puede tener nombre, teléfono, NIT y dirección. El teléfono se usa para enviar comprobantes y recordatorios de cobro por WhatsApp automáticamente.\n\nDesde aquí podés ver el historial de compras de cada cliente."}/></p>
        <button style={mB("teal")} onClick={function(){resetForm();setShowForm(true);}}>+ Nuevo cliente</button>
      </div>

      {showForm&&(
        <div style={Object.assign({},sC,{marginBottom:16,borderColor:TEAL,borderWidth:"1.5px"})}>
          <p style={{fontWeight:600,margin:"0 0 14px",fontSize:15}}>{editCli?"✏️ Editar cliente":"➕ Nuevo cliente"}</p>
          {fErr&&<div style={{background:"#FCEBEB",borderRadius:8,padding:"8px 14px",marginBottom:12,color:"#791F1F",fontSize:13}}>⚠ {fErr}</div>}
          <div className="form-grid-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
            <div><label style={sL}>Nombre completo *</label><input style={sI} value={fName} placeholder="Nombre del cliente" onChange={function(e){setFErr("");setFName(e.target.value);}}/></div>
            <div>
              <label style={sL}>DPI (13 dígitos, opcional)</label>
              <input style={sI} value={fDpi} placeholder="Sin DPI → se asigna ID automático" maxLength={13} onChange={function(e){setFErr("");setFDpi(e.target.value.replace(/\D/g,""));}}/>
              {fDpi&&!validarDPI(fDpi)&&<p style={{fontSize:11,color:"#E24B4A",margin:"3px 0 0"}}>⚠ Debe tener 13 dígitos ({fDpi.length}/13)</p>}
              {fDpi&&validarDPI(fDpi)&&fDpi.length===13&&<p style={{fontSize:11,color:TEAL,margin:"3px 0 0"}}>✓ DPI válido</p>}
            </div>
            <div><label style={sL}>Teléfono</label><input style={sI} value={fTel} placeholder="Ej: 55551234" onChange={function(e){setFTel(e.target.value);}}/></div>
            <div><label style={sL}>Dirección</label><input style={sI} value={fAddr} placeholder="Opcional" onChange={function(e){setFAddr(e.target.value);}}/></div>
          </div>
          {!editCli&&<div style={{background:"#f5f4f0",borderRadius:8,padding:"8px 14px",marginBottom:14,fontSize:12,color:"#666"}}>
            💡 Si el cliente no tiene DPI, se le asignará un código único automático (CLI-000001, CLI-000002…)
          </div>}
          <div style={{display:"flex",gap:10}}>
            <button style={mB("teal")} onClick={doSave}>{editCli?"Guardar cambios":"Registrar cliente"}</button>
            <button style={mB("gray")} onClick={resetForm}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="rg-3" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
        <MetricBox label="Total clientes"   value={totalClientes} color={TEAL}/>
        <MetricBox label="Con deuda activa" value={conDeuda}      color="#E24B4A"/>
        <MetricBox label="Clientes frecuentes" value={frecuentes} color="#E65100"/>
      </div>

      <div style={Object.assign({},sC,{marginBottom:14})}>
        <input style={sI} value={q} placeholder="🔍 Buscar por nombre, DPI, código CLI o teléfono..." onChange={function(e){setQ(e.target.value);}}/>
      </div>

      <div style={sC}>
        {filtered.length===0?(
          <div style={{textAlign:"center",padding:48,color:"#999"}}>
            {q?"Sin resultados para \""+q+"\""  :"Sin clientes registrados aún"}
          </div>
        ):(
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["#","Código","Nombre","DPI","Teléfono","Compras","Deuda",""].map(function(h){return <th key={h} style={h==="#"?Object.assign({},sTH,{width:40,textAlign:"center"}):sTH}>{h}</th>;})}</tr></thead>
            <tbody>
              {cliPag.paged.map(function(c,index){
                var cliSalesCount=sales.filter(function(s){return s.clientId===c.id||(s.client===c.name&&!s.clientId);}).length;
                var cliDeuda=accounts.filter(function(a){return (a.clientId===c.id||(a.client===c.name&&!a.clientId))&&a.status!=="pagado";}).reduce(function(s,a){return s+a.balance;},0);
                var esFrecuente=cliSalesCount>=5||sales.filter(function(s){return s.clientId===c.id||(s.client===c.name&&!s.clientId);}).reduce(function(s,x){return s+x.total;},0)>=1000;
                return (
                  <tr key={c.id} style={{cursor:"pointer"}} onClick={function(){setSelCli(c.id);}}>
                    <td style={{...sTD,textAlign:"center",color:"#999",fontSize:12}}>{cliPag.offset+index+1}</td>
                    <td style={Object.assign({},sTD,{fontFamily:"monospace",fontSize:12,color:TEAL,fontWeight:600})}>{c.cliCode}</td>
                    <td style={Object.assign({},sTD,{fontWeight:600})}>
                      {c.name}
                      {esFrecuente&&<span style={Object.assign({},mBg("amber"),{marginLeft:6})}>⭐</span>}
                    </td>
                    <td style={Object.assign({},sTD,{fontFamily:"monospace",fontSize:12})}>{c.dpi||<span style={{color:"#bbb"}}>Sin DPI</span>}</td>
                    <td style={Object.assign({},sTD,{color:"#666"})}>{c.phone||"—"}</td>
                    <td style={sTD}>{cliSalesCount} compras</td>
                    <td style={sTD}>{cliDeuda>0?<span style={mBg("red")}>{Q(cliDeuda)}</span>:<span style={mBg("green")}>✓ Al día</span>}</td>
                    <td style={Object.assign({},sTD,{color:"#999",fontSize:12})}>Ver →</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {filtered.length>0&&React.createElement(cliPag.Pager)}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   GARANTÍAS
   ══════════════════════════════════════ */
function WarrantiesScreen(props){
  var warranties=props.warranties||[]; var sales=props.sales||[]; var repairs=props.repairs||[];
  var saveWarranty=props.saveWarranty; var updateWarranty=props.updateWarranty;
  var session=props.session||{};

  var _sel=useState(null); var selWar=_sel[0]; var setSelWar=_sel[1];
  var _sf=useState(false); var showForm=_sf[0]; var setShowForm=_sf[1];
  var _fil=useState("todas"); var filter=_fil[0]; var setFilter=_fil[1];
  var _q=useState(""); var q=_q[0]; var setQ=_q[1];

  // Form state
  var _fet=useState("repair"); var fEntityType=_fet[0]; var setFEntityType=_fet[1];
  var _fei=useState(""); var fEntityId=_fei[0]; var setFEntityId=_fei[1];
  var _fcl=useState(""); var fClient=_fcl[0]; var setFClient=_fcl[1];
  var _fd=useState(""); var fDesc=_fd[0]; var setFDesc=_fd[1];
  var _fsm=useState(3); var fMonths=_fsm[0]; var setFMonths=_fsm[1];
  var _fsd=useState(new Date().toISOString().slice(0,10)); var fStart=_fsd[0]; var setFStart=_fsd[1];
  var _ferr=useState(""); var fErr=_ferr[0]; var setFErr=_ferr[1];

  var now=new Date();

  var displayed=warranties.filter(function(w){
    if(filter==="vigente") return w.status==="vigente";
    if(filter==="vencida") return w.status==="vencida"||new Date(w.endDate)<now;
    if(filter==="reclamada") return w.status==="reclamada";
    return true;
  }).filter(function(w){
    if(!q) return true;
    var ql=q.toLowerCase();
    return (w.client||"").toLowerCase().includes(ql)||(w.description||"").toLowerCase().includes(ql)||(w.entityId||"").toLowerCase().includes(ql);
  });
  var warPag=usePaginator(displayed,20);

  function resetForm(){setFEntityType("repair");setFEntityId("");setFClient("");setFDesc("");setFMonths(3);setFStart(new Date().toISOString().slice(0,10));setFErr("");}

  async function submitWarranty(){
    if(!fClient.trim()){setFErr("El nombre del cliente es requerido");return;}
    if(!fDesc.trim()){setFErr("Describí qué cubre la garantía");return;}
    var start=new Date(fStart+"T00:00:00");
    var end=new Date(start);
    end.setMonth(end.getMonth()+parseInt(fMonths,10));
    await saveWarranty({
      entityType:fEntityType, entityId:fEntityId.trim()||null,
      client:fClient.trim(), description:fDesc.trim(),
      startDate:fStart, endDate:end.toISOString().slice(0,10),
      months:parseInt(fMonths,10)
    });
    resetForm();setShowForm(false);
  }

  var vigentes=warranties.filter(function(w){return w.status==="vigente"&&new Date(w.endDate)>=now;}).length;
  var vencidas=warranties.filter(function(w){return w.status==="vencida"||new Date(w.endDate)<now;}).length;
  var reclamadas=warranties.filter(function(w){return w.status==="reclamada";}).length;

  // Detail view
  if(selWar){
    var war=warranties.find(function(w){return w.id===selWar;});
    if(!war){setSelWar(null);return null;}
    var warEnd=new Date(war.endDate);
    var diasRestantes=Math.ceil((warEnd-now)/86400000);
    var isVigente=war.status!=="reclamada"&&warEnd>=now;
    return (
      <div>
        <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
          <button style={mB("gray")} onClick={function(){setSelWar(null);}}>← Volver</button>
          {isVigente&&<button style={mB("amber")} onClick={async function(){await updateWarranty(war.id,{status:"reclamada"});}}>⚠️ Marcar como reclamada</button>}
          {war.status!=="vigente"&&warEnd>=now&&<button style={mB("teal")} onClick={async function(){await updateWarranty(war.id,{status:"vigente"});}}>✓ Reactivar garantía</button>}
        </div>
        <div style={sC}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
            <div>
              <p style={{fontWeight:800,fontSize:18,margin:"0 0 4px"}}>🛡️ {war.client}</p>
              <p style={{fontSize:13,color:"#666",margin:"0 0 2px"}}>{war.description}</p>
              {war.entityType&&war.entityId&&<p style={{fontSize:12,color:TEAL,margin:0,fontFamily:"monospace"}}>{war.entityType==="repair"?"Reparación":"Venta"}: {war.entityId}</p>}
            </div>
            <span style={mBg(war.status==="reclamada"?"red":isVigente?"green":"amber")}>{war.status==="reclamada"?"Reclamada":isVigente?"Vigente":"Vencida"}</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:16}}>
            <div style={{background:"#f9f8f5",borderRadius:8,padding:12}}>
              <p style={{fontSize:11,color:"#999",textTransform:"uppercase",margin:"0 0 4px"}}>Inicio</p>
              <p style={{fontWeight:700,margin:0}}>{fmtD(war.startDate)}</p>
            </div>
            <div style={{background:"#f9f8f5",borderRadius:8,padding:12}}>
              <p style={{fontSize:11,color:"#999",textTransform:"uppercase",margin:"0 0 4px"}}>Vencimiento</p>
              <p style={{fontWeight:700,margin:0}}>{fmtD(war.endDate)}</p>
            </div>
            <div style={{background:isVigente?"#EAF3DE":"#FCEBEB",borderRadius:8,padding:12}}>
              <p style={{fontSize:11,color:"#999",textTransform:"uppercase",margin:"0 0 4px"}}>{diasRestantes>0?"Días restantes":"Vencida hace"}</p>
              <p style={{fontWeight:800,fontSize:18,color:isVigente?TEAL:"#E24B4A",margin:0}}>{Math.abs(diasRestantes)} días</p>
            </div>
          </div>
          {war.status==="reclamada"&&<div style={{background:"#FCEBEB",borderRadius:8,padding:"10px 14px",border:"1px solid #F09595"}}>
            <p style={{margin:0,color:"#791F1F",fontSize:13,fontWeight:600}}>⚠️ Esta garantía fue reclamada por el cliente.</p>
          </div>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <p style={H1}>🛡️ Garantías</p>
        <button style={mB(showForm?"red":"teal")} onClick={function(){if(showForm){resetForm();setShowForm(false);}else{resetForm();setShowForm(true);}}}>
          {showForm?"✕ Cancelar":"+ Nueva garantía"}
        </button>
      </div>

      <div className="rg-3" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:16}}>
        <MetricBox label="Vigentes"  value={vigentes}  color={TEAL}/>
        <MetricBox label="Vencidas"  value={vencidas}  color="#E24B4A"/>
        <MetricBox label="Reclamadas" value={reclamadas} color="#E65100"/>
      </div>

      {showForm&&(
        <div style={Object.assign({},sC,{marginBottom:16,borderColor:TEAL,borderWidth:"1.5px"})}>
          <p style={{fontWeight:700,margin:"0 0 16px",fontSize:15}}>📋 Nueva Garantía</p>
          {fErr&&<p style={{color:"#E24B4A",fontSize:13,margin:"0 0 12px"}}>⚠ {fErr}</p>}
          <div className="form-grid-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div><label style={sL}>Tipo</label>
              <select style={sI} value={fEntityType} onChange={function(e){setFEntityType(e.target.value);}}>
                <option value="repair">Reparación</option>
                <option value="sale">Venta</option>
                <option value="other">Otro</option>
              </select></div>
            <div><label style={sL}>N° Orden / Código de referencia</label>
              <input style={sI} value={fEntityId} placeholder="Ej: REP-001 o V-0042" onChange={function(e){setFEntityId(e.target.value);}}/></div>
            <div><label style={sL}>Cliente *</label>
              <input style={sI} value={fClient} placeholder="Nombre del cliente" onChange={function(e){setFClient(e.target.value);}}/></div>
            <div><label style={sL}>Duración (meses)</label>
              <select style={sI} value={fMonths} onChange={function(e){setFMonths(e.target.value);}}>
                <option value={1}>1 mes</option>
                <option value={3}>3 meses</option>
                <option value={6}>6 meses</option>
                <option value={12}>12 meses</option>
                <option value={24}>24 meses</option>
              </select></div>
            <div><label style={sL}>Fecha de inicio</label>
              <input type="date" style={sI} value={fStart} onChange={function(e){setFStart(e.target.value);}}/></div>
            <div><label style={sL}>Qué cubre la garantía *</label>
              <input style={sI} value={fDesc} placeholder="Ej: Pantalla, batería, reparación de placa" onChange={function(e){setFDesc(e.target.value);}}/></div>
          </div>
          <button style={mB("teal")} onClick={submitWarranty}>✓ Registrar garantía</button>
        </div>
      )}

      <div style={Object.assign({},sC,{marginBottom:14})}>
        <input style={Object.assign({},sI,{marginBottom:12})} placeholder="🔍  Buscar por cliente, descripción o referencia..." value={q} onChange={function(e){setQ(e.target.value);warPag.setPage(1);}}/>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {[["todas","Todas"],["vigente","Vigentes"],["vencida","Vencidas"],["reclamada","Reclamadas"]].map(function(p){
            return <button key={p[0]} style={Object.assign({},mB(filter===p[0]?"teal":"gray"),{padding:"6px 14px"})} onClick={function(){setFilter(p[0]);}}>{p[1]}</button>;
          })}
        </div>
      </div>

      <div style={sC}>
        {displayed.length===0?<p style={{textAlign:"center",color:"#999",padding:40}}>Sin garantías en esta categoría</p>:(
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["#","Cliente","Descripción","Referencia","Inicio","Vencimiento","Estado",""].map(function(h){return <th key={h} style={h==="#"?Object.assign({},sTH,{width:40,textAlign:"center"}):sTH}>{h}</th>;})}</tr></thead>
            <tbody>
            {warPag.paged.map(function(w,index){
              var wEnd=new Date(w.endDate);
              var dias=Math.ceil((wEnd-now)/86400000);
              var isVig=w.status!=="reclamada"&&wEnd>=now;
              return (
                <tr key={w.id} style={{cursor:"pointer"}} onClick={function(){setSelWar(w.id);}}>
                  <td style={{...sTD,textAlign:"center",color:"#999",fontSize:12}}>{warPag.offset+index+1}</td>
                  <td style={Object.assign({},sTD,{fontWeight:600})}>{w.client}</td>
                  <td style={Object.assign({},sTD,{color:"#666",maxWidth:180})}>{w.description}</td>
                  <td style={Object.assign({},sTD,{fontFamily:"monospace",fontSize:12,color:TEAL})}>{w.entityId||"—"}</td>
                  <td style={sTD}>{fmtD(w.startDate)}</td>
                  <td style={sTD}>{fmtD(w.endDate)}</td>
                  <td style={sTD}>
                    <span style={mBg(w.status==="reclamada"?"red":isVig?(dias<=7?"amber":"green"):"red")}>
                      {w.status==="reclamada"?"Reclamada":isVig?(dias<=7?"⚠ "+dias+"d":"✓ Vigente"):"Vencida"}
                    </span>
                  </td>
                  <td style={sTD}><button style={Object.assign({},mB("teal"),{padding:"4px 10px",fontSize:11})} onClick={function(e){e.stopPropagation();setSelWar(w.id);}}>Ver →</button></td>
                </tr>
              );
            })}
            </tbody>
          </table>
        )}
        <warPag.Pager/>
      </div>
    </div>
  );
}

/* ── Proveedores y Compras ── */
function SuppliersScreen(props){
  var products=props.products||[]; var session=props.session||{};
  var showFlash=props.showFlash||function(){};
  var onStockUpdate=props.onStockUpdate||function(){};

  var _tab=useState("proveedores"); var tab=_tab[0]; var setTab=_tab[1];
  var _suppliers=useState([]); var suppliers=_suppliers[0]; var setSuppliers=_suppliers[1];
  var _purchases=useState([]); var purchases=_purchases[0]; var setPurchases=_purchases[1];
  var _loading=useState(true); var loading=_loading[0]; var setLoading=_loading[1];

  // Modal proveedor
  var _ms=useState(false); var showSupModal=_ms[0]; var setShowSupModal=_ms[1];
  var _editSup=useState(null); var editSup=_editSup[0]; var setEditSup=_editSup[1];
  var _sName=useState(""); var sName=_sName[0]; var setSName=_sName[1];
  var _sPhone=useState(""); var sPhone=_sPhone[0]; var setSPhone=_sPhone[1];
  var _sEmail=useState(""); var sEmail=_sEmail[0]; var setSEmail=_sEmail[1];
  var _sAddr=useState(""); var sAddr=_sAddr[0]; var setSAddr=_sAddr[1];
  var _sNotes=useState(""); var sNotes=_sNotes[0]; var setSNotes=_sNotes[1];

  // Modal nueva compra
  var _mp=useState(false); var showPurchModal=_mp[0]; var setShowPurchModal=_mp[1];
  var _pSup=useState(""); var pSup=_pSup[0]; var setPSup=_pSup[1];
  var _pSupId=useState(""); var pSupId=_pSupId[0]; var setPSupId=_pSupId[1];
  var _pNotes=useState(""); var pNotes=_pNotes[0]; var setPNotes=_pNotes[1];
  var _pItems=useState([]); var pItems=_pItems[0]; var setPItems=_pItems[1];
  var _saving=useState(false); var saving=_saving[0]; var setSaving=_saving[1];

  // Búsqueda de producto en la compra
  var _prodQ=useState(""); var prodQ=_prodQ[0]; var setProdQ=_prodQ[1];
  var _prodRes=useState([]); var prodRes=_prodRes[0]; var setProdRes=_prodRes[1];

  useEffect(function(){
    Promise.all([
      suppliersAPI.getAll().catch(function(){return [];}),
      suppliersAPI.getPurchases().catch(function(){return [];}),
    ]).then(function(res){
      setSuppliers(res[0]||[]);
      setPurchases(res[1]||[]);
      setLoading(false);
    });
  },[]);

  useEffect(function(){
    if(!prodQ.trim()){setProdRes([]); return;}
    var q=prodQ.toLowerCase();
    setProdRes(products.filter(function(p){
      return p.unit!=="serv"&&((p.name||"").toLowerCase().includes(q)||(p.code||"").toLowerCase().includes(q));
    }).slice(0,6));
  },[prodQ,products]);

  function openNewSup(){
    setEditSup(null); setSName(""); setSPhone(""); setSEmail(""); setSAddr(""); setSNotes("");
    setShowSupModal(true);
  }
  function openEditSup(s){
    setEditSup(s); setSName(s.name||""); setSPhone(s.phone||""); setSEmail(s.email||"");
    setSAddr(s.address||""); setSNotes(s.notes||"");
    setShowSupModal(true);
  }
  function saveSup(){
    if(!sName.trim()) return alert("Nombre requerido");
    setSaving(true);
    var data={name:sName.trim(),phone:sPhone.trim(),email:sEmail.trim(),address:sAddr.trim(),notes:sNotes.trim()};
    var prom=editSup?suppliersAPI.update(editSup.id,data):suppliersAPI.create(data);
    prom.then(function(s){
      if(editSup){
        setSuppliers(function(prev){return prev.map(function(x){return x.id===s.id?s:x;});});
      } else {
        setSuppliers(function(prev){return [s].concat(prev);});
      }
      showFlash("✓ Proveedor guardado","ok");
      setShowSupModal(false); setSaving(false);
    }).catch(function(){setSaving(false); alert("Error al guardar");});
  }
  function deactivateSup(id){
    if(!window.confirm("¿Archivar este proveedor?")) return;
    suppliersAPI.update(id,{active:false}).then(function(){
      setSuppliers(function(prev){return prev.filter(function(s){return s.id!==id;});});
      showFlash("Proveedor archivado","ok");
    });
  }

  function openNewPurch(){
    setPSup(""); setPSupId(""); setPNotes(""); setPItems([]); setProdQ(""); setProdRes([]);
    setShowPurchModal(true);
  }
  function addProductToOrder(prod){
    setPItems(function(prev){
      var exists=prev.find(function(x){return x.productId===prod.id;});
      if(exists) return prev.map(function(x){return x.productId===prod.id?Object.assign({},x,{qty:x.qty+1,subtotal:(x.qty+1)*x.cost}):x;});
      return prev.concat([{productId:prod.id,productName:prod.name,productCode:prod.code,qty:1,cost:Number(prod.cost||0),subtotal:Number(prod.cost||0),updateCost:false}]);
    });
    setProdQ(""); setProdRes([]);
  }
  function updateItem(idx,field,val){
    setPItems(function(prev){
      var arr=prev.slice();
      arr[idx]=Object.assign({},arr[idx]);
      arr[idx][field]=field==="updateCost"?val:Number(val)||0;
      if(field==="qty"||field==="cost") arr[idx].subtotal=arr[idx].qty*arr[idx].cost;
      return arr;
    });
  }
  function removeItem(idx){ setPItems(function(prev){return prev.filter(function(_,i){return i!==idx;});}); }

  function savePurchase(){
    if(!pSup.trim()) return alert("Seleccione un proveedor");
    if(!pItems.length) return alert("Agregue al menos un producto");
    setSaving(true);
    suppliersAPI.createPurchase({supplierId:pSupId||null,supplierName:pSup,items:pItems,notes:pNotes})
      .then(function(p){
        setPurchases(function(prev){return [p].concat(prev);});
        onStockUpdate();
        showFlash("✓ Compra registrada y stock actualizado","ok");
        setShowPurchModal(false); setSaving(false);
      }).catch(function(e){
        setSaving(false);
        alert(e&&e.error?e.error:"Error al registrar compra");
      });
  }

  var pTotal=pItems.reduce(function(s,i){return s+i.subtotal;},0);

  var supPag=usePaginator(suppliers,20);
  var purPag=usePaginator(purchases,20);

  if(loading) return <div style={{padding:40,textAlign:"center",color:"#999"}}>Cargando…</div>;

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <p style={Object.assign({},H1,{margin:0})}>🏭 Proveedores y Compras</p>
        <div style={{display:"flex",gap:8}}>
          {tab==="proveedores"&&<button style={mB("teal")} onClick={openNewSup}>+ Nuevo proveedor</button>}
          {tab==="compras"&&<button style={mB("teal")} onClick={openNewPurch}>+ Registrar compra</button>}
        </div>
      </div>

      <div style={{display:"flex",gap:4,marginBottom:14}}>
        {[["proveedores","🏭 Proveedores ("+suppliers.length+")"],["compras","📦 Historial de compras ("+purchases.length+")"]].map(function(t){
          return <button key={t[0]} style={Object.assign({},mB(tab===t[0]?"teal":"gray"),{padding:"6px 14px",fontSize:13})} onClick={function(){setTab(t[0]);}}>{t[1]}</button>;
        })}
      </div>

      {/* Tab proveedores */}
      {tab==="proveedores"&&(
        <div style={sC}>
          {suppliers.length===0
            ?<div style={{textAlign:"center",padding:48,color:"#999"}}>
              <p style={{fontSize:32,marginBottom:8}}>🏭</p>
              <p style={{fontSize:15,marginBottom:4}}>Sin proveedores registrados</p>
              <p style={{fontSize:13}}>Agrega tu primer proveedor para registrar compras y actualizar stock</p>
            </div>
            :<table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["#","Proveedor","Teléfono","Correo","Dirección","Notas",""].map(function(h){return <th key={h} style={h==="#"?Object.assign({},sTH,{width:40,textAlign:"center"}):sTH}>{h}</th>;})}</tr></thead>
              <tbody>
              {supPag.paged.map(function(s,index){
                return (
                  <tr key={s.id}>
                    <td style={{...sTD,textAlign:"center",color:"#999",fontSize:12}}>{supPag.offset+index+1}</td>
                    <td style={Object.assign({},sTD,{fontWeight:600})}>{s.name}</td>
                    <td style={sTD}>{s.phone||"—"}</td>
                    <td style={sTD}>{s.email||"—"}</td>
                    <td style={sTD}>{s.address||"—"}</td>
                    <td style={Object.assign({},sTD,{color:"#666",fontSize:12})}>{s.notes||"—"}</td>
                    <td style={sTD}>
                      <div style={{display:"flex",gap:4}}>
                        <button style={Object.assign({},mB("gray"),{padding:"2px 8px",fontSize:12})} onClick={function(){openEditSup(s);}}>✏️</button>
                        <button style={Object.assign({},mB("red"),{padding:"2px 8px",fontSize:12})} onClick={function(){deactivateSup(s.id);}}>✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>}
          <supPag.Pager/>
        </div>
      )}

      {/* Tab historial compras */}
      {tab==="compras"&&(
        <div style={sC}>
          {purchases.length===0
            ?<div style={{textAlign:"center",padding:48,color:"#999"}}>
              <p style={{fontSize:32,marginBottom:8}}>📦</p>
              <p style={{fontSize:15}}>Sin compras registradas aún</p>
            </div>
            :<table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["#","Fecha","Proveedor","Artículos","Total","Registrado por"].map(function(h){return <th key={h} style={h==="#"?Object.assign({},sTH,{width:40,textAlign:"center"}):sTH}>{h}</th>;})}</tr></thead>
              <tbody>
              {purPag.paged.map(function(p,index){
                var items=p.purchase_items||[];
                return (
                  <tr key={p.id}>
                    <td style={{...sTD,textAlign:"center",color:"#999",fontSize:12}}>{purPag.offset+index+1}</td>
                    <td style={sTD}>{fmtD(p.created_at)} {fmtT(p.created_at)}</td>
                    <td style={Object.assign({},sTD,{fontWeight:600})}>{p.supplier_name}</td>
                    <td style={sTD}>
                      <div style={{fontSize:12}}>
                        {items.slice(0,3).map(function(it,i){return <div key={i}>{it.product_name} ×{it.qty}</div>;})}
                        {items.length>3&&<div style={{color:"#999"}}>+{items.length-3} más…</div>}
                      </div>
                    </td>
                    <td style={Object.assign({},sTD,{fontWeight:700,color:TEAL})}>Q {Number(p.total).toFixed(2)}</td>
                    <td style={sTD}>{p.registered_by}</td>
                  </tr>
                );
              })}
              </tbody>
            </table>}
          <purPag.Pager/>
        </div>
      )}

      {/* Modal proveedor */}
      {showSupModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
          <div style={{background:"#fff",borderRadius:14,padding:28,width:"100%",maxWidth:460}}>
            <p style={{fontWeight:700,fontSize:18,margin:"0 0 18px",color:NAVY}}>{editSup?"Editar proveedor":"Nuevo proveedor"}</p>
            {[["Nombre *",sName,setSName,"Ej: Distribuidora XYZ"],["Teléfono",sPhone,setSPhone,"Ej: 5555-0000"],["Correo",sEmail,setSEmail,"Ej: ventas@proveedor.com"],["Dirección",sAddr,setSAddr,"Ej: Zona 4, Guatemala"],["Notas",sNotes,setSNotes,"Observaciones…"]].map(function(f){
              return (
                <div key={f[0]} style={{marginBottom:12}}>
                  <label style={{display:"block",fontWeight:600,fontSize:13,marginBottom:4}}>{f[0]}</label>
                  <input style={sI} value={f[1]} placeholder={f[3]} onChange={function(e){f[2](e.target.value);}}/>
                </div>
              );
            })}
            <div style={{display:"flex",gap:10,marginTop:18}}>
              <button style={Object.assign({},mB("gray"),{flex:1})} onClick={function(){setShowSupModal(false);}}>Cancelar</button>
              <button style={Object.assign({},mB("teal"),{flex:1})} onClick={saveSup} disabled={saving}>{saving?"Guardando…":"Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nueva compra */}
      {showPurchModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"flex-start",justifyContent:"center",zIndex:1000,padding:16,overflowY:"auto"}}>
          <div style={{background:"#fff",borderRadius:14,padding:28,width:"100%",maxWidth:600,margin:"20px auto"}}>
            <p style={{fontWeight:700,fontSize:18,margin:"0 0 18px",color:NAVY}}>📦 Registrar Compra</p>

            <label style={{display:"block",fontWeight:600,fontSize:13,marginBottom:5}}>Proveedor *</label>
            <select style={sI} value={pSupId} onChange={function(e){
              var id=e.target.value;
              var sup=suppliers.find(function(s){return s.id===id;});
              setPSupId(id); setPSup(sup?sup.name:"");
            }}>
              <option value="">— Seleccionar proveedor —</option>
              {suppliers.map(function(s){return <option key={s.id} value={s.id}>{s.name}</option>;})}
              <option value="__otro__">Otro (escribir manualmente)</option>
            </select>
            {pSupId==="__otro__"&&(
              <input style={Object.assign({},sI,{marginTop:6})} placeholder="Nombre del proveedor" value={pSup} onChange={function(e){setPSup(e.target.value);}}/>
            )}

            <label style={{display:"block",fontWeight:600,fontSize:13,margin:"14px 0 5px"}}>Buscar producto para agregar</label>
            <div style={{position:"relative"}}>
              <input style={sI} value={prodQ} placeholder="Buscar por nombre o código…" onChange={function(e){setProdQ(e.target.value);}}/>
              {prodRes.length>0&&(
                <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:"1px solid #ddd",borderRadius:8,zIndex:10,boxShadow:"0 4px 16px rgba(0,0,0,0.12)",marginTop:2}}>
                  {prodRes.map(function(p){
                    return <div key={p.id} style={{padding:"10px 14px",cursor:"pointer",borderBottom:"1px solid #f0f0f0",display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13}} onClick={function(){addProductToOrder(p);}}>
                      <span><b>{p.code}</b> — {p.name}</span>
                      <span style={{color:TEAL,fontWeight:600}}>Stock: {p.stock}</span>
                    </div>;
                  })}
                </div>
              )}
            </div>

            {pItems.length>0&&(
              <div style={{marginTop:14}}>
                <p style={{fontWeight:600,fontSize:13,margin:"0 0 8px"}}>Artículos de la compra</p>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                  <thead><tr>{["Producto","Cant.","Costo unit.","Subtotal","Act. costo",""].map(function(h){return <th key={h} style={Object.assign({},sTH,{fontSize:11})}>{h}</th>;})}</tr></thead>
                  <tbody>
                  {pItems.map(function(it,i){
                    return (
                      <tr key={i}>
                        <td style={sTD}><div style={{fontWeight:500}}>{it.productName}</div><div style={{fontSize:11,color:"#999"}}>{it.productCode}</div></td>
                        <td style={sTD}><input type="number" min="1" style={{width:56,padding:"4px 6px",border:"1px solid #ddd",borderRadius:6,fontSize:13}} value={it.qty} onChange={function(e){updateItem(i,"qty",e.target.value);}}/></td>
                        <td style={sTD}><input type="number" min="0" step="0.01" style={{width:76,padding:"4px 6px",border:"1px solid #ddd",borderRadius:6,fontSize:13}} value={it.cost} onChange={function(e){updateItem(i,"cost",e.target.value);}}/></td>
                        <td style={Object.assign({},sTD,{fontWeight:700,color:TEAL})}>Q {it.subtotal.toFixed(2)}</td>
                        <td style={Object.assign({},sTD,{textAlign:"center"})}>
                          <input type="checkbox" checked={!!it.updateCost} onChange={function(e){updateItem(i,"updateCost",e.target.checked);}} title="Actualizar costo del producto"/>
                        </td>
                        <td style={sTD}><button style={Object.assign({},mB("red"),{padding:"2px 6px",fontSize:12})} onClick={function(){removeItem(i);}}>✕</button></td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
                <div style={{textAlign:"right",marginTop:10,fontWeight:700,fontSize:15}}>Total: <span style={{color:TEAL}}>Q {pTotal.toFixed(2)}</span></div>
                <p style={{fontSize:11,color:"#999",marginTop:4}}>☑ "Act. costo" actualiza el costo del producto en inventario</p>
              </div>
            )}

            <label style={{display:"block",fontWeight:600,fontSize:13,margin:"14px 0 5px"}}>Notas (opcional)</label>
            <input style={sI} placeholder="Ej: factura #1234, pago en efectivo…" value={pNotes} onChange={function(e){setPNotes(e.target.value);}}/>

            <div style={{display:"flex",gap:10,marginTop:20}}>
              <button style={Object.assign({},mB("gray"),{flex:1})} onClick={function(){setShowPurchModal(false);}}>Cancelar</button>
              <button style={Object.assign({},mB("teal"),{flex:1})} onClick={savePurchase} disabled={saving||!pItems.length}>
                {saving?"Guardando…":"✓ Confirmar compra"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Configuración de tienda ── */
function StoreConfigScreen(props){
  var storeInfo=props.storeInfo||{}; var setStoreInfo=props.setStoreInfo||function(){};
  var session=props.session||{}; var showFlash=props.showFlash||function(){};

  var _form=useState(Object.assign({store_name:"",store_tagline:"",store_phone:"",store_address:"",store_email:"",store_logo_url:""},storeInfo));
  var form=_form[0]; var setForm=_form[1];
  var _saving=useState(false); var saving=_saving[0]; var setSaving=_saving[1];
  var _logoLoading=useState(false); var logoLoading=_logoLoading[0]; var setLogoLoading=_logoLoading[1];

  function handleChange(k,v){ setForm(function(prev){var n=Object.assign({},prev); n[k]=v; return n;}); }

  function handleLogoFile(e){
    var file=e.target.files&&e.target.files[0];
    if(!file) return;
    if(!file.type.startsWith("image/")){ showFlash("Solo se aceptan imágenes (JPG, PNG, WebP)","err"); return; }
    setLogoLoading(true);
    var reader=new FileReader();
    reader.onload=function(ev){
      var img=new Image();
      img.onload=function(){
        var MAX=300;
        var w=img.width; var h=img.height;
        if(w>MAX||h>MAX){ var r=Math.min(MAX/w,MAX/h); w=Math.round(w*r); h=Math.round(h*r); }
        var canvas=document.createElement("canvas"); canvas.width=w; canvas.height=h;
        var ctx=canvas.getContext("2d"); ctx.drawImage(img,0,0,w,h);
        var dataUrl=canvas.toDataURL("image/jpeg",0.82);
        handleChange("store_logo_url",dataUrl);
        setLogoLoading(false);
      };
      img.onerror=function(){ showFlash("No se pudo leer la imagen","err"); setLogoLoading(false); };
      img.src=ev.target.result;
    };
    reader.onerror=function(){ showFlash("Error al leer el archivo","err"); setLogoLoading(false); };
    reader.readAsDataURL(file);
    e.target.value="";
  }

  function handleSave(){
    setSaving(true);
    settingsAPI.update(form).then(function(){
      setStoreInfo(function(prev){return Object.assign({},prev,form);});
      setStore(form);
      showFlash("✓ Configuración guardada","ok");
      setSaving(false);
    }).catch(function(){
      showFlash("Error al guardar","error");
      setSaving(false);
    });
  }

  var fields=[
    {key:"store_name",    label:"Nombre del negocio *",   placeholder:"Ej: Tecnología García"},
    {key:"store_tagline", label:"Eslogan / descripción",   placeholder:"Ej: Tecnología · Accesorios · Reparaciones"},
    {key:"store_phone",   label:"Teléfono",                placeholder:"Ej: 5555-1234"},
    {key:"store_address", label:"Dirección",               placeholder:"Ej: Zona 1, Guatemala"},
    {key:"store_email",   label:"Correo electrónico",      placeholder:"Ej: info@mitienda.com"},
  ];

  return (
    <div>
      <p style={H1}>⚙️ Mi Tienda — Configuración</p>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        {/* Formulario */}
        <div style={sC}>
          <p style={{fontWeight:600,fontSize:15,margin:"0 0 18px"}}>Información del negocio</p>
          {fields.map(function(f){
            return (
              <div key={f.key} style={{marginBottom:14}}>
                <label style={{display:"block",fontWeight:600,fontSize:13,marginBottom:5}}>{f.label}</label>
                <input style={sI} value={form[f.key]||""} placeholder={f.placeholder} onChange={function(e){handleChange(f.key,e.target.value);}}/>
              </div>
            );
          })}

          {/* Logo uploader */}
          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontWeight:600,fontSize:13,marginBottom:8}}>Logo del negocio</label>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              {form.store_logo_url
                ?<img src={form.store_logo_url} alt="logo" style={{width:60,height:60,borderRadius:8,objectFit:"cover",border:"2px solid "+TEAL}}/>
                :<div style={{width:60,height:60,borderRadius:8,background:"#f0f0f0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,color:"#bbb",border:"2px dashed #ccc"}}>🖼️</div>
              }
              <div style={{flex:1}}>
                <label style={{display:"inline-block",cursor:"pointer",background:TEAL,color:"#fff",padding:"7px 14px",borderRadius:6,fontSize:13,fontWeight:600}}>
                  {logoLoading?"Procesando…":"📁 Subir imagen"}
                  <input type="file" accept="image/*" style={{display:"none"}} onChange={handleLogoFile} disabled={logoLoading}/>
                </label>
                {form.store_logo_url&&(
                  <button style={{marginLeft:8,background:"none",border:"1px solid #e74c3c",color:"#e74c3c",borderRadius:6,padding:"6px 12px",cursor:"pointer",fontSize:12}} onClick={function(){handleChange("store_logo_url","");}}>Quitar</button>
                )}
                <p style={{fontSize:11,color:"#888",margin:"6px 0 0"}}>JPG, PNG o WebP · Máx. 500 KB · Se redimensiona automáticamente</p>
              </div>
            </div>
          </div>

          <button style={Object.assign({},mB("teal"),{width:"100%",marginTop:6})} onClick={handleSave} disabled={saving||logoLoading}>
            {saving?"Guardando…":"💾 Guardar cambios"}
          </button>
        </div>

        {/* Vista previa */}
        <div>
          <div style={sC}>
            <p style={{fontWeight:600,fontSize:15,margin:"0 0 14px"}}>Vista previa — Encabezado de recibo</p>
            <div style={{border:"1px solid #eee",borderRadius:8,padding:16,background:"#fafafa"}}>
              <div style={{borderBottom:"3px solid "+TEAL,paddingBottom:12,marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  {form.store_logo_url
                    ?<img src={form.store_logo_url} alt="logo" style={{width:40,height:40,borderRadius:8,objectFit:"cover"}}/>
                    :<div style={{width:40,height:40,borderRadius:8,background:NAVY,display:"flex",alignItems:"center",justifyContent:"center",color:TEAL,fontWeight:900,fontSize:14}}>{APP_NAME.slice(0,2).toUpperCase()}</div>
                  }
                  <div>
                    <div style={{fontWeight:900,fontSize:16,color:NAVY}}>{form.store_name||"Nombre del negocio"}</div>
                    <div style={{fontSize:10,color:TEAL,fontWeight:700,letterSpacing:1,marginTop:2}}>{form.store_tagline||"Eslogan aquí"}</div>
                    {form.store_phone&&<div style={{fontSize:10,color:"#999",marginTop:1}}>📞 {form.store_phone}</div>}
                    {form.store_address&&<div style={{fontSize:10,color:"#999"}}>📍 {form.store_address}</div>}
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:10,color:"#999"}}>Comprobante de Venta</div>
                  <div style={{fontSize:16,fontWeight:900,color:TEAL}}># XXXXXXXX</div>
                </div>
              </div>
              <div style={{fontSize:11,color:"#999",textAlign:"center"}}>… detalle de la venta …</div>
              <div style={{borderTop:"2px dashed #ccc",paddingTop:10,marginTop:10,fontSize:10,color:"#999",display:"flex",justifyContent:"space-between"}}>
                <span>Generado por {form.store_name||"Sistema POS"}</span>
                <span>{new Date().toLocaleDateString("es-GT")}</span>
              </div>
            </div>
          </div>

          <div style={Object.assign({},sC,{marginTop:14,background:"#f0f9f5",borderLeft:"4px solid "+TEAL})}>
            <p style={{fontWeight:600,fontSize:13,margin:"0 0 8px",color:TEAL}}>ℹ️ ¿Dónde aparece esta información?</p>
            <div style={{fontSize:13,color:"#555",lineHeight:1.8}}>
              <p style={{margin:"0 0 3px"}}>✅ Encabezado de <b>recibos de venta</b></p>
              <p style={{margin:"0 0 3px"}}>✅ PDF de <b>cierre de caja</b></p>
              <p style={{margin:"0 0 3px"}}>✅ <b>Órdenes de trabajo</b> de reparaciones</p>
              <p style={{margin:"0 0 3px"}}>✅ <b>Cuadres</b> e informes</p>
              <p style={{margin:0}}>✅ Mensajes de <b>WhatsApp</b></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   SUPER ADMIN PANEL
   ══════════════════════════════════════════════════════════════════════ */
function SuperAdminPanel(props){
  var session=props.session||{};
  var theme=props.theme||"light";
  var isDark=theme==="dark";
  var _tenants=useState([]); var tenants=_tenants[0]; var setTenants=_tenants[1];
  var _stats=useState(null); var stats=_stats[0]; var setStats=_stats[1];
  var _loading=useState(true); var loading=_loading[0]; var setLoading=_loading[1];
  var _tab=useState("tenants"); var tab=_tab[0]; var setTab=_tab[1];
  var _saving=useState(false); var saving=_saving[0]; var setSaving=_saving[1];
  var _flash=useState(null); var flash=_flash[0]; var setFlash=_flash[1];
  // Renewal state: { [tenantId]: months }
  var _renew=useState({}); var renewMonths=_renew[0]; var setRenewMonths=_renew[1];
  var _renewSaving=useState({}); var renewSaving=_renewSaving[0]; var setRenewSaving=_renewSaving[1];

  // Users modal
  var _umodal=useState(null); var usersModal=_umodal[0]; var setUsersModal=_umodal[1]; // { tenant, users }
  var _uload=useState(false); var usersLoading=_uload[0]; var setUsersLoading=_uload[1];
  var _rpw=useState({}); var resetPwMap=_rpw[0]; var setResetPwMap=_rpw[1]; // { [userId]: newPw }
  var _rsaving=useState({}); var resetSaving=_rsaving[0]; var setResetSaving=_rsaving[1];

  // Edit tenant modal
  var _emod=useState(null); var editModal=_emod[0]; var setEditModal=_emod[1]; // tenant object
  var _esav=useState(false); var editSaving=_esav[0]; var setEditSaving=_esav[1];
  // Delete tenant confirm
  var _dconf=useState(null); var deleteConfirm=_dconf[0]; var setDeleteConfirm=_dconf[1]; // tenant object
  var _dsav=useState(false); var deleteSaving=_dsav[0]; var setDeleteSaving=_dsav[1];
  // New user form (inside users modal)
  var _nuf=useState(null); var newUserForm=_nuf[0]; var setNewUserForm=_nuf[1]; // {name,email,password,role} or null
  var _nusav=useState(false); var newUserSaving=_nusav[0]; var setNewUserSaving=_nusav[1];
  // Delete user confirm
  var _duconf=useState(null); var deleteUserConfirm=_duconf[0]; var setDeleteUserConfirm=_duconf[1]; // user object
  var _dusav=useState(false); var deleteUserSaving=_dusav[0]; var setDeleteUserSaving=_dusav[1];

  // Mi cuenta tab
  var _mcn=useState(""); var mcName=_mcn[0]; var setMcName=_mcn[1];
  var _mce=useState(""); var mcEmail=_mce[0]; var setMcEmail=_mce[1];
  var _mcc=useState(""); var mcCurrent=_mcc[0]; var setMcCurrent=_mcc[1];
  var _mcnp=useState(""); var mcNew=_mcnp[0]; var setMcNew=_mcnp[1];
  var _mcsav=useState(false); var mcSaving=_mcsav[0]; var setMcSaving=_mcsav[1];

  // Form nuevo tenant
  var _fn=useState(""); var fName=_fn[0]; var setFName=_fn[1];
  var _fp=useState("basic"); var fPlan=_fp[0]; var setFPlan=_fp[1];
  var _fe=useState(""); var fEmail=_fe[0]; var setFEmail=_fe[1];
  var _fph=useState(""); var fPhone=_fph[0]; var setFPhone=_fph[1];
  var _fo=useState(""); var fOwner=_fo[0]; var setFOwner=_fo[1];
  var _fae=useState(""); var fAdminEmail=_fae[0]; var setFAdminEmail=_fae[1];
  var _fap=useState(""); var fAdminPass=_fap[0]; var setFAdminPass=_fap[1];
  var _fm=useState("1"); var fMonths=_fm[0]; var setFMonths=_fm[1];
  var _fsk=useState(true); var fSkipWizard=_fsk[0]; var setFSkipWizard=_fsk[1];

  function showMsg(msg,type){ setFlash({msg,type}); setTimeout(function(){setFlash(null);},3500); }

  function reload(){
    setLoading(true);
    Promise.all([adminAPI.getTenants(), adminAPI.getStats()])
      .then(function(res){ setTenants(res[0]||[]); setStats(res[1]); })
      .catch(function(){ showMsg("Error cargando datos","error"); })
      .finally(function(){ setLoading(false); });
  }
  useEffect(function(){ reload(); },[]);

  async function openUsers(t){
    setUsersModal({ tenant:t, users:[] });
    setUsersLoading(true);
    try {
      var users = await adminAPI.getTenantUsers(t.id);
      setUsersModal({ tenant:t, users });
    } catch(e){ showMsg("Error cargando usuarios","error"); setUsersModal(null); }
    setUsersLoading(false);
  }

  async function doResetPw(user){
    var pw = resetPwMap[user.id];
    if(!pw||pw.length<6){ showMsg("Escribe una contraseña de al menos 6 caracteres","error"); return; }
    setResetSaving(function(prev){ return Object.assign({},prev,{[user.id]:true}); });
    try {
      await adminAPI.resetUserPassword(user.id, { newPassword: pw });
      setResetPwMap(function(prev){ var n=Object.assign({},prev); delete n[user.id]; return n; });
      showMsg("Contraseña actualizada para "+user.name,"ok");
    } catch(e){ showMsg(e.error||"Error al resetear contraseña","error"); }
    setResetSaving(function(prev){ return Object.assign({},prev,{[user.id]:false}); });
  }

  async function doToggleUser(user){
    try {
      var updated = await adminAPI.toggleUser(user.id);
      setUsersModal(function(prev){
        if(!prev) return prev;
        return Object.assign({},prev,{ users: prev.users.map(function(u){ return u.id===updated.id?Object.assign({},u,{active:updated.active}):u; }) });
      });
      showMsg(updated.name+" "+(updated.active?"activado":"desactivado"),"ok");
    } catch(e){ showMsg("Error","error"); }
  }

  async function saveMyAccount(){
    if(!mcCurrent){ showMsg("Ingresa tu contraseña actual","error"); return; }
    setMcSaving(true);
    try {
      await adminAPI.updateMe({ name:mcName||undefined, email:mcEmail||undefined, currentPassword:mcCurrent, newPassword:mcNew||undefined });
      showMsg("Datos actualizados correctamente","ok");
      setMcCurrent(""); setMcNew("");
    } catch(e){ showMsg(e.error||"Error al actualizar","error"); }
    setMcSaving(false);
  }

  async function createTenant(){
    if(!fName||!fAdminEmail||!fAdminPass){ showMsg("Nombre, email admin y contraseña son requeridos","error"); return; }
    setSaving(true);
    try {
      var res = await adminAPI.createTenant({ name:fName, plan:fPlan, email:fEmail, phone:fPhone, ownerName:fOwner, adminEmail:fAdminEmail, adminPassword:fAdminPass, months:Number(fMonths), skipWizard:fSkipWizard });
      setTenants(function(prev){ return [res.tenant].concat(prev); });
      showMsg("Negocio creado exitosamente","ok");
      setTab("tenants");
      setFName(""); setFPlan("basic"); setFEmail(""); setFPhone(""); setFOwner(""); setFAdminEmail(""); setFAdminPass(""); setFMonths("1"); setFSkipWizard(true);
    } catch(e){ showMsg(e.error||"Error al crear negocio","error"); }
    setSaving(false);
  }

  async function toggleActive(t){
    try {
      var updated = await adminAPI.updateTenant(t.id, { active: !t.active });
      setTenants(function(prev){ return prev.map(function(x){ return x.id===t.id?updated:x; }); });
      showMsg("Negocio "+(updated.active?"activado":"desactivado"),"ok");
    } catch(e){ showMsg("Error actualizando negocio","error"); }
  }

  async function renewTenant(t){
    var m = Number(renewMonths[t.id]||1);
    setRenewSaving(function(prev){ return Object.assign({},prev,{[t.id]:true}); });
    try {
      var updated = await adminAPI.updateTenant(t.id, { months: m });
      setTenants(function(prev){ return prev.map(function(x){ return x.id===t.id?updated:x; }); });
      showMsg("Suscripción renovada por "+m+" mes(es)","ok");
    } catch(e){ showMsg("Error renovando suscripción","error"); }
    setRenewSaving(function(prev){ return Object.assign({},prev,{[t.id]:false}); });
  }

  async function saveEditTenant(){
    if(!editModal) return;
    setEditSaving(true);
    try {
      var updated = await adminAPI.updateTenant(editModal.id, {
        name: editModal.name, plan: editModal.plan, email: editModal.email||null,
        phone: editModal.phone||null, ownerName: editModal.owner_name||null, notes: editModal.notes||null
      });
      setTenants(function(prev){ return prev.map(function(x){ return x.id===updated.id?Object.assign({},x,updated):x; }); });
      showMsg("Negocio actualizado","ok");
      setEditModal(null);
    } catch(e){ showMsg(e.error||"Error actualizando negocio","error"); }
    setEditSaving(false);
  }

  async function doDeleteTenant(){
    if(!deleteConfirm) return;
    setDeleteSaving(true);
    try {
      await adminAPI.deleteTenant(deleteConfirm.id);
      setTenants(function(prev){ return prev.filter(function(x){ return x.id!==deleteConfirm.id; }); });
      showMsg("Negocio eliminado permanentemente","ok");
      setDeleteConfirm(null);
    } catch(e){ showMsg(e.error||"Error eliminando negocio","error"); }
    setDeleteSaving(false);
  }

  async function doCreateUser(){
    if(!newUserForm||!usersModal) return;
    if(!newUserForm.name||!newUserForm.email||!newUserForm.password){ showMsg("Todos los campos son requeridos","error"); return; }
    setNewUserSaving(true);
    try {
      var created = await adminAPI.createTenantUser(usersModal.tenant.id, newUserForm);
      setUsersModal(function(prev){ return prev?Object.assign({},prev,{users:[created].concat(prev.users)}):prev; });
      setNewUserForm(null);
      showMsg("Usuario creado: "+created.name,"ok");
    } catch(e){ showMsg(e.error||"Error creando usuario","error"); }
    setNewUserSaving(false);
  }

  async function doDeleteUser(){
    if(!deleteUserConfirm||!usersModal) return;
    setDeleteUserSaving(true);
    try {
      await adminAPI.deleteUser(deleteUserConfirm.id);
      setUsersModal(function(prev){ return prev?Object.assign({},prev,{users:prev.users.filter(function(u){ return u.id!==deleteUserConfirm.id; })}):prev; });
      showMsg("Usuario eliminado","ok");
      setDeleteUserConfirm(null);
    } catch(e){ showMsg(e.error||"Error eliminando usuario","error"); }
    setDeleteUserSaving(false);
  }

  function expiryBadge(expires_at){
    if(!expires_at) return <span style={Object.assign({},mBg("#aaa"),{fontSize:10})}>Sin fecha</span>;
    var days = Math.ceil((new Date(expires_at)-new Date())/86400000);
    if(days<0) return <span style={Object.assign({},mBg("#E24B4A"),{fontSize:10})}>Vencido</span>;
    if(days<=7) return <span style={Object.assign({},mBg("#F39C12"),{fontSize:10})}>⚠ {days}d</span>;
    if(days<=30) return <span style={Object.assign({},mBg("#F39C12"),{fontSize:10,background:"#f5a623"})}>{days}d</span>;
    return <span style={Object.assign({},mBg(TEAL),{fontSize:10})}>{days}d</span>;
  }

  var PLANS = { basic:"Básico", professional:"Profesional", enterprise:"Empresarial" };
  var PLAN_COLOR = { basic:"#888", professional:TEAL, enterprise:"#9B59B6" };

  // Estilos adaptados al tema
  var saCard={background:"var(--bg-card,#fff)",borderRadius:12,boxShadow:"0 2px 10px var(--shadow,rgba(0,0,0,0.05))",border:"1px solid var(--border-card,rgba(0,0,0,0.09))"};
  var saTH={padding:"10px 12px",textAlign:"left",fontSize:11,fontWeight:700,color:"var(--text-secondary,#666)",textTransform:"uppercase",borderBottom:"2px solid var(--border-table,rgba(0,0,0,0.08))",background:"var(--bg-table-head,#f5f4f0)",whiteSpace:"nowrap"};
  var saTD={padding:"12px",fontSize:13,verticalAlign:"middle",color:"var(--text-primary,#1a1a1a)",borderBottom:"1px solid var(--border-row,rgba(0,0,0,0.05))"};
  var saInput={width:"100%",padding:"10px 12px",borderRadius:8,border:"1px solid var(--border-input,rgba(0,0,0,0.2))",fontSize:14,background:"var(--bg-input,#fff)",color:"var(--text-primary,#1a1a1a)",boxSizing:"border-box",outline:"none"};

  return (
    <div style={{padding:"clamp(16px,3vw,32px)",maxWidth:1200,margin:"0 auto"}}>
      {flash&&<div style={{position:"fixed",top:20,right:20,zIndex:9999,padding:"12px 20px",borderRadius:10,background:flash.type==="ok"?"#1D9E75":"#E24B4A",color:"#fff",fontWeight:700,fontSize:13,boxShadow:"0 4px 20px rgba(0,0,0,0.25)"}}>{flash.msg}</div>}

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div>
          <h1 style={{margin:0,fontSize:22,fontWeight:800,color:NAVY}}>🏢 Panel Super Administrador</h1>
          <p style={{margin:"4px 0 0",fontSize:13,color:"#888"}}>Gestión de negocios clientes de la plataforma</p>
        </div>
        <span style={Object.assign({},mBg("#9B59B6"),{fontSize:12})}>SUPERADMIN: {session.name}</span>
      </div>

      {/* Stats */}
      {stats&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:24}}>
        {[
          {lb:"Total negocios", val:stats.total_tenants, ic:"🏢", c:NAVY},
          {lb:"Negocios activos", val:stats.active_tenants, ic:"✅", c:TEAL},
          {lb:"Vencen pronto (≤7d)", val:stats.expiring_soon||0, ic:"⚠️", c:"#F39C12"},
          {lb:"Vencidos", val:stats.expired||0, ic:"❌", c:"#E24B4A"},
          {lb:"Usuarios activos", val:stats.total_users, ic:"👥", c:NAVY},
          {lb:"Ingresos 30d", val:"Q "+Number(stats.revenue_30d||0).toLocaleString("es-GT",{minimumFractionDigits:2}), ic:"💰", c:TEAL},
        ].map(function(s){ return <div key={s.lb} style={Object.assign({},saCard,{padding:"14px 18px"})}>
          <div style={{fontSize:22,marginBottom:4}}>{s.ic}</div>
          <div style={{fontSize:20,fontWeight:800,color:s.c==="var(--text-primary)"?s.c:s.c}}>{s.val}</div>
          <div style={{fontSize:11,color:"var(--text-muted,#888)",marginTop:2}}>{s.lb}</div>
        </div>; })}
      </div>}

      {/* Tabs */}
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        {[["tenants","🏢 Negocios"],["crear","➕ Nuevo negocio"],["cuenta","👤 Mi cuenta"]].map(function(t){ return <button key={t[0]} onClick={function(){setTab(t[0]);}} style={{padding:"8px 18px",borderRadius:20,border:"none",background:tab===t[0]?TEAL:"var(--bg-alt,#e8e8e8)",color:tab===t[0]?"#fff":"var(--text-primary,#333)",fontWeight:tab===t[0]?700:400,fontSize:13,cursor:"pointer"}}>{t[1]}</button>; })}
      </div>

      {/* Lista de tenants */}
      {tab==="tenants"&&<div>
        {loading?<p style={{color:"var(--text-muted)",textAlign:"center",padding:40}}>Cargando…</p>:
        tenants.length===0?<p style={{color:"var(--text-muted)",textAlign:"center",padding:40}}>Sin negocios registrados</p>:
        <div style={{overflowX:"auto",borderRadius:12,border:"1px solid var(--border-card)",overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr>{["Negocio","Plan","Usuarios","Estado","Vencimiento","Renovar","Acciones"].map(function(h){ return <th key={h} style={saTH}>{h}</th>; })}</tr>
            </thead>
            <tbody>
              {tenants.map(function(t){ return <tr key={t.id} style={{borderBottom:"1px solid var(--border-row)",background:"var(--bg-row)"}}>
                <td style={saTD}>
                  <div style={{fontWeight:700,fontSize:13,color:"var(--text-primary)"}}>{t.name}</div>
                  {t.owner_name&&<div style={{fontSize:11,color:"var(--text-secondary)"}}>{t.owner_name}</div>}
                  {t.email&&<div style={{fontSize:11,color:"var(--text-muted)"}}>{t.email}</div>}
                </td>
                <td style={saTD}><span style={Object.assign({},mBg(PLAN_COLOR[t.plan]||"#888"),{fontSize:11})}>{PLANS[t.plan]||t.plan}</span></td>
                <td style={saTD}><span style={{fontWeight:700,color:"var(--text-primary)"}}>{t.user_count||0}</span></td>
                <td style={saTD}><span style={Object.assign({},mBg(t.active?TEAL:"#ccc"),{fontSize:11})}>{t.active?"Activo":"Inactivo"}</span></td>
                <td style={saTD}>
                  {expiryBadge(t.expires_at)}
                  {t.expires_at&&<div style={{fontSize:10,color:"var(--text-muted)",marginTop:2}}>{new Date(t.expires_at).toLocaleDateString("es-GT")}</div>}
                </td>
                <td style={saTD}>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <select value={renewMonths[t.id]||"1"} onChange={function(e){ var id=t.id; setRenewMonths(function(prev){ return Object.assign({},prev,{[id]:e.target.value}); }); }} style={{padding:"4px 6px",borderRadius:6,border:"1px solid var(--border-input)",fontSize:12,background:"var(--bg-input)",color:"var(--text-primary)"}}>
                      <option value="1">1 mes</option>
                      <option value="3">3 meses</option>
                      <option value="6">6 meses</option>
                      <option value="12">1 año</option>
                    </select>
                    <button onClick={function(){ renewTenant(t); }} disabled={renewSaving[t.id]} style={{padding:"4px 10px",borderRadius:6,border:"none",background:TEAL,color:"#fff",fontSize:12,cursor:"pointer",fontWeight:600,opacity:renewSaving[t.id]?0.6:1}}>
                      {renewSaving[t.id]?"…":"Renovar"}
                    </button>
                  </div>
                </td>
                <td style={saTD}>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    <button onClick={function(){ openUsers(t); }} style={{padding:"5px 12px",borderRadius:6,border:"1px solid "+TEAL,background:"transparent",fontSize:12,cursor:"pointer",color:TEAL,fontWeight:600}}>
                      👥 Usuarios
                    </button>
                    <button onClick={function(){ toggleActive(t); }} style={{padding:"5px 12px",borderRadius:6,border:"1px solid var(--border-card)",background:"transparent",fontSize:12,cursor:"pointer",color:t.active?"#E24B4A":TEAL,fontWeight:600}}>
                      {t.active?"Desactivar":"Activar"}
                    </button>
                    <button onClick={function(){ setEditModal(Object.assign({},t)); }} style={{padding:"5px 12px",borderRadius:6,border:"1px solid #378ADD",background:"transparent",fontSize:12,cursor:"pointer",color:"#378ADD",fontWeight:600}}>✏️ Editar</button>
                    {t.phone&&<a href={"https://wa.me/502"+t.phone.replace(/\D/g,"")} target="_blank" rel="noopener noreferrer" style={{padding:"5px 10px",borderRadius:6,border:"1px solid #25D366",background:"transparent",fontSize:12,cursor:"pointer",color:"#25D366",fontWeight:600,textDecoration:"none"}}>📱</a>}
                    <button onClick={function(){ setDeleteConfirm(t); }} style={{padding:"5px 12px",borderRadius:6,border:"1px solid #E24B4A",background:"transparent",fontSize:12,cursor:"pointer",color:"#E24B4A",fontWeight:600}}>🗑️</button>
                  </div>
                </td>
              </tr>; })}
            </tbody>
          </table>
        </div>}
      </div>}

      {/* Mi cuenta */}
      {tab==="cuenta"&&<div style={Object.assign({},saCard,{maxWidth:480,padding:28})}>
        <h3 style={{margin:"0 0 6px",fontSize:16,fontWeight:700,color:"var(--text-primary)"}}>👤 Mi cuenta — SuperAdmin</h3>
        <p style={{margin:"0 0 20px",fontSize:12,color:"var(--text-muted)"}}>Actualiza tu nombre, email o contraseña. Siempre se requiere la contraseña actual.</p>
        <label style={{display:"block",fontSize:12,fontWeight:600,color:"var(--text-secondary)",marginBottom:4}}>Nombre</label>
        <input value={mcName} onChange={function(e){setMcName(e.target.value);}} style={Object.assign({},saInput,{marginBottom:12})} placeholder={session.name||"Tu nombre"}/>
        <label style={{display:"block",fontSize:12,fontWeight:600,color:"var(--text-secondary)",marginBottom:4}}>Email</label>
        <input type="email" value={mcEmail} onChange={function(e){setMcEmail(e.target.value);}} style={Object.assign({},saInput,{marginBottom:16})} placeholder={session.email||"tu@email.com"}/>
        <div style={{background:"var(--bg-alt)",borderRadius:10,padding:"14px 16px",marginBottom:16}}>
          <p style={{margin:"0 0 10px",fontSize:12,fontWeight:700,color:TEAL}}>🔒 Cambiar contraseña</p>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:"var(--text-secondary)",marginBottom:4}}>Contraseña actual *</label>
          <input type="password" value={mcCurrent} onChange={function(e){setMcCurrent(e.target.value);}} style={Object.assign({},saInput,{marginBottom:10})} placeholder="Tu contraseña actual"/>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:"var(--text-secondary)",marginBottom:4}}>Nueva contraseña (opcional)</label>
          <input type="password" value={mcNew} onChange={function(e){setMcNew(e.target.value);}} style={saInput} placeholder="Dejar vacío para no cambiar"/>
        </div>
        <button onClick={saveMyAccount} disabled={mcSaving||!mcCurrent} style={Object.assign({},mB(TEAL),{width:"100%",padding:"13px",fontSize:15,opacity:mcSaving||!mcCurrent?0.6:1})}>
          {mcSaving?"Guardando…":"Guardar cambios ✓"}
        </button>
      </div>}

      {/* Modal usuarios de tenant */}
      {usersModal&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
        <div style={{background:"var(--bg-card,#fff)",borderRadius:16,padding:24,width:"100%",maxWidth:640,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 8px 40px rgba(0,0,0,0.3)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <div>
              <h3 style={{margin:0,fontSize:16,fontWeight:700,color:"var(--text-primary)"}}>👥 Usuarios — {usersModal.tenant.name}</h3>
              <p style={{margin:"4px 0 0",fontSize:12,color:"var(--text-muted)"}}>Gestiona accesos y contraseñas del negocio</p>
            </div>
            <button onClick={function(){setUsersModal(null);setResetPwMap({});}} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#aaa",lineHeight:1}}>✕</button>
          </div>
          {/* Botón agregar usuario */}
          {!newUserForm&&<button onClick={function(){setNewUserForm({name:"",email:"",password:"",role:"cajero"});}} style={{marginBottom:14,padding:"7px 16px",borderRadius:8,border:"none",background:TEAL,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>➕ Agregar usuario</button>}
          {/* Formulario nuevo usuario */}
          {newUserForm&&<div style={{border:"2px solid "+TEAL,borderRadius:10,padding:"14px 16px",marginBottom:14,background:"#f0f9f5"}}>
            <p style={{margin:"0 0 10px",fontWeight:700,fontSize:13,color:TEAL}}>Nuevo usuario</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <input value={newUserForm.name} onChange={function(e){setNewUserForm(function(p){return Object.assign({},p,{name:e.target.value});});}} placeholder="Nombre completo" style={Object.assign({},sI,{fontSize:12})}/>
              <input value={newUserForm.email} onChange={function(e){setNewUserForm(function(p){return Object.assign({},p,{email:e.target.value});});}} placeholder="Email" type="email" style={Object.assign({},sI,{fontSize:12})}/>
              <input value={newUserForm.password} onChange={function(e){setNewUserForm(function(p){return Object.assign({},p,{password:e.target.value});});}} placeholder="Contraseña (mín. 6)" type="password" style={Object.assign({},sI,{fontSize:12})}/>
              <select value={newUserForm.role} onChange={function(e){setNewUserForm(function(p){return Object.assign({},p,{role:e.target.value});});}} style={Object.assign({},sI,{fontSize:12})}>
                <option value="cajero">Cajero</option>
                <option value="admin">Administrador</option>
                <option value="auditor">Auditor</option>
              </select>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={doCreateUser} disabled={newUserSaving} style={{padding:"7px 16px",borderRadius:8,border:"none",background:TEAL,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",opacity:newUserSaving?0.6:1}}>{newUserSaving?"Creando…":"Crear"}</button>
              <button onClick={function(){setNewUserForm(null);}} style={{padding:"7px 14px",borderRadius:8,border:"1px solid #ddd",background:"#fff",fontSize:12,cursor:"pointer",color:"#888"}}>Cancelar</button>
            </div>
          </div>}
          {usersLoading?<p style={{textAlign:"center",color:"#888",padding:30}}>Cargando…</p>:
          usersModal.users.length===0?<p style={{textAlign:"center",color:"#888",padding:30}}>Sin usuarios en este negocio</p>:
          <div>{usersModal.users.map(function(u){
            var ROLE_COL={admin:TEAL,cajero:"#378ADD",auditor:"#7F77DD"};
            return <div key={u.id} style={{border:"1px solid #eee",borderRadius:10,padding:"12px 14px",marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,flexWrap:"wrap",gap:6}}>
                <div>
                  <span style={{fontWeight:700,fontSize:13,color:NAVY}}>{u.name}</span>
                  <span style={Object.assign({},mBg(ROLE_COL[u.role]||"#888"),{fontSize:10,marginLeft:8})}>{u.role}</span>
                  {!u.active&&<span style={Object.assign({},mBg("#ccc"),{fontSize:10,marginLeft:4})}>Inactivo</span>}
                  <div style={{fontSize:11,color:"#888",marginTop:2}}>{u.email}</div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={function(){doToggleUser(u);}} style={{padding:"4px 12px",borderRadius:6,border:"1px solid #ddd",background:"#fff",fontSize:12,cursor:"pointer",color:u.active?"#E24B4A":TEAL,fontWeight:600}}>
                    {u.active?"Desactivar":"Activar"}
                  </button>
                  <button onClick={function(){setDeleteUserConfirm(u);}} style={{padding:"4px 10px",borderRadius:6,border:"1px solid #E24B4A",background:"#fff",fontSize:12,cursor:"pointer",color:"#E24B4A",fontWeight:600}}>🗑️</button>
                </div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <input
                  type="password"
                  value={resetPwMap[u.id]||""}
                  onChange={function(e){ var id=u.id; setResetPwMap(function(prev){ return Object.assign({},prev,{[id]:e.target.value}); }); }}
                  placeholder="Nueva contraseña (mín. 6 caracteres)"
                  style={Object.assign({},sI,{flex:1,fontSize:12,padding:"7px 10px"})}
                />
                <button
                  onClick={function(){doResetPw(u);}}
                  disabled={resetSaving[u.id]||!(resetPwMap[u.id]&&resetPwMap[u.id].length>=6)}
                  style={{padding:"7px 14px",borderRadius:8,border:"none",background:"#E24B4A",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",opacity:resetSaving[u.id]||!(resetPwMap[u.id]&&resetPwMap[u.id].length>=6)?0.5:1}}
                >
                  {resetSaving[u.id]?"…":"🔑 Resetear"}
                </button>
              </div>
            </div>;
          })}</div>}
        </div>
      </div>}

      {/* Modal editar negocio */}
      {editModal&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
        <div style={{background:"var(--bg-card,#fff)",borderRadius:16,padding:24,width:"100%",maxWidth:500,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 8px 40px rgba(0,0,0,0.3)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <h3 style={{margin:0,fontSize:16,fontWeight:700,color:"var(--text-primary)"}}>✏️ Editar negocio</h3>
            <button onClick={function(){setEditModal(null);}} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#aaa"}}>✕</button>
          </div>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:"var(--text-secondary)",marginBottom:4}}>Nombre del negocio</label>
          <input value={editModal.name||""} onChange={function(e){setEditModal(function(p){return Object.assign({},p,{name:e.target.value});});}} style={Object.assign({},saInput,{marginBottom:12})}/>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:"var(--text-secondary)",marginBottom:4}}>Propietario</label>
          <input value={editModal.owner_name||""} onChange={function(e){setEditModal(function(p){return Object.assign({},p,{owner_name:e.target.value});});}} style={Object.assign({},saInput,{marginBottom:12})}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div>
              <label style={{display:"block",fontSize:12,fontWeight:600,color:"var(--text-secondary)",marginBottom:4}}>Plan</label>
              <select value={editModal.plan||"basic"} onChange={function(e){setEditModal(function(p){return Object.assign({},p,{plan:e.target.value});});}} style={saInput}>
                <option value="basic">Básico</option>
                <option value="professional">Profesional</option>
                <option value="enterprise">Empresarial</option>
              </select>
            </div>
            <div>
              <label style={{display:"block",fontSize:12,fontWeight:600,color:"var(--text-secondary)",marginBottom:4}}>Teléfono</label>
              <input value={editModal.phone||""} onChange={function(e){setEditModal(function(p){return Object.assign({},p,{phone:e.target.value});});}} style={saInput} placeholder="50212345678"/>
            </div>
          </div>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:"var(--text-secondary)",marginBottom:4}}>Email de contacto</label>
          <input type="email" value={editModal.email||""} onChange={function(e){setEditModal(function(p){return Object.assign({},p,{email:e.target.value});});}} style={Object.assign({},saInput,{marginBottom:12})}/>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:"var(--text-secondary)",marginBottom:4}}>Notas internas</label>
          <textarea value={editModal.notes||""} onChange={function(e){setEditModal(function(p){return Object.assign({},p,{notes:e.target.value});});}} style={Object.assign({},saInput,{marginBottom:16,height:70,resize:"vertical"})}/>
          <div style={{display:"flex",gap:10}}>
            <button onClick={saveEditTenant} disabled={editSaving} style={Object.assign({},mB(TEAL),{flex:1,opacity:editSaving?0.6:1})}>{editSaving?"Guardando…":"Guardar cambios ✓"}</button>
            <button onClick={function(){setEditModal(null);}} style={{padding:"11px 18px",borderRadius:10,border:"1px solid var(--border-card)",background:"var(--bg-alt)",fontSize:14,cursor:"pointer",color:"var(--text-secondary)"}}>Cancelar</button>
          </div>
        </div>
      </div>}

      {/* Confirmar eliminar negocio */}
      {deleteConfirm&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:4000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
        <div style={{background:"var(--bg-card,#fff)",borderRadius:16,padding:28,width:"100%",maxWidth:420,boxShadow:"0 8px 40px rgba(0,0,0,0.3)"}}>
          <div style={{textAlign:"center",marginBottom:16}}>
            <div style={{fontSize:48,marginBottom:8}}>⚠️</div>
            <h3 style={{margin:"0 0 8px",fontSize:17,fontWeight:800,color:"#E24B4A"}}>Eliminar negocio</h3>
            <p style={{margin:"0 0 6px",fontSize:14,color:"var(--text-primary)"}}>Estás a punto de eliminar <strong>{deleteConfirm.name}</strong></p>
            <p style={{margin:0,fontSize:12,color:"#E24B4A",fontWeight:600}}>Esta acción es IRREVERSIBLE. Se borrarán todos sus datos: ventas, productos, usuarios, reparaciones y más.</p>
          </div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={doDeleteTenant} disabled={deleteSaving} style={{flex:1,padding:"12px",borderRadius:10,border:"none",background:"#E24B4A",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",opacity:deleteSaving?0.6:1}}>{deleteSaving?"Eliminando…":"Sí, eliminar todo"}</button>
            <button onClick={function(){setDeleteConfirm(null);}} style={{flex:1,padding:"12px",borderRadius:10,border:"1px solid var(--border-card)",background:"var(--bg-alt)",fontSize:14,cursor:"pointer",color:"var(--text-secondary)"}}>Cancelar</button>
          </div>
        </div>
      </div>}

      {/* Confirmar eliminar usuario */}
      {deleteUserConfirm&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:4000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
        <div style={{background:"var(--bg-card,#fff)",borderRadius:16,padding:28,width:"100%",maxWidth:380,boxShadow:"0 8px 40px rgba(0,0,0,0.3)"}}>
          <div style={{textAlign:"center",marginBottom:16}}>
            <div style={{fontSize:42,marginBottom:8}}>🗑️</div>
            <h3 style={{margin:"0 0 8px",fontSize:16,fontWeight:800,color:"#E24B4A"}}>Eliminar usuario</h3>
            <p style={{margin:"0 0 4px",fontSize:14,color:"var(--text-primary)"}}><strong>{deleteUserConfirm.name}</strong></p>
            <p style={{margin:0,fontSize:12,color:"var(--text-muted)"}}>{deleteUserConfirm.email}</p>
            <p style={{margin:"10px 0 0",fontSize:12,color:"#E24B4A",fontWeight:600}}>Esta acción no se puede deshacer.</p>
          </div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={doDeleteUser} disabled={deleteUserSaving} style={{flex:1,padding:"11px",borderRadius:10,border:"none",background:"#E24B4A",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",opacity:deleteUserSaving?0.6:1}}>{deleteUserSaving?"Eliminando…":"Eliminar"}</button>
            <button onClick={function(){setDeleteUserConfirm(null);}} style={{flex:1,padding:"11px",borderRadius:10,border:"1px solid #ddd",background:"#fff",fontSize:14,cursor:"pointer",color:"#666"}}>Cancelar</button>
          </div>
        </div>
      </div>}

      {/* Crear tenant */}
      {tab==="crear"&&<div style={Object.assign({},sC,{maxWidth:520,padding:28})}>
        <h3 style={{margin:"0 0 20px",fontSize:16,fontWeight:700,color:NAVY}}>➕ Registrar nuevo negocio</h3>
        <label style={{display:"block",fontSize:12,fontWeight:600,color:"#555",marginBottom:4}}>Nombre del negocio *</label>
        <input value={fName} onChange={function(e){setFName(e.target.value);}} style={Object.assign({},sI,{marginBottom:12})} placeholder="Ej: Celulería Pérez"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div>
            <label style={{display:"block",fontSize:12,fontWeight:600,color:"#555",marginBottom:4}}>Plan *</label>
            <select value={fPlan} onChange={function(e){setFPlan(e.target.value);}} style={sI}>
              <option value="basic">Básico</option>
              <option value="professional">Profesional</option>
              <option value="enterprise">Empresarial</option>
            </select>
          </div>
          <div>
            <label style={{display:"block",fontSize:12,fontWeight:600,color:"#555",marginBottom:4}}>Duración inicial</label>
            <select value={fMonths} onChange={function(e){setFMonths(e.target.value);}} style={sI}>
              <option value="1">1 mes</option>
              <option value="3">3 meses</option>
              <option value="6">6 meses</option>
              <option value="12">1 año</option>
            </select>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div>
            <label style={{display:"block",fontSize:12,fontWeight:600,color:"#555",marginBottom:4}}>Nombre del propietario</label>
            <input value={fOwner} onChange={function(e){setFOwner(e.target.value);}} style={sI} placeholder="Carlos López"/>
          </div>
          <div>
            <label style={{display:"block",fontSize:12,fontWeight:600,color:"#555",marginBottom:4}}>Teléfono</label>
            <input value={fPhone} onChange={function(e){setFPhone(e.target.value);}} style={sI} placeholder="55551234"/>
          </div>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:"#555",marginBottom:4}}>Email del negocio</label>
          <input type="email" value={fEmail} onChange={function(e){setFEmail(e.target.value);}} style={sI} placeholder="negocio@email.com"/>
        </div>
        <div style={{background:"#f0f9f5",borderRadius:10,padding:"14px 16px",marginBottom:16}}>
          <p style={{margin:"0 0 10px",fontSize:12,fontWeight:700,color:TEAL}}>🔑 Credenciales del admin del negocio</p>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:"#555",marginBottom:4}}>Email admin *</label>
          <input type="email" value={fAdminEmail} onChange={function(e){setFAdminEmail(e.target.value);}} style={Object.assign({},sI,{marginBottom:10})} placeholder="admin@negocio.com"/>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:"#555",marginBottom:4}}>Contraseña inicial *</label>
          <input type="password" value={fAdminPass} onChange={function(e){setFAdminPass(e.target.value);}} style={sI} placeholder="Mínimo 6 caracteres"/>
        </div>
        <label style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,cursor:"pointer",fontSize:13,color:"#555"}}>
          <input type="checkbox" checked={fSkipWizard} onChange={function(e){setFSkipWizard(e.target.checked);}} style={{width:16,height:16,cursor:"pointer"}}/>
          Omitir asistente inicial (el negocio ya está configurado)
        </label>
        <button onClick={createTenant} disabled={saving||!fName||!fAdminEmail||!fAdminPass} style={Object.assign({},mB(TEAL),{width:"100%",padding:"13px",fontSize:15,opacity:saving||!fName||!fAdminEmail||!fAdminPass?0.6:1})}>
          {saving?"Creando…":"Crear negocio ✓"}
        </button>
      </div>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   ONBOARDING WIZARD
   ══════════════════════════════════════════════════════════════════════ */
function OnboardingWizard(props){
  var onDone=props.onDone||function(){};
  var showFlash=props.showFlash||function(){};
  var session=props.session||{};
  var _step=useState(1); var step=_step[0]; var setStep=_step[1];
  var _saving=useState(false); var saving=_saving[0]; var setSaving=_saving[1];

  // Step 1 — Tienda
  var _sn=useState(""); var storeName=_sn[0]; var setStoreName=_sn[1];
  var _st=useState(""); var storeTagline=_st[0]; var setStoreTagline=_st[1];
  var _sph=useState(""); var storePhone=_sph[0]; var setStorePhone=_sph[1];
  var _sad=useState(""); var storeAddress=_sad[0]; var setStoreAddress=_sad[1];

  // Step 2 — Primer producto
  var _pn=useState(""); var prodName=_pn[0]; var setProdName=_pn[1];
  var _pc=useState(""); var prodCode=_pc[0]; var setProdCode=_pc[1];
  var _pp=useState(""); var prodPrice=_pp[0]; var setProdPrice=_pp[1];
  var _ps=useState(""); var prodStock=_ps[0]; var setProdStock=_ps[1];
  var _prodDone=useState(false); var prodDone=_prodDone[0]; var setProdDone=_prodDone[1];

  // Step 3 — Primer cajero
  var _un=useState(""); var userName=_un[0]; var setUserName=_un[1];
  var _ue=useState(""); var userEmail=_ue[0]; var setUserEmail=_ue[1];
  var _upw=useState(""); var userPw=_upw[0]; var setUserPw=_upw[1];
  var _userDone=useState(false); var userDone=_userDone[0]; var setUserDone=_userDone[1];

  var TOTAL=4;

  async function saveStep1(){
    setSaving(true);
    try {
      await settingsAPI.update({store_name:storeName,store_tagline:storeTagline,store_phone:storePhone,store_address:storeAddress});
      setStore({store_name:storeName,store_tagline:storeTagline,store_phone:storePhone,store_address:storeAddress});
      setStep(2);
    } catch(e){ showFlash("Error guardando configuración","error"); }
    setSaving(false);
  }

  async function saveStep2(){
    if(!prodName||!prodPrice){ showFlash("Nombre y precio requeridos","error"); return; }
    setSaving(true);
    try {
      await productsAPI.create({name:prodName,code:prodCode||("P-"+Date.now().toString(36).toUpperCase()),price:Number(prodPrice),cost:0,stock:Number(prodStock)||0,category:"General",unit:"uni"});
      setProdDone(true); setStep(3);
    } catch(e){ showFlash("Error creando producto","error"); }
    setSaving(false);
  }

  async function saveStep3(){
    if(!userName||!userEmail||!userPw){ showFlash("Todos los campos son requeridos","error"); return; }
    setSaving(true);
    try {
      await usersAPI.create({name:userName,email:userEmail,password:userPw,role:"cajero"});
      setUserDone(true); setStep(4);
    } catch(e){ showFlash("Error creando usuario","error"); }
    setSaving(false);
  }

  async function finish(){
    setSaving(true);
    try {
      await settingsAPI.update({onboarding_done:"true"});
      onDone();
    } catch(e){ onDone(); }
    setSaving(false);
  }

  var stepLabels=["Mi Tienda","Primer Producto","Primer Cajero","¡Listo!"];

  return (
    <div style={{position:"fixed",top:0,left:0,width:"100%",height:"100%",background:"rgba(10,20,35,0.92)",zIndex:10000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:520,padding:"36px 36px 28px",boxShadow:"0 24px 80px rgba(0,0,0,0.4)",maxHeight:"90vh",overflowY:"auto"}}>
        {/* Header */}
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:40,marginBottom:8}}>🚀</div>
          <h2 style={{margin:"0 0 4px",fontSize:22,fontWeight:800,color:NAVY}}>Configuración inicial</h2>
          <p style={{margin:0,fontSize:13,color:"#888"}}>Sigue los pasos para dejar el sistema listo</p>
          <button onClick={finish} style={{marginTop:10,background:"none",border:"none",color:"#aaa",fontSize:12,cursor:"pointer",textDecoration:"underline"}}>Saltar y configurar después →</button>
        </div>

        {/* Progress */}
        <div style={{display:"flex",gap:6,marginBottom:28}}>
          {stepLabels.map(function(lb,i){
            var n=i+1; var active=n===step; var done=n<step;
            return <div key={n} style={{flex:1,textAlign:"center"}}>
              <div style={{height:4,borderRadius:4,background:done||active?TEAL:"#e0e0e0",marginBottom:6,transition:"background 0.3s"}}/>
              <div style={{fontSize:10,fontWeight:done||active?700:400,color:done||active?TEAL:"#aaa"}}>{lb}</div>
            </div>;
          })}
        </div>

        {/* Step 1 */}
        {step===1&&<div>
          <h3 style={{margin:"0 0 16px",fontSize:16,fontWeight:700,color:NAVY}}>📋 Datos de tu negocio</h3>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:"#555",marginBottom:4}}>Nombre del negocio *</label>
          <input value={storeName} onChange={function(e){setStoreName(e.target.value);}} style={Object.assign({},sI,{marginBottom:12})} placeholder="Ej: Mi Celulería"/>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:"#555",marginBottom:4}}>Slogan o descripción</label>
          <input value={storeTagline} onChange={function(e){setStoreTagline(e.target.value);}} style={Object.assign({},sI,{marginBottom:12})} placeholder="Ej: Accesorios y Reparaciones"/>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:"#555",marginBottom:4}}>Teléfono</label>
          <input value={storePhone} onChange={function(e){setStorePhone(e.target.value);}} style={Object.assign({},sI,{marginBottom:12})} placeholder="Ej: 55551234"/>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:"#555",marginBottom:4}}>Dirección</label>
          <input value={storeAddress} onChange={function(e){setStoreAddress(e.target.value);}} style={Object.assign({},sI,{marginBottom:24})} placeholder="Ej: Zona 1, Ciudad de Guatemala"/>
          <div style={{display:"flex",gap:10}}>
            <button onClick={saveStep1} disabled={saving||!storeName} style={Object.assign({},mB(TEAL),{flex:1,padding:"13px",fontSize:15,opacity:saving||!storeName?0.6:1})}>
              {saving?"Guardando…":"Guardar y continuar →"}
            </button>
          </div>
        </div>}

        {/* Step 2 */}
        {step===2&&<div>
          <h3 style={{margin:"0 0 4px",fontSize:16,fontWeight:700,color:NAVY}}>📦 Agrega tu primer producto</h3>
          <p style={{margin:"0 0 16px",fontSize:12,color:"#888"}}>Puedes agregar más productos después en el módulo de Productos.</p>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:"#555",marginBottom:4}}>Nombre del producto *</label>
          <input value={prodName} onChange={function(e){setProdName(e.target.value);}} style={Object.assign({},sI,{marginBottom:12})} placeholder="Ej: Funda iPhone 14"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div>
              <label style={{display:"block",fontSize:12,fontWeight:600,color:"#555",marginBottom:4}}>Precio (Q) *</label>
              <input type="number" value={prodPrice} onChange={function(e){setProdPrice(e.target.value);}} style={sI} placeholder="0.00"/>
            </div>
            <div>
              <label style={{display:"block",fontSize:12,fontWeight:600,color:"#555",marginBottom:4}}>Stock inicial</label>
              <input type="number" value={prodStock} onChange={function(e){setProdStock(e.target.value);}} style={sI} placeholder="0"/>
            </div>
          </div>
          <div style={{display:"flex",gap:10,marginTop:8}}>
            <button onClick={function(){setStep(3);}} style={Object.assign({},mB("#888"),{padding:"12px 20px",fontSize:13})}>Omitir</button>
            <button onClick={saveStep2} disabled={saving||!prodName||!prodPrice} style={Object.assign({},mB(TEAL),{flex:1,padding:"12px",fontSize:14,opacity:saving||!prodName||!prodPrice?0.6:1})}>
              {saving?"Guardando…":"Guardar y continuar →"}
            </button>
          </div>
        </div>}

        {/* Step 3 */}
        {step===3&&<div>
          <h3 style={{margin:"0 0 4px",fontSize:16,fontWeight:700,color:NAVY}}>👤 Crea tu primer cajero</h3>
          <p style={{margin:"0 0 16px",fontSize:12,color:"#888"}}>El cajero podrá hacer ventas y gestionar la caja. Tú eres el admin.</p>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:"#555",marginBottom:4}}>Nombre *</label>
          <input value={userName} onChange={function(e){setUserName(e.target.value);}} style={Object.assign({},sI,{marginBottom:12})} placeholder="Ej: Juan López"/>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:"#555",marginBottom:4}}>Email *</label>
          <input type="email" value={userEmail} onChange={function(e){setUserEmail(e.target.value);}} style={Object.assign({},sI,{marginBottom:12})} placeholder="cajero@minegocio.com"/>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:"#555",marginBottom:4}}>Contraseña temporal *</label>
          <input type="password" value={userPw} onChange={function(e){setUserPw(e.target.value);}} style={Object.assign({},sI,{marginBottom:24})} placeholder="Mínimo 6 caracteres"/>
          <div style={{display:"flex",gap:10}}>
            <button onClick={function(){setStep(4);}} style={Object.assign({},mB("#888"),{padding:"12px 20px",fontSize:13})}>Omitir</button>
            <button onClick={saveStep3} disabled={saving||!userName||!userEmail||!userPw} style={Object.assign({},mB(TEAL),{flex:1,padding:"12px",fontSize:14,opacity:saving||!userName||!userEmail||!userPw?0.6:1})}>
              {saving?"Creando…":"Crear y continuar →"}
            </button>
          </div>
        </div>}

        {/* Step 4 */}
        {step===4&&<div style={{textAlign:"center"}}>
          <div style={{fontSize:56,marginBottom:12}}>🎉</div>
          <h3 style={{margin:"0 0 8px",fontSize:20,fontWeight:800,color:NAVY}}>¡Todo listo!</h3>
          <p style={{margin:"0 0 24px",fontSize:14,color:"#666",lineHeight:1.7}}>Tu sistema {APP_NAME} está configurado.<br/>Aquí un resumen de lo que puedes hacer:</p>
          <div style={{textAlign:"left",background:"#f5f9f7",borderRadius:12,padding:"16px 20px",marginBottom:24}}>
            {[
              ["🛒","POS","Registra ventas con múltiples métodos de pago"],
              ["💳","Cuentas","Lleva el control de ventas a crédito"],
              ["🔧","Reparaciones","Gestiona órdenes de servicio técnico"],
              ["📦","Productos","Administra tu inventario y precios"],
              ["👥","Clientes","Base de datos de tus compradores"],
              ["📊","Dashboard","Gráficas de ventas e ingresos"],
            ].map(function(row){ return <div key={row[1]} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:10}}>
              <span style={{fontSize:18,minWidth:24}}>{row[0]}</span>
              <div><strong style={{fontSize:13,color:NAVY}}>{row[1]}</strong><span style={{fontSize:12,color:"#777"}}> — {row[2]}</span></div>
            </div>; })}
          </div>
          <button onClick={finish} disabled={saving} style={Object.assign({},mB(TEAL),{width:"100%",padding:"14px",fontSize:16,fontWeight:800})}>
            {saving?"Finalizando…":"¡Empezar a usar el sistema! →"}
          </button>
        </div>}
      </div>
    </div>
  );
}

/* ══ APP ══════════════════════════════════════════════════════════════ */
function App(props) {
  var session=props.session||{}; var onLogout=props.onLogout||function(){};
  var theme=props.theme||"light"; var toggleTheme=props.toggleTheme||function(){};
  var sidebarOpen=props.sidebarOpen||false; var setSidebarOpen=props.setSidebarOpen||function(){};
  var _p=useState([]); var products=_p[0]; var setProducts=_p[1];
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
        if(cfg&&cfg.store_name){ setStoreInfo(function(prev){return Object.assign({},prev,cfg);}); setStore(cfg); }
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
        var normalAccs  = (accs||[]).map(function(a){return Object.assign({},a,{items:a.account_items||[],payments:(a.account_payments||[]).map(function(_pp){return Object.assign({},_pp,{date:_pp.date||_pp.created_at,amount:Number(_pp.amount),registradoPor:_pp.registrado_por||_pp.registradoPor||null});}),total:Number(a.total),paid:Number(a.paid),balance:Number(a.balance),date:a.created_at,registradoPor:a.registrado_por||null});});
        var normalRets  = (rets||[]).map(function(r){return Object.assign({},r,{items:r.return_items||[],refundAmount:Number(r.refund_amount),itemCondition:r.item_condition,refundMethod:r.refund_method,date:r.created_at,saleId:r.sale_id||null});});
        var normalDefs  = (defs||[]).map(function(d){return Object.assign({},d,{price:Number(d.price||0)});});
        var normalClis  = (clis||[]).map(function(c){return Object.assign({},c,{cliCode:c.cli_code,createdAt:c.created_at});});
        var normalReps  = (reps||[]).map(function(r){return Object.assign({},r,{repCode:r.rep_code,clientId:r.client_id,clientName:r.client_name,clientPhone:r.client_phone,clientCli:r.client_cli,problemDesc:r.problem_desc,techName:r.tech_name,estimatedCost:Number(r.estimated_cost||0),promisedDate:r.promised_date,internalNote:r.internal_note,registradoPor:r.registrado_por||{},parts:r.parts||[],createdAt:r.created_at});});
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
        showFlash("⚠️ Error al conectar con el servidor. Verifica tu conexión e intenta recargar la página.","err");
      }
      setLoaded(true);
    }
    loadAll();
  },[]);

  var _v=useState(function(){ return canAccess(session.role,"pos")?"pos":"dashboard"; }); var view=_v[0]; var setView=_v[1];
  var _fl=useState({msg:"",type:"ok"}); var flash=_fl[0]; var setFlash=_fl[1];
  var _ss=useState(null); var selSale=_ss[0]; var setSelSale=_ss[1];
  var _gs=useState(false); var gsOpen=_gs[0]; var setGsOpen=_gs[1];

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
  var _pt=useState("completo"); var payType=_pt[0]; var setPayType=_pt[1];
  var _ci=useState(""); var cashIn=_ci[0]; var setCashIn=_ci[1];
  var _ip=useState(""); var initialPay=_ip[0]; var setInitialPay=_ip[1];
  var _cn=useState(""); var clientName=_cn[0]; var setClientName=_cn[1];
  var _sci=useState(null); var selectedClientId=_sci[0]; var setSelectedClientId=_sci[1];
  var _sn=useState(""); var saleNote=_sn[0]; var setSaleNote=_sn[1];

  function showFlash(msg,type){
    setFlash({msg:msg,type:type||"ok"});
    setTimeout(function(){setFlash({msg:"",type:"ok"});},4000);
  }

  var filteredPOS=products.filter(function(p){
    if(!posQ)return true;
    var q=posQ.toLowerCase();
    return (p.name||"").toLowerCase().includes(q)||(p.code||"").toLowerCase().includes(q)||(p.shelf||"").toLowerCase().includes(q);
  });

  function addToCart(p){
    if(p.stock<=0&&p.unit!=="serv")return;
    setCart(function(c){
      var ex=c.find(function(i){return i.id===p.id;});
      if(ex) return ex.qty>=p.stock?c:c.map(function(i){return i.id===p.id?Object.assign({},i,{qty:i.qty+1}):i;});
      return c.concat([{id:p.id,code:p.code,name:p.name,price:p.price,shelf:p.shelf,unit:p.unit,qty:1,maxStock:p.stock}]);
    });
  }
  function changeQty(id,d){ setCart(function(c){return c.map(function(i){return i.id===id?Object.assign({},i,{qty:Math.max(1,Math.min(i.qty+d,i.maxStock))}):i;});}); }
  function removeFromCart(id){ setCart(function(c){return c.filter(function(i){return i.id!==id;});}); }

  function applyDiscount(itemId, newPrice){
    setCart(function(c){return c.map(function(i){
      if(i.id!==itemId) return i;
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
  var initPaidVal=parseFloat(initialPay)||0;

  function resetPOS(){ setCart([]);setCashIn("");setClientName("");setInitialPay("");setPayType("completo");setPayMethod("Efectivo");setSelectedClientId(null);setSaleNote(""); }

  var checkoutInProgress=useRef(false);
  async function checkout(){
    if(!cart.length)return;
    if(!clientName.trim()){showFlash("El nombre del cliente es obligatorio","err");return;}
    if(checkoutInProgress.current)return;
    checkoutInProgress.current=true;
    var client=clientName.trim();
    var items=cart.map(function(i){return {id:i.id,code:i.code,name:i.name,price:i.price,qty:i.qty,shelf:i.shelf,originalPrice:i.originalPrice||null,discountBy:i.discountBy||null,discountByRole:i.discountByRole||null,discountAt:i.discountAt||null};});
    var registradoPor={userId:session.userId,name:session.name,role:session.role};
    var nota=saleNote.trim()||null;
    function deduct(){ setProducts(function(p){return p.map(function(x){var ci=cart.find(function(i){return i.id===x.id;});return ci&&x.unit!=="serv"?Object.assign({},x,{stock:x.stock-ci.qty}):x;}); }); }
    var idempotencyKey=gid()+"-"+Date.now();
    if(payType==="completo"){
      try {
        await salesAPI.create({client:client,total:cartTotal,method:payMethod,items:cart,nota:nota,idempotencyKey:idempotencyKey});
        var freshSales = await salesAPI.getAll();
        var ns = (freshSales||[]).map(function(s){return Object.assign({},s,{items:s.sale_items||[],total:Number(s.total),date:s.created_at,registradoPor:s.registrado_por||null,payType:s.pay_type||'completo',status:s.status||'completado'});});
        setSales(ns);
      } catch(e){
        var errMsg=e&&e.error?e.error:null;
        showFlash("⛔ "+(errMsg||"Error al registrar la venta. Verifica tu conexión."),"err");
        checkoutInProgress.current=false;
        return;
      }
      deduct();
      showFlash("✓ Venta cobrada — "+Q(cartTotal),"ok");
    } else {
      var paid=payType==="parcial"?Math.min(initPaidVal,cartTotal):0;
      var balance=cartTotal-paid;
      try{
        await salesAPI.create({client:client,total:cartTotal,method:payMethod,items:cart,payType:payType,initialPay:paid,nota:nota,idempotencyKey:idempotencyKey});
        var freshAccs = await accountsAPI.getAll();
        var na=(freshAccs||[]).map(function(a){return Object.assign({},a,{items:a.account_items||[],payments:(a.account_payments||[]).map(function(_pp){return Object.assign({},_pp,{date:_pp.date||_pp.created_at,amount:Number(_pp.amount),registradoPor:_pp.registrado_por||_pp.registradoPor||null});}),total:Number(a.total),paid:Number(a.paid),balance:Number(a.balance),date:a.created_at,registradoPor:a.registrado_por||null});});
        setAccounts(na);
      }catch(e){
        var errMsg2=e&&e.error?e.error:null;
        showFlash("⛔ "+(errMsg2||"Error al registrar la cuenta. Verifica tu conexión."),"err");
        checkoutInProgress.current=false;
        return;
      }
      deduct();
      showFlash(payType==="pendiente"?"⏳ Pendiente — "+Q(cartTotal)+" por cobrar":"💰 Abono "+Q(paid)+" — Saldo: "+Q(balance),"warn");
    }
    resetPOS();
    checkoutInProgress.current=false;
  }

  async function addPayment(accountId,amount,method,note){
    try{
      await accountsAPI.addPayment(accountId,{amount:amount,method:method||'Efectivo',note:note||''});
      var freshAccs2 = await accountsAPI.getAll();
      var na2=(freshAccs2||[]).map(function(a){return Object.assign({},a,{items:a.account_items||[],payments:(a.account_payments||[]).map(function(_pp){return Object.assign({},_pp,{date:_pp.date||_pp.created_at,amount:Number(_pp.amount),registradoPor:_pp.registrado_por||_pp.registradoPor||null});}),total:Number(a.total),paid:Number(a.paid),balance:Number(a.balance),date:a.created_at,registradoPor:a.registrado_por||null});});
      setAccounts(na2);
      showFlash("✓ Pago registrado","ok");
    }catch(e){
      var em=e&&e.error?e.error:null;
      showFlash("⛔ "+(em||"Error al registrar el pago. Verifica tu conexión."),"err");
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
      setReturns((freshRets||[]).map(function(r){return Object.assign({},r,{items:r.return_items||[],refundAmount:Number(r.refund_amount),itemCondition:r.item_condition,refundMethod:r.refund_method,date:r.created_at,saleId:r.sale_id||null});}));
      setDefectives((freshDefs||[]).map(function(d){return Object.assign({},d,{price:Number(d.price||0)});}));
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
  }

  async function updateDefectiveStatus(id,status){
    try{
      await defectivesAPI.update(id,status);
      var freshDefs = await defectivesAPI.getAll();
      setDefectives((freshDefs||[]).map(function(d){return Object.assign({},d,{price:Number(d.price||0)});}));
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
    try{
      if(!isNew){
        await productsAPI.update(prod.id,{code:prod.code,name:prod.name,category:prod.category||'',shelf:prod.shelf||'',price:prod.price,cost:prod.cost||0,stock:prod.stock||0,unit:prod.unit||'uni'});
        setProducts(function(p){return p.map(function(x){return x.id===prod.id?prod:x;});});
      } else {
        var saved=await productsAPI.create({code:prod.code,name:prod.name,category:prod.category||'',shelf:prod.shelf||'',price:prod.price,cost:prod.cost||0,stock:prod.stock||0,unit:prod.unit||'uni'});
        setProducts(function(p){return p.concat([Object.assign({},prod,{id:saved.id})]);});
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

  async function importProducts(prods, callback){
    var count=0; var errors=0;
    for(var i=0;i<prods.length;i++){
      var prod=prods[i];
      try{
        var savedImp=await productsAPI.create({
          name:prod.name,category:prod.category||"",shelf:prod.shelf||"",
          price:prod.price,cost:prod.cost||0,stock:prod.stock||0,
          unit:prod.unit||"uni"
        });
        setProducts(function(p){return p.concat([Object.assign({},prod,{id:savedImp.id,code:savedImp.code})]);});
        count++;
      } catch(e){
        console.warn("Error importando:",prod.name,e);
        errors++;
      }
    }
    if(callback) callback(errors===0,count);
    showFlash("✅ "+count+" productos importados"+(errors>0?" ("+errors+" con error)":""),"ok");
  }

  async function saveWarranty(data){
    try{
      var w=await warrantiesAPI.create(data);
      setWarranties(function(p){return [Object.assign({},w,{entityType:w.entity_type,entityId:w.entity_id,startDate:w.start_date,endDate:w.end_date})].concat(p);});
      showFlash("✅ Garantía registrada","ok");
      return w;
    }catch(e){ showFlash("Error registrando garantía","error"); }
  }

  async function updateWarranty(id, data){
    try{
      var w=await warrantiesAPI.update(id, data);
      setWarranties(function(p){return p.map(function(x){return x.id===id?Object.assign({},x,w,{entityType:w.entity_type||x.entityType,entityId:w.entity_id||x.entityId,startDate:w.start_date||x.startDate,endDate:w.end_date||x.endDate}):x;});});
      showFlash("✅ Garantía actualizada","ok");
    }catch(e){ showFlash("Error actualizando garantía","error"); }
  }

  async function saveRepair(rep){
    try{
      await repairsAPI.create({id:rep.id,repCode:rep.repCode,clientId:rep.clientId||null,clientName:rep.clientName,clientPhone:rep.clientPhone||null,clientCli:rep.clientCli||null,brand:rep.brand,model:rep.model,imei:rep.imei||null,problemDesc:rep.problemDesc,diagnosis:rep.diagnosis||null,techName:rep.techName||null,estimatedCost:rep.estimatedCost||0,promisedDate:rep.promisedDate||null,internalNote:rep.internalNote||null,status:rep.status||'recibido',registradoPor:rep.registradoPor||{},parts:rep.parts||[],createdAt:rep.createdAt});
      var fr=await repairsAPI.getAll();
      setRepairs((fr||[]).map(function(r){return Object.assign({},r,{repCode:r.rep_code,clientId:r.client_id,clientName:r.client_name,clientPhone:r.client_phone,clientCli:r.client_cli,problemDesc:r.problem_desc,techName:r.tech_name,estimatedCost:Number(r.estimated_cost||0),promisedDate:r.promised_date,internalNote:r.internal_note,registradoPor:r.registrado_por||{},parts:r.parts||[],createdAt:r.created_at});}));
    }catch(e){
      var emRep=e&&e.error?e.error:null;
      showFlash("⛔ "+(emRep||"Error al guardar la reparación. Verifica tu conexión."),"err");
    }
  }
  async function updateRepairStatus(id, status){
    try{
      await repairsAPI.updateStatus(id, status);
      var fr2=await repairsAPI.getAll();
      setRepairs((fr2||[]).map(function(r){return Object.assign({},r,{repCode:r.rep_code,clientId:r.client_id,clientName:r.client_name,clientPhone:r.client_phone,clientCli:r.client_cli,problemDesc:r.problem_desc,techName:r.tech_name,estimatedCost:Number(r.estimated_cost||0),promisedDate:r.promised_date,internalNote:r.internal_note,registradoPor:r.registrado_por||{},parts:r.parts||[],createdAt:r.created_at});}));
    }catch(e){
      var emRS=e&&e.error?e.error:null;
      showFlash("⛔ "+(emRS||"Error al actualizar la reparación. Verifica tu conexión."),"err");
    }
  }
  function cobrarReparacion(rep){
    // Pre-carga el POS con los datos de la reparación
    setClientName(rep.clientName);
    setSelectedClientId(rep.clientId||null);
    setSaleNote("Reparación "+rep.repCode+" — "+rep.brand+" "+rep.model);
    // Si tiene repuestos, los agrega como items del carrito
    if(rep.parts&&rep.parts.length>0){
      var cartItems=rep.parts.map(function(p){
        var prod=products.find(function(x){return x.code===p.code;});
        return {id:prod?prod.id:gid(),code:p.code,name:p.name,price:p.price,qty:p.qty,shelf:prod?prod.shelf:"",unit:"uni",maxStock:prod?prod.stock:999};
      });
      // Si hay costo estimado mayor a los repuestos, agrega mano de obra
      var costoRepuestos=rep.parts.reduce(function(s,p){return s+p.price*p.qty;},0);
      var costo=parseFloat(rep.estimatedCost)||0;
      if(costo>costoRepuestos){
        cartItems.push({id:gid(),code:"MO001",name:"Mano de obra — "+rep.brand+" "+rep.model,price:costo-costoRepuestos,qty:1,shelf:"",unit:"serv",maxStock:999});
      }
      setCart(cartItems);
    } else if(rep.estimatedCost>0){
      // Solo mano de obra
      setCart([{id:gid(),code:"MO001",name:"Reparación — "+rep.brand+" "+rep.model,price:parseFloat(rep.estimatedCost),qty:1,shelf:"",unit:"serv",maxStock:999}]);
    }
    setView("pos");
    showFlash("✓ Reparación "+rep.repCode+" cargada en el POS","ok");
  }

  async function saveClient(obj, isEdit){
    try{
      if(isEdit){ await clientsAPI.update(obj.id,{cliCode:obj.cliCode,name:obj.name,dpi:obj.dpi||null,phone:obj.phone||null,address:obj.address||null,active:obj.active!==false}); }
      else { await clientsAPI.create({id:obj.id,cliCode:obj.cliCode,name:obj.name,dpi:obj.dpi||null,phone:obj.phone||null,address:obj.address||null,active:true,createdAt:obj.createdAt}); }
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

        {/* Onboarding wizard */}
        {showOnboarding&&<OnboardingWizard session={session} showFlash={showFlash} onDone={function(){setShowOnboarding(false); setStoreInfo(function(prev){return Object.assign({},prev,{store_name:getStore().store_name,store_tagline:getStore().store_tagline});});}}/>}

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
        <div style={{flex:1,padding:"clamp(12px,3vw,28px)",overflowY:"auto",minWidth:0}} className="main-content">
          {view==="dashboard"&&canAccess(session.role,"dashboard")&&<DashboardScreen sales={sales} todaySales={todaySales} pendingAccs={pendingAccs} totalPend={totalPend} products={products} top5={top5} setSelectedSale={setSelSale} setView={setView} accounts={accounts} returns={returns} repairs={repairs} warranties={warranties}/>}
          {view==="pos"      &&canAccess(session.role,"pos")&&<POSScreen products={products} filteredPOS={filteredPOS} cart={cart} posQ={posQ} setPosQ={setPosQ} payMethod={payMethod} setPayMethod={setPayMethod} payType={payType} setPayType={setPayType} cashIn={cashIn} setCashIn={setCashIn} initialPay={initialPay} setInitialPay={setInitialPay} clientName={clientName} setClientName={setClientName} selectedClientId={selectedClientId} setSelectedClientId={setSelectedClientId} saleNote={saleNote} setSaleNote={setSaleNote} cartTotal={cartTotal} vuelto={vuelto} initPaidVal={initPaidVal} addToCart={addToCart} changeQty={changeQty} removeFromCart={removeFromCart} applyDiscount={applyDiscount} checkout={checkout} resetPOS={resetPOS} flash={flash} clients={clients} accounts={accounts}/>}
          {view==="caja"     &&canAccess(session.role,"caja")&&<CajaScreen sales={sales} accounts={accounts} returns={returns} session={session}/>}
          {view==="accounts" &&canAccess(session.role,"accounts")&&<AccountsScreen accounts={accounts} pendingAccs={pendingAccs} totalPend={totalPend} addPayment={addPayment} showFlash={showFlash} products={products} session={session} clients={clients}/>}
          {view==="returns"  &&canAccess(session.role,"returns")&&<ReturnsScreen returns={returns} products={products} onProcess={processReturn} showFlash={showFlash} clients={clients} sales={sales}/>}
          {view==="defective"&&canAccess(session.role,"defective")&&<DefectiveScreen defectives={defectives} onUpdateStatus={updateDefectiveStatus} onReingress={reingresarDefective}/>}
          {view==="products" &&canAccess(session.role,"products")&&<ProductsScreen products={products} saveProduct={saveProduct} deleteProduct={deleteProduct} importProducts={importProducts}/>}
          {view==="inventory"&&canAccess(session.role,"inventory")&&<InventoryScreen products={products}/>}
          {view==="history"  &&canAccess(session.role,"history")&&<HistoryScreen sales={sales} selectedSale={selSale} setSelectedSale={setSelSale} accounts={accounts} returns={returns} products={products} session={session} clients={clients}/>}
          {view==="cuadres"  &&canAccess(session.role,"cuadres")&&<CuadresScreen sales={sales} accounts={accounts} returns={returns} products={products} repairs={repairs} session={session}/>}
          {view==="backup"   &&canAccess(session.role,"backup")&&<BackupScreen products={products} sales={sales} accounts={accounts} returns={returns} defectives={defectives} clients={clients} repairs={repairs} warranties={warranties} onExportJSON={exportJSON} onExportExcel={exportExcel}/>}
          {view==="users"    &&canAccess(session.role,"users")&&<UsersScreen session={session} showFlash={showFlash}/>}
          {view==="clients"  &&canAccess(session.role,"clients")&&<ClientsScreen clients={clients} sales={sales} accounts={accounts} returns={returns} saveClient={saveClient} session={session} showFlash={showFlash}/>}
          {view==="repairs"    &&canAccess(session.role,"repairs")&&<RepairsScreen repairs={repairs} clients={clients} products={products} saveRepair={saveRepair} updateRepairStatus={updateRepairStatus} onCobrar={cobrarReparacion} session={session} showFlash={showFlash} warranties={warranties} saveWarranty={saveWarranty}/>}
          {view==="warranties" &&canAccess(session.role,"warranties")&&<WarrantiesScreen warranties={warranties} sales={sales} repairs={repairs} updateWarranty={updateWarranty} saveWarranty={saveWarranty} session={session}/>}
          {view==="audit"      &&canAccess(session.role,"audit")&&<AuditScreen session={session}/>}
          {view==="suppliers"  &&canAccess(session.role,"suppliers")&&<SuppliersScreen products={products} session={session} showFlash={showFlash} onStockUpdate={function(){ productsAPI.getAll().then(function(p){ setProducts((p||[]).map(function(x){return Object.assign({},x,{price:Number(x.price),cost:Number(x.cost),stock:Number(x.stock)});})); }); }}/>}
          {view==="storeconfig"&&canAccess(session.role,"storeconfig")&&<StoreConfigScreen storeInfo={storeInfo} setStoreInfo={setStoreInfo} session={session} showFlash={showFlash}/>}
          {view==="ayuda"      &&canAccess(session.role,"ayuda")&&<AyudaScreen session={session}/>}
        </div>
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

function AuditScreen(props){
  var session=props.session;
  var _logs=useState([]); var logs=_logs[0]; var setLogs=_logs[1];
  var _loading=useState(true); var loading=_loading[0]; var setLoading=_loading[1];
  var _err=useState(""); var err=_err[0]; var setErr=_err[1];
  var _page=useState(1); var page=_page[0]; var setPage=_page[1];
  var _total=useState(0); var total=_total[0]; var setTotal=_total[1];
  var _entity=useState(""); var entity=_entity[0]; var setEntity=_entity[1];
  var _action=useState(""); var action=_action[0]; var setAction=_action[1];
  var _user=useState(""); var userFilter=_user[0]; var setUserFilter=_user[1];
  var _dateFrom=useState(""); var dateFrom=_dateFrom[0]; var setDateFrom=_dateFrom[1];
  var _dateTo=useState(""); var dateTo=_dateTo[0]; var setDateTo=_dateTo[1];
  var LIMIT=50;

  useEffect(function(){
    load(1);
  },[entity,action,userFilter,dateFrom,dateTo]);

  function clearFilters(){
    setEntity("");setAction("");setUserFilter("");setDateFrom("");setDateTo("");
  }

  async function load(p){
    setLoading(true);setErr("");
    try{
      var params={page:p,limit:LIMIT};
      if(entity)params.entity=entity;
      if(action)params.action=action;
      if(userFilter)params.user=userFilter;
      if(dateFrom)params.date_from=dateFrom;
      if(dateTo)params.date_to=dateTo;
      var res=await auditAPI.getAll(params);
      setLogs(res.data||[]);
      setTotal(res.total||0);
      setPage(p);
    }catch(e){
      setErr(e&&e.error?e.error:"Error cargando auditoría");
    }
    setLoading(false);
  }

  var totalPages=Math.max(1,Math.ceil(total/LIMIT));

  return(
    <div>
      <h2 style={H1}>🔍 Rastro de Auditoría</h2>
      <div style={Object.assign({},sC,{marginBottom:16})}>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
          <div style={{flex:"1 1 140px"}}>
            <label style={sL}>Tipo de registro</label>
            <select value={entity} onChange={function(e){setEntity(e.target.value);}} style={sI}>
              <option value="">Todos</option>
              <option value="sale">Ventas</option>
              <option value="account">Cuentas</option>
              <option value="product">Productos</option>
              <option value="user">Usuarios</option>
              <option value="client">Clientes</option>
              <option value="repair">Reparaciones</option>
              <option value="return">Devoluciones</option>
              <option value="defective">Defectuosos</option>
            </select>
          </div>
          <div style={{flex:"1 1 140px"}}>
            <label style={sL}>Acción</label>
            <select value={action} onChange={function(e){setAction(e.target.value);}} style={sI}>
              <option value="">Todas</option>
              {Object.keys(AUDIT_ACTIONS).map(function(k){return <option key={k} value={k}>{AUDIT_ACTIONS[k]}</option>;})}
            </select>
          </div>
          <div style={{flex:"1 1 130px"}}>
            <label style={sL}>Usuario</label>
            <input style={sI} placeholder="Nombre..." value={userFilter} onChange={function(e){setUserFilter(e.target.value);}}/>
          </div>
          <div style={{flex:"1 1 130px"}}>
            <label style={sL}>Desde</label>
            <input type="date" style={sI} value={dateFrom} onChange={function(e){setDateFrom(e.target.value);}}/>
          </div>
          <div style={{flex:"1 1 130px"}}>
            <label style={sL}>Hasta</label>
            <input type="date" style={sI} value={dateTo} onChange={function(e){setDateTo(e.target.value);}}/>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button style={mB("teal")} onClick={function(){load(1);}}>Buscar</button>
            {(entity||action||userFilter||dateFrom||dateTo)&&(
              <button style={mB("gray")} onClick={clearFilters}>Limpiar</button>
            )}
          </div>
        </div>
      </div>

      {err&&<div style={{background:"var(--bg-error,#FDECEA)",color:"var(--text-error,#791F1F)",padding:"10px 14px",borderRadius:8,marginBottom:12}}>{err}</div>}

      <div style={Object.assign({},sC,{padding:0,overflow:"hidden"})}>
        <div className="t-resp">
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr>
                {["#","Fecha/Hora","Usuario","Rol","Acción","Tipo","Detalles"].map(function(h){return <th key={h} style={h==="#"?Object.assign({},sTH,{width:40,textAlign:"center"}):sTH}>{h}</th>;})}
              </tr>
            </thead>
            <tbody>
              {loading&&<tr><td colSpan={7} style={{padding:24,textAlign:"center",color:"var(--text-secondary,#888)"}}>Cargando…</td></tr>}
              {!loading&&logs.length===0&&<tr><td colSpan={7} style={{padding:24,textAlign:"center",color:"var(--text-secondary,#888)"}}>Sin registros</td></tr>}
              {!loading&&logs.map(function(log,index){
                var c=AUDIT_COLORS[log.action]||"gray";
                var detail="";
                var detailNode=null;
                if(log.details){
                  var d=log.details;
                  // Acciones con texto simple
                  if(log.action==="venta_completada")detail=(d.cliente||d.client||"")+" — Q"+(Number(d.total||0).toFixed(2))+" — "+(d.metodo||d.method||"")+(d.articulos?" — "+d.articulos:"");
                  else if(log.action==="cuenta_creada")detail=(d.cliente||d.client||"")+" — Q"+(Number(d.total||0).toFixed(2))+(d.abono_inicial?" — Abono: Q"+Number(d.abono_inicial).toFixed(2):"")+(d.articulos?" — "+d.articulos:"");
                  else if(log.action==="abono_registrado")detail="Q"+(Number(d.amount||0).toFixed(2))+" ("+( d.method||"Efectivo")+") — Saldo: Q"+(Number(d.newBalance||0).toFixed(2))+" — "+( d.newStatus||"");
                  else if(log.action==="producto_creado")detail=(d.name||"")+" ["+( d.code||"")+"] — Q"+(Number(d.price||0).toFixed(2))+" — Stock: "+(d.stock||0);
                  else if(log.action==="producto_eliminado")detail=(d.nombre||"")+" ["+(d.codigo||"")+"]";
                  else if(log.action==="usuario_creado")detail=(d.name||"")+" — "+(d.email||"")+" — "+(d.role||"");
                  else if(log.action==="cliente_creado")detail=(d.nombre||"")+" ["+(d.codigo||"")+"]"+(d.telefono&&d.telefono!=="—"?" — Tel: "+d.telefono:"");
                  else if(log.action==="cliente_eliminado")detail=(d.nombre||"")+" ["+(d.codigo||"")+"]";
                  else if(log.action==="reparacion_creada")detail="["+(d.codigo||"")+"] "+(d.cliente||"")+" — "+(d.equipo||"")+" — "+(d.problema||"")+(d.tecnico&&d.tecnico!=="—"?" — Técnico: "+d.tecnico:"");
                  else if(log.action==="reparacion_eliminada")detail="["+(d.codigo||"")+"] "+(d.cliente||"")+" — "+(d.equipo||"");
                  else if(log.action==="devolucion_registrada")detail=(d.cliente||"")+" — Motivo: "+(d.motivo||"")+" — Condición: "+(d.condicion||"")+(d.reembolso_monto?" — Reembolso: Q"+Number(d.reembolso_monto).toFixed(2):"")+(d.articulos?" — "+d.articulos:"");
                  // Acciones con diff (antes → después)
                  else if(["producto_editado","usuario_editado","cliente_editado","reparacion_editada","reparacion_estado","defectuoso_estado"].includes(log.action)){
                    var nombre=d._producto||d._usuario||d._cliente||d._reparacion||d._articulo||"";
                    var cambios=Object.keys(d).filter(function(k){return k[0]!=="_"&&d[k]&&typeof d[k]==="object"&&d[k].antes!==undefined;});
                    if(cambios.length===0){detail=nombre||"Sin cambios";}
                    else{
                      detailNode=React.createElement("div",{style:{lineHeight:1.7}},
                        nombre?React.createElement("div",{style:{fontWeight:700,marginBottom:4,color:"var(--text-primary,#222)"}},nombre):null,
                        cambios.map(function(campo){
                          return React.createElement("div",{key:campo,style:{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}},
                            React.createElement("span",{style:{fontWeight:600,color:"var(--text-secondary,#666)",minWidth:90}},campo+":"),
                            React.createElement("span",{style:{background:"#FDECEA",color:"#791F1F",borderRadius:4,padding:"1px 6px",fontSize:11}},String(d[campo].antes)),
                            React.createElement("span",{style:{color:"var(--text-secondary,#999)"}},"→"),
                            React.createElement("span",{style:{background:"#EAF3DE",color:"#27500A",borderRadius:4,padding:"1px 6px",fontSize:11}},String(d[campo].despues))
                          );
                        })
                      );
                    }
                  }
                }
                return(
                  <tr key={log.id} style={{background:"var(--bg-row,transparent)"}}>
                    <td style={{...sTD,textAlign:"center",color:"#999",fontSize:12}}>{(page-1)*LIMIT+index+1}</td>
                    <td style={sTD}><div>{fmtD(log.created_at)}</div><div style={{fontSize:12,color:"var(--text-secondary,#888)"}}>{fmtT(log.created_at)}</div></td>
                    <td style={sTD}>{log.user_name||"—"}</td>
                    <td style={sTD}><span style={mBg(log.user_role==="admin"?"teal":log.user_role==="cajero"?"blue":"purple")}>{ROLE_LABEL[log.user_role]||log.user_role||"—"}</span></td>
                    <td style={sTD}><span style={mBg(c)}>{AUDIT_ACTIONS[log.action]||log.action}</span></td>
                    <td style={sTD}>{log.entity_type||"—"}</td>
                    <td style={Object.assign({},sTD,{maxWidth:320,fontSize:12,color:"var(--text-secondary,#666)"})}>{detailNode||(detail||JSON.stringify(log.details||{}).slice(0,100))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages>1&&(
          <div style={{display:"flex",justifyContent:"center",gap:8,padding:"12px 16px",borderTop:"1px solid var(--border-table,rgba(0,0,0,0.08))"}}>
            <button style={mB("gray")} disabled={page<=1} onClick={function(){load(page-1);}}>‹ Anterior</button>
            <span style={{alignSelf:"center",fontSize:13,color:"var(--text-secondary,#888)"}}>Pág. {page} / {totalPages} ({total} registros)</span>
            <button style={mB("gray")} disabled={page>=totalPages} onClick={function(){load(page+1);}}>Siguiente ›</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   MÓDULO REPARACIONES / ÓRDENES DE TRABAJO
   ══════════════════════════════════════════════════════════════════════ */
var REK = "mnpos-repairs-v1";
var REP_STATUS = {
  recibido:   {label:"Recibido",      color:"blue",  icon:"📥"},
  en_revision:{label:"En revisión",   color:"amber", icon:"🔧"},
  listo:      {label:"Listo",         color:"teal",  icon:"✅"},
  entregado:  {label:"Entregado",     color:"green", icon:"📦"},
};
var REP_BRANDS = ["Apple","Samsung","Xiaomi","Motorola","Huawei","LG","Sony","Oppo","Vivo","Nokia","Otro"];

function genRepCode(repairs){
  var n=(repairs||[]).length+1;
  return "REP-"+String(n).padStart(6,"0");
}

function printRepairTicket(rep){
  var _si=getStore(); var _sn=_si.store_name||STORE_FALLBACK;
  var statusInfo=REP_STATUS[rep.status]||{label:rep.status,icon:"•"};
  var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Orden '+rep.repCode+'</title>'+
  '<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:12px;color:#222;max-width:700px;margin:0 auto;padding:24px;}'+
  '.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1D9E75;padding-bottom:14px;margin-bottom:18px;}'+
  '.brand h1{font-size:20px;font-weight:900;color:#1a2535;}.brand p{font-size:10px;color:#1D9E75;font-weight:700;letter-spacing:2px;margin-top:2px;}'+
  '.rep-num .label{font-size:10px;color:#999;text-transform:uppercase;letter-spacing:1px;}.rep-num .num{font-size:22px;font-weight:900;color:#1D9E75;margin-top:2px;}'+
  '.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;padding:12px;background:#f8f9fa;border-radius:8px;border-left:4px solid #1D9E75;}'+
  '.block .lbl{font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;}.block .val{font-size:13px;font-weight:700;}.block .sub{font-size:11px;color:#666;margin-top:1px;}'+
  '.status-bar{background:#1a2535;color:#fff;padding:10px 16px;border-radius:8px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;}'+
  '.section{margin-bottom:14px;border:1px solid #eee;border-radius:8px;overflow:hidden;}'+
  '.section-title{background:#f0efeb;padding:8px 12px;font-weight:700;font-size:12px;color:#444;border-bottom:1px solid #eee;}'+
  '.section-body{padding:12px;}'+
  '.parts-table{width:100%;border-collapse:collapse;}.parts-table th{background:#1D9E75;color:#fff;padding:6px 8px;text-align:left;font-size:11px;}.parts-table td{padding:6px 8px;border-bottom:1px solid #eee;font-size:12px;}'+
  '.footer{border-top:2px dashed #ccc;padding-top:14px;margin-top:16px;display:flex;justify-content:space-between;font-size:11px;color:#999;}'+
  '.firma{margin-top:32px;border-top:1px solid #ccc;padding-top:8px;text-align:center;font-size:11px;color:#999;}'+
  '@media print{body{padding:12px;}}'+
  '</style></head><body>'+
  '<div class="header">'+
    '<div class="brand"><h1>'+_sn+'</h1><p>ORDEN DE TRABAJO</p></div>'+
    '<div style="display:flex;align-items:flex-start;gap:14px;">'+
'<div class="rep-num"><div class="label">N° Orden</div><div class="num">'+rep.repCode+'</div></div>'+
'<div style="text-align:center;margin-top:4px;">'+
'<div id="qrr" style="display:inline-block;"></div>'+
'<div style="font-size:9px;color:#999;margin-top:3px;">ESCANEAR</div>'+
'</div>'+
'</div>'+
  '</div>'+
  '<div class="status-bar"><span>Estado: <b>'+statusInfo.icon+' '+statusInfo.label+'</b></span><span>Registrada: '+new Date(rep.createdAt).toLocaleDateString("es-GT",{day:"2-digit",month:"short",year:"numeric"})+'</span>'+(rep.promisedDate?'<span>Entrega prometida: <b>'+new Date(rep.promisedDate+"T00:00:00").toLocaleDateString("es-GT",{day:"2-digit",month:"short",year:"numeric"})+'</b></span>':'')+
  '</div>'+
  '<div class="grid">'+
    '<div class="block"><div class="lbl">Cliente</div><div class="val">'+rep.clientName+'</div>'+(rep.clientPhone?'<div class="sub">Tel: '+rep.clientPhone+'</div>':'')+
    (rep.clientCli?'<div class="sub">'+rep.clientCli+'</div>':'')+'</div>'+
    '<div class="block"><div class="lbl">Dispositivo</div><div class="val">'+rep.brand+' '+rep.model+'</div>'+(rep.imei?'<div class="sub">IMEI: '+rep.imei+'</div>':'')+'</div>'+
    '<div class="block"><div class="lbl">Técnico asignado</div><div class="val">'+(rep.techName||'Sin asignar')+'</div></div>'+
    '<div class="block"><div class="lbl">Costo estimado</div><div class="val" style="color:#1D9E75;">Q '+(rep.estimatedCost?Number(rep.estimatedCost).toFixed(2):'Por definir')+'</div></div>'+
  '</div>'+
  '<div class="section"><div class="section-title">⚠️ Problema reportado por el cliente</div><div class="section-body">'+rep.problemDesc+'</div></div>'+
  (rep.diagnosis?'<div class="section"><div class="section-title">🔍 Diagnóstico técnico</div><div class="section-body">'+rep.diagnosis+'</div></div>':'')+
  (rep.parts&&rep.parts.length>0?'<div class="section"><div class="section-title">🔩 Repuestos utilizados</div><div class="section-body"><table class="parts-table"><thead><tr><th>Código</th><th>Repuesto</th><th>Cant.</th><th>Precio</th></tr></thead><tbody>'+
    rep.parts.map(function(p){return '<tr><td style="font-family:monospace;">'+p.code+'</td><td>'+p.name+'</td><td>'+p.qty+'</td><td>Q '+Number(p.price).toFixed(2)+'</td></tr>';}).join("")+
  '</tbody></table></div></div>':'')+
  (rep.internalNote?'<div class="section"><div class="section-title">📝 Nota interna</div><div class="section-body" style="color:#666;">'+rep.internalNote+'</div></div>':'')+
  '<div class="footer"><div><b>'+_sn+'</b> · Guatemala</div><div>Ref: '+rep.repCode+' · '+rep.id.slice(0,8).toUpperCase()+'</div></div>'+
  '<div class="firma">Firma del cliente: _____________________________ &nbsp;&nbsp;&nbsp; Fecha entrega: _______________</div>'+
  '</body></html>';
  var w=window.open("","_blank","width=800,height=700");
  var qrTxtR=_sn+' | Orden: '+rep.repCode+' | '+rep.clientName+' | '+rep.brand+' '+rep.model;
  w.document.write(html+'<scr'+'ipt src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></scr'+'ipt><scr'+'ipt>window.onload=function(){try{new QRCode(document.getElementById("qrr"),{text:'+JSON.stringify(qrTxtR)+',width:85,height:85,colorDark:"#1a2535",colorLight:"#fff"});}catch(e){}setTimeout(function(){window.print();},800);};</scr'+'ipt>');
  w.document.close();
}

function RepairsScreen(props){
  var repairs=props.repairs; var clients=props.clients||[]; var products=props.products||[];
  var saveRepair=props.saveRepair; var updateRepairStatus=props.updateRepairStatus;
  var session=props.session||{}; var showFlash=props.showFlash;
  var onCobrar=props.onCobrar||function(){};

  var _view=useState("list"); var repView=_view[0]; var setRepView=_view[1];
  var _sel=useState(null); var selRep=_sel[0]; var setSelRep=_sel[1];
  var _sf=useState(false); var showForm=_sf[0]; var setShowForm=_sf[1];
  var _fil=useState("activas"); var filter=_fil[0]; var setFilter=_fil[1];

  // Form state
  var _fn=useState(""); var fClientQ=_fn[0]; var setFClientQ=_fn[1];
  var _fci=useState(null); var fClientId=_fci[0]; var setFClientId=_fci[1];
  var _fcn=useState(""); var fClientName=_fcn[0]; var setFClientName=_fcn[1];
  var _fcp=useState(""); var fClientPhone=_fcp[0]; var setFClientPhone=_fcp[1];
  var _fb=useState(""); var fBrand=_fb[0]; var setFBrand=_fb[1];
  var _fm=useState(""); var fModel=_fm[0]; var setFModel=_fm[1];
  var _fi=useState(""); var fImei=_fi[0]; var setFImei=_fi[1];
  var _fp=useState(""); var fProblem=_fp[0]; var setFProblem=_fp[1];
  var _fd=useState(""); var fDiag=_fd[0]; var setFDiag=_fd[1];
  var _ft=useState(""); var fTech=_ft[0]; var setFTech=_ft[1];
  var _fc=useState(""); var fCost=_fc[0]; var setFCost=_fc[1];
  var _fdate=useState(""); var fDate=_fdate[0]; var setFDate=_fdate[1];
  var _fnote=useState(""); var fNote=_fnote[0]; var setFNote=_fnote[1];
  var _fparts=useState([]); var fParts=_fparts[0]; var setFParts=_fparts[1];
  var _ferr=useState(""); var fErr=_ferr[0]; var setFErr=_ferr[1];
  var _cdrop=useState(false); var showCliDrop=_cdrop[0]; var setShowCliDrop=_cdrop[1];
  var _pq=useState(""); var partQ=_pq[0]; var setPartQ=_pq[1];
  var _pshow=useState(false); var showPartPicker=_pshow[0]; var setShowPartPicker=_pshow[1];

  // Filtros de lista
  var filtered=repairs.filter(function(r){
    if(filter==="activas") return r.status!=="entregado";
    if(filter==="entregado") return r.status==="entregado";
    if(filter==="listo") return r.status==="listo";
    if(filter==="en_revision") return r.status==="en_revision";
    if(filter==="recibido") return r.status==="recibido";
    return true;
  });
  var repPag=usePaginator(filtered,15);

  var cliResults=fClientQ.trim().length>0?clients.filter(function(c){
    var q=fClientQ.toLowerCase();
    return (c.name||"").toLowerCase().includes(q)||(c.dpi||"").includes(fClientQ)||(c.cliCode||"").toLowerCase().includes(q)||(c.phone||"").includes(fClientQ);
  }).slice(0,5):[];

  function selectClient(c){
    setFClientId(c.id); setFClientName(c.name); setFClientPhone(c.phone||"");
    setFClientQ(c.name); setShowCliDrop(false);
  }

  function addPart(code){
    var p=products.find(function(x){return x.code===code.toUpperCase();});
    if(p){
      setFParts(function(prev){
        var ex=prev.find(function(x){return x.code===p.code;});
        if(ex) return prev.map(function(x){return x.code===p.code?Object.assign({},x,{qty:x.qty+1}):x;});
        return prev.concat([{code:p.code,name:p.name,price:p.price,qty:1}]);
      });
    }
  }
  function addPartObj(p){
    setFParts(function(prev){
      var ex=prev.find(function(x){return x.code===p.code;});
      if(ex) return prev.map(function(x){return x.code===p.code?Object.assign({},x,{qty:x.qty+1}):x;});
      return prev.concat([{code:p.code,name:p.name,price:p.price,qty:1}]);
    });
  }
  var partResults=products.filter(function(p){
    if(p.unit==="serv") return false;
    if(!partQ.trim()) return true;
    var ql=partQ.toLowerCase();
    return (p.name||"").toLowerCase().includes(ql)||(p.code||"").toLowerCase().includes(ql)||(p.category||"").toLowerCase().includes(ql);
  }).slice(0,30);

  function removePart(code){ setFParts(function(prev){return prev.filter(function(x){return x.code!==code;});}); }

  function resetForm(){
    setFClientQ("");setFClientId(null);setFClientName("");setFClientPhone("");
    setFBrand("");setFModel("");setFImei("");setFProblem("");setFDiag("");
    setFTech("");setFCost("");setFDate("");setFNote("");setFParts([]);setFErr("");
    setPartQ("");setShowPartPicker(false);
  }

  function closeForm(){
    resetForm();
    setShowForm(false);
  }

  function submitRepair(){
    if(!fClientName.trim()){setFErr("El nombre del cliente es obligatorio");return;}
    if(!fBrand.trim()||!fModel.trim()){setFErr("Marca y modelo del dispositivo son obligatorios");return;}
    if(!fProblem.trim()){setFErr("Describí el problema reportado");return;}
    var rep={
      id:gid(), repCode:genRepCode(repairs),
      clientId:fClientId||null, clientName:fClientName.trim(),
      clientPhone:fClientPhone.trim(), clientCli:fClientId?(clients.find(function(c){return c.id===fClientId;})||{}).cliCode||"":"",
      brand:fBrand.trim(), model:fModel.trim(), imei:fImei.trim(),
      problemDesc:fProblem.trim(), diagnosis:fDiag.trim(),
      techName:fTech.trim()||session.name, estimatedCost:parseFloat(fCost)||0,
      promisedDate:fDate||null, internalNote:fNote.trim(),
      parts:fParts, status:"recibido",
      createdAt:new Date().toISOString(),
      registradoPor:{userId:session.userId,name:session.name,role:session.role}
    };
    saveRepair(rep);
    showFlash("✓ Orden "+rep.repCode+" registrada","ok");
    closeForm();
  }

  // Vista detalle
  if(selRep){
    var rep=repairs.find(function(r){return r.id===selRep;});
    if(!rep){setSelRep(null);return null;}
    var statusInfo=REP_STATUS[rep.status]||{label:rep.status,icon:"•",color:"gray"};
    var nextStatus={recibido:"en_revision",en_revision:"listo",listo:"entregado"};
    var nextLabel={recibido:"🔧 Iniciar revisión",en_revision:"✅ Marcar como listo",listo:"📦 Marcar como entregado"};
    return (
      <div>
        <div style={{display:"flex",gap:10,marginBottom:16}}>
          <button style={mB("gray")} onClick={function(){setSelRep(null);}}>← Volver</button>
          <button style={mB("teal")} onClick={function(){printRepairTicket(rep);}}>🖨 Imprimir / PDF</button>
          {rep.status!=="entregado"&&<button style={mB("blue")} onClick={function(){updateRepairStatus(rep.id,nextStatus[rep.status]);showFlash("✓ Estado actualizado","ok");}}>
            {nextLabel[rep.status]}
          </button>}
          {(rep.status==="listo"||rep.status==="entregado")&&<button style={mB("teal")} onClick={function(){onCobrar(rep);setSelRep(null);}}>💰 Cobrar reparación</button>}
        </div>
        <div style={sC}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                <p style={{fontWeight:800,fontSize:20,margin:0,color:TEAL}}>{rep.repCode}</p>
                <span style={mBg(statusInfo.color)}>{statusInfo.icon} {statusInfo.label}</span>
              </div>
              <p style={{fontSize:13,color:"#666",margin:"0 0 2px"}}>Registrada: {fmtD(rep.createdAt)} {fmtT(rep.createdAt)}</p>
              {rep.registradoPor&&<p style={{fontSize:12,color:"#999",margin:0}}>Por: <b>{rep.registradoPor.name}</b></p>}
            </div>
            <div style={{textAlign:"right"}}>
              {rep.promisedDate&&<p style={{fontSize:12,color:"#666",margin:"0 0 4px"}}>Entrega prometida: <b>{new Date(rep.promisedDate+"T00:00:00").toLocaleDateString("es-GT",{day:"2-digit",month:"short",year:"numeric"})}</b></p>}
              <p style={{fontSize:22,fontWeight:700,color:TEAL,margin:0}}>Q {Number(rep.estimatedCost||0).toFixed(2)}</p>
            </div>
          </div>

          {/* Stepper de estado */}
          <div style={{display:"flex",gap:0,marginBottom:20,background:"#f5f4f0",borderRadius:10,overflow:"hidden"}}>
            {["recibido","en_revision","listo","entregado"].map(function(s,i){
              var info=REP_STATUS[s];
              var isDone=["recibido","en_revision","listo","entregado"].indexOf(rep.status)>=i;
              return <div key={s} style={{flex:1,padding:"10px 4px",textAlign:"center",background:isDone?TEAL:"transparent",color:isDone?"#fff":"#999",fontSize:11,fontWeight:isDone?700:400,borderRight:i<3?"1px solid rgba(255,255,255,0.2)":"none"}}>
                <div style={{fontSize:16}}>{info.icon}</div>
                <div style={{marginTop:2}}>{info.label}</div>
              </div>;
            })}
          </div>

          <div className="form-grid-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
            <div style={{background:"#f9f8f5",borderRadius:8,padding:14}}>
              <p style={{fontSize:11,color:"#999",textTransform:"uppercase",letterSpacing:"0.8px",margin:"0 0 8px"}}>Cliente</p>
              <p style={{fontWeight:700,fontSize:15,margin:"0 0 2px"}}>{rep.clientName}</p>
              {rep.clientPhone&&<p style={{fontSize:13,color:"#666",margin:"0 0 2px"}}>📞 {rep.clientPhone}</p>}
              {rep.clientCli&&<p style={{fontSize:12,color:TEAL,margin:0,fontFamily:"monospace"}}>{rep.clientCli}</p>}
            </div>
            <div style={{background:"#f9f8f5",borderRadius:8,padding:14}}>
              <p style={{fontSize:11,color:"#999",textTransform:"uppercase",letterSpacing:"0.8px",margin:"0 0 8px"}}>Dispositivo</p>
              <p style={{fontWeight:700,fontSize:15,margin:"0 0 2px"}}>{rep.brand} {rep.model}</p>
              {rep.imei&&<p style={{fontSize:12,color:"#666",margin:0,fontFamily:"monospace"}}>IMEI: {rep.imei}</p>}
            </div>
            <div style={{background:"#f9f8f5",borderRadius:8,padding:14}}>
              <p style={{fontSize:11,color:"#999",textTransform:"uppercase",letterSpacing:"0.8px",margin:"0 0 6px"}}>Técnico asignado</p>
              <p style={{fontWeight:600,fontSize:14,margin:0}}>{rep.techName||"Sin asignar"}</p>
            </div>
            <div style={{background:"#EAF3DE",borderRadius:8,padding:14}}>
              <p style={{fontSize:11,color:"#999",textTransform:"uppercase",letterSpacing:"0.8px",margin:"0 0 6px"}}>Costo estimado</p>
              <p style={{fontWeight:700,fontSize:18,color:TEAL,margin:0}}>Q {Number(rep.estimatedCost||0).toFixed(2)}</p>
            </div>
          </div>

          <div style={{marginBottom:12,background:"#FCEBEB",borderRadius:8,padding:"10px 14px",border:"1px solid #F09595"}}>
            <p style={{fontSize:11,color:"#999",textTransform:"uppercase",margin:"0 0 4px"}}>⚠️ Problema reportado</p>
            <p style={{fontSize:14,color:"#791F1F",margin:0,fontWeight:500}}>{rep.problemDesc}</p>
          </div>

          {rep.diagnosis&&<div style={{marginBottom:12,background:"#E6F1FB",borderRadius:8,padding:"10px 14px",border:"1px solid #a8ccee"}}>
            <p style={{fontSize:11,color:"#999",textTransform:"uppercase",margin:"0 0 4px"}}>🔍 Diagnóstico técnico</p>
            <p style={{fontSize:14,color:"#0C447C",margin:0}}>{rep.diagnosis}</p>
          </div>}

          {rep.parts&&rep.parts.length>0&&(
            <div style={{marginBottom:12}}>
              <p style={{fontWeight:600,margin:"0 0 8px",fontSize:13}}>🔩 Repuestos utilizados</p>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>{["Código","Repuesto","Cant.","Precio","Subtotal"].map(function(h){return <th key={h} style={sTH}>{h}</th>;})}</tr></thead>
                <tbody>
                  {rep.parts.map(function(p,i){return <tr key={i}>
                    <td style={Object.assign({},sTD,{fontFamily:"monospace",fontSize:12})}>{p.code}</td>
                    <td style={Object.assign({},sTD,{fontWeight:500})}>{p.name}</td>
                    <td style={sTD}>{p.qty}</td>
                    <td style={sTD}>Q {Number(p.price).toFixed(2)}</td>
                    <td style={Object.assign({},sTD,{fontWeight:700,color:TEAL})}>Q {Number(p.price*p.qty).toFixed(2)}</td>
                  </tr>;})}
                </tbody>
              </table>
            </div>
          )}

          {rep.internalNote&&<div style={{background:"#FFF8E1",borderRadius:8,padding:"10px 14px",border:"1px solid #FFD54F"}}>
            <p style={{fontSize:11,color:"#999",textTransform:"uppercase",margin:"0 0 4px"}}>📝 Nota interna</p>
            <p style={{fontSize:13,color:"#666",margin:0}}>{rep.internalNote}</p>
          </div>}
        </div>
      </div>
    );
  }

  // Métricas
  var totalActivas=repairs.filter(function(r){return r.status!=="entregado";}).length;
  var totalListas=repairs.filter(function(r){return r.status==="listo";}).length;
  var totalEntregadas=repairs.filter(function(r){return r.status==="entregado";}).length;

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <p style={Object.assign({},H1,{margin:0})}>🔧 Reparaciones<HelpTip text={"Gestión de equipos en taller.\n\nEstados del flujo:\n• Recibido → En revisión → Esperando repuesto → Listo → Entregado\n\nCada reparación lleva: cliente, equipo, problema, técnico asignado y costo. Al marcar 'Entregado' podés enviar el comprobante por WhatsApp al cliente."}/></p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {!showForm&&<>
            <button style={Object.assign({},mB("teal"),{padding:"6px 12px",fontSize:12})} onClick={function(){
              var cols=["Cliente","Equipo","Problema","Técnico","Estado","Costo","Fecha"];
              var rows=repairs.map(function(r){return[r.client_name||"",r.brand+" "+r.model,r.problem||"",r.tech||"",r.status||"","Q"+(r.cost||0).toFixed(2),fmtD(r.created_at||r.date)];});
              exportExcel(rows,cols,"reparaciones");
            }}>📊 Excel</button>
            <button style={Object.assign({},mB("blue"),{padding:"6px 12px",fontSize:12})} onClick={function(){
              var cols=["Cliente","Equipo","Problema","Técnico","Estado","Costo","Fecha"];
              var rows=repairs.map(function(r){return[r.client_name||"",r.brand+" "+r.model,r.problem||"",r.tech||"",r.status||"","Q"+(r.cost||0).toFixed(2),fmtD(r.created_at||r.date)];});
              exportPDF("Órdenes de Reparación",cols,rows,"reparaciones");
            }}>📄 PDF</button>
          </>}
          <button style={mB(showForm?"red":"teal")} onClick={function(){if(showForm){closeForm();}else{resetForm();setShowForm(true);}}}>{showForm?"✕ Cancelar":"+ Nueva orden"}</button>
        </div>
      </div>

      {/* FORMULARIO NUEVA ORDEN */}
      {showForm&&(
        <div style={Object.assign({},sC,{marginBottom:16,borderColor:TEAL,borderWidth:"1.5px"})}>
          <p style={{fontWeight:700,margin:"0 0 16px",fontSize:15}}>📋 Nueva Orden de Reparación</p>
          {fErr&&<p style={{color:"#E24B4A",fontSize:13,margin:"0 0 12px"}}>⚠ {fErr}</p>}

          {/* Cliente */}
          <p style={{fontWeight:600,fontSize:13,color:"#555",margin:"0 0 10px",borderBottom:"1px solid #eee",paddingBottom:6}}>👤 Datos del cliente</p>
          <div className="form-grid-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
            <div>
              <label style={sL}>Buscar cliente registrado</label>
              <div style={{position:"relative"}}>
                <input style={sI} value={fClientQ} placeholder="Nombre, DPI o código CLI..."
                  onChange={function(e){setFClientQ(e.target.value);setFClientName(e.target.value);setFClientId(null);setShowCliDrop(true);}}
                  onFocus={function(){setShowCliDrop(true);}}
                  onBlur={function(){setTimeout(function(){setShowCliDrop(false);},200);}}
                />
                {showCliDrop&&fClientQ.trim().length>0&&(
                  <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:"1px solid rgba(0,0,0,0.15)",borderRadius:8,boxShadow:"0 4px 12px rgba(0,0,0,0.1)",zIndex:100,marginTop:2}}>
                    {cliResults.map(function(c){return (
                      <div key={c.id} onMouseDown={function(){selectClient(c);}} style={{padding:"8px 12px",cursor:"pointer",borderBottom:"1px solid #f0f0f0",fontSize:13}}>
                        <b>{c.name}</b> <span style={{fontSize:11,color:"#999",fontFamily:"monospace"}}>{c.cliCode}{c.phone?" · "+c.phone:""}</span>
                      </div>
                    );})}
                    {cliResults.length===0&&<div style={{padding:"8px 12px",fontSize:12,color:"#999"}}>Sin resultados — podés escribir el nombre directamente</div>}
                  </div>
                )}
              </div>
              {fClientId&&<div style={{marginTop:4,fontSize:11,color:TEAL}}>✓ Cliente registrado vinculado</div>}
            </div>
            <div>
              <label style={sL}>Teléfono de contacto</label>
              <input style={sI} value={fClientPhone} placeholder="Ej: 55551234" onChange={function(e){setFClientPhone(e.target.value);}}/>
            </div>
          </div>

          {/* Dispositivo */}
          <p style={{fontWeight:600,fontSize:13,color:"#555",margin:"0 0 10px",borderBottom:"1px solid #eee",paddingBottom:6}}>📱 Dispositivo</p>
          <div className="form-grid-3" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:14}}>
            <div>
              <label style={sL}>Marca</label>
              <select style={sI} value={fBrand} onChange={function(e){setFErr("");setFBrand(e.target.value);}}>
                <option value="">— Seleccioná —</option>
                {REP_BRANDS.map(function(b){return <option key={b}>{b}</option>;})}
              </select>
            </div>
            <div>
              <label style={sL}>Modelo</label>
              <input style={sI} value={fModel} placeholder="Ej: iPhone 11, Galaxy A32..." onChange={function(e){setFErr("");setFModel(e.target.value);}}/>
            </div>
            <div>
              <label style={sL}>IMEI (opcional)</label>
              <input style={sI} value={fImei} placeholder="15 dígitos" onChange={function(e){setFImei(e.target.value);}}/>
            </div>
          </div>

          {/* Problema y diagnóstico */}
          <p style={{fontWeight:600,fontSize:13,color:"#555",margin:"0 0 10px",borderBottom:"1px solid #eee",paddingBottom:6}}>🔍 Problema y diagnóstico</p>
          <div className="form-grid-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
            <div>
              <label style={sL}>Problema reportado por el cliente *</label>
              <textarea style={Object.assign({},sI,{height:72,resize:"vertical"})} value={fProblem} placeholder="¿Qué le pasa al equipo según el cliente?"
                onChange={function(e){setFErr("");setFProblem(e.target.value);}}/>
            </div>
            <div>
              <label style={sL}>Diagnóstico técnico (opcional)</label>
              <textarea style={Object.assign({},sI,{height:72,resize:"vertical"})} value={fDiag} placeholder="Diagnóstico interno del técnico..."
                onChange={function(e){setFDiag(e.target.value);}}/>
            </div>
          </div>

          {/* Técnico, costo, fecha */}
          <p style={{fontWeight:600,fontSize:13,color:"#555",margin:"0 0 10px",borderBottom:"1px solid #eee",paddingBottom:6}}>⚙️ Asignación y costos</p>
          <div className="form-grid-3" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:14}}>
            <div>
              <label style={sL}>Técnico asignado</label>
              <input style={sI} value={fTech} placeholder={"Por defecto: "+session.name} onChange={function(e){setFTech(e.target.value);}}/>
            </div>
            <div>
              <label style={sL}>Costo estimado (Q)</label>
              <input type="number" style={sI} value={fCost} placeholder="0.00" onChange={function(e){setFCost(e.target.value);}}/>
            </div>
            <div>
              <label style={sL}>Fecha de entrega prometida</label>
              <input type="date" style={sI} value={fDate} onChange={function(e){setFDate(e.target.value);}}/>
            </div>
          </div>

          {/* Repuestos */}
          <p style={{fontWeight:600,fontSize:13,color:"#555",margin:"0 0 10px",borderBottom:"1px solid #eee",paddingBottom:6}}>🔩 Repuestos del inventario (opcional)</p>
          <div style={{marginBottom:14}}>
            {/* Buscador de productos */}
            <div style={{marginBottom:8,position:"relative"}}>
              <input style={Object.assign({},sI,{paddingRight:90})} placeholder="🔍 Buscar repuesto por nombre, código o categoría..."
                value={partQ}
                onChange={function(e){setPartQ(e.target.value);setShowPartPicker(true);}}
                onFocus={function(){setShowPartPicker(true);}}
                onBlur={function(){setTimeout(function(){setShowPartPicker(false);},200);}}
              />
              {partQ&&<span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:12,color:"#999",cursor:"pointer"}} onMouseDown={function(){setPartQ("");setShowPartPicker(false);}}>✕ limpiar</span>}
              {showPartPicker&&(
                <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:"1px solid rgba(0,0,0,0.15)",borderRadius:8,boxShadow:"0 6px 20px rgba(0,0,0,0.12)",zIndex:200,marginTop:2,maxHeight:240,overflowY:"auto"}}>
                  {partResults.length===0?<div style={{padding:"10px 14px",fontSize:13,color:"#999"}}>Sin productos en inventario</div>:
                  partResults.map(function(p){
                    var ya=fParts.find(function(x){return x.code===p.code;});
                    return (
                      <div key={p.code} onMouseDown={function(){addPartObj(p);setPartQ("");}} style={{padding:"9px 14px",cursor:"pointer",borderBottom:"1px solid #f0f0f0",display:"flex",justifyContent:"space-between",alignItems:"center",background:ya?"#F0FDF4":"#fff"}}>
                        <div>
                          <span style={{fontWeight:600,fontSize:13}}>{p.name}</span>
                          <span style={{fontSize:11,color:"#999",marginLeft:8,fontFamily:"monospace"}}>{p.code}</span>
                          {p.category&&<span style={{fontSize:11,color:"#aaa",marginLeft:6}}>{p.category}</span>}
                        </div>
                        <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
                          <div style={{fontSize:13,fontWeight:700,color:TEAL}}>Q {Number(p.price).toFixed(2)}</div>
                          <div style={{fontSize:11,color:p.stock>0?"#666":"#E24B4A"}}>Stock: {p.stock} {ya?"· ✓ ya agregado":""}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {/* Lista de repuestos agregados */}
            {fParts.length>0&&(
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>{["Código","Repuesto","Cant.","Precio",""].map(function(h){return <th key={h} style={sTH}>{h}</th>;})}</tr></thead>
                <tbody>
                  {fParts.map(function(p){return <tr key={p.code}>
                    <td style={Object.assign({},sTD,{fontFamily:"monospace",fontSize:12})}>{p.code}</td>
                    <td style={Object.assign({},sTD,{fontWeight:500})}>{p.name}</td>
                    <td style={sTD}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <button style={{border:"1px solid #ddd",borderRadius:4,width:22,height:22,cursor:"pointer",background:"#fff",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}} onMouseDown={function(e){e.preventDefault();setFParts(function(prev){return prev.map(function(x){return x.code===p.code&&x.qty>1?Object.assign({},x,{qty:x.qty-1}):x;});});}}>−</button>
                        <span style={{minWidth:20,textAlign:"center",fontWeight:600}}>{p.qty}</span>
                        <button style={{border:"1px solid #ddd",borderRadius:4,width:22,height:22,cursor:"pointer",background:"#fff",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}} onMouseDown={function(e){e.preventDefault();setFParts(function(prev){return prev.map(function(x){return x.code===p.code?Object.assign({},x,{qty:x.qty+1}):x;});});}}>+</button>
                      </div>
                    </td>
                    <td style={Object.assign({},sTD,{color:TEAL})}>Q {Number(p.price).toFixed(2)}</td>
                    <td style={sTD}><span onClick={function(){removePart(p.code);}} style={{cursor:"pointer",color:"#E24B4A",fontSize:16,padding:"0 4px"}}>×</span></td>
                  </tr>;})}
                </tbody>
              </table>
            )}
            {fParts.length===0&&<p style={{fontSize:12,color:"#bbb",margin:"8px 0 0"}}>No se han agregado repuestos aún.</p>}
          </div>

          {/* Nota interna */}
          <div style={{marginBottom:16}}>
            <label style={sL}>📝 Nota interna (no se imprime en el ticket del cliente)</label>
            <input style={sI} value={fNote} placeholder="Observaciones internas..." onChange={function(e){setFNote(e.target.value);}}/>
          </div>

          <div style={{display:"flex",gap:10}}>
            <button style={Object.assign({},mB("teal"),{padding:"10px 24px"})} onClick={submitRepair}>✓ Registrar orden</button>
            <button style={mB("gray")} onClick={closeForm}>Cancelar</button>
          </div>
        </div>
      )}

      {/* MÉTRICAS */}
      <div className="rg-4" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
        <MetricBox label="Activas" value={totalActivas} color="#378ADD"/>
        <MetricBox label="Listas para entregar" value={totalListas} color={TEAL}/>
        <MetricBox label="Entregadas" value={totalEntregadas} color="#666"/>
        <MetricBox label="Total órdenes" value={repairs.length} color="#7F77DD"/>
      </div>

      {/* FILTROS */}
      <div style={Object.assign({},sC,{marginBottom:14})}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {[["activas","Activas"],["recibido","📥 Recibidas"],["en_revision","🔧 En revisión"],["listo","✅ Listas"],["entregado","📦 Entregadas"],["todos","Todas"]].map(function(pair){
            return <button key={pair[0]} style={Object.assign({},mB(filter===pair[0]?"teal":"gray"),{padding:"6px 14px"})} onClick={function(){setFilter(pair[0]);}}>{pair[1]}</button>;
          })}
        </div>
      </div>

      {/* LISTA */}
      <div style={sC}>
        {filtered.length===0?<p style={{textAlign:"center",color:"#999",padding:40}}>Sin órdenes en esta categoría</p>:(
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["#","Orden","Cliente","Dispositivo","Técnico","Estado","Costo","Entrega",""].map(function(h){return <th key={h} style={h==="#"?Object.assign({},sTH,{width:40,textAlign:"center"}):sTH}>{h}</th>;})}</tr></thead>
            <tbody>
              {repPag.paged.slice().sort(function(a,b){return new Date(b.createdAt)-new Date(a.createdAt);}).map(function(r,index){
                var info=REP_STATUS[r.status]||{label:r.status,color:"gray"};
                var vencida=r.promisedDate&&r.status!=="entregado"&&new Date(r.promisedDate+"T23:59:59")<new Date();
                return (
                  <tr key={r.id} style={{cursor:"pointer"}} onClick={function(){setSelRep(r.id);}}>
                    <td style={{...sTD,textAlign:"center",color:"#999",fontSize:12}}>{repPag.offset+index+1}</td>
                    <td style={Object.assign({},sTD,{fontFamily:"monospace",fontSize:12,color:TEAL,fontWeight:700})}>{r.repCode}</td>
                    <td style={Object.assign({},sTD,{fontWeight:600})}>{r.clientName}{r.clientCli&&<div style={{fontSize:10,color:"#999",fontFamily:"monospace"}}>{r.clientCli}</div>}</td>
                    <td style={sTD}><div style={{fontWeight:500}}>{r.brand} {r.model}</div>{r.imei&&<div style={{fontSize:10,color:"#999",fontFamily:"monospace"}}>{r.imei}</div>}</td>
                    <td style={Object.assign({},sTD,{color:"#666"})}>{r.techName||"—"}</td>
                    <td style={sTD}><span style={mBg(info.color)}>{REP_STATUS[r.status]?REP_STATUS[r.status].icon+" "+REP_STATUS[r.status].label:r.status}</span></td>
                    <td style={Object.assign({},sTD,{fontWeight:600,color:TEAL})}>Q {Number(r.estimatedCost||0).toFixed(2)}</td>
                    <td style={sTD}>{r.promisedDate?<span style={{color:vencida?"#E24B4A":"inherit",fontWeight:vencida?700:400}}>{vencida?"⚠ ":""}{new Date(r.promisedDate+"T00:00:00").toLocaleDateString("es-GT",{day:"2-digit",month:"short"})}
                    </span>:"—"}</td>
                    <td style={Object.assign({},sTD,{color:"#999",fontSize:12})}>Ver →</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {filtered.length>0&&React.createElement(repPag.Pager)}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   MÓDULO CUADRES / REPORTES DE CIERRE
   ══════════════════════════════════════════════════════════════════════ */
function CuadresScreen(props){
  var sales=props.sales||[]; var accounts=props.accounts||[];
  var returns=props.returns||[]; var products=props.products||[];
  var repairs=props.repairs||[]; var session=props.session||{};

  var now=new Date();
  var _rng=useState("hoy"); var rango=_rng[0]; var setRango=_rng[1];
  var _df=useState(""); var dateFrom=_df[0]; var setDateFrom=_df[1];
  var _dt=useState(""); var dateTo=_dt[0]; var setDateTo=_dt[1];

  // Calcular fechas del rango
  function getRangeLabel(){
    if(rango==="hoy") return "Hoy — "+now.toLocaleDateString("es-GT",{day:"2-digit",month:"long",year:"numeric"});
    if(rango==="semana") return "Esta semana";
    if(rango==="quincenal") return "Últimos 15 días";
    if(rango==="mes") return now.toLocaleDateString("es-GT",{month:"long",year:"numeric"});
    if(rango==="mes_ant"){
      var d=new Date(now.getFullYear(),now.getMonth()-1,1);
      return d.toLocaleDateString("es-GT",{month:"long",year:"numeric"});
    }
    if(rango==="custom"&&dateFrom&&dateTo) return dateFrom+" al "+dateTo;
    return "Período seleccionado";
  }

  function inRange(dateStr){
    var d=new Date(dateStr);
    if(rango==="hoy") return d.toDateString()===now.toDateString();
    if(rango==="semana"){
      var wStart=new Date(now); wStart.setDate(now.getDate()-now.getDay());
      wStart.setHours(0,0,0,0); return d>=wStart&&d<=now;
    }
    if(rango==="quincenal"){
      var q15=new Date(now); q15.setDate(now.getDate()-15); q15.setHours(0,0,0,0);
      return d>=q15&&d<=now;
    }
    if(rango==="mes") return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
    if(rango==="mes_ant"){
      var pm=now.getMonth()===0?11:now.getMonth()-1;
      var py=now.getMonth()===0?now.getFullYear()-1:now.getFullYear();
      return d.getMonth()===pm&&d.getFullYear()===py;
    }
    if(rango==="custom"&&dateFrom&&dateTo){
      var from=new Date(dateFrom+"T00:00:00"); var to=new Date(dateTo+"T23:59:59");
      return d>=from&&d<=to;
    }
    return false;
  }

  // Ventas del período cobradas (para cuadre de caja)
  var periodSales=sales.filter(function(s){return inRange(s.date)&&s.status==='completado';});
  // Ventas a crédito del período (para resumen de ventas totales)
  var periodSalesCredito=sales.filter(function(s){return inRange(s.date)&&s.status==='cuenta';});
  var totalVentasCredito=periodSalesCredito.reduce(function(s,x){return s+x.total;},0);

  // Ingresos por método (ventas completas)
  var byMethod={Efectivo:0,Tarjeta:0,Transferencia:0,Mixto:0};
  periodSales.forEach(function(s){
    if(byMethod[s.method]!==undefined) byMethod[s.method]+=s.total;
    else byMethod["Transferencia"]+=s.total;
  });

  // Abonos cobrados en el período, desglosados por método
  var abonosPeriod=0, abonosEfectivo=0, abonosTarjeta=0, abonosTransferencia=0;
  accounts.forEach(function(a){
    (a.payments||[]).forEach(function(p){
      if(inRange(p.date)){
        var amt=Number(p.amount||0);
        abonosPeriod+=amt;
        if(p.method==="Efectivo") abonosEfectivo+=amt;
        else if(p.method==="Tarjeta") abonosTarjeta+=amt;
        else abonosTransferencia+=amt;
      }
    });
  });

  // Devoluciones del período
  var retsPeriod=returns.filter(function(r){return inRange(r.date);});
  var reembolsosPeriod=0, reembolsosEfectivo=0, reembolsosTarjeta=0, reembolsosTransferencia=0, reembolsosCreditoCuenta=0;
  retsPeriod.forEach(function(r){
    var amt=Number(r.refundAmount||0);
    if(amt<=0) return;
    reembolsosPeriod+=amt;
    if(r.refundMethod==="Efectivo")           reembolsosEfectivo+=amt;
    else if(r.refundMethod==="Tarjeta")       reembolsosTarjeta+=amt;
    else if(r.refundMethod==="Crédito en cuenta") reembolsosCreditoCuenta+=amt;
    else                                       reembolsosTransferencia+=amt;
  });
  // Devoluciones sin reembolso (solo cambio o sin dinero)
  var sinReembolso=retsPeriod.filter(function(r){return !r.refundAmount||r.refundAmount<=0||r.refundMethod==="Sin reembolso";}).length;
  // Reembolsos parciales: artículos devueltos donde lo reembolsado < total artículos
  var diferenciaReembolsos=retsPeriod.filter(function(r){return r.refundAmount>0&&r.total>r.refundAmount;}).reduce(function(s,r){return s+(r.total-r.refundAmount);},0);
  // Artículos defectuosos (no regresan a inventario)
  var retsDefectuosas=retsPeriod.filter(function(r){return r.itemCondition==="defectuoso";});

  // Totales netos
  var totalVentas=periodSales.reduce(function(s,x){return s+x.total;},0);
  // Reembolsos que salen de caja (no crédito en cuenta)
  var reembolsosCaja=reembolsosPeriod-reembolsosCreditoCuenta;
  // Neto efectivo: ventas efectivo + abonos efectivo - reembolsos efectivo
  var totalEfectivo=byMethod.Efectivo+abonosEfectivo-reembolsosEfectivo;
  // Total tarjeta neto
  var totalTarjeta=byMethod.Tarjeta+abonosTarjeta-reembolsosTarjeta;
  // Total transferencia neto
  var totalTransferencia=byMethod.Transferencia+abonosTransferencia-reembolsosTransferencia;
  // Total ingresado bruto
  var totalIngresosBruto=totalVentas+abonosPeriod;
  // Total ingresado neto (resta lo que realmente salió de caja)
  var totalIngresosNeto=totalIngresosBruto-reembolsosCaja;
  // Usar neto como valor principal del header
  var totalIngresos=totalIngresosNeto;

  // Costo y ganancia bruta — descuenta costo de artículos defectuosos devueltos
  var costoVentas=0;
  periodSales.forEach(function(s){
    (s.items||[]).forEach(function(it){
      var prod=products.find(function(p){return p.id===it.id||p.code===it.code;});
      if(prod&&prod.cost>0) costoVentas+=prod.cost*it.qty;
    });
  });
  // Recuperamos el costo de los artículos devueltos en buen estado (regresan a inventario)
  var costoRecuperado=0;
  retsPeriod.filter(function(r){return r.itemCondition!=="defectuoso";}).forEach(function(r){
    (r.items||[]).forEach(function(it){
      var prod=products.find(function(p){return p.code===it.code;});
      if(prod&&prod.cost>0) costoRecuperado+=prod.cost*it.qty;
    });
  });
  var gananciaBruta=totalVentas-reembolsosCaja-costoVentas+costoRecuperado;

  // Reparaciones activas
  var repActivas=repairs.filter(function(r){return r.status!=="entregado";}).length;
  var repListas=repairs.filter(function(r){return r.status==="listo";}).length;

  // Más vendidos del período (por unidades)
  var qtyMap={};
  periodSales.forEach(function(s){(s.items||[]).forEach(function(it){qtyMap[it.name]=(qtyMap[it.name]||0)+it.qty;});});
  var top5=Object.keys(qtyMap).map(function(k){return [k,qtyMap[k]];}).sort(function(a,b){return b[1]-a[1];}).slice(0,5);

  // Más rentables del período (por ganancia generada = (precio-costo)*qty)
  var profitMap={};
  periodSales.forEach(function(s){
    (s.items||[]).forEach(function(it){
      var prod=products.find(function(p){return p.id===it.id||p.code===it.code;});
      var cost=prod&&prod.cost>0?prod.cost:0;
      var profit=(Number(it.price||0)-cost)*Number(it.qty||0);
      if(!profitMap[it.name]) profitMap[it.name]={name:it.name,qty:0,revenue:0,profit:0};
      profitMap[it.name].qty+=Number(it.qty||0);
      profitMap[it.name].revenue+=Number(it.price||0)*Number(it.qty||0);
      profitMap[it.name].profit+=profit;
    });
  });
  var topProfitable=Object.values(profitMap).sort(function(a,b){return b.profit-a.profit;}).slice(0,5);
  var margenPct=costoVentas>0?Math.round((gananciaBruta/totalVentas)*100):null;

  function printCuadre(){
    var _si=getStore(); var _sn=_si.store_name||STORE_FALLBACK;
    var salesRows=periodSales.slice().sort(function(a,b){return new Date(b.date)-new Date(a.date);}).map(function(s){
      return '<tr><td>'+new Date(s.date).toLocaleDateString("es-GT",{day:"2-digit",month:"short"})+'</td>'+
        '<td>'+new Date(s.date).toLocaleTimeString("es-GT",{hour:"2-digit",minute:"2-digit"})+'</td>'+
        '<td>'+s.client+'</td>'+
        '<td>'+(s.items||[]).length+' art.</td>'+
        '<td><span style="background:#E1F5EE;color:#085041;padding:2px 8px;border-radius:12px;font-size:11px;">'+s.method+'</span></td>'+
        '<td style="text-align:right;font-weight:700;color:#1D9E75;">Q '+Number(s.total).toFixed(2)+'</td></tr>';
    }).join("");

    var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cuadre — '+_sn+'</title>'+
    '<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;font-size:12px;color:#222;padding:24px;max-width:900px;margin:0 auto;}'+
    '.header{border-bottom:3px solid #1D9E75;padding-bottom:14px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-start;}'+
    '.brand h1{font-size:20px;font-weight:900;color:#1a2535;}.brand p{font-size:10px;color:#1D9E75;font-weight:700;letter-spacing:2px;}'+
    '.period{text-align:right;}.period .lbl{font-size:10px;color:#999;text-transform:uppercase;}.period .val{font-size:16px;font-weight:700;color:#1D9E75;margin-top:2px;}'+
    '.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;}'+
    '.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;}'+
    '.metric{background:#f8f9fa;border-radius:8px;padding:12px;border-left:4px solid #1D9E75;}'+
    '.metric .lbl{font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;}'+
    '.metric .val{font-size:18px;font-weight:800;color:#1D9E75;}'+
    '.metric.red .val{color:#E24B4A;}.metric.gray .val{color:#444;}.metric.navy .val{color:#1a2535;}'+
    '.section{margin-bottom:20px;}'+
    '.section-title{font-size:13px;font-weight:700;color:#444;border-bottom:1px solid #eee;padding-bottom:6px;margin-bottom:12px;}'+
    'table{width:100%;border-collapse:collapse;}'+
    'thead th{background:#1a2535;color:#fff;padding:7px 10px;text-align:left;font-size:11px;font-weight:600;}'+
    'tbody tr:nth-child(even){background:#f9f9f9;}'+
    'td{padding:6px 10px;border-bottom:1px solid #eee;font-size:12px;}'+
    '.footer{border-top:2px dashed #ccc;padding-top:14px;margin-top:20px;display:flex;justify-content:space-between;font-size:11px;color:#999;}'+
    '@media print{body{padding:12px;}}'+
    '</style></head><body>'+
    '<div class="header">'+
      '<div class="brand"><h1>'+_sn+'</h1><p>CUADRE / REPORTE DE CIERRE</p></div>'+
      '<div class="period"><div class="lbl">Período</div><div class="val">'+getRangeLabel()+'</div>'+
        '<div style="font-size:11px;color:#999;margin-top:4px;">Generado por: '+session.name+' · '+(ROLE_LABEL[session.role]||session.role)+'</div>'+
      '</div>'+
    '</div>'+

    '<div class="section"><div class="section-title">📊 Resumen de ingresos</div>'+
    '<div class="grid4">'+
      '<div class="metric"><div class="lbl">Transacciones</div><div class="val">'+periodSales.length+'</div></div>'+
      '<div class="metric"><div class="lbl">Ventas brutas</div><div class="val">Q '+totalVentas.toFixed(2)+'</div></div>'+
      '<div class="metric"><div class="lbl">Abonos cobrados</div><div class="val">Q '+abonosPeriod.toFixed(2)+'</div></div>'+
      '<div class="metric" style="border-left-color:#2E7D32;"><div class="lbl">Ingresos netos</div><div class="val" style="color:#2E7D32;">Q '+totalIngresosNeto.toFixed(2)+'</div></div>'+
    '</div></div>'+

    '<div class="section"><div class="section-title">💵 Por método de pago (neto)</div>'+
    '<div class="grid3">'+
      '<div class="metric"><div class="lbl">Efectivo neto</div><div class="val">Q '+totalEfectivo.toFixed(2)+'</div>'+
        '<div style="font-size:10px;color:#999;margin-top:4px;">+ventas Q'+byMethod.Efectivo.toFixed(2)+' +abonos Q'+abonosEfectivo.toFixed(2)+' −reemb. Q'+reembolsosEfectivo.toFixed(2)+'</div></div>'+
      '<div class="metric navy"><div class="lbl">Tarjeta neto</div><div class="val">Q '+totalTarjeta.toFixed(2)+'</div>'+
        '<div style="font-size:10px;color:#999;margin-top:4px;">+ventas Q'+byMethod.Tarjeta.toFixed(2)+' +abonos Q'+abonosTarjeta.toFixed(2)+' −reemb. Q'+reembolsosTarjeta.toFixed(2)+'</div></div>'+
      '<div class="metric gray"><div class="lbl">Transferencia neto</div><div class="val">Q '+totalTransferencia.toFixed(2)+'</div>'+
        '<div style="font-size:10px;color:#999;margin-top:4px;">+ventas Q'+byMethod.Transferencia.toFixed(2)+' +abonos Q'+abonosTransferencia.toFixed(2)+' −reemb. Q'+reembolsosTransferencia.toFixed(2)+'</div></div>'+
    '</div></div>'+

    (costoVentas>0?'<div class="section"><div class="section-title">📉 Costos y ganancia bruta</div>'+
    '<div class="grid4">'+
      '<div class="metric"><div class="lbl">Ventas brutas</div><div class="val">Q '+totalVentas.toFixed(2)+'</div></div>'+
      '<div class="metric red"><div class="lbl">Costo productos</div><div class="val">Q '+costoVentas.toFixed(2)+'</div></div>'+
      '<div class="metric red"><div class="lbl">Reembolsos salida</div><div class="val">Q '+reembolsosCaja.toFixed(2)+'</div></div>'+
      '<div class="metric" style="border-left-color:#2E7D32;"><div class="lbl">Ganancia bruta</div><div class="val" style="color:#2E7D32;">Q '+gananciaBruta.toFixed(2)+'</div></div>'+
    '</div></div>':'')+

    (retsPeriod.length>0?'<div class="section"><div class="section-title">🔄 Devoluciones del período</div>'+
    '<div class="grid4">'+
      '<div class="metric red"><div class="lbl">Total reembolsado</div><div class="val">Q '+reembolsosPeriod.toFixed(2)+'</div></div>'+
      '<div class="metric red"><div class="lbl">Reemb. en efectivo</div><div class="val">Q '+reembolsosEfectivo.toFixed(2)+'</div></div>'+
      (reembolsosTarjeta>0?'<div class="metric red"><div class="lbl">Reemb. en tarjeta</div><div class="val">Q '+reembolsosTarjeta.toFixed(2)+'</div></div>':'')+
      (reembolsosCreditoCuenta>0?'<div class="metric gray"><div class="lbl">Crédito en cuenta</div><div class="val">Q '+reembolsosCreditoCuenta.toFixed(2)+'</div><div style="font-size:10px;color:#999;margin-top:3px;">Saldo a favor del cliente — no sale de caja</div></div>':'')+
      (diferenciaReembolsos>0?'<div class="metric" style="border-left-color:#F59E0B;"><div class="lbl">Reembolsos parciales (diferencia retenida)</div><div class="val" style="color:#D97706;">Q '+diferenciaReembolsos.toFixed(2)+'</div></div>':'')+
      (sinReembolso>0?'<div class="metric gray"><div class="lbl">Sin reembolso</div><div class="val">'+sinReembolso+'</div></div>':'')+
      '<div class="metric gray"><div class="lbl">Buen estado (reingresado)</div><div class="val">'+(retsPeriod.length-retsDefectuosas.length)+'</div></div>'+
      (retsDefectuosas.length>0?'<div class="metric red"><div class="lbl">Defectuosos (baja)</div><div class="val">'+retsDefectuosas.length+'</div></div>':'')+
    '</div></div>':'')+

    (top5.length>0?'<div class="section"><div class="section-title">🏆 Más vendidos del período</div>'+
    '<table><thead><tr><th>#</th><th>Producto</th><th>Unidades vendidas</th></tr></thead><tbody>'+
    top5.map(function(item,i){return '<tr><td>'+(i+1)+'</td><td>'+item[0]+'</td><td style="font-weight:700;color:#1D9E75;">'+item[1]+' uds</td></tr>';}).join("")+
    '</tbody></table></div>':'')+

    (periodSales.length>0?'<div class="section"><div class="section-title">📋 Detalle de ventas</div>'+
    '<table><thead><tr><th>Fecha</th><th>Hora</th><th>Cliente</th><th>Artículos</th><th>Método</th><th style="text-align:right;">Total</th></tr></thead>'+
    '<tbody>'+salesRows+'</tbody>'+
    '<tfoot><tr style="background:#1a2535;color:#fff;"><td colspan="5" style="padding:8px 10px;font-weight:700;">TOTAL DEL PERÍODO</td>'+
    '<td style="padding:8px 10px;text-align:right;font-weight:800;font-size:14px;">Q '+totalVentas.toFixed(2)+'</td></tr></tfoot>'+
    '</table></div>':
    '<div class="section" style="text-align:center;color:#999;padding:40px;">Sin ventas en el período seleccionado</div>')+

    '<div class="footer">'+
      '<div><b>'+(_sn||APP_NAME)+'</b> · '+APP_NAME+' v'+APP_VERSION+'</div>'+
      '<div>Impreso: '+now.toLocaleDateString("es-GT",{day:"2-digit",month:"short",year:"numeric"})+' '+now.toLocaleTimeString("es-GT",{hour:"2-digit",minute:"2-digit"})+'</div>'+
    '</div>'+
    '</body></html>';

    var w=window.open("","_blank","width=900,height=700");
    w.document.write(html); w.document.close();
    w.onload=function(){w.print();};
  }

  var rangos=[["hoy","Hoy"],["semana","Esta semana"],["quincenal","Últimos 15 días"],["mes","Este mes"],["mes_ant","Mes anterior"],["custom","Personalizado"]];

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <p style={H1}>📈 Cuadres y Reportes<HelpTip text={"Resumen financiero del negocio por período.\n\n• Ventas brutas: total cobrado en el período\n• Ingresos netos: ventas + abonos recibidos − reembolsos\n• Ganancia bruta: ingresos − costo de productos (solo si cargaste costos al inventario)\n• Antigüedad de cuentas: cuánto tiempo llevan pendientes los créditos\n\nPodés imprimir el cuadre o exportarlo a Excel desde aquí."}/></p>
        <button style={Object.assign({},mB("teal"),{padding:"10px 20px"})} onClick={printCuadre}>🖨 Imprimir / PDF</button>
      </div>

      {/* Selector de rango */}
      <div style={Object.assign({},sC,{marginBottom:16})}>
        <p style={{fontWeight:600,fontSize:13,margin:"0 0 12px",color:"#555"}}>📅 Período del cuadre</p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:rango==="custom"?12:0}}>
          {rangos.map(function(pair){
            return <button key={pair[0]} style={Object.assign({},mB(rango===pair[0]?"teal":"gray"),{padding:"7px 16px"})} onClick={function(){setRango(pair[0]);}}>{pair[1]}</button>;
          })}
        </div>
        {rango==="custom"&&(
          <div style={{display:"flex",gap:12,alignItems:"center",marginTop:10}}>
            <div><label style={sL}>Desde</label><input type="date" style={Object.assign({},sI,{width:160})} value={dateFrom} onChange={function(e){setDateFrom(e.target.value);}}/></div>
            <div><label style={sL}>Hasta</label><input type="date" style={Object.assign({},sI,{width:160})} value={dateTo} onChange={function(e){setDateTo(e.target.value);}}/></div>
          </div>
        )}
      </div>

      {/* Período activo */}
      <div style={{background:"linear-gradient(135deg,"+NAVY+" 0%,#1a3a2a 100%)",borderRadius:12,padding:"14px 20px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <p style={{color:"rgba(255,255,255,0.5)",fontSize:10,textTransform:"uppercase",letterSpacing:"1px",margin:0}}>Período activo</p>
          <p style={{color:"#fff",fontWeight:700,fontSize:16,margin:"2px 0 0"}}>{getRangeLabel()}</p>
        </div>
        <p style={{color:TEAL,fontSize:28,fontWeight:800,margin:0}}>Q {totalIngresos.toFixed(2)}</p>
      </div>

      {/* Métricas principales */}
      <div className="rg-4" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:16}}>
        <MetricBox label="Ventas totales" value={periodSales.length+periodSalesCredito.length} color="#378ADD"/>
        <MetricBox label="Cobrado (efectivo/tarjeta)" value={Q(totalVentas)} color={TEAL}/>
        <MetricBox label="Crédito otorgado" value={Q(totalVentasCredito)} color="#F59E0B"/>
        <MetricBox label="Abonos cobrados" value={Q(abonosPeriod)} color="#7F77DD"/>
      </div>

      {/* Por método */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:16}}>
        <div style={sC}>
          <p style={{fontSize:11,color:"#999",textTransform:"uppercase",margin:"0 0 8px"}}>💵 Efectivo neto</p>
          <p style={{fontSize:26,fontWeight:800,color:totalEfectivo>=0?TEAL:"#E24B4A",margin:0}}>Q {totalEfectivo.toFixed(2)}</p>
          <p style={{fontSize:11,color:"#999",margin:"4px 0 0"}}>Ventas Q{byMethod.Efectivo.toFixed(2)} + abonos Q{abonosEfectivo.toFixed(2)} − reemb. Q{reembolsosEfectivo.toFixed(2)}</p>
        </div>
        <div style={sC}>
          <p style={{fontSize:11,color:"#999",textTransform:"uppercase",margin:"0 0 8px"}}>💳 Tarjeta neto</p>
          <p style={{fontSize:26,fontWeight:800,color:"#378ADD",margin:0}}>Q {totalTarjeta.toFixed(2)}</p>
          <p style={{fontSize:11,color:"#999",margin:"4px 0 0"}}>Ventas Q{byMethod.Tarjeta.toFixed(2)} + abonos Q{abonosTarjeta.toFixed(2)} − reemb. Q{reembolsosTarjeta.toFixed(2)}</p>
        </div>
        <div style={sC}>
          <p style={{fontSize:11,color:"#999",textTransform:"uppercase",margin:"0 0 8px"}}>🏦 Transferencia neto</p>
          <p style={{fontSize:26,fontWeight:800,color:"#555",margin:0}}>Q {totalTransferencia.toFixed(2)}</p>
          <p style={{fontSize:11,color:"#999",margin:"4px 0 0"}}>Ventas Q{byMethod.Transferencia.toFixed(2)} + abonos Q{abonosTransferencia.toFixed(2)} − reemb. Q{reembolsosTransferencia.toFixed(2)}</p>
        </div>
        {costoVentas>0?(
          <div style={sC}>
            <p style={{fontSize:11,color:"#999",textTransform:"uppercase",margin:"0 0 10px"}}>📉 Ganancia bruta estimada</p>
            <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
              <div><p style={{fontSize:11,color:"#999",margin:"0 0 2px"}}>Ventas</p><p style={{fontWeight:700,color:TEAL}}>Q {totalVentas.toFixed(2)}</p></div>
              <span style={{color:"#E24B4A",fontSize:18}}>−</span>
              <div><p style={{fontSize:11,color:"#999",margin:"0 0 2px"}}>Costo</p><p style={{fontWeight:700,color:"#E24B4A"}}>Q {costoVentas.toFixed(2)}</p></div>
              <span style={{color:"#E24B4A",fontSize:18}}>−</span>
              <div><p style={{fontSize:11,color:"#999",margin:"0 0 2px"}}>Reembolsos</p><p style={{fontWeight:700,color:"#E24B4A"}}>Q {reembolsosCaja.toFixed(2)}</p></div>
              <span style={{color:"#2E7D32",fontSize:18}}>=</span>
              <div><p style={{fontSize:11,color:"#999",margin:"0 0 2px"}}>Ganancia</p><p style={{fontWeight:800,fontSize:18,color:"#2E7D32"}}>Q {gananciaBruta.toFixed(2)}</p></div>
            </div>
          </div>
        ):(
          <div style={sC}>
            <p style={{fontSize:11,color:"#999",textTransform:"uppercase",margin:"0 0 8px"}}>🔧 Reparaciones activas</p>
            <p style={{fontSize:26,fontWeight:800,color:"#378ADD",margin:0}}>{repActivas}</p>
            <p style={{fontSize:11,color:repListas>0?TEAL:"#999",margin:"4px 0 0"}}>{repListas>0?"✅ "+repListas+" listas para entregar":"Sin órdenes listas aún"}</p>
          </div>
        )}
        {retsPeriod.length>0&&(
          <div style={sC}>
            <p style={{fontSize:11,color:"#999",textTransform:"uppercase",margin:"0 0 10px"}}>🔄 Resumen devoluciones</p>
            <div style={{display:"flex",flexDirection:"column",gap:6,fontSize:13}}>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"#666"}}>Total devuelto</span><span style={{fontWeight:700,color:"#E24B4A"}}>Q {reembolsosPeriod.toFixed(2)}</span></div>
              {reembolsosCreditoCuenta>0&&<div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"#666"}}>Crédito en cuenta (no sale de caja)</span><span style={{fontWeight:700,color:"#F59E0B"}}>Q {reembolsosCreditoCuenta.toFixed(2)}</span></div>}
              {diferenciaReembolsos>0&&<div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"#666"}}>Reembolsos parciales — diferencia retenida</span><span style={{fontWeight:700,color:"#2E7D32"}}>Q {diferenciaReembolsos.toFixed(2)}</span></div>}
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"#666"}}>Artículos buen estado (reingresados)</span><span style={{fontWeight:700}}>{retsPeriod.length-retsDefectuosas.length}</span></div>
              {retsDefectuosas.length>0&&<div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"#666"}}>Artículos defectuosos (baja)</span><span style={{fontWeight:700,color:"#E24B4A"}}>{retsDefectuosas.length}</span></div>}
              {sinReembolso>0&&<div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"#666"}}>Sin reembolso</span><span style={{fontWeight:700,color:"#999"}}>{sinReembolso}</span></div>}
            </div>
          </div>
        )}
      </div>

      {/* Margen global */}
      {margenPct!==null&&<div style={{background:"linear-gradient(135deg,#0d6e4a 0%,#1D9E75 100%)",borderRadius:12,padding:"14px 20px",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <div>
          <p style={{color:"rgba(255,255,255,0.6)",fontSize:11,textTransform:"uppercase",letterSpacing:1,margin:0}}>Margen bruto del período</p>
          <p style={{color:"#fff",fontSize:13,margin:"4px 0 0"}}>Ventas <b>Q{totalVentas.toFixed(2)}</b> − Costo <b>Q{costoVentas.toFixed(2)}</b> − Reembolsos <b>Q{reembolsosCaja.toFixed(2)}</b></p>
        </div>
        <div style={{textAlign:"right"}}>
          <p style={{color:"#fff",fontWeight:800,fontSize:32,margin:0,lineHeight:1}}>{margenPct}%</p>
          <p style={{color:"rgba(255,255,255,0.7)",fontSize:12,margin:"2px 0 0"}}>Ganancia Q{gananciaBruta.toFixed(2)}</p>
        </div>
      </div>}

      {/* Top más vendidos + Top más rentables + Detalle */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <div style={sC}>
          <p style={{fontWeight:700,fontSize:14,margin:"0 0 12px",color:NAVY}}>🏆 Más vendidos <span style={{fontWeight:400,color:"#999",fontSize:12}}>(unidades)</span></p>
          {top5.length===0?<p style={{color:"#999",fontSize:13}}>Sin ventas en el período</p>:
            top5.map(function(item,i){return (
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid rgba(0,0,0,0.06)",fontSize:13}}>
                <span style={{color:"#666"}}><b style={{color:TEAL,marginRight:6}}>{i+1}.</b>{item[0]}</span>
                <span style={{fontWeight:700,color:TEAL,background:"#f0fdf8",padding:"2px 8px",borderRadius:6}}>{item[1]} uds</span>
              </div>
            );}
          )}
        </div>
        <div style={sC}>
          <p style={{fontWeight:700,fontSize:14,margin:"0 0 12px",color:NAVY}}>💰 Más rentables <span style={{fontWeight:400,color:"#999",fontSize:12}}>(ganancia Q)</span></p>
          {topProfitable.length===0?<p style={{color:"#999",fontSize:13}}>Sin datos de costo configurados</p>:
            topProfitable.map(function(item,i){
              var mg=item.revenue>0?Math.round((item.profit/item.revenue)*100):0;
              return (
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid rgba(0,0,0,0.06)",fontSize:13}}>
                  <span style={{color:"#666",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}><b style={{color:"#27AE60",marginRight:6}}>{i+1}.</b>{item.name}</span>
                  <div style={{textAlign:"right",flexShrink:0,marginLeft:8}}>
                    <span style={{fontWeight:700,color:"#27AE60"}}>Q{item.profit.toFixed(2)}</span>
                    <span style={{fontSize:11,color:"#999",marginLeft:6}}>{mg}%</span>
                  </div>
                </div>
              );
            })
          }
          {topProfitable.length===0&&costoVentas===0&&<p style={{fontSize:11,color:"#aaa",marginTop:8}}>Configurá el costo de los productos para ver este reporte.</p>}
        </div>
      </div>

      {/* Detalle ventas */}
      <div style={sC}>
        <p style={{fontWeight:600,fontSize:14,margin:"0 0 12px"}}>📋 Ventas del período <span style={{fontWeight:400,color:"#999",fontSize:12}}>({periodSales.length})</span></p>
        {periodSales.length===0?<p style={{color:"#999",fontSize:13,padding:"20px 0",textAlign:"center"}}>Sin ventas en el período seleccionado</p>:(
          <div style={{maxHeight:280,overflowY:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Fecha","Hora","Cliente","Método","Total"].map(function(h){return <th key={h} style={sTH}>{h}</th>;})}</tr></thead>
              <tbody>
                {periodSales.slice().sort(function(a,b){return new Date(b.date)-new Date(a.date);}).map(function(s){
                  return <tr key={s.id}>
                    <td style={sTD}>{fmtD(s.date)}</td>
                    <td style={sTD}>{fmtT(s.date)}</td>
                    <td style={Object.assign({},sTD,{fontWeight:500})}>{s.client}</td>
                    <td style={sTD}><span style={mBg("teal")}>{s.method}</span></td>
                    <td style={Object.assign({},sTD,{fontWeight:700,color:TEAL})}>{Q(s.total)}</td>
                  </tr>;
                })}
              </tbody>
            </table>
            <div style={{borderTop:"2px solid rgba(0,0,0,0.1)",marginTop:8,paddingTop:8,textAlign:"right",fontSize:14,fontWeight:700,color:TEAL}}>
              Total: {Q(totalVentas)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AppWrapper;
