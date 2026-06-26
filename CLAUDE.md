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
| **API Railway** | Proyecto `remarkable-warmth` | Proyecto `observant-possibility` |
| **API rama (deploy)** | `main` | `staging` |
| **Base de datos** | Supabase `mundo-cel-diaz` (`rhecnmfivygkayfvauxt`, AWS us-west-2) | Supabase `mundo-cel-diaz-staging` (`aawjhttlaydwsipsifre`, AWS us-east-1) |
| **FRONTEND_URL (Railway)** | dominio de producción | `https://mundo-cel-diaz-staging.vercel.app` |

El frontend detecta automáticamente cuál API usar por hostname (`src/utils/api.js`):
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
| #107 | Frontend | Merge de refactor + CLAUDE.md a `staging` |
| #108 | Frontend | Fix api.js en `main`: enrutar dominios staging al API de piloto (no a producción) |
| API #48 | Backend | Fix CORS: permitir *.vercel.app en el API (rama `main`) |
| API #49 | Backend | Fix CORS: llevar la misma lógica `*.vercel.app` a la rama `staging` (piloto) |

---

## Estado actual del trabajo (actualizar en cada PR)

- **Rama activa:** `claude/gifted-heisenberg-r6n8jo` en frontend y API
- **Producción (frontend `main`):** YA tiene TODO el código nuevo — App.jsx refactorizado (1946 líneas) + api.js con detección de hostname correcta. El refactor ya está en producción (PRs #104, #105, #108).
- **Producción (API `main`):** tiene el fix de CORS (`*.vercel.app`).
- **Piloto (API `staging`):** fix de CORS aplicado en PR #49 (jun 2026). Tras merge, Railway redesplegó el API e546.
- **Único delta frontend `main` ↔ `staging`:** el archivo `CLAUDE.md` (solo doc). "Pasar a producción" en frontend = llevar este doc a `main`.
- **Credenciales piloto:** `admin@demo.com` / `Admin2026!` (hash bcrypt en la BD de staging).
- **Validación piloto:** en curso tras el fix de CORS del API.

---

## Backlog / Pendientes

### Alta prioridad
- [ ] **Merge a producción:** Una vez validado piloto, mergear `claude/gifted-heisenberg-r6n8jo` → `main`

### Media prioridad
- [ ] **Historial de movimientos:** Agregar columna "Artículos" mostrando productos/servicios de cada venta en la misma fila (la boleta ya tiene esa info, solo hay que traerla al listado)
- [ ] **Secciones en Catálogos:** Gestionar ubicaciones/secciones desde el módulo Catálogos antes de asignarlas a productos (igual que funciona con categorías)

### Baja prioridad / Evaluar
- [ ] **Reparaciones en Historial:** Evaluar si mostrarlas en historial de movimientos o mantener módulo separado (actualmente solo muestra ventas, créditos, abonos, devoluciones)
