ALTER TABLE products ADD COLUMN IF NOT EXISTS target_margin_percent DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE products
SET target_margin_percent = CASE
  WHEN selling_price > cost_price AND selling_price > 0
    THEN ((selling_price - cost_price) / selling_price) * 100
  ELSE 30
END
WHERE target_margin_percent <= 0;

CREATE TABLE IF NOT EXISTS price_decrease_approvals (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  receipt_number TEXT NOT NULL,
  old_price DOUBLE PRECISION NOT NULL,
  proposed_price DOUBLE PRECISION NOT NULL,
  old_cost DOUBLE PRECISION NOT NULL,
  new_cost DOUBLE PRECISION NOT NULL,
  target_margin_percent DOUBLE PRECISION NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  requested_at TEXT NOT NULL,
  decided_at TEXT
);

CREATE INDEX IF NOT EXISTS price_decrease_status_idx
  ON price_decrease_approvals(status, requested_at);
