import { env } from "@/lib/db";

export async function ensurePurchaseVatSchema() {
  // Null means historical VAT was never captured; do not invent or add tax to it.
  await env.DB.atomic([
    env.DB.prepare("ALTER TABLE stock_receipts ADD COLUMN IF NOT EXISTS subtotal_cents BIGINT"),
    env.DB.prepare("ALTER TABLE stock_receipts ADD COLUMN IF NOT EXISTS vat_cents BIGINT"),
    env.DB.prepare("ALTER TABLE stock_receipts ADD COLUMN IF NOT EXISTS invoice_total_cents BIGINT"),
    env.DB.prepare("ALTER TABLE stock_receipts ADD COLUMN IF NOT EXISTS purchase_vat_rate INTEGER"),
    env.DB.prepare("ALTER TABLE stock_receipt_lines ADD COLUMN IF NOT EXISTS purchase_vat_percent INTEGER"),
  ]);
}
