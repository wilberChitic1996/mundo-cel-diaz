# 💻 Guía — Claude Code desde consola en Windows (PraxisGT / Mundo Cel Diaz)

> Esta guía es para vos (el dueño del negocio, no programador). Te lleva paso a paso a
> instalar y usar **Claude Code en la terminal de Windows**, con el mismo contexto y reglas
> que ya teníamos en la web. **Hecha para copiar y pegar.** Si algo falla, copiale el error
> a Claude y pedile que te guíe.
>
> Memoria del proyecto: **`CLAUDE.md`** (reglas + estado) y **`DEFINITION_OF_DONE.md`** (cierre v1.0).
> Claude los lee solo al arrancar — vos no tenés que explicarle nada cada vez.

---

## 0. Antes de empezar — qué necesitás tener a mano

- **Cuenta de Claude** (la misma que usás en la web) — para iniciar sesión.
- **Cuenta de GitHub** con acceso a los repos `wilberchitic1996/mundo-cel-diaz` y `...-api`.
- Datos que YA tenés y NO van en ningún archivo del repo (son secretos):
  - Credenciales piloto: `admin@demo.com` / `Admin2026!`
  - Accesos a Supabase, Vercel, Railway (paneles web).
- **No necesitás saber programar.** Claude hace el trabajo; vos aprobás y probás.

> ⚠️ **Nunca** pegues contraseñas, API keys o tokens dentro de archivos del repo ni en commits.
> Esos van en los paneles (Railway/Vercel/Supabase) o en la config local de tu PC.

---

## 1. Instalar lo básico en Windows (una sola vez)

### 1.1 Node.js (motor que necesita Claude Code y el proyecto)
1. Entrá a **https://nodejs.org** y descargá la versión **LTS** (botón izquierdo).
2. Instalala con "Siguiente → Siguiente" (dejá todo por defecto).
3. Abrí **PowerShell** (botón Inicio → escribí `powershell` → Enter) y verificá:
   ```powershell
   node --version
   npm --version
   ```
   Deben mostrar números (ej. `v20.x.x`). Si no, reiniciá la PC y reintentá.

### 1.2 Git (para bajar y subir el código)
1. Descargá de **https://git-scm.com/download/win** (se baja solo).
2. Instalá con todo por defecto.
3. Verificá en PowerShell:
   ```powershell
   git --version
   ```

### 1.3 Claude Code
En PowerShell:
```powershell
npm install -g @anthropic-ai/claude-code
```
Verificá:
```powershell
claude --version
```

---

## 2. Iniciar sesión en Claude (una sola vez)

```powershell
claude
```
- La primera vez te pide loguearte: se abre el navegador, entrás con tu cuenta Claude, autorizás, y volvés a la terminal.
- Para salir de Claude en cualquier momento: escribí `/exit` o apretá `Ctrl + C` dos veces.

---

## 3. Bajar los dos repos a tu PC (una sola vez)

Elegí una carpeta, por ejemplo `Documentos\proyectos`. En PowerShell:
```powershell
cd $HOME\Documents
mkdir proyectos
cd proyectos

git clone https://github.com/wilberchitic1996/mundo-cel-diaz.git
git clone https://github.com/wilberchitic1996/mundo-cel-diaz-api.git
```
La primera vez te va a pedir loguearte a GitHub (se abre el navegador). Aceptá.

> Resultado: te quedan dos carpetas, `mundo-cel-diaz` (frontend) y `mundo-cel-diaz-api` (backend).

---

## 4. Cómo trabajar día a día (el ciclo)

**Siempre** trabajás parado en una de las dos carpetas. Para el frontend:
```powershell
cd $HOME\Documents\proyectos\mundo-cel-diaz
```
Para el backend:
```powershell
cd $HOME\Documents\proyectos\mundo-cel-diaz-api
```

### 4.1 Antes de pedirle algo nuevo a Claude — actualizá el código
```powershell
git checkout staging
git pull origin staging
```
(esto baja lo último que hay en el piloto)

### 4.2 Abrí Claude
```powershell
claude
```

### 4.3 Pegá el **prompt de arranque** (ver `docs/PROMPTS.md`)
Claude lee `CLAUDE.md`, se pone al día solo, y te da un resumen. Recién ahí le decís qué hacer.

### 4.4 Probar en el piloto
- **URL:** `mundo-cel-diaz-staging.vercel.app`
- **Email:** `admin@demo.com`
- **Contraseña:** `Admin2026!`

---

## 5. Conectar las herramientas externas (MCP) — opcional pero recomendado

En la web, Claude ya tenía conectados GitHub, Supabase y Vercel. En tu consola podés conectarlos
para que Claude haga PRs, consulte la base de datos y verifique deploys por sí mismo.

> No es obligatorio para empezar. Si te complica, saltátelo: Claude igual puede editar código,
> hacer commits y push. Lo que NO podrá sin MCP es crear PRs o leer la BD por su cuenta —
> eso lo harías vos desde los paneles web, y Claude te guía.

### 5.1 GitHub (para que Claude haga PRs y lea CI)
```powershell
claude mcp add github -s user -- npx -y @modelcontextprotocol/server-github
```
Te pedirá un **token de GitHub**. Cómo sacarlo:
1. GitHub → tu foto (arriba derecha) → **Settings** → **Developer settings** →
   **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**.
2. Permisos: marcá `repo` y `workflow`. Generá y **copiá el token** (empieza con `ghp_...`).
3. Pegalo cuando Claude/MCP lo pida. **Ese token es secreto — no lo compartas ni lo pongas en archivos.**

### 5.2 Supabase (para que Claude consulte la base de datos)
```powershell
claude mcp add supabase -s user -- npx -y @supabase/mcp-server-supabase
```
Te pedirá un **access token de Supabase** (Supabase → Account → Access Tokens → Generate).

### 5.3 Vercel (para verificar deploys)
```powershell
claude mcp add vercel -s user -- npx -y @vercel/mcp-server
```
Seguí las instrucciones de login que aparezcan.

### 5.4 Verificar qué quedó conectado
```powershell
claude mcp list
```

> 🔒 **Aislamiento piloto/producción:** las reglas de `CLAUDE.md` aplican igual en consola.
> Claude NO debe tocar producción (`main` / BD `rhecnmfivygkayfvauxt`) sin tu OK explícito.

---

## 6. Reglas de oro (las mismas de siempre — Claude las respeta solas)

1. **Nunca PR directo a `main`.** Producción solo se actualiza con PR `staging → main` y tras validar el piloto.
2. **Cambios de base de datos:** Claude te pasa el script SQL en el chat; **vos lo corrés** en Supabase. Nunca asume que ya se ejecutó.
3. **CI verde antes de mergear.** Siempre.
4. **No tocar lo que funciona** sin pedírtelo.
5. **Un paso a la vez** — Claude termina algo, te reporta, y espera tu OK.
6. Todo lo nuevo (tarea/bug/idea) se anota en `CLAUDE.md` para no perderlo.

---

## 7. Si algo sale mal

- **Copiá el error completo** y pegáselo a Claude: "me salió esto, ¿qué hago?".
- Para volver a un estado limpio sin perder nada subido:
  ```powershell
  git checkout staging
  git pull origin staging
  ```
- Si te perdés con ramas, pedile a Claude: "explicame en qué rama estoy y qué cambios tengo sin subir".

---

## 8. Glosario mínimo

| Palabra | Qué es |
|---|---|
| **repo** | La carpeta del proyecto (hay dos: frontend y backend/API). |
| **rama (`branch`)** | Una "copia de trabajo". `staging` = piloto, `main` = producción. |
| **commit** | Guardar un cambio con una nota de qué hiciste. |
| **push** | Subir tus commits a GitHub. |
| **PR (Pull Request)** | Pedir mezclar una rama en otra (ej. trabajo → `staging`). |
| **CI** | Pruebas automáticas que corren al subir código. Deben quedar en verde. |
| **deploy** | Publicar el código (Vercel = frontend, Railway = backend). |
| **piloto / staging** | El ambiente de pruebas (`mundo-cel-diaz-staging.vercel.app`). |
| **producción** | El sistema real (`mundoceldiaz.com`). No se toca sin validar el piloto. |

---

> 📌 Esta guía vive en el repo (`docs/CONSOLA-WINDOWS.md`) para que esté siempre a mano.
> Los prompts para copiar/pegar están en **`docs/PROMPTS.md`**.
