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
- [ ] Idempotency key en ventas (evitar ventas duplicadas si falla la red)
- [ ] Atomicidad en venta + descuento de stock (todo o nada)
- [ ] Verificar stock disponible justo antes de confirmar venta (evitar stock negativo)
- [ ] Límite de descuentos por rol (cajero max 10%, admin max 30%) con aprobación

### Prioridad ALTA — Funcionalidad de negocio
- [ ] IVA configurable en boletas (tasa configurable desde settings)
- [ ] Cuentas por cobrar con fecha de vencimiento + reporte de aging (30/60/90 días)
- [ ] Garantías en ventas y reparaciones (meses, fecha expiración, alertas)
- [ ] Rastro de auditoría (tabla audit_logs: quién cambió qué y cuándo)

### Prioridad MEDIA — Crecimiento
- [ ] Paginación en listas grandes (ventas, cuentas, historial)
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
