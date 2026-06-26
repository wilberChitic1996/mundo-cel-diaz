# CLAUDE.md — Mundo Cel Diaz · Frontend

**INSTRUCCIÓN PARA CLAUDE:** Leer este archivo COMPLETO al inicio de cada sesión antes de hacer cualquier cambio o dar cualquier respuesta técnica. Este archivo es la fuente de verdad del proyecto.

---

## Prompt de inicio de sesión (copiar y pegar al iniciar)

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
| **API Railway** | Proyecto `remarkable-warmth` o `observant-possibility` | El otro proyecto Railway |
| **Base de datos** | Supabase `mundo-cel-diaz` (AWS us-west-2) | Supabase `mundo-cel-diaz-staging` (AWS us-east-1) |

El frontend detecta automáticamente cuál API usar por hostname (`src/utils/api.js`):
- `localhost` → API local `http://localhost:4000/api`
- hostname contiene `staging` → API staging
- `mundoceldiaz.com` → API producción
- cualquier otro → API producción (fallback)

---

## Repos GitHub

- **Frontend:** `wilberchitic1996/mundo-cel-diaz`
- **API/Backend:** `wilberchitic1996/mundo-cel-diaz-api`

**Rama de desarrollo activa:** `claude/gifted-heisenberg-r6n8jo` (en AMBOS repos).

---

## Workflow obligatorio — Siempre seguir este orden

```
1. Desarrollar en rama: claude/gifted-heisenberg-r6n8jo
2. PR → staging (piloto) → validar que funciona
3. Solo después de validar en piloto → PR → main (producción)
4. Si hay cambios de base de datos → aplicar en AMBAS (staging y producción)
```

**NUNCA** hacer cambios directamente en `main` sin pasar por piloto primero.

---

## Reglas críticas de base de datos

### Sistema multinegocio (multi-tenant)
Este sistema maneja MÚLTIPLES negocios en la misma base de datos.
Cada negocio se identifica por su `tenant_id`.

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
Cuando se haga una migración de base de datos:
1. Aplicar primero en **Supabase staging** (`mundo-cel-diaz-staging`)
2. Validar en piloto que funciona
3. Aplicar en **Supabase producción** (`mundo-cel-diaz`)

---

## Tenant de producción — PROTEGIDO

- **Tenant:** MUNDO CEL DIAZ
- **tenant_id:** `00000000-0000-0000-0000-000000000001`
- **NUNCA** modificar datos de este tenant sin aprobación explícita del usuario.
- Todos los cambios de DB deben revisarse con el usuario antes de ejecutarse.

---

## Estructura del frontend

```
src/
  App.jsx              — Componente raíz, sidebar, routing entre pantallas
  screens/             — Una pantalla por archivo (24 módulos)
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
  app.js              — Express + CORS (permite *.vercel.app y FRONTEND_URL env var)
  routes/             — 17 archivos, uno por módulo (ya bien estructurado, no refactorizar)
    auth.js, products.js, sales.js, accounts.js, returns.js, defectives.js,
    users.js, clients.js, repairs.js, audit.js, warranties.js, caja.js,
    settings.js, suppliers.js, categories.js, locations.js, admin.js
  middleware/
    rateLimit.js      — Límite de peticiones por IP
  supabase.js         — Cliente Supabase
```

---

## Decisiones técnicas importantes

### Hashing de contraseñas
- Actual: Bcrypt (10 rounds) — `$2a$` o `$2b$` al inicio del hash
- Legacy: SHA-256 + salt `mnpos_salt_2026` — auto-migra a bcrypt en login exitoso

### Sesión de usuario
Guardada en `sessionStorage` con clave `mnpos-api-session`.

### CORS del API
`app.js` en el repo API acepta:
- Orígenes en variable de entorno `FRONTEND_URL` (Railway)
- Cualquier `*.vercel.app` (staging y PR previews)
- Requests sin origen (Postman, server-to-server)

---

## Historial de PRs importantes

| PR | Repo | Descripción |
|---|---|---|
| #104 | Frontend | Refactorización: App.jsx 8,104 → 1,921 líneas, extracción de 24 pantallas |
| #105 | Frontend | Fix build: usePaginator.js→.jsx, AccountsScreen import, fmt.js→formatters.js |
| #106 | Frontend | Fix api.js: restaurar detección staging vs producción + crear CLAUDE.md |
| API #48 | Backend | Fix CORS: permitir *.vercel.app en el API |

---

## Estado actual del trabajo (actualizar en cada PR)

- **Rama activa:** `claude/gifted-heisenberg-r6n8jo` en frontend y API
- **Último cambio:** Restauración de detección staging/producción en api.js (fue roto por error en PR #106, corregido en mismo PR)
- **Staging:** Pendiente de validar que funciona con las credenciales propias del piloto
- **Producción:** Aún tiene código viejo (App.jsx monolítico) — merge pendiente de aprobación del usuario

---

## Backlog / Pendientes

### Alta prioridad
- [ ] **Merge a producción:** Una vez validado piloto, mergear `claude/gifted-heisenberg-r6n8jo` → `main`

### Media prioridad
- [ ] **Historial de movimientos:** Agregar columna "Artículos" mostrando productos/servicios de cada venta en la misma fila (la boleta ya tiene esa info, solo hay que traerla al listado)
- [ ] **Secciones en Catálogos:** Gestionar ubicaciones/secciones desde el módulo Catálogos antes de asignarlas a productos (igual que funciona con categorías)

### Baja prioridad / Evaluar
- [ ] **Reparaciones en Historial:** Evaluar si mostrarlas en historial de movimientos o mantener módulo separado (actualmente solo muestra ventas, créditos, abonos, devoluciones)
