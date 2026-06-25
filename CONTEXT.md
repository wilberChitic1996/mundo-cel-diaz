# CONTEXT — MUNDO CEL DIAZ
> Este archivo lo actualiza Claude al final de cada sesión. Úsalo como prompt inicial.

## ⚠️ REGLAS OPERATIVAS CRÍTICAS (Claude DEBE cumplirlas SIEMPRE)

1. **Mantener este archivo SIEMPRE actualizado.** Actualizar CONTEXT.md y subirlo a `main` cada vez que:
   - Se mergea un PR o se hace cualquier cambio en código/infra/DB.
   - El usuario diga "agregar esto a pendientes" o algo similar → registrarlo de inmediato en la sección 🔴 PENDIENTE.
   - Se complete un pendiente → marcarlo como ✅ y moverlo a "Ya resuelto".
2. **No depender de la memoria entre sesiones.** Verificar SIEMPRE contra el código real (git log, GitHub, lectura de archivos) antes de afirmar que algo está hecho o pendiente.
3. **Commitear el MD directo a `main`** (es documentación, no requiere PR). Si el usuario prefiere PR para el MD, preguntar. Mensaje de commit claro describiendo qué cambió de estado.
4. **Al cerrar cada sesión:** agregar entrada al Historial de sesiones con fecha y lo trabajado.

## Prompt de inicio (copia y pega esto en cada nueva sesión)

```
Hola, soy Wilber. Continuamos con MUNDO CEL DIAZ.
Lee el archivo CONTEXT.md en la rama main de https://github.com/wilberChitic1996/mundo-cel-diaz
y dime en qué quedamos. Luego pregúntame qué trabajamos hoy.
```

---

## 🔴 PENDIENTE AHORA MISMO (actualizado 25 junio 2026)

> Verificar SIEMPRE contra el código/PRs reales antes de afirmar. No confiar solo en memoria.

| # | Tarea | Estado | Cómo se confirma |
|---|-------|--------|------------------|
| 0 | **🚨 Superadmin sin acceso** — perdió contraseña / trabado en 2FA | 🔴 EN PROGRESO | Reset de password vía SQL en Supabase. Hash de `MundoCel2026!` listo. Ojo: 2FA envía código a email del superadmin vía Resend — como dominio NO está verificado, solo llega a wchitic75@gmail.com. Verificar que el email del superadmin sea ese. |
| 1 | **Resend** — verificar dominio `mundoceldiaz.com` para 2FA | ⏳ "Pending" (esperando propagación DNS de Namecheap) | Entrar a resend.com/domains → debe decir "Verified" en verde |
| 2 | **Vercel staging** — cambiar rama productiva de `main` → `staging` | ❌ Pendiente | Proyecto `mundo-cel-diaz-staging` → Settings → Git → Production Branch |
| 3 | **Ambiente piloto** — terminar configuración staging (frontend+API+DB de prueba) | ❌ Pendiente | Retomar: definir si staging usa BD separada o la misma con tenant de prueba |

**Ya resuelto y cerrado (no rehacer):**
- ✅ Railway: proyecto accidental `protective-upliftment` ELIMINADO
- ✅ BUG #9 validación itemCondition (PR #32 API, mergeado)
- ✅ DNS en Namecheap: DKIM verificado, SPF (host `send`) y MX configurados; Resend "Restart" ejecutado

**Notas Resend:** plan free solo envía al correo registrado (wchitic75@gmail.com) HASTA que el dominio esté verificado. El MX no se pudo crear en Namecheap (no expone MX en Advanced DNS) pero NO es necesario para *enviar* — solo para recibir, que no usamos. Con DKIM + SPF basta.

**Infra staging:** API staging = Railway proyecto `observant-possibility`. API prod = Railway `remarkable-warmth`. Frontend staging = Vercel `mundo-cel-diaz-staging.vercel.app`. Ambos staging usan rama `staging`.

---

## Infraestructura

| Parte | Tecnología | URL |
|-------|-----------|-----|
| Frontend | React + Vite + Electron | www.mundoceldiaz.com (Vercel) |
| Backend | Node.js + Express + Supabase | https://mundo-cel-diaz-api-production.up.railway.app |
| BD | Supabase (PostgreSQL) | — |
| Repos | GitHub | wilberChitic1996/mundo-cel-diaz y mundo-cel-diaz-api |

---

## Flujo de trabajo
1. Claude hace cambios en rama `claude/gifted-heisenberg-r6n8jo`
2. Claude crea PR hacia `main`
3. Wilber mergea el PR en GitHub
4. Railway y Vercel despliegan automáticamente
5. Wilber prueba en www.mundoceldiaz.com

---

## Módulos implementados ✅
- POS (ventas con múltiples formas de pago)
- Inventario (CRUD, importación Excel, alertas de stock mínimo)
- Cuentas por cobrar con abonos e historial de pagos
- Devoluciones con condición del artículo (bueno/defectuoso)
- Defectuosos con reingreso a inventario
- Reparaciones con workflow de estados
- Clientes con código automático
- Usuarios con roles (admin/cajero/auditor)
- Cuadres de caja por período
- Historial de ventas con boletas imprimibles
- Backup/restaurar (Excel 8 hojas + JSON)
- Login con recuperación de contraseña por pregunta secreta

---

## Seguridad implementada ✅
- Contraseñas con bcrypt (auto-migra SHA-256 al primer login)
- CORS restringido a www.mundoceldiaz.com via FRONTEND_URL en Railway
- Rate limiting en login y recuperación
- JWT con expiración de 8h (payload usa `userId`, NO `id`)
- Errores internos de Supabase ocultos al cliente
- Helmet en todos los endpoints
- **2FA por correo para superadmin** (código 6 dígitos, 10 min, vía Resend) — backend auth.js + pantalla frontend
- Logs de seguridad en login fallido/exitoso/token inválido
- **Aislamiento multi-tenant**: todas las tablas con `tenant_id` filtradas vía `withTenant()`. RLS activo en todas las tablas. API usa service_role (seguridad vive en capa Express). Tablas hijo (sale_items, account_items, etc.) heredan tenant del padre — correcto.
- **9 bugs corregidos en revisión defensiva (25 jun)**: req.user.userId en admin.js, tenant-leak en pagos de cuentas, sale_items huérfanos con rollback, 2FA bypass de usuario desactivado, errores en delete tenant, settings fallback inseguro, validación itemCondition, + null-safety frontend
- **Stock atómico**: función RPC Postgres `decrement_stock()` con SELECT FOR UPDATE (evita race condition en ventas concurrentes)
- **Constraint** `UNIQUE(tenant_id, key)` en `store_settings` (se eliminó el `UNIQUE(key)` suelto que era inseguro)

---

## Pendiente por implementar (roadmap)

### Prioridad ALTA — Integridad de datos
- [x] Atomicidad en descuento de stock (RPC Postgres `decrement_stock` con SELECT FOR UPDATE)
- [x] Verificar stock disponible justo antes de confirmar venta (evitar stock negativo)
- [x] Límite de descuentos por rol (cajero max 20%, admin sin límite) — error claro si se excede
- [x] Idempotency key en ventas (evitar ventas duplicadas si falla la red)

### Pendiente WhatsApp (para cuando se quiera pagar API)
- [ ] Recordatorios automáticos por fecha de vencimiento (cron job backend)
- [ ] Integración UltraMsg/Twilio para envío automático sin intervención del cajero
- [ ] Pantalla de configuración: días de anticipación, mensaje personalizable, activar/desactivar

### Prioridad ALTA — Funcionalidad de negocio
- [ ] IVA configurable en boletas (esperar hasta implementar facturación)
- [ ] Cuentas por cobrar con fecha de vencimiento + reporte de aging (30/60/90 días) — pendiente consultar con cliente
- [x] Garantías en ventas y reparaciones (módulo /api/warranties + pantalla)
- [x] Rastro de auditoría (tabla audit_logs: quién cambió qué y cuándo)

### Prioridad MEDIA — Crecimiento
- [x] Paginación en listas grandes (historial 25/pág, cuentas 20/pág, clientes 20/pág, reparaciones 15/pág)
- [ ] Soporte multisucursal (branch_id en todas las tablas)
- [ ] Gestión de turnos de empleados
- [ ] Comisiones por técnico en reparaciones

### Prioridad BAJA — Para venta comercial
- [ ] Manuales de usuario por rol (PDF)
- [ ] Documentación API con Swagger
- [ ] Diagrama ER de la base de datos
- [ ] Respaldo automático encriptado diario

---

## Objetivo final
Vender el sistema como POS especializado para tiendas de celulares y reparaciones en Centroamérica.

---

## Historial de sesiones

### Sesión 1 — 22 junio 2026
**Lo que se hizo:**
- Análisis completo de ambos repos
- Migración de SHA-256 a bcrypt con auto-migración transparente
- CORS configurado via FRONTEND_URL
- Errores internos de Supabase ocultos en todas las rutas
- Script `start` agregado al package.json de la API
- `.env.example` creado en la API
- Carpeta `src/src/` duplicada eliminada del frontend
- VITE_API_URL corregida en Vercel (antes apuntaba a api.example.com)
- FRONTEND_URL configurada en Railway
- PRs creados y mergeados en ambos repos
- GitHub App de Claude instalada en la cuenta
- Análisis profesional completo del sistema con roadmap

### Sesión 1 (continuación) — 22 junio 2026
**Lo que se hizo:**
- Validación de stock ANTES de registrar venta (si no hay stock suficiente, la venta se rechaza con mensaje claro)
- Límite de descuento por rol en el backend: cajero tiene máximo 20%, admin sin límite
- CONTEXT.md creado y mergeado a main para continuidad entre sesiones

### Sesión 2 — 22 junio 2026
**Lo que se hizo:**
- **Fix descuento cajero**: backend ahora valida contra precio real en BD (no originalPrice del frontend) — a prueba de manipulación
- **Fix UX checkout**: cuando el servidor rechaza una venta (descuento no autorizado, stock insuficiente) el frontend muestra mensaje en rojo y cancela. Antes lo guardaba localmente y "desaparecía" al recargar
- **Subtítulo boletas**: cambiado de "Reparación y Venta de Celulares" a "Tecnología · Accesorios · Reparaciones · Guatemala"
- **Dashboard mejorado**: gráfica de barras de ventas últimos 7 días + desglose por método de pago (Efectivo/Tarjeta/Transferencia/Mixto)
- **Búsqueda global**: modal Ctrl+K que busca clientes, productos, ventas y reparaciones en tiempo real
- **Paginación**: implementada en Historial (25/pág), Cuentas (20/pág), Clientes (20/pág), Reparaciones (15/pág)
- **Diseño responsivo completo**: POS con tabs Productos/Carrito en móvil, grillas adaptables (rg-2/rg-3/rg-4), tablas con scroll horizontal, formularios en 1 columna, touch targets de 40-42px, tipografía fluida con clamp()

### Sesión 3 — 22 junio 2026
**Lo que se hizo:**
- **Idempotency key**: UUID generado en frontend al hacer checkout, enviado con la venta. Backend verifica unicidad antes de insertar — si ya existe devuelve el registro existente (HTTP 200). Previene ventas duplicadas por doble tap o error de red
- **Rastro de auditoría (audit_logs)**: tabla nueva en Supabase con índices. Registra quién hizo qué y cuándo en: ventas, cuentas por cobrar, abonos, productos (crear/editar/eliminar), usuarios (crear/editar)
- **API /api/audit**: endpoint GET solo para admin, con filtros por tipo de registro, acción y usuario. Paginación de 50/página
- **AuditScreen**: pantalla nueva en el frontend (solo admin), con tabla paginada, filtros y detalle legible de cada evento
- **Nav**: ítem "Auditoría 🔍" agregado al sidebar (visible solo para admin via PERMS)

### Sesión 3 (continuación) — 22 junio 2026
**Lo que se hizo:**
- **WhatsApp manual (wa.me, gratis)**: botón 💬 en Historial de ventas y Cuentas por cobrar
- En Historial: botón 💬 en cada venta (lista y detalle) — envía boleta formateada
- En Cuentas: botón 💬 en cada cuenta pendiente (lista y detalle) — envía recordatorio de pago
- Si el cliente tiene teléfono guardado → abre WhatsApp directo; si no → pide el número en el momento
- Número de 8 dígitos guatemaltecos se convierte automáticamente a formato internacional (+502)
- Pendiente automático (requiere API de pago): ver sección "Pendiente WhatsApp"

### Sesión 4 — 22 junio 2026
**Lo que se hizo:**
- **Fix imagen boleta WhatsApp**: html2canvas no puede capturar iframes (seguridad del navegador). Se cambió a renderizar el recibo en un `<div>` oculto con estilos inline, html2canvas lo captura correctamente
- **Comportamiento final WhatsApp + imagen:**
  - Móvil (Chrome/Safari sobre HTTPS): Web Share API adjunta la imagen PNG directamente al mensaje
  - Escritorio/Electron: imagen se descarga como `boleta-mundoceldiaz.png` + WhatsApp se abre con texto + aviso al usuario para adjuntarla manualmente
- **Pendiente (roadmap)**: integración con API de pago (UltraMsg/Twilio) para envío automático con imagen en escritorio

### Sesiones 5-7 — 23-24 junio 2026
**Lo que se hizo:**
- **Módulo Proveedores y Compras**: tabla suppliers + purchases, pantalla SuppliersScreen, registro de compras que suma stock
- **Cierre de caja formal**: sesiones de caja, fondo inicial, gastos, arqueo con diferencia
- **Garantías**: módulo completo /api/warranties
- **2FA superadmin**: código por correo vía Resend en cada login de superadmin
- **Email 2FA**: cambiado de onboarding@resend.dev a noreply@mundoceldiaz.com (PR #30 API)
- **Fix crash Proveedores**: Rules of Hooks — usePaginator se llamaba después de `if(loading) return` (PR #76 frontend)
- **Ambiente staging/piloto**: Railway `observant-possibility` (API) + Vercel `mundo-cel-diaz-staging` (frontend), rama `staging`

### Sesión 8 — 24-25 junio 2026
**Lo que se hizo:**
- **Verificación dominio Resend**: DNS en Namecheap (DKIM ✅, SPF host `send`, MX no soportado pero no necesario). Estado "Pending" esperando propagación
- **Null-safety frontend (PRs #77, #78)**: protección `(p.code||"")`, `(p.name||"")`, `(p.shelf||"")`, `(m.desc||"")` en búsquedas/filtros de Products, POS, Suppliers, Inventory, Caja. Fix `setPage`→`resetPage` (crash al buscar)
- **Revisión defensiva exhaustiva (PR #31 API)**: 9 bugs encontrados, corregidos los reales:
  - CRÍTICO: `req.user.id`→`req.user.userId` en admin.js (superadmin no podía cambiar credenciales)
  - ALTO: tenant-leak en POST /accounts/:id/payments (verificación de tenant agregada)
  - ALTO: sale_items huérfanos (rollback agregado si falla insert)
  - ALTO: 2FA bypass de usuario desactivado (`.eq('active',true)` en verify-2fa)
  - MEDIO: errores silenciosos en delete tenant (captura + log por tabla)
- **BUG #2 stock atómico**: RPC `decrement_stock()` creada en Supabase, sales.js la usa
- **BUG #5 settings**: eliminado fallback inseguro + constraint `UNIQUE(key)` suelto borrado de DB
- **BUG #9 (PR #32)**: validación itemCondition en devoluciones
- **Railway**: proyecto accidental `protective-upliftment` eliminado
- **Verificación honesta**: el usuario pidió verificar contra código real (no memoria). Confirmado vía git log y GitHub que todo lo afirmado está mergeado a main.
