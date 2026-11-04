-- Leave historical orders undated rather than inventing a completion date.
ALTER TABLE butcher_orders ADD COLUMN IF NOT EXISTS requested_date TEXT;
