-- ============================================================
-- MUNDO CEL DIAZ — Esquema de Base de Datos
-- Compatible con: SQLite (local) y PostgreSQL (nube)
--
-- USO ACTUAL:   localStorage del navegador (estructura JSON)
-- PRÓXIMA FASE: migrar a este esquema con Node.js + Prisma ORM
--
-- Para SQLite:    sqlite3 mundoceldiaz.db < schema.sql
-- Para PostgreSQL: psql -U postgres -d mundoceldiaz -f schema.sql
-- ============================================================

-- ── 1. PRODUCTOS Y SERVICIOS ─────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id          TEXT        PRIMARY KEY,          -- UUID o nanoid
  code        TEXT        NOT NULL UNIQUE,      -- Código interno: A001, B002...
  name        TEXT        NOT NULL,             -- Nombre del producto/servicio
  category    TEXT        NOT NULL DEFAULT '',  -- Pantallas, Baterías, Servicios...
  shelf       TEXT        NOT NULL DEFAULT '',  -- Ubicación física: A-01, B-02...
  unit        TEXT        NOT NULL DEFAULT 'uni', -- uni, lb, L, serv
  price       REAL        NOT NULL DEFAULT 0,  -- Precio de venta en Q
  cost        REAL        NOT NULL DEFAULT 0,  -- Precio de costo en Q
  stock       INTEGER     NOT NULL DEFAULT 0,  -- Unidades disponibles
  created_at  TEXT        NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT        NOT NULL DEFAULT (datetime('now'))
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_products_code     ON products(code);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_shelf    ON products(shelf);


-- ── 2. VENTAS (cabecera) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
  id          TEXT        PRIMARY KEY,
  date        TEXT        NOT NULL,             -- ISO 8601: 2025-06-01T14:30:00Z
  client      TEXT        NOT NULL DEFAULT 'Cliente general',
  method      TEXT        NOT NULL DEFAULT 'Efectivo', -- Efectivo, Tarjeta, Transferencia
  total       REAL        NOT NULL DEFAULT 0,
  created_at  TEXT        NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sales_date   ON sales(date);
CREATE INDEX IF NOT EXISTS idx_sales_client ON sales(client);


-- ── 3. DETALLE DE VENTAS (líneas) ───────────────────────
CREATE TABLE IF NOT EXISTS sale_items (
  id          INTEGER     PRIMARY KEY AUTOINCREMENT,
  sale_id     TEXT        NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id  TEXT,                             -- NULL si el producto fue eliminado
  code        TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  shelf       TEXT        NOT NULL DEFAULT '',
  price       REAL        NOT NULL,
  qty         INTEGER     NOT NULL,
  subtotal    REAL        GENERATED ALWAYS AS (price * qty) STORED
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale    ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);


-- ── 4. CUENTAS POR COBRAR ───────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
  id          TEXT        PRIMARY KEY,
  date        TEXT        NOT NULL,
  client      TEXT        NOT NULL,
  method      TEXT        NOT NULL DEFAULT 'Efectivo',
  total       REAL        NOT NULL,
  paid        REAL        NOT NULL DEFAULT 0,
  balance     REAL        NOT NULL,             -- Se actualiza con cada pago
  status      TEXT        NOT NULL DEFAULT 'pendiente'
                          CHECK(status IN ('pendiente', 'parcial', 'pagado')),
  note        TEXT                 DEFAULT '',  -- Notas internas
  created_at  TEXT        NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT        NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_accounts_client ON accounts(client);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);


-- ── 5. PRODUCTOS DE CUENTAS POR COBRAR ──────────────────
CREATE TABLE IF NOT EXISTS account_items (
  id          INTEGER     PRIMARY KEY AUTOINCREMENT,
  account_id  TEXT        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  product_id  TEXT,
  code        TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  shelf       TEXT        NOT NULL DEFAULT '',
  price       REAL        NOT NULL,
  qty         INTEGER     NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_account_items_account ON account_items(account_id);


-- ── 6. PAGOS / CUOTAS DE CUENTAS ────────────────────────
CREATE TABLE IF NOT EXISTS account_payments (
  id          TEXT        PRIMARY KEY,
  account_id  TEXT        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date        TEXT        NOT NULL,
  amount      REAL        NOT NULL,
  method      TEXT        NOT NULL DEFAULT 'Efectivo',
  note        TEXT                 DEFAULT '',  -- Ej: "Cuota 1", "Pago total"
  created_at  TEXT        NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payments_account ON account_payments(account_id);
CREATE INDEX IF NOT EXISTS idx_payments_date    ON account_payments(date);


-- ── 7. DEVOLUCIONES (cabecera) ───────────────────────────
CREATE TABLE IF NOT EXISTS returns (
  id             TEXT        PRIMARY KEY,
  date           TEXT        NOT NULL,
  client         TEXT        NOT NULL DEFAULT 'Cliente general',
  reason         TEXT        NOT NULL,
  refund_method  TEXT        NOT NULL DEFAULT 'Efectivo',
  total          REAL        NOT NULL DEFAULT 0,
  created_at     TEXT        NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_returns_date   ON returns(date);
CREATE INDEX IF NOT EXISTS idx_returns_client ON returns(client);


-- ── 8. DETALLE DE DEVOLUCIONES ───────────────────────────
CREATE TABLE IF NOT EXISTS return_items (
  id          INTEGER     PRIMARY KEY AUTOINCREMENT,
  return_id   TEXT        NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  product_id  TEXT,
  code        TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  price       REAL        NOT NULL,
  qty         INTEGER     NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_return_items_return ON return_items(return_id);


-- ── 9. AUDITORÍA (para fase futura con usuarios) ─────────
-- Registra quién hizo qué y cuándo
CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER     PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT,                             -- NULL hasta implementar login
  action      TEXT        NOT NULL,             -- CREATE, UPDATE, DELETE
  table_name  TEXT        NOT NULL,             -- Tabla afectada
  record_id   TEXT        NOT NULL,             -- ID del registro
  old_values  TEXT,                             -- JSON con valores anteriores
  new_values  TEXT,                             -- JSON con valores nuevos
  created_at  TEXT        NOT NULL DEFAULT (datetime('now'))
);


-- ════════════════════════════════════════════════════════
-- VISTAS ÚTILES
-- ════════════════════════════════════════════════════════

-- Resumen de ventas por día
CREATE VIEW IF NOT EXISTS v_sales_by_day AS
SELECT
  date(date) AS sale_date,
  COUNT(*)   AS total_sales,
  SUM(total) AS revenue
FROM sales
GROUP BY date(date)
ORDER BY sale_date DESC;

-- Detalle completo de cuentas por cobrar activas
CREATE VIEW IF NOT EXISTS v_pending_accounts AS
SELECT
  a.id,
  a.date,
  a.client,
  a.total,
  a.paid,
  a.balance,
  a.status,
  COUNT(ap.id) AS payment_count
FROM accounts a
LEFT JOIN account_payments ap ON ap.account_id = a.id
WHERE a.status != 'pagado'
GROUP BY a.id
ORDER BY a.balance DESC;

-- Productos con stock bajo
CREATE VIEW IF NOT EXISTS v_low_stock AS
SELECT *
FROM products
WHERE unit != 'serv' AND stock < 5
ORDER BY stock ASC;

-- Top productos más vendidos
CREATE VIEW IF NOT EXISTS v_top_products AS
SELECT
  si.name,
  si.code,
  SUM(si.qty)       AS total_sold,
  SUM(si.subtotal)  AS total_revenue
FROM sale_items si
GROUP BY si.code, si.name
ORDER BY total_sold DESC
LIMIT 20;


-- ════════════════════════════════════════════════════════
-- DATOS INICIALES (solo para referencia del esquema)
-- Comentá este bloque si ya tenés datos importados del JSON
-- ════════════════════════════════════════════════════════
/*
INSERT INTO products (id, code, name, category, shelf, unit, price, cost, stock) VALUES
  ('p01','A001','Pantalla iPhone 11',    'Pantallas',  'A-01','uni', 450.00,280.00, 8),
  ('p02','A002','Pantalla Samsung A32',  'Pantallas',  'A-02','uni', 320.00,190.00, 5),
  ('p03','B001','Batería iPhone 11',     'Baterías',   'B-01','uni', 180.00, 90.00,12),
  ('p04','B002','Batería Samsung A32',   'Baterías',   'B-02','uni', 150.00, 75.00,10),
  ('p05','C001','Conector Type-C',       'Conectores', 'C-01','uni',  80.00, 35.00,20),
  ('p06','C002','Conector Lightning',    'Conectores', 'C-02','uni',  90.00, 40.00,15),
  ('p07','D001','Mano de obra básica',   'Servicios',  'D-01','serv', 75.00,  0.00,999),
  ('p08','D002','Mano de obra avanzada', 'Servicios',  'D-02','serv',150.00,  0.00,999),
  ('p09','E001','Vidrio templado',       'Accesorios', 'E-01','uni',  45.00, 15.00,30),
  ('p10','E002','Funda silicona',        'Accesorios', 'E-02','uni',  35.00, 12.00,25);
*/


-- ════════════════════════════════════════════════════════
-- NOTAS DE MIGRACIÓN DESDE localStorage
-- ════════════════════════════════════════════════════════
--
-- Para migrar los datos actuales del sistema:
--
-- 1. En el sistema, ir a 💾 Respaldo → Descargar respaldo .json
-- 2. Usar el script de migración: node scripts/migrate-json-to-db.js backup.json
--    (este script lo generamos cuando sea el momento)
-- 3. El script lee el JSON y hace INSERT en las tablas correspondientes
--
-- Estructura del JSON exportado:
-- {
--   "version": "2.0",
--   "negocio": "MUNDO CEL DIAZ",
--   "products":  [ { id, code, name, category, shelf, unit, price, cost, stock } ],
--   "sales":     [ { id, date, client, method, total, items: [...] } ],
--   "accounts":  [ { id, date, client, total, paid, balance, status, payments: [...] } ],
--   "returns":   [ { id, date, client, reason, refundMethod, total, items: [...] } ]
-- }
-- ============================================================
