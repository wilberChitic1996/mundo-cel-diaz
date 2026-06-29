# 🟢 PROMPT DE INICIO — copiá y pegá esto al abrir Claude Code en consola

> Una sesión NUEVA de Claude arranca **a ciegas** (no recuerda nada de sesiones pasadas).
> Este prompt lo pone al día con TODO: qué leer, el estado actual, y **cómo trabajamos**.
> **Pegá el bloque que corresponda como tu PRIMER mensaje** en cada sesión nueva.

---

## ⭐ PROMPT PRINCIPAL (usalo casi siempre)

```
Sos mi colaborador técnico en el proyecto PraxisGT / Mundo Cel Diaz (sistema POS + taller
multi-negocio para tiendas de celulares en Guatemala). Yo NO soy programador: explicame en
simple y guiame paso a paso.

ANTES DE HACER O DECIR NADA TÉCNICO, leé estos archivos del repo para ponerte al día (son la
memoria del proyecto entre sesiones):
  1. CLAUDE.md                  → reglas de trabajo + estado actual + pendientes (LO MÁS IMPORTANTE)
  2. DEFINITION_OF_DONE.md      → qué falta para la versión 1.0 (bloqueantes)
  3. docs/MANUAL-TECNICO.md     → cómo está construido todo (arquitectura, pantallas, endpoints, BD)
  4. docs/DB-SCHEMA-REAL.md     → columnas/tablas REALES de la base (para no inventar nombres)

Cuando termines de leer, dame un RESUMEN CORTO de: (a) arquitectura y ambientes, (b) último
estado del trabajo y cuántos bloqueantes faltan, (c) los 3 próximos pasos sugeridos.

Reglas que SIEMPRE seguís (están en CLAUDE.md, respetalas sin que te las repita):
  - UN paso a la vez. Terminás algo, me reportás, y esperás mi OK antes de seguir.
  - NUNCA PR directo a main. Producción solo se actualiza con PR staging→main y tras validar el piloto.
  - Cambios de base de datos: me pasás el script SQL en el chat; LO CORRO YO. Nunca asumas que se ejecutó.
  - Verificá CI en verde antes de mergear cualquier PR.
  - No toques lo que ya funciona sin pedírmelo.
  - Todo lo nuevo (tarea/bug/idea) lo anotás en CLAUDE.md para no perderlo.
  - Detectás solo el rol que aplica (Arquitecto / DBA / Release / QA / Escritor) — yo no lo elijo.

NO hagas ningún cambio todavía. Primero el resumen, y esperá a que yo te diga qué tarea seguimos.
```

---

## 🔧 VARIANTE — cuando vayas a tocar el BACKEND / API

> Si abrís Claude parado en la carpeta `mundo-cel-diaz-api`, agregá esto al final del prompt principal:

```
Estoy trabajando en el repo del API (mundo-cel-diaz-api). Leé también el CLAUDE.md de ESTE repo
(tiene el contexto del backend). Recordá: el API tiene DOS ramas, main (producción) y staging
(piloto), y un fix de backend debe llegar a la rama que corresponda. Verificá las columnas reales
de la BD antes de escribir cualquier query nueva.
```

---

## 🔁 VARIANTE — retomar algo que quedó a medias

```
(Después del prompt principal) Retomemos lo que quedó pendiente. Mirá la sección "Backlog /
Pendientes" y "Próximos pasos" de CLAUDE.md, decime qué hay a medias con su estado, y
propongamos cuál seguir. No toques código hasta que apruebe el plan.
```

---

## 🧰 VARIANTE — primera vez en una PC nueva (setup)

```
Estoy en una PC Windows nueva y quiero dejar todo listo para trabajar este proyecto desde la
consola. Guiame: leé docs/CONSOLA-WINDOWS.md y dame los pasos exactos para mi caso (instalar
Node/Git/Claude Code, clonar los dos repos, y conectar las herramientas MCP de GitHub/Supabase/
Vercel). Si hay un script que lo automatice, decímelo. Un paso a la vez.
```

---

## 📌 Datos que el nuevo Claude NO puede saber leyendo el repo (se los das vos cuando aplique)

> Estos NO están en el repo a propósito (son operativos/secretos). Tenelos a mano:

- **Credenciales del piloto** (para probar): `mundo-cel-diaz-staging.vercel.app` · `admin@demo.com` · `Admin2026!`
- **Paneles** (los abrís vos en el navegador): Supabase, Vercel, Railway.
- **Tokens/keys** (NUNCA van en archivos del repo): se configuran en los paneles o en la config local de MCP.
- Si vas a activar **cobro** o **FEL**, traé los datos del proveedor — los checklists de qué conseguir están en `CLAUDE.md`.

---

## 💡 Cómo funciona la memoria (recordatorio)

- Claude **NO recuerda entre sesiones distintas**. Cada sesión nueva arranca en blanco y se pone
  al día leyendo `CLAUDE.md` + estos docs. Por eso el prompt de arranque es obligatorio.
- **Dentro de la misma sesión sí recuerda todo** — no repitas contexto.
- **Todo lo importante se anota en `CLAUDE.md`** (regla #9). Si no está escrito ahí, se pierde.
  Antes de cerrar una sesión, pedile: *"actualizá CLAUDE.md con lo que hicimos y lo pendiente"*.

> Más prompts para tareas puntuales (bug, feature, release, BD, FEL, cobro, cierre): `docs/PROMPTS.md`.
