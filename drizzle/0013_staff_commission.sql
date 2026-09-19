CREATE TABLE IF NOT EXISTS commission_settings (
  id INTEGER PRIMARY KEY,
  default_rate_percent DOUBLE PRECISION NOT NULL DEFAULT 5,
  calculation_basis TEXT NOT NULL DEFAULT 'EXCLUDING_VAT',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS commission_staff (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL UNIQUE REFERENCES payroll_employees(id),
  staff_code TEXT NOT NULL UNIQUE,
  custom_rate_percent DOUBLE PRECISION,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS commission_entries (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER REFERENCES pos_sales(id),
  sale_item_id INTEGER REFERENCES pos_sale_items(id),
  staff_id INTEGER NOT NULL REFERENCES commission_staff(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity DOUBLE PRECISION NOT NULL,
  gross_amount DOUBLE PRECISION NOT NULL,
  net_ex_vat DOUBLE PRECISION NOT NULL,
  rate_percent DOUBLE PRECISION NOT NULL,
  commission_amount DOUBLE PRECISION NOT NULL,
  entry_type TEXT NOT NULL DEFAULT 'EARNED',
  reference TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS commission_entries_staff_date_idx ON commission_entries(staff_id, created_at);
CREATE INDEX IF NOT EXISTS commission_entries_sale_idx ON commission_entries(sale_id, sale_item_id);

ALTER TABLE pos_sale_items ADD COLUMN IF NOT EXISTS commission_staff_id INTEGER REFERENCES commission_staff(id);
ALTER TABLE pos_sale_items ADD COLUMN IF NOT EXISTS commission_rate_percent DOUBLE PRECISION;
ALTER TABLE pos_sale_items ADD COLUMN IF NOT EXISTS commission_net_ex_vat DOUBLE PRECISION;
ALTER TABLE pos_sale_items ADD COLUMN IF NOT EXISTS commission_amount DOUBLE PRECISION;

INSERT INTO commission_settings (id, default_rate_percent, calculation_basis, updated_at)
VALUES (1, 5, 'EXCLUDING_VAT', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;
