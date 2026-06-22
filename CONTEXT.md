# CONTEXT — MUNDO CEL DIAZ
> Este archivo lo actualiza Claude al final de cada sesión. Úsalo como prompt inicial.

## Prompt de inicio (copia y pega esto en cada nueva sesión)

```
Hola, soy Wilber. Continuamos con MUNDO CEL DIAZ.
Lee el archivo CONTEXT.md en la rama main de https://github.com/wilberChitic1996/mundo-cel-diaz
y dime en qué quedamos. Luego pregúntame qué trabajamos hoy.
```

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
- JWT con expiración de 8h
- Errores internos de Supabase ocultos al cliente

---

## Pendiente por implementar (roadmap)

### Prioridad ALTA — Integridad de datos
- [ ] Atomicidad en venta + descuento de stock (todo o nada)
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
- [ ] Garantías en ventas y reparaciones — pendiente consultar con cliente
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
