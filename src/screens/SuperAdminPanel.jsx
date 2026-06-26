// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA: SuperAdminPanel (Panel de Super Administrador)
//
// Solo visible para el rol "superadmin". Permite gestionar todos los negocios
// (tenants) de la plataforma desde una sola vista.
//
// Tabs:
//   🏢 Negocios  — tabla de todos los tenants con acciones
//   ➕ Nuevo negocio — formulario para crear un tenant con su admin
//   👤 Mi cuenta — actualizar nombre, email y contraseña del superadmin
//
// Por negocio (tenant) se puede:
//   - Ver y gestionar sus usuarios (abrir modal de usuarios)
//   - Activar / desactivar el negocio
//   - Renovar suscripción (1, 3, 6 o 12 meses)
//   - Editar datos (nombre, plan, propietario, teléfono, email, notas)
//   - Eliminar permanentemente (con confirmación de doble paso)
//
// Por usuario dentro del modal:
//   - Resetear contraseña
//   - Activar / desactivar
//   - Eliminar
//   - Crear nuevo usuario
//
// Props:
//   session {Object} — sesión activa (name, role=superadmin)
//   theme   {string} — "light" | "dark"
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { TEAL, NAVY, mkBtn, mkBadge } from '../styles/theme.js';
import { adminAPI } from '../utils/api.js';

// Planes de suscripción y sus colores de badge
var PLANS      = { basic: 'Básico', professional: 'Profesional', enterprise: 'Empresarial' };
var PLAN_COLOR = { basic: '#888',  professional: TEAL,           enterprise: '#9B59B6'     };
var ROLE_COL   = { admin: TEAL,   cajero: '#378ADD',            auditor: '#7F77DD'         };

// ── Estilos locales adaptados a variables CSS de tema ────────────────────
var saCard  = { background: 'var(--bg-card,#fff)', borderRadius: 12, boxShadow: '0 2px 10px var(--shadow,rgba(0,0,0,0.05))', border: '1px solid var(--border-card,rgba(0,0,0,0.09))' };
var saTH    = { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary,#666)', textTransform: 'uppercase', borderBottom: '2px solid var(--border-table,rgba(0,0,0,0.08))', background: 'var(--bg-table-head,#f5f4f0)', whiteSpace: 'nowrap' };
var saTD    = { padding: '12px', fontSize: 13, verticalAlign: 'middle', color: 'var(--text-primary,#1a1a1a)', borderBottom: '1px solid var(--border-row,rgba(0,0,0,0.05))' };
var saInput = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-input,rgba(0,0,0,0.2))', fontSize: 14, background: 'var(--bg-input,#fff)', color: 'var(--text-primary,#1a1a1a)', boxSizing: 'border-box', outline: 'none' };

// Badge de vencimiento de suscripción (verde / ámbar / rojo)
function ExpiryBadge({ expiresAt }) {
  if (!expiresAt) return <span style={Object.assign({}, mkBadge('#aaa'), { fontSize: 10 })}>Sin fecha</span>;
  var days = Math.ceil((new Date(expiresAt) - new Date()) / 86400000);
  if (days < 0)   return <span style={Object.assign({}, mkBadge('#E24B4A'), { fontSize: 10 })}>Vencido</span>;
  if (days <= 7)  return <span style={Object.assign({}, mkBadge('#F39C12'), { fontSize: 10 })}>⚠ {days}d</span>;
  if (days <= 30) return <span style={Object.assign({}, mkBadge('#f5a623'), { fontSize: 10 })}>{days}d</span>;
  return <span style={Object.assign({}, mkBadge(TEAL), { fontSize: 10 })}>{days}d</span>;
}

export default function SuperAdminPanel({ session, theme }) {
  session = session || {};

  var _tenants     = useState([]); var tenants     = _tenants[0];     var setTenants     = _tenants[1];
  var _stats       = useState(null); var stats     = _stats[0];       var setStats       = _stats[1];
  var _loading     = useState(true); var loading   = _loading[0];     var setLoading     = _loading[1];
  var _tab         = useState('tenants'); var tab   = _tab[0];        var setTab         = _tab[1];
  var _saving      = useState(false); var saving    = _saving[0];     var setSaving      = _saving[1];
  var _flash       = useState(null); var flash      = _flash[0];      var setFlash       = _flash[1];

  // Renovación de suscripción: { [tenantId]: meses }
  var _renew       = useState({}); var renewMonths  = _renew[0];     var setRenewMonths  = _renew[1];
  var _renewSaving = useState({}); var renewSaving  = _renewSaving[0]; var setRenewSaving = _renewSaving[1];

  // Modal: lista de usuarios del tenant
  var _umodal      = useState(null); var usersModal  = _umodal[0];   var setUsersModal   = _umodal[1];
  var _uload       = useState(false); var usersLoading= _uload[0];   var setUsersLoading = _uload[1];
  var _rpw         = useState({}); var resetPwMap    = _rpw[0];      var setResetPwMap   = _rpw[1];
  var _rsaving     = useState({}); var resetSaving   = _rsaving[0];  var setResetSaving  = _rsaving[1];

  // Modal: editar tenant
  var _emod        = useState(null); var editModal    = _emod[0];    var setEditModal    = _emod[1];
  var _esav        = useState(false); var editSaving  = _esav[0];    var setEditSaving   = _esav[1];

  // Modal: confirmar eliminar tenant
  var _dconf       = useState(null); var deleteConfirm= _dconf[0];   var setDeleteConfirm= _dconf[1];
  var _dsav        = useState(false); var deleteSaving = _dsav[0];   var setDeleteSaving = _dsav[1];

  // Formulario nuevo usuario (dentro del modal de usuarios)
  var _nuf         = useState(null); var newUserForm  = _nuf[0];     var setNewUserForm  = _nuf[1];
  var _nusav       = useState(false); var newUserSaving= _nusav[0];  var setNewUserSaving= _nusav[1];

  // Confirmar eliminar usuario
  var _duconf      = useState(null); var deleteUserConfirm= _duconf[0]; var setDeleteUserConfirm= _duconf[1];
  var _dusav       = useState(false); var deleteUserSaving = _dusav[0]; var setDeleteUserSaving = _dusav[1];

  // Tab Mi Cuenta
  var _mcn  = useState(''); var mcName    = _mcn[0];  var setMcName    = _mcn[1];
  var _mce  = useState(''); var mcEmail   = _mce[0];  var setMcEmail   = _mce[1];
  var _mcc  = useState(''); var mcCurrent = _mcc[0];  var setMcCurrent = _mcc[1];
  var _mcnp = useState(''); var mcNew     = _mcnp[0]; var setMcNew     = _mcnp[1];
  var _mcsav= useState(false); var mcSaving= _mcsav[0]; var setMcSaving= _mcsav[1];

  // Formulario nuevo tenant
  var _fn   = useState('');      var fName       = _fn[0];   var setFName       = _fn[1];
  var _fp   = useState('basic'); var fPlan       = _fp[0];   var setFPlan       = _fp[1];
  var _fe   = useState('');      var fEmail      = _fe[0];   var setFEmail      = _fe[1];
  var _fph  = useState('');      var fPhone      = _fph[0];  var setFPhone      = _fph[1];
  var _fo   = useState('');      var fOwner      = _fo[0];   var setFOwner      = _fo[1];
  var _fae  = useState('');      var fAdminEmail = _fae[0];  var setFAdminEmail = _fae[1];
  var _fap  = useState('');      var fAdminPass  = _fap[0];  var setFAdminPass  = _fap[1];
  var _fm   = useState('1');     var fMonths     = _fm[0];   var setFMonths     = _fm[1];
  var _fsk  = useState(true);    var fSkipWizard = _fsk[0];  var setFSkipWizard = _fsk[1];

  function showMsg(msg, type) { setFlash({ msg, type }); setTimeout(function() { setFlash(null); }, 3500); }

  function reload() {
    setLoading(true);
    Promise.all([adminAPI.getTenants(), adminAPI.getStats()])
      .then(function(res) { setTenants(res[0] || []); setStats(res[1]); })
      .catch(function() { showMsg('Error cargando datos', 'error'); })
      .finally(function() { setLoading(false); });
  }
  useEffect(function() { reload(); }, []);

  // ── Acciones de tenant ────────────────────────────────────────────────

  async function openUsers(t) {
    setUsersModal({ tenant: t, users: [] });
    setUsersLoading(true);
    try {
      var users = await adminAPI.getTenantUsers(t.id);
      setUsersModal({ tenant: t, users });
    } catch(e) { showMsg('Error cargando usuarios', 'error'); setUsersModal(null); }
    setUsersLoading(false);
  }

  async function toggleActive(t) {
    try {
      var updated = await adminAPI.updateTenant(t.id, { active: !t.active });
      setTenants(function(prev) { return prev.map(function(x) { return x.id === t.id ? updated : x; }); });
      showMsg('Negocio ' + (updated.active ? 'activado' : 'desactivado'), 'ok');
    } catch(e) { showMsg('Error actualizando negocio', 'error'); }
  }

  async function renewTenant(t) {
    var m = Number(renewMonths[t.id] || 1);
    setRenewSaving(function(prev) { return Object.assign({}, prev, { [t.id]: true }); });
    try {
      var updated = await adminAPI.updateTenant(t.id, { months: m });
      setTenants(function(prev) { return prev.map(function(x) { return x.id === t.id ? updated : x; }); });
      showMsg('Suscripción renovada por ' + m + ' mes(es)', 'ok');
    } catch(e) { showMsg('Error renovando suscripción', 'error'); }
    setRenewSaving(function(prev) { return Object.assign({}, prev, { [t.id]: false }); });
  }

  async function saveEditTenant() {
    if (!editModal) return;
    setEditSaving(true);
    try {
      var updated = await adminAPI.updateTenant(editModal.id, {
        name: editModal.name, plan: editModal.plan,
        email: editModal.email || null, phone: editModal.phone || null,
        ownerName: editModal.owner_name || null, notes: editModal.notes || null,
      });
      setTenants(function(prev) { return prev.map(function(x) { return x.id === updated.id ? Object.assign({}, x, updated) : x; }); });
      showMsg('Negocio actualizado', 'ok');
      setEditModal(null);
    } catch(e) { showMsg(e.error || 'Error actualizando negocio', 'error'); }
    setEditSaving(false);
  }

  async function doDeleteTenant() {
    if (!deleteConfirm) return;
    setDeleteSaving(true);
    try {
      await adminAPI.deleteTenant(deleteConfirm.id);
      setTenants(function(prev) { return prev.filter(function(x) { return x.id !== deleteConfirm.id; }); });
      showMsg('Negocio eliminado permanentemente', 'ok');
      setDeleteConfirm(null);
    } catch(e) { showMsg(e.error || 'Error eliminando negocio', 'error'); }
    setDeleteSaving(false);
  }

  async function createTenant() {
    if (!fName || !fAdminEmail || !fAdminPass) { showMsg('Nombre, email admin y contraseña son requeridos', 'error'); return; }
    setSaving(true);
    try {
      var res = await adminAPI.createTenant({ name: fName, plan: fPlan, email: fEmail, phone: fPhone, ownerName: fOwner, adminEmail: fAdminEmail, adminPassword: fAdminPass, months: Number(fMonths), skipWizard: fSkipWizard });
      setTenants(function(prev) { return [res.tenant].concat(prev); });
      showMsg('Negocio creado exitosamente', 'ok');
      setTab('tenants');
      setFName(''); setFPlan('basic'); setFEmail(''); setFPhone(''); setFOwner(''); setFAdminEmail(''); setFAdminPass(''); setFMonths('1'); setFSkipWizard(true);
    } catch(e) { showMsg(e.error || 'Error al crear negocio', 'error'); }
    setSaving(false);
  }

  // ── Acciones de usuario ────────────────────────────────────────────────

  async function doResetPw(user) {
    var pw = resetPwMap[user.id];
    if (!pw || pw.length < 6) { showMsg('Escribe una contraseña de al menos 6 caracteres', 'error'); return; }
    setResetSaving(function(prev) { return Object.assign({}, prev, { [user.id]: true }); });
    try {
      await adminAPI.resetUserPassword(user.id, { newPassword: pw });
      setResetPwMap(function(prev) { var n = Object.assign({}, prev); delete n[user.id]; return n; });
      showMsg('Contraseña actualizada para ' + user.name, 'ok');
    } catch(e) { showMsg(e.error || 'Error al resetear contraseña', 'error'); }
    setResetSaving(function(prev) { return Object.assign({}, prev, { [user.id]: false }); });
  }

  async function doToggleUser(user) {
    try {
      var updated = await adminAPI.toggleUser(user.id);
      setUsersModal(function(prev) {
        if (!prev) return prev;
        return Object.assign({}, prev, { users: prev.users.map(function(u) { return u.id === updated.id ? Object.assign({}, u, { active: updated.active }) : u; }) });
      });
      showMsg(updated.name + ' ' + (updated.active ? 'activado' : 'desactivado'), 'ok');
    } catch(e) { showMsg('Error', 'error'); }
  }

  async function doCreateUser() {
    if (!newUserForm || !usersModal) return;
    if (!newUserForm.name || !newUserForm.email || !newUserForm.password) { showMsg('Todos los campos son requeridos', 'error'); return; }
    setNewUserSaving(true);
    try {
      var created = await adminAPI.createTenantUser(usersModal.tenant.id, newUserForm);
      setUsersModal(function(prev) { return prev ? Object.assign({}, prev, { users: [created].concat(prev.users) }) : prev; });
      setNewUserForm(null);
      showMsg('Usuario creado: ' + created.name, 'ok');
    } catch(e) { showMsg(e.error || 'Error creando usuario', 'error'); }
    setNewUserSaving(false);
  }

  async function doDeleteUser() {
    if (!deleteUserConfirm || !usersModal) return;
    setDeleteUserSaving(true);
    try {
      await adminAPI.deleteUser(deleteUserConfirm.id);
      setUsersModal(function(prev) { return prev ? Object.assign({}, prev, { users: prev.users.filter(function(u) { return u.id !== deleteUserConfirm.id; }) }) : prev; });
      showMsg('Usuario eliminado', 'ok');
      setDeleteUserConfirm(null);
    } catch(e) { showMsg(e.error || 'Error eliminando usuario', 'error'); }
    setDeleteUserSaving(false);
  }

  async function saveMyAccount() {
    if (!mcCurrent) { showMsg('Ingresa tu contraseña actual', 'error'); return; }
    setMcSaving(true);
    try {
      await adminAPI.updateMe({ name: mcName || undefined, email: mcEmail || undefined, currentPassword: mcCurrent, newPassword: mcNew || undefined });
      showMsg('Datos actualizados correctamente', 'ok');
      setMcCurrent(''); setMcNew('');
    } catch(e) { showMsg(e.error || 'Error al actualizar', 'error'); }
    setMcSaving(false);
  }

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════
  return (
    <div style={{ padding: 'clamp(16px,3vw,32px)', maxWidth: 1200, margin: '0 auto' }}>

      {/* Toast de notificaciones */}
      {flash && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '12px 20px', borderRadius: 10, background: flash.type === 'ok' ? '#1D9E75' : '#E24B4A', color: '#fff', fontWeight: 700, fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>
          {flash.msg}
        </div>
      )}

      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: NAVY }}>🏢 Panel Super Administrador</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>Gestión de negocios clientes de la plataforma</p>
        </div>
        <span style={Object.assign({}, mkBadge('#9B59B6'), { fontSize: 12 })}>SUPERADMIN: {session.name}</span>
      </div>

      {/* Estadísticas globales */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { lb: 'Total negocios',       val: stats.total_tenants,                                                                                ic: '🏢', c: NAVY },
            { lb: 'Negocios activos',     val: stats.active_tenants,                                                                              ic: '✅', c: TEAL },
            { lb: 'Vencen pronto (≤7d)', val: stats.expiring_soon || 0,                                                                           ic: '⚠️', c: '#F39C12' },
            { lb: 'Vencidos',             val: stats.expired || 0,                                                                                 ic: '❌', c: '#E24B4A' },
            { lb: 'Usuarios activos',     val: stats.total_users,                                                                                  ic: '👥', c: NAVY },
            { lb: 'Ingresos 30d',         val: 'Q ' + Number(stats.revenue_30d || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 }),        ic: '💰', c: TEAL },
          ].map(function(s) {
            return (
              <div key={s.lb} style={Object.assign({}, saCard, { padding: '14px 18px' })}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{s.ic}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.c }}>{s.val}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted,#888)', marginTop: 2 }}>{s.lb}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[['tenants', '🏢 Negocios'], ['crear', '➕ Nuevo negocio'], ['cuenta', '👤 Mi cuenta']].map(function(t) {
          return (
            <button key={t[0]} onClick={function() { setTab(t[0]); }} style={{ padding: '8px 18px', borderRadius: 20, border: 'none', background: tab === t[0] ? TEAL : 'var(--bg-alt,#e8e8e8)', color: tab === t[0] ? '#fff' : 'var(--text-primary,#333)', fontWeight: tab === t[0] ? 700 : 400, fontSize: 13, cursor: 'pointer' }}>
              {t[1]}
            </button>
          );
        })}
      </div>

      {/* ── Tab: Lista de negocios ── */}
      {tab === 'tenants' && (
        <div>
          {loading
            ? <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Cargando…</p>
            : tenants.length === 0
              ? <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Sin negocios registrados</p>
              : (
                <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border-card)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>{['Negocio', 'Plan', 'Usuarios', 'Estado', 'Vencimiento', 'Renovar', 'Acciones'].map(function(h) { return <th key={h} style={saTH}>{h}</th>; })}</tr>
                    </thead>
                    <tbody>
                      {tenants.map(function(t) {
                        return (
                          <tr key={t.id} style={{ borderBottom: '1px solid var(--border-row)', background: 'var(--bg-row)' }}>
                            <td style={saTD}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{t.name}</div>
                              {t.owner_name && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t.owner_name}</div>}
                              {t.email      && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.email}</div>}
                            </td>
                            <td style={saTD}><span style={Object.assign({}, mkBadge(PLAN_COLOR[t.plan] || '#888'), { fontSize: 11 })}>{PLANS[t.plan] || t.plan}</span></td>
                            <td style={saTD}><span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{t.user_count || 0}</span></td>
                            <td style={saTD}><span style={Object.assign({}, mkBadge(t.active ? TEAL : '#ccc'), { fontSize: 11 })}>{t.active ? 'Activo' : 'Inactivo'}</span></td>
                            <td style={saTD}>
                              <ExpiryBadge expiresAt={t.expires_at} />
                              {t.expires_at && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{new Date(t.expires_at).toLocaleDateString('es-GT')}</div>}
                            </td>
                            <td style={saTD}>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <select value={renewMonths[t.id] || '1'} onChange={function(e) { var id = t.id; setRenewMonths(function(prev) { return Object.assign({}, prev, { [id]: e.target.value }); }); }} style={{ padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border-input)', fontSize: 12, background: 'var(--bg-input)', color: 'var(--text-primary)' }}>
                                  <option value="1">1 mes</option>
                                  <option value="3">3 meses</option>
                                  <option value="6">6 meses</option>
                                  <option value="12">1 año</option>
                                </select>
                                <button onClick={function() { renewTenant(t); }} disabled={renewSaving[t.id]} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: TEAL, color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600, opacity: renewSaving[t.id] ? 0.6 : 1 }}>
                                  {renewSaving[t.id] ? '…' : 'Renovar'}
                                </button>
                              </div>
                            </td>
                            <td style={saTD}>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <button onClick={function() { openUsers(t); }} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid ' + TEAL, background: 'transparent', fontSize: 12, cursor: 'pointer', color: TEAL, fontWeight: 600 }}>👥 Usuarios</button>
                                <button onClick={function() { toggleActive(t); }} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border-card)', background: 'transparent', fontSize: 12, cursor: 'pointer', color: t.active ? '#E24B4A' : TEAL, fontWeight: 600 }}>{t.active ? 'Desactivar' : 'Activar'}</button>
                                <button onClick={function() { setEditModal(Object.assign({}, t)); }} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #378ADD', background: 'transparent', fontSize: 12, cursor: 'pointer', color: '#378ADD', fontWeight: 600 }}>✏️ Editar</button>
                                {t.phone && <a href={'https://wa.me/502' + t.phone.replace(/\D/g, '')} target="_blank" rel="noopener noreferrer" style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #25D366', background: 'transparent', fontSize: 12, color: '#25D366', fontWeight: 600, textDecoration: 'none' }}>📱</a>}
                                <button onClick={function() { setDeleteConfirm(t); }} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #E24B4A', background: 'transparent', fontSize: 12, cursor: 'pointer', color: '#E24B4A', fontWeight: 600 }}>🗑️</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
          }
        </div>
      )}

      {/* ── Tab: Mi cuenta ── */}
      {tab === 'cuenta' && (
        <div style={Object.assign({}, saCard, { maxWidth: 480, padding: 28 })}>
          <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>👤 Mi cuenta — SuperAdmin</h3>
          <p style={{ margin: '0 0 20px', fontSize: 12, color: 'var(--text-muted)' }}>Actualiza tu nombre, email o contraseña. Siempre se requiere la contraseña actual.</p>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Nombre</label>
          <input value={mcName} onChange={function(e) { setMcName(e.target.value); }} style={Object.assign({}, saInput, { marginBottom: 12 })} placeholder={session.name || 'Tu nombre'} />
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Email</label>
          <input type="email" value={mcEmail} onChange={function(e) { setMcEmail(e.target.value); }} style={Object.assign({}, saInput, { marginBottom: 16 })} placeholder={session.email || 'tu@email.com'} />
          <div style={{ background: 'var(--bg-alt)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
            <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: TEAL }}>🔒 Cambiar contraseña</p>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Contraseña actual *</label>
            <input type="password" value={mcCurrent} onChange={function(e) { setMcCurrent(e.target.value); }} style={Object.assign({}, saInput, { marginBottom: 10 })} placeholder="Tu contraseña actual" />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Nueva contraseña (opcional)</label>
            <input type="password" value={mcNew} onChange={function(e) { setMcNew(e.target.value); }} style={saInput} placeholder="Dejar vacío para no cambiar" />
          </div>
          <button onClick={saveMyAccount} disabled={mcSaving || !mcCurrent} style={Object.assign({}, mkBtn(TEAL), { width: '100%', padding: '13px', fontSize: 15, opacity: mcSaving || !mcCurrent ? 0.6 : 1 })}>
            {mcSaving ? 'Guardando…' : 'Guardar cambios ✓'}
          </button>
        </div>
      )}

      {/* ── Tab: Crear negocio ── */}
      {tab === 'crear' && (
        <div style={Object.assign({}, saCard, { maxWidth: 520, padding: 28 })}>
          <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, color: NAVY }}>➕ Registrar nuevo negocio</h3>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>Nombre del negocio *</label>
          <input value={fName} onChange={function(e) { setFName(e.target.value); }} style={Object.assign({}, saInput, { marginBottom: 12 })} placeholder="Ej: Celulería Pérez" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>Plan *</label>
              <select value={fPlan} onChange={function(e) { setFPlan(e.target.value); }} style={saInput}>
                <option value="basic">Básico</option>
                <option value="professional">Profesional</option>
                <option value="enterprise">Empresarial</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>Duración inicial</label>
              <select value={fMonths} onChange={function(e) { setFMonths(e.target.value); }} style={saInput}>
                <option value="1">1 mes</option>
                <option value="3">3 meses</option>
                <option value="6">6 meses</option>
                <option value="12">1 año</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>Nombre del propietario</label>
              <input value={fOwner} onChange={function(e) { setFOwner(e.target.value); }} style={saInput} placeholder="Carlos López" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>Teléfono</label>
              <input value={fPhone} onChange={function(e) { setFPhone(e.target.value); }} style={saInput} placeholder="55551234" />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>Email del negocio</label>
            <input type="email" value={fEmail} onChange={function(e) { setFEmail(e.target.value); }} style={saInput} placeholder="negocio@email.com" />
          </div>
          <div style={{ background: '#f0f9f5', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
            <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: TEAL }}>🔑 Credenciales del admin del negocio</p>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>Email admin *</label>
            <input type="email" value={fAdminEmail} onChange={function(e) { setFAdminEmail(e.target.value); }} style={Object.assign({}, saInput, { marginBottom: 10 })} placeholder="admin@negocio.com" />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>Contraseña inicial *</label>
            <input type="password" value={fAdminPass} onChange={function(e) { setFAdminPass(e.target.value); }} style={saInput} placeholder="Mínimo 6 caracteres" />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer', fontSize: 13, color: '#555' }}>
            <input type="checkbox" checked={fSkipWizard} onChange={function(e) { setFSkipWizard(e.target.checked); }} style={{ width: 16, height: 16, cursor: 'pointer' }} />
            Omitir asistente inicial (el negocio ya está configurado)
          </label>
          <button onClick={createTenant} disabled={saving || !fName || !fAdminEmail || !fAdminPass} style={Object.assign({}, mkBtn(TEAL), { width: '100%', padding: '13px', fontSize: 15, opacity: saving || !fName || !fAdminEmail || !fAdminPass ? 0.6 : 1 })}>
            {saving ? 'Creando…' : 'Crear negocio ✓'}
          </button>
        </div>
      )}

      {/* ── Modal: Usuarios del negocio ── */}
      {usersModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg-card,#fff)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>👥 Usuarios — {usersModal.tenant.name}</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Gestiona accesos y contraseñas del negocio</p>
              </div>
              <button onClick={function() { setUsersModal(null); setResetPwMap({}); }} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#aaa', lineHeight: 1 }}>✕</button>
            </div>

            {/* Botón y formulario de nuevo usuario */}
            {!newUserForm && (
              <button onClick={function() { setNewUserForm({ name: '', email: '', password: '', role: 'cajero' }); }} style={{ marginBottom: 14, padding: '7px 16px', borderRadius: 8, border: 'none', background: TEAL, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                ➕ Agregar usuario
              </button>
            )}
            {newUserForm && (
              <div style={{ border: '2px solid ' + TEAL, borderRadius: 10, padding: '14px 16px', marginBottom: 14, background: '#f0f9f5' }}>
                <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 13, color: TEAL }}>Nuevo usuario</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <input value={newUserForm.name}     onChange={function(e) { setNewUserForm(function(p) { return Object.assign({}, p, { name:     e.target.value }); }); }} placeholder="Nombre completo" style={Object.assign({}, saInput, { fontSize: 12 })} />
                  <input value={newUserForm.email}    onChange={function(e) { setNewUserForm(function(p) { return Object.assign({}, p, { email:    e.target.value }); }); }} placeholder="Email" type="email" style={Object.assign({}, saInput, { fontSize: 12 })} />
                  <input value={newUserForm.password} onChange={function(e) { setNewUserForm(function(p) { return Object.assign({}, p, { password: e.target.value }); }); }} placeholder="Contraseña (mín. 6)" type="password" style={Object.assign({}, saInput, { fontSize: 12 })} />
                  <select value={newUserForm.role}    onChange={function(e) { setNewUserForm(function(p) { return Object.assign({}, p, { role:     e.target.value }); }); }} style={Object.assign({}, saInput, { fontSize: 12 })}>
                    <option value="cajero">Cajero</option>
                    <option value="admin">Administrador</option>
                    <option value="auditor">Auditor</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={doCreateUser} disabled={newUserSaving} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: TEAL, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: newUserSaving ? 0.6 : 1 }}>{newUserSaving ? 'Creando…' : 'Crear'}</button>
                  <button onClick={function() { setNewUserForm(null); }} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#888' }}>Cancelar</button>
                </div>
              </div>
            )}

            {usersLoading
              ? <p style={{ textAlign: 'center', color: '#888', padding: 30 }}>Cargando…</p>
              : usersModal.users.length === 0
                ? <p style={{ textAlign: 'center', color: '#888', padding: 30 }}>Sin usuarios en este negocio</p>
                : usersModal.users.map(function(u) {
                    return (
                      <div key={u.id} style={{ border: '1px solid #eee', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: 13, color: NAVY }}>{u.name}</span>
                            <span style={Object.assign({}, mkBadge(ROLE_COL[u.role] || '#888'), { fontSize: 10, marginLeft: 8 })}>{u.role}</span>
                            {!u.active && <span style={Object.assign({}, mkBadge('#ccc'), { fontSize: 10, marginLeft: 4 })}>Inactivo</span>}
                            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{u.email}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={function() { doToggleUser(u); }} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', fontSize: 12, cursor: 'pointer', color: u.active ? '#E24B4A' : TEAL, fontWeight: 600 }}>
                              {u.active ? 'Desactivar' : 'Activar'}
                            </button>
                            <button onClick={function() { setDeleteUserConfirm(u); }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E24B4A', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#E24B4A', fontWeight: 600 }}>🗑️</button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input type="password" value={resetPwMap[u.id] || ''} onChange={function(e) { var id = u.id; setResetPwMap(function(prev) { return Object.assign({}, prev, { [id]: e.target.value }); }); }} placeholder="Nueva contraseña (mín. 6 caracteres)" style={Object.assign({}, saInput, { flex: 1, fontSize: 12, padding: '7px 10px' })} />
                          <button onClick={function() { doResetPw(u); }} disabled={resetSaving[u.id] || !(resetPwMap[u.id] && resetPwMap[u.id].length >= 6)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#E24B4A', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', opacity: resetSaving[u.id] || !(resetPwMap[u.id] && resetPwMap[u.id].length >= 6) ? 0.5 : 1 }}>
                            {resetSaving[u.id] ? '…' : '🔑 Resetear'}
                          </button>
                        </div>
                      </div>
                    );
                  })
            }
          </div>
        </div>
      )}

      {/* ── Modal: Editar negocio ── */}
      {editModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg-card,#fff)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>✏️ Editar negocio</h3>
              <button onClick={function() { setEditModal(null); }} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#aaa' }}>✕</button>
            </div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Nombre del negocio</label>
            <input value={editModal.name || ''} onChange={function(e) { setEditModal(function(p) { return Object.assign({}, p, { name: e.target.value }); }); }} style={Object.assign({}, saInput, { marginBottom: 12 })} />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Propietario</label>
            <input value={editModal.owner_name || ''} onChange={function(e) { setEditModal(function(p) { return Object.assign({}, p, { owner_name: e.target.value }); }); }} style={Object.assign({}, saInput, { marginBottom: 12 })} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Plan</label>
                <select value={editModal.plan || 'basic'} onChange={function(e) { setEditModal(function(p) { return Object.assign({}, p, { plan: e.target.value }); }); }} style={saInput}>
                  <option value="basic">Básico</option>
                  <option value="professional">Profesional</option>
                  <option value="enterprise">Empresarial</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Teléfono</label>
                <input value={editModal.phone || ''} onChange={function(e) { setEditModal(function(p) { return Object.assign({}, p, { phone: e.target.value }); }); }} style={saInput} placeholder="50212345678" />
              </div>
            </div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Email de contacto</label>
            <input type="email" value={editModal.email || ''} onChange={function(e) { setEditModal(function(p) { return Object.assign({}, p, { email: e.target.value }); }); }} style={Object.assign({}, saInput, { marginBottom: 12 })} />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Notas internas</label>
            <textarea value={editModal.notes || ''} onChange={function(e) { setEditModal(function(p) { return Object.assign({}, p, { notes: e.target.value }); }); }} style={Object.assign({}, saInput, { marginBottom: 16, height: 70, resize: 'vertical' })} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={saveEditTenant} disabled={editSaving} style={Object.assign({}, mkBtn(TEAL), { flex: 1, opacity: editSaving ? 0.6 : 1 })}>{editSaving ? 'Guardando…' : 'Guardar cambios ✓'}</button>
              <button onClick={function() { setEditModal(null); }} style={{ padding: '11px 18px', borderRadius: 10, border: '1px solid var(--border-card)', background: 'var(--bg-alt)', fontSize: 14, cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Confirmar eliminar negocio ── */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg-card,#fff)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 8px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>⚠️</div>
              <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: '#E24B4A' }}>Eliminar negocio</h3>
              <p style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--text-primary)' }}>Estás a punto de eliminar <strong>{deleteConfirm.name}</strong></p>
              <p style={{ margin: 0, fontSize: 12, color: '#E24B4A', fontWeight: 600 }}>Esta acción es IRREVERSIBLE. Se borrarán todos sus datos: ventas, productos, usuarios, reparaciones y más.</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={doDeleteTenant} disabled={deleteSaving} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: '#E24B4A', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: deleteSaving ? 0.6 : 1 }}>{deleteSaving ? 'Eliminando…' : 'Sí, eliminar todo'}</button>
              <button onClick={function() { setDeleteConfirm(null); }} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid var(--border-card)', background: 'var(--bg-alt)', fontSize: 14, cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Confirmar eliminar usuario ── */}
      {deleteUserConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg-card,#fff)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 380, boxShadow: '0 8px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 42, marginBottom: 8 }}>🗑️</div>
              <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800, color: '#E24B4A' }}>Eliminar usuario</h3>
              <p style={{ margin: '0 0 4px', fontSize: 14, color: 'var(--text-primary)' }}><strong>{deleteUserConfirm.name}</strong></p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{deleteUserConfirm.email}</p>
              <p style={{ margin: '10px 0 0', fontSize: 12, color: '#E24B4A', fontWeight: 600 }}>Esta acción no se puede deshacer.</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={doDeleteUser} disabled={deleteUserSaving} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: '#E24B4A', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: deleteUserSaving ? 0.6 : 1 }}>{deleteUserSaving ? 'Eliminando…' : 'Eliminar'}</button>
              <button onClick={function() { setDeleteUserConfirm(null); }} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid #ddd', background: '#fff', fontSize: 14, cursor: 'pointer', color: '#666' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
