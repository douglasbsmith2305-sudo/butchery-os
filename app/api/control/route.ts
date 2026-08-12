import { env } from "cloudflare:workers";

async function ensureSchema() {
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS waste_records (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, product_name TEXT NOT NULL, quantity REAL NOT NULL, reason TEXT NOT NULL, value REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS stock_counts (id INTEGER PRIMARY KEY AUTOINCREMENT, count_number TEXT NOT NULL, product_id INTEGER NOT NULL, product_name TEXT NOT NULL, expected_quantity REAL NOT NULL, counted_quantity REAL NOT NULL, variance REAL NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS business_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)"),
  ]);
  await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO business_settings (key,value,updated_at) VALUES ('business_name','George''s Butchery',?)").bind(new Date().toISOString()),
    env.DB.prepare("INSERT OR IGNORE INTO business_settings (key,value,updated_at) VALUES ('yield_tolerance','2',?)").bind(new Date().toISOString()),
    env.DB.prepare("INSERT OR IGNORE INTO business_settings (key,value,updated_at) VALUES ('vat_rate','15',?)").bind(new Date().toISOString()),
    env.DB.prepare("INSERT OR IGNORE INTO business_settings (key,value,updated_at) VALUES ('default_terms','30',?)").bind(new Date().toISOString()),
    env.DB.prepare("INSERT OR IGNORE INTO business_settings (key,value,updated_at) VALUES ('low_stock_threshold','5',?)").bind(new Date().toISOString()),
    env.DB.prepare("INSERT OR IGNORE INTO business_settings (key,value,updated_at) VALUES ('order_lead_time','60',?)").bind(new Date().toISOString()),
    env.DB.prepare("INSERT OR IGNORE INTO business_settings (key,value,updated_at) VALUES ('receipt_footer','Thank you for supporting George''s Butchery',?)").bind(new Date().toISOString()),
  ]);
}

export async function GET() {
  await ensureSchema();
  const [products, wastes, counts, settings, sales, supplierInvoices] = await Promise.all([
    env.DB.prepare("SELECT id,sku,barcode,name,department,unit,cost_price AS costPrice,selling_price AS sellingPrice,quantity FROM products ORDER BY name").all(),
    env.DB.prepare("SELECT id,product_id AS productId,product_name AS productName,quantity,reason,value,created_at AS createdAt FROM waste_records ORDER BY id DESC LIMIT 100").all(),
    env.DB.prepare("SELECT id,count_number AS countNumber,product_id AS productId,product_name AS productName,expected_quantity AS expectedQuantity,counted_quantity AS countedQuantity,variance,reason,created_at AS createdAt FROM stock_counts ORDER BY id DESC LIMIT 100").all(),
    env.DB.prepare("SELECT key,value FROM business_settings ORDER BY key").all(),
    env.DB.prepare("SELECT total,payment_method AS paymentMethod,status,created_at AS createdAt FROM pos_sales ORDER BY id DESC LIMIT 1000").all(),
    env.DB.prepare("SELECT amount,balance,status,due_date AS dueDate FROM supplier_invoices ORDER BY id DESC LIMIT 1000").all(),
  ]);
  const productRows = products.results as Array<{ quantity: number; costPrice: number; sellingPrice: number }>;
  const saleRows = sales.results as Array<{ total: number; status: string }>;
  const wasteRows = wastes.results as Array<{ quantity: number; value: number }>;
  const invoiceRows = supplierInvoices.results as Array<{ balance: number; status: string }>;
  return Response.json({ products: products.results, wastes: wastes.results, counts: counts.results, settings: Object.fromEntries((settings.results as Array<{ key: string; value: string }>).map(item => [item.key, item.value])), report: { revenue: saleRows.filter(s => s.status === "PAID").reduce((sum, sale) => sum + sale.total, 0), stockValue: productRows.reduce((sum, product) => sum + product.quantity * product.costPrice, 0), retailValue: productRows.reduce((sum, product) => sum + product.quantity * product.sellingPrice, 0), wasteKg: wasteRows.reduce((sum, waste) => sum + waste.quantity, 0), wasteValue: wasteRows.reduce((sum, waste) => sum + waste.value, 0), supplierBalance: invoiceRows.filter(i => i.status === "OPEN").reduce((sum, invoice) => sum + invoice.balance, 0), productCount: productRows.length } });
}

export async function POST(request: Request) {
  await ensureSchema();
  const payload = await request.json() as { action?: string; productId?: number; quantity?: number; countedQuantity?: number; reason?: string; settings?: Record<string,string> };
  const now = new Date().toISOString();
  if (payload.action === "waste") {
    const product = await env.DB.prepare("SELECT id,name,quantity,cost_price AS costPrice FROM products WHERE id=?").bind(payload.productId).first<{ id: number; name: string; quantity: number; costPrice: number }>(); const quantity = Number(payload.quantity) || 0;
    if (!product || quantity <= 0 || quantity > product.quantity || !payload.reason?.trim()) return Response.json({ error: "Product, available quantity and reason are required" }, { status: 400 });
    await env.DB.batch([env.DB.prepare("UPDATE products SET quantity=quantity-? WHERE id=? AND quantity>=?").bind(quantity, product.id, quantity), env.DB.prepare("INSERT INTO waste_records (product_id,product_name,quantity,reason,value,created_at) VALUES (?,?,?,?,?,?)").bind(product.id, product.name, quantity, payload.reason.trim(), quantity * product.costPrice, now)]);
    return Response.json({ ok: true, reference: `WST-${Date.now().toString().slice(-8)}` });
  }
  if (payload.action === "stock_count") {
    const product = await env.DB.prepare("SELECT id,name,quantity FROM products WHERE id=?").bind(payload.productId).first<{ id: number; name: string; quantity: number }>(); const counted = Number(payload.countedQuantity);
    if (!product || counted < 0 || !payload.reason?.trim()) return Response.json({ error: "Product, counted quantity and reason are required" }, { status: 400 });
    const countNumber = `CNT-${Date.now().toString().slice(-8)}`; const variance = counted - product.quantity;
    await env.DB.batch([env.DB.prepare("UPDATE products SET quantity=? WHERE id=?").bind(counted, product.id), env.DB.prepare("INSERT INTO stock_counts (count_number,product_id,product_name,expected_quantity,counted_quantity,variance,reason,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(countNumber, product.id, product.name, product.quantity, counted, variance, payload.reason.trim(), now)]);
    return Response.json({ ok: true, reference: countNumber, variance });
  }
  if (payload.action === "settings") {
    const allowed = ["business_name","yield_tolerance","vat_rate","default_terms","low_stock_threshold","order_lead_time","receipt_footer"]; const entries = Object.entries(payload.settings ?? {}).filter(([key]) => allowed.includes(key));
    if (!entries.length) return Response.json({ error: "No settings supplied" }, { status: 400 });
    await env.DB.batch(entries.map(([key,value]) => env.DB.prepare("INSERT INTO business_settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(key, String(value), now)));
    return Response.json({ ok: true, reference: "SETTINGS-SAVED" });
  }
  return Response.json({ error: "Unknown control action" }, { status: 400 });
}
