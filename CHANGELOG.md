# Changelog — MUNDO CEL DIAZ

Todos los cambios notables de este proyecto están documentados aquí.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/)
y usa [Semantic Versioning](https://semver.org/lang/es/).

---

## [2.1.0] — 2026-05-30

### Agregado
- 🔐 Sistema completo de autenticación (Login / Logout)
- 👥 Gestión de usuarios con roles (Administrador, Cajero, Auditor)
- 🔒 RBAC — Control de acceso basado en roles
- 🛡️ Protección contra fuerza bruta (bloqueo 5 min tras 5 intentos)
- ⏱️ Sesiones con expiración automática (8 horas)
- 🔑 Hash de contraseñas con SHA-256 + salt
- 💵 Módulo de Caja con movimientos de efectivo por período
- 🔩 Módulo de Piezas Defectuosas (reingresar / dar de baja)
- 💰 Lógica de reembolso en Devoluciones (monto editable, condición artículo)
- 📊 Excel con 8 hojas (incluye Piezas Defectuosas)

### Cambiado
- Sidebar ahora muestra nombre y rol del usuario activo
- Navegación filtrada según permisos del rol
- Dashboard actualizado con saldo de caja del día
- Branding mejorado con logo profesional

---

## [2.0.0] — 2026-05-25

### Agregado
- 💳 Módulo de Cuentas por Cobrar con historial de cuotas
- 🔄 Módulo de Devoluciones
- ⏳ Tipos de cobro en POS: Completo / Abono / Pendiente
- 👤 Campo de cliente en ventas
- 💾 Respaldo en Excel (7 hojas) y JSON
- 📥 Restaurar desde JSON

### Cambiado
- Arquitectura refactorizada: pantallas a nivel módulo (fix pérdida de foco en inputs)
- Datos demo actualizados para taller de reparación de celulares

---

## [1.0.0] — 2026-05-20

### Agregado
- 🛒 POS básico con catálogo y carrito
- 📦 Gestión de productos por código y estantería
- 🗄️ Vista de inventario por sección
- 📋 Historial de ventas
- 💾 Exportación a JSON (respaldo básico)
- 🖥️ Launcher .bat para Windows
- 📴 Versión offline auto-contenida

---

## Convenciones de commits

```
feat:     nueva funcionalidad
fix:      corrección de bug
docs:     documentación
style:    formato (sin cambio de lógica)
refactor: refactorización sin cambio de funcionalidad
test:     pruebas
chore:    mantenimiento
```
