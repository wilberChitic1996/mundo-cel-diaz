const BetterSqlite3 = require('better-sqlite3');

// Base de datos SQLite con patrón key-value
// Esto permite usar exactamente la misma API que localStorage en React
// sin modificar la lógica de negocio. Migración futura a tablas normalizadas
// se puede hacer gradualmente sin romper nada.

class Database {
  constructor(dbPath) {
    this.db = new BetterSqlite3(dbPath);
    this.init();
  }

  init() {
    // Tabla principal key-value
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS data_store (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Índice para búsquedas rápidas por key
      CREATE INDEX IF NOT EXISTS idx_data_store_key ON data_store(key);

      -- Tabla de auditoría — registra cada cambio importante
      CREATE TABLE IF NOT EXISTS audit_log (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        action     TEXT NOT NULL,
        key        TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);

    console.log('SQLite inicializado correctamente');
  }

  // ── Operaciones principales ────────────────────────────────────────

  // Lee un valor. Si no existe, retorna el fallback.
  getValue(key, fallback = null) {
    try {
      const row = this.db
        .prepare('SELECT value FROM data_store WHERE key = ?')
        .get(key);

      if (!row) return fallback;
      return JSON.parse(row.value);
    } catch (err) {
      console.error('DB getValue error:', key, err.message);
      return fallback;
    }
  }

  // Guarda un valor. Crea o actualiza (UPSERT).
  setValue(key, value) {
    try {
      this.db
        .prepare(`
          INSERT INTO data_store (key, value, updated_at)
          VALUES (?, ?, datetime('now'))
          ON CONFLICT(key) DO UPDATE SET
            value      = excluded.value,
            updated_at = excluded.updated_at
        `)
        .run(key, JSON.stringify(value));

      return true;
    } catch (err) {
      console.error('DB setValue error:', key, err.message);
      return false;
    }
  }

  // Lista todas las claves guardadas
  getAllKeys() {
    try {
      return this.db
        .prepare('SELECT key, updated_at FROM data_store ORDER BY updated_at DESC')
        .all();
    } catch (err) {
      console.error('DB getAllKeys error:', err.message);
      return [];
    }
  }

  // ── Utilidades ─────────────────────────────────────────────────────

  // Exporta todos los datos (para respaldo)
  exportAll() {
    try {
      const rows = this.db
        .prepare('SELECT key, value FROM data_store')
        .all();

      const result = {};
      rows.forEach(row => {
        try { result[row.key] = JSON.parse(row.value); }
        catch { result[row.key] = row.value; }
      });
      return result;
    } catch (err) {
      console.error('DB exportAll error:', err.message);
      return {};
    }
  }

  // Cierra la conexión limpiamente
  close() {
    this.db.close();
  }
}

module.exports = Database;
