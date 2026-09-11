import { env } from "@/lib/db";

async function ensureSchema() {
  const db = env.DB;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, sku TEXT NOT NULL UNIQUE, barcode TEXT, name TEXT NOT NULL, department TEXT NOT NULL, unit TEXT NOT NULL DEFAULT 'each', cost_price REAL NOT NULL DEFAULT 0, selling_price REAL NOT NULL DEFAULT 0, quantity REAL NOT NULL DEFAULT 0, imported_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS suppliers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, payment_terms_days INTEGER NOT NULL DEFAULT 7, contact TEXT, active INTEGER NOT NULL DEFAULT 1)"),
    db.prepare("CREATE TABLE IF NOT EXISTS supplier_invoices (id INTEGER PRIMARY KEY AUTOINCREMENT, supplier_id INTEGER NOT NULL, invoice_number TEXT NOT NULL UNIQUE, delivery_date TEXT NOT NULL, due_date TEXT NOT NULL, amount REAL NOT NULL, balance REAL NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN', created_at TEXT NOT NULL, FOREIGN KEY(supplier_id) REFERENCES suppliers(id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS stock_receipts (id INTEGER PRIMARY KEY AUTOINCREMENT, receipt_number TEXT NOT NULL UNIQUE, supplier_id INTEGER NOT NULL, supplier_name TEXT NOT NULL, invoice_number TEXT NOT NULL, delivery_date TEXT NOT NULL, notes TEXT, total_cost REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL, FOREIGN KEY(supplier_id) REFERENCES suppliers(id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS stock_receipt_lines (id INTEGER PRIMARY KEY AUTOINCREMENT, receipt_id INTEGER NOT NULL, product_id INTEGER NOT NULL, product_name TEXT NOT NULL, department TEXT NOT NULL, quantity REAL NOT NULL, unit TEXT NOT NULL, cost_price REAL NOT NULL DEFAULT 0, line_total REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL, FOREIGN KEY(receipt_id) REFERENCES stock_receipts(id), FOREIGN KEY(product_id) REFERENCES products(id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS stock_ledger_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, reference TEXT NOT NULL, product_id INTEGER NOT NULL, product_name TEXT NOT NULL, quantity REAL NOT NULL, unit TEXT NOT NULL, movement_type TEXT NOT NULL, direction TEXT NOT NULL, source TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(product_id) REFERENCES products(id))"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS stock_receipts_supplier_invoice_idx ON stock_receipts(supplier_id, invoice_number)"),
    db.prepare("CREATE INDEX IF NOT EXISTS stock_receipt_lines_receipt_idx ON stock_receipt_lines(receipt_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS stock_ledger_product_idx ON stock_ledger_entries(product_id, created_at)"),
  ]);
}

export async function GET() {
  await ensureSchema();
  const [products, suppliers, receipts, lines] = await Promise.all([
    env.DB.prepare("SELECT id, sku, barcode, name, department, unit, cost_price AS costPrice, selling_price AS sellingPrice, quantity FROM products ORDER BY name LIMIT 5000").all(),
    env.DB.prepare("SELECT id, name, payment_terms_days AS paymentTermsDays, contact FROM suppliers WHERE active=1 ORDER BY name").all(),
    env.DB.prepare("SELECT id, receipt_number AS receiptNumber, supplier_name AS supplierName, invoice_number AS invoiceNumber, delivery_date AS deliveryDate, total_cost AS totalCost, created_at AS createdAt FROM stock_receipts ORDER BY id DESC LIMIT 50").all(),
    env.DB.prepare("SELECT id, receipt_id AS receiptId, product_name AS productName, department, quantity, unit, cost_price AS costPrice, line_total AS lineTotal FROM stock_receipt_lines WHERE receipt_id IN (SELECT id FROM stock_receipts ORDER BY id DESC LIMIT 50) ORDER BY id").all(),
  ]);
  return Response.json({ products: products.results, suppliers: suppliers.results, receipts: receipts.results, lines: lines.results });
}

type ReceiptLine = { productId?: number; quantity?: number; costPrice?: number };
type ReceiptPayload = {
  supplierId?: number;
  invoiceNumber?: string;
  deliveryDate?: string;
  notes?: string;
  postToAccounts?: boolean;
  lines?: ReceiptLine[];
};
type ProductRow = { id: number; name: string; department: string; unit: string; quantity: number; costPrice: number };
type SupplierRow = { id: number; name: string; paymentTermsDays: number };

const inclusiveDueDate = (deliveryDate: string, days: number) => {
  const due = new Date(`${deliveryDate}T12:00:00Z`);
  due.setUTCDate(due.getUTCDate() + Math.max(1, days) - 1);
  return due.toISOString().slice(0, 10);
};

export async function POST(request: Request) {
  await ensureSchema();
  const payload = await request.json() as ReceiptPayload;
  const invoiceNumber = payload.invoiceNumber?.trim() ?? "";
  const deliveryDate = payload.deliveryDate?.trim() ?? "";
  const suppliedLines = payload.lines ?? [];
  const supplier = await env.DB.prepare("SELECT id, name, payment_terms_days AS paymentTermsDays FROM suppliers WHERE id=? AND active=1").bind(payload.supplierId).first<SupplierRow>();

  if (!supplier || !invoiceNumber || !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate) || !suppliedLines.length) {
    return Response.json({ error: "Supplier, invoice number, delivery date and at least one product are required." }, { status: 400 });
  }
  const duplicate = await env.DB.prepare("SELECT id FROM stock_receipts WHERE supplier_id=? AND invoice_number=?").bind(supplier.id, invoiceNumber).first();
  if (duplicate) return Response.json({ error: `Invoice ${invoiceNumber} has already been received for ${supplier.name}.` }, { status: 409 });

  const productIds = [...new Set(suppliedLines.map(line => Number(line.productId)).filter(Boolean))];
  if (productIds.length !== suppliedLines.length) return Response.json({ error: "Each product may only appear once on a receipt." }, { status: 400 });
  const products: ProductRow[] = [];
  for (const productId of productIds) {
    const product = await env.DB.prepare("SELECT id, name, department, unit, quantity, cost_price AS costPrice FROM products WHERE id=?").bind(productId).first<ProductRow>();
    if (!product) return Response.json({ error: "One of the selected products no longer exists." }, { status: 400 });
    products.push(product);
  }

  const normalizedLines = [] as Array<ProductRow & { quantityReceived: number; receivedCostPrice: number; lineTotal: number }>;
  for (const line of suppliedLines) {
    const product = products.find(item => item.id === Number(line.productId))!;
    const quantity = Number(line.quantity);
    const receivedCostPrice = Math.max(0, Number(line.costPrice) || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) return Response.json({ error: `Enter a valid quantity for ${product.name}.` }, { status: 400 });
    if (product.unit.toLowerCase() !== "kg" && !Number.isInteger(quantity)) return Response.json({ error: `${product.name} is received in ${product.unit}; enter a whole unit quantity.` }, { status: 400 });
    normalizedLines.push({ ...product, quantityReceived: quantity, receivedCostPrice, lineTotal: quantity * receivedCostPrice });
  }
  const totalCost = normalizedLines.reduce((sum, line) => sum + line.lineTotal, 0);
  const now = new Date().toISOString();
  const receiptNumber = `REC-${deliveryDate.replaceAll("-", "").slice(2)}-${Date.now().toString().slice(-5)}`;

  try {
    if (payload.postToAccounts !== false && totalCost > 0) {
      const invoiceExists = await env.DB.prepare("SELECT id FROM supplier_invoices WHERE invoice_number=?").bind(invoiceNumber).first();
      if (invoiceExists) return Response.json({ error: `Invoice ${invoiceNumber} already exists in supplier accounts.` }, { status: 409 });
    }
    const result = await env.DB.prepare("INSERT INTO stock_receipts (receipt_number, supplier_id, supplier_name, invoice_number, delivery_date, notes, total_cost, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(receiptNumber, supplier.id, supplier.name, invoiceNumber, deliveryDate, payload.notes?.trim() || null, totalCost, now).run();
    const receiptId = result.meta.last_row_id;

    for (const line of normalizedLines) {
      const openingValue = line.quantity * line.costPrice;
      const receivedValue = line.quantityReceived * line.receivedCostPrice;
      const closingQuantity = line.quantity + line.quantityReceived;
      const weightedCost = closingQuantity > 0 ? (openingValue + receivedValue) / closingQuantity : line.costPrice;
      await env.DB.batch([
        env.DB.prepare("INSERT INTO stock_receipt_lines (receipt_id, product_id, product_name, department, quantity, unit, cost_price, line_total, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(receiptId, line.id, line.name, line.department, line.quantityReceived, line.unit, line.receivedCostPrice, line.lineTotal, now),
        env.DB.prepare("UPDATE products SET quantity=quantity+?, cost_price=?, imported_at=? WHERE id=?").bind(line.quantityReceived, weightedCost, now, line.id),
        env.DB.prepare("INSERT INTO stock_ledger_entries (reference, product_id, product_name, quantity, unit, movement_type, direction, source, reason, created_at) VALUES (?, ?, ?, ?, ?, 'SUPPLIER_RECEIPT', 'IN', ?, ?, ?)").bind(receiptNumber, line.id, line.name, line.quantityReceived, line.unit, supplier.name, `Supplier invoice ${invoiceNumber}`, now),
      ]);
    }

    let dueDate: string | null = null;
    if (payload.postToAccounts !== false && totalCost > 0) {
      dueDate = inclusiveDueDate(deliveryDate, supplier.paymentTermsDays);
      await env.DB.prepare("INSERT INTO supplier_invoices (supplier_id, invoice_number, delivery_date, due_date, amount, balance, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?)").bind(supplier.id, invoiceNumber, deliveryDate, dueDate, totalCost, totalCost, now).run();
    }
    return Response.json({ ok: true, receiptNumber, totalCost, dueDate });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The receipt could not be posted.";
    return Response.json({ error: message }, { status: 400 });
  }
}
