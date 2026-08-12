CREATE TABLE IF NOT EXISTS waste_records (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, product_name TEXT NOT NULL, quantity REAL NOT NULL, reason TEXT NOT NULL, value REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS stock_counts (id INTEGER PRIMARY KEY AUTOINCREMENT, count_number TEXT NOT NULL, product_id INTEGER NOT NULL, product_name TEXT NOT NULL, expected_quantity REAL NOT NULL, counted_quantity REAL NOT NULL, variance REAL NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS business_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS waste_created_idx ON waste_records(created_at);
CREATE INDEX IF NOT EXISTS stock_counts_created_idx ON stock_counts(created_at);
