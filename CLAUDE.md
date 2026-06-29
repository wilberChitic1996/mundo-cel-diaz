# CLAUDE.md — PraxisGT (Mundo Cel Diaz)

**INSTRUCCIÓN PARA CLAUDE:** Leer este archivo COMPLETO al inicio de cada sesión antes de hacer cualquier cambio o dar cualquier respuesta técnica. Este archivo es la fuente de verdad del proyecto.

---

## Prompt de inicio de sesión

```
Lee el archivo CLAUDE.md del repo wilberchitic1996/mundo-cel-diaz en GitHub
y dame un resumen de: arquitectura actual, último estado del trabajo,
y pendientes. No hagas nada hasta que yo te confirme qué tarea seguiremos.
```

> **Cómo funciona la memoria (para el usuario):** Claude **no recuerda entre sesiones distintas** — cada sesión NUEVA arranca en blanco y se pone al día leyendo este CLAUDE.md (se carga solo; el prompt de arriba es para que resuma y se alinee). **Dentro de una misma sesión recuerda todo** — no hay que repetir nada. Reconectarse a la MISMA sesión conserva el historial. Por eso CLAUDE.md (estado + pendientes + lecciones) es la memoria del proyecto entre sesiones: **todo lo importante se anota acá (regla #9)**.

---

## 🔴 REGLAS CRÍTICAS DE INTERACCIÓN (OBLIGATORIAS)

### 1. Paso a paso — NUNCA avanzar sin confirmación

Claude DEBE dar **un solo paso a la vez** y esperar "Listo" del usuario antes de pasar al siguiente. Está PROHIBIDO dar varios pasos de una sola vez aunque parezcan simples o relacionados.

### 2. Scripts SQL — siempre inline, nunca asumir ejecución

Todo script SQL (migraciones, seeds, validaciones) debe incluirse **en el chat, copiable directamente**. Claude NUNCA debe asumir que un script fue ejecutado — siempre esperar confirmación explícita del usuario con el resultado.

### 3. Credenciales del piloto — antes de cada paso de prueba

Antes de cualquier instrucción de prueba en el piloto, Claude DEBE incluir:
- **URL:** `mundo-cel-diaz-staging.vercel.app`
- **Email:** `admin@demo.com`
- **Contraseña:** `Admin2026!`

### 4. Cambios de BD — aprobación EXPLÍCITA antes de ejecutar

Ningún cambio de base de datos (CREATE TABLE, ALTER TABLE, INSERT, DELETE) puede ejecutarse sin aprobación explícita del usuario. El script va en el chat primero y el usuario lo ejecuta.

> **Origen:** Usuario confirmó que se saltaron pasos de validación porque Claude asumió que los scripts se habían ejecutado cuando no era así.

### 5. Esperas de CI/deploy — Claude monitorea y reporta, NUNCA deja esperando

Cuando Claude está esperando que termine CI, un deploy de Vercel/Railway, o cualquier proceso externo, **NO debe quedarse pasivo dejando que el usuario espere sin saber**. Claude DEBE:

1. **Sondear activamente** el estado (con `mcp__github__pull_request_read` → `get_check_runs`, no esperar a que llegue un webhook — los webhooks NO entregan "CI success").
2. **En cuanto el estado cambie** (CI verde/rojo, deploy listo), **actuar de inmediato** (mergear si verde, corregir si rojo) y **reportar al usuario en una sola línea clara**: "✅ CI verde, mergeado" o "⛔ CI falló, corrigiendo".
3. **Si la espera se alarga**, dar una señal de vida con el estado actual en vez de quedarse callado.
4. **NUNCA** decir solo "esperando..." y terminar el turno sin un plan de re-verificación. Si no llega webhook, Claude vuelve a sondear por su cuenta.

> **Origen:** Usuario reportó que las esperas lo hacían desconfiar — se podía quedar esperando horas cuando el proceso ya había terminado. Claude debe cerrar el ciclo siempre: verificar → actuar → reportar.

### 6. "Ya podés probar" — SOLO con confirmación real de que el deploy está vivo

Claude **NUNCA** debe decir "ya podés probar" basándose en una estimación de tiempo ("~1-2 min"). Solo lo dice cuando tiene una **señal positiva** de que el código nuevo ya está desplegado:

- **Frontend (Vercel):** confirmar con el estado **"Ready"** del deploy de staging (llega por webhook de Vercel). Recién ahí avisar.
- **API (Railway):** confirmar abriendo el endpoint de salud del API de staging y verificando que responde:
  ```
  curl -s https://mundo-cel-diaz-api-production-e546.up.railway.app/api/health
  ```
  Si Claude no puede alcanzar ese endpoint (bloqueo de red del entorno), **debe decirlo con honestidad** — "no puedo confirmar el deploy del API desde aquí" — en vez de adivinar un tiempo.

**Mecanismo elegido (28 jun 2026): abrir la red del entorno a staging.** Para que Claude confirme los deploys por sí mismo, la **política de red del entorno** (Claude Code on the web) debe permitir salida a:
- `https://mundo-cel-diaz-staging.vercel.app` (frontend staging)
- `https://mundo-cel-diaz-api-production-e546.up.railway.app` (API staging)

El usuario lo configura en los ajustes del entorno (network access). Doc: https://code.claude.com/docs/en/claude-code-on-the-web. Una vez abierto, Claude hace `curl .../api/health` tras cada merge de API y recién entonces dice "ya podés probar".

> **Origen:** Usuario pidió poder probar "con confianza" sabiendo que el deploy ya está, sin esperas a ciegas. Hoy la red del entorno bloquea staging (HTTP 000) y Railway no reporta estado a GitHub, por eso Claude no podía confirmar el API. Solución acordada: abrir la red a staging.

### 7. Tras mergear a `staging` — VERIFICAR el deploy de PRODUCCIÓN, no el preview

El preview de un PR puede quedar **"Ready"** pero **NO** ser lo que sirve `staging.vercel.app`. El sitio lo sirve el **"Production Deployment"** del proyecto Vercel (rama `staging`). Tras cada merge, Claude DEBE confirmar que ese **Production Deployment apunta al commit nuevo** (Vercel → proyecto staging → Overview → "Production Deployment" → commit). Si quedó atrás, **promover** el deploy nuevo: Vercel → Deployments → fila del commit nuevo → "⋯" → **Promote to Production**.

> **Origen (28 jun 2026):** Vercel (Hobby/gratis) topó 100 deploys/día. Los merges de #152/#153 a `staging` **no dispararon deploy a producción** (quedaron en cola/fallaron), pero los **previews sí aparecían "Ready"**, enmascarando el problema. `staging.vercel.app` siguió sirviendo `2cb7d1a` (viejo) por horas → "siempre lo mismo". Se resolvió **promoviendo manualmente** el deploy nuevo a Production. **Lección:** "preview Ready" ≠ "producción actualizada".

### 8. Plan Vercel — decisión 28 jun 2026: seguir GRATIS con disciplina

Usuario eligió **NO** pagar Vercel Pro por ahora. Para no volver a topar el límite de 100 deploys/día:
- **Agrupar cambios:** menos PRs y más grandes (no docenas de PRs chicos por día). Cada PR consume varios deploys × 2 proyectos.
- **Verificar producción tras merge** (regla #7) y promover si quedó atrás.
- Si la fricción se vuelve insoportable, reconsiderar **Vercel Pro ($20/mes)** que elimina el problema de raíz.

### 9. TODO va a la lista de pendientes — nada se olvida ni queda a medias

Cada vez que surja **algo nuevo** (una tarea, idea, bug, mejora, observación del usuario, o algo que quedó a medias), Claude DEBE **integrarlo de inmediato** en la sección **"Backlog / Pendientes"** o **"Próximos pasos"** de este CLAUDE.md, con su estado claro: `pendiente` / `en progreso` / `a medias`. Reglas:

1. **Nunca** dejar algo solo mencionado en el chat — si no está anotado en CLAUDE.md, se va a olvidar. Anotarlo es obligatorio.
2. **Un paso a la vez** (refuerza regla #1): trabajar UNA cosa, terminarla o anotar dónde quedó, y recién entonces pasar a la siguiente. Si el usuario pide varias cosas, Claude las anota TODAS en pendientes y las ataca de a una, confirmando cada una.
3. **Antes de cerrar cualquier turno** donde surgió algo nuevo o algo quedó incompleto, verificar que esté anotado en pendientes con su estado.
4. Cuando una tarea se completa, marcarla como hecha (✅) en la lista — para que siempre se vea el avance real.

> **Origen:** Usuario pidió que nada se quede "en el aire" ni a medias, y que se trabaje de a un paso para no perder el foco. La lista de pendientes en CLAUDE.md es la memoria del proyecto entre sesiones.

---

## 🔴 REGLA ESTRICTA: NO TOCAR LO QUE FUNCIONA

Si una funcionalidad está funcionando correctamente, Claude **NO debe modificarla, reescribirla, ni "mejorarla"** sin instrucción explícita del usuario. Esto incluye pantallas, endpoints, botones, exports, y cualquier otro componente en uso. Antes de reescribir algo que funciona, **preguntar al usuario** si realmente lo quiere cambiar.

> **Origen de esta regla:** Al reescribir `BackupScreen.jsx` para agregar funcionalidad nueva, se eliminaron los botones de export Excel/JSON que ya existían y funcionaban. Esto causó pérdida de funcionalidad sin que el usuario lo autorizara. Este error no debe repetirse.

---

## 🎭 Roles de Claude — AUTODETECCIÓN (el usuario NO elige)

Claude **detecta por sí mismo** qué rol (o combinación de roles) aplicar según la tarea — **el usuario no tiene que elegirlo**. Antes de actuar, Claude evalúa la situación y adopta el/los rol(es) que correspondan, combinándolos cuando la tarea lo requiera (la mayoría de tareas combinan 2-3).

| Rol | Cuándo se activa | Qué hace |
|---|---|---|
| 🏗️ **Arquitecto Full-Stack** | Implementar una feature o fix que toca UI y/o API | Diseña e implementa de punta a punta (React + Express) de forma coherente entre capas; sigue el workflow rama→staging→main |
| 🛢️ **Guardián del Esquema (DBA)** | Antes de escribir/cambiar CUALQUIER query o tocar la BD | Verifica las columnas/tablas reales contra la BD (no asume) — ataca la causa #1 de bugs (desajuste de esquema, ver lección transversal) |
| 🚀 **Release Manager / DevOps** | Mergear, desplegar, sacar a piloto o producción | Maneja el flujo de ramas, verifica el deploy de **producción** (no el preview, regla #7), promueve si quedó atrás, cuida la disciplina Vercel (regla #8) |
| 🔍 **QA / Cazador de bugs** | Validar una brecha o antes de que el usuario pruebe | Audita código + esquema y prueba de antemano para cazar bugs antes que el usuario (como con seriales/cuentas el 28 jun) |
| 📘 **Escritor Técnico** | Surge algo que documentar o un pendiente | Mantiene CLAUDE.md (estado, pendientes, lecciones) y construye el manual técnico; aplica la regla #9 (todo a la lista) |

**Ejemplos de combinación automática:**
- *"Implementá variantes de producto"* → 🛢️ DBA (verificar esquema) + 🏗️ Arquitecto (implementar) + 🔍 QA (auditar) + 🚀 Release (sacar a piloto) + 📘 Escritor (documentar).
- *"El cobro falla"* → 🔍 QA (diagnosticar) + 🛢️ DBA (esquema) + 🏗️ Arquitecto (fix).

> El usuario PUEDE nombrar un rol si quiere enfocar ("como QA, auditá X"), pero por defecto Claude lo detecta y lo aplica solo.

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
| **FRONTEND_URL (Railway)** | `https://mundoceldiaz.com` | `https://mundo-cel-diaz-staging.vercel.app` |

Detección automática de ambiente (`src/utils/api.js` → función `resolveApiUrl()`):
- `localhost:3000` → API local `http://localhost:4000/api`
- hostname contiene `staging` → API staging (e546)
- `mundoceldiaz.com` → API producción
- cualquier otro → API producción (fallback)

### Credenciales piloto

- **URL:** `mundo-cel-diaz-staging.vercel.app`
- **Email:** `admin@demo.com`
- **Contraseña:** `Admin2026!`
- **tenant_id staging:** `aaaaaaaa-0000-0000-0000-000000000001` (nombre: "Mundo Cel Diaz Demo")

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

### Flujo rama de trabajo → staging (piloto)

El flujo aplica **por separado a cada repo** (frontend y API). Si el cambio toca ambos, se sigue el flujo en los dos repos antes de probar en piloto.

**Solo Frontend cambia:**
```
1. Rama claude/... en mundo-cel-diaz, DESDE staging
2. Cambios, commit, push
3. PR rama → staging (en mundo-cel-diaz)
4. CI verde ✅ + Vercel Ready ✅ → mergear
5. Probar en piloto
```

**Solo Backend/API cambia:**
```
1. Rama claude/... en mundo-cel-diaz-api, DESDE staging
2. Cambios, commit, push
3. PR rama → staging (en mundo-cel-diaz-api)
4. CI verde ✅ + Railway despliega ✅ → mergear
5. Probar en piloto
```

**Ambos repos cambian (caso más común en brechas grandes):**
```
1. Ramas en AMBOS repos desde staging
2. Cambios en API primero (el frontend depende del backend)
3. PR rama → staging en mundo-cel-diaz-api → CI verde → mergear
4. Railway despliega la API de staging
5. PR rama → staging en mundo-cel-diaz → CI verde → mergear
6. Vercel despliega el frontend de staging
7. AHORA sí: probar en piloto con ambos deployed
8. Si hay bugs → fix en el repo que corresponda → volver al paso 3 o 5
```

### Flujo staging → main (producción)

Igual que arriba pero en dirección staging → main, y en AMBOS repos si aplica.

> #### 👤 Release a producción — QUIÉN HACE QUÉ (para que el usuario vaya seguro)
> Producción es el paso más delicado y **NUNCA es automático**. Solo se hace **después de validar TODO el piloto**.
>
> **Lo que hace EL USUARIO (Claude lo guía paso a paso):**
> 1. **Validar el piloto** — probar que todo funciona antes de liberar.
> 2. **Correr en la BD de PRODUCCIÓN** (`rhecnmfivygkayfvauxt`) el script SQL que Claude le pase (migraciones) — Claude da el script inline, el usuario lo ejecuta (regla #4).
> 3. **Crear el bucket `repairs`** en el Supabase de producción — Claude lo guía en el panel.
> 4. **Aprobar** los PR `staging → main` cuando Claude avise.
>
> **Lo que hace CLAUDE:** crear los PRs, verificar CI, mergear, confirmar el deploy de producción (regla #7). **NUNCA toca producción sin OK explícito del usuario.**
>
> **Invariante de seguridad:** mientras nada se mergee a `main`, `mundoceldiaz.com` sigue intacto. Imposible que algo llegue a producción por accidente.

**Solo Frontend:**
```
1. Usuario confirmó que piloto funciona
2. PR staging → main en mundo-cel-diaz
3. CI verde ✅ + Vercel Ready ✅ → mergear
4. Vercel despliega mundoceldiaz.com ✅
```

**Solo Backend:**
```
1. Usuario confirmó que piloto funciona
2. PR staging → main en mundo-cel-diaz-api
3. CI verde ✅ + Railway despliega ✅ → mergear
```

**Ambos repos:**
```
1. Usuario confirmó que piloto funciona
2. PR staging → main en mundo-cel-diaz-api → CI verde → mergear
3. PR staging → main en mundo-cel-diaz → CI verde → mergear
4. Verificar mundoceldiaz.com funciona correctamente
```

> ### 🔴 REGLA CRÍTICA: VERIFICAR CI ANTES DE MERGEAR — SIEMPRE.
> Antes de hacer merge de CUALQUIER PR (tanto rama→staging como staging→main),
> Claude DEBE revisar que todos los checks de CI estén en verde usando las herramientas
> de GitHub (`mcp__github__pull_request_read` con `get_check_runs`). Si algún check está en
> `failure` o `in_progress`, NO mergear — esperar o corregir primero.
> Mergear con CI rojo rompe producción y genera deploys fallidos en Vercel/Railway.
> Esta regla no tiene excepciones aunque el usuario pida ir rápido.
>
> **NUNCA decirle al usuario que pruebe en el piloto antes de que el PR esté mergeado a staging.**
> El piloto (mundo-cel-diaz-staging.vercel.app) solo refleja lo que está en la rama `staging`.
> Un PR pendiente o en preview NO afecta el piloto hasta que se mergea.

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

Este sistema maneja MÚLTIPLES negocios en la misma base de datos. Cada negocio se identifica por su `tenant_id`.

**REGLAS ABSOLUTAS:**
- Todo `SELECT`, `INSERT`, `UPDATE`, `DELETE` DEBE incluir filtro `WHERE tenant_id = ?`
- Al crear tablas nuevas, SIEMPRE incluir columna `tenant_id UUID NOT NULL`
- Al agregar índices, SIEMPRE incluir `tenant_id` como primera columna del índice
- Nunca hacer queries sin filtro de tenant — expone datos de otros negocios

### Tenants conocidos

| Ambiente | Nombre | tenant_id |
|---|---|---|
| Producción | MUNDO CEL DIAZ | `00000000-0000-0000-0000-000000000001` |
| Staging | Mundo Cel Diaz Demo | `aaaaaaaa-0000-0000-0000-000000000001` |

- **NUNCA** modificar datos del tenant de producción sin aprobación explícita del usuario
- Todo cambio de DB debe mostrarse al usuario para aprobación antes de ejecutar

### Tablas reales de la BD (22 tablas confirmadas)

Siempre usar estos nombres exactos. NUNCA asumir nombres — verificar antes de escribir scripts.

| Tabla | Columnas principales | Notas |
|---|---|---|
| `tenants` | id, name, plan, email, phone, owner_name, active, expires_at | Base de negocios |
| `users` | id, tenant_id, name, email, password_hash, role, active, sec_question, sec_answer_hash, last_login | Roles: superadmin/admin/cajero/auditor |
| `store_settings` | id, tenant_id, key, value, updated_at | Config por tenant (iva_percent, etc.) |
| `clients` | id, tenant_id, cli_code, name, dpi, phone, address, active | Clientes |
| `products` | id, tenant_id, code (NOT NULL), name, category, brand, unit, stock, min_stock, price, cost, shelf, active | `code` es NOT NULL |
| `categories` | id, tenant_id, name | Categorías de productos |
| `locations` | id, tenant_id, name | Ubicaciones/estanterías |
| `suppliers` | id, tenant_id, name, phone, email, address, notes, active | Proveedores |
| `sales` | id, tenant_id, client, total, method, status, pay_type, user_id, registrado_por (JSONB), idempotency_key | Con idempotencia |
| `sale_items` | id, tenant_id, sale_id, product_id, code, name, price, qty, subtotal | |
| `accounts` | id, tenant_id, sale_id, client, total, paid, balance, status, method, user_id, idempotency_key | Cuentas por cobrar — tiene FK a sales |
| `account_items` | id, tenant_id, account_id, code, name, price, qty | |
| `account_payments` | id, tenant_id, account_id, amount, method, note, registrado_por (JSONB) | Abonos |
| `purchases` | id, tenant_id, supplier_id, supplier_name, total, notes, registered_by | Compras a proveedores |
| `purchase_items` | id, tenant_id, purchase_id, product_id, product_name, product_code, qty, cost, subtotal | |
| `returns` | id, tenant_id, sale_id, client, reason, refund_method, refund_amount, item_condition, total | |
| `return_items` | id, tenant_id, return_id, code, name, price, qty | |
| `defectives` | id, tenant_id, return_id, code, name, qty, price, reason, status | |
| `repairs` | id, tenant_id, rep_code, client_name, client_phone, brand, model, issue, diagnosis, status, price, advance, technician, notes | NO tiene tabla `repair_items` |
| `warranties` | id, tenant_id, entity_type, entity_id, client, description, start_date, end_date, status | |
| `caja_sesiones` | id, tenant_id, fondo_inicial, nota_apertura, opened_by, opened_role, closed_at, closed_by, total_ventas, total_gastos, total_abonos, total_efectivo, diferencia, nota_cierre | Ojo: `sesiones` no `sessions` |
| `caja_gastos` | id, tenant_id, sesion_id, concepto, monto, categoria, registrado_por, registrado_role | |
| `stock_movements` | id, tenant_id, product_id, ... | Movimientos de inventario |
| `refresh_tokens` | id, tenant_id, user_id, token_hash, expires_at, created_at, revoked_at | |
| `push_subscriptions` | id, tenant_id, user_id, endpoint, p256dh, auth_key, created_at, updated_at | |
| `audit_logs` | id, tenant_id, user_id, user_name, user_role, action, entity_type, entity_id, details (JSONB) | |
| `backups` | id, tenant_id, created_at, size_bytes, status, type, storage_path, error_msg, tables_included, record_counts (JSONB) | |

> **LECCIÓN CRÍTICA (jun 2026):** Antes de escribir cualquier script SQL, consultar siempre `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name` para verificar nombres reales. Tablas que NO existen: `repair_items`, `caja_movements`, `caja_sessions`, `supplier_purchase_items`, `product_price_history`.

> 🛢️ **FUENTE DE VERDAD DEL ESQUEMA:** `docs/DB-SCHEMA-REAL.md` — volcado real de `information_schema` (staging, 28 jun 2026) con las 29 tablas, sus columnas reales y los **desajustes confirmados** (`sales.date`, `accounts.due_date`, `repairs.client/device` inexistentes; columnas duplicadas en `repairs`). El rol DBA lo consulta ANTES de tocar cualquier query. Regenerar con la consulta documentada en ese archivo cuando cambie el esquema.

**FK importante:** `accounts.sale_id` referencia `sales.id`. Al borrar registros, siempre borrar en este orden: `account_items` → `account_payments` → `accounts` → `sale_items` → `sales`.

**RLS:** Habilitado en todas las tablas. El API usa `service_role` key que bypassa RLS.

**RPC especial:** `decrement_stock(p_product_id, p_qty, p_tenant_id)` — actualización atómica de stock con `SELECT FOR UPDATE`.

### Aplicar cambios de BD en ambos ambientes

1. Aplicar primero en **Supabase staging** (`mundo-cel-diaz-staging`, `aawjhttlaydwsipsifre`)
2. Validar en piloto que funciona
3. Aplicar en **Supabase producción** (`mundo-cel-diaz`, `rhecnmfivygkayfvauxt`)

---

## Estructura del frontend

**Stack:** React 18.3.1 + Vite 5.4.1 + PWA  
**Versión:** 2.2.0  
**Node requerido:** >=18  
**Puerto dev:** 3000 (`npm run dev`)

### Scripts disponibles
```
npm run dev            — Servidor de desarrollo (puerto 3000)
npm run build          — Build de producción
npm run preview        — Preview del build
npm run lint           — ESLint
npm run lint:fix       — ESLint con autofix
npm run format         — Prettier
npm run electron:dev   — Electron en modo desarrollo
npm run package        — Build Electron (.exe para Windows)
```

### Árbol de archivos

```
src/
  main.jsx             — Entry point, monta <App />, inicia Sentry
  App.jsx              — Componente raíz, sidebar, routing entre pantallas, auto-refresh JWT

  screens/             — 25 módulos independientes
    AccountsScreen.jsx      (505 líneas) — Cuentas por cobrar, aging 30/60/90d
    AuditScreen.jsx         (262 líneas) — Auditoría de acciones
    AyudaScreen.jsx         (221 líneas) — Ayuda y soporte
    BackupScreen.jsx        (333 líneas) — Backups: historial, health card, descarga, manual
    CajaScreen.jsx          (559 líneas) — Caja chica y sesiones
    CatalogosScreen.jsx     (294 líneas) — Categorías y ubicaciones
    ClientsScreen.jsx       (409 líneas) — Clientes
    CuadresScreen.jsx       (541 líneas) — Cuadres y reportes
    DashboardScreen.jsx     (473 líneas) — Dashboard + RemindersWidget
    DefectiveScreen.jsx     (154 líneas) — Productos defectuosos
    HistoryScreen.jsx       (439 líneas) — Historial de movimientos con artículos
    InventoryScreen.jsx     (273 líneas) — Inventario
    LandingPage.jsx         (756 líneas) — Página pública con animaciones
    LoginScreen.jsx         (386 líneas) — Autenticación + PushPermissionBanner
    OnboardingWizard.jsx    (239 líneas) — Setup inicial de tienda nueva
    POSScreen.jsx           (440 líneas) — Punto de venta con boletas
    ProductsScreen.jsx      (695 líneas) — Gestión de productos + import Excel
    RepairsScreen.jsx       (702 líneas) — Taller de reparaciones
    ReturnsScreen.jsx       (518 líneas) — Devoluciones
    StoreConfigScreen.jsx   (213 líneas) — Configuración de tienda (IVA, etc.)
    SuperAdminPanel.jsx     (597 líneas) — Panel super admin (tenants, stats)
    SuppliersScreen.jsx     (488 líneas) — Proveedores y compras
    UsersScreen.jsx         (291 líneas) — Gestión de usuarios
    VerifyReceipt.jsx        (84 líneas) — Página pública verificación QR (sin login)
    WarrantiesScreen.jsx    (332 líneas) — Garantías

  hooks/
    useIsMobile.js          — Detección de dispositivo móvil
    usePaginator.jsx        — Hook de paginación (DEBE ser .jsx no .js — contiene JSX)
    usePushNotifications.js — Web Push: estados idle/requesting/granted/denied/unsupported

  components/
    MetricBox.jsx           — Componente de métricas del Dashboard
    ProductForm.jsx         — Formulario reutilizable de productos
    Sidebar.jsx             — Barra lateral de navegación
    ui/
      HelpTip.jsx           — Tooltips de ayuda contextual
      PagTable.jsx          — Tabla con paginación integrada
      PushPermissionBanner.jsx — Banner inferior de solicitud de permiso push
      RemindersWidget.jsx   — Widget de recordatorios en Dashboard

  utils/
    api.js        (229 líneas) — Instancia axios + 21 módulos de API (ver sección Endpoints)
    export.js               — exportExcel() con XLSX estático, exportPDF() con jsPDF dinámico
    formatters.js           — Q() (moneda GTQ), fmtD() (fecha), fmtT() (hora), gid() (UUID)
    receipt.js    (27KB)    — getStore(), setStore(), buildReceiptHTML(), printVoucher(), compartirWhatsApp()
    sentry.js               — Sentry init para frontend
    session.js              — Auto-refresh JWT 7 min antes de expirar, refresh token 30d
    whatsapp.js             — pedirTelYEnviar(), waBoletaVenta(), waRecordatorio()
    db.js                   — DEPRECATED (no usar)
    excel.js                — DEPRECATED — usar export.js

  styles/
    global.css              — Estilos globales + CSS custom properties para dark mode
    theme.js                — Sistema de diseño:
                              TEAL=#1D9E75 (brand), NAVY=#1a2535 (sidebar)
                              sCard, sInput, sLabel, sTH, sTD, sQtyBtn, H1
                              mkBtn(color) → genera botones (teal/red/blue/purple/gray/green/amber)
                              mkBadge(color) → genera badges

  constants/
    index.js                — APP_NAME, PERMS, ROLE_LABEL, ROLE_COLOR, PLATFORM_FEATURES, SESS_KEY

  data/
    demo.js                 — Datos de demostración
```

### XLSX / SheetJS — regla de importación

```js
// ✅ CORRECTO — import estático en cada archivo que lo use
import * as XLSX from 'xlsx';

// ❌ INCORRECTO — no usar dynamic import ni window.XLSX
var XLSX = await import('xlsx');   // MAL
window.XLSX                        // MAL (no hay global en Vite)
```

Cada archivo tiene su propio scope en Vite. Si un archivo usa XLSX, DEBE importarlo él mismo. Archivos que ya tienen el import: `BackupScreen.jsx`, `ProductsScreen.jsx`, `export.js`.

---

## Roles RBAC

4 roles con permisos diferenciados:

| Rol | Color | Acceso a módulos |
|---|---|---|
| `superadmin` | `#9B59B6` | Todo + panel de admin de tenants |
| `admin` | `#1D9E75` | dashboard, pos, caja, accounts, returns, defective, products, catalogos, inventory, history, backup, users, clients, repairs, cuadres, audit, warranties, storeconfig, suppliers, ayuda |
| `cajero` | `#378ADD` | dashboard, pos, caja, accounts, returns, history, clients, repairs, warranties, ayuda |
| `auditor` | `#7F77DD` | dashboard, caja, history, inventory, cuadres, ayuda |

---

## Endpoints del API — 21 módulos

Definidos en `src/utils/api.js`. Disponibles en `/api/*` y `/api/v1/*` (retrocompatibles).

| Módulo | Métodos disponibles |
|---|---|
| `authAPI` | login, logout, refresh, verify2fa, findUser, resetPassword |
| `publicAPI` | verify (QR sin autenticación) |
| `productsAPI` | getAll, create, update, remove, priceHistory, adjustStock, stockHistory |
| `salesAPI` | getAll, create |
| `accountsAPI` | getAll, create, addPayment |
| `returnsAPI` | getAll, create |
| `defectivesAPI` | getAll, update (status) |
| `usersAPI` | getAll, create, update |
| `clientsAPI` | getAll, create, update, remove |
| `repairsAPI` | getAll, create, updateStatus, update, remove |
| `warrantiesAPI` | getAll, create, update |
| `auditAPI` | getAll |
| `suppliersAPI` | getAll, create, update, getPurchases, createPurchase |
| `categoriesAPI` | getAll, create, update, remove |
| `locationsAPI` | getAll, create, update, remove, moveProduct |
| `settingsAPI` | getAll, update |
| `cajaAPI` | getSesiones, getSesionActiva, abrir, cerrar, getGastos, crearGasto, eliminarGasto |
| `adminAPI` | getTenants, createTenant, updateTenant, getStats, getSubscription, init, resetUserPassword |
| `remindersAPI` | summary, accounts |
| `backupAPI` | list, create, download, data, health |
| `pushAPI` | vapidKey, subscribe, unsubscribe |
| `checkAPI` | función async para verificar health del API |

---

## Estructura del backend

**Stack:** Express 5.2.1 + Node.js >=18  
**Versión:** 2.2.0  
**Puerto:** 4000

### Scripts disponibles
```
npm start              — Producción (node index.js)
npm test               — Vitest (run once)
npm run test:watch     — Vitest watch mode
npm run lint           — ESLint
npm run migrate:up     — Aplicar migraciones pendientes
npm run migrate:down   — Revertir última migración
npm run migrate:create — Crear nueva migración
```

### Árbol de archivos

```
mundo-cel-diaz-api/
  app.js              — Express + CORS (*.vercel.app + FRONTEND_URL) + Helmet + Rate Limiting
  index.js            — Entry point, startCronJobs(), Sentry init
  supabase.js         — Cliente Supabase (service_role key, bypassa RLS)
  swagger.js          — OpenAPI docs en /api-docs

  routes/             — 21 archivos, uno por módulo
    auth.js           — Login, logout, refresh, 2FA (deshabilitado), recuperación password
    products.js       — CRUD productos, historial precio, ajuste stock
    sales.js          — Crear/listar ventas, idempotencia
    accounts.js       — Cuentas por cobrar, abonos
    returns.js        — Devoluciones de ventas
    defectives.js     — Productos defectuosos
    users.js          — Gestión usuarios, RBAC
    clients.js        — CRUD clientes
    repairs.js        — Órdenes de reparación
    audit.js          — Logs de auditoría
    warranties.js     — Garantías
    caja.js           — Sesiones de caja y gastos
    settings.js       — Configuración por tenant (con cache Redis 5min)
    suppliers.js      — Proveedores y compras
    categories.js     — Categorías de productos
    locations.js      — Ubicaciones/estanterías
    admin.js          — Super admin: tenants, stats, subscriptions, storage
    public.js         — Verificación QR sin autenticación
    reminders.js      — Resumen de recordatorios por tenant
    push.js           — Web Push VAPID: vapid-public-key, subscribe, unsubscribe, send
    backup.js         — Snapshots, listado, descarga con URL firmada, health

  middleware/
    auth.js           — Validación JWT, inyecta req.user
    rateLimit.js      — Límite de peticiones por IP

  utils/
    tenant.js         — withTenant(), tid() — filtrado multi-tenant automático
    audit.js          — logAudit() — registro de acciones en audit_logs
    logger.js         — Pino logger estructurado
    cache.js          — Redis (REDIS_URL env) o Map en memoria (fallback) — settings cacheados 5min
    reminders.js      — Cron jobs: checkOverdueAccounts, checkExpiringWarranties, checkRepairsDelivery + push
    backup.js         — createTenantBackup() — snapshots JSON a Supabase Storage bucket `backups`
    sentry.js         — Sentry error tracking init

  services/
    clientService.js  — Lógica de negocio para clientes
    productService.js — Lógica de negocio para productos
    saleService.js    — Lógica de negocio para ventas

  migrations/         — SQL versionadas
    000_full_schema.sql          — Schema inicial completo (22 tablas, RLS, RPC)
    001_add_tenant_id_to_child_tables.sql — tenant_id en tablas hijo + índices
    002_data_migration.sql       — Datos iniciales tenant producción
    002_sat_guatemala_fields.sql — Campos SAT Guatemala
    003_catalogos.sql            — Tablas categories, locations
    003_data_migration.sql       — Datos de catálogos iniciales
    004_stock_movements.sql      — Tabla stock_movements
    005_iva_configurable.sql     — store_settings con iva_percent=12
    006_refresh_tokens.sql       — Tabla refresh_tokens
    007_push_subscriptions.sql   — Tabla push_subscriptions
    008_backups.sql              — Tabla backups
    (nuevas desde 009 con node-pg-migrate: up/down blocks)

  tests/              — Vitest + Supertest (61/61 passing)
    setup.js, auth.test.js, auth-refresh.test.js, refresh.test.js,
    push.test.js, reminders.test.js, accounts.test.js, settings.test.js,
    products.test.js, tenant.test.js

  Dockerfile          — node:20-alpine, USER node, EXPOSE 4000
  docker-compose.yml  — api (puerto 4000) + redis:7-alpine (puerto 6379)
  database.json       — node-pg-migrate config (usa DATABASE_URL)
  .node-pg-migraterc  — ignora migrations 001-007 (ya aplicadas), nuevas desde 008
  docs/
    STORAGE_GUIDE.md  — Guía de monitoreo de almacenamiento
```

---

## Decisiones técnicas importantes

### Hashing de contraseñas
- **Actual:** Bcrypt (10 rounds) — `$2a$` o `$2b$`
- **Legacy:** SHA-256 + salt `mnpos_salt_2026` — auto-migra a bcrypt en login exitoso

### Sesión de usuario
- JWT con duración 8 horas → guardado en `sessionStorage` (clave `mnpos-session-v1`)
- Refresh token en `localStorage` (`mnpos-refresh-token`), válido 30 días, rotación automática
- Auto-refresh silencioso 7 minutos antes de expirar el JWT (`App.jsx` + `utils/session.js`)

### CORS del API
- Orígenes en variable de entorno `FRONTEND_URL` (Railway)
- Cualquier `*.vercel.app` (staging y PR previews)
- Requests sin origen (Postman, server-to-server)

### Atomicidad en stock
- Función RPC PostgreSQL `decrement_stock()` con `SELECT FOR UPDATE`
- Previene race conditions en ventas simultáneas

### Idempotency keys
- Cada venta lleva `idempotency_key` único
- Evita duplicados por doble click o reintento de red

### PWA y Service Worker
- Manifest: nombre `PraxisGT — Sistema de Gestión`
- Service Worker con estrategia NetworkOnly para `/api/`
- Instalable en móvil y desktop
- Push notifications con VAPID

### Vercel — Headers de seguridad (vercel.json)
- **CSP:** `default-src 'self'` con excepciones Railway/Supabase/Sentry
- **X-Frame-Options:** `DENY`
- **X-Content-Type-Options:** `nosniff`
- **Referrer-Policy:** `strict-origin-when-cross-origin`
- **Permissions-Policy:** niega cámara, micrófono, geolocalización, payments
- **HSTS:** `max-age=63072000; includeSubDomains; preload`

---

## Dependencias clave

### Frontend
| Paquete | Versión | Uso |
|---|---|---|
| react / react-dom | 18.3.1 | UI |
| vite | 5.4.1 | Build tool |
| axios | 1.17.0 | HTTP client |
| xlsx | 0.18.5 | Exportación Excel (SheetJS) |
| jspdf | 4.2.1 | Generación PDF |
| jspdf-autotable | 5.0.8 | Tablas en PDF |
| html2canvas | 1.4.1 | Captura de pantalla para WhatsApp |
| recharts | 3.8.1 | Gráficos en Dashboard |
| @sentry/react | 10.62.0 | Error tracking |
| electron | 28.3.3 | Build Windows .exe |
| vite-plugin-pwa | 1.3.0 | PWA support |

### Backend
| Paquete | Versión | Uso |
|---|---|---|
| express | 5.2.1 | Framework HTTP |
| @supabase/supabase-js | 2.107.0 | Cliente DB |
| jsonwebtoken | 9.0.3 | JWT |
| bcryptjs | 3.0.3 | Hash contraseñas |
| ioredis | 5.11.1 | Redis cache |
| web-push | 3.6.7 | Web Push VAPID |
| node-cron | 4.5.0 | Cron jobs |
| pino | 10.3.1 | Logging estructurado |
| resend | 6.14.0 | Email API (2FA) |
| helmet | 8.2.0 | Headers de seguridad |
| express-rate-limit | 8.5.2 | Rate limiting |
| swagger-jsdoc | 6.3.0 | OpenAPI docs |
| node-pg-migrate | 7.9.1 | Migraciones DB |
| vitest | 4.1.9 | Testing |

---

## Historial de PRs importantes

| PR | Repo | Descripción |
|---|---|---|
| #104 | Frontend | Refactorización: App.jsx 8,104 → 1,921 líneas, extracción de 24 pantallas |
| #105 | Frontend | Fix build: usePaginator.js→.jsx, AccountsScreen import, fmt.js→formatters.js |
| #106 | Frontend | Fix api.js: restaurar detección staging vs producción + crear CLAUDE.md |
| #107 | Frontend | Merge de refactor + CLAUDE.md a `staging` |
| #108 | Frontend | Fix api.js en `main`: enrutar dominios staging al API de piloto (no a producción) |
| #109 | Frontend | CLAUDE.md: arquitectura de ambientes + lección CORS de piloto |
| #110 | Frontend | Merge staging → main (primer release con refactor completo) |
| #111 | Frontend | Fix boletas: datos reales del negocio + QR verificación funcional |
| #112 | Frontend | Historial: columna Artículos en cada movimiento |
| #113 | Frontend | Boletas en POS, reparaciones y compras + imagen + nota no tributaria |
| #114 | Frontend | Fix crash al cobrar venta (mkBtn → mB en modal post-venta) |
| #115 | Frontend | Release: boletas reales + crash fix + historial artículos → producción |
| #116 | Frontend | Landing page: rediseño completo con animaciones profesionales |
| #117 | Frontend | Release landing rediseñada → producción |
| #118 | Frontend | UI overhaul: design system profesional (cards, tablas, MetricBox, Sidebar) |
| #119 | Frontend | Release UI overhaul → producción |
| API #48 | Backend | Fix CORS: permitir *.vercel.app en el API (rama `main`) |
| API #49 | Backend | Fix CORS: llevar la misma lógica `*.vercel.app` a la rama `staging` (piloto) |
| API #50 | Backend | Endpoint público /api/public/verify/:id para QR de boletas |
| #120–#122 | Frontend | Enterprise checklist: ESLint, Sentry, Swagger UI, refresh tokens, IVA configurable, Redis cache, API v1 |
| API #51–#52 | Backend | Enterprise checklist: Pino logger, Swagger, refresh tokens, Redis cache, services layer, CI/CD, uptime |
| #123–#128 | Frontend | Recordatorios automáticos: RemindersWidget, aging clickeable en Cuentas |
| #129–#131 | Frontend | Sistema navTo: hipervínculos entre módulos (Dashboard→Cuentas, Reparaciones, Garantías, Productos, Clientes) |
| #132–#134 | Frontend | Fix hipervínculos en registros históricos (fallback por nombre en Historial, Reparaciones, Garantías) |
| #135–#136 | Frontend | CSP estricta en Vercel + notificaciones push PWA (banner + suscripción) |
| #137 | Frontend | CLAUDE.md actualizado — migraciones versionadas completado |
| API #53–#56 | Backend | Recordatorios automáticos (cron jobs), rutas reminders |
| API #57–#60 | Backend | Web Push notifications VAPID + tabla push_subscriptions + Docker |
| API #61 | Backend | node-pg-migrate para migraciones versionadas (008+) |
| API #62–#63 | Backend | Tests cobertura push/reminders/auth-refresh (61/61 passing) |
| #139–#140 | Frontend | BackupScreen enterprise — historial, health card, descarga, backup manual |
| API #64–#66 | Backend | Backup enterprise (snapshots diarios 2 AM por tenant → Supabase Storage) + monitoreo almacenamiento + retención audit_logs 180d |
| #145–#153 | Frontend | Ronda fixes reparaciones: fotos async, validación flash, cobro lleva monto (servicio sin producto), mapeo finalCost, anti-doble-cobro (marca entregado), repairId en venta |
| API #69–#72 | Backend | `product_id` null en servicios (FK), `repairId` marca reparación entregada, fix seriales `sales(date)`, fix cuentas aging por antigüedad (`due_date` inexistente) |

---

## Estado actual del trabajo

- **Versión en producción:** 2.5.0
- **Último cambio (29 jun 2026) — A11 + fix Historial + docs de consola:**
  - **A11 (CSP estricta) ✅ CUMPLIDO** — validado en piloto (QR renderiza + Imprimir/PDF/Descargar/WhatsApp OK bajo CSP estricta). Fix de efecto colateral: QR local (`src/utils/qr.js`, sin CDN) + impresión desde el opener (PRs #165/#166). **10/13 bloqueantes cerrados.**
  - **Fix Historial:** doble conteo en "Entradas (ventas+abonos)" — ya NO suma la venta a crédito completa además de sus abonos; cuenta solo efectivo real (contado + abonos). Renombrado "Cancelacion" → "Abono final". (`HistoryScreen.jsx`, rama `claude/mundo-cel-diaz-review-8bgfrg`.)
  - **Docs nuevos para migrar a consola Windows:** `docs/CONSOLA-WINDOWS.md` (instalación + workflow Claude Code en terminal Windows, para no-programador), `docs/PROMPTS.md` (recetario de prompts copiables: arranque, bug, feature, release, BD, FEL, cobro, cierre), `scripts/setup-windows.ps1` (script PowerShell que instala/clona/actualiza todo de un comando, sin pedir secretos) y `docs/MANUAL-TECNICO.md` (enciclopedia del software, 10 secciones). El usuario probablemente se traslade a trabajar Claude Code desde consola en Windows.
  - **Decisión A14 (paginación frontend):** el backend de paginación es **100% retrocompatible** (`utils/paging.js`: sin `?page/limit` devuelve todo como hoy) → el frontend actual funciona sin cambios. A14 es optimización de escala, NO bloqueo para vender a una tienda. **Diferido a una ronda con validación de piloto** (no se puede probar desde el entorno remoto): adoptar `?page/limit` en las listas pesadas (Historial, Cuentas, Auditoría, Productos) reemplazando el `usePaginator` cliente por paginación servidor. No ramear el refactor a ciegas (regla "no tocar lo que funciona").
- **Último cambio previo (29 jun 2026) — CIERRE v1.0 (Definition of Done):** 8/13 bloqueantes cerrados + A1/A15 a un paso (correr SQL). Ver `DEFINITION_OF_DONE.md` (fuente de verdad del cierre).
  - **Backend (API PR #74 — MERGEADO a `staging`, validado en vivo en piloto):** B3 (whitelist roles, no escalada a superadmin), A8 (`requireRole` server-side en escrituras), B2 (`enforceSubscription` 403 a tenant inactivo/vencido), B4 (revocación de sesión en `auth.js` — usuario inactivo/eliminado pierde acceso), B5 (idempotencia en `POST /accounts`), A13 (cifrado de DPI con `utils/crypto.js` + DPI fuera de `audit_logs`), A1/A15 (migración `016` del `decrement_stock` robusto + drop del overload legacy). Suite 110/110. Orden de middleware nuevo: `auth → requireRole → enforceSubscription`. Timeout de lookups configurable (`DB_LOOKUP_TIMEOUT_MS`).
  - **Frontend (PR #164 — CI verde, SIN mergear: Vercel topado ~24h):** A2/A3 (fix `res.data` sobre respuesta ya desempaquetada → auto-refresh JWT y RemindersWidget vuelven a operar), M23 (Términos + Privacidad públicos en `?legal=terms|privacy`).
  - **Pendiente de acción del usuario:** (1) correr SQL de A1/A15 en BD staging (drop overload); (2) `ENCRYPTION_KEY` en Railway para activar cifrado DPI (+ `scripts/reencrypt-dpi.js`); (3) mergear/validar frontend cuando Vercel se libere; (4) elegir proveedor para A16 (cobro) y B1 (FEL).
  - **Faltan (4):** A11/A12 (CSP estricta + refresh token en cookie HttpOnly — requieren validación en piloto), A14 (paginación server-side — refactor amplio en App.jsx), A16 (pasarela de cobro — externo), B1 (FEL — certificador externo).
- **Último cambio previo (29 jun 2026):** Limpieza de ubicaciones de productos + paridad de esquema piloto/producción + endurecimiento de entrada. Detalle:
  - **Ubicaciones (producción):** normalizados 104 `shelf` sucios `n-n` → `Mueble N · X` (reconstruido desde `location_id`+`position` ya correctos); 3 sin mueble acoplados. 260/260 limpios. Respaldo `products_backup_20260628`.
  - **Función faltante:** `generate_product_code()` no existía en staging (rompía crear productos en piloto) → creada (copia exacta de prod).
  - **Paridad de esquema (segura, aplicada en AMBOS):** columnas faltantes (caja_sesiones totales en prod; tenants/defectives.updated_at, caja_sesiones.closed_role/efectivo_contado en staging), índices, y `decrement_stock` robusta (FOR UPDATE + validación) igualada en staging. PENDIENTE (no tocar a la ligera): tipos de `id` text(prod) vs uuid(staging) y columnas duplicadas en `repairs`.
  - **Piloto (demo):** catálogo recortado a 50 productos completos (5 por categoría, todos los campos llenos, stock 10). Respaldo `products_backup_staging_pretrim` (279 originales).
  - **Frontend:** validación de `position` (no permite posición sin estante, ni `·`, ni basura) + campo `Código` ahora solo-lectura/automático en el formulario.
- **Último cambio (28 jun 2026):** 7 brechas funcionales + ronda de fixes de cobro de reparaciones y auditoría de esquema. Migraciones 009-015 aplicadas en staging.
- **Rama de trabajo activa:** `claude/gifted-heisenberg-r6n8jo` (en AMBOS repos)
- **Producción frontend:** ✅ mundoceldiaz.com (NO tocar hasta validar piloto completo)
- **Producción API:** ✅ mundo-cel-diaz-api-production.up.railway.app (NO tocar)
- **Staging frontend:** ✅ mundo-cel-diaz-staging.vercel.app — al día (deploy `9897579` promovido manualmente a Production tras bloqueo Vercel; ver regla #7).
- **Staging API:** ✅ mundo-cel-diaz-api-production-e546.up.railway.app — al día (Railway despliega sin límite)
- **Staging BD:** Migraciones 009-015 aplicadas ✅. Bucket `repairs` creado ✅.
- **2FA:** Implementado para superadmin, deshabilitado temporalmente (pendiente propagación DNS Resend). Descomentar en `routes/auth.js` líneas 82-99 cuando esté listo.
- **Credenciales piloto:** `admin@demo.com` / `Admin2026!` (hash bcrypt en la BD de staging).
- **Bucket Supabase Storage `backups`:** ✅ Creado en staging y producción.

> ### ⛔ BLOQUEO VERCEL (28 jun 2026) — RESUELTO, pero leer la lección (regla #7 y #8)
> Vercel (Hobby/gratis) topó **100 deploys/día**. Los merges #152/#153 a `staging` **no desplegaron a producción**
> (los previews sí quedaban "Ready", enmascarando el problema), y `staging.vercel.app` sirvió código viejo (`2cb7d1a`)
> por horas → "siempre lo mismo". **Resuelto** promoviendo manualmente el deploy `9897579` a Production
> (Vercel → Deployments → ⋯ → Promote to Production). Decisión: seguir gratis con disciplina (reglas #7 y #8).
> **Backend (Railway) NO tiene este límite.**

### Validación en piloto — Estado (28 jun 2026)

| Prueba | Brecha | Estado |
|---|---|---|
| IVA en boleta | #3 IVA configurable | ✅ PASADA |
| Pago dividido POS | #4 Split payment | ✅ PASADA |
| Reparaciones checklist+fotos (visible) | #2 Reparaciones | ✅ PASADA |
| Guardar orden de reparación | #2 Reparaciones | ✅ PASADA (REP-000002 creada) |
| Cobro de reparación (lleva monto, servicio sin producto) | #2/#5 | ✅ PASADA (boletas generadas) |
| Anti-doble-cobro (marca entregado) | #2 | ✅ PASADA (deploy `9897579` vivo; REP-000003 cobrada) |
| Fotos en reparaciones (guardar) | #2 Reparaciones | ⏳ PENDIENTE de probar (frontend ya vivo) |
| Variantes de producto 🎨 | #7 Variantes | ⏳ Código auditado OK; falta probar |
| Seriales en POS | #1 Seriales | ⏳ Bug API arreglado (#71); falta probar (frontend ya vivo) |
| Costo final en reparaciones | #5 Costo | ✅ PASADA |
| Cuentas x cobrar aging | #6 Cuentas | ⏳ Bug API arreglado (#72); falta probar (frontend ya vivo) |

### Bugs encontrados y corregidos hoy (28 jun 2026)

| # | Síntoma | Causa raíz | Fix |
|---|---|---|---|
| 1 | Orden de reparación "no guardaba / no aparecía" | `submitRepair` no esperaba la API (sin `await`) | PR #147 frontend |
| 2 | Cobro de reparación: "Error al guardar ítems de venta" | `sale_items.product_id` con FK; línea de servicio mandaba UUID falso | PR #69 API (`product_id` null si `unit==='serv'`) |
| 3 | Cobro no llevaba monto / obligaba a elegir producto | `cobrarReparacion` ignoraba `finalCost` y no cargaba servicio | PR #149 frontend |
| 4 | "Costo final" no se guardaba ni mostraba | Los 3 mapeos de repairs no incluían `finalCost`; no recargaba | PR #149 frontend |
| 5 | Reparación se podía cobrar infinitas veces | No se marcaba entregada al cobrar | PR #70 API (`repairId` en venta) + #152/#153 frontend |
| 6 | Seriales: listado/búsqueda fallaban | embed `sales(id, date,...)` — `sales` no tiene `date` | PR #71 API (alias `date:created_at`) |
| 7 | Cuentas aging nunca funcionó (500) | `accounts.due_date` no existe; repairs `client`/`device`/`en_proceso` inexistentes | PR #72 API (aging por `created_at`, columnas reales) |

> **LECCIÓN TRANSVERSAL (la causa #1 de bugs en este proyecto): DESAJUSTE DE ESQUEMA.**
> El código frecuentemente usa nombres de columna que NO existen en la BD real de staging
> (`problem_desc` vs `issue`, `tech_name` vs `technician`, `estimated_cost` vs `price`, `due_date` inexistente,
> `repairs.client`/`device` inexistentes, `sales.date` inexistente). **Antes de tocar cualquier query nueva,
> verificar columnas reales** con `SELECT column_name FROM information_schema.columns WHERE table_name='X'`.
> La BD de staging diverge del esquema versionado (columnas agregadas a mano en producción y no replicadas).

> **LECCIÓN (28 jun 2026) — UBICACIÓN DE PRODUCTOS: columnas invertidas entre ambientes.**
> `products` guarda ubicación en 3 columnas: `location_id` (FK a `locations` = el mueble), `position` (texto = la fila) y `shelf` (texto legacy combinado "Mueble N · X", **lo que muestran las pantallas** Productos/Inventario).
> ⚠️ La columna-verdad **DIFIERE por ambiente**: **producción usa `shelf`** (convención "Mueble N"); **staging usa `position`** (alfanumérico B5-1/V-34, y `shelf` casi vacío). NUNCA correr el mismo script de datos en ambos sin ajustar la columna.
> **Limpieza hecha en PRODUCCIÓN (28 jun):** 104 productos tenían `shelf` sucio "n-n" (ej "2-5") aunque `location_id`+`position` YA eran correctos. Se normalizó `shelf` → "Mueble N · X" reconstruyéndolo desde location_id+position (UPDATE reversible, respaldo `products_backup_20260628`, solo tenant prod `00000000-...-0001`, solo columna `shelf`; stock/precio/código intactos). Los 3 sin mueble se acoplaron (Pantallas→Mueble 1, P095→Mueble 2). Resultado: 260/260 con ubicación limpia.
> **Endurecimiento (PR frontend):** `ProductForm` ahora valida `position` (no permite posición sin estante elegido, ni el carácter `·`, ni >12 chars, ni símbolos raros) para que no vuelva a ensuciarse. Multi-tenant-safe: acepta tanto numérico ("5") como alfanumérico ("B5-1").

### Próximos pasos (en orden)

1. **Terminar validación piloto** (frontend ya vivo): seriales → cuentas aging → variantes → fotos en reparación. Anti-doble-cobro ✅.
2. **IVA en boleta de reparación** (pendiente nuevo 28 jun): la boleta del cobro de reparación NO muestra el desglose "Subtotal sin IVA / IVA 12% / Total" que sí tiene la venta normal del POS. En GT los servicios también llevan IVA → hacer que la boleta de reparación muestre el desglose igual. Tocar `utils/receipt.js` (`buildReceiptHTML`) — verificar por qué la línea de servicio no dispara el bloque de IVA. **Agrupar con otros cambios de frontend (regla #8).**
3. **Construir `docs/MANUAL-TECNICO.md`** — enciclopedia completa del software (ver "Manual técnico" en Backlog). Explorar ambos repos a fondo.
4. **Aplicar migraciones 009-015 en Supabase PRODUCCIÓN** (`rhecnmfivygkayfvauxt`) — solo tras validar TODO el piloto.
5. **Crear bucket `repairs` en Supabase PRODUCCIÓN**.
6. **PR staging → main** en frontend y API (solo después de validar TODO el piloto).
7. **(Opcional) Abrir red del entorno a staging** para que Claude confirme deploys por sí mismo (regla #6).

> **Disciplina Vercel (reglas #7 y #8):** agrupar cambios en menos PRs; tras cada merge a staging, verificar que el Production Deployment tenga el commit nuevo y promover si quedó atrás.

---

## Backlog / Pendientes

### 🚆 Vagones listos para anclar — CHECKLISTS DE ACTIVACIÓN (29 jun 2026)

El backend ya quedó **preparado y dormido** para FEL y cobro recurrente (no afectan nada hasta activarse). Lo que sigue es lo que vos (usuario) tenés que conseguir/configurar — "traer el tren". Cuando tengas cada cosa, me avisás y yo conecto el adapter concreto.

#### 📄 Checklist FEL (facturación electrónica SAT) — para activar B1
- [ ] **1. Contratar un certificador homologado por SAT** (INFILE, G4S, Digifact, etc.).
- [ ] **2. Pedirle al certificador:** usuario/clave o API key, URL del endpoint, y el **certificado** (`.p12`/`.pem`) con su contraseña.
- [ ] **3. Tener el NIT y datos fiscales reales del negocio** (nombre fiscal, dirección, régimen SAT).
- [ ] **4. Correr `migrations/017_fel_fields.sql`** (Claude te pasa el SQL inline) — primero en BD staging, luego prod.
- [ ] **5. Llenar en `tenants`** el emisor: `nit, fiscal_name, address, sat_regime, currency` (Claude te pasa el UPDATE).
- [ ] **6. Decirme el certificador elegido** → yo escribo el adapter concreto en `services/felProvider.js` con su API (HOY hay un stub no-op).
- [ ] **7. Configurar env en Railway:** `FEL_ENABLED=true`, `FEL_PROVIDER=...`, `FEL_USERNAME/FEL_PASSWORD/FEL_CERT_PATH/FEL_CERT_PASSWORD`.
- [ ] **8. Probar en staging con certificado de PRUEBA** antes de producción (existe `POST /api/sales/:id/emit-fel` para reintentar).
- [ ] **9. (Opcional) mostrar el N° de autorización/serie FEL en la boleta** (frontend).

#### 💳 Checklist Cobro recurrente (suscripción SaaS) — para activar A16
- [ ] **1. Elegir pasarela:** Recurrente (Guatemala) o Stripe.
- [ ] **2. Crear cuenta y obtener** las API keys + un `WEBHOOK_SECRET`.
- [ ] **3. Crear los planes/precios** en la pasarela (mensual, etc.).
- [ ] **4. (Opcional) Crear tabla `payment_webhooks`** para auditoría de pagos (Claude te pasa el SQL).
- [ ] **5. Configurar env en Railway:** `PAYMENTS_ENABLED=true`, `WEBHOOK_SECRET=...`, `PAYMENT_PROVIDER=recurrente|stripe`.
- [ ] **6. Registrar el webhook** en la pasarela apuntando a `https://<api>/api/webhooks/payment`, eventos de pago, y mandando el `tenant_id` en `metadata`.
- [ ] **7. Decirme la pasarela** → ajusto el parseo del payload (cada una manda campos distintos) y, si querés, el **signup self-serve** (alta de cliente con prueba de 14 días).
- [ ] **8. Probar con el simulador de webhook** de la pasarela en staging (verificar que `expires_at` del tenant se extiende).

> El cobro ya se ata a la barrera de suscripción que hice (B2 `enforceSubscription`): apenas un pago renueva `expires_at`, el tenant puede operar; si vence, se bloquea solo.

### 🔴 Alta prioridad — Funcional

- [ ] **2FA reactivar:** Cuando Resend termine de verificar dominio, descomentar código en `auth.js` líneas 82-99
- [x] **Refresh token:** ✅ Implementado
- [x] **IVA configurable:** ✅ Implementado
- [x] **Cuentas aging:** ✅ Implementado

### 🟡 Media prioridad — Calidad y seguridad

- [x] **ESLint + Prettier:** ✅ Implementado
- [x] **Logs estructurados:** ✅ Pino en API
- [x] **Monitoreo de errores:** ✅ Sentry frontend + API
- [x] **Uptime monitoring:** ✅ GitHub Actions `uptime.yml`
- [x] **CSP estricta:** ✅ vercel.json + Helmet
- [x] **Swagger/OpenAPI:** ✅ `/api-docs`
- [x] **Cobertura de tests:** ✅ 61/61 passing

### 🟢 Media prioridad — Funcional

- [ ] **WhatsApp automático:** Integrar UltraMsg o Twilio (requiere API de pago)
- [x] **Recordatorios automáticos:** ✅ Cron jobs diarios + push real
- [x] **Notificaciones push:** ✅ PWA Web Push VAPID
- [ ] **Cobros automáticos SaaS:** Stripe/Wompi para suscripciones de tenants

### 🔵 Baja prioridad — Arquitectura y escala

- [x] **Separar capas backend:** ✅ Parcial — services/
- [x] **Versionado de API:** ✅ `/api/v1/` retrocompatible
- [x] **Redis caché:** ✅ Con fallback a Map en memoria
- [ ] **Colas de procesamiento:** BullMQ para tareas pesadas
- [x] **Backup enterprise:** ✅ Snapshots JSON diarios a Supabase Storage
- [ ] **Supabase Storage (media):** Fotos de productos, imágenes de reparaciones, logos
- [x] **Docker + Docker Compose:** ✅ node:20-alpine + redis:7-alpine
- [x] **GitHub Actions CI:** ✅ ci.yml, test.yml, uptime.yml
- [x] **Migraciones versionadas:** ✅ node-pg-migrate desde 008
- [ ] **Cifrado de datos sensibles:** DPI y datos personales cifrados en reposo

### ⬜ Roadmap futuro

- [ ] **Facturación electrónica SAT Guatemala (FEL):** Requiere proveedor (INFILE, G4S)
- [ ] **Multi-moneda:** USD además de Quetzal
- [ ] **Multi-idioma:** i18n para inglés
- [ ] **Multisucursal:** `branch_id` para negocios con varias sedes
- [ ] **Comisiones por técnico:** Módulo de comisiones en reparaciones
- [ ] **Portal del cliente:** App/web donde el cliente ve sus compras y garantías
- [ ] **Métricas por tenant:** Dashboard Super Admin con KPIs por cliente
- [ ] **Feature Flags:** Control de funcionalidades por tenant/plan
- [ ] **Blue/Green Deploy:** Deploy sin downtime
- [ ] **OpenTelemetry:** Trazabilidad frontend → API → BD
- [ ] **Disaster Recovery:** Plan documentado de recuperación ante fallos
- [ ] **Importación masiva de clientes:** Excel con saldo inicial para migración desde papel
- [ ] **Importación masiva de reparaciones/garantías:** Para clientes que migran desde otro sistema
- [x] **📘 Manual técnico completo (`docs/MANUAL-TECNICO.md`):** ✅ **HECHO (29 jun 2026)** — enciclopedia del software con las 10 secciones acordadas, construida explorando ambos repos a fondo (rutas reales, 25 pantallas, endpoints por archivo, divergencias de esquema, flujos end-to-end, funciones ocultas, runbook). Mantener sincronizado cuando cambien rutas/pantallas/esquema.
- [ ] **IVA en boleta de reparación:** mostrar desglose IVA igual que la venta normal del POS (ver Próximos pasos #2).

> **Pendientes de UX detectados en piloto + BARRIDO EXHAUSTIVO (29 jun 2026) — PREEXISTENTES (no son regresiones; el frontend viejo aún está vivo). Evaluados en TODO el software. Resolver en una ronda de frontend (agrupar por disciplina Vercel, regla #8):**
>
> **(1) Falta desglose de IVA en comprobantes** — solo `buildReceiptHTML` (venta/cuenta/abono por WhatsApp) lo muestra; el resto NO:
- [ ] `utils/receipt.js` → `printVoucher()` (boleta formal/PDF que usa Historial): sin desglose IVA → afecta **ventas impresas, reparaciones cobradas, cuentas y devoluciones**.
- [ ] `screens/SuppliersScreen.jsx` → `printCompra()`: comprobante de compra sin línea de IVA.
- [ ] `screens/ReturnsScreen.jsx`: boleta de devolución (vía printVoucher) sin IVA.
- [ ] **Inconsistencia:** el abono por WhatsApp (buildReceiptHTML) SÍ trae IVA pero el impreso (printVoucher) NO → unificar.
>
> **(2) Flujos que NO ofrecen opciones de comprobante** (Imprimir/PDF · Descargar · WhatsApp) tras la operación, como sí hace el POS:
- [ ] `screens/AccountsScreen.jsx` → `registrarPago()` (abono/cuota): el recibo solo queda en Historial.
- [ ] `screens/RepairsScreen.jsx` → cobro de reparación.
- [ ] `screens/SuppliersScreen.jsx` → `savePurchase()` (compra).
- [ ] `screens/ReturnsScreen.jsx` → procesar devolución.
>
> **(3) Listas que no refrescan el estado en vivo tras mutar** (hay que recargar):
- [ ] `screens/AccountsScreen.jsx`: saldo no se actualiza tras abono parcial (sí tras pago total).
- [ ] `screens/InventoryScreen.jsx` / `CajaScreen.jsx` / `ProductsScreen.jsx` / `RepairsScreen.jsx`: re-fetch tras compra/gasto/edición/cambio de estado.
>
> **(4) Deuda de arquitectura de comprobantes (raíz de (1) y (2)):** existen **3 builders de boleta** casi duplicados (`utils/receipt.js:buildReceiptHTML`, `utils/receipt.js:printVoucher`, y una tercera copia en `App.jsx`). El bug de IVA está replicado en las 3. **Unificar en un solo builder paramétrico** resuelve IVA + consistencia de una vez. (También: el QR depende de un CDN sin fallback — endurecer.)
- [ ] **Limpiar columnas duplicadas en `repairs`:** el ALTER del 28 jun dejó duplicados (`issue`+`problem_desc`, `price`+`estimated_cost`, `technician`+`tech_name`, `notes`+`internal_note`). Unificar a las canónicas y migrar datos/código. Ver `docs/DB-SCHEMA-REAL.md`. Baja prioridad (no rompe nada hoy).
- [ ] **Unificar tipos de `id` entre ambientes (migración mayor):** producción usa `text` y staging usa `uuid` en `clients.id`, `repairs.id`, y los `*_id` relacionados (`accounts.client_id`, `sales.client_id`, `repairs.client_id`, `repair_items.repair_id`). El API tolera ambos hoy (por eso funcionan). Igualar requiere decidir un modelo canónico + migración con respaldo y reconstrucción de FKs. NO migrar a ciegas (un ALTER TYPE fallaría con datos no-uuid en prod). Baja prioridad.
- [ ] **Limpiar tablas de respaldo temporales** cuando ya no se necesiten: `products_backup_20260628` (prod), `products_backup_staging_20260628` y `products_backup_staging_pretrim` (staging).
- [ ] **Mantener `docs/DB-SCHEMA-REAL.md` sincronizado** con producción cuando se apliquen migraciones allá (hoy refleja staging).
- [ ] **Idempotencia en abonos (`account_payments`):** `POST /accounts/:id/payments` puede duplicar un abono por doble-click. Requiere agregar columna `idempotency_key` a `account_payments` (migración + aprobación) y luego chequearla en la ruta, igual que `accounts`/`sales`. Surgió al cerrar B5 (29 jun). Prioridad media (dinero, pero ruta menos expuesta que crear cuenta).

---

## Lo que YA ESTÁ implementado (NO duplicar)

| Categoría | Ya implementado |
|---|---|
| **Auth** | JWT 8h, bcrypt 10 rounds, auto-migración SHA-256→bcrypt, RBAC 4 roles, 2FA código (deshabilitado), Refresh token 30d con rotación |
| **Seguridad** | Helmet, rate limiting por IP, CORS estricto (*.vercel.app), idempotency keys, SELECT FOR UPDATE en stock, CSP estricta |
| **Multi-tenant** | tenant_id en todas las tablas, withTenant() en API, RLS en Supabase |
| **BD** | 22 tablas, audit_logs completo, índices en tenant_id+created_at, migraciones versionadas |
| **Tests** | Vitest + Supertest — 61/61 passing (push, reminders, auth/refresh, accounts, settings, products, tenant) |
| **Backup** | Snapshots JSON diarios → Supabase Storage bucket `backups`; retención 30d; alerta push si límite cercano; limpieza audit_logs >180d |
| **Storage monitoring** | `/admin/storage-stats` superadmin, docs/STORAGE_GUIDE.md, cron alerta push lunes si >100k audit_logs |
| **Monitoring** | GET /health en API, Sentry frontend+backend, Pino logs, GitHub Actions uptime |
| **Push PWA** | Web Push VAPID, banner suscripción en login, push_subscriptions por tenant, cron jobs con push real |
| **Docker** | Dockerfile node:20-alpine (USER node) + docker-compose con redis |
| **Migraciones** | node-pg-migrate configurado — 001-007 manuales aplicados, nuevas desde 008 con up/down |
| **Cache** | Redis (REDIS_URL) o Map en memoria — settings cacheados 5 min |
| **API versionada** | Prefijo `/api/v1/` retrocompatible con `/api/` |
| **Servicios** | services/ con clientService, productService, saleService |
| **WhatsApp** | wa.me con mensaje pre-formateado, imagen PNG (html2canvas), números GT auto-format |
| **PDF/Excel** | jsPDF + SheetJS (XLSX import estático), exportación desde Historial, Cuadres y Backup |
| **PWA** | Service worker (NetworkOnly para /api/), manifest, instalable en móvil |
| **Electron** | Build .exe para Windows con NSIS |
| **Dark mode** | CSS custom properties completas, toggle por usuario |
| **Responsive** | 100% mobile/tablet/desktop |
| **QR boletas** | QR en comprobantes → VerifyReceipt.jsx página pública sin login |
| **Auditoría** | Log completo de acciones en audit_logs (quién, qué, cuándo, IP) |
| **Navto** | Sistema de hipervínculos entre módulos (Dashboard→Cuentas, Reparaciones, etc.) |
| **RemindersWidget** | Widget en Dashboard con aging 30/60/90 días clickeable |

---

## Variables de entorno críticas — NO TOCAR sin aprobación

```
# Backend Railway (producción)
SUPABASE_URL       = URL de Supabase producción (rhecnmfivygkayfvauxt)
SUPABASE_KEY       = service_role key (NO la anon key)
FRONTEND_URL       = https://mundoceldiaz.com
JWT_SECRET         = secret largo y aleatorio
RESEND_API_KEY     = API key de Resend
REDIS_URL          = URL de Redis (opcional, Map en memoria si no está)
VAPID_PUBLIC_KEY   = Clave pública VAPID para Web Push
VAPID_PRIVATE_KEY  = Clave privada VAPID para Web Push
ENCRYPTION_KEY     = (opcional) Clave para cifrar DPI en reposo (A13, AES-256-GCM). Sin ella el DPI se guarda como hoy (texto plano). Al activarla, correr scripts/reencrypt-dpi.js. NUNCA cambiarla tras cifrar datos (perderías el descifrado).
DB_LOOKUP_TIMEOUT_MS = (opcional) Tope ms para consultas de revocación de sesión/suscripción (default 1500). Tests usan 50.
# FEL (facturación electrónica) — DORMIDO si no están. Ver checklist FEL.
FEL_ENABLED        = (opcional) 'true' activa la certificación FEL en cada venta. Default: apagado (no certifica).
FEL_PROVIDER       = (opcional) Certificador a usar (ej. 'infile','g4s'). Requiere su adapter concreto en services/felProvider.js.
FEL_USERNAME / FEL_PASSWORD / FEL_CERT_PATH / FEL_CERT_PASSWORD = credenciales del certificador.
# Cobro recurrente SaaS — DORMIDO si no están. Ver checklist Cobro.
PAYMENTS_ENABLED   = (opcional) 'true' activa el webhook de pagos. Default: apagado (responde 503).
WEBHOOK_SECRET     = secreto para verificar la firma HMAC del webhook de la pasarela.
PAYMENT_PROVIDER   = (opcional) 'recurrente' | 'stripe' (etiqueta del proveedor activo).

# Backend Railway (staging)
SUPABASE_URL       = URL de Supabase STAGING (aawjhttlaydwsipsifre)
SUPABASE_KEY       = service_role key de Supabase STAGING
FRONTEND_URL       = https://mundo-cel-diaz-staging.vercel.app
```

**NUNCA** apuntar staging al API o BD de producción.
**NUNCA** cambiar estas variables sin aprobación del usuario.
