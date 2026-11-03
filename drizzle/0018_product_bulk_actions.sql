ALTER TABLE products ADD COLUMN IF NOT EXISTS active INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS products_active_department_idx
  ON products(active, department);
