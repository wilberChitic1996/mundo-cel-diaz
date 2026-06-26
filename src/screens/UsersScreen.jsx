// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA: UsersScreen (Gestión de Usuarios)
//
// Solo accesible para administradores. Permite:
//   - Ver la lista de usuarios del sistema
//   - Crear nuevos usuarios con nombre, email, contraseña, rol y pregunta de seguridad
//   - Editar datos de usuarios existentes
//   - Activar / desactivar cuentas de usuario
//
// Los datos se sincronizan con Supabase (API). Si la API no está disponible,
// se trabaja con una copia local en IndexedDB (modo offline).
//
// Props:
//   session   {Object}   — sesión del usuario actual (para saber quién es "tú")
//   showFlash {Function} — muestra mensajes temporales de éxito/error/aviso
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { TEAL, NAVY, sCard, sInput, sLabel, sTH, sTD, mkBtn, mkBadge } from '../styles/theme.js';
import { PERMS, ROLE_LABEL } from '../constants/index.js';
import { fmtD, fmtT, gid } from '../utils/formatters.js';
import { usersAPI } from '../utils/api.js';
import { db } from '../utils/db.js';

// Claves de almacenamiento local
var UK = 'mnpos-users-v1';

// Título de pantalla
var H1 = { fontSize: 'clamp(17px,4vw,22px)', fontWeight: 600, margin: '0 0 16px', color: 'var(--text-primary,#1a1a1a)' };

// Preguntas de seguridad disponibles para los usuarios
var PREGUNTAS_SEGURIDAD = [
  '¿Cuál es el nombre de tu primera mascota?',
  '¿En qué ciudad naciste?',
  '¿Cuál es el apellido de soltera de tu madre?',
  '¿Cuál fue el nombre de tu primera escuela?',
  '¿Cuál es tu comida favorita?',
];

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

// Componente de métrica simple
function MetricBox({ label, value, color }) {
  return (
    <div style={{ background: '#f5f4f0', borderRadius: 10, padding: '16px', border: '1px solid rgba(0,0,0,0.07)' }}>
      <p style={{ fontSize: 12, color: '#666', margin: '0 0 6px' }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 600, margin: 0, color: color || '#1a1a1a' }}>{value}</p>
    </div>
  );
}

export default function UsersScreen({ session, showFlash }) {
  session    = session    || {};
  showFlash  = showFlash  || function() {};

  // ── Estado de la lista de usuarios ───────────────────────────────────────
  var _u   = useState([]);    var users       = _u[0];   var setUsers       = _u[1];
  var _uld = useState(false); var usersLoaded = _uld[0]; var setUsersLoaded = _uld[1];

  // ── Estado del formulario de crear/editar usuario ─────────────────────────
  var _sf  = useState(false);    var showForm = _sf[0];  var setShowForm = _sf[1];
  var _eu  = useState(null);     var editUser = _eu[0];  var setEditUser = _eu[1];
  var _fn  = useState('');       var fName    = _fn[0];  var setFName    = _fn[1];
  var _fe  = useState('');       var fEmail   = _fe[0];  var setFEmail   = _fe[1];
  var _fp  = useState('');       var fPass    = _fp[0];  var setFPass    = _fp[1];
  var _fr  = useState('cajero'); var fRole    = _fr[0];  var setFRole    = _fr[1];
  var _fer = useState('');       var fErr     = _fer[0]; var setFErr     = _fer[1];
  var _fsq = useState('');       var fSecQ    = _fsq[0]; var setFSecQ    = _fsq[1];
  var _fsa = useState('');       var fSecA    = _fsa[0]; var setFSecA    = _fsa[1];

  // ── Cargar usuarios al montar el componente ───────────────────────────────
  useEffect(function() {
    async function load() {
      // Primero cargar desde caché local
      var u = await db.load(UK, []);
      setUsers(u || []);
      try {
        // Luego sincronizar con Supabase
        var apiUsers = await usersAPI.getAll();
        if (apiUsers && apiUsers.length > 0) {
          // Combinar datos de la API con datos locales (para mantener passwordHash local)
          var merged = apiUsers.map(function(au) {
            var auEmail = String(au.email || '').toLowerCase();
            var local   = (u || []).find(function(lu) { return String(lu.email || '').toLowerCase() === auEmail; });
            return {
              id:            au.id,
              name:          au.name,
              email:         au.email,
              role:          au.role,
              active:        au.active,
              passwordHash:  local ? local.passwordHash : '',
              secQuestion:   au.sec_question || (local ? local.secQuestion : ''),
              secAnswerHash: local ? local.secAnswerHash : '',
              lastLogin:     au.last_login || null,
              createdAt:     au.created_at || new Date().toISOString(),
            };
          });
          setUsers(merged);
          await db.save(UK, merged);
        }
      } catch (e) { console.warn('No se pudo cargar usuarios desde API:', e); }
      setUsersLoaded(true);
    }
    load();
  }, []);

  // Guardar en caché local cada vez que cambia la lista
  useEffect(function() {
    if (usersLoaded) db.save(UK, users);
  }, [users, usersLoaded]);

  // ── Resetear el formulario a su estado inicial ────────────────────────────
  function resetForm() {
    setFName(''); setFEmail(''); setFPass(''); setFRole('cajero');
    setFErr(''); setFSecQ(''); setFSecA(''); setEditUser(null); setShowForm(false);
  }

  // ── Guardar usuario (crear o actualizar) ──────────────────────────────────
  async function saveUser() {
    if (!fName.trim() || !fEmail.trim()) { setFErr('Nombre y email son obligatorios'); return; }
    // Verificar que no haya duplicado de email
    var dup = users.find(function(u) { return String(u.email || '').toLowerCase() === fEmail.trim().toLowerCase() && (!editUser || u.id !== editUser.id); });
    if (dup) { setFErr('Ya existe un usuario con ese email'); return; }
    if (!editUser && !fPass.trim()) { setFErr('La contraseña es obligatoria para usuarios nuevos'); return; }
    if (fPass && fPass.length < 8) { setFErr('Contraseña: mínimo 8 caracteres'); return; }

    var hash          = fPass ? await hashPass(fPass) : (editUser ? editUser.passwordHash : '');
    var secAnswerHash = fSecA ? await hashPass(fSecA.trim().toLowerCase()) : (editUser ? editUser.secAnswerHash : '');
    var secQuestion   = fSecQ || (editUser ? editUser.secQuestion : '');

    if (editUser) {
      // Actualizar usuario existente
      setUsers(function(p) { return p.map(function(u) { return u.id === editUser.id ? Object.assign({}, u, { name: fName.trim(), email: fEmail.trim(), role: fRole, passwordHash: hash, secQuestion: secQuestion, secAnswerHash: secAnswerHash }) : u; }); });
      try {
        var upd = { name: fName.trim(), email: fEmail.trim(), role: fRole, active: editUser.active, secQuestion: fSecQ };
        if (fPass) upd.password = fPass;
        if (fSecA) upd.secAnswer = fSecA;
        await usersAPI.update(editUser.id, upd);
      } catch (e) { console.warn('Sync Supabase user update:', e); }
      showFlash('✓ Usuario actualizado', 'ok');
    } else {
      // Crear usuario nuevo
      setUsers(function(p) {
        return p.concat([{ id: gid(), name: fName.trim(), email: fEmail.trim(), passwordHash: hash, role: fRole, active: true, createdAt: new Date().toISOString(), secQuestion: secQuestion, secAnswerHash: secAnswerHash }]);
      });
      try { await usersAPI.create({ name: fName.trim(), email: fEmail.trim(), password: fPass, role: fRole, secQuestion: fSecQ, secAnswer: fSecA }); } catch (e) { console.warn('Sync Supabase user create:', e); }
      showFlash('✓ Usuario creado', 'ok');
    }
    resetForm();
  }

  // ── Activar / desactivar cuenta de usuario ────────────────────────────────
  async function toggleActive(uid) {
    // No se puede desactivar la propia cuenta
    if (uid === session.userId) { showFlash('No podés desactivar tu propia cuenta', 'warn'); return; }
    // Debe quedar al menos un administrador activo
    var admins = users.filter(function(u) { return u.role === 'admin' && u.active; });
    var tgt    = users.find(function(u) { return u.id === uid; });
    if (tgt && tgt.role === 'admin' && admins.length <= 1 && tgt.active) { showFlash('Debe existir al menos un administrador activo', 'warn'); return; }
    var newActive = !tgt.active;
    setUsers(function(p) { return p.map(function(u) { return u.id === uid ? Object.assign({}, u, { active: newActive }) : u; }); });
    try { await usersAPI.update(uid, { active: newActive }); } catch (e) { console.warn('Sync Supabase toggleActive:', e); }
  }

  // ── Cargar datos del usuario en el formulario para editar ─────────────────
  function startEdit(u) {
    setEditUser(u); setFName(u.name); setFEmail(u.email); setFPass('');
    setFRole(u.role); setFErr(''); setFSecQ(u.secQuestion || ''); setFSecA(''); setShowForm(true);
  }

  return (
    <div>
      {/* Encabezado con botón de acción */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <p style={H1}>👥 Usuarios del Sistema</p>
        <button style={mkBtn('teal')} onClick={function() { resetForm(); setShowForm(true); }}>+ Nuevo usuario</button>
      </div>

      {/* Formulario de crear/editar usuario */}
      {showForm && (
        <div style={Object.assign({}, sCard, { marginBottom: 16, borderColor: TEAL, borderWidth: '1.5px' })}>
          <p style={{ fontWeight: 600, margin: '0 0 16px', fontSize: 15 }}>{editUser ? '✏️ Editar usuario' : '➕ Nuevo usuario'}</p>
          {fErr && <p style={{ color: '#E24B4A', fontSize: 13, margin: '0 0 10px' }}>⚠ {fErr}</p>}
          <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={sLabel}>Nombre</label>
              <input style={sInput} value={fName} placeholder="Nombre completo" onChange={function(e) { setFErr(''); setFName(e.target.value); }} />
            </div>
            <div>
              <label style={sLabel}>Email</label>
              <input type="email" style={sInput} value={fEmail} placeholder="email@ejemplo.com" onChange={function(e) { setFErr(''); setFEmail(e.target.value); }} />
            </div>
            <div>
              <label style={sLabel}>{editUser ? 'Nueva contraseña (vacío = no cambiar)' : 'Contraseña (mín. 8 chars)'}</label>
              <input type="password" style={sInput} value={fPass} placeholder="••••••••" onChange={function(e) { setFErr(''); setFPass(e.target.value); }} />
            </div>
            <div>
              <label style={sLabel}>Pregunta de seguridad</label>
              <select style={sInput} value={fSecQ} onChange={function(e) { setFSecQ(e.target.value); }}>
                <option value="">— Seleccioná una pregunta —</option>
                {PREGUNTAS_SEGURIDAD.map(function(q) { return <option key={q} value={q}>{q}</option>; })}
              </select>
            </div>
            <div>
              <label style={sLabel}>Respuesta de seguridad</label>
              <input type="text" style={sInput} value={fSecA} placeholder="Tu respuesta (no distingue mayúsculas)" onChange={function(e) { setFErr(''); setFSecA(e.target.value); }} />
            </div>
            <div>
              <label style={sLabel}>Rol</label>
              <select style={sInput} value={fRole} onChange={function(e) { setFRole(e.target.value); }}>
                <option value="admin">Administrador</option>
                <option value="cajero">Cajero</option>
                <option value="auditor">Auditor (solo lectura)</option>
              </select>
            </div>
          </div>
          {/* Mostrar qué módulos puede acceder el rol seleccionado */}
          <div style={{ background: '#f5f4f0', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 12, color: '#666' }}>
            <b>Acceso del rol:</b> {(PERMS[fRole] || []).join(' · ')}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={mkBtn('teal')} onClick={saveUser}>{editUser ? 'Guardar cambios' : 'Crear usuario'}</button>
            <button style={mkBtn('gray')} onClick={resetForm}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Métricas resumen */}
      <div className="rg-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        <MetricBox label="Total usuarios"   value={users.length}                                            color={TEAL} />
        <MetricBox label="Activos"          value={users.filter(function(u) { return u.active; }).length}   color="#378ADD" />
        <MetricBox label="Administradores"  value={users.filter(function(u) { return u.role === 'admin'; }).length} color="#7F77DD" />
      </div>

      {/* Tabla de usuarios */}
      <div style={sCard}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['#', 'Nombre', 'Email', 'Rol', 'Estado', 'Seguridad', 'Último acceso', ''].map(function(h) {
                return <th key={h} style={h === '#' ? Object.assign({}, sTH, { width: 40, textAlign: 'center' }) : sTH}>{h}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {users.map(function(u, index) {
              var isSelf = u.id === session.userId;
              return (
                <tr key={u.id}>
                  <td style={Object.assign({}, sTD, { textAlign: 'center', color: '#999', fontSize: 12 })}>{index + 1}</td>
                  <td style={Object.assign({}, sTD, { fontWeight: 600 })}>
                    {u.name}
                    {isSelf && <span style={{ fontSize: 11, color: TEAL, marginLeft: 6 }}>(tú)</span>}
                  </td>
                  <td style={Object.assign({}, sTD, { fontFamily: 'monospace', fontSize: 12 })}>{u.email}</td>
                  <td style={sTD}>
                    <span style={mkBadge(u.role === 'admin' ? 'teal' : u.role === 'cajero' ? 'blue' : 'purple')}>
                      {ROLE_LABEL[u.role] || u.role}
                    </span>
                  </td>
                  <td style={sTD}><span style={mkBadge(u.active ? 'green' : 'red')}>{u.active ? '✓ Activo' : '✗ Inactivo'}</span></td>
                  <td style={sTD}><span style={mkBadge(u.secQuestion ? 'green' : 'amber')}>{u.secQuestion ? '✓ Configurada' : '⚠ Sin configurar'}</span></td>
                  <td style={Object.assign({}, sTD, { color: '#666', fontSize: 12 })}>
                    {u.lastLogin ? fmtD(u.lastLogin) + ' ' + fmtT(u.lastLogin) : 'Nunca'}
                  </td>
                  <td style={sTD}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={Object.assign({}, mkBtn('blue'), { padding: '4px 8px', fontSize: 11 })} onClick={function() { startEdit(u); }}>✏</button>
                      <button style={Object.assign({}, mkBtn(u.active ? 'red' : 'green'), { padding: '4px 8px', fontSize: 11 })} onClick={function() { toggleActive(u.id); }}>
                        {u.active ? 'Desactivar' : 'Activar'}
                      </button>
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
