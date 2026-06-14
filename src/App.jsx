import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { db } from './utils/db.js';
import { authAPI, productsAPI, salesAPI, accountsAPI, returnsAPI, defectivesAPI, usersAPI, checkAPI } from './utils/api.js';

const TEAL = "#1D9E75";
const NAVY = "#1a2535";
const PK   = "mnpos-prods-v5";
const SK   = "mnpos-sales-v5";
const AK   = "mnpos-accounts-v2";
const RK   = "mnpos-returns-v2";
const DFK  = "mnpos-defective-v1";

const gid  = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const Q    = function(n){ return "Q " + Number(n).toFixed(2); };
const fmtD = function(d){ return new Date(d).toLocaleDateString("es-GT",{day:"2-digit",month:"short",year:"numeric"}); };
const fmtT = function(d){ return new Date(d).toLocaleTimeString("es-GT",{hour:"2-digit",minute:"2-digit"}); };

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

var sC  = {background:"#fff",borderRadius:12,border:"1px solid rgba(0,0,0,0.09)",padding:"20px 24px"};
var sI  = {width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid rgba(0,0,0,0.2)",fontSize:14,background:"#fff",color:"#1a1a1a",boxSizing:"border-box"};
var sL  = {fontSize:13,color:"#666",marginBottom:4,display:"block"};
var sTH = {textAlign:"left",padding:"10px 12px",color:"#666",fontSize:13,borderBottom:"1px solid rgba(0,0,0,0.08)",fontWeight:500};
var sTD = {padding:"10px 12px",borderBottom:"1px solid rgba(0,0,0,0.05)",color:"#1a1a1a",fontSize:14};
var sQB = {cursor:"pointer",background:"#f0efeb",width:26,height:26,borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,userSelect:"none",flexShrink:0,border:"1px solid rgba(0,0,0,0.1)"};
var H1  = {fontSize:22,fontWeight:600,margin:"0 0 20px",color:"#1a1a1a"};

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
  admin:   ["dashboard","pos","caja","accounts","returns","defective","products","inventory","history","backup","users"],
  cajero:  ["dashboard","pos","caja","accounts","returns","history"],
  auditor: ["dashboard","caja","history","inventory"],
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
    var users=await db.load(UK,[]);
    var user=(users||[]).find(function(u){return u.email.toLowerCase()===email.trim().toLowerCase()&&u.active;});
    if(!user){setAttempts(function(a){return a+1;});setErr("Email o contraseña incorrectos.");setLoading(false);return;}
    var hash=await hashPass(pass);
    if(hash!==user.passwordHash){
      var na=attempts+1; setAttempts(na);
      if(na>=5){
        setBlocked(true);
        setErr("5 intentos fallidos — bloqueado 5 minutos.");
        setTimeout(function(){setBlocked(false);setAttempts(0);setErr("");},5*60*1000);
      } else {
        setErr("Contraseña incorrecta. Intentos restantes: "+(5-na));
      }
      setLoading(false);return;
    }
    var updated=(users||[]).map(function(u){return u.id===user.id?Object.assign({},u,{lastLogin:new Date().toISOString()}):u;});
    await db.save(UK,updated);
    try { await authAPI.login(email.trim(),pass); } catch(e){}
    setLoading(false);
    onLogin(createSession(user));
  }

  async function doFindUser(){
    setRecErr("");
    if(!recEmail.trim()){setRecErr("Ingresá tu email.");return;}
    var users=await db.load(UK,[]);
    var user=(users||[]).find(function(u){return u.email.toLowerCase()===recEmail.trim().toLowerCase()&&u.active;});
    if(!user){setRecErr("No se encontró una cuenta activa con ese email.");return;}
    if(!user.secQuestion){setRecErr("Esta cuenta no tiene pregunta de seguridad configurada. Contactá al administrador del sistema.");return;}
    setRecUser(user);
    setRecMode("question");
  }

  async function doVerifyAnswer(){
    setRecErr("");
    if(!recAnswer.trim()){setRecErr("Ingresá la respuesta.");return;}
    var ansHash=await hashPass(recAnswer.trim().toLowerCase());
    if(ansHash!==recUser.secAnswerHash){setRecErr("Respuesta incorrecta.");return;}
    setRecMode("newpass");
  }

  async function doResetPass(){
    setRecErr("");
    if(!newPass||newPass.length<8){setRecErr("La contraseña debe tener mínimo 8 caracteres.");return;}
    if(newPass!==newPass2){setRecErr("Las contraseñas no coinciden.");return;}
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

  useEffect(function(){async function load(){var u=await db.load(UK,[]);setUsers(u||[]);setUsersLoaded(true);}load();},[]);
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
      showFlash("✓ Usuario actualizado","ok");
    } else {
      setUsers(function(p){return p.concat([{id:gid(),name:fName.trim(),email:fEmail.trim(),passwordHash:hash,role:fRole,active:true,createdAt:new Date().toISOString(),secQuestion:secQuestion,secAnswerHash:secAnswerHash}]);});
      showFlash("✓ Usuario creado","ok");
    }
    resetForm();
  }

  function toggleActive(uid){
    if(uid===session.userId){showFlash("No podés desactivar tu propia cuenta","warn");return;}
    var admins=users.filter(function(u){return u.role==="admin"&&u.active;});
    var tgt=users.find(function(u){return u.id===uid;});
    if(tgt&&tgt.role==="admin"&&admins.length<=1&&tgt.active){showFlash("Debe existir al menos un administrador activo","warn");return;}
    setUsers(function(p){return p.map(function(u){return u.id===uid?Object.assign({},u,{active:!u.active}):u;});});
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

/* ── AppWrapper — controla autenticación ── */
function AppWrapper() {
  var _s=useState(function(){return getSession();}); var session=_s[0]; var setSession=_s[1];

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

  if(!session) return <LoginScreen onLogin={function(s){setSession(s);}}/>;
  return <App session={session} onLogout={function(){clearSession();setSession(null);}}/>;
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
  {k:"code",    l:"Código",           ph:"A001",            tp:"text"  },
  {k:"name",    l:"Nombre",           ph:"Ej: Pantalla...", tp:"text"  },
  {k:"category",l:"Categoría",        ph:"Pantallas",       tp:"text"  },
  {k:"shelf",   l:"Estantería",       ph:"A-01",            tp:"text"  },
  {k:"price",   l:"Precio venta (Q)", ph:"0.00",            tp:"number"},
  {k:"cost",    l:"Costo (Q)",        ph:"0.00",            tp:"number"},
  {k:"stock",   l:"Stock",            ph:"0",               tp:"number"},
  {k:"unit",    l:"Unidad",           ph:"uni / serv",      tp:"text"  },
];
function ProductForm(props) {
  var product=props.product; var onSave=props.onSave; var onCancel=props.onCancel;
  var _s=useState(Object.assign({},product)); var form=_s[0]; var setForm=_s[1];
  var _e=useState(""); var err=_e[0]; var setErr=_e[1];
  function set(k,v){ setForm(function(f){ var n=Object.assign({},f); n[k]=v; return n; }); }
  function doSave(){
    if(!form.code||!form.code.trim()||!form.name||!form.name.trim()){setErr("Código y Nombre son obligatorios");return;}
    onSave(Object.assign({},form,{price:parseFloat(form.price)||0,cost:parseFloat(form.cost)||0,stock:parseInt(form.stock)||0}));
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
  var NAV = [
    {id:"dashboard", ic:"📊", lb:"Dashboard"},
    {id:"pos",       ic:"🛒", lb:"Nueva Venta"},
    {id:"caja",      ic:"💵", lb:"Caja"},
    {id:"accounts",  ic:"💳", lb:"Cuentas"},
    {id:"returns",   ic:"🔄", lb:"Devoluciones"},
    {id:"defective", ic:"🔩", lb:"Piezas Defect."},
    {id:"products",  ic:"📦", lb:"Productos"},
    {id:"inventory", ic:"🗄️", lb:"Inventario"},
    {id:"history",   ic:"📋", lb:"Historial"},
    {id:"backup",    ic:"💾", lb:"Respaldo"},
    {id:"users",     ic:"👥", lb:"Usuarios"},
  ];
  return (
      <div style={{width:200,background:NAVY,display:"flex",flexDirection:"column",flexShrink:0,position:"sticky",top:0,height:"100vh"}}>
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
        <nav style={{flex:1,padding:"10px 0",overflowY:"auto"}}>
          {NAV.filter(function(item){return canAccess(session.role||"cajero",item.id);}).map(function(item){
            var isActive=view===item.id;
            return (
                <div key={item.id} onClick={function(){setView(item.id);}} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",cursor:"pointer",background:isActive?"rgba(255,255,255,0.1)":"transparent",color:isActive?"#fff":"rgba(255,255,255,0.52)",fontSize:13,borderLeft:isActive?"3px solid "+TEAL:"3px solid transparent",marginBottom:1}}>
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

  var todayRev=todaySales.reduce(function(s,x){return s+x.total;},0);
  var totalRev=sales.reduce(function(s,x){return s+x.total;},0);
  var todayStr=new Date().toDateString();

  var cajaDia=todaySales.filter(function(s){return s.method==="Efectivo";}).reduce(function(s,x){return s+x.total;},0);
  var returnsDia=returns.filter(function(r){return new Date(r.date).toDateString()===todayStr&&r.refundMethod==="Efectivo"&&r.refundAmount>0;}).reduce(function(s,r){return s+r.refundAmount;},0);
  var saldoCaja=cajaDia-returnsDia;

  return (
      <div>
        <p style={H1}>📊 Panel de Control</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:22}}>
          <MetricBox label="Ventas hoy"       value={todaySales.length}   color={TEAL}/>
          <MetricBox label="Ingresos hoy"     value={Q(todayRev)}          color="#378ADD"/>
          <MetricBox label="Saldo caja hoy"   value={Q(saldoCaja)}         color={saldoCaja>=0?"#1D9E75":"#E24B4A"}/>
          <MetricBox label="Por cobrar"        value={Q(totalPend)}         color="#E24B4A"/>
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
  var cartTotal=props.cartTotal; var vuelto=props.vuelto; var initPaidVal=props.initPaidVal;
  var addToCart=props.addToCart; var changeQty=props.changeQty; var removeFromCart=props.removeFromCart;
  var checkout=props.checkout; var resetPOS=props.resetPOS; var flash=props.flash;
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
                    return (
                        <div key={item.id} style={{padding:"10px 0",borderBottom:"1px solid rgba(0,0,0,0.07)"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                            <div style={{flex:1,marginRight:8}}>
                              <div style={{fontSize:13,fontWeight:600,lineHeight:1.3}}>{item.name}</div>
                              <div style={{fontSize:10,color:"#999",fontFamily:"monospace"}}>{item.code}</div>
                            </div>
                            <span style={{cursor:"pointer",color:"#E24B4A",fontSize:18,lineHeight:1,flexShrink:0}} onClick={function(){removeFromCart(item.id);}}>×</span>
                          </div>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <div style={sQB} onClick={function(){changeQty(item.id,-1);}}>−</div>
                              <span style={{fontSize:14,fontWeight:600,minWidth:22,textAlign:"center"}}>{item.qty}</span>
                              <div style={sQB} onClick={function(){changeQty(item.id,1);}}>+</div>
                            </div>
                            <span style={{fontSize:14,fontWeight:700,color:TEAL}}>{Q(item.price*item.qty)}</span>
                          </div>
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
                <input style={sI} value={clientName} placeholder="Nombre (opcional)" onChange={function(e){setClientName(e.target.value);}}/>
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
          <button style={Object.assign({},mB("gray"),{marginBottom:16})} onClick={function(){setSelAcc(null);setPmtAmount("");setPmtNote("");setPmtErr("");}}>← Volver</button>
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
                      return <tr key={i}><td style={sTD}>{fmtD(p.date)} {fmtT(p.date)}</td><td style={Object.assign({},sTD,{fontWeight:700,color:TEAL})}>{Q(p.amount)}</td><td style={sTD}><span style={mBg("teal")}>{p.method}</span></td><td style={Object.assign({},sTD,{color:"#666"})}>{p.note||"—"}</td><td style={Object.assign({},sTD,{color:"#666",fontSize:12})}>{p.registradoPor?p.registradoPor.name:"—"}</td></tr>;
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

/* ── Devoluciones (con lógica de reembolso y condición del artículo) ── */
function ReturnsScreen(props) {
  var returns=props.returns; var products=props.products; var onProcess=props.onProcess;
  var BLANK={client:"",items:[{code:"",name:"",qty:1,price:0}],reason:"",refundMethod:"Efectivo",refundAmount:"",itemCondition:"bueno"};
  var _sh=useState(false); var show=_sh[0]; var setShow=_sh[1];
  var _fo=useState(BLANK); var form=_fo[0]; var setForm=_fo[1];
  var _er=useState(""); var err=_er[0]; var setErr=_er[1];

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
    onProcess({client:form.client.trim()||"Cliente general",items:valid,reason:form.reason,refundMethod:form.refundMethod,refundAmount:refAmt,itemCondition:form.itemCondition});
    setForm(BLANK);setShow(false);setErr("");
  }

  var totalRet=returns.reduce(function(s,r){return s+r.total;},0);
  var totalReembolsado=returns.filter(function(r){return r.refundAmount>0;}).reduce(function(s,r){return s+r.refundAmount;},0);
  var totalPendReemb=returns.filter(function(r){return r.refundMethod==="Sin reembolso"||r.refundAmount===0;}).length;

  return (
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <p style={H1}>🔄 Devoluciones</p>
          <button style={mB(show?"red":"teal")} onClick={function(){setShow(!show);setErr("");setForm(BLANK);}}>{show?"✕ Cancelar":"+ Nueva devolución"}</button>
        </div>

        {show&&(
            <div style={Object.assign({},sC,{marginBottom:16,borderColor:"#378ADD",borderWidth:"1.5px"})}>
              <p style={{fontWeight:600,margin:"0 0 14px",fontSize:15}}>🔄 Registrar devolución</p>
              {err&&<p style={{color:"#E24B4A",fontSize:13,margin:"0 0 10px"}}>⚠ {err}</p>}

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
                <div><label style={sL}>👤 Cliente</label>
                  <input style={sI} value={form.client} placeholder="Nombre del cliente" onChange={function(e){setF("client",e.target.value);}}/></div>
                <div><label style={sL}>📋 Motivo de devolución</label>
                  <input style={sI} value={form.reason} placeholder="Ej: Pantalla defectuosa" onChange={function(e){setErr("");setF("reason",e.target.value);}}/></div>
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
                      return (
                          <div key={pair[0]} onClick={function(){setF("itemCondition",pair[0]);}} style={{padding:"10px 12px",borderRadius:8,cursor:"pointer",border:"2px solid "+(active?TEAL:"rgba(0,0,0,0.15)"),background:active?"#E1F5EE":"#fff",fontSize:13,fontWeight:active?600:400,color:active?"#085041":"#444",textAlign:"center"}}>
                            {pair[1]}
                          </div>
                      );
                    })}
                  </div>
                  <p style={{fontSize:11,color:"#888",margin:"6px 0 0"}}>
                    {form.itemCondition==="bueno"?"✓ Volverá al inventario disponible":"⚠ Irá a Piezas Defectuosas (no al inventario)"}
                  </p>
                </div>
                <div>
                  <label style={sL}>💵 Reembolso al cliente</label>
                  <select style={Object.assign({},sI,{marginBottom:8})} value={form.refundMethod} onChange={function(e){setF("refundMethod",e.target.value);}}>
                    <option>Efectivo</option><option>Tarjeta</option><option>Crédito en cuenta</option><option>Sin reembolso</option>
                  </select>
                  {form.refundMethod!=="Sin reembolso"&&(
                      <div>
                        <label style={sL}>Monto a reembolsar (Q)</label>
                        <input type="number" style={sI} value={form.refundAmount} placeholder={"Total artículos: "+itemsTotal.toFixed(2)} onChange={function(e){setF("refundAmount",e.target.value);}}/>
                        <p style={{fontSize:11,color:"#888",margin:"4px 0 0"}}>Dejá vacío para reembolsar el total ({Q(itemsTotal)})</p>
                      </div>
                  )}
                  {form.refundMethod==="Sin reembolso"&&<div style={{background:"#f5f4f0",borderRadius:6,padding:"8px 10px",fontSize:12,color:"#666"}}>No se devolverá dinero al cliente</div>}
                </div>
              </div>

              <button style={Object.assign({},mB("blue"),{padding:"10px 24px",fontSize:14})} onClick={doReturn}>✓ Registrar devolución</button>
            </div>
        )}

        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
          <MetricBox label="Total devoluciones"  value={returns.length}    color="#7F77DD"/>
          <MetricBox label="Total reembolsado"   value={Q(totalReembolsado)} color="#E24B4A"/>
          <MetricBox label="Sin reembolso"       value={totalPendReemb}    color="#666"/>
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
  var _s=useState(""); var search=_s[0]; var setSearch=_s[1];
  var _c=useState("Todas"); var cat=_c[0]; var setCat=_c[1];
  var _o=useState("name"); var sort=_o[0]; var setSort=_o[1];
  var _e=useState(null); var editProd=_e[0]; var setEditProd=_e[1];
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
          <button style={mB("teal")} onClick={function(){setEditProd({code:"",name:"",category:"",price:"",cost:"",stock:"",shelf:"",unit:"uni"});}}>+ Agregar</button>
        </div>
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
                        <button style={Object.assign({},mB("red"),{padding:"4px 10px",fontSize:12})} onClick={function(){deleteProduct(p.id);}}>🗑</button>
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
function HistoryScreen(props) {
  var sales=props.sales; var selectedSale=props.selectedSale; var setSelectedSale=props.setSelectedSale;
  if(selectedSale){
    return (
        <div>
          <button style={Object.assign({},mB("gray"),{marginBottom:16})} onClick={function(){setSelectedSale(null);}}>← Volver</button>
          <div style={sC}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
              <div>
                <p style={{fontWeight:600,fontSize:16,margin:"0 0 4px"}}>Detalle de Venta</p>
                <p style={{fontSize:13,color:"#666",margin:"0 0 2px"}}>{fmtD(selectedSale.date)} {fmtT(selectedSale.date)}</p>
                <p style={{fontSize:13,margin:"2px 0"}}>👤 <b>{selectedSale.client}</b></p>
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
                return <tr key={i}><td style={Object.assign({},sTD,{fontFamily:"monospace",fontSize:12})}>{it.code}</td><td style={Object.assign({},sTD,{fontWeight:600})}>{it.name}</td><td style={sTD}>{it.qty}</td><td style={sTD}>{Q(it.price)}</td><td style={Object.assign({},sTD,{fontWeight:700,color:TEAL})}>{Q(it.price*it.qty)}</td></tr>;
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
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:14,marginBottom:24}}>
          <MetricBox label="Productos"   value={products.length}   color={TEAL}/>
          <MetricBox label="Ventas"      value={sales.length}      color="#378ADD"/>
          <MetricBox label="Cuentas"     value={accounts.length}   color="#7F77DD"/>
          <MetricBox label="Defectuosas" value={defectives.length} color="#E24B4A"/>
          <MetricBox label="Tamaño data" value={sizeKB+" KB"}      color="#666"/>
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

/* ══ APP ══════════════════════════════════════════════════════════════ */
function App(props) {
  var session=props.session||{}; var onLogout=props.onLogout||function(){}; var isOnline=props.isOnline||false;
  var _p=useState([]); var products=_p[0]; var setProducts=_p[1];
  var _s=useState([]); var sales=_s[0]; var setSales=_s[1];
  var _a=useState([]); var accounts=_a[0]; var setAccounts=_a[1];
  var _r=useState([]); var returns=_r[0]; var setReturns=_r[1];
  var _d=useState([]); var defectives=_d[0]; var setDefectives=_d[1];
  var _ld=useState(false); var loaded=_ld[0]; var setLoaded=_ld[1];
  var _on=useState(false); var isOnline=_on[0]; var setIsOnline=_on[1];

  useEffect(function(){
    async function loadAll(){
      // Verificar si el backend esta disponible
      var online = await checkAPI();
      setIsOnline(online);

      var hasApiToken = !!sessionStorage.getItem('mnpos-api-session');
      if(online && hasApiToken){
        // Modo online: cargar datos desde el API
        try {
          var [prods, sls, accs, rets, defs] = await Promise.all([
            productsAPI.getAll(),
            salesAPI.getAll(),
            accountsAPI.getAll(),
            returnsAPI.getAll(),
            defectivesAPI.getAll(),
          ]);
          var normalProds = (prods||[]).map(function(p){return Object.assign({},p,{id:p.id,code:p.code,name:p.name,category:p.category||'',shelf:p.shelf||'',price:Number(p.price),cost:Number(p.cost),stock:Number(p.stock),unit:p.unit||'uni'});});
          var normalSales = (sls||[]).map(function(s){return Object.assign({},s,{items:s.sale_items||[],total:Number(s.total),date:s.created_at});});
          var normalAccs  = (accs||[]).map(function(a){return Object.assign({},a,{items:a.account_items||[],payments:a.account_payments||[],total:Number(a.total),paid:Number(a.paid),balance:Number(a.balance),date:a.created_at});});
          var normalRets  = (rets||[]).map(function(r){return Object.assign({},r,{items:r.return_items||[],refundAmount:Number(r.refund_amount),itemCondition:r.item_condition,refundMethod:r.refund_method,date:r.created_at});});
          var normalDefs  = (defs||[]).map(function(d){return Object.assign({},d,{price:Number(d.price||0)});});
          setProducts(normalProds.length>0?normalProds:DEMO);
          setSales(normalSales);
          setAccounts(normalAccs);
          setReturns(normalRets);
          setDefectives(normalDefs);
        } catch(e) {
          console.warn("Error cargando del API, usando local:", e);
          setIsOnline(false);
          var p2 = await db.load(PK, DEMO);
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
        setProducts(p); setSales(s); setAccounts(a); setReturns(r); setDefectives(d);
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

  var cartTotal=cart.reduce(function(s,i){return s+i.price*i.qty;},0);
  var cashVal=parseFloat(cashIn)||0;
  var vuelto=payMethod==="Efectivo"&&payType==="completo"&&cashIn?cashVal-cartTotal:null;
  var initPaidVal=parseFloat(initialPay)||0;

  function resetPOS(){ setCart([]);setCashIn("");setClientName("");setInitialPay("");setPayType("completo");setPayMethod("Efectivo"); }

  async function checkout(){
    if(!cart.length)return;
    if(!clientName.trim()){showFlash("El nombre del cliente es obligatorio","err");return;}
    var client=clientName.trim();
    var items=cart.map(function(i){return {id:i.id,code:i.code,name:i.name,price:i.price,qty:i.qty,shelf:i.shelf};});
    var registradoPor={userId:session.userId,name:session.name,role:session.role};
    var base={id:gid(),date:new Date().toISOString(),client:client,items:items,total:cartTotal,method:payMethod,registradoPor:registradoPor};
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

  function exportJSON(){
    var data={version:"2.1",exportDate:new Date().toISOString(),negocio:"MUNDO CEL DIAZ",products:products,sales:sales,accounts:accounts,returns:returns,defectives:defectives};
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
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["MUNDO CEL DIAZ — Reporte v2.1"],["Generado:",fmtD(now)+" "+fmtT(now)],[],["VENTAS"],["Total ventas",sales.length],["Ingresos totales (Q)",sales.reduce(function(s,x){return s+x.total;},0)],[],["CUENTAS"],["Cuentas activas",pendAcc.length],["Por cobrar (Q)",pendAcc.reduce(function(s,a){return s+a.balance;},0)],[],["DEVOLUCIONES"],["Total devoluciones",returns.length],["Total reembolsado (Q)",totalReemb],[],["PIEZAS DEFECTUOSAS"],["En revisión",defectives.filter(function(d){return d.status==="defectuoso";}).length],["Dados de baja",defectives.filter(function(d){return d.status==="dado_de_baja";}).length]]),"Resumen");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["ID","Fecha","Cliente","Método","Total (Q)"]].concat(sales.map(function(s){return [s.id,fmtD(s.date),s.client,s.method,s.total];}))),"Ventas");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["ID Venta","Fecha","Cliente","Código","Producto","Cant.","Precio","Subtotal"]].concat(sales.reduce(function(arr,s){return arr.concat(s.items.map(function(it){return [s.id,fmtD(s.date),s.client,it.code,it.name,it.qty,it.price,it.price*it.qty];}));},[]))),  "Detalle Ventas");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["ID","Fecha","Cliente","Total","Pagado","Saldo","Estado"]].concat(accounts.map(function(a){return [a.id,fmtD(a.date),a.client,a.total,a.paid,a.balance,a.status];}))),"Cuentas");
    var pmts=accounts.reduce(function(arr,a){return arr.concat((a.payments||[]).map(function(p){return [a.id,a.client,fmtD(p.date),p.amount,p.method,p.note||""];}));},[]);
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["ID Cuenta","Cliente","Fecha","Monto","Método","Nota"]].concat(pmts)),"Historial Pagos");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["ID","Fecha","Cliente","Motivo","Estado artículo","Reembolso","Monto reemb.","Valor artícs."]].concat(returns.map(function(r){return [r.id,fmtD(r.date),r.client,r.reason,r.itemCondition||"bueno",r.refundMethod,r.refundAmount||0,r.total];}))),"Devoluciones");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["ID","Fecha","Código","Pieza","Cant.","Precio","Motivo","Estado"]].concat(defectives.map(function(d){return [d.id,fmtD(d.date),d.code,d.name,d.qty,d.price,d.reason,d.status];}))),"Piezas Defectuosas");
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
      <div style={{display:"flex",minHeight:"100vh",background:"#eceae4"}}>

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

        <Sidebar view={view} setView={setView} cartCount={cart.length} pendingCount={pendingAccs.length} products={products} sales={sales} session={session} onLogout={onLogout} isOnline={isOnline}/>
        <div style={{flex:1,padding:"24px 28px",overflowY:"auto",minWidth:0}}>
          {view==="dashboard"&&canAccess(session.role,"dashboard")&&<DashboardScreen sales={sales} todaySales={todaySales} pendingAccs={pendingAccs} totalPend={totalPend} products={products} top5={top5} setSelectedSale={setSelSale} setView={setView} accounts={accounts} returns={returns}/>}
          {view==="pos"      &&canAccess(session.role,"pos")&&<POSScreen products={products} filteredPOS={filteredPOS} cart={cart} posQ={posQ} setPosQ={setPosQ} payMethod={payMethod} setPayMethod={setPayMethod} payType={payType} setPayType={setPayType} cashIn={cashIn} setCashIn={setCashIn} initialPay={initialPay} setInitialPay={setInitialPay} clientName={clientName} setClientName={setClientName} cartTotal={cartTotal} vuelto={vuelto} initPaidVal={initPaidVal} addToCart={addToCart} changeQty={changeQty} removeFromCart={removeFromCart} checkout={checkout} resetPOS={resetPOS} flash={flash}/>}
          {view==="caja"     &&canAccess(session.role,"caja")&&<CajaScreen sales={sales} accounts={accounts} returns={returns}/>}
          {view==="accounts" &&canAccess(session.role,"accounts")&&<AccountsScreen accounts={accounts} pendingAccs={pendingAccs} totalPend={totalPend} addPayment={addPayment} showFlash={showFlash}/>}
          {view==="returns"  &&canAccess(session.role,"returns")&&<ReturnsScreen returns={returns} products={products} onProcess={processReturn} showFlash={showFlash}/>}
          {view==="defective"&&canAccess(session.role,"defective")&&<DefectiveScreen defectives={defectives} onUpdateStatus={updateDefectiveStatus} onReingress={reingresarDefective}/>}
          {view==="products" &&canAccess(session.role,"products")&&<ProductsScreen products={products} saveProduct={saveProduct} deleteProduct={deleteProduct}/>}
          {view==="inventory"&&canAccess(session.role,"inventory")&&<InventoryScreen products={products}/>}
          {view==="history"  &&canAccess(session.role,"history")&&<HistoryScreen sales={sales} selectedSale={selSale} setSelectedSale={setSelSale}/>}
          {view==="backup"   &&canAccess(session.role,"backup")&&<BackupScreen products={products} sales={sales} accounts={accounts} returns={returns} defectives={defectives} onExportJSON={exportJSON} onExportExcel={exportExcel} onImport={importData}/>}
          {view==="users"    &&canAccess(session.role,"users")&&<UsersScreen session={session} showFlash={showFlash}/>}
        </div>
      </div>
  );
}

export default AppWrapper;
