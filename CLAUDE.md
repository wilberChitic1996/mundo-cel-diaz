# CLAUDE.md — PraxisGT (Mundo Cel Diaz)

**INSTRUCCIÓN PARA CLAUDE:** Leer este archivo COMPLETO al inicio de cada sesión antes de hacer cualquier cambio o dar cualquier respuesta técnica. Este archivo es la fuente de verdad del proyecto.

---

## Prompt de inicio de sesión

```
Lee el archivo CLAUDE.md del repo wilberchitic1996/mundo-cel-diaz en GitHub
y dame un resumen de: arquitectura actual, último estado del trabajo,
y pendientes. No hagas nada hasta que yo te confirme qué tarea seguiremos.
```

---

## Arquitectura de ambientes

**DOS ambientes COMPLETAMENTE independientes. Nunca mezclar datos entre ellos.**

| | Producción | Staging (Piloto) |
|---|---|---|
| **Frontend URL** | `mundoceldiaz.com` | `mundo-cel-diaz-staging.vercel.app` |
| **Frontend rama** | `main` (Vercel auto-deploya) | `staging` (Vercel auto-deploya) |
| **API URL** | `https://mundo-cel-diaz-api-production.up.railway.app/api` | `https://mundo-cel-diaz-api-production-e546.up.railway.app/api` |
| **API Railway** | Proyecto `remarkable-warmth` | Proyecto `observant-possibility` |
| **API rama (deploy)** | `main` | `staging` |
| **Base de datos** | Supabase `mundo-cel-diaz` (`rhecnmfivygkayfvauxt`, AWS us-west-2) | Supabase `mundo-cel-diaz-staging` (`aawjhttlaydwsipsifre`, AWS us-east-1) |
| **FRONTEND_URL (Railway)** | `https://mundoceldiaz.com` | `https://mundo-cel-diaz-staging.vercel.app` |

Detección automática de ambiente (`src/utils/api.js`):
- `localhost` → API local `http://localhost:4000/api`
- hostname contiene `staging` → API staging
- `mundoceldiaz.com` → API producción
- cualquier otro → API producción (fallback)

---

## ⚠️ CONFIGURACIÓN DE AMBIENTES — NO TOCAR SIN APROBACIÓN

Estos valores ya están correctos y funcionando. **NUNCA cambiarlos** salvo que el usuario lo pida explícitamente. Tocar uno solo rompe el aislamiento piloto/producción:

- **NO** cambiar las URLs de API (`API_PROD` / `API_STAGING`) en `src/utils/api.js`.
- **NO** cambiar `FRONTEND_URL` en ninguno de los dos proyectos Railway.
- **NO** cambiar las variables `SUPABASE_URL` / `SUPABASE_KEY` en Railway (cada ambiente apunta a SU propia base de datos).
- **NO** apuntar staging al API o la BD de producción "para probar". Piloto SIEMPRE usa su propia API (e546) y su propia BD (`aawjhttlaydwsipsifre`).
- El API tiene **DOS ramas**: `main` (producción) y `staging` (piloto). Un fix de backend debe llegar a AMBAS ramas, no solo a `main`.

### Lección registrada — fallo de login en piloto (jun 2026)

**Síntoma:** login en piloto fallaba con "Sin conexión al servidor".
**Causa raíz real (confirmada por Network tab → `CORS error`):** el API de staging (e546) despliega de la rama `staging`, que tenía código de CORS viejo (solo coincidencia exacta de `FRONTEND_URL`). El fix de CORS (`*.vercel.app`) solo se había mergeado a `main`, por eso producción funcionaba y piloto no.
**Fix:** PR #49 (API) llevó la misma lógica de CORS a la rama `staging`.
**Para diagnosticar este tipo de error:** abrir DevTools → Network → reintentar login → revisar Status de la petición `login` (CORS error / failed / 404 / 401) ANTES de tocar credenciales o URLs.

---

## Repos GitHub

- **Frontend:** `wilberchitic1996/mundo-cel-diaz`
- **API/Backend:** `wilberchitic1996/mundo-cel-diaz-api`

**Ramas de cada repo (AMBOS):**
- `main` = producción
- `staging` = piloto (rama base para nuevo trabajo)
- Ramas de trabajo se crean DESDE `staging` y se mergean A `staging` primero.

---

## Workflow obligatorio — Siempre seguir este orden

> ### 🔴 REGLA DE ORO: NUNCA hacer PR directo a `main`.
> Producción (`main` / `mundoceldiaz.com`) SOLO se actualiza con un PR `staging → main`,
> y SOLO después de que el usuario validó en el piloto. Cualquier otra ruta a `main`
> está PROHIBIDA. (El error histórico fue mergear PRs #104–#108 directo a `main`, por eso
> el refactor llegó a producción sin pasar por piloto.)

```
1. Crear rama de trabajo PARTIENDO DE `staging`  (no de main)
2. PR de esa rama → `staging`
3. Vercel/Railway despliegan `staging` → el usuario valida en el PILOTO
4. SOLO si el piloto funciona → PR `staging → main`
5. Vercel/Railway despliegan `main` → producción actualizada
6. Si hay cambios de base de datos → aplicar PRIMERO en Supabase staging, validar, luego en producción
```

**Por qué esto protege producción:** mientras los cambios estén en `staging`, `mundoceldiaz.com`
sigue corriendo `main` sin tocarse. Producción solo cambia cuando el usuario aprueba el PR `staging → main`.

**Invariante:** después de cada release, `staging` y `main` deben quedar idénticas (mismo código),
para que el piloto siempre refleje lo que está por salir a producción.

### Configuración de despliegue que hace posible el aislamiento (verificar en Vercel)
- **Proyecto Vercel del PILOTO** → Production Branch = `staging`
- **Proyecto Vercel de PRODUCCIÓN** → Production Branch = `main`
- **Railway piloto** (`observant-possibility`) → deploy de rama `staging`
- **Railway producción** (`remarkable-warmth`) → deploy de rama `main`
Si el proyecto Vercel del piloto apunta a `main`, NO hay aislamiento de código — corregirlo a `staging`.

---

## Reglas críticas de base de datos

### Sistema multinegocio (multi-tenant)

Este sistema maneja MÚLTIPLES negocios en la misma base de datos. Cada negocio se identifica por su `tenant_id`.

**REGLAS ABSOLUTAS:**
- Todo `SELECT`, `INSERT`, `UPDATE`, `DELETE` DEBE incluir filtro `WHERE tenant_id = ?`
- Al crear tablas nuevas, SIEMPRE incluir columna `tenant_id UUID NOT NULL`
- Al agregar índices, SIEMPRE incluir `tenant_id` como primera columna del índice
- Nunca hacer queries sin filtro de tenant — expone datos de otros negocios

### Tenant de producción — PROTEGIDO

- **Negocio:** MUNDO CEL DIAZ
- **tenant_id:** `00000000-0000-0000-0000-000000000001`
- **NUNCA** modificar datos de este tenant sin aprobación explícita del usuario
- Todo cambio de DB debe mostrarse al usuario para aprobación antes de ejecutar

### Aplicar cambios de BD en ambos ambientes

1. Aplicar primero en **Supabase staging** (`mundo-cel-diaz-staging`)
2. Validar en piloto que funciona
3. Aplicar en **Supabase producción** (`mundo-cel-diaz`)

---

## Estructura del frontend

```
src/
  App.jsx              — Componente raíz, sidebar, routing entre pantallas
  screens/             — 24 módulos independientes
    LandingPage.jsx, LoginScreen.jsx, DashboardScreen.jsx, POSScreen.jsx,
    CajaScreen.jsx, AccountsScreen.jsx, ReturnsScreen.jsx, DefectiveScreen.jsx,
    ProductsScreen.jsx, CatalogosScreen.jsx, InventoryScreen.jsx, HistoryScreen.jsx,
    ClientsScreen.jsx, RepairsScreen.jsx, WarrantiesScreen.jsx, SuppliersScreen.jsx,
    UsersScreen.jsx, AuditScreen.jsx, CuadresScreen.jsx, StoreConfigScreen.jsx,
    BackupScreen.jsx, AyudaScreen.jsx, SuperAdminPanel.jsx, OnboardingWizard.jsx
  hooks/
    usePaginator.jsx   — Hook de paginación (DEBE ser .jsx no .js — contiene JSX)
  utils/
    api.js             — Instancia axios + todos los endpoints por módulo
    formatters.js      — Q(), fmtD(), fmtT(), gid()
    receipt.js         — getStore(), setStore(), buildReceiptHTML(), printVoucher(), compartirWhatsApp()
    whatsapp.js        — pedirTelYEnviar(), waBoletaVenta(), waRecordatorio()
    export.js          — exportExcel(), exportPDF()
  styles/
    theme.js           — TEAL, NAVY, sCard, sInput, sLabel, sTH, sTD, sQtyBtn, mkBtn(), mkBadge()
  constants/
    index.js           — APP_NAME, PERMS, ROLE_LABEL, SESS_KEY, etc.
```

---

## Estructura del backend

```
mundo-cel-diaz-api/
  app.js              — Express + CORS + Helmet + Rate Limiting
  routes/             — 18 archivos, uno por módulo
    auth.js, products.js, sales.js, accounts.js, returns.js, defectives.js,
    users.js, clients.js, repairs.js, audit.js, warranties.js, caja.js,
    settings.js, suppliers.js, categories.js, locations.js, admin.js, public.js
  middleware/
    auth.js           — Validación JWT
    rateLimit.js      — Límite de peticiones por IP
  utils/
    tenant.js         — withTenant(), tid() — filtrado multi-tenant
    audit.js          — logAudit() — registro de acciones
  supabase.js         — Cliente Supabase (service_role key)
  migrations/         — Scripts SQL versionados
```

---

## Decisiones técnicas importantes

### Hashing de contraseñas
- **Actual:** Bcrypt (10 rounds) — `$2a$` o `$2b$`
- **Legacy:** SHA-256 + salt `mnpos_salt_2026` — auto-migra a bcrypt en login exitoso

### Sesión de usuario
- JWT con duración 8 horas
- Guardado en `sessionStorage` (clave `mnpos-session-v1`)
- Sin refresh token actualmente

### CORS del API
- Orígenes en variable de entorno `FRONTEND_URL` (Railway)
- Cualquier `*.vercel.app` (staging y PR previews)
- Requests sin origen (Postman, server-to-server)

### Atomicidad en stock
- Función RPC PostgreSQL `decrement_stock()` con `SELECT FOR UPDATE`
- Previene race conditions en ventas simultáneas

### Idempotency keys
- Cada venta lleva `idempotency_key` único
- Evita duplicados por doble click o reintento de red

---

## Historial de PRs importantes

| PR | Repo | Descripción |
|---|---|---|
| #104 | Frontend | Refactorización: App.jsx 8,104 → 1,921 líneas, extracción de 24 pantallas |
| #105 | Frontend | Fix build: usePaginator.js→.jsx, AccountsScreen import, fmt.js→formatters.js |
| #106 | Frontend | Fix api.js: restaurar detección staging vs producción + crear CLAUDE.md |
<<<<<<< HEAD
| #107 | Frontend | Merge de refactor + CLAUDE.md a `staging` |
| #108 | Frontend | Fix api.js en `main`: enrutar dominios staging al API de piloto (no a producción) |
| API #48 | Backend | Fix CORS: permitir *.vercel.app en el API (rama `main`) |
| API #49 | Backend | Fix CORS: llevar la misma lógica `*.vercel.app` a la rama `staging` (piloto) |
=======
| #109 | Frontend | CLAUDE.md: arquitectura de ambientes + lección CORS de piloto |
| #110 | Frontend | Merge staging → main (primer release con refactor completo) |
| #111 | Frontend | Fix boletas: datos reales del negocio + QR verificación funcional |
| #112 | Frontend | Historial: columna Artículos en cada movimiento |
| #113 | Frontend | Boletas en POS, reparaciones y compras + imagen + nota no tributaria |
| #114 | Frontend | Fix crash al cobrar venta (mkBtn → mB en modal post-venta) |
| #115 | Frontend | Release: boletas reales + crash fix + historial artículos → producción |
| #116 | Frontend | Landing page: rediseño completo con animaciones profesionales |
| #117 | Frontend | Release landing rediseñada → producción |
| #118 | Frontend | UI overhaul: design system profesional (cards, tablas, MetricBox, Sidebar) |
| #119 | Frontend | Release UI overhaul → producción |
| API #48 | Backend | Fix CORS: permitir *.vercel.app en el API |
| API #50 | Backend | Endpoint público /api/public/verify/:id para QR de boletas |
>>>>>>> claude/gifted-heisenberg-r6n8jo

---

## Estado actual del trabajo

<<<<<<< HEAD
- **Rama activa:** `claude/gifted-heisenberg-r6n8jo` en frontend y API
- **Producción (frontend `main`):** YA tiene TODO el código nuevo — App.jsx refactorizado (1946 líneas) + api.js con detección de hostname correcta. El refactor ya está en producción (PRs #104, #105, #108).
- **Producción (API `main`):** tiene el fix de CORS (`*.vercel.app`).
- **Piloto (API `staging`):** fix de CORS aplicado en PR #49 (jun 2026). Tras merge, Railway redesplegó el API e546.
- **Único delta frontend `main` ↔ `staging`:** el archivo `CLAUDE.md` (solo doc). "Pasar a producción" en frontend = llevar este doc a `main`.
- **Credenciales piloto:** `admin@demo.com` / `Admin2026!` (hash bcrypt en la BD de staging).
- **Validación piloto:** en curso tras el fix de CORS del API.
=======
- **Versión en producción:** 2.2.0
- **Último cambio (27 jun 2026):** UI overhaul profesional — design system, MetricBox, Sidebar pill, screen transitions, dark mode vars (PR #118, #119)
- **Producción:** ✅ Actualizada — mundoceldiaz.com
- **Staging:** ✅ Actualizado — mundo-cel-diaz-staging.vercel.app
- **2FA:** Implementado para superadmin, deshabilitado temporalmente (esperando verificación DNS Resend: DKIM ✓, SPF ✓, pendiente propagación)
>>>>>>> claude/gifted-heisenberg-r6n8jo

---

## Backlog / Pendientes

### 🔴 Alta prioridad — Funcional

- [ ] **2FA reactivar:** Cuando Resend termine de verificar dominio, descomentar código en `auth.js` líneas 82-99
- [ ] **Refresh token:** Implementar rotación JWT/Refresh Token (actualmente solo 8h sin renovación)
- [ ] **IVA configurable:** Campo `iva_percent` en store_settings, aplicar en boletas
- [ ] **Cuentas aging:** Reporte de cuentas por cobrar por 30/60/90 días de vencimiento

### 🟡 Media prioridad — Calidad y seguridad

- [ ] **ESLint + Prettier:** Configurar linting y formato automático en ambos repos
- [ ] **Logs estructurados:** Reemplazar console.error por logger (ej. pino o winston) con nivel/contexto
- [ ] **Monitoreo de errores:** Integrar Sentry en frontend y backend para alertas en producción
- [ ] **Uptime monitoring:** Configurar monitor de uptime para mundoceldiaz.com y la API
- [ ] **CSP estricta:** Configurar Content-Security-Policy explícita en helmet
- [ ] **Swagger/OpenAPI:** Documentar los 18 grupos de rutas del API
- [ ] **Cobertura de tests:** Aumentar cobertura con Vitest (unitarios) y Supertest (endpoints) — herramientas ya instaladas

### 🟢 Media prioridad — Funcional

- [ ] **WhatsApp automático:** Integrar UltraMsg o Twilio para envíos programados (requiere API de pago)
- [ ] **Recordatorios automáticos:** Cron backend para alertas de vencimiento de cuentas y garantías
- [ ] **Notificaciones push:** PWA push notifications para eventos clave
- [ ] **Cobros automáticos SaaS:** Stripe/Wompi para suscripciones de tenants

### 🔵 Baja prioridad — Arquitectura y escala

- [ ] **Separar capas backend:** Mover lógica de routes/ a services/ + repositories/ (Clean Architecture gradual)
- [ ] **Versionado de API:** Prefijo `/v1/` en todas las rutas para permitir evolución sin romper clientes
- [ ] **Redis caché:** Cachear queries frecuentes (productos, configuración) para reducir carga en Supabase
- [ ] **Colas de procesamiento:** BullMQ para tareas pesadas (exports grandes, emails masivos)
- [ ] **Supabase Storage:** Fotos de productos, imágenes de reparaciones, logos de negocios
- [ ] **Docker + Docker Compose:** Contenedorizar API para entorno de desarrollo consistente
- [ ] **GitHub Actions CI:** Pipeline automático de tests en cada PR (actualmente CI/CD es solo deploy)
- [ ] **Migraciones versionadas:** Herramienta formal (ej. node-pg-migrate) en lugar de scripts SQL manuales
- [ ] **Cifrado de datos sensibles:** DPI y datos personales cifrados en reposo

### ⬜ Roadmap futuro — Nuevas funcionalidades

- [ ] **Facturación electrónica SAT Guatemala (FEL):** Requiere proveedor certificado (ej. INFILE, G4S)
- [ ] **Multi-moneda:** Soporte USD además de Quetzal
- [ ] **Multi-idioma:** i18n para inglés (base guatemalteca es español)
- [ ] **Multisucursal:** `branch_id` en tablas para negocios con varias sedes
- [ ] **Comisiones por técnico:** Módulo de comisiones en reparaciones
- [ ] **Portal del cliente:** App/web donde el cliente ve sus compras y garantías
- [ ] **Métricas por tenant:** Dashboard de negocio para Super Admin con KPIs por cliente
- [ ] **Feature Flags:** Control de funcionalidades por tenant/plan
- [ ] **Blue/Green Deploy:** Deploy sin downtime
- [ ] **OpenTelemetry:** Trazabilidad completa de requests entre frontend → API → BD
- [ ] **Disaster Recovery:** Plan documentado de recuperación ante fallos

---

## Lo que YA ESTÁ implementado (NO duplicar)

Esta lista evita re-implementar cosas que ya existen:

| Categoría | Ya implementado |
|---|---|
| **Auth** | JWT 8h, bcrypt 10 rounds, auto-migración SHA-256→bcrypt, RBAC 4 roles, 2FA código (deshabilitado) |
| **Seguridad** | Helmet, rate limiting por IP, CORS estricto, idempotency keys, SELECT FOR UPDATE en stock |
| **Multi-tenant** | tenant_id en todas las tablas, withTenant() en API, RLS en Supabase |
| **BD** | audit_logs completo, índices en tenant_id+created_at, migraciones en /migrations |
| **Tests** | Vitest + Supertest instalados (cobertura baja, pendiente aumentar) |
| **Monitoring** | GET /health en API |
| **Backup** | Supabase auto-backups diarios + exportación manual Excel/JSON desde la app |
| **WhatsApp** | wa.me con mensaje pre-formateado, imagen PNG (html2canvas), números GT auto-format |
| **PDF/Excel** | jsPDF + SheetJS, exportación desde Historial, Cuadres y Backup |
| **PWA** | Service worker, manifest, instalable en móvil |
| **Electron** | Build .exe para Windows con NSIS |
| **Dark mode** | CSS custom properties completas, toggle por usuario |
| **Responsive** | 100% mobile/tablet/desktop |
| **QR boletas** | QR en comprobantes → página pública de verificación sin login |
| **Auditoría** | Log completo de acciones en audit_logs (quién, qué, cuándo, IP) |

---

## Variables de entorno críticas — NO TOCAR sin aprobación

```
# Backend Railway (producción)
SUPABASE_URL       = URL de Supabase producción
SUPABASE_KEY       = service_role key (NO la anon key)
FRONTEND_URL       = https://mundoceldiaz.com
JWT_SECRET         = secret largo y aleatorio
RESEND_API_KEY     = API key de Resend

# Backend Railway (staging)
SUPABASE_URL       = URL de Supabase STAGING (distinta de producción)
SUPABASE_KEY       = service_role key de Supabase STAGING
FRONTEND_URL       = https://mundo-cel-diaz-staging.vercel.app
```

**NUNCA** apuntar staging al API o BD de producción.
**NUNCA** cambiar estas variables sin aprobación del usuario.
