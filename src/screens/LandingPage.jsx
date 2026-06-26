// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA: LandingPage (Página de Presentación Pública)
//
// Esta es la página que ve cualquier visitante que llega al sistema sin sesión.
// Muestra los módulos del sistema, planes de precios y contacto.
// No requiere autenticación.
//
// Props:
//   onLogin {Function} — se llama cuando el usuario hace clic en "Iniciar sesión"
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { TEAL, NAVY } from '../styles/theme.js';
import { APP_NAME, APP_TAGLINE, PLATFORM_FEATURES } from '../constants/index.js';

// Planes de precios disponibles
var PLANES = [
  {
    name:      'Básico',
    price:     'Q 299',
    period:    '/mes',
    color:     '#888',
    features:  ['1 usuario', 'POS y ventas', 'Inventario básico', 'Soporte por WhatsApp'],
    highlight: false,
  },
  {
    name:      'Profesional',
    price:     'Q 599',
    period:    '/mes',
    color:     TEAL,
    features:  ['5 usuarios', 'Todos los módulos', 'Reparaciones y garantías', 'Reportes avanzados', 'Soporte prioritario'],
    highlight: true,
  },
  {
    name:      'Empresarial',
    price:     'Q 999',
    period:    '/mes',
    color:     '#9B59B6',
    features:  ['Usuarios ilimitados', 'Multi-sucursal', 'API y exportación', 'Capacitación incluida', 'Soporte dedicado'],
    highlight: false,
  },
];

export default function LandingPage({ onLogin }) {
  onLogin = onLogin || function() {};

  var _menu = useState(false);
  var menuOpen    = _menu[0];
  var setMenuOpen = _menu[1];

  // Scroll suave a una sección de la página por su ID
  function scrollTo(id) {
    var el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  }

  var navLinks = [['Funciones', 'features'], ['Precios', 'precios'], ['Contacto', 'contacto']];

  return (
    <div style={{ fontFamily: 'Arial,sans-serif', background: '#fff', minHeight: '100vh' }}>

      {/* ── BARRA DE NAVEGACIÓN ────────────────────────────────────────── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #eee', padding: '0 clamp(16px,4vw,60px)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: TEAL, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16 }}>
              {APP_NAME[0]}
            </div>
            <span style={{ fontWeight: 800, fontSize: 18, color: NAVY }}>{APP_NAME}</span>
          </div>
          {/* Links de navegación — ocultos en móvil */}
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }} className="nav-links">
            {navLinks.map(function(l) {
              return <button key={l[0]} onClick={function() { scrollTo(l[1]); }} style={{ background: 'none', border: 'none', color: '#444', fontSize: 14, fontWeight: 500, cursor: 'pointer', padding: '4px 0' }}>{l[0]}</button>;
            })}
            <button onClick={onLogin} style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: TEAL, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              Iniciar sesión
            </button>
          </div>
          {/* Botón menú hamburguesa — solo visible en móvil */}
          <button onClick={function() { setMenuOpen(!menuOpen); }} style={{ display: 'none', background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: NAVY }} className="menu-btn">
            ☰
          </button>
        </div>
        {/* Menú desplegable en móvil */}
        {menuOpen && (
          <div style={{ background: '#fff', borderTop: '1px solid #eee', padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {navLinks.map(function(l) {
              return <button key={l[0]} onClick={function() { scrollTo(l[1]); }} style={{ background: 'none', border: 'none', color: '#444', fontSize: 15, fontWeight: 500, cursor: 'pointer', textAlign: 'left', padding: '6px 0' }}>{l[0]}</button>;
            })}
            <button onClick={onLogin} style={{ padding: '11px', borderRadius: 8, border: 'none', background: TEAL, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
              Iniciar sesión
            </button>
          </div>
        )}
      </nav>

      {/* ── SECCIÓN HERO (encabezado principal) ───────────────────────── */}
      <section style={{ background: 'linear-gradient(135deg,' + NAVY + ' 0%,#243552 100%)', padding: 'clamp(60px,10vw,120px) clamp(16px,4vw,60px)', textAlign: 'center' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ display: 'inline-block', background: 'rgba(29,158,117,0.2)', border: '1px solid rgba(29,158,117,0.4)', borderRadius: 20, padding: '6px 16px', fontSize: 12, color: TEAL, fontWeight: 700, marginBottom: 20, letterSpacing: 1 }}>
            SISTEMA DE GESTIÓN EMPRESARIAL — GUATEMALA
          </div>
          <h1 style={{ color: '#fff', fontSize: 'clamp(28px,5vw,52px)', fontWeight: 900, margin: '0 0 20px', lineHeight: 1.15 }}>
            El sistema de gestión más completo para <span style={{ color: TEAL }}>tu negocio</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 'clamp(15px,2vw,18px)', margin: '0 0 36px', lineHeight: 1.7 }}>
            Ventas, reparaciones, inventario, cuentas por cobrar y más — todo en un solo sistema diseñado para Guatemala.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={function() { scrollTo('contacto'); }} style={{ padding: '14px 32px', borderRadius: 10, border: 'none', background: TEAL, color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer', boxShadow: '0 4px 20px rgba(29,158,117,0.4)' }}>
              Solicitar demo gratis →
            </button>
            <button onClick={onLogin} style={{ padding: '14px 32px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#fff', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>
              Iniciar sesión
            </button>
          </div>
          <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginTop: 40, flexWrap: 'wrap' }}>
            {['✅ Sin instalación', '✅ 100% en la nube', '✅ Soporte en español', '✅ Actualizaciones incluidas'].map(function(t) {
              return <span key={t} style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>{t}</span>;
            })}
          </div>
        </div>
      </section>

      {/* ── ESTADÍSTICAS ──────────────────────────────────────────────── */}
      <section style={{ background: '#f8f9fa', padding: '36px clamp(16px,4vw,60px)', borderBottom: '1px solid #eee' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 20, textAlign: 'center' }}>
          {[
            [PLATFORM_FEATURES.length + '+', 'Módulos integrados'],
            ['100%', 'En la nube'],
            ['24/7', 'Acceso desde cualquier dispositivo'],
            ['Q0', 'Costo de instalación'],
          ].map(function(s) {
            return (
              <div key={s[1]}>
                <div style={{ fontSize: 32, fontWeight: 900, color: TEAL }}>{s[0]}</div>
                <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{s[1]}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── MÓDULOS / FUNCIONALIDADES ─────────────────────────────────── */}
      <section id="features" style={{ padding: 'clamp(50px,8vw,100px) clamp(16px,4vw,60px)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ fontSize: 'clamp(22px,3vw,36px)', fontWeight: 800, color: NAVY, margin: '0 0 12px' }}>
              Todo lo que necesitás en un solo sistema
            </h2>
            <p style={{ fontSize: 16, color: '#666', margin: 0 }}>
              Diseñado para negocios en Guatemala — ventas, inventario, reparaciones y más
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 20 }}>
            {PLATFORM_FEATURES.map(function(f) {
              return (
                <div key={f.title} style={{ background: '#f8f9fa', borderRadius: 14, padding: '24px 20px', border: '1px solid #eee' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>{f.ic}</div>
                  <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: NAVY }}>{f.title}</h3>
                  <p style={{ margin: 0, fontSize: 13, color: '#666', lineHeight: 1.6 }}>{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ─────────────────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(135deg,#f0faf5 0%,#e8f4ff 100%)', padding: 'clamp(50px,8vw,80px) clamp(16px,4vw,60px)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(22px,3vw,32px)', fontWeight: 800, color: NAVY, margin: '0 0 12px' }}>
            Empezá en menos de 5 minutos
          </h2>
          <p style={{ fontSize: 15, color: '#666', margin: '0 0 40px' }}>Sin instalaciones, sin servidores, sin complicaciones</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 20 }}>
            {[
              ['1', 'Contactanos',    'Escribinos por WhatsApp o completa el formulario'],
              ['2', 'Configuramos',   'Creamos tu cuenta y configuramos el sistema con tu información'],
              ['3', 'Capacitación',   'Te explicamos cómo usar cada módulo en 30 minutos'],
              ['4', '¡Listo!',        'Empezás a vender y gestionar tu negocio de inmediato'],
            ].map(function(s) {
              return (
                <div key={s[0]} style={{ background: '#fff', borderRadius: 14, padding: '24px 20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: TEAL, color: '#fff', fontWeight: 800, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>{s[0]}</div>
                  <h4 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: NAVY }}>{s[1]}</h4>
                  <p style={{ margin: 0, fontSize: 13, color: '#666', lineHeight: 1.5 }}>{s[2]}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── PLANES DE PRECIOS ─────────────────────────────────────────── */}
      <section id="precios" style={{ padding: 'clamp(50px,8vw,100px) clamp(16px,4vw,60px)' }}>
        <div style={{ maxWidth: 950, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ fontSize: 'clamp(22px,3vw,36px)', fontWeight: 800, color: NAVY, margin: '0 0 12px' }}>Planes y precios</h2>
            <p style={{ fontSize: 15, color: '#666', margin: 0 }}>Sin contratos anuales — pagás mes a mes y cancelás cuando quieras</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 20 }}>
            {PLANES.map(function(p) {
              return (
                <div key={p.name} style={{ borderRadius: 16, padding: '28px 24px', border: p.highlight ? '2px solid ' + TEAL : '1px solid #eee', background: p.highlight ? 'linear-gradient(135deg,#f0faf5,#e8fff5)' : '#fff', position: 'relative', boxShadow: p.highlight ? '0 8px 32px rgba(29,158,117,0.15)' : 'none' }}>
                  {p.highlight && (
                    <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: TEAL, color: '#fff', padding: '4px 16px', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      MÁS POPULAR
                    </div>
                  )}
                  <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: p.color }}>{p.name}</h3>
                  <div style={{ margin: '0 0 20px' }}>
                    <span style={{ fontSize: 36, fontWeight: 900, color: NAVY }}>{p.price}</span>
                    <span style={{ fontSize: 14, color: '#888' }}>{p.period}</span>
                  </div>
                  <ul style={{ margin: '0 0 24px', padding: 0, listStyle: 'none' }}>
                    {p.features.map(function(f) {
                      return (
                        <li key={f} style={{ padding: '7px 0', fontSize: 14, color: '#444', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ color: p.color, fontWeight: 700 }}>✓</span>{f}
                        </li>
                      );
                    })}
                  </ul>
                  <button onClick={function() { scrollTo('contacto'); }} style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: p.highlight ? TEAL : '#eee', color: p.highlight ? '#fff' : '#333', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    {p.highlight ? 'Empezar ahora →' : 'Solicitar info'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CONTACTO / CTA ────────────────────────────────────────────── */}
      <section id="contacto" style={{ background: NAVY, padding: 'clamp(50px,8vw,100px) clamp(16px,4vw,60px)', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ color: '#fff', fontSize: 'clamp(22px,3vw,36px)', fontWeight: 800, margin: '0 0 12px' }}>
            ¿Listo para modernizar tu negocio?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, margin: '0 0 36px', lineHeight: 1.7 }}>
            Escribinos por WhatsApp y te hacemos una demo gratuita en menos de 24 horas.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href={'https://wa.me/50254707112?text=' + encodeURIComponent('Hola, me interesa ' + APP_NAME + ' para gestionar mi negocio. ¿Pueden darme más información?')}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-block', padding: '15px 36px', borderRadius: 10, border: 'none', background: '#25D366', color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer', textDecoration: 'none', boxShadow: '0 4px 20px rgba(37,211,102,0.4)' }}
            >
              📱 Escribir por WhatsApp
            </a>
            <button onClick={onLogin} style={{ padding: '15px 36px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#fff', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>
              Iniciar sesión
            </button>
          </div>
        </div>
      </section>

      {/* ── PIE DE PÁGINA ─────────────────────────────────────────────── */}
      <footer style={{ background: '#0f1923', padding: '28px clamp(16px,4vw,60px)', textAlign: 'center' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: TEAL, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 12 }}>
              {APP_NAME[0]}
            </div>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600 }}>
              {APP_NAME} — {APP_TAGLINE}
            </span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
            © {new Date().getFullYear()} — Guatemala
          </span>
        </div>
      </footer>

      {/* CSS para responsive: ocultar nav-links en móvil y mostrar hamburguesa */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media(max-width:640px){
          .nav-links{display:none!important}
          .menu-btn{display:block!important}
        }
      ` }} />
    </div>
  );
}
