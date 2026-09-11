CREATE TABLE IF NOT EXISTS stock_receipts (
  id SERIAL PRIMARY KEY,
  receipt_number TEXT NOT NULL UNIQUE,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  supplier_name TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  delivery_date TEXT NOT NULL,
  notes TEXT,
  total_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS stock_receipts_supplier_invoice_idx
  ON stock_receipts(supplier_id, invoice_number);

CREATE TABLE IF NOT EXISTS stock_receipt_lines (
  id SERIAL PRIMARY KEY,
  receipt_id INTEGER NOT NULL REFERENCES stock_receipts(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  department TEXT NOT NULL,
  quantity DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL,
  cost_price DOUBLE PRECISION NOT NULL DEFAULT 0,
  line_total DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS stock_receipt_lines_receipt_idx ON stock_receipt_lines(receipt_id);

CREATE TABLE IF NOT EXISTS stock_ledger_entries (
  id SERIAL PRIMARY KEY,
  reference TEXT NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL,
  movement_type TEXT NOT NULL,
  direction TEXT NOT NULL,
  source TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS stock_ledger_product_idx ON stock_ledger_entries(product_id, created_at);
