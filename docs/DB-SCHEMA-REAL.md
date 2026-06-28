# DB-SCHEMA-REAL.md — Esquema REAL de la base de datos (staging)

> **FUENTE DE VERDAD DEL ESQUEMA.** Volcado de `information_schema.columns` de Supabase **staging**
> (`aawjhttlaydwsipsifre`) el **28 jun 2026**. Antes de escribir o modificar CUALQUIER query, el rol
> 🛢️ **Guardián del Esquema (DBA)** consulta ESTE archivo — NO asume nombres de columna.
>
> **Cómo regenerar:** correr en el SQL Editor de staging y reemplazar este archivo:
> ```sql
> SELECT table_name, column_name, data_type, is_nullable
> FROM information_schema.columns
> WHERE table_schema = 'public'
> ORDER BY table_name, ordinal_position;
> ```
> Mantener sincronizado también con producción (`rhecnmfivygkayfvauxt`) cuando se apliquen migraciones allá.

---

## ⚠️ Desajustes de esquema CONFIRMADOS (la causa #1 de bugs)

| Lo que el código asumía | Realidad en la BD | Tabla |
|---|---|---|
| `sales.date` | **NO existe** → usar `created_at` (o alias `date:created_at`) | `sales` |
| `accounts.due_date` | **NO existe** → aging por antigüedad con `created_at` | `accounts` |
| `repairs.client` / `repairs.device` | **NO existen** → `client_name`, `brand`, `model` | `repairs` |
| estado `repairs.status = 'en_proceso'` | **NO existe** → los estados son `recibido / en_revision / listo / entregado` | `repairs` |
| tabla `repair_items` | **NO existe** → los repuestos van en la columna `repairs.parts` (jsonb) | — |

### 🧹 Deuda técnica — columnas DUPLICADas en `repairs`
El ALTER del 28 jun agregó columnas con los nombres que usaba el código, quedando **duplicadas** con las originales.
Ambas existen; el código usa las de la derecha. **Pendiente:** unificar a futuro (preferir las originales y migrar datos).

| Original (canónica) | Duplicada agregada (la que usa el código hoy) |
|---|---|
| `issue` | `problem_desc` |
| `price` | `estimated_cost` |
| `technician` | `tech_name` |
| `notes` | `internal_note` |

---

## Tablas y columnas reales (29 tablas)

> Tipos abreviados: `uuid`, `text`, `num`(numeric), `int`, `bool`, `ts`(timestamptz), `date`, `jsonb`, `ARRAY`(text[]).
> Todas las tablas llevan `tenant_id` (multi-tenant) salvo `tenants`.

### account_items
`id`(uuid), `tenant_id`(uuid), `account_id`(uuid), `code`(text), `name`(text), `price`(num), `qty`(int)

### account_payments
`id`(uuid), `tenant_id`(uuid), `account_id`(uuid), `amount`(num), `method`(text), `note`(text), `registrado_por`(jsonb), `created_at`(ts)

### accounts
`id`(uuid), `tenant_id`(uuid), `sale_id`(uuid), `client`(text), `total`(num), `paid`(num), `balance`(num), `status`(text), `method`(text), `user_id`(uuid), `registrado_por`(jsonb), `idempotency_key`(text), `created_at`(ts), `updated_at`(ts), `client_id`(uuid)
> ❌ NO tiene `due_date`. Aging = días desde `created_at` sobre `balance > 0`.

### audit_logs
`id`(uuid), `tenant_id`(uuid), `user_id`(uuid), `user_name`(text), `user_role`(text), `action`(text), `entity_type`(text), `entity_id`(text), `details`(jsonb), `created_at`(ts)

### backups
`id`(uuid), `tenant_id`(uuid), `created_at`(ts), `size_bytes`(bigint), `status`(text), `type`(text), `storage_path`(text), `error_msg`(text), `tables_included`(ARRAY), `record_counts`(jsonb)

### caja_gastos
`id`(uuid), `tenant_id`(uuid), `sesion_id`(uuid), `concepto`(text), `monto`(num), `categoria`(text), `registrado_por`(text), `registrado_role`(text), `created_at`(ts)

### caja_sesiones
`id`(uuid), `tenant_id`(uuid), `fondo_inicial`(num), `nota_apertura`(text), `opened_by`(text), `opened_role`(text), `closed_at`(ts), `closed_by`(text), `total_ventas`(num), `total_gastos`(num), `total_abonos`(num), `total_efectivo`(num), `diferencia`(num), `nota_cierre`(text), `created_at`(ts)
> Ojo: la tabla es `caja_sesiones` (no `caja_sessions`).

### categories
`id`(uuid), `tenant_id`(uuid), `name`(text), `icon`(text), `color`(text), `sort_order`(int), `active`(bool), `created_at`(ts), `updated_at`(ts)

### clients
`id`(uuid), `tenant_id`(uuid), `cli_code`(text), `name`(text), `dpi`(text), `phone`(text), `address`(text), `active`(bool), `created_at`(ts), `updated_at`(ts), `nit`(text), `email`(text)

### defectives
`id`(uuid), `tenant_id`(uuid), `return_id`(uuid), `code`(text), `name`(text), `qty`(int), `price`(num), `reason`(text), `status`(text), `created_at`(ts)

### locations
`id`(uuid), `tenant_id`(uuid), `name`(text), `zone`(text), `description`(text), `sort_order`(int), `active`(bool), `created_at`(ts), `updated_at`(ts)

### product_serials
`id`(uuid), `tenant_id`(uuid), `product_id`(uuid), `imei`(text), `status`(text), `notes`(text), `sale_id`(uuid), `created_at`(ts), `updated_at`(ts)
> `status` con CHECK: `disponible / vendido / defectuoso / devuelto`. FK a `sales(id)` por `sale_id`.

### product_variants
`id`(uuid), `tenant_id`(uuid), `product_id`(uuid), `sku`(text), `color`(text), `capacity`(text), `stock`(int), `price`(num), `cost`(num), `active`(bool), `created_at`(ts), `updated_at`(ts)

### products
`id`(uuid), `tenant_id`(uuid), `code`(text, NOT NULL), `name`(text), `category`(text), `brand`(text), `unit`(text), `stock`(int), `min_stock`(int), `price`(num), `cost`(num), `shelf`(text), `active`(bool), `created_at`(ts), `updated_at`(ts), `category_id`(uuid), `location_id`(uuid), `position`(text)

### purchase_items
`id`(uuid), `tenant_id`(uuid), `purchase_id`(uuid), `product_id`(uuid), `product_name`(text), `product_code`(text), `qty`(int), `cost`(num), `subtotal`(num)

### purchases
`id`(uuid), `tenant_id`(uuid), `supplier_id`(uuid), `supplier_name`(text), `total`(num), `notes`(text), `registered_by`(text), `created_at`(ts)

### push_subscriptions
`id`(uuid), `tenant_id`(uuid), `user_id`(uuid), `endpoint`(text), `p256dh`(text), `auth_key`(text), `created_at`(ts), `updated_at`(ts)

### refresh_tokens
`id`(uuid), `tenant_id`(uuid), `user_id`(uuid), `token_hash`(text), `expires_at`(ts), `created_at`(ts), `revoked_at`(ts)

### repairs
`id`(uuid), `tenant_id`(uuid), `rep_code`(text), `client_name`(text), `client_phone`(text), `brand`(text), `model`(text), `issue`(text), `diagnosis`(text), `status`(text), `price`(num), `advance`(num), `technician`(text), `notes`(text), `received_at`(ts), `delivered_at`(ts), `created_at`(ts), `updated_at`(ts), `client_nit`(text), `reception_checklist`(jsonb), `reception_photos`(ARRAY), `delivery_photos`(ARRAY), `final_cost`(num), `client_id`(uuid), `client_cli`(text), `imei`(text), `problem_desc`(text), `tech_name`(text), `estimated_cost`(num), `promised_date`(date), `internal_note`(text), `registrado_por`(jsonb), `parts`(jsonb)
> Estados: `recibido / en_revision / listo / entregado`. ❌ NO `client`/`device`/`en_proceso`. Repuestos en `parts` (jsonb), NO hay tabla `repair_items`. Ver "deuda técnica" arriba por columnas duplicadas.

### return_items
`id`(uuid), `tenant_id`(uuid), `return_id`(uuid), `code`(text), `name`(text), `price`(num), `qty`(int)

### returns
`id`(uuid), `tenant_id`(uuid), `sale_id`(uuid), `client`(text), `reason`(text), `refund_method`(text), `refund_amount`(num), `item_condition`(text), `total`(num), `user_id`(uuid), `created_at`(ts)

### sale_items
`id`(uuid), `tenant_id`(uuid), `sale_id`(uuid), `product_id`(uuid, nullable), `code`(text), `name`(text), `price`(num), `qty`(int), `subtotal`(num)
> `product_id` debe ir `null` para líneas de servicio (`unit==='serv'`) — staging tiene FK a `products`.

### sales
`id`(uuid), `tenant_id`(uuid), `client`(text), `total`(num), `method`(text), `status`(text), `pay_type`(text), `user_id`(uuid), `registrado_por`(jsonb), `idempotency_key`(text), `created_at`(ts), `nota`(text), `client_id`(uuid), `client_nit`(text), `fel_serie`(text), `fel_numero`(text), `fel_status`(text), `iva_percent`(num), `iva_amount`(num), `subtotal_neto`(num), `second_method`(text), `second_amount`(num)
> ❌ NO tiene `date` → usar `created_at`. IVA incluido en `iva_percent/iva_amount/subtotal_neto`. Pago dividido en `second_method/second_amount`.

### stock_movements
`id`(uuid), `tenant_id`(uuid), `product_id`(uuid), `type`(text), `qty_before`(int), `qty_change`(int), `qty_after`(int), `reason`(text), `reference_id`(text), `user_name`(text), `user_role`(text), `created_at`(ts)

### store_settings
`id`(uuid), `tenant_id`(uuid), `key`(text), `value`(text), `updated_at`(ts)
> Config por tenant clave/valor (ej. `iva_percent`).

### suppliers
`id`(uuid), `tenant_id`(uuid), `name`(text), `phone`(text), `email`(text), `address`(text), `notes`(text), `active`(bool), `created_at`(ts), `nit`(text)

### tenants
`id`(uuid), `name`(text), `plan`(text), `email`(text), `phone`(text), `owner_name`(text), `notes`(text), `active`(bool), `expires_at`(ts), `created_at`(ts), `nit`(text), `address`(text), `sat_regime`(text), `currency`(text), `fiscal_name`(text)
> Única tabla SIN `tenant_id` (ES la tabla de tenants).

### users
`id`(uuid), `tenant_id`(uuid), `name`(text), `email`(text), `password_hash`(text), `role`(text), `active`(bool), `sec_question`(text), `sec_answer_hash`(text), `last_login`(ts), `created_at`(ts), `updated_at`(ts)
> Roles: `superadmin / admin / cajero / auditor`.

### warranties
`id`(uuid), `tenant_id`(uuid), `entity_type`(text), `entity_id`(text), `client`(text), `description`(text), `start_date`(date), `end_date`(date), `status`(text), `created_by`(uuid), `created_at`(ts), `updated_at`(ts)
