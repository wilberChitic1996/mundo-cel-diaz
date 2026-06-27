// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA: LoginScreen (Inicio de Sesión)
//
// Maneja 5 flujos en una sola pantalla (controlados por estado):
//   1. login      — formulario principal de email + contraseña
//   2. 2fa        — verificación de código de dos factores (superadmin)
//   3. recover    — recuperación: ingresar email
//   4. question   — recuperación: responder pregunta de seguridad
//   5. newpass    — recuperación: ingresar nueva contraseña
//   6. done       — recuperación: confirmación de éxito
//
// Props:
//   onLogin {Function} — recibe la sesión creada al autenticar exitosamente
//   onBack  {Function} — regresa a la landing page
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { TEAL, NAVY } from '../styles/theme.js';
import { APP_NAME, APP_TAGLINE } from '../constants/index.js';
import { authAPI } from '../utils/api.js';
import { db } from '../utils/db.js';
import { createSession } from '../utils/session.js';

// Clave de almacenamiento local de usuarios (modo offline/local)
var UK = 'mnpos-users-v1';

// ── Hash de contraseña local (solo para modo offline sin API) ─────────────────
async function hashPass(password) {
  try {
    var enc = new TextEncoder();
    var buf = await crypto.subtle.digest('SHA-256', enc.encode(password + 'mnpos_salt_2026'));
    return Array.from(new Uint8Array(buf)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  } catch (e) {
    return btoa(unescape(encodeURIComponent(password + 'mnpos_salt_2026')));
  }
}

export default function LoginScreen({ onLogin, onBack }) {
  onBack = onBack || function() {};

  // ── Estado del formulario de login ────────────────────────────────────────
  var _e   = useState(''); var email      = _e[0];  var setEmail      = _e[1];
  var _p   = useState(''); var pass       = _p[0];  var setPass       = _p[1];
  var _sp  = useState(false); var showPass    = _sp[0]; var setShowPass    = _sp[1];
  var _l   = useState(false); var loading     = _l[0];  var setLoading     = _l[1];
  var _er  = useState(''); var err        = _er[0]; var setErr        = _er[1];
  var _at  = useState(0);  var attempts   = _at[0]; var setAttempts   = _at[1];
  var _bl  = useState(false); var blocked     = _bl[0]; var setBlocked     = _bl[1];

  // ── Estado del flujo de verificación 2FA ─────────────────────────────────
  var _2fa  = useState(false); var needs2fa     = _2fa[0];  var setNeeds2fa     = _2fa[1];
  var _2fe  = useState('');    var twoFaEmail   = _2fe[0];  var setTwoFaEmail   = _2fe[1];
  var _2fc  = useState('');    var twoFaCode    = _2fc[0];  var setTwoFaCode    = _2fc[1];
  var _2fl  = useState(false); var twoFaLoading = _2fl[0];  var setTwoFaLoading = _2fl[1];
  var _2fer = useState('');    var twoFaErr     = _2fer[0]; var setTwoFaErr     = _2fer[1];

  // ── Estado del flujo de recuperación de contraseña ───────────────────────
  var _rm   = useState('login'); var recMode        = _rm[0];   var setRecMode        = _rm[1];
  var _re   = useState('');      var recEmail       = _re[0];   var setRecEmail       = _re[1];
  var _rq   = useState('');      var recAnswer      = _rq[0];   var setRecAnswer      = _rq[1];
  var _np   = useState('');      var newPass        = _np[0];   var setNewPass        = _np[1];
  var _np2  = useState('');      var newPass2       = _np2[0];  var setNewPass2       = _np2[1];
  var _ru   = useState(null);    var recUser        = _ru[0];   var setRecUser        = _ru[1];
  var _snp  = useState(false);   var showNewPass    = _snp[0];  var setShowNewPass    = _snp[1];
  var _snp2 = useState(false);   var showNewPass2   = _snp2[0]; var setShowNewPass2   = _snp2[1];
  var _rce  = useState('');      var recErr         = _rce[0];  var setRecErr         = _rce[1];
  var _rco  = useState('');      var recOk          = _rco[0];  var setRecOk          = _rco[1];
  var _rtk  = useState('');      var recResetToken  = _rtk[0];  var setRecResetToken  = _rtk[1];

  // ── Estilos del formulario ────────────────────────────────────────────────
  var inBg        = { width: '100%', padding: '11px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 14, boxSizing: 'border-box', outline: 'none' };
  var lblSt       = { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' };
  var btnPrimary  = { width: '100%', padding: '12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: TEAL, color: '#fff', fontSize: 15, fontWeight: 700 };
  var btnSecondary = { width: '100%', padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer', marginTop: 10 };

  // ── Acciones de autenticación ─────────────────────────────────────────────

  function handleKey(e) { if (e.key === 'Enter') doLogin(); }

  /** Intenta autenticar al usuario contra la API. */
  async function doLogin() {
    if (blocked) { setErr('Cuenta bloqueada 5 minutos por seguridad.'); return; }
    if (!email.trim() || !pass) { setErr('Ingresá tu email y contraseña.'); return; }
    setLoading(true); setErr('');
    try {
      var apiResp = await authAPI.login(email.trim(), pass);
      // Si el servidor pide 2FA, cambiar al flujo de verificación
      if (apiResp && apiResp.requires2fa) {
        setLoading(false);
        setTwoFaEmail(apiResp.email);
        setNeeds2fa(true);
        return;
      }
      if (apiResp && apiResp.user) {
        setLoading(false);
        onLogin(createSession(
          { id: apiResp.user.id, name: apiResp.user.name, email: apiResp.user.email, role: apiResp.user.role, tenant_id: apiResp.user.tenant_id },
          apiResp.token,
          apiResp.refreshToken
        ));
        return;
      }
      setLoading(false);
      setErr('Error inesperado. Intenta de nuevo.');
    } catch (e) {
      setLoading(false);
      var rawMsg = (e && e.error) ? e.error : (e && e.message) ? e.message : '';
      var msg = (typeof rawMsg === 'string') ? rawMsg : '';
      var ml = msg.toLowerCase();
      // Distinguir error de red de error de credenciales
      var isNetwork = !msg || ml.includes('network') || ml.includes('conexion') || ml.includes('fetch') || ml.includes('failed') || ml.includes('not found') || ml.includes('404');
      if (isNetwork) {
        setErr('Sin conexión al servidor. Verifica tu internet e intenta de nuevo.');
      } else {
        var na = attempts + 1; setAttempts(na);
        if (na >= 5) {
          setBlocked(true);
          setErr('5 intentos fallidos — bloqueado 5 minutos.');
          // Desbloquear automáticamente después de 5 minutos
          setTimeout(function() { setBlocked(false); setAttempts(0); setErr(''); }, 5 * 60 * 1000);
        } else {
          setErr((msg || 'Email o contraseña incorrectos.') + ' Intentos restantes: ' + (5 - na));
        }
      }
    }
  }

  /** Verifica el código de 2FA ingresado por el usuario. */
  async function doVerify2fa() {
    if (!twoFaCode.trim()) { setTwoFaErr('Ingresá el código.'); return; }
    setTwoFaLoading(true); setTwoFaErr('');
    try {
      var r = await authAPI.verify2fa(twoFaEmail, twoFaCode.trim());
      if (r && r.user) {
        setTwoFaLoading(false);
        onLogin(createSession(
          { id: r.user.id, name: r.user.name, email: r.user.email, role: r.user.role, tenant_id: r.user.tenant_id },
          r.token,
          r.refreshToken
        ));
      }
    } catch (e) {
      setTwoFaLoading(false);
      setTwoFaErr((e && e.error) ? e.error : 'Código incorrecto o expirado.');
    }
  }

  /** Busca el usuario por email para iniciar la recuperación de contraseña. */
  async function doFindUser() {
    setRecErr('');
    if (!recEmail.trim()) { setRecErr('Ingresá tu email.'); return; }
    try {
      var res = await authAPI.findUser(recEmail.trim());
      setRecUser({ email: recEmail.trim().toLowerCase(), name: res.name, secQuestion: res.secQuestion, source: 'api' });
      setRecMode('question');
    } catch (e) {
      var em = (e && e.error) ? e.error : '';
      // Si es error de conexión, intentar con datos locales (modo offline)
      if (em && em !== 'Error de conexion') { setRecErr(em); return; }
      var users = await db.load(UK, []);
      var user = (users || []).find(function(u) { return String(u.email || '').toLowerCase() === recEmail.trim().toLowerCase() && u.active; });
      if (!user) { setRecErr('No se encontró una cuenta activa con ese email.'); return; }
      if (!user.secQuestion) { setRecErr('Esta cuenta no tiene pregunta de seguridad configurada. Contactá al administrador del sistema.'); return; }
      setRecUser(Object.assign({}, user, { source: 'local' }));
      setRecMode('question');
    }
  }

  /** Verifica la respuesta a la pregunta de seguridad. */
  async function doVerifyAnswer() {
    setRecErr('');
    if (!recAnswer.trim()) { setRecErr('Ingresá la respuesta.'); return; }
    if (recUser && recUser.source === 'api') {
      // Verificar contra la API — la API devuelve un token de un solo uso (15 min)
      try {
        var vr = await authAPI.verifyAnswer(recUser.email, recAnswer.trim());
        setRecResetToken(vr.resetToken || '');
        setRecMode('newpass');
      } catch (e) { setRecErr((e && e.error) ? e.error : 'Respuesta incorrecta.'); }
      return;
    }
    // Verificar localmente con hash SHA-256 (modo offline)
    var ansHash = await hashPass(recAnswer.trim().toLowerCase());
    if (ansHash !== recUser.secAnswerHash) { setRecErr('Respuesta incorrecta.'); return; }
    setRecMode('newpass');
  }

  /** Guarda la nueva contraseña del usuario. */
  async function doResetPass() {
    setRecErr('');
    if (!newPass || newPass.length < 8) { setRecErr('La contraseña debe tener mínimo 8 caracteres.'); return; }
    if (newPass !== newPass2) { setRecErr('Las contraseñas no coinciden.'); return; }
    if (recUser && recUser.source === 'api') {
      // Usar el token de un solo uso emitido por verify-answer
      try {
        await authAPI.resetPassword(recResetToken, newPass);
        setRecOk('¡Contraseña actualizada! Ya podés iniciar sesión.');
        setRecMode('done');
      } catch (e) {
        setRecErr((e && e.error) ? e.error : 'No se pudo actualizar la contraseña. El token puede haber expirado — volvé a verificar tu respuesta.');
      }
      return;
    }
    // Guardar localmente (modo offline)
    var newHash = await hashPass(newPass);
    var users = await db.load(UK, []);
    var updated = users.map(function(u) { return u.id === recUser.id ? Object.assign({}, u, { passwordHash: newHash }) : u; });
    await db.save(UK, updated);
    setRecOk('¡Contraseña actualizada! Ya podés iniciar sesión.');
    setRecMode('done');
  }

  // ── Campo de contraseña con botón para mostrar/ocultar ───────────────────
  function renderPassField(label, val, setter, show, setShow) {
    return (
      <div style={{ marginBottom: 18 }}>
        <label style={lblSt}>{label}</label>
        <div style={{ position: 'relative' }}>
          <input
            type={show ? 'text' : 'password'}
            style={Object.assign({}, inBg, { paddingRight: 44 })}
            value={val}
            placeholder="••••••••"
            onChange={function(e) { setter(e.target.value); setRecErr(''); }}
            onKeyDown={function(e) { if (e.key === 'Enter' && recMode === 'newpass') doResetPass(); }}
          />
          <span onClick={function() { setShow(!show); }} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 16, userSelect: 'none' }}>
            {show ? '🙈' : '👁'}
          </span>
        </div>
      </div>
    );
  }

  // ── Render principal ──────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0e1e2e 0%,' + NAVY + ' 60%,#1a3a2a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo del sistema */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg,' + TEAL + ',#0a6b4a)', marginBottom: 16, boxShadow: '0 8px 24px rgba(29,158,117,0.4)' }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <rect x="5" y="2" width="14" height="20" rx="2.5" stroke="white" strokeWidth="1.8"/>
              <circle cx="12" cy="17.5" r="1.4" fill="white"/>
              <line x1="9" y1="5.5" x2="15" y2="5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <p style={{ color: '#fff', fontSize: 26, fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.5px' }}>{APP_NAME}</p>
          <p style={{ color: TEAL, fontSize: 13, fontWeight: 600, margin: 0, letterSpacing: '1px' }}>{APP_TAGLINE}</p>
        </div>

        {/* Tarjeta del formulario */}
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', padding: 32 }}>

          {/* ── FLUJO 2FA — verificación de código ─────────────────────── */}
          {needs2fa && (
            <div>
              <p style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: '0 0 8px', textAlign: 'center' }}>Verificación en dos pasos</p>
              <p style={{ color: '#aaa', fontSize: 13, textAlign: 'center', margin: '0 0 24px' }}>Ingresá el código de 6 dígitos que enviamos a tu correo. Válido por 10 minutos.</p>
              {twoFaErr && <div style={{ background: 'rgba(226,75,74,0.15)', border: '1px solid rgba(226,75,74,0.4)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#F09595', fontSize: 13 }}>⚠ {twoFaErr}</div>}
              <input
                value={twoFaCode}
                onChange={function(e) { setTwoFaCode(e.target.value); }}
                onKeyDown={function(e) { if (e.key === 'Enter') doVerify2fa(); }}
                placeholder="Código de 6 dígitos"
                maxLength={6}
                inputMode="numeric"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 22, textAlign: 'center', letterSpacing: 8, outline: 'none', boxSizing: 'border-box', marginBottom: 16 }}
              />
              <button onClick={doVerify2fa} disabled={twoFaLoading} style={{ width: '100%', padding: '13px', borderRadius: 8, border: 'none', background: TEAL, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                {twoFaLoading ? 'Verificando...' : 'Verificar código'}
              </button>
              <button onClick={function() { setNeeds2fa(false); setTwoFaCode(''); setTwoFaErr(''); }} style={{ width: '100%', marginTop: 10, padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#aaa', fontSize: 13, cursor: 'pointer' }}>
                ← Volver al login
              </button>
            </div>
          )}

          {/* ── FLUJO LOGIN — formulario principal ─────────────────────── */}
          {!needs2fa && recMode === 'login' && (
            <div>
              <p style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: '0 0 24px', textAlign: 'center' }}>Iniciar sesión</p>
              {err && <div style={{ background: 'rgba(226,75,74,0.15)', border: '1px solid rgba(226,75,74,0.4)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#F09595', fontSize: 13 }}>⚠ {err}</div>}
              <div style={{ marginBottom: 14 }}>
                <label style={lblSt}>Correo electrónico</label>
                <input type="email" style={inBg} value={email} placeholder="tu@correo.com"
                  onChange={function(e) { setEmail(e.target.value); setErr(''); }} onKeyDown={handleKey} />
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={lblSt}>Contraseña</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} style={Object.assign({}, inBg, { paddingRight: 44 })} value={pass} placeholder="••••••••"
                    onChange={function(e) { setPass(e.target.value); setErr(''); }} onKeyDown={handleKey} />
                  <span onClick={function() { setShowPass(!showPass); }} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 16, userSelect: 'none' }}>
                    {showPass ? '🙈' : '👁'}
                  </span>
                </div>
              </div>
              <div style={{ textAlign: 'right', marginBottom: 20 }}>
                <span onClick={function() { setRecMode('recover'); setRecErr(''); setRecEmail(''); }} style={{ color: TEAL, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
                  ¿Olvidaste tu contraseña?
                </span>
              </div>
              <button onClick={doLogin} disabled={loading || blocked} style={Object.assign({}, btnPrimary, { background: loading || blocked ? 'rgba(255,255,255,0.1)' : TEAL, cursor: loading || blocked ? 'not-allowed' : 'pointer' })}>
                {loading ? 'Verificando...' : blocked ? '🔒 Bloqueado' : 'Ingresar al sistema'}
              </button>
              <button onClick={onBack} style={{ marginTop: 12, width: '100%', padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer' }}>
                ← Volver al inicio
              </button>
            </div>
          )}

          {/* ── RECUPERACIÓN: paso 1 — ingresar email ──────────────────── */}
          {recMode === 'recover' && (
            <div>
              <p style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: '0 0 8px', textAlign: 'center' }}>Recuperar acceso</p>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: '0 0 24px', textAlign: 'center' }}>Ingresá tu correo para verificar tu identidad</p>
              {recErr && <div style={{ background: 'rgba(226,75,74,0.15)', border: '1px solid rgba(226,75,74,0.4)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#F09595', fontSize: 13 }}>⚠ {recErr}</div>}
              <div style={{ marginBottom: 20 }}>
                <label style={lblSt}>Correo electrónico</label>
                <input type="email" style={inBg} value={recEmail} placeholder="tu@correo.com"
                  onChange={function(e) { setRecEmail(e.target.value); setRecErr(''); }}
                  onKeyDown={function(e) { if (e.key === 'Enter') doFindUser(); }} />
              </div>
              <button onClick={doFindUser} style={btnPrimary}>Continuar</button>
              <button onClick={function() { setRecMode('login'); setRecErr(''); }} style={btnSecondary}>← Volver al login</button>
            </div>
          )}

          {/* ── RECUPERACIÓN: paso 2 — pregunta de seguridad ───────────── */}
          {recMode === 'question' && recUser && (
            <div>
              <p style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: '0 0 8px', textAlign: 'center' }}>Verificación de identidad</p>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: '0 0 24px', textAlign: 'center' }}>Respondé tu pregunta de seguridad</p>
              {recErr && <div style={{ background: 'rgba(226,75,74,0.15)', border: '1px solid rgba(226,75,74,0.4)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#F09595', fontSize: 13 }}>⚠ {recErr}</div>}
              <div style={{ background: 'rgba(29,158,117,0.1)', borderRadius: 8, padding: '12px 14px', marginBottom: 20, border: '1px solid rgba(29,158,117,0.2)' }}>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pregunta de seguridad</p>
                <p style={{ color: '#fff', fontSize: 14, margin: 0, fontWeight: 500 }}>{recUser.secQuestion}</p>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={lblSt}>Tu respuesta</label>
                <input type="text" style={inBg} value={recAnswer} placeholder="Ingresá tu respuesta..."
                  onChange={function(e) { setRecAnswer(e.target.value); setRecErr(''); }}
                  onKeyDown={function(e) { if (e.key === 'Enter') doVerifyAnswer(); }} />
              </div>
              <button onClick={doVerifyAnswer} style={btnPrimary}>Verificar respuesta</button>
              <button onClick={function() { setRecMode('login'); setRecErr(''); setRecAnswer(''); }} style={btnSecondary}>← Volver al login</button>
            </div>
          )}

          {/* ── RECUPERACIÓN: paso 3 — nueva contraseña ────────────────── */}
          {recMode === 'newpass' && (
            <div>
              <p style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: '0 0 8px', textAlign: 'center' }}>Nueva contraseña</p>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: '0 0 24px', textAlign: 'center' }}>Ingresá tu nueva contraseña (mín. 8 caracteres)</p>
              {recErr && <div style={{ background: 'rgba(226,75,74,0.15)', border: '1px solid rgba(226,75,74,0.4)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#F09595', fontSize: 13 }}>⚠ {recErr}</div>}
              {renderPassField('Nueva contraseña', newPass, setNewPass, showNewPass, setShowNewPass)}
              {renderPassField('Confirmar contraseña', newPass2, setNewPass2, showNewPass2, setShowNewPass2)}
              <button onClick={doResetPass} style={btnPrimary}>Guardar nueva contraseña</button>
            </div>
          )}

          {/* ── RECUPERACIÓN: paso 4 — confirmación ────────────────────── */}
          {recMode === 'done' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <p style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>¡Listo!</p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, margin: '0 0 24px' }}>{recOk}</p>
              <button
                onClick={function() { setRecMode('login'); setEmail(recUser.email); setPass(''); setRecUser(null); setRecAnswer(''); setNewPass(''); setNewPass2(''); }}
                style={btnPrimary}
              >
                Ir al login
              </button>
            </div>
          )}

        </div>
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, textAlign: 'center', marginTop: 16 }}>
          Sesión expira en 8 horas · Bloqueo tras 5 intentos fallidos
        </p>
      </div>
    </div>
  );
}
