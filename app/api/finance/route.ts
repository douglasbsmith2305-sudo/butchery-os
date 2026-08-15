import { env } from "@/lib/db";

async function ensureFinanceSchema() {
  const db = env.DB;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS suppliers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, payment_terms_days INTEGER NOT NULL DEFAULT 7, contact TEXT, active INTEGER NOT NULL DEFAULT 1)"),
    db.prepare("CREATE TABLE IF NOT EXISTS supplier_invoices (id INTEGER PRIMARY KEY AUTOINCREMENT, supplier_id INTEGER NOT NULL, invoice_number TEXT NOT NULL UNIQUE, delivery_date TEXT NOT NULL, due_date TEXT NOT NULL, amount REAL NOT NULL, balance REAL NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN', created_at TEXT NOT NULL, FOREIGN KEY(supplier_id) REFERENCES suppliers(id))"),
    db.prepare("CREATE INDEX IF NOT EXISTS supplier_invoice_due_idx ON supplier_invoices(due_date, status)"),
    db.prepare("CREATE TABLE IF NOT EXISTS financial_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, reference TEXT NOT NULL UNIQUE, transaction_type TEXT NOT NULL, account_name TEXT NOT NULL, amount REAL NOT NULL, reason TEXT NOT NULL, payment_method TEXT, created_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS customer_accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, account_number TEXT NOT NULL UNIQUE, name TEXT NOT NULL, credit_limit REAL NOT NULL DEFAULT 0, balance REAL NOT NULL DEFAULT 0, payment_terms_days INTEGER NOT NULL DEFAULT 30, status TEXT NOT NULL DEFAULT 'ACTIVE')"),
    db.prepare("CREATE TABLE IF NOT EXISTS customer_purchases (id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER NOT NULL, invoice_number TEXT NOT NULL UNIQUE, purchase_date TEXT NOT NULL, total REAL NOT NULL, balance REAL NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN', FOREIGN KEY(account_id) REFERENCES customer_accounts(id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS customer_purchase_items (id INTEGER PRIMARY KEY AUTOINCREMENT, purchase_id INTEGER NOT NULL, product_name TEXT NOT NULL, quantity REAL NOT NULL, unit TEXT NOT NULL, unit_price REAL NOT NULL, line_total REAL NOT NULL, FOREIGN KEY(purchase_id) REFERENCES customer_purchases(id))"),
  ]);
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO suppliers (name, payment_terms_days, contact, active) VALUES ('Karoo Prime Meats', 7, 'accounts@karoo.example', 1)"),
    db.prepare("INSERT OR IGNORE INTO suppliers (name, payment_terms_days, contact, active) VALUES ('Highveld Beef Co.', 14, '', 1)"),
    db.prepare("INSERT OR IGNORE INTO suppliers (name, payment_terms_days, contact, active) VALUES ('Lowveld Livestock', 30, '', 1)"),
  ]);
  const supplier = await db.prepare("SELECT id FROM suppliers WHERE name = 'Karoo Prime Meats'").first<{ id: number }>();
  if (supplier) await db.prepare("INSERT OR IGNORE INTO supplier_invoices (supplier_id, invoice_number, delivery_date, due_date, amount, balance, status, created_at) VALUES (?, 'KPM-68142', '2026-08-07', '2026-08-13', 66240, 66240, 'OPEN', '2026-08-07T07:42:00.000Z')").bind(supplier.id).run();
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO customer_accounts (account_number, name, credit_limit, balance, payment_terms_days, status) VALUES ('ACC-1001', 'Mokoena Family Store', 25000, 6842.55, 30, 'ACTIVE')"),
    db.prepare("INSERT OR IGNORE INTO customer_accounts (account_number, name, credit_limit, balance, payment_terms_days, status) VALUES ('ACC-1002', 'Thabo Nkosi', 10000, 2147.90, 30, 'ACTIVE')"),
    db.prepare("INSERT OR IGNORE INTO customer_accounts (account_number, name, credit_limit, balance, payment_terms_days, status) VALUES ('ACC-1003', 'Die Plaaskombuis', 40000, 12784.20, 14, 'ACTIVE')"),
  ]);
  const account = await db.prepare("SELECT id FROM customer_accounts WHERE account_number='ACC-1001'").first<{ id: number }>();
  if (account) {
    await db.batch([
      db.prepare("INSERT OR IGNORE INTO customer_purchases (account_id, invoice_number, purchase_date, total, balance, status) VALUES (?, 'INV-240812-1842', '2026-08-12', 3274.65, 3274.65, 'OPEN')").bind(account.id),
      db.prepare("INSERT OR IGNORE INTO customer_purchases (account_id, invoice_number, purchase_date, total, balance, status) VALUES (?, 'INV-240805-1631', '2026-08-05', 3567.90, 3567.90, 'OPEN')").bind(account.id),
    ]);
    const purchase = await db.prepare("SELECT id FROM customer_purchases WHERE invoice_number='INV-240812-1842'").first<{ id: number }>();
    if (purchase) await db.batch([
      db.prepare("INSERT OR IGNORE INTO customer_purchase_items (id, purchase_id, product_name, quantity, unit, unit_price, line_total) VALUES (10001, ?, 'Bees Rump', 8.4, 'kg', 169.99, 1427.92)").bind(purchase.id),
      db.prepare("INSERT OR IGNORE INTO customer_purchase_items (id, purchase_id, product_name, quantity, unit, unit_price, line_total) VALUES (10002, ?, 'Hoender Heel', 12, 'each', 89.99, 1079.88)").bind(purchase.id),
      db.prepare("INSERT OR IGNORE INTO customer_purchase_items (id, purchase_id, product_name, quantity, unit, unit_price, line_total) VALUES (10003, ?, 'Droëwors', 3.2, 'kg', 239.64, 766.85)").bind(purchase.id),
    ]);
  }
}

export async function GET() {
  await ensureFinanceSchema();
  const [suppliers, invoices, transactions, accounts, purchases, purchaseItems] = await Promise.all([
    env.DB.prepare("SELECT id, name, payment_terms_days AS paymentTermsDays, contact, active FROM suppliers ORDER BY name").all(),
    env.DB.prepare("SELECT i.id, i.invoice_number AS invoiceNumber, i.delivery_date AS deliveryDate, i.due_date AS dueDate, i.amount, i.balance, i.status, s.id AS supplierId, s.name AS supplierName, s.payment_terms_days AS paymentTermsDays FROM supplier_invoices i JOIN suppliers s ON s.id=i.supplier_id ORDER BY i.due_date, i.id").all(),
    env.DB.prepare("SELECT id, reference, transaction_type AS transactionType, account_name AS accountName, amount, reason, payment_method AS paymentMethod, created_at AS createdAt FROM financial_transactions ORDER BY id DESC LIMIT 100").all(),
    env.DB.prepare("SELECT id, account_number AS accountNumber, name, credit_limit AS creditLimit, balance, payment_terms_days AS paymentTermsDays, status FROM customer_accounts ORDER BY name").all(),
    env.DB.prepare("SELECT id, account_id AS accountId, invoice_number AS invoiceNumber, purchase_date AS purchaseDate, total, balance, status FROM customer_purchases ORDER BY purchase_date DESC, id DESC").all(),
    env.DB.prepare("SELECT id, purchase_id AS purchaseId, product_name AS productName, quantity, unit, unit_price AS unitPrice, line_total AS lineTotal FROM customer_purchase_items ORDER BY id").all(),
  ]);
  return Response.json({ suppliers: suppliers.results, invoices: invoices.results, transactions: transactions.results, accounts: accounts.results, purchases: purchases.results, purchaseItems: purchaseItems.results });
}

type Payload = { action?: string; name?: string; paymentTermsDays?: number; contact?: string; supplierId?: number; invoiceNumber?: string; deliveryDate?: string; amount?: number; transactionType?: string; accountName?: string; reason?: string; paymentMethod?: string };
const addInclusiveTerms = (date: string, days: number) => { const result = new Date(`${date}T12:00:00Z`); result.setUTCDate(result.getUTCDate() + Math.max(1, days) - 1); return result.toISOString().slice(0, 10); };

export async function POST(request: Request) {
  await ensureFinanceSchema(); const payload = await request.json() as Payload;
  if (payload.action === "supplier") {
    const name = payload.name?.trim(); const terms = Math.max(1, Number(payload.paymentTermsDays) || 7);
    if (!name) return Response.json({ error: "Supplier name is required" }, { status: 400 });
    await env.DB.prepare("INSERT INTO suppliers (name, payment_terms_days, contact, active) VALUES (?, ?, ?, 1) ON CONFLICT(name) DO UPDATE SET payment_terms_days=excluded.payment_terms_days, contact=excluded.contact").bind(name, terms, payload.contact?.trim() || "").run();
    return Response.json({ ok: true });
  }
  if (payload.action === "invoice") {
    const amount = Number(payload.amount) || 0; const delivery = payload.deliveryDate ?? "";
    const supplier = await env.DB.prepare("SELECT id, payment_terms_days AS paymentTermsDays FROM suppliers WHERE id=?").bind(payload.supplierId).first<{ id: number; paymentTermsDays: number }>();
    if (!supplier || !payload.invoiceNumber?.trim() || !delivery || amount <= 0) return Response.json({ error: "Supplier, invoice number, delivery date and amount are required" }, { status: 400 });
    const dueDate = addInclusiveTerms(delivery, supplier.paymentTermsDays);
    await env.DB.prepare("INSERT INTO supplier_invoices (supplier_id, invoice_number, delivery_date, due_date, amount, balance, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?)").bind(supplier.id, payload.invoiceNumber.trim(), delivery, dueDate, amount, amount, new Date().toISOString()).run();
    return Response.json({ ok: true, dueDate });
  }
  const allowed = ["ACCOUNT_SALE", "CREDIT_NOTE", "DEBIT_NOTE", "RETURN", "ACCOUNT_PAYMENT", "CASH_PAYOUT"];
  if (!allowed.includes(payload.transactionType ?? "")) return Response.json({ error: "Choose a valid transaction type" }, { status: 400 });
  const amount = Number(payload.amount) || 0;
  if (!payload.accountName?.trim() || amount <= 0 || !payload.reason?.trim()) return Response.json({ error: "Account, amount and reason are required" }, { status: 400 });
  const prefix: Record<string, string> = { ACCOUNT_SALE: "ACC", CREDIT_NOTE: "CRN", DEBIT_NOTE: "DBN", RETURN: "RET", ACCOUNT_PAYMENT: "PAY", CASH_PAYOUT: "OUT" };
  const reference = `${prefix[payload.transactionType!]}-${Date.now().toString().slice(-8)}`;
  await env.DB.prepare("INSERT INTO financial_transactions (reference, transaction_type, account_name, amount, reason, payment_method, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(reference, payload.transactionType, payload.accountName.trim(), amount, payload.reason.trim(), payload.paymentMethod?.trim() || null, new Date().toISOString()).run();
  return Response.json({ ok: true, reference });
}
