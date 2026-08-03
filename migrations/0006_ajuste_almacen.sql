-- 0006_ajuste_almacen.sql — Una merma de almacén tiene que decir de cuál
--
-- Con un solo almacén bastaba con `seller_id IS NULL` para saber que la baja
-- era del almacén. Ahora que hay varios, hay que nombrarlo o la mercancía se
-- descontaría del sitio equivocado.

ALTER TABLE ajustes ADD COLUMN almacen_id TEXT REFERENCES almacenes(id);
UPDATE ajustes SET almacen_id = 'alm-cuba' WHERE seller_id IS NULL AND almacen_id IS NULL;
