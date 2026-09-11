ALTER TABLE products ADD COLUMN IF NOT EXISTS block_test_profile_code TEXT;

CREATE TABLE IF NOT EXISTS block_test_allocations (
  id SERIAL PRIMARY KEY,
  receipt_id INTEGER NOT NULL REFERENCES stock_receipts(id),
  input_product_id INTEGER NOT NULL REFERENCES products(id),
  output_product_id INTEGER NOT NULL REFERENCES products(id),
  profile_code TEXT NOT NULL,
  baseline_percent DOUBLE PRECISION NOT NULL,
  expected_quantity DOUBLE PRECISION NOT NULL,
  low_quantity DOUBLE PRECISION NOT NULL,
  high_quantity DOUBLE PRECISION NOT NULL,
  cost_per_kg DOUBLE PRECISION NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS block_test_allocation_receipt_idx
  ON block_test_allocations(receipt_id, profile_code);
