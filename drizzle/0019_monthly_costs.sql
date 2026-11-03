-- Expenditure is stored in integer cents. Corrections retain the original entry.
CREATE TABLE IF NOT EXISTS cost_items (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('FIXED','VARIABLE')),
  budget_cents BIGINT NOT NULL DEFAULT 0 CHECK(budget_cents>=0),
  active INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL,
  UNIQUE(name,category)
);
CREATE TABLE IF NOT EXISTS cost_entries (
  id SERIAL PRIMARY KEY, request_key TEXT NOT NULL UNIQUE,
  item_id INTEGER NOT NULL REFERENCES cost_items(id), item_name TEXT NOT NULL,
  category TEXT NOT NULL, entry_date TEXT NOT NULL,
  amount_cents BIGINT NOT NULL CHECK(amount_cents>0), reference TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'POSTED',
  reversal_reason TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS cost_entries_month_idx ON cost_entries(entry_date,status);
CREATE TABLE IF NOT EXISTS production_cost_counts (
  period TEXT NOT NULL, product_id INTEGER NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL, unit TEXT NOT NULL,
  opening_quantity NUMERIC(18,3), opening_value_cents BIGINT,
  closing_quantity NUMERIC(18,3), closing_value_cents BIGINT,
  already_costed INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL,
  PRIMARY KEY(period,product_id)
);
CREATE TABLE IF NOT EXISTS cost_months (
  period TEXT PRIMARY KEY, initial_deferred_cents BIGINT NOT NULL DEFAULT 0,
  closing_deferred_cents BIGINT NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cost_audit (
  id SERIAL PRIMARY KEY, action TEXT NOT NULL, reference TEXT NOT NULL,
  detail TEXT NOT NULL, created_at TEXT NOT NULL
);
INSERT INTO departments (name,code,active) VALUES ('Cost of goods','COGS',1) ON CONFLICT DO NOTHING;
