ALTER TABLE stock_receipts ADD COLUMN IF NOT EXISTS subtotal_cents BIGINT;
ALTER TABLE stock_receipts ADD COLUMN IF NOT EXISTS vat_cents BIGINT;
ALTER TABLE stock_receipts ADD COLUMN IF NOT EXISTS invoice_total_cents BIGINT;
ALTER TABLE stock_receipts ADD COLUMN IF NOT EXISTS purchase_vat_rate INTEGER;
ALTER TABLE stock_receipt_lines ADD COLUMN IF NOT EXISTS purchase_vat_percent INTEGER;
