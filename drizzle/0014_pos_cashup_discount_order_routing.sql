ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS discount_amount DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS till_session_id INTEGER;
ALTER TABLE till_movements ADD COLUMN IF NOT EXISTS till_session_id INTEGER;

CREATE TABLE IF NOT EXISTS till_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_number TEXT NOT NULL UNIQUE,
  business_date TEXT NOT NULL,
  opening_float REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'OPEN',
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  expected_cash REAL,
  counted_cash REAL,
  variance REAL,
  cash_sales REAL NOT NULL DEFAULT 0,
  card_sales REAL NOT NULL DEFAULT 0,
  eft_sales REAL NOT NULL DEFAULT 0,
  account_sales REAL NOT NULL DEFAULT 0,
  account_payments REAL NOT NULL DEFAULT 0,
  cash_payouts REAL NOT NULL DEFAULT 0,
  cash_returns REAL NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS till_sessions_status_idx ON till_sessions(status, opened_at);

ALTER TABLE butcher_orders ADD COLUMN IF NOT EXISTS destination TEXT NOT NULL DEFAULT 'BUTCHER';
CREATE INDEX IF NOT EXISTS butcher_orders_destination_idx ON butcher_orders(destination, status, created_at);
