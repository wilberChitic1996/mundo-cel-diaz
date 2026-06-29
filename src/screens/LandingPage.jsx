import React, { useState, useEffect, useRef } from 'react';
import { TEAL, NAVY } from '../styles/theme.js';
import { APP_NAME, APP_TAGLINE } from '../constants/index.js';

// ── Datos de la landing ───────────────────────────────────────────────────────

var FEATURES = [
  { ic: '🛒', title: 'Punto de Venta',        desc: 'Cobra en segundos con efectivo, tarjeta o transferencia. Boletas digitales automáticas por WhatsApp.' },
  { ic: '💳', title: 'Cuentas por Cobrar',    desc: 'Créditos y abonos con historial completo. Recordatorios automáticos por WhatsApp para tus clientes.' },
  { ic: '🔧', title: 'Taller de Reparaciones',desc: 'Órdenes de servicio, seguimiento de estado, costos y fecha de entrega en tiempo real.' },
  { ic: '📦', title: 'Inventario Inteligente',desc: 'Stock en tiempo real con alertas de bajo inventario y trazabilidad de cada movimiento.' },
  { ic: '👥', title: 'Clientes',              desc: 'CRM integrado con historial de compras, reparaciones, créditos y datos de contacto.' },
  { ic: '📊', title: 'Reportes y Cuadres',    desc: 'Dashboard con ventas del día, gráficas, top productos y cierre de caja con arqueo formal.' },
  { ic: '🏭', title: 'Proveedores y Compras', desc: 'Registra compras, actualiza stock automáticamente y lleva historial de proveedores.' },
  { ic: '🛡️', title: 'Garantías',             desc: 'Gestiona garantías de ventas y reparaciones con alertas automáticas de vencimiento.' },
  { ic: '💵', title: 'Caja y Arqueo',         desc: 'Control de caja chica, ingresos y egresos con cierre formal imprimible.' },
  { ic: '🔄', title: 'Devoluciones',          desc: 'Procesa devoluciones con registro de motivo, condición del producto y reembolso.' },
  { ic: '📋', title: 'Auditoría',             desc: 'Registro completo de cada acción del sistema: quién, cuándo y qué módulo.' },
];

var PLANES = [
  {
    name: 'Básico',
    price: 299,
    color: '#64748b',
    features: ['1 usuario', 'POS y ventas', 'Inventario básico', 'Clientes', 'Soporte por WhatsApp'],
    highlight: false,
  },
  {
    name: 'Profesional',
    price: 599,
    color: TEAL,
    features: ['5 usuarios', 'Todos los módulos', 'Reparaciones y garantías', 'Cuentas por cobrar', 'Reportes avanzados', 'Soporte prioritario'],
    highlight: true,
  },
  {
    name: 'Empresarial',
    price: 999,
    color: '#8b5cf6',
    features: ['Usuarios ilimitados', 'Multi-sucursal', 'API y exportación Excel/PDF', 'Capacitación incluida', 'Soporte dedicado 24/7'],
    highlight: false,
  },
];

var TESTIMONIOS = [
  { nombre: 'Carlos M.', negocio: 'CelTech Guatemala', texto: 'Antes llevaba todo en cuadernos. Ahora cierro caja en 2 minutos y sé exactamente cuánto vendí cada día.' },
  { nombre: 'Ana L.',    negocio: 'Repuestos & Más',   texto: 'El módulo de reparaciones nos cambió la vida. Los clientes reciben su estado por WhatsApp sin que nosotros llamemos.' },
  { nombre: 'Roberto P.',negocio: 'Accesorios Express', texto: 'Tengo 3 sucursales y controlo todo desde el celular. El inventario se actualiza solo con cada venta.' },
];

var PASOS = [
  { n: '01', titulo: 'Contactanos',   desc: 'Escribinos por WhatsApp y te respondemos en menos de 1 hora.' },
  { n: '02', titulo: 'Configuramos',  desc: 'Creamos tu cuenta y cargamos tu inventario inicial.' },
  { n: '03', titulo: 'Capacitación',  desc: 'Te enseñamos cada módulo en 30 minutos por videollamada.' },
  { n: '04', titulo: '¡A vender!',    desc: 'Empezás a operar el mismo día, sin instalar nada.' },
];

// ── Hook: contador animado ────────────────────────────────────────────────────
function useCounter(target, duration, active) {
  var _s = useState(0);
  var val = _s[0]; var setVal = _s[1];
  useEffect(function() {
    if (!active) return;
    var start = 0;
    var step = target / (duration / 16);
    var raf;
    function tick() {
      start += step;
      if (start >= target) { setVal(target); return; }
      setVal(Math.floor(start));
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return function() { cancelAnimationFrame(raf); };
  }, [active, target, duration]);
  return val;
}

// ── Hook: IntersectionObserver (reveal on scroll) ────────────────────────────
function useVisible(threshold) {
  var ref = useRef(null);
  var _s = useState(false);
  var visible = _s[0]; var setVisible = _s[1];
  useEffect(function() {
    var el = ref.current;
    if (!el) return;
    var obs = new IntersectionObserver(function(entries) {
      if (entries[0].isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: threshold || 0.15 });
    obs.observe(el);
    return function() { obs.disconnect(); };
  }, [threshold]);
  return [ref, visible];
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function LandingPage({ onLogin }) {
  onLogin = onLogin || function() {};
  var _menu = useState(false); var menuOpen = _menu[0]; var setMenuOpen = _menu[1];
  var _hero = useState(false); var heroReady = _hero[0]; var setHeroReady = _hero[1];
  var _statsRef = useVisible(0.2); var statsRef = _statsRef[0]; var statsVisible = _statsRef[1];

  // Contadores animados
  var cModulos  = useCounter(11, 1200, statsVisible);
  var cNegocios = useCounter(50, 1500, statsVisible);
  var cUptime   = useCounter(99, 1800, statsVisible);

  useEffect(function() {
    var t = setTimeout(function() { setHeroReady(true); }, 80);
    return function() { clearTimeout(t); };
  }, []);

  function scrollTo(id) {
    var el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  }

  var navLinks = [['Funciones', 'features'], ['Precios', 'precios'], ['Clientes', 'testimonios'], ['Contacto', 'contacto']];

  return (
    <div style={{ fontFamily: "'Segoe UI',system-ui,Arial,sans-serif", background: '#fff', minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── ESTILOS CSS ─────────────────────────────────────────────────── */}
      <style dangerouslySetInnerHTML={{ __html: `
        * { box-sizing: border-box; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0 rgba(29,158,117,0.4); }
          70%  { box-shadow: 0 0 0 14px rgba(29,158,117,0); }
          100% { box-shadow: 0 0 0 0 rgba(29,158,117,0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-10px); }
        }
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes badge-pop {
          0%   { transform: scale(0.8); opacity: 0; }
          60%  { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes gradient-shift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes typewriter {
          from { width: 0; }
          to   { width: 100%; }
        }

        .hero-word {
          background: linear-gradient(90deg, #1D9E75, #00d4a0, #1D9E75);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: gradient-shift 3s ease infinite;
        }

        .feat-card {
          background: #f8fafc;
          border: 1px solid #e8ecf0;
          border-radius: 16px;
          padding: 24px 20px;
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
          cursor: default;
        }
        .feat-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 16px 40px rgba(29,158,117,0.13);
          border-color: rgba(29,158,117,0.35);
        }
        .feat-card:hover .feat-icon {
          animation: float 2s ease-in-out infinite;
        }

        .plan-card {
          border-radius: 20px;
          padding: 32px 26px;
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .plan-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 50px rgba(0,0,0,0.12);
        }

        .testi-card {
          background: #fff;
          border: 1px solid #eee;
          border-radius: 16px;
          padding: 28px 24px;
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .testi-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.09);
        }

        .btn-primary {
          padding: 15px 36px;
          border-radius: 12px;
          border: none;
          background: ${TEAL};
          color: #fff;
          font-weight: 800;
          font-size: 16px;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(29,158,117,0.4);
          transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
          position: relative;
          overflow: hidden;
        }
        .btn-primary::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
          transform: translateX(-100%);
          transition: transform 0.5s ease;
        }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(29,158,117,0.5); background: #18b882; }
        .btn-primary:hover::after { transform: translateX(100%); }
        .btn-primary:active { transform: translateY(0); }

        .btn-ghost {
          padding: 15px 36px;
          border-radius: 12px;
          border: 1.5px solid rgba(255,255,255,0.35);
          background: transparent;
          color: #fff;
          font-weight: 600;
          font-size: 16px;
          cursor: pointer;
          transition: background 0.18s ease, border-color 0.18s ease;
        }
        .btn-ghost:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.6); }

        .nav-link-btn {
          background: none;
          border: none;
          color: #444;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          padding: 4px 0;
          position: relative;
          transition: color 0.15s;
        }
        .nav-link-btn::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          width: 0;
          height: 2px;
          background: ${TEAL};
          transition: width 0.22s ease;
        }
        .nav-link-btn:hover { color: ${TEAL}; }
        .nav-link-btn:hover::after { width: 100%; }

        .mock-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 10px;
          background: rgba(255,255,255,0.07);
          margin-bottom: 8px;
          font-size: 13px;
          color: rgba(255,255,255,0.85);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .reveal {
          opacity: 0;
          transform: translateY(28px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .reveal.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .wapp-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 16px 40px;
          border-radius: 12px;
          background: #25D366;
          color: #fff;
          font-weight: 800;
          font-size: 16px;
          cursor: pointer;
          text-decoration: none;
          box-shadow: 0 4px 24px rgba(37,211,102,0.45);
          transition: transform 0.18s ease, box-shadow 0.18s ease;
          animation: pulse-ring 2.5s infinite;
        }
        .wapp-btn:hover { transform: translateY(-3px); box-shadow: 0 10px 32px rgba(37,211,102,0.55); }

        @media(max-width:680px){
          .nav-links { display:none !important; }
          .menu-btn  { display:block !important; }
          .hero-btns { flex-direction:column !important; align-items:stretch !important; }
          .hero-btns button, .hero-btns a { width:100% !important; text-align:center; }
          .mock-ui { display:none !important; }
        }
      ` }} />

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 200, background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(0,0,0,0.07)', padding: '0 clamp(16px,4vw,60px)' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 66 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg,' + TEAL + ',#00c48c)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 17, boxShadow: '0 4px 12px rgba(29,158,117,0.3)' }}>
              {APP_NAME[0]}
            </div>
            <span style={{ fontWeight: 900, fontSize: 19, color: NAVY, letterSpacing: '-0.3px' }}>{APP_NAME}</span>
          </div>
          <div className="nav-links" style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
            {navLinks.map(function(l) {
              return <button key={l[0]} className="nav-link-btn" onClick={function() { scrollTo(l[1]); }}>{l[0]}</button>;
            })}
            <button onClick={onLogin} className="btn-primary" style={{ padding: '9px 22px', fontSize: 14, borderRadius: 9 }}>
              Iniciar sesión
            </button>
          </div>
          <button className="menu-btn" onClick={function() { setMenuOpen(!menuOpen); }} style={{ display: 'none', background: 'none', border: 'none', fontSize: 26, cursor: 'pointer', color: NAVY }}>
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
        {menuOpen && (
          <div style={{ background: '#fff', borderTop: '1px solid #eee', padding: '14px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {navLinks.map(function(l) {
              return <button key={l[0]} onClick={function() { scrollTo(l[1]); }} style={{ background: 'none', border: 'none', color: '#333', fontSize: 16, fontWeight: 600, cursor: 'pointer', textAlign: 'left', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>{l[0]}</button>;
            })}
            <button onClick={onLogin} className="btn-primary" style={{ marginTop: 4 }}>Iniciar sesión</button>
          </div>
        )}
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(145deg,' + NAVY + ' 0%,#1a2c44 55%,#0f2233 100%)', padding: 'clamp(60px,10vw,110px) clamp(16px,4vw,60px) clamp(50px,8vw,90px)', position: 'relative', overflow: 'hidden' }}>
        {/* Fondo decorativo */}
        <div style={{ position: 'absolute', top: '-30%', right: '-10%', width: '60%', height: '160%', background: 'radial-gradient(ellipse, rgba(29,158,117,0.12) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-20%', left: '-5%', width: '40%', height: '100%', background: 'radial-gradient(ellipse, rgba(29,158,117,0.07) 0%, transparent 65%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1140, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 48, flexWrap: 'wrap' }}>
          {/* Texto hero */}
          <div style={{ flex: '1 1 400px', minWidth: 0 }}>
            <div style={{
              display: 'inline-block',
              background: 'rgba(29,158,117,0.18)',
              border: '1px solid rgba(29,158,117,0.45)',
              borderRadius: 24,
              padding: '6px 18px',
              fontSize: 11,
              color: TEAL,
              fontWeight: 800,
              marginBottom: 24,
              letterSpacing: 1.5,
              animation: heroReady ? 'badge-pop 0.5s ease both' : 'none',
            }}>
              ✦ SISTEMA DE GESTIÓN EMPRESARIAL · GUATEMALA
            </div>

            <h1 style={{
              color: '#fff',
              fontSize: 'clamp(30px,4.5vw,56px)',
              fontWeight: 900,
              margin: '0 0 22px',
              lineHeight: 1.12,
              letterSpacing: '-0.5px',
              animation: heroReady ? 'fadeUp 0.65s 0.1s ease both' : 'none',
            }}>
              El sistema más completo<br />
              para <span className="hero-word">tu negocio</span>
            </h1>

            <p style={{
              color: 'rgba(255,255,255,0.72)',
              fontSize: 'clamp(15px,1.8vw,18px)',
              margin: '0 0 36px',
              lineHeight: 1.75,
              maxWidth: 480,
              animation: heroReady ? 'fadeUp 0.65s 0.22s ease both' : 'none',
            }}>
              Ventas, inventario, reparaciones, cuentas por cobrar y más — todo en una sola plataforma diseñada para negocios en Guatemala.
            </p>

            <div className="hero-btns" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', animation: heroReady ? 'fadeUp 0.65s 0.34s ease both' : 'none' }}>
              <button className="btn-primary" onClick={function() { scrollTo('contacto'); }}>
                Solicitar demo gratis →
              </button>
              <button className="btn-ghost" onClick={onLogin}>
                Iniciar sesión
              </button>
            </div>

            <div style={{ display: 'flex', gap: 20, marginTop: 36, flexWrap: 'wrap', animation: heroReady ? 'fadeUp 0.65s 0.45s ease both' : 'none' }}>
              {['Sin instalación', '100% en la nube', 'Soporte en español'].map(function(t) {
                return (
                  <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                    <span style={{ color: TEAL, fontSize: 16 }}>✓</span>{t}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Mock UI decorativo */}
          <div className="mock-ui" style={{
            flex: '0 0 340px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 20,
            padding: '20px 18px',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
            animation: heroReady ? 'fadeUp 0.8s 0.25s ease both' : 'none',
          }}>
            {/* Header del mock */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f57' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#febc2e' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#28c840' }} />
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginLeft: 6 }}>PraxisGT · Dashboard</span>
            </div>
            {/* Métricas mock */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[['Ventas hoy', 'Q 4,820'], ['Órdenes', '23'], ['Por cobrar', 'Q 1,350'], ['Stock bajo', '3']].map(function(m) {
                return (
                  <div key={m[0]} style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, marginBottom: 4 }}>{m[0]}</div>
                    <div style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>{m[1]}</div>
                  </div>
                );
              })}
            </div>
            {/* Filas mock */}
            <div style={{ fontSize: 12 }}>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginBottom: 8, fontWeight: 600, letterSpacing: 0.8 }}>ÚLTIMAS VENTAS</div>
              {[
                ['🛒', 'Samsung A15 negro', 'Q 1,200', '#22c55e'],
                ['🔧', 'Reparación pantalla', 'Q 350', '#3b82f6'],
                ['📦', 'Cargador tipo C x3', 'Q 240', '#22c55e'],
                ['💳', 'Abono crédito · Ana', 'Q 500', '#8b5cf6'],
              ].map(function(r) {
                return (
                  <div className="mock-row" key={r[1]}>
                    <span>{r[0]}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r[1]}</span>
                    <span style={{ color: r[3], fontWeight: 700, whiteSpace: 'nowrap' }}>{r[2]}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, background: 'rgba(29,158,117,0.2)', border: '1px solid rgba(29,158,117,0.35)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>✅</span>
              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>Caja cuadrada · Q 8,420 efectivo</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ───────────────────────────────────────────────────────── */}
      <section ref={statsRef} style={{ background: '#f8fafc', padding: '40px clamp(16px,4vw,60px)', borderBottom: '1px solid #eee' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 24, textAlign: 'center' }}>
          {[
            { val: cModulos + '+',  label: 'Módulos integrados',        icon: '🧩' },
            { val: cNegocios + '+', label: 'Negocios activos',          icon: '🏪' },
            { val: cUptime + '%',   label: 'Disponibilidad garantizada',icon: '⚡' },
            { val: 'Q0',            label: 'Costo de instalación',       icon: '🎁' },
          ].map(function(s) {
            return (
              <div key={s.label} style={{ padding: '8px 0' }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: TEAL, lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: 13, color: '#666', marginTop: 6, fontWeight: 500 }}>{s.label}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── MÓDULOS ─────────────────────────────────────────────────────── */}
      <FeaturesSection features={FEATURES} scrollTo={scrollTo} />

      {/* ── CÓMO FUNCIONA ───────────────────────────────────────────────── */}
      <HowItWorks pasos={PASOS} />

      {/* ── TESTIMONIOS ─────────────────────────────────────────────────── */}
      <TestimoniosSection testimonios={TESTIMONIOS} />

      {/* ── PRECIOS ─────────────────────────────────────────────────────── */}
      <PreciosSection planes={PLANES} scrollTo={scrollTo} />

      {/* ── CTA FINAL ───────────────────────────────────────────────────── */}
      <section id="contacto" style={{ background: 'linear-gradient(145deg,' + NAVY + ',#1a2c44)', padding: 'clamp(60px,10vw,120px) clamp(16px,4vw,60px)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '80%', height: '200%', background: 'radial-gradient(ellipse, rgba(29,158,117,0.1) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 640, margin: '0 auto', position: 'relative' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
          <h2 style={{ color: '#fff', fontSize: 'clamp(24px,4vw,42px)', fontWeight: 900, margin: '0 0 16px', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
            ¿Listo para modernizar<br />tu negocio?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 'clamp(15px,1.8vw,17px)', margin: '0 0 40px', lineHeight: 1.7 }}>
            Te hacemos una demo gratuita adaptada a tu negocio. Sin compromiso, sin tarjeta de crédito.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href={'https://wa.me/50254707112?text=' + encodeURIComponent('Hola, me interesa PraxisGT para gestionar mi negocio. ¿Me pueden dar más información?')}
              target="_blank"
              rel="noopener noreferrer"
              className="wapp-btn"
            >
              <span style={{ fontSize: 20 }}>📱</span>
              Escribir por WhatsApp
            </a>
            <button onClick={onLogin} className="btn-ghost">
              Iniciar sesión
            </button>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 28 }}>
            Respondemos en menos de 1 hora en horario laboral · Guatemala
          </p>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer style={{ background: '#0c1520', padding: '32px clamp(16px,4vw,60px)' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg,' + TEAL + ',#00c48c)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 13 }}>
              {APP_NAME[0]}
            </div>
            <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, fontWeight: 700 }}>{APP_NAME}</span>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>— {APP_TAGLINE}</span>
          </div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <a href="?legal=privacy" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, textDecoration: 'none' }}>Privacidad</a>
            <a href="?legal=terms" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, textDecoration: 'none' }}>Términos</a>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>© {new Date().getFullYear()} · Hecho en Guatemala 🇬🇹</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── Sub-secciones como componentes separados para mejor organización ──────────

function FeaturesSection({ features, scrollTo }) {
  var _ref = useVisible(0.05); var ref = _ref[0]; var visible = _ref[1];
  return (
    <section id="features" ref={ref} style={{ padding: 'clamp(60px,8vw,100px) clamp(16px,4vw,60px)' }}>
      <div style={{ maxWidth: 1140, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 54, opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(24px)', transition: 'opacity 0.6s ease, transform 0.6s ease' }}>
          <div style={{ display: 'inline-block', background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.25)', borderRadius: 20, padding: '5px 16px', fontSize: 11, color: TEAL, fontWeight: 800, marginBottom: 16, letterSpacing: 1.2 }}>
            ✦ FUNCIONES
          </div>
          <h2 style={{ fontSize: 'clamp(24px,3.5vw,40px)', fontWeight: 900, color: NAVY, margin: '0 0 14px', letterSpacing: '-0.3px' }}>
            Todo lo que necesitás en un solo lugar
          </h2>
          <p style={{ fontSize: 16, color: '#666', margin: 0, maxWidth: 500, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.65 }}>
            11 módulos integrados que trabajan juntos para que vos solo te preocupés de vender.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 18 }}>
          {features.map(function(f, i) {
            return (
              <div key={f.title} className="feat-card" style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'none' : 'translateY(28px)',
                transition: 'opacity 0.5s ' + (0.04 * i) + 's ease, transform 0.5s ' + (0.04 * i) + 's ease, box-shadow 0.25s ease, border-color 0.25s ease',
              }}>
                <div className="feat-icon" style={{ fontSize: 34, marginBottom: 14, display: 'inline-block' }}>{f.ic}</div>
                <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 800, color: NAVY }}>{f.title}</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#666', lineHeight: 1.65 }}>{f.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HowItWorks({ pasos }) {
  var _ref = useVisible(0.1); var ref = _ref[0]; var visible = _ref[1];
  return (
    <section ref={ref} style={{ background: 'linear-gradient(135deg,#f0fdf8 0%,#eff6ff 100%)', padding: 'clamp(60px,8vw,90px) clamp(16px,4vw,60px)' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(20px)', transition: 'opacity 0.6s ease, transform 0.6s ease' }}>
          <div style={{ display: 'inline-block', background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.25)', borderRadius: 20, padding: '5px 16px', fontSize: 11, color: TEAL, fontWeight: 800, marginBottom: 16, letterSpacing: 1.2 }}>
            ✦ CÓMO FUNCIONA
          </div>
          <h2 style={{ fontSize: 'clamp(24px,3.5vw,38px)', fontWeight: 900, color: NAVY, margin: '0 0 12px' }}>
            Empezás hoy, en menos de 5 minutos
          </h2>
          <p style={{ fontSize: 15, color: '#666', margin: '0 0 48px' }}>Sin instalaciones, sin servidores, sin dolores de cabeza.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
          {pasos.map(function(p, i) {
            return (
              <div key={p.n} style={{
                background: '#fff',
                borderRadius: 18,
                padding: '28px 22px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                border: '1px solid rgba(29,158,117,0.12)',
                opacity: visible ? 1 : 0,
                transform: visible ? 'none' : 'translateY(30px)',
                transition: 'opacity 0.55s ' + (0.1 * i) + 's ease, transform 0.55s ' + (0.1 * i) + 's ease',
                position: 'relative',
              }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: TEAL, letterSpacing: 1, marginBottom: 12, opacity: 0.7 }}>{p.n}</div>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,' + TEAL + ',#00c48c)', color: '#fff', fontWeight: 900, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 6px 18px rgba(29,158,117,0.35)' }}>
                  {i + 1}
                </div>
                <h4 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800, color: NAVY }}>{p.titulo}</h4>
                <p style={{ margin: 0, fontSize: 13, color: '#666', lineHeight: 1.6 }}>{p.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TestimoniosSection({ testimonios }) {
  var _ref = useVisible(0.1); var ref = _ref[0]; var visible = _ref[1];
  return (
    <section id="testimonios" ref={ref} style={{ padding: 'clamp(60px,8vw,100px) clamp(16px,4vw,60px)', background: '#fff' }}>
      <div style={{ maxWidth: 1060, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 50, opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(20px)', transition: 'opacity 0.6s ease, transform 0.6s ease' }}>
          <div style={{ display: 'inline-block', background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.25)', borderRadius: 20, padding: '5px 16px', fontSize: 11, color: TEAL, fontWeight: 800, marginBottom: 16, letterSpacing: 1.2 }}>
            ✦ CLIENTES
          </div>
          <h2 style={{ fontSize: 'clamp(24px,3.5vw,38px)', fontWeight: 900, color: NAVY, margin: '0 0 12px' }}>
            Lo que dicen nuestros clientes
          </h2>
          <p style={{ fontSize: 15, color: '#666', margin: 0 }}>Negocios reales, resultados reales.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20 }}>
          {testimonios.map(function(t, i) {
            return (
              <div key={t.nombre} className="testi-card" style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'none' : 'translateY(28px)',
                transition: 'opacity 0.55s ' + (0.12 * i) + 's ease, transform 0.55s ' + (0.12 * i) + 's ease, box-shadow 0.25s ease',
              }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
                  {[1,2,3,4,5].map(function(s) { return <span key={s} style={{ color: '#f59e0b', fontSize: 15 }}>★</span>; })}
                </div>
                <p style={{ margin: '0 0 20px', fontSize: 14, color: '#444', lineHeight: 1.7, fontStyle: 'italic' }}>
                  "{t.texto}"
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,' + TEAL + ',#00c48c)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 15 }}>
                    {t.nombre[0]}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: NAVY }}>{t.nombre}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{t.negocio}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PreciosSection({ planes, scrollTo }) {
  var _ref = useVisible(0.08); var ref = _ref[0]; var visible = _ref[1];
  return (
    <section id="precios" ref={ref} style={{ background: '#f8fafc', padding: 'clamp(60px,8vw,100px) clamp(16px,4vw,60px)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 52, opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(20px)', transition: 'opacity 0.6s ease, transform 0.6s ease' }}>
          <div style={{ display: 'inline-block', background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.25)', borderRadius: 20, padding: '5px 16px', fontSize: 11, color: TEAL, fontWeight: 800, marginBottom: 16, letterSpacing: 1.2 }}>
            ✦ PRECIOS
          </div>
          <h2 style={{ fontSize: 'clamp(24px,3.5vw,40px)', fontWeight: 900, color: NAVY, margin: '0 0 12px' }}>Planes y precios</h2>
          <p style={{ fontSize: 15, color: '#666', margin: 0 }}>Sin contratos — pagás mes a mes y cancelás cuando quieras.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(270px,1fr))', gap: 20, alignItems: 'center' }}>
          {planes.map(function(p, i) {
            return (
              <div key={p.name} className="plan-card" style={{
                background: p.highlight ? 'linear-gradient(145deg,' + NAVY + ',#1a2c44)' : '#fff',
                border: p.highlight ? '2px solid ' + TEAL : '1px solid #e2e8f0',
                boxShadow: p.highlight ? '0 20px 60px rgba(29,158,117,0.2)' : '0 4px 20px rgba(0,0,0,0.05)',
                position: 'relative',
                transform: p.highlight ? (visible ? 'scale(1.04)' : 'scale(0.96)') : (visible ? 'none' : 'translateY(20px)'),
                opacity: visible ? 1 : 0,
                transition: 'opacity 0.55s ' + (0.1 * i) + 's ease, transform 0.55s ' + (0.1 * i) + 's ease, box-shadow 0.25s ease',
              }}>
                {p.highlight && (
                  <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(90deg,' + TEAL + ',#00c48c)', color: '#fff', padding: '5px 20px', borderRadius: 24, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap', letterSpacing: 0.5, boxShadow: '0 4px 12px rgba(29,158,117,0.4)' }}>
                    ★ MÁS POPULAR
                  </div>
                )}
                <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: p.highlight ? '#fff' : p.color }}>{p.name}</h3>
                <div style={{ margin: '0 0 6px', display: 'flex', alignItems: 'baseline', gap: 2 }}>
                  <span style={{ fontSize: 14, color: p.highlight ? 'rgba(255,255,255,0.6)' : '#888', fontWeight: 600 }}>Q</span>
                  <span style={{ fontSize: 44, fontWeight: 900, color: p.highlight ? '#fff' : NAVY, lineHeight: 1, letterSpacing: '-1px' }}>{p.price}</span>
                  <span style={{ fontSize: 14, color: p.highlight ? 'rgba(255,255,255,0.5)' : '#aaa' }}>/mes</span>
                </div>
                <p style={{ fontSize: 12, color: p.highlight ? 'rgba(255,255,255,0.45)' : '#aaa', margin: '0 0 22px' }}>Sin contrato · Cancela cuando quieras</p>
                <ul style={{ margin: '0 0 28px', padding: 0, listStyle: 'none' }}>
                  {p.features.map(function(f) {
                    return (
                      <li key={f} style={{ padding: '8px 0', fontSize: 14, color: p.highlight ? 'rgba(255,255,255,0.82)' : '#444', borderBottom: '1px solid ' + (p.highlight ? 'rgba(255,255,255,0.08)' : '#f0f4f8'), display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{ color: TEAL, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>✓</span>
                        {f}
                      </li>
                    );
                  })}
                </ul>
                <button
                  onClick={function() { scrollTo('contacto'); }}
                  className={p.highlight ? 'btn-primary' : ''}
                  style={p.highlight ? { width: '100%', fontSize: 15 } : {
                    width: '100%', padding: '13px', borderRadius: 10, border: '1.5px solid #d1d5db',
                    background: 'transparent', color: '#444', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                    transition: 'background 0.18s ease, border-color 0.18s ease',
                  }}
                >
                  {p.highlight ? 'Empezar ahora →' : 'Solicitar información'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
