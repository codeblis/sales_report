-- 0003_ajuste_items_pk.sql — Un ajuste reparte la cantidad entre asignaciones
--
-- La clave (ajuste_id, product_id) solo admitía una fila por producto, pero un
-- ajuste a un vendedor con el mismo producto en dos asignaciones necesita una
-- fila por asignación para descontar de la línea correcta. La clave pasa a
-- incluir assignment_id (NULL en los ajustes de almacén, que van en una sola fila).

CREATE TABLE ajuste_items_nuevo (
  ajuste_id     TEXT NOT NULL REFERENCES ajustes(id),
  assignment_id TEXT DEFAULT NULL,
  product_id    TEXT NOT NULL REFERENCES products(id),
  cantidad      REAL NOT NULL,
  PRIMARY KEY (ajuste_id, product_id, assignment_id),
  FOREIGN KEY (assignment_id, product_id) REFERENCES assignment_items(assignment_id, product_id)
);

INSERT INTO ajuste_items_nuevo (ajuste_id, assignment_id, product_id, cantidad)
  SELECT ajuste_id, assignment_id, product_id, cantidad FROM ajuste_items;

DROP TABLE ajuste_items;

ALTER TABLE ajuste_items_nuevo RENAME TO ajuste_items;

CREATE INDEX IF NOT EXISTS idx_ajuste_items_ajuste ON ajuste_items(ajuste_id);
