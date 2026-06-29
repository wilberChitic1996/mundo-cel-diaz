// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA PÚBLICA — TÉRMINOS DE SERVICIO Y POLÍTICA DE PRIVACIDAD
//
// Se muestra cuando la URL trae ?legal=terms o ?legal=privacy. NO requiere sesión
// (se renderiza standalone desde main.jsx, igual que la verificación de boletas).
// Requisito legal para operar como SaaS comercial (M23 del Definition of Done).
//
// ⚠️ AVISO: este texto es una base razonable redactada para un SaaS guatemalteco.
// El operador DEBE hacerlo revisar por un abogado y completar los datos de la
// entidad legal/contacto antes de considerarlo definitivo.
// ══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { APP_NAME } from '../constants/index.js';
import { TEAL, NAVY } from '../styles/theme.js';

// Datos del operador — el operador debe verificar/ajustar antes de producción.
var OPERATOR = {
  name:    APP_NAME,
  legal:   'el operador de ' + APP_NAME,
  email:   'privacidad@mundoceldiaz.com',
  country: 'Guatemala',
};
var LAST_UPDATE = '29 de junio de 2026';

// ── Contenido: Política de Privacidad ──────────────────────────────────────────
var PRIVACY = [
  ['1. Quién es el responsable',
   'Esta Política describe cómo ' + OPERATOR.name + ' ("nosotros", "la Plataforma"), operada por ' + OPERATOR.legal + ', trata los datos personales de los usuarios del sistema de gestión y punto de venta. Para consultas sobre privacidad: ' + OPERATOR.email + '.'],
  ['2. Qué datos tratamos',
   'a) Datos de cuenta del usuario del negocio: nombre, correo, rol y contraseña (almacenada solo como hash). ' +
   'b) Datos del negocio: ventas, inventario, cuentas por cobrar, reparaciones, caja y configuración. ' +
   'c) Datos de clientes finales que el negocio ingresa: nombre, teléfono, dirección y, opcionalmente, documento de identificación (DPI). ' +
   'd) Datos técnicos: dirección IP, tipo de dispositivo y registros de auditoría (quién hizo qué y cuándo).'],
  ['3. Para qué los usamos',
   'Prestar el servicio (registrar operaciones, generar comprobantes, controlar inventario y cuentas), autenticar usuarios, mantener seguridad y trazabilidad (auditoría), enviar notificaciones operativas y recordatorios, y cumplir obligaciones legales.'],
  ['4. Base del tratamiento',
   'Tratamos los datos para ejecutar el contrato de servicio con el negocio, por interés legítimo en la seguridad y mejora de la Plataforma, y con el consentimiento cuando aplica (por ejemplo, notificaciones push). El negocio es responsable de contar con base legítima para los datos de SUS clientes finales que ingresa.'],
  ['5. Rol del negocio sobre los datos de sus clientes',
   'El negocio (titular de la cuenta) decide qué datos de clientes finales ingresa y con qué fin; actúa como responsable de esos datos y ' + OPERATOR.name + ' los trata por encargo, únicamente para prestar el servicio. El negocio se compromete a informar a sus clientes y a recabar los consentimientos que correspondan.'],
  ['6. Con quién los compartimos (encargados)',
   'No vendemos datos personales. Nos apoyamos en proveedores de infraestructura que los tratan por encargo: Supabase (base de datos y almacenamiento), Railway (servidores de la API), Vercel (alojamiento del sitio), Resend (envío de correos), Sentry (monitoreo de errores) y servicios de notificaciones push. Cada uno trata los datos solo conforme a nuestras instrucciones.'],
  ['7. Transferencia internacional',
   'Algunos proveedores alojan los datos en servidores fuera de ' + OPERATOR.country + ' (por ejemplo, en Estados Unidos). Al usar la Plataforma, el usuario y el negocio entienden que los datos pueden procesarse en esas ubicaciones bajo medidas de seguridad equivalentes.'],
  ['8. Seguridad',
   'Aplicamos cifrado en tránsito (HTTPS), contraseñas con hash bcrypt, control de acceso por roles, aislamiento por negocio (multi-tenant), límites de peticiones y registros de auditoría. Ningún sistema es 100% infalible; trabajamos para reducir riesgos de forma continua.'],
  ['9. Conservación',
   'Conservamos los datos mientras la cuenta esté activa y el tiempo necesario para cumplir obligaciones legales y contables. Los registros de auditoría se conservan por un período limitado (alrededor de 180 días) y los respaldos por su ciclo de retención. Al cerrar la cuenta, los datos pueden eliminarse o anonimizarse salvo obligación legal de conservarlos.'],
  ['10. Derechos del titular',
   'El titular puede solicitar acceso, rectificación o eliminación de sus datos, y oponerse a ciertos tratamientos, escribiendo a ' + OPERATOR.email + '. Para datos de clientes finales, la solicitud se canaliza a través del negocio que los ingresó.'],
  ['11. Cookies y almacenamiento local',
   'Usamos almacenamiento del navegador (sessionStorage/localStorage) para mantener la sesión y preferencias. No usamos cookies de publicidad ni de seguimiento de terceros.'],
  ['12. Menores de edad',
   'La Plataforma está dirigida a negocios y a sus colaboradores; no está orientada a menores de edad ni recopila datos de ellos de forma intencional.'],
  ['13. Cambios',
   'Podemos actualizar esta Política. Publicaremos la versión vigente en esta misma página con su fecha de actualización. El uso continuado tras un cambio implica su aceptación.'],
];

// ── Contenido: Términos de Servicio ────────────────────────────────────────────
var TERMS = [
  ['1. Aceptación',
   'Al crear una cuenta o usar ' + OPERATOR.name + ' aceptás estos Términos de Servicio. Si no estás de acuerdo, no uses la Plataforma.'],
  ['2. Descripción del servicio',
   OPERATOR.name + ' es un sistema de gestión y punto de venta en la nube (SaaS) para negocios: ventas, inventario, clientes, cuentas por cobrar, reparaciones, caja, reportes y funciones relacionadas. El servicio se ofrece "tal cual" y puede evolucionar con el tiempo.'],
  ['3. Cuenta y responsabilidad',
   'Sos responsable de la veracidad de los datos de registro, de la confidencialidad de tus credenciales y de toda actividad realizada bajo tu cuenta. Debés notificar de inmediato cualquier uso no autorizado.'],
  ['4. Planes, pago y suscripción',
   'El acceso puede estar sujeto a una suscripción. Si la suscripción está inactiva o vencida, las operaciones de escritura pueden bloquearse hasta su renovación. Los precios y condiciones aplicables son los informados al contratar.'],
  ['5. Uso aceptable',
   'No podés usar la Plataforma para fines ilícitos, vulnerar su seguridad, intentar acceder a datos de otros negocios, ni cargar contenido que infrinja derechos de terceros. Podemos suspender cuentas que incumplan.'],
  ['6. Datos de tus clientes',
   'Los datos que ingresás sobre tus clientes finales son tu responsabilidad. Te comprometés a tratarlos conforme a la ley y a contar con las autorizaciones necesarias. Nosotros los procesamos por encargo, según la Política de Privacidad.'],
  ['7. Comprobantes y facturación',
   'Los comprobantes (boletas) que genera la Plataforma son documentos internos de control y NO constituyen una factura tributaria válida ante la SAT mientras no esté habilitada la facturación electrónica (FEL). La emisión de facturas fiscales es responsabilidad del negocio a través de un certificador autorizado.'],
  ['8. Propiedad intelectual',
   'El software, marca y diseño de ' + OPERATOR.name + ' son de su titular. Los datos que cargás siguen siendo tuyos; nos otorgás una licencia limitada para procesarlos con el único fin de prestarte el servicio.'],
  ['9. Disponibilidad',
   'Procuramos alta disponibilidad pero no garantizamos un servicio ininterrumpido. Pueden existir mantenimientos, fallas de proveedores o causas de fuerza mayor. Recomendamos usar la función de respaldo.'],
  ['10. Limitación de responsabilidad',
   'En la máxima medida permitida por la ley, ' + OPERATOR.name + ' no será responsable por daños indirectos, pérdida de datos o lucro cesante. Nuestra responsabilidad total se limita a lo pagado por el servicio en los últimos meses.'],
  ['11. Terminación',
   'Podés cancelar tu cuenta cuando quieras. Podemos suspender o terminar el acceso por incumplimiento de estos Términos o falta de pago, procurando avisarte cuando sea razonable.'],
  ['12. Ley aplicable',
   'Estos Términos se rigen por las leyes de la República de ' + OPERATOR.country + '. Cualquier controversia se someterá a los tribunales competentes de ' + OPERATOR.country + '.'],
  ['13. Cambios',
   'Podemos modificar estos Términos. Publicaremos la versión vigente en esta página con su fecha. El uso continuado tras un cambio implica su aceptación.'],
];

function buildHref(doc) {
  try {
    var u = new URL(window.location.href);
    u.searchParams.set('legal', doc);
    return u.pathname + u.search;
  } catch (e) { return '?legal=' + doc; }
}

export default function LegalPage(props) {
  var doc = props.doc === 'terms' ? 'terms' : 'privacy';
  var isTerms = doc === 'terms';
  var sections = isTerms ? TERMS : PRIVACY;
  var title = isTerms ? 'Términos de Servicio' : 'Política de Privacidad';

  var wrap = { minHeight: '100vh', background: '#f3f5f7', fontFamily: 'Arial, Helvetica, sans-serif', color: '#1f2937', padding: '0 0 60px' };
  var bar = { background: NAVY, padding: '18px clamp(16px,4vw,40px)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' };
  var logo = { width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,' + TEAL + ',#00c48c)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900 };
  var container = { maxWidth: 820, margin: '0 auto', padding: '0 clamp(16px,4vw,24px)' };
  var card = { background: '#fff', borderRadius: 14, boxShadow: '0 8px 30px rgba(0,0,0,0.08)', padding: 'clamp(20px,4vw,40px)', marginTop: 24 };
  var tab = function(active) { return { padding: '8px 16px', borderRadius: 30, fontSize: 14, fontWeight: 700, textDecoration: 'none', color: active ? '#fff' : NAVY, background: active ? TEAL : '#eef1f4', display: 'inline-block' }; };

  return (
    <div style={wrap}>
      <div style={bar}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={logo}>{APP_NAME[0]}</div>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>{APP_NAME}</span>
        </a>
      </div>

      <div style={container}>
        <div style={{ display: 'flex', gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
          <a href={buildHref('privacy')} style={tab(!isTerms)}>Privacidad</a>
          <a href={buildHref('terms')} style={tab(isTerms)}>Términos</a>
        </div>

        <div style={card}>
          <h1 style={{ fontSize: 'clamp(22px,4vw,30px)', color: NAVY, margin: '0 0 4px' }}>{title}</h1>
          <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 24px' }}>Última actualización: {LAST_UPDATE}</p>

          {sections.map(function(s, i) {
            return (
              <section key={i} style={{ marginBottom: 22 }}>
                <h2 style={{ fontSize: 17, color: NAVY, margin: '0 0 6px' }}>{s[0]}</h2>
                <p style={{ fontSize: 15, lineHeight: 1.65, color: '#374151', margin: 0 }}>{s[1]}</p>
              </section>
            );
          })}

          <p style={{ fontSize: 13, color: '#6b7280', borderTop: '1px solid #eee', paddingTop: 16, marginTop: 8 }}>
            ¿Dudas sobre {isTerms ? 'estos Términos' : 'esta Política'}? Escribinos a <a href={'mailto:' + OPERATOR.email} style={{ color: TEAL, fontWeight: 700 }}>{OPERATOR.email}</a>.
          </p>
        </div>

        <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, marginTop: 20 }}>
          © {new Date().getFullYear()} {APP_NAME} · Hecho en {OPERATOR.country} 🇬🇹
        </p>
      </div>
    </div>
  );
}
