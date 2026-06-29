# AUDIT.md — PraxisGT (Mundo Cel Diaz) — Auditoría consolidada de vendibilidad

> Auditoría cruzada (UI→API→BD) de un SaaS POS multi-tenant para talleres de celulares en Guatemala. Consolidación honesta de 6 reportes por subsistema + 5 reportes transversales (BD, seguridad backend, frontend, contrato front↔back, vendibilidad/FEL). Hallazgos clave verificados directamente contra el código en esta sesión.

---

## 1. Resumen ejecutivo

**¿Se puede vender hoy como SaaS comercial autoservicio?** **NO.**
**Vendibilidad estimada: ~35-40%.**

El producto es, a nivel **operativo**, un POS / sistema de gestión multi-tenant **sólido y mayormente funcional**: el flujo central de venta (contado, crédito, idempotencia, IVA, seriales/IMEI, voucher con QR), inventario, catálogos, cuentas por cobrar, devoluciones, reparaciones, garantías, clientes, caja, proveedores, cuadres, historial, auditoría, panel SuperAdmin, backups, Sentry y CI están en su mayoría **FUNCIONALES end-to-end**. Como herramienta interna operada a mano, para uno o pocos negocios conocidos, **es usable hoy**.

Lo que impide venderlo como **SaaS comercial facturable** son cuatro bloqueantes verificados:

1. **FEL muerto** — no emite facturas válidas ante la SAT (columnas `fel_*` nunca escritas; el recibo dice literalmente "no válido como factura").
2. **Suscripción no exigida en backend** — el corte por falta de pago es un banner cosmético; un tenant vencido sigue operando vía API.
3. **Escalada de privilegios** — un admin puede promoverse/crear superadmin y romper el aislamiento de todos los negocios.
4. **Sin cobro recurrente ni signup self-serve** — alta y renovación 100% manuales por superadmin.

Además, dos bugs de una línea dejan features anunciadas sin efecto real (auto-refresh de JWT y RemindersWidget), y el RPC `decrement_stock` versionado **no tiene** la atomicidad que CLAUDE.md afirma.

**Veredicto:** vendible solo como herramienta de gestión interna asistida para pocos clientes de confianza; **no** como SaaS autoservicio facturable.

---

## 2. Inventario de funcionalidades

> Conteo aproximado consolidado: **FUNCIONAL 48 · PARCIAL 17 · ADORNO 6 · FALTANTE 3**. (Las funciones FUNCIONALes de bajo riesgo se agrupan; se detallan todas las PARCIAL/ADORNO/FALTANTE.)

### Ventas / POS / Caja chica
| Funcionalidad | Estado | Evidencia |
|---|---|---|
| Crear venta completa (POS→/sales) | FUNCIONAL | routes/sales.js:115; App.jsx:1263 |
| Idempotencia de venta | FUNCIONAL | sales.js:55; App.jsx:1252 |
| Validación de stock previa | FUNCIONAL | sales.js:72-73 |
| `decrement_stock` RPC (atomicidad) | **PARCIAL** | 000_full_schema.sql:366-373 — sin FOR UPDATE ni validación; venta no se revierte si falla (sales.js:134) |
| Límite de descuento por rol (cajero ≤20%) | FUNCIONAL | sales.js:77 |
| IVA en venta (desglose) | FUNCIONAL | sales.js:46; 012_sales_iva.sql |
| Pago dividido (split payment) | **PARCIAL** | persiste (sales.js:111) pero ignorado por arqueo de caja (CajaScreen.jsx:110) y sin validación de monto |
| Cálculo de vuelto | FUNCIONAL | App.jsx:1240 |
| Serial/IMEI en POS y marcado vendido | FUNCIONAL | sales.js:101; POSScreen.jsx:116 |
| Venta a crédito / abono / pendiente | FUNCIONAL | sales.js:177; App.jsx:1284 |
| Voucher post-venta (impresión+QR) | FUNCIONAL | App.jsx:1276,159 |
| Abrir caja (sesión única) | FUNCIONAL | caja.js:46 |
| Registrar/eliminar gasto de caja | FUNCIONAL | caja.js:101; CajaScreen.jsx:411 |
| Cierre de caja: totales/diferencia | **PARCIAL** | caja.js:61-67 — NO persiste total_ventas/gastos/abonos/efectivo/diferencia; totales solo client-side por "fecha de hoy" |
| Movimientos de caja del día | **PARCIAL** | CajaScreen.jsx:110 — filtra por día calendario, no por sesión; ignora split |
| Respaldo automático al cerrar caja | **ADORNO** | App.jsx:2062 no pasa onBackup → CajaScreen.jsx:62 no-op; el comentario promete un respaldo que nunca ocurre |
| Historial de sesiones de caja | FUNCIONAL | caja.js:19 |

### Inventario / Productos / Catálogos / Seriales
| Funcionalidad | Estado | Evidencia |
|---|---|---|
| CRUD productos | FUNCIONAL | products.js:42-165 |
| Campo "Stock mínimo" configurable | **FALTANTE** | ProductForm sin input min_stock; App.jsx saveProduct no lo envía; alertas hardcoded "< 5" |
| Importación productos Excel | **PARCIAL** | dedup solo client-side por nombre; back no valida duplicados → riesgo de duplicados |
| Ajuste manual de stock + movimiento | FUNCIONAL | products.js:93-120 |
| Historial de movimientos de stock | **PARCIAL** (FUNCIONAL parcial) | solo registra ajustes/inicial; ventas/compras/devoluciones no escriben stock_movements |
| Historial de precios | FUNCIONAL | products.js:134-152 (derivado de audit_logs) |
| Gestión de Seriales/IMEI (list/add/remove) | FUNCIONAL | serials.js:47,74,179 (Luhn) |
| Variantes de producto | **PARCIAL** | CRUD funciona (variants.js) pero NO se integran a ventas ni descuentan stock; sin RBAC admin |
| Catálogos categorías | FUNCIONAL | categories.js:34-96 |
| Catálogos ubicaciones | FUNCIONAL | locations.js:34-94 |
| Pantalla Inventario (resumen+export) | FUNCIONAL | InventoryScreen.jsx:33-273 |
| Mover producto (moveProduct) | **ADORNO** | api.js:168 + locations.js:100 sin ningún consumidor en UI |

### Cuentas por cobrar / Devoluciones / Defectivos
| Funcionalidad | Estado | Evidencia |
|---|---|---|
| Crear cuenta por cobrar | FUNCIONAL | sales.js:148-209 |
| Registrar abono/pago | FUNCIONAL | accounts.js:55-69 |
| Aging 0-30/60/90 | FUNCIONAL | AccountsScreen.jsx:266 (cálculo client-side) |
| Hipervínculo a cliente / WhatsApp por clientId | **ADORNO** | accounts.client_id nunca se persiste (sales.js:174) ni mapea (App.jsx:1070) → clientId siempre undefined |
| Recordatorio WhatsApp individual | **PARCIAL** | depende de clientId undefined → siempre pide número manual |
| Recordatorio masivo WhatsApp | **PARCIAL** | teléfonos nunca pre-cargan (mismo root cause) |
| Exportar cuentas Excel/PDF | FUNCIONAL | AccountsScreen.jsx:284 |
| Registrar devolución (3 pasos) | FUNCIONAL | returns.js:37-51 |
| Reingreso a stock (buen estado) | FUNCIONAL | returns.js:53-59 (frágil: .eq(code).single(); sin stock_movements) |
| Devolución defectuoso → defectivos | FUNCIONAL | returns.js:60-63 |
| Defectivos dar de baja / reingresar | FUNCIONAL | defectives.js:35-43 |
| RBAC PUT /defectives (bloquea superadmin) | **PARCIAL** | defectives.js:30 `role !== 'admin'` → superadmin recibe 403 pese a "Todo" |
| Historial de devoluciones | FUNCIONAL | returns.js:21; App.jsx:1071 |
| Detalle de cuenta (pagos/artículos) | FUNCIONAL | accounts.js:21 |

### Reparaciones / Garantías / Clientes
| Funcionalidad | Estado | Evidencia |
|---|---|---|
| Alta de reparación | FUNCIONAL | App.jsx:1490; repairs.js:33-46 |
| Edición de reparación | FUNCIONAL | repairs.js:87-99 |
| Checklist de recepción | **PARCIAL** | guarda OK pero App.jsx (1074,1494) no mapea receptionChecklist → desaparece al recargar |
| Fotos de recepción (Storage) | **PARCIAL** | RepairsScreen.jsx:334 fire-and-forget con catch silencioso; sin reload |
| Estados de reparación (stepper) | FUNCIONAL | repairs.js:71 |
| Cobro de reparación (servicio) | FUNCIONAL | sales.js:119,69 |
| Anti-doble-cobro (marca entregado) | FUNCIONAL | App.jsx:1303 |
| Costo final cobrado | FUNCIONAL | repairs.js:97 |
| repair_items (persistencia relacional) | **PARCIAL** | dead-write: se escribe (repairs.js:55,124) pero nunca se lee |
| Garantías alta / cambio estado | FUNCIONAL | warranties.js:40,51 |
| Garantías hipervínculo a cliente | **PARCIAL** | warranties sin client_id → solo match exacto por nombre |
| Clientes CRUD | FUNCIONAL | clients.js:33-67 |
| Clientes eliminar (soft delete) | **ADORNO** | DELETE /clients existe pero ninguna UI lo invoca |
| Clientes perfil 360 | FUNCIONAL | ClientsScreen.jsx:159-161 |

### SuperAdmin / Usuarios / Config / Backup / Recordatorios / Push
| Funcionalidad | Estado | Evidencia |
|---|---|---|
| SuperAdmin: listar tenants + stats | FUNCIONAL | admin.js:44,133 |
| SuperAdmin: editar/activar/renovar tenant | **PARCIAL** | admin.js:106 setea updated_at en tabla tenants que (esquema versionado) no tiene la columna → riesgo 500 en prod |
| SuperAdmin: crear tenant | FUNCIONAL | admin.js:100 |
| SuperAdmin: gestión usuarios por tenant | FUNCIONAL | admin.js:159-287 |
| SuperAdmin: "Mi cuenta" | FUNCIONAL | admin.js:207 |
| Banner suscripción vencida | FUNCIONAL (solo informa) | admin.js:349; App.jsx:2041 |
| Usuarios (admin tenant): CRUD | **PARCIAL** | UsersScreen arrastra db.js DEPRECATED (IndexedDB); traga errores de API mostrando "éxito" falso |
| Config tienda + IVA configurable | FUNCIONAL | settings.js:48 |
| Backup health/list/create/download | FUNCIONAL | backup.js:11,46,71,91 |
| Backup "Exportar historial (Excel)" | **ADORNO** | api.js:212 llama GET /backup/:id/data inexistente → 404 |
| Backup "Descargar JSON completo" | FUNCIONAL | BackupScreen.jsx:101 |
| RemindersWidget (Dashboard) | **ADORNO** | RemindersWidget.jsx:24 `setData(res.data)` sobre respuesta ya desempaquetada → siempre null |
| Reminders aging endpoint /reminders/accounts | **PARCIAL** | bucket 'current' nunca poblado; sin consumidor front |
| Recordatorios automáticos (cron) | FUNCIONAL (server) | utils/reminders.js:198-231 |
| Push: suscripción VAPID | **PARCIAL** | suscribe OK pero la entrega depende del SW |
| Push: visualización (SW push handler) | **FALTANTE** | VitePWA GenerateSW sin handler 'push'/'notificationclick' → notificación nunca se muestra |
| SuperAdmin: eliminar negocio (cascada) | FUNCIONAL | admin.js:238-244 (no purga serials/variants/repair_items) |

### Dashboard / Login / Landing / Onboarding / Ayuda / VerifyReceipt / Auth
| Funcionalidad | Estado | Evidencia |
|---|---|---|
| Login bcrypt + auto-migración SHA-256→bcrypt | FUNCIONAL | auth.js:91,100-102 |
| Auto-refresh silencioso de JWT | **ADORNO** | session.js:69 `res.data` sobre respuesta ya desempaquetada → tryRefreshSession siempre null → JWT nunca se renueva |
| Verificación QR pública (VerifyReceipt) | FUNCIONAL | public.js:56-66 |
| Recuperación de contraseña (3 pasos) | FUNCIONAL | auth.js:283-336 |
| 2FA superadmin | **PARCIAL** | UI+endpoint vivos pero disparador requires2fa comentado (auth.js:119-136) |
| Dashboard KPIs + gráficas | FUNCIONAL | DashboardScreen.jsx:146-216 |
| Onboarding Wizard | FUNCIONAL | OnboardingWizard.jsx:65-106 |
| AyudaScreen | FUNCIONAL | AyudaScreen.jsx:152 |
| LandingPage | FUNCIONAL (stats hardcodeados marketing) | LandingPage.jsx:45-56 |
| Logout (revocación refresh token) | **PARCIAL** | App.jsx:303 clearSession inline NO revoca refresh token (a diferencia de session.js:87) |
| Coexistencia 2 capas de sesión | **PARCIAL** | App.jsx:290-303 duplica session.js con shape distinto |

---

## 3. Hallazgos por severidad

### 🔴 BLOQUEANTE

**B1. FEL (Factura Electrónica SAT GT): solo esquema, no hay facturación legal**
- Evidencia: `migrations/002_sat_guatemala_fields.sql:46-51` agrega `sales.fel_serie/fel_numero/fel_status/client_nit`. `grep fel_* routes/` = **0 coincidencias** (verificado). `receipt.js:121,340` imprime literal "Comprobante interno · No es documento tributario (no válido como factura)". No existe integración con certificador (INFILE/G4S/Megaprint).
- Impacto: el POS no puede facturar legalmente ante la SAT. Las columnas FEL son dead schema. Para vender a la mayoría de contribuyentes GT, es bloqueante.
- Solución: integrar certificador FEL homologado (servicio felService.js: armar DTE XML, firmar/certificar, persistir fel_*), manejar régimen, NIT receptor, anulaciones, contingencia. Esfuerzo **L** (semanas + contrato con certificador). Hasta entonces, posicionar como "sistema de gestión interno", no "facturador".

**B2. La suscripción NO se hace cumplir en el backend**
- Evidencia: `middleware/auth.js` (verificado, 18 líneas) solo hace `jwt.verify` e inyecta `req.user`; NO consulta `tenants.active`/`expires_at`. El único chequeo de vencimiento es `admin.js:339-350` (/subscription), informativo, usado para pintar el banner (App.jsx:2038-2044).
- Impacto: el "gate" de cobro es cosmético. Un tenant vencido/desactivado sigue vendiendo y operando con su JWT (8h) / refresh token (30d) ignorando el banner. No hay forma real de cortar el servicio por falta de pago.
- Solución: middleware `enforceSubscription` tras `auth` que cargue el tenant (cacheado) y devuelva 403 si `!active` o `expires_at < now` en todas las rutas de negocio. Esfuerzo **S/M**.

**B3. Escalada de privilegios: un admin puede crear/promover usuarios a superadmin**
- Evidencia: `routes/users.js:48` (POST) usa `role` del body tal cual; `users.js:72` (PUT) `if (b.role !== undefined) updates.role = b.role` — sin whitelist (verificado). Contrasta con `admin.js:272` que SÍ valida `['admin','cajero','auditor']`.
- Impacto: cualquier admin (dueño de tienda) puede promover un usuario a superadmin. superadmin rompe el aislamiento multi-tenant (`withTenant` devuelve queries sin filtro, utils/tenant.js:3) y accede al panel de TODOS los negocios. Quiebre total del aislamiento del SaaS.
- Solución: en users.js POST/PUT validar `role` contra `['admin','cajero','auditor']` (NUNCA superadmin); impedir auto-edición del propio rol/auto-desactivación. Esfuerzo **S**.

### 🟠 ALTO

**A1. `decrement_stock` sin atomicidad ni validación; la venta no se revierte si el RPC falla**
- Evidencia: `000_full_schema.sql:366-373` (verificado) — `UPDATE products SET stock = stock - p_qty` plano, sin `SELECT FOR UPDATE` ni `IF stock < p_qty THEN RAISE`. El comentario línea 364 dice "atómico con SELECT FOR UPDATE" (miente). `sales.js:134,197` solo loguea `rpcErr` → venta registrada sin descontar stock. La versión "robusta" que CLAUDE.md dice aplicada a mano en staging NO existe en ninguna migración.
- Impacto: stock negativo, race conditions en ventas concurrentes del último ítem, y ventas que no descuentan stock al fallar el RPC. Producción puede tener la versión débil.
- Solución: migración que redefina decrement_stock con FOR UPDATE + validación; en sales.js revertir la venta o devolver error si rpcErr. Esfuerzo **M**.

**A2. Auto-refresh de JWT roto (frontend)**
- Evidencia (verificado): `api.js:38` el interceptor devuelve `response.data`; `session.js:69` lee `var data = res.data` (undefined) → `tryRefreshSession` siempre devuelve null. El JWT de 8h nunca se renueva por este camino.
- Impacto: tras 8h las peticiones empiezan a dar 401 pese a tener refresh token válido. Funcionalidad anunciada como implementada que no opera.
- Solución: `session.js:69` cambiar `res.data` por `res`. Esfuerzo **S** (1 línea).

**A3. RemindersWidget del Dashboard nunca muestra datos**
- Evidencia (verificado): `RemindersWidget.jsx:24` `setData(res.data)` sobre respuesta ya desempaquetada → undefined → `if(!data) return null` (l.30). Además `reminders.js:40` devuelve `client_name/brand/model` pero el render (l.90) lee `r.client/r.device`.
- Impacto: el widget de recordatorios del Dashboard es UI muerta. Aun corrigiendo `.data`, reparaciones mostraría "undefined — undefined".
- Solución: `setData(res)` + render `r.client_name`/`r.brand r.model`. Esfuerzo **S**.

**A4. Push no visible: falta handler 'push'/'notificationclick' en el Service Worker**
- Evidencia: VitePWA `registerType:'autoUpdate'` (GenerateSW, solo workbox caching); no existe src/sw.js ni `addEventListener('push')`. Backend suscribe y envía (web-push), pero nada se muestra.
- Impacto: toda la inversión VAPID+cron+subscribe no produce notificaciones visibles. Contradice "Notificaciones push implementadas".
- Solución: migrar a injectManifest con src/sw.js que registre push + notificationclick. Esfuerzo **M**.

**A5. Botón "Exportar historial (Excel)" del Backup llama a endpoint inexistente**
- Evidencia (verificado): `api.js:212` GET `/backup/:id/data`; `routes/backup.js` solo define /health, /, POST /, /:id/download. → 404.
- Impacto: el botón siempre falla. ADORNO.
- Solución: implementar GET /backup/:id/data (descargar JSON de Storage → {tables}) o reusar download. Esfuerzo **S**.

**A6. El middleware auth no valida tenant activo/vigente (defensa de suscripción)** — ver B2; mismo root cause, listado también como ALTO en seguridad. Esfuerzo **S/M**.

**A7. JWT de 8h no revocable: desactivar/eliminar usuario no invalida su sesión**
- Evidencia: `auth.js`/middleware no consultan `users.active` por request; toggle/delete solo afectan la fila.
- Impacto: empleado despedido o token filtrado conserva acceso hasta 8h.
- Solución: consultar users.active (cacheado) por request o acortar la vida del JWT. Esfuerzo **M**.

**A8. RBAC inconsistente: cajero/auditor pueden ejecutar endpoints de escritura por API**
- Evidencia: sin chequeo de rol (solo auth): sales POST, accounts POST + payments, returns POST, repairs (todos), warranties, variants, caja abrir/cerrar/gastos POST. La matriz RBAC es gating de frontend.
- Impacto: un auditor (solo-lectura en UI) puede vender, abonar, abrir/cerrar caja por API directa.
- Solución: middleware `requireRole(...)` aplicado por endpoint según la matriz de CLAUDE.md. Esfuerzo **M**.

**A9. Split payment ignorado por el arqueo de caja**
- Evidencia: `CajaScreen.jsx:110` solo cuenta `s.method==='Efectivo'`, ignora `second_method/second_amount`; App.jsx no los mapea.
- Impacto: cierre de caja con pagos divididos da efectivo incorrecto (sub o sobreestima).
- Solución: considerar la porción efectivo del split y mapear second_method/second_amount. Esfuerzo **S/M**.

**A10. Cierre de caja: totales/diferencia nunca se persisten y se calculan por "fecha de hoy"**
- Evidencia: `caja.js:61-67` no escribe total_ventas/gastos/abonos/efectivo/diferencia; totales solo client-side por `toDateString()==='hoy'`.
- Impacto: historial de sesiones sin diferencia; saldo esperado incorrecto si la sesión cruza medianoche o hay varias el mismo día.
- Solución: calcular y persistir totales/diferencia sobre el rango [created_at, closed_at] en el back. Esfuerzo **M**.

**A11. CSP con 'unsafe-inline' + 'unsafe-eval' (contradice "CSP estricta")**
- Evidencia (verificado): `vercel.json:8` `script-src 'self' 'unsafe-inline' 'unsafe-eval'`.
- Impacto: la CSP no protege contra XSS, agravado por JWT/refresh token en storage accesible a JS y boletas con innerHTML sin escapar.
- Solución: eliminar 'unsafe-eval', migrar script-src a hashes/nonces. Esfuerzo **M**.

**A12. JWT y refresh token (30d) en sessionStorage/localStorage — exposición a XSS**
- Evidencia: api.js:46-50, session.js:55-56 (localStorage 'mnpos-refresh-token').
- Impacto: cualquier XSS exfiltra el refresh token → acceso persistente 30 días.
- Solución: mover refresh token a cookie HttpOnly+SameSite. Esfuerzo **M** (coordinado API+front).

**A13. DPI / datos personales sin cifrar y volcados en texto plano a audit_logs**
- Evidencia: `clients.js:33` dpi plano; `clients.js:36` logAudit con dpi en details.
- Impacto: riesgo legal/privacidad; fuga de BD expone identificaciones.
- Solución: cifrar columnas sensibles (pgcrypto/app) y no volcar DPI a audit_logs. Esfuerzo **M**.

**A14. Sin paginación server-side en sales/accounts**
- Evidencia: `sales.js:21` y `accounts.js:21` traen toda la tabla con ítems/abonos anidados, sin .range/.limit (audit.js sí pagina).
- Impacto: no escala; degrada dashboard/historial con volumen real.
- Solución: paginación server-side + filtros por fecha; agregados en el back. Esfuerzo **M**.

**A15. RPC `decrement_stock` duplicada: overload de 2 args SIN tenant_id (ambos ambientes)**
- Evidencia: pg_proc reporta `decrement_stock(uuid,integer)` y `decrement_stock(uuid,integer,uuid)`. El API usa la de 3 args.
- Impacto: función invocable que decrementa stock sin filtro de tenant (viola regla absoluta multi-tenant).
- Solución: `DROP FUNCTION decrement_stock(uuid,integer)` previa aprobación. Esfuerzo **S**.

**A16. Sin cobro recurrente / sin signup self-serve** — renovación = superadmin edita expires_at a mano; crear tenant es superadminOnly; no hay pasarela (Recurrente/Stripe). Impacto: SaaS operado a mano, no escala. Esfuerzo **L**.

### 🟡 MEDIO

- **M1. receptionChecklist no se mapea al cargar reparaciones** (App.jsx:1074,1494) → el checklist desaparece tras recargar. Fix: agregar `receptionChecklist:r.reception_checklist`. Esfuerzo S.
- **M2. Fotos de recepción fire-and-forget con catch silencioso** (RepairsScreen.jsx:334) y sin reload → fallos invisibles. Esfuerzo S.
- **M3. RBAC PUT /defectives bloquea superadmin** (defectives.js:30) — contradice "superadmin = Todo". Fix: `['admin','superadmin']`. Esfuerzo S.
- **M4. Reingreso de stock (returns/defectives) frágil** — `.eq('code').single()` (falla con code duplicado por tenant) y sin stock_movements. Esfuerzo S/M.
- **M5. accounts.client_id nunca se persiste/mapea** — rompe link a cliente y WhatsApp con teléfono (3 features degradadas). Fix back+front. Esfuerzo S.
- **M6. accounts POST '/' sin idempotencia** (a diferencia de sales) — riesgo de cuentas por cobrar duplicadas. Esfuerzo S.
- **M7. Export Excel de Compras roto** — SuppliersScreen.jsx:262 usa p.date/p.items (undefined) en vez de p.created_at/p.purchase_items → "Invalid Date" y Artículos=0. Esfuerzo S.
- **M8. Auditoría no etiqueta/filtra acciones de Proveedores/Compras** (AuditScreen.jsx:32-50,127-137) — se ven crudas. Esfuerzo S.
- **M9. admin.js PUT /tenants setea updated_at en tabla sin esa columna** — riesgo 500 en producción al editar/renovar/activar. Crear migración versionada. Esfuerzo S.
- **M10. PUT /tenants editar/activar/renovar depende de ALTER manual no versionado** (mismo que M9).
- **M11. UsersScreen arrastra db.js DEPRECATED (IndexedDB)** y traga errores de API mostrando "éxito" falso. Esfuerzo M.
- **M12. Logout no revoca refresh token** (App.jsx:303 clearSession inline) — token de 30d sigue vivo. Esfuerzo S.
- **M13. Dos implementaciones de sesión divergentes** (App.jsx:290-303 vs session.js) — deuda frágil. Esfuerzo M.
- **M14. CORS acepta cualquier *.vercel.app con credentials** (app.js:54,57). Esfuerzo S.
- **M15. serials.js devuelve err.message al cliente** (serials.js:68,131,173,213,236) — fuga de esquema. Esfuerzo S.
- **M16. 2FA superadmin deshabilitado** (auth.js:119-136 comentado) — cuenta de mayor privilegio con un solo factor. Esfuerzo M (idealmente TOTP, no email).
- **M17. DELETE tenant no purga product_serials/variants/repair_items** — posible fallo FK al eliminar negocios. Esfuerzo S.
- **M18. repair_items doble escritura (jsonb parts + relacional) con riesgo de desincronización** y error de insert solo logueado. Esfuerzo S/M.
- **M19. Tablas de respaldo con datos reales y RLS desactivado** (products_backup_staging_*). DROP cuando no se necesiten. Esfuerzo S.
- **M20. Índices temporales sin prefijo tenant_id** (sales/stock_movements/audit_logs) — no escala con volumen. Crear índices (tenant_id, created_at). Esfuerzo S.
- **M21. Aislamiento 100% dependiente de withTenant(); RLS teatral con service_role** — un solo SELECT sin withTenant filtra datos cruzados. Defensa en profundidad + tests. Esfuerzo M.
- **M22. RemindersWidget repairs_stalled "undefined — undefined"** (client_name/brand/model vs client/device). Esfuerzo S.
- **M23. Sin ToS / Política de Privacidad** — requisito legal SaaS con datos personales. Esfuerzo S/M.
- **M24. Cobertura de tests no cubre flujos de dinero** (sales/repairs/returns/caja/backup) — el "61/61" es engañoso. Esfuerzo M.
- **M25. Observabilidad/DR declarados pero restore nunca probado** (sospecha — no se ejecutó restauración). Esfuerzo M.
- **M26. min_stock no configurable + alertas hardcoded "< 5"** (ProductForm/InventoryScreen). Esfuerzo S.
- **M27. Importación de productos sin upsert real (dedup solo client-side)** — riesgo de duplicados. Esfuerzo S/M.
- **M28. stock_movements solo registra ajustes manuales** — ventas/compras/devoluciones sin trazabilidad. Esfuerzo M.

### 🟢 BAJO (selección)

- Dead code: `services/saleService.js`, `services/productService.js`, `clientService.js` (no usados por rutas, con bugs latentes: sku vs code, RPC adjust_stock inexistente).
- Endpoints/métodos sin consumidor: locationsAPI.moveProduct, serialsAPI.update/search, adminAPI.init, remindersAPI.accounts, GET /auth/me, clientsAPI.remove, repairsAPI.remove/deletePhoto.
- Campo fantasma `description` en PRODUCT_FIELDS (products no tiene la columna).
- node-pg-migrate no rastrea migraciones en staging (no existe tabla pgmigrations); 009-015 aplicadas a mano.
- Divergencia de tipos id text(prod) vs uuid(staging) en clients/repairs/repair_items.
- Tablas nuevas con RLS activo sin policy (product_serials, product_variants, repair_items, etc.).
- Variable `loaded` (App.jsx:1019) nunca leída → sin estado de carga; pantallas se montan con arrays vacíos.
- initAdmin siembra usuario admin local con hash de contraseña conocida en localStorage (db.js DEPRECATED activo).
- Enumeración de usuarios en find-user; reset solo con pregunta de seguridad (salt estático conocido).
- Correlativo REP basado en length puede colisionar tras borrados.
- Validación DPI único solo client-side.

---

## 4. Contradicciones CLAUDE.md vs código real

| # | CLAUDE.md afirma | Realidad verificada |
|---|---|---|
| 1 | "Atomicidad en stock: decrement_stock() con SELECT FOR UPDATE — Previene race conditions" | 000_full_schema.sql:366-373 es UPDATE plano sin FOR UPDATE ni validación; el comentario también miente. La versión "robusta" no está en ninguna migración. |
| 2 | "decrement_stock robusta igualada en staging (29 jun)" | Sin migración que lo respalde → no auditable/reproducible; producción puede tener la versión débil. Existe además un overload de 2 args sin tenant_id. |
| 3 | "Tablas que NO existen: repair_items" / DB-SCHEMA-REAL.md: "repair_items NO existe" | repair_items SÍ existe en staging y prod (migración 011 aplicada) y el API escribe en ella (repairs.js:55,124), con doble escritura jsonb+relacional. |
| 4 | "Próximos pasos: aplicar migraciones 009-015 en PRODUCCIÓN solo tras validar piloto" | Las migraciones 009-015 YA están aplicadas en producción (repair_items, serials, variants, iva, split, final_cost). Llegaron a main sin el flujo staging→main descrito. |
| 5 | "22 tablas confirmadas" / DB-SCHEMA-REAL.md "29 tablas" | ~31 tablas base en staging (incluye serials/variants/repair_items + 2 de respaldo). El conteo de CLAUDE.md está desactualizado. |
| 6 | "índices en tenant_id+created_at" | Los índices temporales no llevan tenant_id como prefijo. No hay índice compuesto (tenant_id, created_at). |
| 7 | "RLS habilitado en todas las tablas" | Tablas de respaldo con RLS desactivado y datos reales; 7 tablas con RLS sin policy. Y el API usa service_role que bypassa RLS → aislamiento teatral. |
| 8 | "Pago dividido POS ✅ PASADA" | Se persiste pero el arqueo de caja (CajaScreen.jsx:110) lo ignora → efectivo de cierre incorrecto. Pasada solo en registro, no en efecto en caja. |
| 9 | "Al cerrar caja se ejecuta respaldo automático" | App.jsx:2062 no pasa onBackup → no-op; el respaldo nunca ocurre. |
| 10 | "Notificaciones push implementadas / cron con push real" | No existe handler 'push'/'notificationclick' en el SW (GenerateSW). La notificación nunca se muestra. |
| 11 | "Refresh token 30d con rotación / auto-refresh silencioso" funcional | session.js:69 lee res.data sobre respuesta ya desempaquetada → el refresh siempre devuelve null; el JWT nunca se renueva. (verificado) |
| 12 | "RemindersWidget en Dashboard implementado" | RemindersWidget.jsx:24 mismo bug res.data → el widget nunca renderiza. (verificado) |
| 13 | "CSP estricta ✅" | vercel.json:8 habilita unsafe-inline + unsafe-eval → no es estricta. (verificado) |
| 14 | "db.js DEPRECATED (no usar)" | db.js sigue importado y activo en App.jsx (initAdmin) y LoginScreen (recuperación offline). |
| 15 | "superadmin = Todo" | defectives.js:30 (`role !== 'admin'`) bloquea a superadmin con 403. |
| 16 | "RBAC con matriz por rol aplicada" | El backend solo verifica rol en una minoría de endpoints; sales/accounts/returns/repairs/warranties/variants/caja no lo aplican → gating de frontend. |
| 17 | "idempotency keys" (Seguridad) | Se cumple en sales.js pero NO en accounts.js POST (también crea dinero). |
| 18 | "2FA código (implementado)" | Bloque 2FA comentado (auth.js:119-136) → superadmin con un solo factor. |
| 19 | "Endpoints del API — 21 módulos" | Hay al menos 23 módulos: omite serialsAPI y variantsAPI; subestima repairs (uploadPhoto/deletePhoto) y admin (getTenantUsers, toggleUser, updateMe, deleteTenant, etc.). |
| 20 | "backupAPI list/create/download/data/health" | GET /backup/:id/data NO existe en el back → exportar Excel falla con 404. (verificado) |
| 21 | "Cobertura de tests ✅ 61/61" como prueba de calidad | No hay tests de sales/repairs/returns/caja/backup/admin — justo los flujos de dinero. Verde engañoso. |
| 22 | "Backup enterprise ✅" | DR/restore nunca probado (sin runbook). Backup sin restore no es enterprise-ready. |

---

## 5. Veredicto de vendibilidad + Definition of Done

### ¿Vendible hoy? NO como SaaS comercial autoservicio (~35-40%).

El núcleo operativo funciona; faltan los pilares de un SaaS facturable en GT y hay fallos de seguridad de aislamiento que deben corregirse antes de exponer el producto a múltiples clientes.

### Bloqueantes faltantes para el MVP vendible (Definition of Done)

| Bloqueante | Esfuerzo | Justificación |
|---|---|---|
| B1. Integración FEL (facturación SAT) | **L** | Sin esto no se factura legalmente; imprescindible para vender a contribuyentes GT. |
| B2/A6. Enforcement de suscripción en backend | **S/M** | Sin esto no se puede cobrar (un vencido sigue operando). |
| B3. Cerrar escalada a superadmin (whitelist de roles) | **S** | Sin esto, un cliente puede tomar control de todos los negocios. |
| A16. Cobro recurrente (Recurrente/Stripe) + signup self-serve | **L** | Para que sea SaaS y no operación manual. |
| A1/A15. decrement_stock robusto (FOR UPDATE+validación) + drop del overload | **M** | Integridad de inventario/dinero; corrige causa de sobreventa. |
| A2/A3. Fixes de 1 línea (refresh JWT, RemindersWidget) | **S** | Features anunciadas que hoy no operan. |
| A13. Cifrado de DPI / no volcarlo a audit_logs | **M** | Cumplimiento de datos personales. |
| A14. Paginación server-side sales/accounts | **M** | Escalabilidad mínima con volumen real. |
| M23. ToS + Política de Privacidad + aceptación | **S/M** | Requisito legal para vender. |
| A11/A12. Endurecer CSP + refresh token en cookie HttpOnly | **M** | Reducir superficie XSS. |
| A8. RBAC server-side en endpoints de escritura | **M** | Que la autorización no dependa del front. |

### Backlog post-lanzamiento (no bloqueante)

- A4 Push visible (SW injectManifest), A5/M7/M8 exports y auditoría de compras, A9/A10 fidelidad del arqueo de caja, A7 revocación de JWT, M1/M2 checklist y fotos de reparación, M5 client_id en cuentas, M16 2FA TOTP, M17 cascada de delete tenant, M20 índices compuestos, M24 tests de flujos de dinero, M25 DR/restore probado, limpieza de dead code (services/*, endpoints huérfanos), unificación de tipos id text→uuid, limpieza de columnas duplicadas en repairs, min_stock configurable, sincronizar CLAUDE.md/DB-SCHEMA-REAL.md con la realidad.

### Lo que SÍ está sólido (no reabrir sin motivo)

Flujo de venta (contado/crédito/idempotencia/IVA/seriales/voucher), CRUD productos/catálogos/clientes, seriales IMEI end-to-end, reparaciones (alta/edición/estados/cobro/anti-doble-cobro/costo final), garantías, devoluciones, panel SuperAdmin (tenants/stats/crear/usuarios), config+IVA, backup health/list/create/download, crons con columnas reales, QR público, login con auto-migración bcrypt, recuperación de contraseña, integridad referencial de la BD (0 huérfanos verificados en los reportes).

---

## 6. Plan de cierre sugerido (orden recomendado)

**Fase 0 — Quick wins de seguridad y bugs de 1 línea (días):**
1. B3 — whitelist de roles en users.js (cerrar escalada a superadmin).
2. A2 — session.js:69 `res.data`→`res` (refresh JWT).
3. A3/M22 — RemindersWidget `setData(res)` + render client_name/brand/model.
4. A15 — DROP del overload decrement_stock(uuid,integer).
5. M3 — defectives.js:30 permitir superadmin.
6. M7 — Export Excel de Compras (created_at/purchase_items).
7. M15 — serials.js no devolver err.message.

**Fase 1 — Aislamiento y cobro (semanas):**
8. B2/A6 — middleware enforceSubscription (tenant activo/vigente).
9. A8 — requireRole en endpoints de escritura.
10. A1 — migración decrement_stock con FOR UPDATE + validación + revertir venta si falla.
11. M9 — migración versionada tenants.updated_at.
12. A12/M12/M13 — unificar capa de sesión a session.js + refresh token en cookie HttpOnly + logout que revoque.

**Fase 2 — Requisitos comerciales SaaS (semanas/meses):**
13. A16 — pasarela de cobro (Recurrente/Stripe) + signup self-serve atado a trial/activación.
14. B1 — integración FEL con certificador homologado.
15. M23 — ToS + Política de Privacidad + aceptación registrada.
16. A13 — cifrado de DPI + no volcarlo a audit_logs.
17. A11 — endurecer CSP (quitar unsafe-eval, hashes/nonces).
18. A14 — paginación server-side sales/accounts.

**Fase 3 — Robustez y deuda (continuo):**
19. M24 — tests de sales/repairs/returns/caja/backup + enforcement de suscripción; umbral de cobertura en CI.
20. M25 — probar restauración de backup + runbook DR + monitor de uptime externo.
21. A4 — push visible (SW injectManifest).
22. A9/A10 — fidelidad del arqueo de caja (split + rango de sesión + persistir totales).
23. Limpieza: dead code (services/*, endpoints huérfanos), unificación de tipos id, columnas duplicadas en repairs, índices (tenant_id, created_at), sincronizar CLAUDE.md/DB-SCHEMA-REAL.md con la realidad de ambos ambientes.

---

### Notas de método y límites

- Auditoría de solo lectura; no se modificó código.
- Verifiqué directamente en esta sesión: escalada de privilegios (users.js:48,72), middleware/auth.js (sin chequeo de tenant), interceptor api.js:38 + bugs res.data en session.js:69 y RemindersWidget.jsx:24, ausencia de GET /backup/:id/data, decrement_stock sin FOR UPDATE, FEL sin uso en routes/, CSP con unsafe-inline/unsafe-eval. Coinciden con los reportes.
- **No verificado contra la BD viva** (entorno sin acceso a Supabase): el conteo exacto de tablas, la existencia/ausencia de `tenants.updated_at` en producción, los overloads de pg_proc y la afirmación de "restore probado" se basan en los reportes y migraciones; deben confirmarse con `information_schema`/`pg_proc` antes de actuar (marcado como sospecha donde aplica).
- La afirmación de CLAUDE.md sobre IP en audit_logs no se confirmó (no se leyó utils/audit.js); tal como se invoca logAudit no se pasa IP explícita.