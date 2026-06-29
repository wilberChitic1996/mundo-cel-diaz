# 🎯 Recetario de Prompts — PraxisGT / Mundo Cel Diaz

> Prompts listos para **copiar y pegar** en Claude Code (web o consola Windows).
> Sirven para que cada sesión arranque alineada y para pedir las tareas más comunes
> sin tener que explicar el contexto cada vez (Claude lee `CLAUDE.md` solo).
>
> Convención: lo que va **entre [corchetes]** lo reemplazás vos por tu caso.

---

## 1. 🚀 Arranque de sesión (SIEMPRE el primero)

```
Lee el archivo CLAUDE.md y DEFINITION_OF_DONE.md del proyecto y dame un resumen corto de:
arquitectura actual, último estado del trabajo, y pendientes. No hagas nada hasta que
yo te confirme qué tarea seguimos.
```

> Si estás en consola y tenés los dos repos clonados, corré este prompt parado en el repo
> que vas a tocar. Si vas a tocar ambos, decíselo: "vamos a tocar frontend y API".

---

## 2. 📋 Ver en qué quedamos / qué falta para v1.0

```
Segun DEFINITION_OF_DONE.md, dame el conteo de bloqueantes (cumplidos / en progreso /
preparados / faltan) y cual es el siguiente paso recomendado. Respuesta corta.
```

---

## 3. 🐛 Reportar un bug que vi en el piloto

```
En el piloto encontre esto: [describí qué hiciste y qué pasó mal, ej: "cobré una
reparación y la boleta no muestra el IVA"]. 
Tomá el rol adecuado, diagnosticá la causa raíz (revisá código + esquema real, no asumas),
explicámela en simple, y proponé un plan antes de tocar nada. No toques código hasta que apruebe.
```

---

## 4. ✨ Pedir una funcionalidad nueva

```
Quiero agregar: [describí la funcionalidad]. 
Antes de codear: (1) verificá el esquema real de la BD si toca datos, (2) decime qué
archivos se tocan y si afecta frontend, API o ambos, (3) proponé el plan paso a paso.
No avances sin mi OK. Un paso a la vez.
```

---

## 5. 🔄 Continuar una tarea pendiente

```
Retomemos lo que quedó pendiente. Mirá la seccion "Backlog / Pendientes" y "Proximos pasos"
de CLAUDE.md y decime qué hay a medias. Propongamos cuál seguir. No toques código aún.
```

---

## 6. 🚢 Sacar cambios al piloto (rama → staging)

```
Los cambios que hicimos ya están listos. Seguí el workflow de CLAUDE.md para llevarlos a
staging: creá la rama si falta, commit, push, PR rama → staging, verificá CI verde, y recién
ahí mergeá. Avisame cuando el deploy de staging esté vivo para que pruebe en el piloto.
```

---

## 7. 🎯 Liberar a producción (staging → main) — SOLO tras validar el piloto

```
Ya validé el piloto y funciona. Llevemos a producción siguiendo el workflow de CLAUDE.md:
PR staging → main (primero API si aplica, luego frontend), CI verde antes de mergear, y
verificá el deploy de producción (regla #7). Si hay migraciones de BD, pasame el SQL inline
para correrlo yo en la BD de producción ANTES de mergear. Guiame paso a paso.
```

---

## 8. 🛢️ Cambios de base de datos (Claude da el SQL, vos lo corrés)

```
Esto necesita tocar la base de datos. Pasame el script SQL inline (copiable), explicame qué
hace y qué respalda, y NO asumas que lo corrí: esperá a que te confirme el resultado.
Acordate: primero en la BD de staging (aawjhttlaydwsipsifre), valido, y luego producción.
```

---

## 9. 🔌 Activar el cobro recurrente (cuando traiga la pasarela)

```
Voy a activar el cobro de suscripciones. La pasarela que elegí es: [Recurrente / Stripe].
Tengo las API keys y el WEBHOOK_SECRET. Seguí el "Checklist Cobro recurrente" de CLAUDE.md:
ajustá el adapter al payload de esta pasarela, decime exactamente qué variables de entorno
pongo en Railway, y cómo registro el webhook. Probamos en staging primero.
```

---

## 10. 📄 Activar facturación electrónica FEL (cuando traiga el certificador)

```
Voy a activar FEL. El certificador que contraté es: [INFILE / G4S / Digifact / otro].
Tengo: usuario/clave o API key, URL del endpoint, certificado y NIT/datos fiscales.
Seguí el "Checklist FEL" de CLAUDE.md: escribí el adapter concreto en services/felProvider.js,
pasame el SQL de migrations/017 para correrlo yo, el UPDATE de los datos del emisor, y las
variables de entorno de Railway. Probamos en staging con certificado de prueba primero.
```

---

## 11. 📘 Pedir/actualizar el manual técnico

```
Construí (o actualizá) docs/MANUAL-TECNICO.md explorando ambos repos a fondo (no inventes).
Seguí la estructura de 10 secciones acordada en CLAUDE.md (Backlog). Cuando termines, dejá
CLAUDE.md enlazando a ese manual.
```

---

## 12. 🧹 Cerrar la sesión bien (que nada quede en el aire)

```
Antes de cerrar: (1) actualizá CLAUDE.md con lo que hicimos hoy y lo que quedó pendiente
con su estado, (2) confirmame que todo está commiteado y pusheado, (3) decime en una línea
en qué quedamos y cuál es el próximo paso. Aplicá la regla #9.
```

---

## 13. 🆘 Estoy perdido / algo se rompió

```
Me salió esto: [pegá el error completo o describí qué pasó].
Explicámelo en simple, decime si es grave, y guiame paso a paso para resolverlo sin romper
nada. Si tocás algo, un cambio a la vez y me vas confirmando.
```

---

## 14. 🔍 Antes de probar — que Claude cace bugs primero

```
Antes de que yo pruebe [la funcionalidad X] en el piloto, ponete el rol de QA: auditá el
código y el esquema real, simulá el flujo, y cazá los bugs que puedas de antemano. Decime
qué encontraste y qué arreglar antes de que pruebe.
```

---

> 💡 **Tips de uso:**
> - Empezá SIEMPRE con el prompt #1 en cada sesión nueva.
> - Si Claude se adelanta, recordale: "un paso a la vez, esperá mi OK" (regla #1).
> - Si vas a tocar la base de datos, exigí el SQL inline (regla #2 y #4).
> - Las credenciales del piloto van en el chat cuando pruebes: `admin@demo.com` / `Admin2026!`.
>
> Esta guía vive en `docs/PROMPTS.md`. La de instalación/consola en `docs/CONSOLA-WINDOWS.md`.
