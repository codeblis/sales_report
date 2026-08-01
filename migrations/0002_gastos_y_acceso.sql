-- 0002_gastos_y_acceso.sql — Gastos del negocio y último acceso de vendedores

CREATE TABLE IF NOT EXISTS gastos (
  id        TEXT PRIMARY KEY,
  fecha     TEXT NOT NULL,
  concepto  TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT '',
  monto     REAL NOT NULL DEFAULT 0,
  creado    TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE sellers ADD COLUMN last_login TEXT;
