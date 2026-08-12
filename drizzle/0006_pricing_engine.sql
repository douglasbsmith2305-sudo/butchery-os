CREATE TABLE IF NOT EXISTS price_history (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, old_price REAL NOT NULL, new_price REAL NOT NULL, reason TEXT NOT NULL, effective_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_price_history_product_effective ON price_history(product_id,effective_at);
