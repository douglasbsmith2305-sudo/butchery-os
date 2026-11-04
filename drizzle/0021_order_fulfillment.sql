ALTER TABLE butcher_orders ADD COLUMN IF NOT EXISTS fulfillment_type TEXT NOT NULL DEFAULT 'PICKUP';
ALTER TABLE butcher_orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
