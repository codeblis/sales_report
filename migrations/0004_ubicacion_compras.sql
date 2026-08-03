-- 0004_ubicacion_compras.sql — La mercancía se compra en dos sitios
--
-- El negocio compra en Estados Unidos y también en Cuba, y de ahí sale hacia
-- los vendedores. Hasta ahora solo existía "el almacén", sin decir cuál, así
-- que no había forma de saber dónde estaba realmente cada unidad.
--
-- Lo ya registrado se da por comprado en Estados Unidos, que es como venía
-- funcionando.

ALTER TABLE purchases ADD COLUMN ubicacion TEXT NOT NULL DEFAULT 'eeuu';

CREATE INDEX IF NOT EXISTS idx_purchases_ubicacion ON purchases(ubicacion);
