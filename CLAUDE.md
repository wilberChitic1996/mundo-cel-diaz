# CLAUDE.md — Mundo Cel Diaz · Frontend

Este archivo documenta la arquitectura, decisiones y contexto del proyecto.
**Leer SIEMPRE al inicio de cada sesión antes de hacer cualquier cambio.**

---

## Arquitectura de ambientes

El proyecto tiene **dos ambientes completamente independientes**:

| | Producción | Staging (Piloto) |
|---|---|---|
| **Frontend** | `mundoceldiaz.com` (Vercel, rama `main`) | `mundo-cel-diaz-staging.vercel.app` (Vercel, rama `staging`) |
| **API** | Railway proyecto producción | Railway proyecto staging |
| **API URL** | `https://mundo-cel-diaz-api-production.up.railway.app/api` | `https://mundo-cel-diaz-api-production-e546.up.railway.app/api` |
| **Base de datos** | Supabase `mundo-cel-diaz` (AWS us-west-2) | Supabase `mundo-cel-diaz-staging` (AWS us-east-1) |

**Regla crítica:** Staging y producción tienen datos separados. Nunca se mezclan.
El frontend detecta automáticamente cuál API usar según el hostname (ver `src/utils/api.js`).

---

## Repos GitHub

- **Frontend:** `wilberchitic1996/mundo-cel-diaz`
- **API/Backend:** `wilberchitic1996/mundo-cel-diaz-api`

Rama de desarrollo activa: `claude/gifted-heisenberg-r6n8jo` (en ambos repos).

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
  hooks/
    usePaginator.jsx   — Hook de paginación (debe ser .jsx, no .js — contiene JSX)
  utils/
    api.js             — Instancia axios + todos los endpoints por módulo
    formatters.js      — Q(), fmtD(), fmtT(), gid()
    receipt.js         — getStore(), setStore(), buildReceiptHTML(), printVoucher()
    whatsapp.js        — pedirTelYEnviar(), waBoletaVenta(), etc.
    export.js          — exportExcel(), exportPDF()
  styles/
    theme.js           — TEAL, NAVY, sCard, sInput, sLabel, sTH, sTD, mkBtn(), mkBadge()
  constants/
    index.js           — APP_NAME, PERMS, ROLE_LABEL, SESS_KEY, etc.
```

---

## Decisiones arquitectónicas importantes

### api.js — detección de ambiente
El hostname del navegador determina cuál API usar:
- `localhost` / `127.0.0.1` → `http://localhost:4000/api`
- hostname contiene `staging` → API de staging
- `mundoceldiaz.com` → API de producción
- cualquier otro → API de producción (fallback)

### CORS en el API
El API lee `FRONTEND_URL` env var en Railway para lista blanca de orígenes.
Adicionalmente, cualquier `*.vercel.app` está permitido (para previews de PR y staging).
Ver `app.js` en repo `mundo-cel-diaz-api`.

### Hashing de contraseñas
Bcrypt (10 rounds). Legacy: SHA-256 + salt `mnpos_salt_2026` (auto-migra a bcrypt en login).

### Sesión
Guardada en `sessionStorage` con clave `mnpos-api-session`. Ver `src/utils/api.js`.

---

## Historial de cambios importantes

| PR | Descripción |
|---|---|
| #104 | Refactorización principal: App.jsx 8,104 → 1,921 líneas, extracción de 24 pantallas |
| #105 | Fix build: usePaginator.js→.jsx, AccountsScreen import incorrecto, fmt.js→formatters.js |
| #106 | Fix api.js: restaurar detección staging vs producción |
| API #48 | Fix CORS: permitir *.vercel.app en el API |

---

## Pendientes / Backlog

- **Historial de movimientos:** agregar columna "Artículos" con productos/servicios de cada venta
- **Secciones en Catálogos:** gestionar ubicaciones desde Catálogos antes de asignar a productos
- **Reparaciones en Historial:** evaluar si aplica mostrarlas o mantener módulo separado
