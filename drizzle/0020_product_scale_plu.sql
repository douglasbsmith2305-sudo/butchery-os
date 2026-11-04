-- Keep original stock-import PLUs independently of a particular scale device.
ALTER TABLE products ADD COLUMN IF NOT EXISTS scale_plu TEXT;
UPDATE products p SET scale_plu=m.plu
FROM scale_product_mappings m
WHERE m.product_id=p.id AND m.plu=p.sku AND p.scale_plu IS NULL;
