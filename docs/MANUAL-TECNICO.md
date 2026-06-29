# 📘 Manual Técnico — PraxisGT / Mundo Cel Diaz

> **Enciclopedia del software.** Pensada para tener "el hilo completo" en cada sesión.
> `CLAUDE.md` = reglas + estado (la memoria viva). **Este manual** = cómo está construido todo,
> de punta a punta, con datos reales explorados de ambos repos (no inventados).
>
> Repos: **frontend** `wilberchitic1996/mundo-cel-diaz` · **API** `wilberchitic1996/mundo-cel-diaz-api`.
> Última actualización del manual: 29 jun 2026.

## Índice
1. [Visión general + glosario](#1-visión-general--glosario)
2. [Arquitectura + flujo frontend→API→BD](#2-arquitectura--flujo-frontendapibd)
3. [Las 25 pantallas (frontend)](#3-las-25-pantallas-frontend)
4. [Los endpoints del API (por archivo de ruta)](#4-los-endpoints-del-api-por-archivo-de-ruta)
5. [Modelo de datos + divergencias reales de esquema](#5-modelo-de-datos--divergencias-reales-de-esquema)
6. [Flujos de negocio end-to-end](#6-flujos-de-negocio-end-to-end)
7. [Integraciones externas](#7-integraciones-externas)
8. [🔦 Funciones ocultas / subutilizadas](#8--funciones-ocultas--subutilizadas)
9. [Runbook de operación](#9-runbook-de-operación)
10. [Roadmap + deuda técnica](#10-roadmap--deuda-técnica)

---

## 1. Visión general + glosario

**Qué es:** sistema de gestión (POS + taller) multi-negocio (SaaS) para tiendas de
celulares y reparación en Guatemala. Vende, fía (cuentas por cobrar), repara, controla
inventario (con seriales/IMEI), caja diaria, garantías, devoluciones, compras a proveedores,
reportes (cuadres), auditoría y respaldos. Cada negocio es un **tenant** aislado.

**Stack:** React 18.3 + Vite 5.4 (frontend, PWA, opcional Electron .exe) · Express 5.2 + Node ≥18
(API) · Supabase PostgreSQL (service_role, bypassa RLS) · Redis o Map en memoria (caché) ·
Vercel (frontend) · Railway (API).

### Glosario
| Término | Significado |
|---|---|
| **Tenant** | Negocio/cliente del SaaS. Todo se filtra por `tenant_id`. |
| **Boleta / Comprobante** | Recibo (impreso, PDF, imagen o WhatsApp). |
| **Caja / Cuadre** | Sesión de efectivo diaria / reporte de cierre de período. |
| **Cuenta** | Venta a crédito (cuenta por cobrar). **Abono** = pago parcial. **Saldo** = lo que falta. |
| **Reparación (REP-xxxxxx)** | Orden de taller. **Defectuoso** = ítem dañado. **Devolución** = reembolso. |
| **Folio** | Número de referencia (últimos caracteres del UUID). |
| **IVA** | 12% en GT (configurable por tenant). **DPI** = documento de identidad (cifrable, A13). |
| **Serial / IMEI** | Número único por unidad (tabla `product_serials`). **Variante** = color/capacidad. |
| **RBAC** | 4 roles: `superadmin` / `admin` / `cajero` / `auditor`. |

---

## 2. Arquitectura + flujo frontend→API→BD

### Dos ambientes aislados (NUNCA mezclar)
| | Producción | Staging (Piloto) |
|---|---|---|
| Frontend | `mundoceldiaz.com` (rama `main`) | `mundo-cel-diaz-staging.vercel.app` (rama `staging`) |
| API | Railway `remarkable-warmth` (`...up.railway.app/api`) | Railway `observant-possibility` (`...-e546.up.railway.app/api`) |
| BD | Supabase `rhecnmfivygkayfvauxt` | Supabase `aawjhttlaydwsipsifre` |

### Cómo el frontend elige a qué API hablar — `src/utils/api.js` → `resolveApiUrl()`
- `localhost`/`127.0.0.1` → `http://localhost:4000/api`
- hostname contiene `staging` → API staging (e546)
- `mundoceldiaz.com` → API producción
- cualquier otro → API producción (fallback)

`API_PROD`/`API_STAGING` son constantes en `api.js`. **NO tocarlas** (rompe el aislamiento).

### Camino de una petición
```
Pantalla (src/screens/*.jsx)
  → módulo de API (src/utils/api.js, axios con interceptor que agrega el JWT Bearer
     y desempaqueta response.data automáticamente)
  → API Express: app.js (CORS *.vercel.app + Helmet + rate limit)
     → middleware: auth (valida JWT + revocación de sesión)
        → requireRole (RBAC server-side en escrituras)
           → enforceSubscription (403 si tenant vencido/inactivo)
              → handler de la ruta (routes/*.js)
                 → utils/tenant.js withTenant() filtra por tenant_id
                 → Supabase (service_role) / RPC decrement_stock
                 → utils/audit.js logAudit() registra la acción
  ← respuesta JSON
```
Orden de middleware en escrituras: **`auth → requireRole → enforceSubscription`**.

### Arranque del API — `index.js` + `app.js`
- `app.js`: Express, `trust proxy 1`, Helmet (CSP estricta), CORS (FRONTEND_URL + `*.vercel.app`),
  rate limit global (200/min/IP). Body parsers selectivos: settings 600kb, **repairs 4MB** (fotos
  base64), webhooks 50kb + **raw body** para verificar HMAC, resto 10kb. Monta cada ruta bajo
  `/api/*` y `/api/v1/*`. `GET /health` con conteo de registros (timeout 3s). Swagger en `/api-docs`.
- `index.js`: levanta el server en `PORT` (4000) y arranca los cron jobs (`startCronJobs()`).

---

## 3. Las 25 pantallas (frontend)

`src/screens/` — sin React Router; la navegación es `setView(screenId)` desde `App.jsx`.

| Pantalla | Archivo | Qué hace | APIs |
|---|---|---|---|
| **Dashboard** | DashboardScreen.jsx | KPIs del día (ventas, ingresos, caja, por cobrar), alertas (reparaciones, stock, aging 30/60/90, garantías), gráficos Recharts, RemindersWidget. | sales, accounts, products, repairs, warranties, reminders |
| **POS** | POSScreen.jsx | Checkout 2 paneles. Tipos: completo / parcial (crea cuenta) / pendiente (crédito). Métodos: efectivo/tarjeta/transferencia + **pago dividido**. Boleta: imprimir/PDF/imagen/WhatsApp. | products, sales, clients, accounts |
| **Caja** | CajaScreen.jsx | Sesión de efectivo: abrir (fondo), gastos por categoría, cerrar (conteo vs sistema → diferencia). Backup al cerrar. | caja |
| **Cuentas** | AccountsScreen.jsx | Cuentas por cobrar. Filtros + aging 0-30/31-60/61-90/+90. Registrar abono. Recordatorio masivo WhatsApp (admin). Export. | accounts, clients, products |
| **Devoluciones** | ReturnsScreen.jsx | 3 pasos: cliente → venta → reembolso. Condición bueno (reingresa stock) / defectuoso (va a Defectivos). | returns, clients, sales, products |
| **Defectivos** | DefectiveScreen.jsx | Ítems dañados. Estados: defectuoso / dado_de_baja / reingresado (suma stock). | defectives |
| **Productos** | ProductsScreen.jsx | CRUD productos. Historial precio/stock, ajuste con motivo, **import Excel**. Unidades uni/pza/serv (servicio sin stock). Código auto. Seriales y variantes. | products, serials, variants, categories, locations |
| **Inventario** | InventoryScreen.jsx | Solo lectura: por sección o lista. Filtros + alertas min_stock. Export. | products |
| **Historial** | HistoryScreen.jsx | Libro unificado: ventas, crédito, abonos, devoluciones. Filtro por período. "Entradas" = efectivo real (contado + abonos; **la venta a crédito NO se suma**, entra vía abonos). Comprobante + export. | sales, accounts, returns |
| **Reparaciones** | RepairsScreen.jsx | Órdenes REP-xxxxxx. Estados recibido→en_revision→listo→entregado. Repuestos del inventario. Anti-doble-cobro (marca entregado al cobrar). QR + fotos (async). | repairs, clients, products |
| **Clientes** | ClientsScreen.jsx | Base de clientes (CLI-xxxxxx). Perfil 360 (compras, deuda, devoluciones). DPI opcional (13 chars, único, **cifrable**). | clients, sales, accounts, returns |
| **Garantías** | WarrantiesScreen.jsx | Vigentes/vencidas/reclamadas. Alerta ≤7 días. Duración 1/3/6/12/24m, fin auto. | warranties |
| **Cuadres** | CuadresScreen.jsx | Reporte de período: ventas por método, abonos, devoluciones, margen, top-5. Export Excel/PDF. | sales, accounts, returns, products |
| **Auditoría** | AuditScreen.jsx | Log de acciones filtrable (acción, usuario, fecha). Vista diff en ediciones. | audit |
| **Respaldo** | BackupScreen.jsx | Snapshots diarios (2 AM) a Storage. Health card (edad último backup), descarga, backup manual. | backup |
| **Catálogos** | CatalogosScreen.jsx | Categorías y ubicaciones. No borra si hay productos usándolas. | categories, locations |
| **Usuarios** | UsersScreen.jsx | Gestión usuarios (admin). Roles, reset password, pregunta de seguridad. | users |
| **Proveedores** | SuppliersScreen.jsx | Tab proveedores (CRUD) + tab compras (suma stock, actualiza costo opcional). Comprobante de compra. | suppliers |
| **Config tienda** | StoreConfigScreen.jsx | Branding de boletas (nombre, logo base64, tel, dirección). Preview en vivo. | settings |
| **Ayuda** | AyudaScreen.jsx | Contacto, FAQ, tips. Estática. | — |
| **Verificar comprobante** | VerifyReceipt.jsx | Página pública `?verify=<id>` (sin login). Valida folio vía publicAPI. Para el QR. | public |
| **Landing** | LandingPage.jsx | Página pública de marketing (features, planes, CTA login/demo). | — |
| **Login** | LoginScreen.jsx | 5 flujos: login / 2FA (deshabilitado) / recuperar / pregunta / nueva pass. Bloqueo por intentos. | auth |
| **Onboarding** | OnboardingWizard.jsx | Wizard de tienda nueva (nombre, IVA, primer usuario, categorías). | admin |
| **Super Admin** | SuperAdminPanel.jsx | Panel multi-tenant (superadmin): tenants CRUD, planes, expiración, stats. | admin |

---

## 4. Los endpoints del API (por archivo de ruta)

`routes/` — todo bajo `/api/*` y `/api/v1/*`. (E = escritura protegida por `requireRole` + `enforceSubscription`.)

- **auth.js:** `POST /auth/login` (JWT 8h + refresh 30d, limiter 10/15min), `POST /auth/verify-2fa` (deshabilitado), `GET /auth/me`, `POST /auth/refresh` (rota refresh), `POST /auth/logout`, `POST /auth/find-user`, `POST /auth/verify-answer`, `POST /auth/reset-password` (limiter 8/15min).
- **products.js:** `GET /products` (cache 2min), `POST` (código auto vía RPC) E, `PUT /:id` E, `POST /:id/adjust-stock` E, `GET /:id/stock-history`, `GET /:id/price-history`, `DELETE /:id` E.
- **variants.js** (bajo /products): `GET/POST/PUT/DELETE /products/:id/variants`.
- **serials.js:** `GET/POST /products/:productId/serials` (import IMEI con Luhn, ≤500/lote), `PUT/DELETE /.../:id`, `GET /serials/search?q=`.
- **sales.js:** `GET /sales` (paginable), `POST /sales` (valida stock/descuento/seriales, liga seriales, **FEL si activo**, marca reparación entregada, pago dividido, IVA) E.
- **accounts.js:** `GET /accounts` (paginable), `POST /accounts` (idempotencia, B5) E, `POST /accounts/:id/payments` (recalcula saldo/estado) E.
- **returns.js:** `GET /returns`, `POST /returns` (bueno→stock, defectuoso→defectivos) E.
- **defectives.js:** `GET /defectives`, `PUT /:id` (reingresado→suma stock).
- **repairs.js:** `GET /repairs`, `POST` E, `PUT /:id/status`, `PUT /:id` E, `POST /:id/photos` (base64→Storage).
- **clients.js:** `GET /clients` (DPI descifrado), `POST`/`PUT` (cifra DPI; no loguea DPI en claro) E, `DELETE /:id`.
- **warranties.js:** `GET /warranties`, `POST` E, `PUT /:id`.
- **caja.js:** `GET /caja/sesiones`, `GET /caja/sesiones/activa`, `POST /caja/abrir` E, `POST /caja/cerrar/:id` E, `GET /caja/gastos`, `POST /caja/gastos` E, `DELETE /caja/gastos/:id` (admin).
- **categories.js / locations.js:** CRUD; no borran si hay productos usándolos. `locations` tiene `PUT /move-product/:productId`.
- **suppliers.js:** `GET/POST/PUT /suppliers`, `GET /suppliers/purchases`, `POST /suppliers/purchases` (suma stock).
- **settings.js:** `GET /settings` (cache 5min), `PUT /settings` (admin).
- **admin.js** (superadmin): `POST /admin/init` (INIT_SECRET), tenants CRUD + `PUT /:id` (renueva expires_at), `GET /admin/stats`, usuarios por tenant, reset/toggle/delete, `PUT /admin/me`, `GET /admin/storage-stats`, `GET /admin/subscription`.
- **reminders.js:** `GET /reminders/summary` (cuentas vencidas + garantías 7d + reparaciones estancadas), `GET /reminders/accounts` (aging).
- **push.js:** `GET /push/vapid-public-key`, `POST/DELETE /push/subscribe`.
- **backup.js:** `GET /backup/health`, `GET /backup`, `POST /backup` (manual), `GET /backup/:id/download` (URL firmada 1h).
- **audit.js:** `GET /audit` (paginado, filtros).
- **public.js** (sin auth): `GET /public/verify/:id` (QR de boletas).
- **webhooks.js** (DORMIDO): `POST /webhooks/payment` (HMAC-SHA256, 503 si `PAYMENTS_ENABLED!=='true'`).

### Middleware
- **auth.js:** valida JWT → `req.user`. **Revocación de sesión:** chequea (cache 1min) que el usuario siga activo; 401 `SESSION_REVOKED` si inactivo/eliminado; fail-open si timeout.
- **requireRole.js:** `requireRole('admin','cajero')`; superadmin siempre pasa; 403 si no.
- **enforceSubscription.js:** 403 `SUBSCRIPTION_INACTIVE` si tenant vencido/inactivo (cache 5min, fail-open).
- **rateLimit.js:** login 10/15min, recovery 8/15min, general 200/1min.

### Services
`subscriptionService.renewSubscription()` (extiende `expires_at` + invalida cache `sub:`), `felService.certifySale()` + `felProvider` (DORMIDOS, adapter-agnóstico, fail-safe), `clientService`/`productService`/`saleService` (CRUD + audit).

### Utils
`tenant.js` (withTenant/tid), `audit.js` (logAudit), `crypto.js` (AES-256-GCM, `enc:v1:`, passthrough sin key), `paging.js` (parsePaging opcional), `cache.js` (Redis o Map), `reminders.js` (cron), `backup.js` (snapshot JSON→Storage), `logger.js` (Pino), `sentry.js`.

---

## 5. Modelo de datos + divergencias reales de esquema

> 🛢️ **Fuente de verdad del esquema vivo:** `docs/DB-SCHEMA-REAL.md` (volcado de `information_schema`).
> Tablas principales y columnas: ver tabla en `CLAUDE.md` ("Tablas reales de la BD").

**Tablas (núcleo):** `tenants, users, store_settings, clients, products, categories, locations,
suppliers, sales, sale_items, accounts, account_items, account_payments, purchases, purchase_items,
returns, return_items, defectives, repairs, warranties, caja_sesiones, caja_gastos, stock_movements,
refresh_tokens, push_subscriptions, audit_logs, backups, product_serials` (009), + columnas FEL en
`sales` (017, dormidas).

**FK clave:** `accounts.sale_id → sales.id`. Borrado en orden: `account_items → account_payments →
accounts → sale_items → sales`.

**RPC:** `decrement_stock(p_product_id, p_qty, p_tenant_id)` con `SELECT FOR UPDATE` + validación
(016). El overload legacy de 2 args fue eliminado (riesgo multi-tenant). `generate_product_code()`.

### ⚠️ Divergencias reales staging vs producción (la causa #1 de bugs)
- **Nombres de columna inexistentes** que el código a veces asume: `sales.date` (es `created_at`),
  `accounts.due_date` (no existe; aging por `created_at`), `repairs.client`/`device` (son
  `client_name`/`brand`+`model`).
- **Ubicación de producto:** prod usa `shelf` ("Mueble N · X"); staging usa `position` (alfanumérico).
- **Tipos de `id`:** prod `text`, staging `uuid` en `clients/repairs` y sus FKs. El API tolera ambos.
- **Columnas duplicadas en `repairs`:** `issue`+`problem_desc`, `price`+`estimated_cost`,
  `technician`+`tech_name`, `notes`+`internal_note` (ALTER del 28 jun). Canónicas: las primeras.

> **Regla:** antes de tocar cualquier query nueva, verificar columnas reales con
> `SELECT column_name FROM information_schema.columns WHERE table_name='X'`.

---

## 6. Flujos de negocio end-to-end

**Venta (POS):** carrito → tipo (completo/parcial/pendiente) → `POST /sales` (idempotency_key,
valida stock vía `decrement_stock`, liga seriales, calcula IVA, pago dividido) → si parcial/pendiente
crea `accounts` → boleta (imprimir/PDF/imagen/WhatsApp) con QR a `VerifyReceipt`.

**Cuenta por cobrar:** venta a crédito → `accounts` → abonos (`POST /accounts/:id/payments`
recalcula saldo/estado pendiente/parcial/pagado) → aging en Cuentas/Dashboard.

**Reparación:** crear orden (cliente+equipo+falla+repuestos) → estados → al cobrar genera venta
de servicio (`product_id` null si `unit==='serv'`) y **marca entregada** (anti-doble-cobro).

**Devolución:** elegir venta → reembolso → bueno reingresa stock / defectuoso crea `defectives`.

**Compra a proveedor:** seleccionar proveedor + productos (qty/costo) → suma stock (+actualiza costo opcional).

**Caja:** abrir (fondo) → ventas/gastos del día → cerrar (conteo físico vs sistema = diferencia) → backup.

**Suscripción SaaS:** `enforceSubscription` bloquea escrituras si `tenants.expires_at` venció;
un pago (webhook) → `renewSubscription` extiende `expires_at` + invalida cache → vuelve a operar.

---

## 7. Integraciones externas

| Servicio | Uso | Notas |
|---|---|---|
| **Supabase** | PostgreSQL + Storage (buckets `backups`, `repairs`) | API usa service_role (bypassa RLS). |
| **Railway** | Hosting del API (2 proyectos: prod/staging) | Sin límite de deploys. |
| **Vercel** | Hosting del frontend (2 proyectos) | Pro (sin límite diario). Production Branch: staging=`staging`, prod=`main`. |
| **Resend** | Email (2FA) | Deshabilitado hasta verificar dominio. |
| **Web Push (VAPID)** | Notificaciones PWA | Cron jobs envían push reales. |
| **Sentry** | Error tracking (front + API) | Opcional (no-op sin DSN). |
| **Redis** | Caché (opcional) | Fallback a Map en memoria. |
| **FEL (SAT)** | Facturación electrónica | DORMIDO — ver checklist en CLAUDE.md. |
| **Pasarela de cobro** | Suscripciones SaaS | DORMIDO — ver checklist en CLAUDE.md. |

---

## 8. 🔦 Funciones ocultas / subutilizadas

- **navTo:** hipervínculos entre módulos (ej. aging del Dashboard → Cuentas filtrado).
- **QR de verificación pública** (`VerifyReceipt`, sin login) en cada boleta.
- **Web Push PWA** con cron jobs (cuentas vencidas, garantías 7d, reparaciones estancadas).
- **Seriales/IMEI** (búsqueda global, validación Luhn) y **variantes** — infra completa, poco uso en UI.
- **Electron** (`npm run package`) → `.exe` Windows.
- **Dark mode** vía CSS custom properties (infra lista).
- **Storage monitoring** (`/admin/storage-stats`) + alerta push lunes si crece mucho.
- **Backups** automáticos diarios + descarga con URL firmada.
- **i18n**: locale es-GT hardcodeado; infra para inglés no cableada.

---

## 9. Runbook de operación

**Cron jobs (API, TZ Guatemala):** 2:00 backup de todos los tenants · 8:00 cuentas vencidas (push) ·
8:05 garantías por vencer (push) · 9:00 lun reparaciones estancadas · 9:05 lun alerta de storage ·
3:00 día 1 limpieza audit_logs >180d.

**Health:** `curl https://...-e546.up.railway.app/api/health` (staging) / `.../api/health` (prod).

**Deploy:** frontend = push a la rama (Vercel auto). Tras merge a `staging`, **verificar Production
Deployment** apunta al commit nuevo (regla #7) y promover si quedó atrás. API = Railway auto por rama.

**Migraciones:** `npm run migrate:up` (node-pg-migrate, desde 008). SQL siempre primero en staging,
validar, luego producción. El **usuario** corre el SQL (regla #4); Claude lo da inline (regla #2).

**Backups manuales:** BackupScreen → "Crear backup" o `POST /api/backup`.

**Variables de entorno críticas:** ver sección en `CLAUDE.md` (NO tocar sin aprobación).

**Recuperación rápida de rama local:** `git checkout staging && git pull origin staging`.

---

## 10. Roadmap + deuda técnica

**Cierre v1.0:** ver `DEFINITION_OF_DONE.md` (fuente de verdad). 10/13 bloqueantes cerrados;
A12 (cookie HttpOnly, necesita subdominio propio), A14 (paginación frontend, backend listo),
A16 (cobro) y B1 (FEL) externos.

**Deuda técnica registrada (en `CLAUDE.md` → Backlog):**
- **3 builders de boleta** casi duplicados (`buildReceiptHTML`, `printVoucher`, copia en `App.jsx`)
  → unificar en uno paramétrico (resuelve IVA + consistencia).
- IVA faltante en comprobantes impresos (printVoucher, compras, devoluciones).
- Flujos sin opciones de comprobante post-operación (abonos, reparación, compra, devolución).
- Listas que no refrescan en vivo tras mutar (Cuentas parcial, Inventario, Caja, Productos, Reparaciones).
- Columnas duplicadas en `repairs`; tipos de `id` divergentes; tablas de respaldo temporales por limpiar.
- Idempotencia en abonos (`account_payments`).

**Roadmap futuro:** FEL, multi-moneda, i18n, multisucursal (`branch_id`), comisiones por técnico,
portal del cliente, métricas por tenant, feature flags, colas (BullMQ), Supabase Storage para media.

---

> 📌 Mantené este manual sincronizado cuando cambien rutas, pantallas o esquema.
> `CLAUDE.md` enlaza a este archivo como referencia profunda.
