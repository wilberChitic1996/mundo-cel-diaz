import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { db } from './utils/db.js';
import { authAPI, productsAPI, salesAPI, accountsAPI, returnsAPI, defectivesAPI, usersAPI, checkAPI, clientsAPI, repairsAPI } from './utils/api.js';

const TEAL = "#1D9E75";
const NAVY = "#1a2535";
const PK   = "mnpos-prods-v5";
const SK   = "mnpos-sales-v5";
const AK   = "mnpos-accounts-v2";
const RK   = "mnpos-returns-v2";
const DFK  = "mnpos-defective-v1";
const CK   = "mnpos-clients-v1";

const gid  = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
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
var H1  = {fontSize:22,fontWeight:600,margin:"0 0 20px",color:"var(--text-primary,#1a1a1a)"};

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
  admin:   ["dashboard","pos","caja","accounts","returns","defective","products","inventory","history","backup","users","clients","repairs","cuadres"],
  cajero:  ["dashboard","pos","caja","accounts","returns","history","clients","repairs"],
  auditor: ["dashboard","caja","history","inventory","cuadres"],
};
var ROLE_LABEL = { admin:"Administrador", cajero:"Cajero", auditor:"Auditor" };
var ROLE_COLOR = { admin:TEAL, cajero:"#378ADD", auditor:"#7F77DD" };

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

/* ── LoginScreen ── */
/* ── LoginScreen ── */
function LoginScreen(props) {
  var onLogin=props.onLogin;
  var _e=useState(""); var email=_e[0]; var setEmail=_e[1];
  var _p=useState(""); var pass=_p[0]; var setPass=_p[1];
  var _sp=useState(false); var showPass=_sp[0]; var setShowPass=_sp[1];
  var _l=useState(false); var loading=_l[0]; var setLoading=_l[1];
  var _er=useState(""); var err=_er[0]; var setErr=_er[1];
  var _at=useState(0); var attempts=_at[0]; var setAttempts=_at[1];
  var _bl=useState(false); var blocked=_bl[0]; var setBlocked=_bl[1];

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
      if(apiResp&&apiResp.user){
        setLoading(false);
        onLogin(createSession({id:apiResp.user.id,name:apiResp.user.name,email:apiResp.user.email,role:apiResp.user.role}));
        return;
      }
    } catch(e){ console.warn("API no disponible, intentando local:",e); }
    var users=await db.load(UK,[]);
    var user=(users||[]).find(function(u){return u.email.toLowerCase()===email.trim().toLowerCase()&&u.active;});
    if(!user){var na=attempts+1;setAttempts(na);if(na>=5){setBlocked(true);setErr("5 intentos fallidos — bloqueado 5 minutos.");setTimeout(function(){setBlocked(false);setAttempts(0);setErr("");},5*60*1000);}else{setErr("Email o contraseña incorrectos. Intentos: "+(5-na));}setLoading(false);return;}
    var hash=await hashPass(pass);
    if(hash!==user.passwordHash){var na2=attempts+1;setAttempts(na2);if(na2>=5){setBlocked(true);setErr("5 intentos fallidos — bloqueado 5 minutos.");setTimeout(function(){setBlocked(false);setAttempts(0);setErr("");},5*60*1000);}else{setErr("Contraseña incorrecta. Intentos restantes: "+(5-na2));}setLoading(false);return;}
    var updated=(users||[]).map(function(u){return u.id===user.id?Object.assign({},u,{lastLogin:new Date().toISOString()}):u;});
    await db.save(UK,updated);
    setLoading(false);
    onLogin(createSession(user));
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
            <p style={{color:"#fff",fontSize:26,fontWeight:800,margin:"0 0 4px",letterSpacing:"-0.5px"}}>MUNDO CEL DIAZ</p>
            <p style={{color:TEAL,fontSize:13,fontWeight:600,margin:0,letterSpacing:"1px"}}>SISTEMA DE GESTIÓN v2.1</p>
          </div>

          <div style={{background:"rgba(255,255,255,0.05)",borderRadius:16,border:"1px solid rgba(255,255,255,0.1)",padding:32}}>

            {/* ── MODO LOGIN ── */}
            {recMode==="login"&&(
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
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
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
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
          <MetricBox label="Total usuarios"  value={users.length} color={TEAL}/>
          <MetricBox label="Activos"         value={users.filter(function(u){return u.active;}).length} color="#378ADD"/>
          <MetricBox label="Administradores" value={users.filter(function(u){return u.role==="admin";}).length} color="#7F77DD"/>
        </div>
        <div style={sC}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["Nombre","Email","Rol","Estado","Seguridad","Último acceso",""].map(function(h){return <th key={h} style={sTH}>{h}</th>;})}</tr></thead>
            <tbody>
            {users.map(function(u){
              var isSelf=u.id===session.userId;
              return (
                  <tr key={u.id}>
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
        </div>
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
  --shadow: rgba(0,0,0,0.3);
}
`;

/* ── AppWrapper — controla autenticación ── */
function AppWrapper() {
  var _s=useState(function(){return getSession();}); var session=_s[0]; var setSession=_s[1];
  var _th=useState(function(){return localStorage.getItem("mnpos-theme")||"light";}); var theme=_th[0]; var setTheme=_th[1];
  var _sb=useState(false); var sidebarOpen=_sb[0]; var setSidebarOpen=_sb[1];

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
        await db.save(UK,[{id:gid(),name:"Administrador",email:"admin@mundoceldiaz.com",passwordHash:hash,role:"admin",active:true,createdAt:new Date().toISOString()}]);
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
      {!session
        ? <LoginScreen onLogin={function(s){setSession(s);}}/>
        : <App session={session} onLogout={function(){clearSession();setSession(null);}} theme={theme} toggleTheme={toggleTheme} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}/>
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
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:14}}>
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
  var view=props.view; var setView=props.setView;
  var cartLen=props.cartLen; var pendingLen=props.pendingLen;
  var products=props.products; var sales=props.sales;
  var session=props.session||{}; var onLogout=props.onLogout||function(){}; var isOnline=props.isOnline||false;
  var theme=props.theme||"light"; var toggleTheme=props.toggleTheme||function(){};
  var sidebarOpen=props.sidebarOpen||false; var setSidebarOpen=props.setSidebarOpen||function(){};
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
    {id:"cuadres",   ic:"📈", lb:"Cuadres"},
    {id:"backup",    ic:"💾", lb:"Respaldo"},
    {id:"users",     ic:"👥", lb:"Usuarios"},
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
                <p style={{color:"#fff",fontSize:15,fontWeight:800,margin:0,lineHeight:1.15,letterSpacing:"-0.2px"}}>MUNDO CEL</p>
                <p style={{color:TEAL,fontSize:13,fontWeight:800,margin:0,letterSpacing:"2px",textTransform:"uppercase"}}>DIAZ</p>
              </div>
            </div>
            <div style={{height:"1px",background:"linear-gradient(90deg,"+TEAL+"99,transparent)",marginBottom:8,position:"relative"}}/>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",position:"relative"}}>
              <p style={{color:"rgba(255,255,255,0.38)",fontSize:8.5,margin:0,letterSpacing:"1.2px",textTransform:"uppercase"}}>Reparaciones · Gestión</p>
              <p style={{color:"rgba(255,255,255,0.2)",fontSize:8,margin:0,letterSpacing:"0.5px"}}>v2.1</p>
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

/* ══════════════════════════════════════
   PANTALLAS — nivel módulo (estables)
   ══════════════════════════════════════ */

function DashboardScreen(props) {
  var sales=props.sales; var todaySales=props.todaySales;
  var pendingAccs=props.pendingAccs; var totalPend=props.totalPend;
  var products=props.products; var top5=props.top5;
  var setSelectedSale=props.setSelectedSale; var setView=props.setView;
  var accounts=props.accounts; var returns=props.returns;
  var repairs=props.repairs||[];

  var todayRev=todaySales.reduce(function(s,x){return s+x.total;},0);
  var todayStr=new Date().toDateString();

  var cajaDia=todaySales.filter(function(s){return s.method==="Efectivo";}).reduce(function(s,x){return s+x.total;},0);
  var returnsDia=returns.filter(function(r){return new Date(r.date).toDateString()===todayStr&&r.refundMethod==="Efectivo"&&r.refundAmount>0;}).reduce(function(s,r){return s+r.refundAmount;},0);
  var saldoCaja=cajaDia-returnsDia;

  // Reparaciones
  var repsActivas=repairs.filter(function(r){return r.status!=="entregado";});
  var repsListas=repairs.filter(function(r){return r.status==="listo";});
  var repsVencidas=repairs.filter(function(r){
    return r.status!=="entregado"&&r.promisedDate&&new Date(r.promisedDate+"T23:59:59")<new Date();
  });

  // Stock mínimo
  var stockAlertas=products.filter(function(p){
    return p.unit!=="serv"&&p.minStock>0&&p.stock<=p.minStock;
  });
  var stockCero=products.filter(function(p){return p.unit!=="serv"&&p.stock===0;});

  return (
      <div>
        <p style={H1}>📊 Panel de Control</p>

        {/* Alertas críticas arriba */}
        {(repsVencidas.length>0||stockCero.length>0)&&(
          <div style={{background:"#FCEBEB",border:"1px solid #F09595",borderRadius:10,padding:"12px 16px",marginBottom:16}}>
            <p style={{fontWeight:700,fontSize:13,color:"#791F1F",margin:"0 0 8px"}}>⚠ Atención requerida</p>
            <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
              {repsVencidas.length>0&&<span style={{fontSize:13,color:"#791F1F",cursor:"pointer"}} onClick={function(){setView("repairs");}}>🔧 {repsVencidas.length} reparación{repsVencidas.length>1?"es":""} vencida{repsVencidas.length>1?"s":""} sin entregar →</span>}
              {stockCero.length>0&&<span style={{fontSize:13,color:"#791F1F",cursor:"pointer"}} onClick={function(){setView("products");}}>📦 {stockCero.length} producto{stockCero.length>1?"s":""} sin stock →</span>}
            </div>
          </div>
        )}

        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:16}}>
          <MetricBox label="Ventas hoy"     value={todaySales.length}                  color={TEAL}/>
          <MetricBox label="Ingresos hoy"   value={Q(todayRev)}                        color="#378ADD"/>
          <MetricBox label="Saldo caja hoy" value={Q(saldoCaja)}                       color={saldoCaja>=0?"#1D9E75":"#E24B4A"}/>
          <MetricBox label="Por cobrar"     value={Q(totalPend)}                       color="#E24B4A"/>
        </div>

        {/* Reparaciones */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:16}}>
          <div onClick={function(){setView("repairs");}} style={Object.assign({},sC,{cursor:"pointer",borderLeft:"4px solid #378ADD"})}>
            <p style={{fontSize:12,color:"#666",margin:"0 0 6px"}}>🔧 Reparaciones activas</p>
            <p style={{fontSize:26,fontWeight:700,margin:0,color:"#378ADD"}}>{repsActivas.length}</p>
          </div>
          <div onClick={function(){setView("repairs");}} style={Object.assign({},sC,{cursor:"pointer",borderLeft:"4px solid "+TEAL})}>
            <p style={{fontSize:12,color:"#666",margin:"0 0 6px"}}>✅ Listas para entregar</p>
            <p style={{fontSize:26,fontWeight:700,margin:0,color:TEAL}}>{repsListas.length}</p>
            {repsListas.length>0&&<p style={{fontSize:11,color:TEAL,margin:"4px 0 0"}}>¡Notificá a los clientes!</p>}
          </div>
          <div onClick={function(){setView("products");}} style={Object.assign({},sC,{cursor:"pointer",borderLeft:"4px solid "+(stockAlertas.length>0?"#E65100":"#ccc")})}>
            <p style={{fontSize:12,color:"#666",margin:"0 0 6px"}}>📦 Stock bajo mínimo</p>
            <p style={{fontSize:26,fontWeight:700,margin:0,color:stockAlertas.length>0?"#E65100":"#999"}}>{stockAlertas.length}</p>
            {stockAlertas.length>0&&<p style={{fontSize:11,color:"#E65100",margin:"4px 0 0"}}>{stockAlertas.slice(0,2).map(function(p){return p.name;}).join(", ")}{stockAlertas.length>2?"...":""}</p>}
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:18}}>
          <div style={sC}>
            <p style={{fontWeight:600,margin:"0 0 14px",fontSize:15}}>🏆 Más vendidos</p>
            {top5.length===0?<p style={{color:"#999",fontSize:14}}>Sin ventas aún</p>:top5.map(function(item,i){
              return <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid rgba(0,0,0,0.06)",fontSize:14}}><span>{item[0]}</span><span style={{color:TEAL,fontWeight:600}}>{item[1]} uds</span></div>;
            })}
          </div>
          <div style={sC}>
            <p style={{fontWeight:600,margin:"0 0 10px",fontSize:15}}>💳 Pendientes de cobro</p>
            {pendingAccs.length===0?<p style={{color:TEAL,fontSize:14}}>✓ Sin cuentas pendientes</p>:pendingAccs.slice(0,5).map(function(a){
              return <div key={a.id} onClick={function(){setView("accounts");}} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid rgba(0,0,0,0.06)",fontSize:14,cursor:"pointer"}}><div><span style={{fontWeight:500}}>{a.client}</span><span style={{fontSize:11,color:"#999",marginLeft:6}}>{fmtD(a.date)}</span></div><span style={mBg(a.status==="parcial"?"amber":"red")}>{Q(a.balance)}</span></div>;
            })}
          </div>
        </div>
        {todaySales.length>0&&(
            <div style={sC}>
              <p style={{fontWeight:600,margin:"0 0 14px",fontSize:15}}>Ventas de hoy</p>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>{["Hora","Cliente","Artículos","Método","Total"].map(function(h){return <th key={h} style={sTH}>{h}</th>;})}</tr></thead>
                <tbody>
                {todaySales.slice(0,8).map(function(s){
                  return (
                      <tr key={s.id} style={{cursor:"pointer"}} onClick={function(){setSelectedSale(s);setView("history");}}>
                        <td style={sTD}>{fmtT(s.date)}</td>
                        <td style={Object.assign({},sTD,{fontWeight:500})}>{s.client}</td>
                        <td style={Object.assign({},sTD,{color:"#666"})}>{s.items.length} art.</td>
                        <td style={sTD}><span style={mBg("teal")}>{s.method}</span></td>
                        <td style={Object.assign({},sTD,{fontWeight:600,color:TEAL})}>{Q(s.total)}</td>
                      </tr>
                  );
                })}
                </tbody>
              </table>
            </div>
        )}
      </div>
  );
}

/* ── Caja ── */
function CajaScreen(props) {
  var sales=props.sales; var accounts=props.accounts; var returns=props.returns;
  var _p=useState("hoy"); var period=_p[0]; var setPeriod=_p[1];
  var now=new Date();
  var todayStr=now.toDateString();
  var weekMs=7*86400000;
  var monthStart=new Date(now.getFullYear(),now.getMonth(),1);

  function inPeriod(dateStr){
    var d=new Date(dateStr);
    if(period==="hoy")    return d.toDateString()===todayStr;
    if(period==="semana") return (now-d)<weekMs;
    if(period==="mes")    return d>=monthStart;
    return true;
  }

  var movements=[];

  sales.forEach(function(s){
    if(s.method==="Efectivo"&&inPeriod(s.date)){
      movements.push({id:s.id,date:s.date,desc:"Venta",detail:s.client,amount:s.total,type:"entrada",method:"Efectivo"});
    }
  });

  accounts.forEach(function(a){
    (a.payments||[]).forEach(function(p){
      if(p.method==="Efectivo"&&inPeriod(p.date)){
        movements.push({id:p.id,date:p.date,desc:"Abono cuenta",detail:a.client,amount:p.amount,type:"entrada",method:"Efectivo",note:p.note||""});
      }
    });
  });

  returns.forEach(function(r){
    if(r.refundMethod==="Efectivo"&&r.refundAmount>0&&inPeriod(r.date)){
      movements.push({id:r.id,date:r.date,desc:"Reembolso devolución",detail:r.client,amount:r.refundAmount,type:"salida",method:"Efectivo",note:r.reason});
    }
  });

  movements.sort(function(a,b){return new Date(b.date)-new Date(a.date);});

  var totalEntradas=movements.filter(function(m){return m.type==="entrada";}).reduce(function(s,m){return s+m.amount;},0);
  var totalSalidas=movements.filter(function(m){return m.type==="salida";}).reduce(function(s,m){return s+m.amount;},0);
  var saldo=totalEntradas-totalSalidas;

  var periods=[["hoy","Hoy"],["semana","Esta semana"],["mes","Este mes"],["todos","Todo"]];

  return (
      <div>
        <p style={H1}>💵 Caja</p>

        <div style={Object.assign({},sC,{marginBottom:14})}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {periods.map(function(pair){
              return <button key={pair[0]} style={Object.assign({},mB(period===pair[0]?"teal":"gray"),{padding:"6px 14px"})} onClick={function(){setPeriod(pair[0]);}}>{pair[1]}</button>;
            })}
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:22}}>
          <MetricBox label="Total entradas (efectivo)"  value={Q(totalEntradas)} color={TEAL}/>
          <MetricBox label="Total salidas (reembolsos)" value={Q(totalSalidas)}  color="#E24B4A"/>
          <MetricBox label="Saldo en caja"              value={Q(saldo)}          color={saldo>=0?TEAL:"#E24B4A"}/>
        </div>

        <div style={sC}>
          <p style={{fontWeight:600,margin:"0 0 14px",fontSize:15}}>Movimientos de efectivo</p>
          {movements.length===0
              ?<p style={{textAlign:"center",color:"#999",padding:32}}>Sin movimientos de efectivo en este período</p>
              :<table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                <tr>{["Fecha","Hora","Tipo","Cliente / Detalle","Nota","Monto"].map(function(h){return <th key={h} style={sTH}>{h}</th>;})}</tr>
                </thead>
                <tbody>
                {movements.map(function(m,i){
                  return (
                      <tr key={m.id+i}>
                        <td style={sTD}>{fmtD(m.date)}</td>
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
              <div style={{borderTop:"1px solid rgba(0,0,0,0.1)",marginTop:12,paddingTop:12,display:"flex",justifyContent:"flex-end",gap:32,fontSize:14}}>
                <span style={{color:TEAL}}>Entradas: <b>{Q(totalEntradas)}</b></span>
                <span style={{color:"#E24B4A"}}>Salidas: <b>{Q(totalSalidas)}</b></span>
                <span style={{fontWeight:700,color:saldo>=0?TEAL:"#E24B4A"}}>Saldo: <b>{Q(saldo)}</b></span>
              </div>
          )}
        </div>

        <div style={Object.assign({},sC,{marginTop:16,background:"#f9f8f5"})}>
          <p style={{fontWeight:600,fontSize:14,margin:"0 0 10px"}}>ℹ️ ¿Cómo se calcula la caja?</p>
          <div style={{fontSize:13,color:"#666",lineHeight:1.8}}>
            <p style={{margin:"0 0 4px"}}>✅ <b>Entradas:</b> ventas pagadas en efectivo + abonos de cuentas en efectivo</p>
            <p style={{margin:"0 0 4px"}}>❌ <b>Salidas:</b> reembolsos de devoluciones pagados en efectivo</p>
            <p style={{margin:0}}>💡 Ventas con tarjeta o transferencia <b>no afectan</b> la caja física</p>
          </div>
        </div>
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

  var FC={ok:"#EAF3DE",warn:"#FAEEDA"};
  var FT={ok:"#27500A",warn:"#633806"};
  var FB={ok:"#97C459",warn:"#EF9F27"};
  return (
      <div>
        <p style={H1}>🛒 Nueva Venta</p>
        {flash.msg&&<div style={{background:FC[flash.type]||FC.ok,border:"1px solid "+(FB[flash.type]||FB.ok),borderRadius:8,padding:"10px 16px",marginBottom:14,color:FT[flash.type]||FT.ok,fontSize:14}}>{flash.msg}</div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:18}}>
          <div style={sC}>
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
          <div style={Object.assign({},sC,{display:"flex",flexDirection:"column"})}>
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
  var totalPend=props.totalPend; var addPayment=props.addPayment; var showFlash=props.showFlash;
  var _f=useState("activas"); var filter=_f[0]; var setFilter=_f[1];
  var _s=useState(null); var selAcc=_s[0]; var setSelAcc=_s[1];
  var _a=useState(""); var pmtAmount=_a[0]; var setPmtAmount=_a[1];
  var _m=useState("Efectivo"); var pmtMethod=_m[0]; var setPmtMethod=_m[1];
  var _n=useState(""); var pmtNote=_n[0]; var setPmtNote=_n[1];
  var _r=useState(""); var pmtErr=_r[0]; var setPmtErr=_r[1];
  var totalCob=accounts.reduce(function(s,a){return s+a.paid;},0);
  var filtered=accounts.filter(function(a){
    if(filter==="todas")return true;
    if(filter==="activas")return a.status!=="pagado";
    return a.status===filter;
  });
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
    return (
        <div>
          <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center"}}><button style={mB("gray")} onClick={function(){setSelAcc(null);setPmtAmount("");setPmtNote("");setPmtErr("");}}>← Volver</button><button style={mB("teal")} onClick={function(){printVoucher(acc,{estado:acc.status==="pagado"?"pagado":acc.status==="parcial"?"parcial":"pendiente",pagado:acc.paid,saldo:acc.balance});}}>🖨 Imprimir constancia</button></div>
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
              {acc.items.map(function(it,i){
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
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
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
  return (
      <div>
        <p style={H1}>💳 Cuentas por Cobrar</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
          <MetricBox label="Total pendiente" value={Q(totalPend)}       color="#E24B4A"/>
          <MetricBox label="Total cobrado"   value={Q(totalCob)}        color={TEAL}/>
          <MetricBox label="Cuentas activas" value={pendingAccs.length} color="#378ADD"/>
        </div>
        <div style={Object.assign({},sC,{marginBottom:14})}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {[["activas","Activas"],["pendiente","Pendientes"],["parcial","Con abono"],["pagado","Pagadas"],["todas","Todas"]].map(function(pair){
              return <button key={pair[0]} style={Object.assign({},mB(filter===pair[0]?"teal":"gray"),{padding:"6px 14px"})} onClick={function(){setFilter(pair[0]);}}>{pair[1]}</button>;
            })}
          </div>
        </div>
        <div style={sC}>
          {filtered.length===0?<p style={{textAlign:"center",color:"#999",padding:40}}>Sin cuentas en esta categoría</p>:(
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>{["Fecha","Cliente","Total","Pagado","Saldo","Estado",""].map(function(h){return <th key={h} style={sTH}>{h}</th>;})}</tr></thead>
                <tbody>
                {filtered.map(function(a){
                  return (
                      <tr key={a.id} style={{cursor:"pointer"}} onClick={function(){setSelAcc(a.id);}}>
                        <td style={sTD}>{fmtD(a.date)}</td>
                        <td style={Object.assign({},sTD,{fontWeight:600})}>{a.client}</td>
                        <td style={sTD}>{Q(a.total)}</td>
                        <td style={Object.assign({},sTD,{color:TEAL,fontWeight:500})}>{Q(a.paid)}</td>
                        <td style={Object.assign({},sTD,{fontWeight:700,color:a.balance>0?"#E24B4A":TEAL})}>{Q(a.balance)}</td>
                        <td style={sTD}><span style={mBg(a.status==="pagado"?"green":a.status==="parcial"?"amber":"red")}>{a.status==="pagado"?"✓ Pagado":a.status==="parcial"?"Abono parcial":"Pendiente"}</span></td>
                        <td style={Object.assign({},sTD,{color:"#999",fontSize:12})}>Ver →</td>
                      </tr>
                  );
                })}
                </tbody>
              </table>
          )}
        </div>
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

  // Ventas del cliente seleccionado
  var cliSales=selCli?sales.filter(function(s){
    return s.clientId===selCli.id||(s.client===selCli.name&&!s.clientId);
  }).slice().sort(function(a,b){return new Date(b.date)-new Date(a.date);}):[];

  function pickClient(c){
    setSelCli(c);
    setCliQ(c.name);
    setShowDrop(false);
    setForm(function(f){return Object.assign({},f,{clientId:c.id,client:c.name});});
    setStep("sale");
  }

  function pickSale(s){
    setSelSale(s);
    // Pre-llenar items con los productos de esa venta
    var items=s.items.map(function(it){return {code:it.code,name:it.name,qty:it.qty,price:it.price};});
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
                    <thead><tr>{["Fecha","Artículos","Total","Método",""].map(function(h){return <th key={h} style={sTH}>{h}</th>;})}</tr></thead>
                    <tbody>
                      {cliSales.map(function(s){return (
                        <tr key={s.id} style={{cursor:"pointer"}} onClick={function(){pickSale(s);}}>
                          <td style={sTD}>{fmtD(s.date)} {fmtT(s.date)}</td>
                          <td style={Object.assign({},sTD,{color:"#666"})}>{s.items.length} art.</td>
                          <td style={Object.assign({},sTD,{fontWeight:700,color:TEAL})}>{Q(s.total)}</td>
                          <td style={sTD}><span style={mBg("teal")}>{s.method}</span></td>
                          <td style={Object.assign({},sTD,{color:TEAL,fontSize:12})}>Seleccionar →</td>
                        </tr>
                      );})}
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

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
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

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
        <MetricBox label="Total devoluciones"  value={returns.length}       color="#7F77DD"/>
        <MetricBox label="Total reembolsado"   value={Q(totalReembolsado)}  color="#E24B4A"/>
        <MetricBox label="Sin reembolso"       value={totalPendReemb}       color="#666"/>
      </div>

      <div style={sC}>
        {returns.length===0?<p style={{textAlign:"center",color:"#999",padding:40}}>Sin devoluciones registradas</p>:(
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["Fecha","Cliente","Motivo","Estado artículo","Reembolso","Monto reimb.","Valor artícs."].map(function(h){return <th key={h} style={sTH}>{h}</th>;})}</tr></thead>
            <tbody>
              {returns.map(function(r){
                var cond=r.itemCondition||"bueno";
                return (
                  <tr key={r.id}>
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
      </div>
    </div>
  );
}

/* ── Piezas Defectuosas ── */
function DefectiveScreen(props) {
  var defectives=props.defectives; var onUpdateStatus=props.onUpdateStatus; var onReingress=props.onReingress;
  var _f=useState("defectuoso"); var filter=_f[0]; var setFilter=_f[1];
  var filtered=defectives.filter(function(d){return filter==="todos"||d.status===filter;});
  var totalPiezas=defectives.filter(function(d){return d.status==="defectuoso";}).length;
  var totalDadas=defectives.filter(function(d){return d.status==="dado_de_baja";}).length;
  var totalReing=defectives.filter(function(d){return d.status==="reingresado";}).length;
  return (
      <div>
        <p style={H1}>🔩 Piezas Defectuosas</p>
        <p style={{fontSize:14,color:"#666",margin:"-12px 0 20px",lineHeight:1.6}}>Artículos retirados del inventario por devoluciones con daño. Podés darlos de baja definitivamente o repararlos y reingresarlos al stock.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
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
                <thead><tr>{["Fecha","Código","Pieza","Cant.","Precio","Motivo","Estado","Acciones"].map(function(h){return <th key={h} style={sTH}>{h}</th>;})}</tr></thead>
                <tbody>
                {filtered.map(function(d){
                  return (
                      <tr key={d.id}>
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
    return(!search||p.name.toLowerCase().includes(q)||p.code.toLowerCase().includes(q)||p.shelf.toLowerCase().includes(q))&&(cat==="Todas"||p.category===cat);
  }).sort(function(a,b){
    if(sort==="code")return a.code.localeCompare(b.code);
    if(sort==="stock")return a.stock-b.stock;
    if(sort==="price")return a.price-b.price;
    return a.name.localeCompare(b.name);
  });
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
            <input style={Object.assign({},sI,{width:240,flex:"none"})} placeholder="Buscar..." value={search} onChange={function(e){setSearch(e.target.value);}}/>
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
            <thead><tr>{["Código","Nombre","Categoría","Estantería","Precio","Costo","Margen","Stock",""].map(function(h){return <th key={h} style={sTH}>{h}</th>;})}</tr></thead>
            <tbody>
            {filtered.map(function(p){
              var mg=p.cost>0?Math.round((p.price-p.cost)/p.price*100):0;
              return (
                  <tr key={p.id}>
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
                        <button style={Object.assign({},mB("red"),{padding:"4px 10px",fontSize:12})} onClick={function(){if(window.confirm('¿Eliminar "'+p.name+'"? Esta acción no se puede deshacer.')){deleteProduct(p.id);}}}>🗑</button>
                      </div>
                    </td>
                  </tr>
              );
            })}
            {filtered.length===0&&<tr><td colSpan={9} style={Object.assign({},sTD,{textAlign:"center",color:"#999",padding:32})}>Sin resultados</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
  );
}

/* ── Inventario ── */
function InventoryScreen(props) {
  var products=props.products;
  var secs={};
  products.filter(function(p){return p.unit!=="serv";}).forEach(function(p){
    var s=p.shelf.split("-")[0];
    if(!secs[s])secs[s]=[];
    secs[s].push(p);
  });
  var total=products.filter(function(p){return p.unit!=="serv";}).reduce(function(s,p){return s+p.stock;},0);
  return (
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <p style={H1}>🗄️ Inventario</p>
          <div style={{background:"#f5f4f0",borderRadius:8,padding:"8px 14px",fontSize:13,color:"#666"}}>
            <b>{products.filter(function(p){return p.unit!=="serv";}).length}</b> productos · <b style={{color:TEAL}}>{total}</b> uds
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

/* ── Historial ── */
function printVoucher(sale, opts){
  opts=opts||{};
  var _E=opts.estado||'';
  var _sello='',_selloCss='';
  if(_E==='pendiente'){_sello='PENDIENTE DE PAGO';_selloCss='background:#FCEBEB;color:#791F1F;border:2px solid #E24B4A;';}
  else if(_E==='parcial'){_sello=(opts.abonoHoy!=null)?'CONSTANCIA DE ABONO':'ABONO - SALDO PENDIENTE';_selloCss='background:#FAEEDA;color:#633806;border:2px solid #E65100;';}
  else if(_E==='pagado'||_E==='cancelacion'){_sello=(opts.abonoHoy!=null)?'CANCELADO - ULTIMO ABONO':'CUENTA CANCELADA';_selloCss='background:#EAF3DE;color:#27500A;border:2px solid #2E7D32;';}
  var _docLabel=_E?'Comprobante de Cuenta':'Comprobante de Venta';
    var itemsHTML=sale.items.map(function(it){
      var hasDisc=it.originalPrice&&it.price<it.originalPrice;
      return '<tr>'+
        '<td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:12px;font-weight:600;">'+it.name+'<br><span style="font-family:monospace;font-size:10px;color:#888;">SKU: '+it.code+' &nbsp;·&nbsp; Estant.: '+(it.shelf||'—')+'</span>'+
        (hasDisc?'<br><span style="font-size:10px;color:#E65100;">Descuento aplicado por: '+it.discountBy+'</span>':'')+'</td>'+
        '<td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:center;font-size:12px;">'+it.qty+'</td>'+
        '<td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:right;font-size:12px;">'+
          (hasDisc?'<span style="text-decoration:line-through;color:#bbb;font-size:10px;">Q '+Number(it.originalPrice).toFixed(2)+'</span><br>':'')+
          '<span style="color:'+(hasDisc?'#E65100':'#333')+';">Q '+Number(it.price).toFixed(2)+'</span></td>'+
        '<td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:right;font-size:12px;font-weight:700;">Q '+Number(it.price*it.qty).toFixed(2)+'</td>'+
      '</tr>';
    }).join("");

    var subtotal=sale.items.reduce(function(s,it){return s+(it.originalPrice||it.price)*it.qty;},0);
    var totalDesc=subtotal-sale.total;
    var ventaNum=sale.id.toUpperCase().slice(-8);
    var fecha=new Date(sale.date).toLocaleDateString("es-GT",{day:"2-digit",month:"long",year:"numeric"});
    var hora=new Date(sale.date).toLocaleTimeString("es-GT",{hour:"2-digit",minute:"2-digit"});

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
        '<h1>MUNDO CEL DIAZ</h1>'+
        '<p>SISTEMA DE GESTIÓN</p>'+
        '<p class="sub">Reparación y Venta de Celulares · Guatemala</p>'+
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
        '<div class="val">'+(sale.registradoPor?sale.registradoPor.name:'—')+'</div>'+
        (sale.registradoPor?'<div class="val-sub">'+(sale.registradoPor.role==='admin'?'Administrador':sale.registradoPor.role==='cajero'?'Cajero':'Auditor')+'</div>':'')+
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
    '<div class="footer">'+
      '<div class="footer-left">'+
        '<strong>Mundo Cel Diaz</strong><br>'+
        'Guatemala, C.A.<br>'+
        'Sistema de Gestión v2.1'+
      '</div>'+
      '<div class="footer-right">'+
        'Cantidad de artículos: <strong>'+sale.items.reduce(function(s,i){return s+i.qty;},0)+'</strong><br>'+
        'Líneas de producto: <strong>'+sale.items.length+'</strong><br>'+
        'Ref: '+sale.id.slice(0,12).toUpperCase()+
      '</div>'+
    '</div>'+
    '<p class="gracias">¡Gracias por su preferencia!</p>'+

    '</body></html>';

    var w=window.open("","_blank","width=800,height=700");
    var qrTxt='MUNDO CEL DIAZ | #'+ventaNum+' | '+sale.client+' | '+fecha+' | Q'+Number(sale.total).toFixed(2);
    w.document.write(html+'<scr'+'ipt src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></scr'+'ipt><scr'+'ipt>window.onload=function(){try{new QRCode(document.getElementById("qrv"),{text:'+JSON.stringify(qrTxt)+',width:90,height:90,colorDark:"#1a2535",colorLight:"#fff"});}catch(e){}setTimeout(function(){window.print();},800);};</scr'+'ipt>');
    w.document.close();
  }


function HistoryScreen(props) {
  var sales=props.sales; var selectedSale=props.selectedSale; var setSelectedSale=props.setSelectedSale;

  if(selectedSale){
    return (
        <div>
          <div style={{display:"flex",gap:10,marginBottom:16}}>
            <button style={mB("gray")} onClick={function(){setSelectedSale(null);}}>← Volver</button>
            <button style={mB("teal")} onClick={function(){printVoucher(selectedSale);}}>🖨 Imprimir / PDF</button>
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
              {selectedSale.items.map(function(it,i){
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
  var wk=Date.now();
  var semana=sales.filter(function(s){return (wk-new Date(s.date).getTime())<7*86400000;});
  return (
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <p style={H1}>📋 Historial de Ventas</p>
          {sales.length>0&&<div style={{fontSize:13,color:"#666"}}>{semana.length} esta semana · {Q(semana.reduce(function(s,x){return s+x.total;},0))}</div>}
        </div>
        <div style={sC}>
          {sales.length===0?<p style={{textAlign:"center",color:"#999",padding:48}}>Sin ventas registradas</p>:(
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>{["Fecha","Hora","Cliente","Artículos","Método","Total","Atendió",""].map(function(h){return <th key={h} style={sTH}>{h}</th>;})}</tr></thead>
                <tbody>
                {sales.map(function(s){
                  return (
                      <tr key={s.id} style={{cursor:"pointer"}} onClick={function(){setSelectedSale(s);}}>
                        <td style={sTD}>{fmtD(s.date)}</td><td style={sTD}>{fmtT(s.date)}</td>
                        <td style={Object.assign({},sTD,{fontWeight:500})}>{s.client}</td>
                        <td style={Object.assign({},sTD,{color:"#666"})}>{s.items.length} art.</td>
                        <td style={sTD}><span style={mBg("teal")}>{s.method}</span></td>
                        <td style={Object.assign({},sTD,{fontWeight:700,color:TEAL})}>{Q(s.total)}</td>
                        <td style={Object.assign({},sTD,{fontSize:12,color:"#666"})}>{s.registradoPor?s.registradoPor.name:"—"}</td>
                        <td style={Object.assign({},sTD,{color:"#999",fontSize:12})}>Ver →</td>
                      </tr>
                  );
                })}
                </tbody>
              </table>
          )}
        </div>
      </div>
  );
}

/* ── Respaldo ── */
function BackupScreen(props) {
  var products=props.products; var sales=props.sales;
  var accounts=props.accounts; var returns=props.returns; var defectives=props.defectives;
  var onExportJSON=props.onExportJSON; var onExportExcel=props.onExportExcel; var onImport=props.onImport;
  var _m=useState(""); var msg=_m[0]; var setMsg=_m[1];
  var _i=useState(false); var importing=_i[0]; var setImporting=_i[1];
  var lastBackup=null; try{ lastBackup=JSON.parse(localStorage.getItem("mnpos-last-backup")); }catch(e){}
  var sizeKB=Math.round(JSON.stringify({products:products,sales:sales,accounts:accounts,returns:returns,defectives:defectives}).length/1024);
  var bm={ok:{bg:"#EAF3DE",border:"#97C459",color:"#27500A",text:"✓ Descargado correctamente"},imported:{bg:"#EAF3DE",border:"#97C459",color:"#27500A",text:"✓ Datos restaurados"},error:{bg:"#FCEBEB",border:"#F09595",color:"#791F1F",text:"✗ Archivo inválido"}}[msg];
  function doImport(file){
    if(!file)return;
    setImporting(true);
    var reader=new FileReader();
    reader.onload=function(e){
      var ok=onImport(e.target.result);
      setMsg(ok?"imported":"error");
      setImporting(false);
      setTimeout(function(){setMsg("");},4000);
    };
    reader.readAsText(file);
  }
  function doExportJSON(){ onExportJSON(); setMsg("ok"); setTimeout(function(){setMsg("");},3000); }
  return (
      <div>
        <p style={H1}>💾 Respaldo y Exportación</p>
        {bm&&<div style={{background:bm.bg,border:"1px solid "+bm.border,borderRadius:8,padding:"10px 16px",marginBottom:20,color:bm.color,fontSize:14,fontWeight:500}}>{bm.text}</div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:14,marginBottom:24}}>
          <MetricBox label="Productos"    value={products.length}                  color={TEAL}/>
          <MetricBox label="Clientes"     value={props.clients?props.clients.length:0}  color="#378ADD"/>
          <MetricBox label="Ventas"       value={sales.length}                     color="#7F77DD"/>
          <MetricBox label="Reparaciones" value={props.repairs?props.repairs.length:0}  color="#E65100"/>
          <MetricBox label="Defectuosas"  value={defectives.length}                color="#E24B4A"/>
          <MetricBox label="Tamaño data"  value={sizeKB+" KB"}                    color="#666"/>
        </div>
        <div style={Object.assign({},sC,{marginBottom:20,borderLeft:"4px solid "+TEAL})}>
          <p style={{fontWeight:700,fontSize:16,margin:"0 0 6px"}}>📊 Exportar a Excel (.xlsx)</p>
          <p style={{fontSize:13,color:"#666",margin:"0 0 10px",lineHeight:1.6}}>8 hojas: Resumen · Ventas · Detalle Ventas · Cuentas · Historial Pagos · Devoluciones · Piezas Defectuosas · Inventario.</p>
          <button style={Object.assign({},mB("teal"),{padding:"11px 28px",fontSize:14})} onClick={onExportExcel}>📊 Descargar Excel</button>
        </div>
        <div style={Object.assign({},sC,{marginBottom:20,borderLeft:"4px solid #378ADD"})}>
          <p style={{fontWeight:700,fontSize:16,margin:"0 0 6px"}}>💾 Respaldo completo (.json)</p>
          <p style={{fontSize:13,color:"#666",margin:"0 0 12px",lineHeight:1.6}}>Toda la base de datos incluyendo piezas defectuosas.</p>
          {lastBackup&&<p style={{fontSize:12,color:"#999",margin:"0 0 12px"}}>Último respaldo: {fmtD(lastBackup)} a las {fmtT(lastBackup)}</p>}
          <button style={Object.assign({},mB("blue"),{padding:"11px 28px",fontSize:14})} onClick={doExportJSON}>💾 Descargar .json</button>
        </div>
        <div style={Object.assign({},sC,{marginBottom:20,borderLeft:"4px solid #7F77DD"})}>
          <p style={{fontWeight:700,fontSize:16,margin:"0 0 6px"}}>📥 Restaurar desde respaldo</p>
          <div style={{background:"#FAEEDA",border:"1px solid #EF9F27",borderRadius:8,padding:"8px 14px",marginBottom:14,fontSize:13,color:"#633806"}}>⚠ Esto reemplaza los datos actuales.</div>
          <label style={{display:"inline-block",padding:"10px 22px",borderRadius:8,background:importing?"#ccc":"#7F77DD",color:"#fff",cursor:importing?"not-allowed":"pointer",fontSize:14,fontWeight:500}}>
            {importing?"Procesando...":"📂 Seleccionar archivo .json"}
            <input type="file" accept=".json" style={{display:"none"}} onChange={function(e){doImport(e.target.files[0]);}}/>
          </label>
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
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
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
                <span>{fmtD(a.date)} — {a.items.length} artículos</span>
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
        <p style={H1}>👥 Clientes</p>
        <button style={mB("teal")} onClick={function(){resetForm();setShowForm(true);}}>+ Nuevo cliente</button>
      </div>

      {showForm&&(
        <div style={Object.assign({},sC,{marginBottom:16,borderColor:TEAL,borderWidth:"1.5px"})}>
          <p style={{fontWeight:600,margin:"0 0 14px",fontSize:15}}>{editCli?"✏️ Editar cliente":"➕ Nuevo cliente"}</p>
          {fErr&&<div style={{background:"#FCEBEB",borderRadius:8,padding:"8px 14px",marginBottom:12,color:"#791F1F",fontSize:13}}>⚠ {fErr}</div>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
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

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
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
            <thead><tr>{["Código","Nombre","DPI","Teléfono","Compras","Deuda",""].map(function(h){return <th key={h} style={sTH}>{h}</th>;})}</tr></thead>
            <tbody>
              {filtered.map(function(c){
                var cliSalesCount=sales.filter(function(s){return s.clientId===c.id||(s.client===c.name&&!s.clientId);}).length;
                var cliDeuda=accounts.filter(function(a){return (a.clientId===c.id||(a.client===c.name&&!a.clientId))&&a.status!=="pagado";}).reduce(function(s,a){return s+a.balance;},0);
                var esFrecuente=cliSalesCount>=5||sales.filter(function(s){return s.clientId===c.id||(s.client===c.name&&!s.clientId);}).reduce(function(s,x){return s+x.total;},0)>=1000;
                return (
                  <tr key={c.id} style={{cursor:"pointer"}} onClick={function(){setSelCli(c.id);}}>
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
  var _ld=useState(false); var loaded=_ld[0]; var setLoaded=_ld[1];
  var _on=useState(false); var isOnline=_on[0]; var setIsOnline=_on[1];

  useEffect(function(){
    async function loadAll(){
      // Verificar si el backend esta disponible
      var online = await checkAPI();
      setIsOnline(online);

      if(online){
        // Modo online: cargar datos desde el API
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
          var normalProds = (prods||[]).map(function(p){return Object.assign({},p,{id:p.id,code:p.code,name:p.name,category:p.category||'',shelf:p.shelf||'',price:Number(p.price),cost:Number(p.cost),stock:Number(p.stock),unit:p.unit||'uni'});});
          var normalSales = (sls||[]).map(function(s){return Object.assign({},s,{items:s.sale_items||[],total:Number(s.total),date:s.created_at});});
          var normalAccs  = (accs||[]).map(function(a){return Object.assign({},a,{items:a.account_items||[],payments:a.account_payments||[],total:Number(a.total),paid:Number(a.paid),balance:Number(a.balance),date:a.created_at});});
          var normalRets  = (rets||[]).map(function(r){return Object.assign({},r,{items:r.return_items||[],refundAmount:Number(r.refund_amount),itemCondition:r.item_condition,refundMethod:r.refund_method,date:r.created_at});});
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
        } catch(e) {
          console.warn("Error cargando del API, usando local:", e);
          setIsOnline(false);
          var p2 = await db.load(PK, []);
          var s2 = await db.load(SK, []);
          var a2 = await db.load(AK, []);
          var r2 = await db.load(RK, []);
          var d2 = await db.load(DFK, []);
          setProducts(p2); setSales(s2); setAccounts(a2); setReturns(r2); setDefectives(d2);
        }
      } else {
        // Modo offline: cargar desde almacenamiento local
        var p = await db.load(PK, DEMO);
        var s = await db.load(SK, []);
        var a = await db.load(AK, []);
        var r = await db.load(RK, []);
        var d = await db.load(DFK, []);
        var cl = await db.load(CK, []);
        var rp = await db.load(REK, []);
        setProducts(p); setSales(s); setAccounts(a); setReturns(r); setDefectives(d); setClients(cl); setRepairs(rp);
      }
      setLoaded(true);
    }
    loadAll();
  },[]);

  // Guardar local solo en modo offline
  useEffect(function(){ if(loaded&&!isOnline) db.save(PK,products);    },[products,loaded,isOnline]);
  useEffect(function(){ if(loaded&&!isOnline) db.save(SK,sales);       },[sales,loaded,isOnline]);
  useEffect(function(){ if(loaded&&!isOnline) db.save(AK,accounts);    },[accounts,loaded,isOnline]);
  useEffect(function(){ if(loaded&&!isOnline) db.save(RK,returns);     },[returns,loaded,isOnline]);
  useEffect(function(){ if(loaded&&!isOnline) db.save(DFK,defectives); },[defectives,loaded,isOnline]);
  useEffect(function(){ if(loaded)            db.save(CK,clients);     },[clients,loaded]);
  useEffect(function(){ if(loaded)            db.save(REK,repairs);    },[repairs,loaded]);

  var _v=useState(function(){ return canAccess(session.role,"pos")?"pos":"dashboard"; }); var view=_v[0]; var setView=_v[1];
  var _fl=useState({msg:"",type:"ok"}); var flash=_fl[0]; var setFlash=_fl[1];
  var _ss=useState(null); var selSale=_ss[0]; var setSelSale=_ss[1];

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
    return p.name.toLowerCase().includes(q)||p.code.toLowerCase().includes(q)||p.shelf.toLowerCase().includes(q);
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

  async function checkout(){
    if(!cart.length)return;
    if(!clientName.trim()){showFlash("El nombre del cliente es obligatorio","err");return;}
    var client=clientName.trim();
    var items=cart.map(function(i){return {id:i.id,code:i.code,name:i.name,price:i.price,qty:i.qty,shelf:i.shelf,originalPrice:i.originalPrice||null,discountBy:i.discountBy||null,discountByRole:i.discountByRole||null,discountAt:i.discountAt||null};});
    var registradoPor={userId:session.userId,name:session.name,role:session.role};
    var base={id:gid(),date:new Date().toISOString(),client:client,clientId:selectedClientId||null,items:items,total:cartTotal,method:payMethod,registradoPor:registradoPor,nota:saleNote.trim()||null};
    function deduct(){ setProducts(function(p){return p.map(function(x){var ci=cart.find(function(i){return i.id===x.id;});return ci&&x.unit!=="serv"?Object.assign({},x,{stock:x.stock-ci.qty}):x;}); }); }
    if(payType==="completo"){
      if(isOnline){
        try {
          await salesAPI.create({client:client,total:cartTotal,method:payMethod,items:cart});
          var freshSales = await salesAPI.getAll();
          var ns = (freshSales||[]).map(function(s){return Object.assign({},s,{items:s.sale_items||[],total:Number(s.total),date:s.created_at});});
          setSales(ns);
        } catch(e){ console.warn("Error API venta:",e); setSales(function(p){return [Object.assign({},base)].concat(p);}); }
      } else {
        setSales(function(p){return [Object.assign({},base)].concat(p);});
      }
      deduct();
      showFlash("✓ Venta cobrada — "+Q(cartTotal),"ok");
    } else {
      var paid=payType==="parcial"?Math.min(initPaidVal,cartTotal):0;
      var balance=cartTotal-paid;
      var status=balance<=0?"pagado":paid>0?"parcial":"pendiente";
      var pmts=paid>0?[{id:gid(),date:new Date().toISOString(),amount:paid,method:payMethod,note:"Abono inicial",registradoPor:registradoPor}]:[];
      if(isOnline){
        try{
          await salesAPI.create({client:client,total:cartTotal,method:payMethod,items:cart,payType:payType,initialPay:paid});
          var freshAccs = await accountsAPI.getAll();
          var na=(freshAccs||[]).map(function(a){return Object.assign({},a,{items:a.account_items||[],payments:a.account_payments||[],total:Number(a.total),paid:Number(a.paid),balance:Number(a.balance),date:a.created_at});});
          setAccounts(na);
        }catch(e){
          console.warn("Error API cuenta:",e);
          setAccounts(function(p){return [Object.assign({},base,{paid:paid,balance:balance,status:status,payments:pmts})].concat(p);});
        }
      } else {
        setAccounts(function(p){return [Object.assign({},base,{paid:paid,balance:balance,status:status,payments:pmts})].concat(p);});
      }
      deduct();
      showFlash(payType==="pendiente"?"⏳ Pendiente — "+Q(cartTotal)+" por cobrar":"💰 Abono "+Q(paid)+" — Saldo: "+Q(balance),"warn");
    }
    resetPOS();
  }

  async function addPayment(accountId,amount,method,note){
    var registradoPor={userId:session.userId,name:session.name,role:session.role};
    if(isOnline){
      try{
        await accountsAPI.addPayment(accountId,{amount:amount,method:method||'Efectivo',note:note||''});
        var freshAccs2 = await accountsAPI.getAll();
        var na2=(freshAccs2||[]).map(function(a){return Object.assign({},a,{items:a.account_items||[],payments:a.account_payments||[],total:Number(a.total),paid:Number(a.paid),balance:Number(a.balance),date:a.created_at});});
        setAccounts(na2);
      }catch(e){
        console.warn("Error API addPayment:",e);
        var pmt2={id:gid(),date:new Date().toISOString(),amount:amount,method:method,note:note,registradoPor:registradoPor};
        setAccounts(function(prev){return prev.map(function(acc){
          if(acc.id!==accountId)return acc;
          var pmts=(acc.payments||[]).concat([pmt2]);
          var paid=pmts.reduce(function(s,p){return s+p.amount;},0);
          var balance=Math.max(0,acc.total-paid);
          var status=balance<=0?"pagado":paid>0?"parcial":"pendiente";
          return Object.assign({},acc,{payments:pmts,paid:paid,balance:balance,status:status});
        });});
      }
    } else {
      var pmtOff={id:gid(),date:new Date().toISOString(),amount:amount,method:method,note:note,registradoPor:registradoPor};
      setAccounts(function(prev){return prev.map(function(acc){
        if(acc.id!==accountId)return acc;
        var pmts=(acc.payments||[]).concat([pmtOff]);
        var paid=pmts.reduce(function(s,p){return s+p.amount;},0);
        var balance=Math.max(0,acc.total-paid);
        var status=balance<=0?"pagado":paid>0?"parcial":"pendiente";
        return Object.assign({},acc,{payments:pmts,paid:paid,balance:balance,status:status});
      });});
    }
    showFlash("✓ Pago registrado","ok");
  }

  async function processReturn(data){
    var total=data.items.reduce(function(s,i){return s+i.price*i.qty;},0);
    var newId=gid();
    var registradoPor={userId:session.userId,name:session.name,role:session.role};
    var ret=Object.assign({},data,{id:newId,date:new Date().toISOString(),total:total,registradoPor:registradoPor});

    if(isOnline){
      try{
        await returnsAPI.create({
          client:data.client,
          reason:data.reason,
          refundMethod:data.refundMethod,
          refundAmount:data.refundAmount,
          itemCondition:data.itemCondition,
          items:data.items
        });
        // Recargar returns, defectives y productos desde API
        var [freshRets, freshDefs, freshProds] = await Promise.all([
          returnsAPI.getAll(),
          defectivesAPI.getAll(),
          productsAPI.getAll(),
        ]);
        setReturns((freshRets||[]).map(function(r){return Object.assign({},r,{items:r.return_items||[],refundAmount:Number(r.refund_amount),itemCondition:r.item_condition,refundMethod:r.refund_method,date:r.created_at});}));
        setDefectives((freshDefs||[]).map(function(d){return Object.assign({},d,{price:Number(d.price||0)});}));
        setProducts((freshProds||[]).map(function(p){return Object.assign({},p,{price:Number(p.price),cost:Number(p.cost),stock:Number(p.stock)});}));
      }catch(e){
        console.warn("Error API return:",e);
        setReturns(function(p){return [ret].concat(p);});
        if(data.itemCondition==="bueno"){
          setProducts(function(p){return p.map(function(x){var ri=data.items.find(function(i){return i.code===x.code;});return ri&&x.unit!=="serv"?Object.assign({},x,{stock:x.stock+ri.qty}):x;});});
        } else {
          setDefectives(function(p){return data.items.map(function(item){return {id:gid(),date:new Date().toISOString(),returnId:newId,code:item.code,name:item.name,qty:item.qty,price:item.price,reason:data.reason,status:"defectuoso"};}).concat(p);});
        }
      }
    } else {
      setReturns(function(p){return [ret].concat(p);});
      if(data.itemCondition==="bueno"){
        setProducts(function(p){return p.map(function(x){var ri=data.items.find(function(i){return i.code===x.code;});return ri&&x.unit!=="serv"?Object.assign({},x,{stock:x.stock+ri.qty}):x;});});
      } else {
        setDefectives(function(p){return data.items.map(function(item){return {id:gid(),date:new Date().toISOString(),returnId:newId,code:item.code,name:item.name,qty:item.qty,price:item.price,reason:data.reason,status:"defectuoso"};}).concat(p);});
      }
    }
    var msg=data.itemCondition==="bueno"
        ?"🔄 Devolución registrada — artículo reintegrado al stock"
        :"🔄 Devolución registrada — artículo enviado a Piezas Defectuosas";
    showFlash(msg,"ok");
  }

  async function updateDefectiveStatus(id,status){
    if(isOnline){
      try{
        await defectivesAPI.update(id,status);
        var freshDefs = await defectivesAPI.getAll();
        setDefectives((freshDefs||[]).map(function(d){return Object.assign({},d,{price:Number(d.price||0)});}));
        if(status==="reingresado"){
          var freshProds2 = await productsAPI.getAll();
          setProducts((freshProds2||[]).map(function(p){return Object.assign({},p,{price:Number(p.price),cost:Number(p.cost),stock:Number(p.stock)});}));
        }
      }catch(e){
        console.warn("Error API defective:",e);
        setDefectives(function(p){return p.map(function(d){return d.id===id?Object.assign({},d,{status:status}):d;});});
      }
    } else {
      setDefectives(function(p){return p.map(function(d){return d.id===id?Object.assign({},d,{status:status}):d;});});
    }
  }

  async function reingresarDefective(id){
    await updateDefectiveStatus(id,'reingresado');
    showFlash("✅ Pieza reingresada al inventario","ok");
  }
  async function saveProduct(prod){
    var isNew=!prod.id;
    if(!isNew&&isOnline){
      try{
        await productsAPI.update(prod.id,{code:prod.code,name:prod.name,category:prod.category||'',shelf:prod.shelf||'',price:prod.price,cost:prod.cost||0,stock:prod.stock||0,unit:prod.unit||'uni'});
        setProducts(function(p){return p.map(function(x){return x.id===prod.id?prod:x;});});
      }catch(e){
        console.warn("Error API updateProduct:",e);
        setProducts(function(p){return p.map(function(x){return x.id===prod.id?prod:x;});});
      }
    } else if(isNew&&isOnline){
      try{
        var saved=await productsAPI.create({code:prod.code,name:prod.name,category:prod.category||'',shelf:prod.shelf||'',price:prod.price,cost:prod.cost||0,stock:prod.stock||0,unit:prod.unit||'uni'});
        setProducts(function(p){return p.concat([Object.assign({},prod,{id:saved.id})]);});
      }catch(e){
        console.warn("Error API createProduct:",e);
        setProducts(function(p){return p.concat([Object.assign({},prod,{id:gid()})]);});
      }
    } else {
      if(prod.id) setProducts(function(p){return p.map(function(x){return x.id===prod.id?prod:x;});});
      else setProducts(function(p){return p.concat([Object.assign({},prod,{id:gid()})]);});
    }
  }
  async function deleteProduct(id){
    if(isOnline){
      try{ await productsAPI.remove(id); }
      catch(e){ console.warn("Error API deleteProduct:",e); }
    }
    setProducts(function(p){return p.filter(function(x){return x.id!==id;});});
    showFlash("Producto eliminado","ok");
  }

  async function importProducts(prods, callback){
    var count=0; var errors=0;
    for(var i=0;i<prods.length;i++){
      var prod=prods[i];
      try{
        if(isOnline){
          var saved=await productsAPI.create({
            name:prod.name,category:prod.category||"",shelf:prod.shelf||"",
            price:prod.price,cost:prod.cost||0,stock:prod.stock||0,
            unit:prod.unit||"uni"
          });
          setProducts(function(p){return p.concat([Object.assign({},prod,{id:saved.id,code:saved.code})]);});
        } else {
          setProducts(function(p){return p.concat([Object.assign({},prod,{id:gid(),code:"P"+(p.length+1).toString().padStart(3,"0")})]);});
        }
        count++;
      } catch(e){
        console.warn("Error importando:",prod.name,e);
        errors++;
      }
    }
    if(callback) callback(errors===0,count);
    showFlash("✅ "+count+" productos importados"+(errors>0?" ("+errors+" con error)":""),"ok");
  }

  async function saveRepair(rep){
    if(isOnline){
      try{
        await repairsAPI.create({id:rep.id,repCode:rep.repCode,clientId:rep.clientId||null,clientName:rep.clientName,clientPhone:rep.clientPhone||null,clientCli:rep.clientCli||null,brand:rep.brand,model:rep.model,imei:rep.imei||null,problemDesc:rep.problemDesc,diagnosis:rep.diagnosis||null,techName:rep.techName||null,estimatedCost:rep.estimatedCost||0,promisedDate:rep.promisedDate||null,internalNote:rep.internalNote||null,status:rep.status||'recibido',registradoPor:rep.registradoPor||{},parts:rep.parts||[],createdAt:rep.createdAt});
        var fr=await repairsAPI.getAll();
        setRepairs((fr||[]).map(function(r){return Object.assign({},r,{repCode:r.rep_code,clientId:r.client_id,clientName:r.client_name,clientPhone:r.client_phone,clientCli:r.client_cli,problemDesc:r.problem_desc,techName:r.tech_name,estimatedCost:Number(r.estimated_cost||0),promisedDate:r.promised_date,internalNote:r.internal_note,registradoPor:r.registrado_por||{},parts:r.parts||[],createdAt:r.created_at});}));
        return;
      }catch(e){ console.warn('Error API saveRepair:',e); }
    }
    setRepairs(function(p){return [rep].concat(p);});
  }
  async function updateRepairStatus(id, status){
    if(isOnline){
      try{
        await repairsAPI.updateStatus(id, status);
        var fr2=await repairsAPI.getAll();
        setRepairs((fr2||[]).map(function(r){return Object.assign({},r,{repCode:r.rep_code,clientId:r.client_id,clientName:r.client_name,clientPhone:r.client_phone,clientCli:r.client_cli,problemDesc:r.problem_desc,techName:r.tech_name,estimatedCost:Number(r.estimated_cost||0),promisedDate:r.promised_date,internalNote:r.internal_note,registradoPor:r.registrado_por||{},parts:r.parts||[],createdAt:r.created_at});}));
        return;
      }catch(e){ console.warn('Error API updateRepairStatus:',e); }
    }
    setRepairs(function(p){return p.map(function(r){return r.id===id?Object.assign({},r,{status:status,updatedAt:new Date().toISOString()}):r;});});
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
    if(isOnline){
      try{
        if(isEdit){ await clientsAPI.update(obj.id,{cliCode:obj.cliCode,name:obj.name,dpi:obj.dpi||null,phone:obj.phone||null,address:obj.address||null,active:obj.active!==false}); }
        else { await clientsAPI.create({id:obj.id,cliCode:obj.cliCode,name:obj.name,dpi:obj.dpi||null,phone:obj.phone||null,address:obj.address||null,active:true,createdAt:obj.createdAt}); }
        var fc=await clientsAPI.getAll();
        setClients((fc||[]).map(function(c){return Object.assign({},c,{cliCode:c.cli_code,createdAt:c.created_at});}));
        return;
      }catch(e){ console.warn('Error API saveClient:',e); }
    }
    if(isEdit){ setClients(function(p){return p.map(function(c){return c.id===obj.id?obj:c;});}); }
    else { setClients(function(p){return p.concat([obj]);}); }
  }

  function exportJSON(){
    var data={version:"2.1",exportDate:new Date().toISOString(),negocio:"MUNDO CEL DIAZ",products:products,sales:sales,accounts:accounts,returns:returns,defectives:defectives,clients:clients,repairs:repairs};
    var blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    var url=URL.createObjectURL(blob);
    var a=document.createElement("a");a.href=url;a.download="MundoCelDiaz_backup_"+new Date().toISOString().slice(0,10)+".json";
    document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
    db.save("mnpos-last-backup",new Date().toISOString());
  }

  function exportExcel(){
    var wb=XLSX.utils.book_new();
    var now=new Date();
    var pendAcc=accounts.filter(function(a){return a.status!=="pagado";});
    var totalReemb=returns.filter(function(r){return r.refundAmount>0;}).reduce(function(s,r){return s+r.refundAmount;},0);
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["MUNDO CEL DIAZ — Reporte v2.1"],["Generado:",fmtD(now)+" "+fmtT(now)],[],["CLIENTES"],["Total clientes",clients.length],[],["VENTAS"],["Total ventas",sales.length],["Ingresos totales (Q)",sales.reduce(function(s,x){return s+x.total;},0)],[],["CUENTAS"],["Cuentas activas",pendAcc.length],["Por cobrar (Q)",pendAcc.reduce(function(s,a){return s+a.balance;},0)],[],["DEVOLUCIONES"],["Total devoluciones",returns.length],["Total reembolsado (Q)",totalReemb],[],["PIEZAS DEFECTUOSAS"],["En revisión",defectives.filter(function(d){return d.status==="defectuoso";}).length],["Dados de baja",defectives.filter(function(d){return d.status==="dado_de_baja";}).length]]),"Resumen");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["ID","Fecha","Cliente","Método","Total (Q)"]].concat(sales.map(function(s){return [s.id,fmtD(s.date),s.client,s.method,s.total];}))),"Ventas");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["ID Venta","Fecha","Cliente","Código","Producto","Cant.","Precio","Subtotal"]].concat(sales.reduce(function(arr,s){return arr.concat(s.items.map(function(it){return [s.id,fmtD(s.date),s.client,it.code,it.name,it.qty,it.price,it.price*it.qty];}));},[]))),  "Detalle Ventas");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["ID","Fecha","Cliente","Total","Pagado","Saldo","Estado"]].concat(accounts.map(function(a){return [a.id,fmtD(a.date),a.client,a.total,a.paid,a.balance,a.status];}))),"Cuentas");
    var pmts=accounts.reduce(function(arr,a){return arr.concat((a.payments||[]).map(function(p){return [a.id,a.client,fmtD(p.date),p.amount,p.method,p.note||""];}));},[]);
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["ID Cuenta","Cliente","Fecha","Monto","Método","Nota"]].concat(pmts)),"Historial Pagos");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["ID","Fecha","Cliente","Motivo","Estado artículo","Reembolso","Monto reemb.","Valor artícs."]].concat(returns.map(function(r){return [r.id,fmtD(r.date),r.client,r.reason,r.itemCondition||"bueno",r.refundMethod,r.refundAmount||0,r.total];}))),"Devoluciones");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["ID","Fecha","Código","Pieza","Cant.","Precio","Motivo","Estado"]].concat(defectives.map(function(d){return [d.id,fmtD(d.date),d.code,d.name,d.qty,d.price,d.reason,d.status];}))),"Piezas Defectuosas");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["Código","Nombre","DPI","Teléfono","Dirección","Fecha registro"]].concat(clients.map(function(c){return [c.cliCode||"",c.name||"",c.dpi||"",c.phone||"",c.address||"",c.createdAt?fmtD(c.createdAt):""];}))),"Clientes");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["Código","Nombre","Categoría","Estantería","Stock","Precio","Costo","Margen"]].concat(products.slice().sort(function(a,b){return a.code.localeCompare(b.code);}).map(function(p){var mg=p.cost>0?Math.round((p.price-p.cost)/p.price*100)+"%" :"N/A";return [p.code,p.name,p.category,p.shelf,p.unit==="serv"?"N/A":p.stock,p.price,p.cost,mg];}))),"Inventario");
    XLSX.writeFile(wb,"MundoCelDiaz_"+now.toISOString().slice(0,10)+".xlsx");
    showFlash("✓ Excel descargado","ok");
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
  var todaySales=sales.filter(function(s){return new Date(s.date).toDateString()===todayStr;});
  var pendingAccs=accounts.filter(function(a){return a.status!=="pagado";});
  var totalPend=pendingAccs.reduce(function(s,a){return s+a.balance;},0);
  var pqs={};
  sales.forEach(function(s){s.items.forEach(function(i){pqs[i.name]=(pqs[i.name]||0)+i.qty;});});
  var top5=Object.keys(pqs).map(function(k){return [k,pqs[k]];}).sort(function(a,b){return b[1]-a[1];}).slice(0,5);

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

        {/* Overlay móvil */}
        {sidebarOpen&&<div className="sidebar-overlay" onClick={function(){setSidebarOpen(false);}} style={{display:"none"}}/>}
        {/* Header móvil */}
        <div className="mobile-header" style={{display:"none",position:"fixed",top:0,left:0,right:0,zIndex:98,background:NAVY,padding:"10px 16px",alignItems:"center",justifyContent:"space-between",boxShadow:"0 2px 8px rgba(0,0,0,0.3)"}}>
          <button onClick={function(){setSidebarOpen(!sidebarOpen);}} style={{background:"transparent",border:"none",color:"#fff",fontSize:22,cursor:"pointer",padding:"4px 8px",lineHeight:1}}>☰</button>
          <span style={{color:"#fff",fontWeight:700,fontSize:15,letterSpacing:"-0.3px"}}>MUNDO CEL DIAZ</span>
          <span style={{color:TEAL,fontSize:11,fontWeight:600}}>v2.1</span>
        </div>
        <Sidebar view={view} setView={setView} cartCount={cart.length} pendingCount={pendingAccs.length} products={products} sales={sales} session={session} onLogout={onLogout} isOnline={isOnline} theme={theme} toggleTheme={toggleTheme} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}/>
        <div style={{flex:1,padding:"24px 28px",overflowY:"auto",minWidth:0}} className="main-content">
          {view==="dashboard"&&canAccess(session.role,"dashboard")&&<DashboardScreen sales={sales} todaySales={todaySales} pendingAccs={pendingAccs} totalPend={totalPend} products={products} top5={top5} setSelectedSale={setSelSale} setView={setView} accounts={accounts} returns={returns} repairs={repairs}/>}
          {view==="pos"      &&canAccess(session.role,"pos")&&<POSScreen products={products} filteredPOS={filteredPOS} cart={cart} posQ={posQ} setPosQ={setPosQ} payMethod={payMethod} setPayMethod={setPayMethod} payType={payType} setPayType={setPayType} cashIn={cashIn} setCashIn={setCashIn} initialPay={initialPay} setInitialPay={setInitialPay} clientName={clientName} setClientName={setClientName} selectedClientId={selectedClientId} setSelectedClientId={setSelectedClientId} saleNote={saleNote} setSaleNote={setSaleNote} cartTotal={cartTotal} vuelto={vuelto} initPaidVal={initPaidVal} addToCart={addToCart} changeQty={changeQty} removeFromCart={removeFromCart} applyDiscount={applyDiscount} checkout={checkout} resetPOS={resetPOS} flash={flash} clients={clients} accounts={accounts}/>}
          {view==="caja"     &&canAccess(session.role,"caja")&&<CajaScreen sales={sales} accounts={accounts} returns={returns}/>}
          {view==="accounts" &&canAccess(session.role,"accounts")&&<AccountsScreen accounts={accounts} pendingAccs={pendingAccs} totalPend={totalPend} addPayment={addPayment} showFlash={showFlash}/>}
          {view==="returns"  &&canAccess(session.role,"returns")&&<ReturnsScreen returns={returns} products={products} onProcess={processReturn} showFlash={showFlash} clients={clients} sales={sales}/>}
          {view==="defective"&&canAccess(session.role,"defective")&&<DefectiveScreen defectives={defectives} onUpdateStatus={updateDefectiveStatus} onReingress={reingresarDefective}/>}
          {view==="products" &&canAccess(session.role,"products")&&<ProductsScreen products={products} saveProduct={saveProduct} deleteProduct={deleteProduct} importProducts={importProducts}/>}
          {view==="inventory"&&canAccess(session.role,"inventory")&&<InventoryScreen products={products}/>}
          {view==="history"  &&canAccess(session.role,"history")&&<HistoryScreen sales={sales} selectedSale={selSale} setSelectedSale={setSelSale}/>}
          {view==="cuadres"  &&canAccess(session.role,"cuadres")&&<CuadresScreen sales={sales} accounts={accounts} returns={returns} products={products} repairs={repairs} session={session}/>}
          {view==="backup"   &&canAccess(session.role,"backup")&&<BackupScreen products={products} sales={sales} accounts={accounts} returns={returns} defectives={defectives} clients={clients} repairs={repairs} onExportJSON={exportJSON} onExportExcel={exportExcel} onImport={importData}/>}
          {view==="users"    &&canAccess(session.role,"users")&&<UsersScreen session={session} showFlash={showFlash}/>}
          {view==="clients"  &&canAccess(session.role,"clients")&&<ClientsScreen clients={clients} sales={sales} accounts={accounts} returns={returns} saveClient={saveClient} session={session} showFlash={showFlash}/>}
          {view==="repairs"  &&canAccess(session.role,"repairs")&&<RepairsScreen repairs={repairs} clients={clients} products={products} saveRepair={saveRepair} updateRepairStatus={updateRepairStatus} onCobrar={cobrarReparacion} session={session} showFlash={showFlash}/>}
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
    '<div class="brand"><h1>MUNDO CEL DIAZ</h1><p>ORDEN DE TRABAJO</p></div>'+
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
  '<div class="footer"><div><b>Mundo Cel Diaz</b> · Guatemala</div><div>Ref: '+rep.repCode+' · '+rep.id.slice(0,8).toUpperCase()+'</div></div>'+
  '<div class="firma">Firma del cliente: _____________________________ &nbsp;&nbsp;&nbsp; Fecha entrega: _______________</div>'+
  '</body></html>';
  var w=window.open("","_blank","width=800,height=700");
  var qrTxtR='MUNDO CEL DIAZ | Orden: '+rep.repCode+' | '+rep.clientName+' | '+rep.brand+' '+rep.model;
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

  // Filtros de lista
  var filtered=repairs.filter(function(r){
    if(filter==="activas") return r.status!=="entregado";
    if(filter==="entregado") return r.status==="entregado";
    if(filter==="listo") return r.status==="listo";
    if(filter==="en_revision") return r.status==="en_revision";
    if(filter==="recibido") return r.status==="recibido";
    return true;
  });

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

  function removePart(code){ setFParts(function(prev){return prev.filter(function(x){return x.code!==code;});}); }

  function resetForm(){
    setFClientQ("");setFClientId(null);setFClientName("");setFClientPhone("");
    setFBrand("");setFModel("");setFImei("");setFProblem("");setFDiag("");
    setFTech("");setFCost("");setFDate("");setFNote("");setFParts([]);setFErr("");
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

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
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
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <p style={H1}>🔧 Reparaciones</p>
        <button style={mB(showForm?"red":"teal")} onClick={function(){if(showForm){closeForm();}else{resetForm();setShowForm(true);}}}>
          {showForm?"✕ Cancelar":"+ Nueva orden"}
        </button>
      </div>

      {/* FORMULARIO NUEVA ORDEN */}
      {showForm&&(
        <div style={Object.assign({},sC,{marginBottom:16,borderColor:TEAL,borderWidth:"1.5px"})}>
          <p style={{fontWeight:700,margin:"0 0 16px",fontSize:15}}>📋 Nueva Orden de Reparación</p>
          {fErr&&<p style={{color:"#E24B4A",fontSize:13,margin:"0 0 12px"}}>⚠ {fErr}</p>}

          {/* Cliente */}
          <p style={{fontWeight:600,fontSize:13,color:"#555",margin:"0 0 10px",borderBottom:"1px solid #eee",paddingBottom:6}}>👤 Datos del cliente</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
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
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:14}}>
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
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
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
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:14}}>
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
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <input id="partCodeInp" style={Object.assign({},sI,{flex:1})} placeholder="Ingresá el código del producto (ej: B001) y presioná Enter"
                onKeyDown={function(e){if(e.key==="Enter"){addPart(e.target.value);e.target.value="";}}}/>
              <button style={mB("gray")} onClick={function(){var inp=document.getElementById("partCodeInp");if(inp){addPart(inp.value);inp.value="";}}}>+ Agregar</button>
            </div>
            {fParts.length>0&&(
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>{["Código","Repuesto","Cant.","Precio",""].map(function(h){return <th key={h} style={sTH}>{h}</th>;})}</tr></thead>
                <tbody>
                  {fParts.map(function(p){return <tr key={p.code}>
                    <td style={Object.assign({},sTD,{fontFamily:"monospace",fontSize:12})}>{p.code}</td>
                    <td style={Object.assign({},sTD,{fontWeight:500})}>{p.name}</td>
                    <td style={sTD}>{p.qty}</td>
                    <td style={Object.assign({},sTD,{color:TEAL})}>Q {Number(p.price).toFixed(2)}</td>
                    <td style={sTD}><span onClick={function(){removePart(p.code);}} style={{cursor:"pointer",color:"#E24B4A",fontSize:16}}>×</span></td>
                  </tr>;})}
                </tbody>
              </table>
            )}
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
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
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
            <thead><tr>{["Orden","Cliente","Dispositivo","Técnico","Estado","Costo","Entrega",""].map(function(h){return <th key={h} style={sTH}>{h}</th>;})}</tr></thead>
            <tbody>
              {filtered.slice().sort(function(a,b){return new Date(b.createdAt)-new Date(a.createdAt);}).map(function(r){
                var info=REP_STATUS[r.status]||{label:r.status,color:"gray"};
                var vencida=r.promisedDate&&r.status!=="entregado"&&new Date(r.promisedDate+"T23:59:59")<new Date();
                return (
                  <tr key={r.id} style={{cursor:"pointer"}} onClick={function(){setSelRep(r.id);}}>
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

  // Ventas del período
  var periodSales=sales.filter(function(s){return inRange(s.date);});

  // Ingresos por método
  var byMethod={Efectivo:0,Tarjeta:0,Transferencia:0};
  periodSales.forEach(function(s){if(byMethod[s.method]!==undefined)byMethod[s.method]+=s.total;else byMethod["Transferencia"]+=s.total;});

  // Abonos cobrados en el período (pagos sobre cuentas)
  var abonosPeriod=0;
  var abonosEfectivo=0;
  accounts.forEach(function(a){
    (a.payments||[]).forEach(function(p){
      if(inRange(p.date)){
        abonosPeriod+=p.amount;
        if(p.method==="Efectivo") abonosEfectivo+=p.amount;
      }
    });
  });

  // Reembolsos del período
  var reembolsosPeriod=returns.filter(function(r){return inRange(r.date)&&r.refundAmount>0;}).reduce(function(s,r){return s+r.refundAmount;},0);
  var reembolsosEfectivo=returns.filter(function(r){return inRange(r.date)&&r.refundMethod==="Efectivo"&&r.refundAmount>0;}).reduce(function(s,r){return s+r.refundAmount;},0);

  // Totales
  var totalVentas=periodSales.reduce(function(s,x){return s+x.total;},0);
  var totalEfectivo=byMethod.Efectivo+abonosEfectivo-reembolsosEfectivo;
  var totalIngresos=totalVentas+abonosPeriod;

  // Costo y ganancia bruta
  var costoVentas=0;
  periodSales.forEach(function(s){
    s.items.forEach(function(it){
      var prod=products.find(function(p){return p.id===it.id||p.code===it.code;});
      if(prod&&prod.cost>0) costoVentas+=prod.cost*it.qty;
    });
  });
  var gananciaBruta=totalVentas-costoVentas;

  // Reparaciones activas
  var repActivas=repairs.filter(function(r){return r.status!=="entregado";}).length;
  var repListas=repairs.filter(function(r){return r.status==="listo";}).length;

  // Más vendidos del período
  var qtyMap={};
  periodSales.forEach(function(s){s.items.forEach(function(it){qtyMap[it.name]=(qtyMap[it.name]||0)+it.qty;});});
  var top5=Object.keys(qtyMap).map(function(k){return [k,qtyMap[k]];}).sort(function(a,b){return b[1]-a[1];}).slice(0,5);

  function printCuadre(){
    var salesRows=periodSales.slice().sort(function(a,b){return new Date(b.date)-new Date(a.date);}).map(function(s){
      return '<tr><td>'+new Date(s.date).toLocaleDateString("es-GT",{day:"2-digit",month:"short"})+'</td>'+
        '<td>'+new Date(s.date).toLocaleTimeString("es-GT",{hour:"2-digit",minute:"2-digit"})+'</td>'+
        '<td>'+s.client+'</td>'+
        '<td>'+s.items.length+' art.</td>'+
        '<td><span style="background:#E1F5EE;color:#085041;padding:2px 8px;border-radius:12px;font-size:11px;">'+s.method+'</span></td>'+
        '<td style="text-align:right;font-weight:700;color:#1D9E75;">Q '+Number(s.total).toFixed(2)+'</td></tr>';
    }).join("");

    var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cuadre — MUNDO CEL DIAZ</title>'+
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
      '<div class="brand"><h1>MUNDO CEL DIAZ</h1><p>CUADRE / REPORTE DE CIERRE</p></div>'+
      '<div class="period"><div class="lbl">Período</div><div class="val">'+getRangeLabel()+'</div>'+
        '<div style="font-size:11px;color:#999;margin-top:4px;">Generado por: '+session.name+' · '+(ROLE_LABEL[session.role]||session.role)+'</div>'+
      '</div>'+
    '</div>'+

    '<div class="section"><div class="section-title">📊 Resumen de ventas</div>'+
    '<div class="grid4">'+
      '<div class="metric"><div class="lbl">Total ventas</div><div class="val">'+periodSales.length+'</div></div>'+
      '<div class="metric"><div class="lbl">Ingresos ventas</div><div class="val">Q '+totalVentas.toFixed(2)+'</div></div>'+
      '<div class="metric"><div class="lbl">Abonos cobrados</div><div class="val">Q '+abonosPeriod.toFixed(2)+'</div></div>'+
      '<div class="metric"><div class="lbl">Total ingresado</div><div class="val">Q '+totalIngresos.toFixed(2)+'</div></div>'+
    '</div></div>'+

    '<div class="section"><div class="section-title">💵 Por método de pago</div>'+
    '<div class="grid3">'+
      '<div class="metric"><div class="lbl">Efectivo (neto)</div><div class="val">Q '+totalEfectivo.toFixed(2)+'</div></div>'+
      '<div class="metric navy"><div class="lbl">Tarjeta</div><div class="val">Q '+byMethod.Tarjeta.toFixed(2)+'</div></div>'+
      '<div class="metric gray"><div class="lbl">Transferencia</div><div class="val">Q '+byMethod.Transferencia.toFixed(2)+'</div></div>'+
    '</div></div>'+

    (costoVentas>0?'<div class="section"><div class="section-title">📉 Costos y ganancia bruta</div>'+
    '<div class="grid3">'+
      '<div class="metric"><div class="lbl">Ventas brutas</div><div class="val">Q '+totalVentas.toFixed(2)+'</div></div>'+
      '<div class="metric red"><div class="lbl">Costo productos</div><div class="val">Q '+costoVentas.toFixed(2)+'</div></div>'+
      '<div class="metric" style="border-left-color:#2E7D32;"><div class="lbl">Ganancia bruta</div><div class="val" style="color:#2E7D32;">Q '+gananciaBruta.toFixed(2)+'</div></div>'+
    '</div></div>':'')+

    (reembolsosPeriod>0?'<div class="section"><div class="section-title">🔄 Reembolsos del período</div>'+
    '<div class="grid3">'+
      '<div class="metric red"><div class="lbl">Total reembolsado</div><div class="val">Q '+reembolsosPeriod.toFixed(2)+'</div></div>'+
      '<div class="metric red"><div class="lbl">Reemb. en efectivo</div><div class="val">Q '+reembolsosEfectivo.toFixed(2)+'</div></div>'+
      '<div class="metric gray"><div class="lbl">Devoluciones</div><div class="val">'+returns.filter(function(r){return inRange(r.date);}).length+'</div></div>'+
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
      '<div><b>Mundo Cel Diaz</b> · Guatemala · Sistema de Gestión v2.1</div>'+
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
        <p style={H1}>📈 Cuadres y Reportes</p>
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
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:16}}>
        <MetricBox label="Ventas del período" value={periodSales.length} color="#378ADD"/>
        <MetricBox label="Ingresos ventas" value={Q(totalVentas)} color={TEAL}/>
        <MetricBox label="Abonos cobrados" value={Q(abonosPeriod)} color="#7F77DD"/>
        <MetricBox label="Reembolsos" value={Q(reembolsosPeriod)} color="#E24B4A"/>
      </div>

      {/* Por método */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 2fr",gap:14,marginBottom:16}}>
        <div style={sC}>
          <p style={{fontSize:11,color:"#999",textTransform:"uppercase",margin:"0 0 8px"}}>💵 Saldo caja efectivo</p>
          <p style={{fontSize:26,fontWeight:800,color:totalEfectivo>=0?TEAL:"#E24B4A",margin:0}}>Q {totalEfectivo.toFixed(2)}</p>
          <p style={{fontSize:11,color:"#999",margin:"4px 0 0"}}>Ventas + abonos − reembolsos en efectivo</p>
        </div>
        <div style={sC}>
          <p style={{fontSize:11,color:"#999",textTransform:"uppercase",margin:"0 0 8px"}}>💳 Tarjeta + Transferencia</p>
          <p style={{fontSize:26,fontWeight:800,color:"#378ADD",margin:0}}>Q {(byMethod.Tarjeta+byMethod.Transferencia).toFixed(2)}</p>
          <p style={{fontSize:11,color:"#999",margin:"4px 0 0"}}>Tarjeta: Q {byMethod.Tarjeta.toFixed(2)} · Trans: Q {byMethod.Transferencia.toFixed(2)}</p>
        </div>
        {costoVentas>0?(
          <div style={sC}>
            <p style={{fontSize:11,color:"#999",textTransform:"uppercase",margin:"0 0 10px"}}>📉 Ganancia bruta estimada</p>
            <div style={{display:"flex",gap:16,alignItems:"center"}}>
              <div><p style={{fontSize:11,color:"#999",margin:"0 0 2px"}}>Ventas</p><p style={{fontWeight:700,color:TEAL}}>Q {totalVentas.toFixed(2)}</p></div>
              <span style={{color:"#E24B4A",fontSize:18}}>−</span>
              <div><p style={{fontSize:11,color:"#999",margin:"0 0 2px"}}>Costo</p><p style={{fontWeight:700,color:"#E24B4A"}}>Q {costoVentas.toFixed(2)}</p></div>
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
      </div>

      {/* Top 5 + Detalle ventas */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:16}}>
        <div style={sC}>
          <p style={{fontWeight:600,fontSize:14,margin:"0 0 12px"}}>🏆 Más vendidos</p>
          {top5.length===0?<p style={{color:"#999",fontSize:13}}>Sin ventas en el período</p>:
            top5.map(function(item,i){return (
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid rgba(0,0,0,0.06)",fontSize:13}}>
                <span style={{color:"#666"}}><b style={{color:TEAL,marginRight:6}}>{i+1}.</b>{item[0]}</span>
                <span style={{fontWeight:700,color:TEAL}}>{item[1]} uds</span>
              </div>
            );}
          )}
        </div>
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
    </div>
  );
}

export default AppWrapper;
