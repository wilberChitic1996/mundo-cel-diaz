# DEFINITION OF DONE — PraxisGT (Mundo Cel Diaz)

> Criterios para declarar el producto **"finalizado y vendible"** como SaaS comercial autoservicio en Guatemala.
> Extraído de `AUDIT.md` (auditoría de vendibilidad). Estado de partida: **~35–40% vendible — NO vendible hoy** como SaaS facturable autoservicio (sí usable como herramienta de gestión interna para pocos clientes de confianza).

---

## ✅ Definition of Done — Bloqueantes del MVP vendible

El MVP se considera **vendible** sólo cuando TODOS estos ítems estén cerrados:

- [ ] **B3 — Cerrar escalada a superadmin** (whitelist de roles en `users.js`) · esfuerzo **S** · 🔴 seguridad: hoy un admin puede promoverse a superadmin y romper el aislamiento de todos los negocios.
- [ ] **B2/A6 — Enforcement de suscripción en backend** (middleware que valide `tenants.active`/`expires_at`) · **S/M** · sin esto no se puede cobrar (un tenant vencido sigue operando por API).
- [ ] **A1/A15 — `decrement_stock` robusto** (versionar la función con `FOR UPDATE` + validación en migración) y **drop del overload de 2 args sin tenant** · **M** · integridad de inventario/dinero.
- [ ] **A2/A3 — Fixes de 1 línea** (auto-refresh JWT `session.js:69`; RemindersWidget) · **S** · features anunciadas que hoy no operan.
- [ ] **A8 — RBAC server-side** en endpoints de escritura (no depender del frontend) · **M**.
- [ ] **A11/A12 — Endurecer CSP** (quitar `unsafe-eval`) + **refresh token en cookie HttpOnly** · **M** · reducir superficie XSS.
- [ ] **A13 — Cifrado de DPI** y no volcarlo a `audit_logs` · **M** · cumplimiento de datos personales.
- [ ] **A14 — Paginación server-side** en `sales`/`accounts` · **M** · escalabilidad mínima.
- [ ] **M23 — Términos de Servicio + Política de Privacidad** + aceptación registrada · **S/M** · requisito legal.
- [ ] **A16 — Cobro recurrente** (Recurrente/Stripe) + **signup self-serve** · **L** · para que sea SaaS y no operación manual.
- [ ] **B1 — Integración FEL** (Factura Electrónica SAT con certificador homologado) · **L** · sin esto no se factura legalmente a contribuyentes GT.

> Esfuerzos: **S** (horas/días) · **M** (días) · **L** (semanas, requiere terceros/contratos).

---

## 🗂️ Backlog post-lanzamiento (NO bloquea vender)

A4 push visible (SW injectManifest) · A5/M7/M8 exports y auditoría de compras · A9/A10 fidelidad del arqueo de caja (split + rango de sesión + persistir totales) · A7 revocación de JWT · M1/M2 checklist y fotos de reparación · M5 `client_id` en cuentas · M16 2FA TOTP · M17 cascada de delete tenant · M20 índices `(tenant_id, created_at)` · M24 tests de flujos de dinero · M25 DR/restore probado · limpieza de dead code (`services/*`, endpoints huérfanos) · unificación de tipos `id` text→uuid · columnas duplicadas en `repairs` · `min_stock` configurable · sincronizar `CLAUDE.md`/`DB-SCHEMA-REAL.md` con la realidad.

---

## 🟢 Lo que YA está sólido (no reabrir sin motivo)

Flujo de venta (contado/crédito/idempotencia/IVA/seriales/voucher), CRUD productos/catálogos/clientes, seriales IMEI end-to-end, reparaciones (alta/edición/estados/cobro/anti-doble-cobro/costo final), garantías, devoluciones, panel SuperAdmin (tenants/stats/crear/usuarios), config+IVA, backup health/list/create/download, crons con columnas reales, QR público, login con auto-migración bcrypt, recuperación de contraseña, integridad referencial de la BD.

---

## 🚦 Plan de cierre sugerido (orden recomendado)

### Fase 0 — Quick wins de seguridad y bugs de 1 línea (días)
1. [ ] B3 — whitelist de roles en `users.js` (cerrar escalada a superadmin).
2. [ ] A2 — `session.js:69` `res.data`→`res` (refresh JWT).
3. [ ] A3/M22 — RemindersWidget `setData(res)` + render `client_name`/`brand`/`model`.
4. [ ] A15 — DROP del overload `decrement_stock(uuid,integer)`.
5. [ ] M3 — `defectives.js:30` permitir superadmin.
6. [ ] M7 — Export Excel de Compras (`created_at`/`purchase_items`).
7. [ ] M15 — `serials.js` no devolver `err.message` al cliente.

### Fase 1 — Aislamiento y cobro (semanas)
8. [ ] B2/A6 — middleware `enforceSubscription` (tenant activo/vigente).
9. [ ] A8 — `requireRole` en endpoints de escritura.
10. [ ] A1 — migración `decrement_stock` con `FOR UPDATE` + validación + revertir venta si falla.
11. [ ] M9 — migración versionada `tenants.updated_at`.
12. [ ] A12/M12/M13 — unificar capa de sesión + refresh token en cookie HttpOnly + logout que revoque.

### Fase 2 — Requisitos comerciales SaaS (semanas/meses)
13. [ ] A16 — pasarela de cobro (Recurrente/Stripe) + signup self-serve atado a trial/activación.
14. [ ] B1 — integración FEL con certificador homologado.
15. [ ] M23 — ToS + Política de Privacidad + aceptación registrada.
16. [ ] A13 — cifrado de DPI + no volcarlo a `audit_logs`.
17. [ ] A11 — endurecer CSP (quitar `unsafe-eval`, hashes/nonces).
18. [ ] A14 — paginación server-side `sales`/`accounts`.

### Fase 3 — Robustez y deuda (continuo)
19. [ ] M24 — tests de `sales`/`repairs`/`returns`/`caja`/`backup` + enforcement; umbral de cobertura en CI.
20. [ ] M25 — probar restauración de backup + runbook DR + monitor de uptime externo.
21. [ ] A4 — push visible (SW injectManifest).
22. [ ] A9/A10 — fidelidad del arqueo de caja.
23. [ ] Limpieza: dead code, unificación de tipos `id`, columnas duplicadas en `repairs`, índices `(tenant_id, created_at)`, sincronizar docs con la realidad.

---

## 📌 Aclaración importante (estado en vivo vs. esquema versionado)

- **`decrement_stock`:** la **migración versionada** (`000_full_schema.sql`) tiene la versión débil (sin `FOR UPDATE`), pero el **runtime en vivo ya es robusto en ambos ambientes** (producción lo tenía; el piloto se igualó el 29 jun 2026). El pendiente real es **versionar** la función buena para que el archivo coincida con la BD. El **overload de 2 args sin tenant** existe en ambos ambientes y debe **eliminarse**.
- Auditoría de **solo lectura**; ningún arreglo de esta lista está aplicado todavía. Esperar aprobación antes de tocar código.

---

_Generado a partir de `AUDIT.md`. Marcar `[x]` cada ítem al cerrarlo._
