-- 0001_init.sql — Sistema de distribución mercantil

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sellers (
  id       TEXT PRIMARY KEY,
  nombre   TEXT NOT NULL,
  telefono TEXT NOT NULL DEFAULT '',
  pin_hash TEXT NOT NULL,
  token    TEXT NOT NULL UNIQUE,
  activo   INTEGER NOT NULL DEFAULT 1,
  creado   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id        TEXT PRIMARY KEY,
  codigo    TEXT NOT NULL DEFAULT '',
  nombre    TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT '',
  costo     REAL NOT NULL DEFAULT 0,
  precio    REAL NOT NULL DEFAULT 0,
  activo    INTEGER NOT NULL DEFAULT 1,
  creado    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchases (
  id     TEXT PRIMARY KEY,
  fecha  TEXT NOT NULL,
  nota   TEXT NOT NULL DEFAULT '',
  creado TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_items (
  purchase_id TEXT NOT NULL REFERENCES purchases(id),
  product_id  TEXT NOT NULL REFERENCES products(id),
  cantidad    REAL NOT NULL,
  costo       REAL NOT NULL,
  PRIMARY KEY (purchase_id, product_id)
);

CREATE TABLE IF NOT EXISTS assignments (
  id        TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES sellers(id),
  fecha     TEXT NOT NULL,
  nota      TEXT NOT NULL DEFAULT '',
  creado    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assignment_items (
  assignment_id TEXT NOT NULL REFERENCES assignments(id),
  product_id    TEXT NOT NULL REFERENCES products(id),
  cantidad      REAL NOT NULL,
  precio        REAL NOT NULL,
  costo         REAL NOT NULL,
  PRIMARY KEY (assignment_id, product_id)
);

CREATE TABLE IF NOT EXISTS cortes (
  id        TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES sellers(id),
  fecha     TEXT NOT NULL,
  nota      TEXT NOT NULL DEFAULT '',
  creado    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS corte_items (
  corte_id   TEXT NOT NULL REFERENCES cortes(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  cantidad   REAL NOT NULL,
  precio     REAL NOT NULL,
  costo      REAL NOT NULL,
  PRIMARY KEY (corte_id, product_id)
);

CREATE TABLE IF NOT EXISTS sales (
  id            TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  product_id    TEXT NOT NULL,
  cantidad      REAL NOT NULL,
  fecha         TEXT NOT NULL,
  corte_id      TEXT DEFAULT NULL,
  creado        TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (assignment_id, product_id) REFERENCES assignment_items(assignment_id, product_id),
  FOREIGN KEY (corte_id) REFERENCES cortes(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id        TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES sellers(id),
  corte_id  TEXT DEFAULT NULL REFERENCES cortes(id),
  monto     REAL NOT NULL,
  fecha     TEXT NOT NULL,
  nota      TEXT NOT NULL DEFAULT '',
  creado    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS retiros (
  id        TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES sellers(id),
  fecha     TEXT NOT NULL,
  destino   TEXT NOT NULL DEFAULT 'almacen',
  nota      TEXT NOT NULL DEFAULT '',
  creado    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS retiro_items (
  retiro_id     TEXT NOT NULL REFERENCES retiros(id),
  assignment_id TEXT NOT NULL,
  product_id    TEXT NOT NULL REFERENCES products(id),
  cantidad      REAL NOT NULL,
  PRIMARY KEY (retiro_id, assignment_id, product_id),
  FOREIGN KEY (assignment_id, product_id) REFERENCES assignment_items(assignment_id, product_id)
);

CREATE TABLE IF NOT EXISTS ajustes (
  id        TEXT PRIMARY KEY,
  seller_id TEXT DEFAULT NULL REFERENCES sellers(id),
  fecha     TEXT NOT NULL,
  nota      TEXT NOT NULL DEFAULT '',
  creado    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ajuste_items (
  ajuste_id     TEXT NOT NULL REFERENCES ajustes(id),
  assignment_id TEXT DEFAULT NULL,
  product_id    TEXT NOT NULL REFERENCES products(id),
  cantidad      REAL NOT NULL,
  PRIMARY KEY (ajuste_id, product_id),
  FOREIGN KEY (assignment_id, product_id) REFERENCES assignment_items(assignment_id, product_id)
);

CREATE TABLE IF NOT EXISTS login_attempts (
  ip TEXT NOT NULL,
  ts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assignments_seller ON assignments(seller_id);
CREATE INDEX IF NOT EXISTS idx_assignment_items_product ON assignment_items(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON purchase_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_assignment ON sales(assignment_id);
CREATE INDEX IF NOT EXISTS idx_sales_corte ON sales(corte_id);
CREATE INDEX IF NOT EXISTS idx_sales_fecha ON sales(fecha);
CREATE INDEX IF NOT EXISTS idx_cortes_seller ON cortes(seller_id);
CREATE INDEX IF NOT EXISTS idx_payments_seller ON payments(seller_id);
CREATE INDEX IF NOT EXISTS idx_retiros_seller ON retiros(seller_id);
CREATE INDEX IF NOT EXISTS idx_ajustes_seller ON ajustes(seller_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip, ts);
