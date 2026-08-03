-- 0005_almacenes_y_envios.sql — La cadena Estados Unidos → Cuba → vendedor
--
-- La mercancía se compra en Estados Unidos o en Cuba, viaja en paquetes hasta
-- Cuba con un costo de envío propio, y allí se reparte entre almacenes y
-- vendedores, donde cada movimiento vuelve a costar dinero.
--
-- Esos costos NO se reparten dentro del costo unitario de la mercancía: cada
-- paquete cuesta lo suyo y no toda la mercancía viaja junta, así que repartirlo
-- uniformemente mentiría sobre el costo de cada producto. Se restan aparte al
-- calcular la ganancia, igual que los gastos.

-- ---------- Almacenes ----------
-- Se modela como tabla y no como dos valores fijos porque el negocio ya traspasa
-- "de un almacén a otro": mañana puede haber más de uno en Cuba.
CREATE TABLE IF NOT EXISTS almacenes (
  id     TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  pais   TEXT NOT NULL,              -- 'eeuu' | 'cuba'
  activo INTEGER NOT NULL DEFAULT 1,
  creado TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO almacenes (id, nombre, pais) VALUES
  ('alm-eeuu', 'Almacén de Estados Unidos', 'eeuu'),
  ('alm-cuba', 'Almacén de Cuba', 'cuba');

-- ---------- De qué almacén habla cada compra ----------
ALTER TABLE purchases ADD COLUMN almacen_id TEXT REFERENCES almacenes(id);
UPDATE purchases SET almacen_id = CASE ubicacion WHEN 'cuba' THEN 'alm-cuba' ELSE 'alm-eeuu' END;

-- ---------- Envíos entre almacenes, o de un almacén a un vendedor ----------
-- `estado` distingue lo embarcado de lo llegado: mientras viaja no está ni en
-- origen ni en destino, y saberlo es justo el motivo de tener esta tabla.
CREATE TABLE IF NOT EXISTS envios (
  id            TEXT PRIMARY KEY,
  fecha         TEXT NOT NULL,
  origen_id     TEXT NOT NULL REFERENCES almacenes(id),
  destino_tipo  TEXT NOT NULL,       -- 'almacen' | 'vendedor'
  destino_id    TEXT NOT NULL,
  costo         REAL NOT NULL DEFAULT 0,
  nota          TEXT NOT NULL DEFAULT '',
  estado        TEXT NOT NULL DEFAULT 'transito',   -- 'transito' | 'recibido'
  fecha_llegada TEXT DEFAULT NULL,
  creado        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- `precio` solo se usa cuando el destino es un vendedor: al recibirse se crea su
-- asignación y hay que saber a cuánto vende.
CREATE TABLE IF NOT EXISTS envio_items (
  envio_id   TEXT NOT NULL REFERENCES envios(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  cantidad   REAL NOT NULL,
  precio     REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (envio_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_envios_estado ON envios(estado);
CREATE INDEX IF NOT EXISTS idx_envio_items_envio ON envio_items(envio_id);

-- ---------- Costo de distribución en los movimientos que ya existían ----------
-- Entregar a un vendedor y recoger o traspasar también cuesta, y hasta ahora no
-- había dónde anotarlo.
ALTER TABLE assignments ADD COLUMN costo_distribucion REAL NOT NULL DEFAULT 0;
ALTER TABLE assignments ADD COLUMN almacen_id TEXT REFERENCES almacenes(id);
UPDATE assignments SET almacen_id = 'alm-cuba' WHERE almacen_id IS NULL;

ALTER TABLE retiros ADD COLUMN costo_distribucion REAL NOT NULL DEFAULT 0;
ALTER TABLE retiros ADD COLUMN destino_almacen_id TEXT REFERENCES almacenes(id);
UPDATE retiros SET destino_almacen_id = 'alm-cuba' WHERE destino = 'almacen';
