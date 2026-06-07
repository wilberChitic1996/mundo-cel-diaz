# 📱 MUNDO CEL DIAZ — Sistema de Gestión v2.1

Sistema POS profesional para taller de reparación de teléfonos. Gestión de ventas, inventario, cuentas por cobrar, devoluciones, piezas defectuosas y control de caja.

![Version](https://img.shields.io/badge/version-2.1.0-green)
![Stack](https://img.shields.io/badge/stack-React%2018%20%2B%20JavaScript-blue)
![Status](https://img.shields.io/badge/estado-en%20desarrollo%20activo-brightgreen)

---

## 🚀 Inicio rápido

### Opción A — Con internet (recomendado para desarrollo)
1. Descargá `MiNegocioPOS.html`
2. Doble clic en `Abrir MiNegocio POS.bat`
3. Credenciales iniciales: `admin@mundoceldiaz.com` / `Admin2026#`

### Opción B — Sin internet (producción local)
1. Descargá `MiNegocioPOS_OFFLINE.html`
2. Doble clic en `Abrir POS OFFLINE.bat`

### Opción C — Desde código fuente (desarrollo)
```bash
git clone https://github.com/TU_USUARIO/mundo-cel-diaz.git
cd mundo-cel-diaz
npm install
npm run dev
# Abre en http://localhost:3000
```

---

## 🔐 Sistema de Autenticación (Fase 2)

| Rol | Acceso | Descripción |
|-----|--------|-------------|
| **Administrador** | Total | Todos los módulos + gestión de usuarios |
| **Cajero** | Limitado | Dashboard, POS, Caja, Cuentas, Historial |
| **Auditor** | Solo lectura | Dashboard, Caja, Inventario, Historial |

**Credenciales por defecto (cambiar en primer uso):**
- Email: `admin@mundoceldiaz.com`
- Contraseña: `Admin2026#`

**Seguridad implementada:**
- Contraseñas hasheadas con SHA-256 + salt
- Sesiones con expiración automática (8 horas)
- Bloqueo por 5 minutos tras 5 intentos fallidos
- Acceso por rol filtrado en frontend

---

## 📦 Módulos del sistema

| Módulo | Estado | Descripción |
|--------|--------|-------------|
| 📊 Dashboard | ✅ v2.1 | Métricas, saldo de caja, alertas |
| 🛒 Nueva Venta | ✅ v2.1 | POS completo, cobro/abono/pendiente |
| 💵 Caja | ✅ v2.1 | Movimientos de efectivo por período |
| 💳 Cuentas | ✅ v2.1 | Cuentas por cobrar + cuotas |
| 🔄 Devoluciones | ✅ v2.1 | Con reembolso y condición del artículo |
| 🔩 Piezas Defect. | ✅ v2.1 | Gestión de piezas dañadas |
| 📦 Productos | ✅ v2.1 | CRUD con código y estantería |
| 🗄️ Inventario | ✅ v2.1 | Vista por sección |
| 📋 Historial | ✅ v2.1 | Ventas con detalle |
| 💾 Respaldo | ✅ v2.1 | Excel (8 hojas) + JSON |
| 👥 Usuarios | ✅ v2.1 | RBAC completo |
| 🔐 Login/Logout | ✅ v2.1 | Auth con roles |

---

## 🛠️ Stack tecnológico

```
Frontend:    React 18 + JavaScript (JSX)
Transpilado: Babel Standalone 7.x
Datos:       localStorage (migración a PostgreSQL planificada)
Exportación: SheetJS 0.18.x
Distribución: HTML auto-contenido + BAT launcher
```

---

## 📁 Estructura del proyecto

```
mundo-cel-diaz/
├── MiNegocioPOS.html           # Sistema online
├── MiNegocioPOS_OFFLINE.html   # Sistema offline (4 MB)
├── Abrir MiNegocio POS.bat     # Launcher Windows
├── Abrir POS OFFLINE.bat       # Launcher offline
├── src/
│   ├── App.jsx                 # Componente principal
│   ├── components/             # Sidebar, Forms, MetricBox
│   ├── screens/                # Una pantalla por archivo
│   ├── utils/                  # db.js, formatters.js, excel.js
│   └── styles/                 # theme.js, global.css
├── database/
│   └── schema.sql              # SQLite/PostgreSQL schema
└── docs/
    └── MundoCelDiaz_Documentacion_Tecnica.docx
```

---

## 🗄️ Base de datos

**Actual:** `localStorage` del navegador

**Schema SQL listo** en `database/schema.sql`:
- 8 tablas (products, sales, sale_items, accounts, account_payments, returns, return_items, defectives)
- 4 vistas (ventas por día, cuentas pendientes, stock bajo, top productos)
- Compatible SQLite y PostgreSQL

**Migración planificada:** Node.js + Express + PostgreSQL (Fase 6)

---

## 🗺️ Roadmap

- **v2.1** ✅ — Auth (login/roles/usuarios), Caja, Devoluciones con lógica de reembolso
- **v3.0** 🔄 — Impresión de recibos, reportes PDF, módulo de reparaciones
- **v3.5** ⏳ — Backend Node.js + API REST + PostgreSQL local
- **v4.0** ⏳ — Nube (Supabase), acceso online, PWA móvil
- **v4.5** ⏳ — Multi-sucursal, notificaciones, integración SAT Guatemala

---

## 🤝 Contribución

Este es un proyecto privado en desarrollo activo. Para contribuir:
1. Crea un branch: `git checkout -b feature/nombre-de-la-funcion`
2. Haz commit: `git commit -m 'feat: descripción del cambio'`
3. Push: `git push origin feature/nombre-de-la-funcion`
4. Abre un Pull Request

---

## 📄 Licencia

Software privado — Todos los derechos reservados. Ver `LICENSE.md`.

---

*Desarrollado con Claude — Anthropic | Guatemala 2026*
