// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE: OnboardingWizard (Asistente de Configuración Inicial)
//
// Se muestra en pantalla completa cuando el negocio aún no ha completado
// la configuración inicial (settings.onboarding_done !== "true").
//
// Flujo de 4 pasos:
//   Paso 1 — Datos de la tienda: nombre, eslogan, teléfono, dirección
//   Paso 2 — Primer producto: nombre, precio, stock (puede omitirse)
//   Paso 3 — Primer cajero: nombre, email, contraseña (puede omitirse)
//   Paso 4 — ¡Listo! → resumen de módulos → llama a onDone()
//
// Al completar:
//   - settingsAPI.update({ onboarding_done: "true" })
//   - Llama a onDone() para que App oculte el wizard
//
// Props:
//   onDone    {Function} — cierra el wizard y recarga el estado principal
//   showFlash {Function} — (msg, type) notificación flash
//   session   {Object}   — sesión activa
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { TEAL, NAVY, mkBtn } from '../styles/theme.js';
import { settingsAPI, productsAPI, usersAPI } from '../utils/api.js';
import { setStore } from '../utils/receipt.js';
import { APP_NAME } from '../constants/index.js';

// Estilo reutilizable para inputs dentro del wizard (no usa sInput global por contexto modal)
var wInput = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.18)', fontSize: 14, background: '#fff', color: '#1a1a1a', boxSizing: 'border-box', outline: 'none' };

export default function OnboardingWizard({ onDone, showFlash, session }) {
  onDone    = onDone    || function() {};
  showFlash = showFlash || function() {};
  session   = session   || {};

  var _step    = useState(1);    var step    = _step[0];    var setStep    = _step[1];
  var _saving  = useState(false);var saving  = _saving[0];  var setSaving  = _saving[1];

  // ── Paso 1: Datos de la tienda ──
  var _sn  = useState(''); var storeName    = _sn[0];  var setStoreName    = _sn[1];
  var _st  = useState(''); var storeTagline = _st[0];  var setStoreTagline = _st[1];
  var _sph = useState(''); var storePhone   = _sph[0]; var setStorePhone   = _sph[1];
  var _sad = useState(''); var storeAddress = _sad[0]; var setStoreAddress = _sad[1];

  // ── Paso 2: Primer producto ──
  var _pn  = useState(''); var prodName  = _pn[0];   var setProdName  = _pn[1];
  var _pc  = useState(''); var prodCode  = _pc[0];   var setProdCode  = _pc[1];
  var _pp  = useState(''); var prodPrice = _pp[0];   var setProdPrice = _pp[1];
  var _ps  = useState(''); var prodStock = _ps[0];   var setProdStock = _ps[1];

  // ── Paso 3: Primer cajero ──
  var _un  = useState(''); var userName  = _un[0];   var setUserName  = _un[1];
  var _ue  = useState(''); var userEmail = _ue[0];   var setUserEmail = _ue[1];
  var _upw = useState(''); var userPw    = _upw[0];  var setUserPw    = _upw[1];

  var TOTAL = 4;
  var stepLabels = ['Mi Tienda', 'Primer Producto', 'Primer Cajero', '¡Listo!'];

  // ── Guardar paso 1 ─────────────────────────────────────────────────────
  async function saveStep1() {
    setSaving(true);
    try {
      var data = { store_name: storeName, store_tagline: storeTagline, store_phone: storePhone, store_address: storeAddress };
      await settingsAPI.update(data);
      setStore(data);
      setStep(2);
    } catch(e) { showFlash('Error guardando configuración', 'error'); }
    setSaving(false);
  }

  // ── Guardar paso 2 ─────────────────────────────────────────────────────
  async function saveStep2() {
    if (!prodName || !prodPrice) { showFlash('Nombre y precio requeridos', 'error'); return; }
    setSaving(true);
    try {
      await productsAPI.create({
        name: prodName,
        code: prodCode || ('P-' + Date.now().toString(36).toUpperCase()),
        price: Number(prodPrice),
        cost: 0,
        stock: Number(prodStock) || 0,
        category: 'General',
        unit: 'uni',
      });
      setStep(3);
    } catch(e) { showFlash('Error creando producto', 'error'); }
    setSaving(false);
  }

  // ── Guardar paso 3 ─────────────────────────────────────────────────────
  async function saveStep3() {
    if (!userName || !userEmail || !userPw) { showFlash('Todos los campos son requeridos', 'error'); return; }
    setSaving(true);
    try {
      await usersAPI.create({ name: userName, email: userEmail, password: userPw, role: 'cajero' });
      setStep(4);
    } catch(e) { showFlash('Error creando usuario', 'error'); }
    setSaving(false);
  }

  // ── Finalizar y cerrar wizard ──────────────────────────────────────────
  async function finish() {
    setSaving(true);
    try {
      await settingsAPI.update({ onboarding_done: 'true' });
      onDone();
    } catch(e) { onDone(); }
    setSaving(false);
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(10,20,35,0.92)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 520, padding: '36px 36px 28px', boxShadow: '0 24px 80px rgba(0,0,0,0.4)', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Encabezado */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🚀</div>
          <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, color: NAVY }}>Configuración inicial</h2>
          <p style={{ margin: 0, fontSize: 13, color: '#888' }}>Sigue los pasos para dejar el sistema listo</p>
          <button onClick={finish} style={{ marginTop: 10, background: 'none', border: 'none', color: '#aaa', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
            Saltar y configurar después →
          </button>
        </div>

        {/* Barra de progreso por pasos */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
          {stepLabels.map(function(lb, i) {
            var n = i + 1; var active = n === step; var done = n < step;
            return (
              <div key={n} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ height: 4, borderRadius: 4, background: done || active ? TEAL : '#e0e0e0', marginBottom: 6, transition: 'background 0.3s' }} />
                <div style={{ fontSize: 10, fontWeight: done || active ? 700 : 400, color: done || active ? TEAL : '#aaa' }}>{lb}</div>
              </div>
            );
          })}
        </div>

        {/* ── Paso 1: Datos de la tienda ── */}
        {step === 1 && (
          <div>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: NAVY }}>📋 Datos de tu negocio</h3>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>Nombre del negocio *</label>
            <input value={storeName} onChange={function(e) { setStoreName(e.target.value); }} style={Object.assign({}, wInput, { marginBottom: 12 })} placeholder="Ej: Mi Celulería" />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>Slogan o descripción</label>
            <input value={storeTagline} onChange={function(e) { setStoreTagline(e.target.value); }} style={Object.assign({}, wInput, { marginBottom: 12 })} placeholder="Ej: Accesorios y Reparaciones" />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>Teléfono</label>
            <input value={storePhone} onChange={function(e) { setStorePhone(e.target.value); }} style={Object.assign({}, wInput, { marginBottom: 12 })} placeholder="Ej: 55551234" />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>Dirección</label>
            <input value={storeAddress} onChange={function(e) { setStoreAddress(e.target.value); }} style={Object.assign({}, wInput, { marginBottom: 24 })} placeholder="Ej: Zona 1, Ciudad de Guatemala" />
            <button onClick={saveStep1} disabled={saving || !storeName} style={Object.assign({}, mkBtn(TEAL), { width: '100%', padding: '13px', fontSize: 15, opacity: saving || !storeName ? 0.6 : 1 })}>
              {saving ? 'Guardando…' : 'Guardar y continuar →'}
            </button>
          </div>
        )}

        {/* ── Paso 2: Primer producto ── */}
        {step === 2 && (
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: NAVY }}>📦 Agrega tu primer producto</h3>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: '#888' }}>Puedes agregar más productos después en el módulo de Productos.</p>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>Nombre del producto *</label>
            <input value={prodName} onChange={function(e) { setProdName(e.target.value); }} style={Object.assign({}, wInput, { marginBottom: 12 })} placeholder="Ej: Funda iPhone 14" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>Precio (Q) *</label>
                <input type="number" value={prodPrice} onChange={function(e) { setProdPrice(e.target.value); }} style={wInput} placeholder="0.00" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>Stock inicial</label>
                <input type="number" value={prodStock} onChange={function(e) { setProdStock(e.target.value); }} style={wInput} placeholder="0" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={function() { setStep(3); }} style={Object.assign({}, mkBtn('#888'), { padding: '12px 20px', fontSize: 13 })}>Omitir</button>
              <button onClick={saveStep2} disabled={saving || !prodName || !prodPrice} style={Object.assign({}, mkBtn(TEAL), { flex: 1, padding: '12px', fontSize: 14, opacity: saving || !prodName || !prodPrice ? 0.6 : 1 })}>
                {saving ? 'Guardando…' : 'Guardar y continuar →'}
              </button>
            </div>
          </div>
        )}

        {/* ── Paso 3: Primer cajero ── */}
        {step === 3 && (
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: NAVY }}>👤 Crea tu primer cajero</h3>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: '#888' }}>El cajero podrá hacer ventas y gestionar la caja. Tú eres el admin.</p>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>Nombre *</label>
            <input value={userName} onChange={function(e) { setUserName(e.target.value); }} style={Object.assign({}, wInput, { marginBottom: 12 })} placeholder="Ej: Juan López" />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>Email *</label>
            <input type="email" value={userEmail} onChange={function(e) { setUserEmail(e.target.value); }} style={Object.assign({}, wInput, { marginBottom: 12 })} placeholder="cajero@minegocio.com" />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>Contraseña temporal *</label>
            <input type="password" value={userPw} onChange={function(e) { setUserPw(e.target.value); }} style={Object.assign({}, wInput, { marginBottom: 24 })} placeholder="Mínimo 6 caracteres" />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={function() { setStep(4); }} style={Object.assign({}, mkBtn('#888'), { padding: '12px 20px', fontSize: 13 })}>Omitir</button>
              <button onClick={saveStep3} disabled={saving || !userName || !userEmail || !userPw} style={Object.assign({}, mkBtn(TEAL), { flex: 1, padding: '12px', fontSize: 14, opacity: saving || !userName || !userEmail || !userPw ? 0.6 : 1 })}>
                {saving ? 'Creando…' : 'Crear y continuar →'}
              </button>
            </div>
          </div>
        )}

        {/* ── Paso 4: ¡Listo! ── */}
        {step === 4 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: NAVY }}>¡Todo listo!</h3>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: '#666', lineHeight: 1.7 }}>
              Tu sistema {APP_NAME} está configurado.<br />Aquí un resumen de lo que puedes hacer:
            </p>
            <div style={{ textAlign: 'left', background: '#f5f9f7', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
              {[
                ['🛒', 'POS',         'Registra ventas con múltiples métodos de pago'],
                ['💳', 'Cuentas',     'Lleva el control de ventas a crédito'],
                ['🔧', 'Reparaciones','Gestiona órdenes de servicio técnico'],
                ['📦', 'Productos',   'Administra tu inventario y precios'],
                ['👥', 'Clientes',    'Base de datos de tus compradores'],
                ['📊', 'Dashboard',   'Gráficas de ventas e ingresos'],
              ].map(function(row) {
                return (
                  <div key={row[1]} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                    <span style={{ fontSize: 18, minWidth: 24 }}>{row[0]}</span>
                    <div>
                      <strong style={{ fontSize: 13, color: NAVY }}>{row[1]}</strong>
                      <span style={{ fontSize: 12, color: '#777' }}> — {row[2]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={finish} disabled={saving} style={Object.assign({}, mkBtn(TEAL), { width: '100%', padding: '14px', fontSize: 16, fontWeight: 800 })}>
              {saving ? 'Finalizando…' : '¡Empezar a usar el sistema! →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
