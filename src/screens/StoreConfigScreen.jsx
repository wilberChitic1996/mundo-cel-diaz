// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA: StoreConfigScreen (Configuración de Tienda)
//
// Permite al administrador personalizar los datos del negocio que aparecen
// en los recibos, PDFs y mensajes de WhatsApp.
//
// Campos configurables:
//   - Nombre del negocio (aparece en encabezado de todos los comprobantes)
//   - Eslogan / descripción
//   - Teléfono y dirección
//   - Correo electrónico
//   - Logo (imagen redimensionada a 300×300 y convertida a base64/JPEG)
//
// Al guardar:
//   1. Guarda en Supabase vía settingsAPI.update(form)
//   2. Actualiza el estado local de App (setStoreInfo)
//   3. Actualiza el módulo receipt.js (setStore) para que los nuevos
//      recibos ya usen los datos actualizados sin recargar la página
//
// Panel derecho: vista previa del encabezado del recibo en tiempo real.
//
// Props:
//   storeInfo    {Object}   — configuración actual de la tienda
//   setStoreInfo {Function} — actualiza el estado en App
//   session      {Object}   — sesión activa
//   showFlash    {Function} — (msg, type) notificación flash
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { TEAL, NAVY, sCard, sInput, mkBtn } from '../styles/theme.js';
import { settingsAPI } from '../utils/api.js';
import { setStore } from '../utils/receipt.js';
import { APP_NAME } from '../constants/index.js';

var H1 = { fontSize: 'clamp(17px,4vw,22px)', fontWeight: 600, margin: '0 0 20px', color: 'var(--text-primary,#1a1a1a)' };

// Definición de los campos del formulario
var FIELDS = [
  { key: 'store_name',    label: 'Nombre del negocio *', placeholder: 'Ej: Tecnología García' },
  { key: 'store_tagline', label: 'Eslogan / descripción', placeholder: 'Ej: Tecnología · Accesorios · Reparaciones' },
  { key: 'store_phone',   label: 'Teléfono',              placeholder: 'Ej: 5555-1234' },
  { key: 'store_address', label: 'Dirección',             placeholder: 'Ej: Zona 1, Guatemala' },
  { key: 'store_email',   label: 'Correo electrónico',    placeholder: 'Ej: info@mitienda.com' },
];

export default function StoreConfigScreen({ storeInfo, setStoreInfo, session, showFlash }) {
  storeInfo    = storeInfo    || {};
  setStoreInfo = setStoreInfo || function() {};
  session      = session      || {};
  showFlash    = showFlash    || function() {};

  // Copia local del formulario (no muta el estado global hasta guardar)
  var _form = useState(Object.assign(
    { store_name: '', store_tagline: '', store_phone: '', store_address: '', store_email: '', store_logo_url: '' },
    storeInfo
  ));
  var form    = _form[0];
  var setForm = _form[1];

  var _saving      = useState(false); var saving      = _saving[0];      var setSaving      = _saving[1];
  var _logoLoading = useState(false); var logoLoading = _logoLoading[0]; var setLogoLoading = _logoLoading[1];

  // Actualiza un campo del formulario
  function handleChange(k, v) {
    setForm(function(prev) { var n = Object.assign({}, prev); n[k] = v; return n; });
  }

  // Lee el archivo de imagen, lo redimensiona a 300×300 y lo guarda como JPEG base64
  function handleLogoFile(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showFlash('Solo se aceptan imágenes (JPG, PNG, WebP)', 'err'); return; }
    setLogoLoading(true);
    var reader = new FileReader();
    reader.onload = function(ev) {
      var img = new Image();
      img.onload = function() {
        var MAX = 300;
        var w = img.width; var h = img.height;
        if (w > MAX || h > MAX) { var r = Math.min(MAX / w, MAX / h); w = Math.round(w * r); h = Math.round(h * r); }
        var canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        handleChange('store_logo_url', canvas.toDataURL('image/jpeg', 0.82));
        setLogoLoading(false);
      };
      img.onerror = function() { showFlash('No se pudo leer la imagen', 'err'); setLogoLoading(false); };
      img.src = ev.target.result;
    };
    reader.onerror = function() { showFlash('Error al leer el archivo', 'err'); setLogoLoading(false); };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  // Guarda en Supabase y actualiza estados locales
  function handleSave() {
    setSaving(true);
    settingsAPI.update(form).then(function() {
      setStoreInfo(function(prev) { return Object.assign({}, prev, form); });
      setStore(form);
      showFlash('✓ Configuración guardada', 'ok');
      setSaving(false);
    }).catch(function() {
      showFlash('Error al guardar', 'error');
      setSaving(false);
    });
  }

  return (
    <div>
      <p style={H1}>⚙️ Mi Tienda — Configuración</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* ── Formulario ── */}
        <div style={sCard}>
          <p style={{ fontWeight: 600, fontSize: 15, margin: '0 0 18px' }}>Información del negocio</p>

          {FIELDS.map(function(f) {
            return (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 5 }}>{f.label}</label>
                <input style={sInput} value={form[f.key] || ''} placeholder={f.placeholder} onChange={function(e) { handleChange(f.key, e.target.value); }} />
              </div>
            );
          })}

          {/* Logo del negocio */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Logo del negocio</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {form.store_logo_url
                ? <img src={form.store_logo_url} alt="logo" style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover', border: '2px solid ' + TEAL }} />
                : <div style={{ width: 60, height: 60, borderRadius: 8, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#bbb', border: '2px dashed #ccc' }}>🖼️</div>
              }
              <div style={{ flex: 1 }}>
                <label style={{ display: 'inline-block', cursor: 'pointer', background: TEAL, color: '#fff', padding: '7px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>
                  {logoLoading ? 'Procesando…' : '📁 Subir imagen'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoFile} disabled={logoLoading} />
                </label>
                {form.store_logo_url && (
                  <button style={{ marginLeft: 8, background: 'none', border: '1px solid #e74c3c', color: '#e74c3c', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }} onClick={function() { handleChange('store_logo_url', ''); }}>
                    Quitar
                  </button>
                )}
                <p style={{ fontSize: 11, color: '#888', margin: '6px 0 0' }}>JPG, PNG o WebP · Máx. 500 KB · Se redimensiona automáticamente</p>
              </div>
            </div>
          </div>

          <button style={Object.assign({}, mkBtn('teal'), { width: '100%', marginTop: 6 })} onClick={handleSave} disabled={saving || logoLoading}>
            {saving ? 'Guardando…' : '💾 Guardar cambios'}
          </button>
        </div>

        {/* ── Vista previa del recibo ── */}
        <div>
          <div style={sCard}>
            <p style={{ fontWeight: 600, fontSize: 15, margin: '0 0 14px' }}>Vista previa — Encabezado de recibo</p>
            <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 16, background: '#fafafa' }}>
              <div style={{ borderBottom: '3px solid ' + TEAL, paddingBottom: 12, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {form.store_logo_url
                    ? <img src={form.store_logo_url} alt="logo" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                    : <div style={{ width: 40, height: 40, borderRadius: 8, background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEAL, fontWeight: 900, fontSize: 14 }}>{APP_NAME.slice(0, 2).toUpperCase()}</div>
                  }
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 16, color: NAVY }}>{form.store_name || 'Nombre del negocio'}</div>
                    <div style={{ fontSize: 10, color: TEAL, fontWeight: 700, letterSpacing: 1, marginTop: 2 }}>{form.store_tagline || 'Eslogan aquí'}</div>
                    {form.store_phone   && <div style={{ fontSize: 10, color: '#999', marginTop: 1 }}>📞 {form.store_phone}</div>}
                    {form.store_address && <div style={{ fontSize: 10, color: '#999' }}>📍 {form.store_address}</div>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: '#999' }}>Comprobante de Venta</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: TEAL }}># XXXXXXXX</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#999', textAlign: 'center' }}>… detalle de la venta …</div>
              <div style={{ borderTop: '2px dashed #ccc', paddingTop: 10, marginTop: 10, fontSize: 10, color: '#999', display: 'flex', justifyContent: 'space-between' }}>
                <span>Generado por {form.store_name || 'Sistema POS'}</span>
                <span>{new Date().toLocaleDateString('es-GT')}</span>
              </div>
            </div>
          </div>

          {/* Explicación de dónde aparece la configuración */}
          <div style={Object.assign({}, sCard, { marginTop: 14, background: '#f0f9f5', borderLeft: '4px solid ' + TEAL })}>
            <p style={{ fontWeight: 600, fontSize: 13, margin: '0 0 8px', color: TEAL }}>ℹ️ ¿Dónde aparece esta información?</p>
            <div style={{ fontSize: 13, color: '#555', lineHeight: 1.8 }}>
              <p style={{ margin: '0 0 3px' }}>✅ Encabezado de <b>recibos de venta</b></p>
              <p style={{ margin: '0 0 3px' }}>✅ PDF de <b>cierre de caja</b></p>
              <p style={{ margin: '0 0 3px' }}>✅ <b>Órdenes de trabajo</b> de reparaciones</p>
              <p style={{ margin: '0 0 3px' }}>✅ <b>Cuadres</b> e informes</p>
              <p style={{ margin: 0 }}>✅ Mensajes de <b>WhatsApp</b></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
