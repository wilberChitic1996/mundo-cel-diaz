# 📘 Documentación Completa del Sistema — MUNDO CEL DIAZ (PraxisGT)

> **Para qué sirve este documento:** Aquí está explicado **TODO** lo que tiene tu
> software, con qué está hecho, dónde vive, y cómo funciona — en lenguaje sencillo,
> de modo que tú (o cualquier persona) pueda entenderlo y explicarlo, aunque nunca
> haya programado en su vida.
>
> Léelo con calma. Está dividido en secciones. Al final hay un **glosario** con
> todas las palabras técnicas explicadas como si se las contaras a un amigo.

---

## 📑 Índice

1. [¿Qué es este software? (en una frase)](#1-qué-es-este-software)
2. [La gran imagen: cómo está armado todo](#2-la-gran-imagen)
3. [Las 3 piezas principales (con una analogía de restaurante)](#3-las-3-piezas-principales)
4. [Tecnologías y lenguajes que usamos (y por qué)](#4-tecnologías-y-lenguajes)
5. [Las herramientas de la nube](#5-las-herramientas-de-la-nube)
6. [Todos los módulos del sistema (qué hace cada pantalla)](#6-todos-los-módulos)
7. [Cómo guardamos la información (la base de datos)](#7-la-base-de-datos)
8. [La seguridad: cómo protegemos el sistema](#8-la-seguridad)
9. [Cómo se publican los cambios (el flujo de trabajo)](#9-flujo-de-trabajo)
10. [Roles de usuario: quién puede hacer qué](#10-roles-de-usuario)
11. [Una característica especial: puede ser SaaS (varios negocios)](#11-modelo-saas)
12. [Glosario: todas las palabras técnicas explicadas](#12-glosario)
13. [Preguntas frecuentes que te podrían hacer](#13-preguntas-frecuentes)

---

## 1. ¿Qué es este software?

**MUNDO CEL DIAZ** (nombre técnico interno: *PraxisGT*) es un **sistema POS** —
es decir, un *Punto de Venta*— diseñado especialmente para tiendas de celulares
y talleres de reparación en Guatemala.

En palabras simples: es el programa que usa el negocio para **vender, controlar
el inventario, llevar las cuentas de los clientes que compran al crédito, manejar
la caja, registrar reparaciones y sacar reportes**. Todo desde el celular, la
computadora o la tablet, usando internet.

Piénsalo como el "cerebro digital" del negocio: todo lo que pasa en la tienda
queda registrado y organizado aquí.

---

## 2. La gran imagen

Tu sistema **no es un solo programa**, sino **tres partes que trabajan juntas**
y se comunican por internet:

```
   ┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
   │                  │         │                  │         │                  │
   │   EL FRONTEND    │ ──────► │     LA API       │ ──────► │  LA BASE DE       │
   │  (lo que ves)    │ ◄────── │  (el cerebro)    │ ◄────── │  DATOS            │
   │                  │         │                  │         │  (la memoria)     │
   └──────────────────┘         └──────────────────┘         └──────────────────┘
     React + Vite                 Node.js + Express             Supabase
     vive en VERCEL                vive en RAILWAY              (PostgreSQL)
     www.mundoceldiaz.com
```

- **El frontend** es la parte bonita, los botones, las pantallas — lo que el
  usuario ve y toca.
- **La API** es el cerebro invisible que recibe órdenes ("registra esta venta"),
  las valida y decide qué hacer.
- **La base de datos** es la memoria permanente donde queda guardado todo para
  siempre.

Estas tres partes están en **lugares distintos de internet** (la nube) y se
hablan entre sí miles de veces al día.

---

## 3. Las 3 piezas principales

Imagina que tu sistema es un **restaurante**:

| Pieza del sistema | En el restaurante sería… | Qué hace |
|---|---|---|
| **Frontend** | El comedor y el menú | Donde el cliente se sienta, ve las opciones y pide. Es lo visible y bonito. |
| **API** | El mesero y el cocinero | Recibe el pedido, revisa que se pueda hacer, lo prepara y lo entrega. Trabaja detrás, no se ve. |
| **Base de datos** | La bodega y el libro de cuentas | Donde se guardan los ingredientes (datos) y queda anotado todo lo que pasó. |

Cuando haces una venta:
1. La escribes en el **comedor** (frontend, en tu pantalla).
2. El **mesero** (API) la lleva a la cocina, revisa que haya stock, descuenta el
   inventario y calcula todo.
3. Queda anotada para siempre en el **libro de cuentas** (base de datos).

---

## 4. Tecnologías y lenguajes

Aquí va el detalle de **con qué está construido** cada parte. No te asustes con
los nombres, abajo en el glosario están todos explicados.

### 🎨 El Frontend (lo que ves)

| Tecnología | Qué es, en simple |
|---|---|
| **React 18** | La herramienta principal para construir las pantallas. Hace que los botones reaccionen y las pantallas cambien sin recargar. Es de Facebook (Meta). |
| **JavaScript (JSX)** | El lenguaje de programación en el que está escrito todo el frontend. Es el idioma de la web. |
| **Vite** | La herramienta que "empaqueta" todo el código y lo prepara para publicarlo, súper rápido. |
| **Recharts** | La librería que dibuja las **gráficas** del dashboard (las barras, los círculos de colores). |
| **SheetJS (xlsx)** | La que genera los archivos de **Excel** cuando haces un respaldo. |
| **jsPDF** | La que crea los archivos **PDF** (boletas, reportes imprimibles). |
| **html2canvas** | Toma una "foto" de la boleta para poder mandarla por WhatsApp como imagen. |
| **axios** | El "cartero" que lleva y trae los mensajes entre el frontend y la API. |
| **PWA (vite-plugin-pwa)** | Lo que permite **instalar la app en el celular** como si fuera una app de la Play Store, aunque sea una página web. |
| **Electron** | Lo que permite empaquetar el sistema como un **programa de escritorio para Windows** (.exe), si algún día se quiere instalar sin navegador. |

### 🧠 La API (el cerebro)

| Tecnología | Qué es, en simple |
|---|---|
| **Node.js** | Permite usar JavaScript en el servidor (no solo en el navegador). Es el motor que corre el cerebro. |
| **Express 5** | El "marco de trabajo" que organiza cómo la API recibe y responde las peticiones. El esqueleto del cerebro. |
| **Supabase JS** | La librería que conecta la API con la base de datos. |
| **jsonwebtoken (JWT)** | Genera el "pase de entrada" digital que comprueba que un usuario inició sesión correctamente. |
| **bcryptjs** | Encripta (vuelve ilegibles) las contraseñas para que nadie las pueda robar. |
| **express-rate-limit** | El "guardia de seguridad" que bloquea a quien intente adivinar contraseñas muchas veces seguidas. |
| **cors** | Controla qué páginas web tienen permiso de hablar con la API (solo la tuya). |
| **dotenv** | Maneja las "claves secretas" (contraseñas del sistema) sin que queden escritas en el código. |
| **ws (WebSocket)** | Permite comunicación en tiempo real con la base de datos. |

### 🗄️ La Base de Datos

| Tecnología | Qué es, en simple |
|---|---|
| **PostgreSQL** | El tipo de base de datos. Es una de las más robustas y confiables del mundo, usada por bancos y empresas grandes. |
| **Supabase** | El servicio en la nube que aloja esa base de datos PostgreSQL y la mantiene segura y respaldada. |

### 🧪 Herramientas de calidad (para que no se rompa)

| Tecnología | Qué hace |
|---|---|
| **Vitest** | Hace **pruebas automáticas** del código de la API para detectar errores antes de publicarlos. |
| **Supertest** | Prueba que las rutas de la API respondan correctamente. |
| **Git + GitHub** | Guarda **todas las versiones** del código y permite trabajar en equipo sin perder nada. Es como un "control de cambios" gigante con historial completo. |

---

## 5. Las herramientas de la nube

Tu sistema **no vive en una computadora física tuya** — vive en internet, en
servicios profesionales de la nube. Esto significa que funciona 24/7, desde
cualquier lugar, sin que tengas que tener un servidor encendido en tu casa.

| Servicio | Para qué lo usas | Por qué este y no otro |
|---|---|---|
| **Vercel** | Aloja el **frontend** (la parte visible, www.mundoceldiaz.com). | Está hecho específicamente para sitios web modernos como React. Es rapidísimo y se actualiza solo. Tiene plan gratuito generoso. |
| **Railway** | Aloja la **API** (el cerebro). | La API es un servidor que debe estar **encendido todo el tiempo** esperando peticiones. Railway mantiene servidores corriendo 24/7, ideal para esto. |
| **Supabase** | Aloja la **base de datos** (la memoria). | Da una base de datos PostgreSQL profesional, gestionada, con respaldos automáticos y seguridad. |
| **GitHub** | Guarda **todo el código** y su historial. | Es el estándar mundial. Desde aquí Vercel y Railway toman el código para publicarlo. |

### ¿Por qué la API está en Railway y no en Vercel?

Pregunta común. La respuesta:

- **Vercel** es perfecto para páginas web (frontend) y "funciones cortas". Apaga
  los servicios cuando no hay tráfico para ahorrar recursos.
- La **API con Express** necesita estar **siempre despierta** esperando, y mantener
  una conexión estable con la base de datos. Por eso va en **Railway**, que mantiene
  el servidor encendido de forma continua.

Es la combinación estándar que usan muchísimos proyectos profesionales:
**Vercel (frontend) + Railway (API) + Supabase (datos)**.

---

## 6. Todos los módulos

Tu sistema tiene **muchas pantallas**, cada una con una función. Aquí están todas:

| Módulo | Ícono | Qué hace |
|---|---|---|
| **Dashboard** | 📊 | La pantalla de inicio. Muestra ventas del día, lo vendido, saldo de caja, cuentas por cobrar, gráficas de ingresos, productos más vendidos y alertas. Es el "tablero de control" del negocio. |
| **Nueva Venta (POS)** | 🛒 | El corazón del sistema. Aquí se hacen las ventas: se agregan productos al carrito, se elige forma de pago (efectivo, tarjeta, transferencia, mixto) y se puede vender al contado o **al crédito**. |
| **Caja** | 💵 | Controla el efectivo. Apertura y cierre de caja, fondo inicial, registro de gastos/salidas de dinero. |
| **Cuentas por Cobrar** | 💳 | Maneja a los clientes que compran **al crédito**. Lleva el saldo pendiente, los abonos que van pagando y el historial de cada pago. |
| **Devoluciones** | 🔄 | Cuando un cliente regresa un producto. Registra el motivo, el reembolso y la **condición del artículo** (bueno o defectuoso). |
| **Piezas Defectuosas** | 🔩 | Las piezas dañadas que salieron del inventario por devoluciones. Se pueden dar de baja o repararlas y reingresarlas. |
| **Productos** | 📦 | El catálogo. Crear, editar y eliminar productos, con código, precio, costo, stock y ubicación en estantería. Permite **importar desde Excel**. |
| **Inventario** | 🗄️ | Vista completa del stock, con alertas de productos bajo el mínimo. |
| **Historial** | 📋 | Registro de todas las transacciones: ventas, créditos, abonos y devoluciones. Con boletas imprimibles y envío por WhatsApp. |
| **Cuadres** | 🧾 | Reportes de caja por período (hoy, semana, mes). Calcula ventas, ganancias, costos, reembolsos, efectivo neto por método de pago. |
| **Clientes** | 👥 | Directorio de clientes con código automático, teléfono, DPI. |
| **Reparaciones** | 🔧 | Taller de reparaciones con flujo de estados (recibido → en proceso → listo → entregado). |
| **Garantías** | 🛡️ | Registro de garantías de ventas y reparaciones, con fecha de vencimiento. |
| **Proveedores y Compras** | 🏭 | Directorio de proveedores e historial de compras que actualizan el stock. |
| **Usuarios** | 👤 | Gestión de quién puede entrar al sistema y con qué rol. |
| **Auditoría** | 🔍 | Registro de **quién hizo qué y cuándo** (solo administrador). Cada venta, cambio de producto, etc., queda registrado. |
| **Respaldo** | 💾 | Descarga todos los datos del negocio en un archivo **Excel** (con varias hojas) para guardar como copia de seguridad. |
| **Configuración** | ⚙️ | Datos del negocio (nombre, dirección, logo) que salen en las boletas. |
| **Ayuda** | ❓ | Guía de uso del sistema. |

### Funciones especiales que vale la pena destacar

- **Paginación en todas las listas**: las listas largas se dividen en páginas para
  que se vean ordenadas y carguen rápido. Cada lista tiene una **columna de
  numeración (#)** que continúa entre páginas.
- **Búsqueda global (Ctrl+K)**: un buscador que encuentra clientes, productos,
  ventas y reparaciones al instante.
- **WhatsApp integrado**: botón para enviar boletas o recordatorios de pago
  directo al WhatsApp del cliente.
- **Diseño responsivo**: se adapta perfecto al celular, tablet o computadora.
- **Instalable como app (PWA)**: se puede instalar en el celular como una app real.

---

## 7. La base de datos

La base de datos es donde vive **toda la información** del negocio, organizada en
**tablas** (como hojas de Excel relacionadas entre sí). Estas son las principales:

| Tabla | Qué guarda |
|---|---|
| **products** | Los productos y servicios (código, nombre, precio, costo, stock, estantería). |
| **sales** | Las ventas (cabecera): cliente, total, método de pago, fecha, tipo. |
| **sale_items** | El detalle de cada venta: qué productos y cuántos se vendieron en cada una. |
| **accounts** | Las cuentas por cobrar (créditos): cliente, total, lo pagado, el saldo. |
| **account_items** | Los productos de cada cuenta a crédito. |
| **account_payments** | Cada abono/pago que el cliente hace a su cuenta. |
| **returns** | Las devoluciones, con motivo y reembolso. |
| **return_items** | El detalle de qué se devolvió. |
| **defectives** | Las piezas defectuosas. |
| **clients** | El directorio de clientes. |
| **repairs** | Las reparaciones y su estado. |
| **warranties** | Las garantías. |
| **suppliers** | Los proveedores. |
| **purchases** | Las compras a proveedores. |
| **users** | Los usuarios del sistema y sus roles. |
| **audit_logs** | El registro de auditoría (quién hizo qué). |
| **caja_sesiones** | Las aperturas y cierres de caja. |
| **caja_gastos** | Las salidas de dinero de la caja. |
| **tenants** | Los negocios (para el modelo de varios negocios — ver sección 11). |

### Cómo se relacionan (ejemplo)

Una **venta** (`sales`) tiene varios **productos vendidos** (`sale_items`). Una
**cuenta a crédito** (`accounts`) tiene varios **abonos** (`account_payments`).
Esto se llama "relación", y es lo que hace que todo esté conectado sin duplicar
información.

### Detalle importante: lógica unificada de ventas

Decisión de diseño que tomamos (y que es el **estándar contable correcto**):
**toda transacción crea un registro en `sales`**, sea de contado o al crédito.
Las de crédito **además** crean su registro en `accounts`. Así, las ventas a
crédito aparecen correctamente en los reportes y en el respaldo, siguiendo el
**principio del devengado** (una venta cuenta desde que se entrega el producto,
no desde que se cobra).

---

## 8. La seguridad

Tu sistema tiene varias capas de protección, como un banco:

| Protección | Qué hace |
|---|---|
| **Contraseñas encriptadas (bcrypt)** | Las contraseñas **nunca** se guardan tal cual. Se convierten en un código ilegible. Ni nosotros podemos verlas. |
| **Login con token (JWT)** | Al entrar, recibes un "pase digital" que dura **8 horas**. Sin ese pase, la API no responde. |
| **Límite de intentos (rate limiting)** | Si alguien falla la contraseña **10 veces**, se bloquea por 15 minutos. Frena a los ladrones que intentan adivinar. |
| **CORS restringido** | Solo **tu página web** (www.mundoceldiaz.com) puede hablar con la API. Cualquier otra es rechazada. |
| **Errores ocultos** | Si algo falla internamente, el sistema **no revela detalles técnicos** que un atacante podría aprovechar. |
| **Recuperación por pregunta secreta** | Si olvidas la contraseña, la recuperas respondiendo tu pregunta de seguridad. |
| **Validación de stock en el servidor** | El servidor verifica que haya stock real antes de aceptar una venta — imposible de manipular desde el navegador. |
| **Límite de descuentos por rol** | Un cajero no puede dar más de 20% de descuento. El admin sí. Validado en el servidor. |
| **Idempotencia en ventas** | Si por un error de red se manda dos veces la misma venta, el sistema la registra **una sola vez**. No hay ventas duplicadas. |
| **Auditoría** | Todo movimiento importante queda registrado con nombre, fecha y hora. |

---

## 9. Flujo de trabajo

Cómo se hace y se publica un cambio en el sistema:

```
   1. Se programa el cambio en una "rama" de prueba (branch)
            │
            ▼
   2. Se crea un "Pull Request" (PR) — una propuesta de cambio
            │
            ▼
   3. Tú revisas y le das "Merge" (aprobar) en GitHub
            │
            ▼
   4. Automáticamente:
        • Vercel publica el nuevo FRONTEND
        • Railway publica la nueva API
            │
            ▼
   5. En 1-2 minutos el cambio ya está en vivo en www.mundoceldiaz.com
```

**Lo importante para ti:** tú solo tienes que darle **"Merge"** al Pull Request en
GitHub. Todo lo demás (publicar el frontend y la API) sucede **automáticamente**.
Por eso te llegan correos de Vercel cada vez que hay un cambio.

---

## 10. Roles de usuario

El sistema tiene **4 tipos de usuario**, cada uno ve y puede hacer cosas distintas:

| Rol | Color | Qué puede hacer |
|---|---|---|
| **Super Admin** | 🟣 Morado | El dueño del sistema completo. Administra **varios negocios** (ver sección 11). |
| **Administrador** | 🟢 Verde | Acceso **total** a su negocio: todos los módulos, usuarios, reportes, auditoría. |
| **Cajero** | 🔵 Azul | Acceso de trabajo diario: ventas, caja, cuentas, devoluciones, clientes, reparaciones. **No** ve reportes financieros sensibles ni administra usuarios. |
| **Auditor** | 🟣 Lila | Solo **lectura**: dashboard, caja, historial, inventario, cuadres. No puede modificar nada. |

Esto se llama **RBAC** (control de acceso basado en roles) y es fundamental en
sistemas profesionales: cada quien ve solo lo que le corresponde.

---

## 11. Modelo SaaS

Aquí hay algo importante y valioso: tu sistema está construido para poder
**venderse a otros negocios**. Esto se llama **multi-tenant** (multi-inquilino).

- Cada negocio es un **"tenant"** (inquilino) con sus propios datos completamente
  separados.
- El **Super Admin** (tú, como dueño del software) puede crear negocios nuevos,
  asignarles un administrador, definir su plan y administrarlos todos desde un
  panel central.
- Los datos de un negocio **jamás** se mezclan con los de otro: cada consulta a la
  base de datos filtra automáticamente por `tenant_id`.

**Por qué esto es valioso:** significa que el mismo sistema que usas para MUNDO
CEL DIAZ se puede **vender como servicio** a otras tiendas de celulares en
Centroamérica, cobrando una suscripción mensual. Esa es la visión comercial del
proyecto.

---

## 12. Glosario

Todas las palabras técnicas, explicadas como a un amigo:

| Palabra | Qué significa |
|---|---|
| **POS** | "Point of Sale" / Punto de Venta. El sistema con el que un negocio vende y se administra. |
| **Frontend** | La parte visible de un programa: pantallas, botones, colores. Lo que el usuario ve y toca. |
| **Backend** | La parte invisible que procesa todo por detrás. (En tu caso, la API). |
| **API** | "Interfaz de Programación de Aplicaciones". El intermediario que recibe órdenes del frontend, las procesa y responde. El cerebro. |
| **Base de datos** | El lugar donde se guarda toda la información de forma permanente y organizada. La memoria. |
| **Servidor** | Una computadora encendida 24/7 en internet que atiende peticiones. |
| **La nube** | Servidores de empresas (Vercel, Railway, etc.) a los que accedes por internet, en vez de tener una computadora propia. |
| **React** | La herramienta para construir las pantallas interactivas del frontend. |
| **JavaScript** | El lenguaje de programación de la web. Con él está hecho casi todo tu sistema. |
| **Node.js** | Lo que permite usar JavaScript también en el servidor (la API). |
| **Express** | El marco que organiza cómo funciona la API. |
| **PostgreSQL** | El tipo de base de datos que usas. Muy robusta y profesional. |
| **Supabase** | El servicio en la nube que aloja tu base de datos PostgreSQL. |
| **Vercel** | El servicio en la nube donde vive tu frontend. |
| **Railway** | El servicio en la nube donde vive tu API. |
| **GitHub** | Donde se guarda el código y todo su historial de cambios. |
| **Git** | El sistema de control de versiones. Guarda cada cambio que se hace al código. |
| **Branch (rama)** | Una copia del código donde se trabajan cambios sin afectar la versión en vivo. |
| **Pull Request (PR)** | Una propuesta de cambio que tú revisas y apruebas antes de publicarla. |
| **Merge** | Aprobar y unir un cambio (Pull Request) a la versión oficial. |
| **Deploy** | Publicar el sistema en vivo para que la gente lo use. |
| **PWA** | "Progressive Web App". Una página web que se puede instalar en el celular como una app normal. |
| **Electron** | Tecnología para convertir una web en un programa de escritorio (.exe para Windows). |
| **JWT (token)** | El "pase digital" que comprueba que iniciaste sesión. |
| **bcrypt** | El método que encripta las contraseñas para que nadie las robe. |
| **CORS** | La regla que define qué páginas pueden hablar con tu API. |
| **Rate limiting** | El límite de intentos para frenar ataques de fuerza bruta. |
| **RBAC** | Control de acceso por roles. Cada usuario ve solo lo suyo. |
| **Multi-tenant / Tenant** | Sistema que puede servir a varios negocios separados. Cada negocio es un "tenant" (inquilino). |
| **SaaS** | "Software as a Service". Vender un software como suscripción mensual. |
| **Idempotencia** | Que una misma acción repetida por error no se duplique (ej: una venta enviada 2 veces se registra 1 sola). |
| **Stock** | La cantidad de un producto disponible para vender. |
| **Endpoint / Ruta** | Una "dirección" de la API que hace una tarea específica (ej: `/api/sales` registra ventas). |
| **Repositorio (repo)** | La carpeta con todo el código de un proyecto, guardada en GitHub. |
| **Responsivo** | Que se adapta a cualquier pantalla: celular, tablet o computadora. |
| **Principio del devengado** | Regla contable: una venta cuenta desde que se entrega el producto, no desde que se cobra. |

---

## 13. Preguntas frecuentes

Posibles preguntas que alguien te podría hacer, y cómo responderlas:

**P: ¿En qué está hecho tu sistema?**
R: El frontend (lo visible) en **React con JavaScript**. La API (el cerebro) en
**Node.js con Express**. La base de datos es **PostgreSQL en Supabase**. Está
alojado en **Vercel** (frontend) y **Railway** (API).

**P: ¿Dónde se guardan los datos? ¿Son seguros?**
R: En una base de datos **PostgreSQL** profesional en **Supabase**, en la nube, con
respaldos automáticos. Las contraseñas están encriptadas con bcrypt y solo mi
página puede acceder a la información.

**P: ¿Funciona en celular?**
R: Sí, es totalmente responsivo y además se puede **instalar como app** en el
celular (es una PWA).

**P: ¿Qué pasa si se va el internet?**
R: El sistema es 100% en línea. Necesita internet porque los datos viven en la
nube y se sincronizan en tiempo real (eso garantiza que nunca se pierdan).

**P: ¿Se le pueden agregar funciones nuevas?**
R: Sí, está en desarrollo activo y modular. Se agregan funciones nuevas
constantemente sin afectar lo que ya funciona.

**P: ¿Se podría vender a otros negocios?**
R: Sí, está construido como **multi-negocio (SaaS)**. Cada tienda tendría sus datos
separados y pagaría una suscripción. Esa es la visión a futuro.

**P: ¿Quién puede usarlo y ver qué?**
R: Hay 4 roles (Super Admin, Administrador, Cajero, Auditor). Cada uno ve solo lo
que le corresponde. Un cajero no puede ver reportes financieros completos ni
administrar usuarios.

**P: ¿Cómo se actualiza?**
R: Automáticamente. Cuando apruebo un cambio en GitHub, se publica solo en
1-2 minutos. Los usuarios siempre tienen la última versión sin instalar nada.

---

## ✅ Resumen en 30 segundos

> *MUNDO CEL DIAZ es un sistema de punto de venta para tiendas de celulares,
> hecho con React (lo visible), Node.js/Express (el cerebro) y PostgreSQL/Supabase
> (los datos). Vive en la nube: el frontend en Vercel, la API en Railway. Tiene
> control de ventas, inventario, créditos, caja, reparaciones, garantías,
> proveedores, usuarios por roles y auditoría. Es seguro (contraseñas encriptadas,
> tokens, límites anti-ataque), funciona en celular como app, y está construido
> para poder venderse a varios negocios como suscripción (SaaS).*

---

*Documento generado para Wilber — MUNDO CEL DIAZ / PraxisGT · Guatemala 2026*
*Versión del sistema: 2.2.0*
