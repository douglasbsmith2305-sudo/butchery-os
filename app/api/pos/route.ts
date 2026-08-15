import { env } from "@/lib/db";

type Line = { productId: number; name: string; quantity: number; unit: string; unitPrice: number };

async function ensureSchema() {
  const db = env.DB;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, sku TEXT NOT NULL UNIQUE, barcode TEXT, name TEXT NOT NULL, department TEXT NOT NULL, unit TEXT NOT NULL DEFAULT 'each', cost_price REAL NOT NULL DEFAULT 0, selling_price REAL NOT NULL DEFAULT 0, quantity REAL NOT NULL DEFAULT 0, imported_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS customer_accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, account_number TEXT NOT NULL UNIQUE, name TEXT NOT NULL, credit_limit REAL NOT NULL DEFAULT 0, balance REAL NOT NULL DEFAULT 0, payment_terms_days INTEGER NOT NULL DEFAULT 30, status TEXT NOT NULL DEFAULT 'ACTIVE')"),
    db.prepare("ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS voucher_balance DOUBLE PRECISION NOT NULL DEFAULT 0"),
    db.prepare("CREATE TABLE IF NOT EXISTS customer_purchases (id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER NOT NULL, invoice_number TEXT NOT NULL UNIQUE, purchase_date TEXT NOT NULL, total REAL NOT NULL, balance REAL NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN', FOREIGN KEY(account_id) REFERENCES customer_accounts(id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS customer_purchase_items (id INTEGER PRIMARY KEY AUTOINCREMENT, purchase_id INTEGER NOT NULL, product_name TEXT NOT NULL, quantity REAL NOT NULL, unit TEXT NOT NULL, unit_price REAL NOT NULL, line_total REAL NOT NULL, FOREIGN KEY(purchase_id) REFERENCES customer_purchases(id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS pos_sales (id INTEGER PRIMARY KEY AUTOINCREMENT, sale_number TEXT NOT NULL UNIQUE, payment_method TEXT NOT NULL, account_number TEXT, subtotal REAL NOT NULL, total REAL NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS pos_sale_items (id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id INTEGER NOT NULL, product_id INTEGER NOT NULL, product_name TEXT NOT NULL, quantity REAL NOT NULL, unit TEXT NOT NULL, unit_price REAL NOT NULL, line_total REAL NOT NULL, FOREIGN KEY(sale_id) REFERENCES pos_sales(id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS till_movements (id INTEGER PRIMARY KEY AUTOINCREMENT, reference TEXT NOT NULL, movement_type TEXT NOT NULL, amount REAL NOT NULL, payment_method TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL)"),
  ]);
}

export async function GET() {
  await ensureSchema();
  const [products, accounts, sales, movements] = await Promise.all([
    env.DB.prepare("SELECT id, sku, barcode, name, department, unit, cost_price AS costPrice, selling_price AS sellingPrice, quantity FROM products WHERE quantity > 0 ORDER BY name LIMIT 1000").all(),
    env.DB.prepare("SELECT id, account_number AS accountNumber, name, credit_limit AS creditLimit, balance, voucher_balance AS voucherBalance, status FROM customer_accounts WHERE status='ACTIVE' ORDER BY account_number").all(),
    env.DB.prepare("SELECT id, sale_number AS saleNumber, payment_method AS paymentMethod, account_number AS accountNumber, total, status, created_at AS createdAt FROM pos_sales ORDER BY id DESC LIMIT 20").all(),
    env.DB.prepare("SELECT id, reference, movement_type AS movementType, amount, payment_method AS paymentMethod, note, created_at AS createdAt FROM till_movements ORDER BY id DESC LIMIT 100").all(),
  ]);
  const cash = (movements.results as Array<{ movementType: string; amount: number; paymentMethod: string }>).reduce((sum, item) => item.paymentMethod === "Cash" ? sum + (item.movementType === "CASH_OUT" ? -item.amount : item.amount) : sum, 0);
  return Response.json({ products: products.results, accounts: accounts.results, sales: sales.results, movements: movements.results, cashInTill: cash });
}

export async function POST(request: Request) {
  await ensureSchema();
  const payload = await request.json() as { action?: string; lines?: Line[]; paymentMethod?: string; accountNumber?: string; amount?: number; note?: string; originalSaleNumber?: string };
  const now = new Date(); const createdAt = now.toISOString(); const date = createdAt.slice(0, 10);
  if (payload.action === "SALE") {
    const lines = (payload.lines ?? []).filter(line => line.productId && line.quantity > 0 && line.unitPrice >= 0);
    const method = payload.paymentMethod ?? "Cash";
    if (!lines.length || !["Cash", "Card", "EFT", "Account"].includes(method)) return Response.json({ error: "Add products and choose a payment method" }, { status: 400 });
    let account: { id: number; accountNumber: string; balance: number; creditLimit: number; voucherBalance: number } | null = null;
    if (method === "Account") {
      account = await env.DB.prepare("SELECT id, account_number AS accountNumber, balance, credit_limit AS creditLimit, voucher_balance AS voucherBalance FROM customer_accounts WHERE account_number=? AND status='ACTIVE'").bind(payload.accountNumber?.trim()).first<{ id: number; accountNumber: string; balance: number; creditLimit: number; voucherBalance: number }>();
      if (!account) return Response.json({ error: "A valid account number is required" }, { status: 400 });
    }
    for (const line of lines) {
      const product = await env.DB.prepare("SELECT quantity FROM products WHERE id=?").bind(line.productId).first<{ quantity: number }>();
      if (!product || product.quantity < line.quantity) return Response.json({ error: `Not enough stock for ${line.name}` }, { status: 409 });
    }
    const total = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    const voucherUsed=account?Math.min(total,Math.max(0,account.voucherBalance)):0; const accountCharge=total-voucherUsed;
    if (account && account.balance + accountCharge > account.creditLimit) return Response.json({ error: "This sale exceeds the account credit limit" }, { status: 409 });
    const saleNumber = `POS-${Date.now().toString().slice(-9)}`;
    const insert = await env.DB.prepare("INSERT INTO pos_sales (sale_number, payment_method, account_number, subtotal, total, status, created_at) VALUES (?, ?, ?, ?, ?, 'PAID', ?)").bind(saleNumber, method, account?.accountNumber ?? null, total, total, createdAt).run();
    const saleId = Number(insert.meta.last_row_id);
    const statements = lines.flatMap(line => [
      env.DB.prepare("UPDATE products SET quantity=quantity-? WHERE id=? AND quantity>=?").bind(line.quantity, line.productId, line.quantity),
      env.DB.prepare("INSERT INTO pos_sale_items (sale_id, product_id, product_name, quantity, unit, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(saleId, line.productId, line.name, line.quantity, line.unit, line.unitPrice, line.quantity * line.unitPrice),
    ]);
    if (method === "Cash") statements.push(env.DB.prepare("INSERT INTO till_movements (reference, movement_type, amount, payment_method, note, created_at) VALUES (?, 'SALE', ?, 'Cash', 'Cash sale', ?)").bind(saleNumber, total, createdAt));
    await env.DB.batch(statements);
    if (account) {
      const purchase = await env.DB.prepare("INSERT INTO customer_purchases (account_id, invoice_number, purchase_date, total, balance, status) VALUES (?, ?, ?, ?, ?, ?)").bind(account.id, saleNumber, date, total, accountCharge, accountCharge>0?'OPEN':'PAID').run();
      const purchaseId = Number(purchase.meta.last_row_id);
      await env.DB.batch([env.DB.prepare("UPDATE customer_accounts SET balance=balance+?,voucher_balance=MAX(0,voucher_balance-?) WHERE id=?").bind(accountCharge,voucherUsed,account.id), ...lines.map(line => env.DB.prepare("INSERT INTO customer_purchase_items (purchase_id, product_name, quantity, unit, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?)").bind(purchaseId, line.name, line.quantity, line.unit, line.unitPrice, line.quantity * line.unitPrice))]);
    }
    return Response.json({ ok: true, saleNumber, total, voucherUsed, accountCharge });
  }
  const amount = Number(payload.amount) || 0;
  if (payload.action === "ACCOUNT_PAYMENT") {
    const account = await env.DB.prepare("SELECT id, balance FROM customer_accounts WHERE account_number=? AND status='ACTIVE'").bind(payload.accountNumber?.trim()).first<{ id: number; balance: number }>();
    if (!account || amount <= 0) return Response.json({ error: "Valid account number and amount required" }, { status: 400 });
    const reference = `PAY-${Date.now().toString().slice(-8)}`; const applied = Math.min(amount, account.balance); const method = payload.paymentMethod ?? "Cash";
    await env.DB.batch([env.DB.prepare("UPDATE customer_accounts SET balance=MAX(0,balance-?) WHERE id=?").bind(applied, account.id), env.DB.prepare("INSERT INTO till_movements (reference, movement_type, amount, payment_method, note, created_at) VALUES (?, 'ACCOUNT_PAYMENT', ?, ?, ?, ?)").bind(reference, amount, method, payload.note ?? "Account payment", createdAt)]);
    return Response.json({ ok: true, reference });
  }
  if (payload.action === "CASH_PAYOUT") {
    if (amount <= 0 || !payload.note?.trim()) return Response.json({ error: "Amount and payout reason required" }, { status: 400 });
    const reference = `OUT-${Date.now().toString().slice(-8)}`;
    await env.DB.prepare("INSERT INTO till_movements (reference, movement_type, amount, payment_method, note, created_at) VALUES (?, 'CASH_OUT', ?, 'Cash', ?, ?)").bind(reference, amount, payload.note.trim(), createdAt).run();
    return Response.json({ ok: true, reference });
  }
  if (payload.action === "RETURN") {
    const lines = payload.lines ?? []; if (!lines.length) return Response.json({ error: "Choose products to return" }, { status: 400 });
    const reference = `RET-${Date.now().toString().slice(-8)}`; const total = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0); const method = payload.paymentMethod ?? "Cash";
    await env.DB.batch([...lines.map(line => env.DB.prepare("UPDATE products SET quantity=quantity+? WHERE id=?").bind(line.quantity, line.productId)), env.DB.prepare("INSERT INTO till_movements (reference, movement_type, amount, payment_method, note, created_at) VALUES (?, 'RETURN', ?, ?, ?, ?)").bind(reference, total, method, payload.originalSaleNumber ?? "Customer return", createdAt)]);
    return Response.json({ ok: true, reference });
  }
  return Response.json({ error: "Unknown POS action" }, { status: 400 });
}
