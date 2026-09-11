import { env } from "@/lib/db";
import { BLOCK_TEST_PROFILES, blockTestProfile } from "@/lib/block-tests";

async function ensureSchema() {
  for (const profile of BLOCK_TEST_PROFILES) {
    const total = profile.items.reduce((sum, item) => sum + item.percent, 0);
    if (Math.abs(total - 100) > .0001) throw new Error(`${profile.name} block-test profile must total 100%.`);
  }
  const db = env.DB;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, sku TEXT NOT NULL UNIQUE, barcode TEXT, name TEXT NOT NULL, department TEXT NOT NULL, unit TEXT NOT NULL DEFAULT 'each', cost_price REAL NOT NULL DEFAULT 0, selling_price REAL NOT NULL DEFAULT 0, quantity REAL NOT NULL DEFAULT 0, imported_at TEXT NOT NULL)"),
    db.prepare("ALTER TABLE products ADD COLUMN IF NOT EXISTS target_margin_percent DOUBLE PRECISION NOT NULL DEFAULT 0"),
    db.prepare("ALTER TABLE products ADD COLUMN IF NOT EXISTS block_test_profile_code TEXT"),
    db.prepare("CREATE TABLE IF NOT EXISTS suppliers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, payment_terms_days INTEGER NOT NULL DEFAULT 7, contact TEXT, active INTEGER NOT NULL DEFAULT 1)"),
    db.prepare("CREATE TABLE IF NOT EXISTS supplier_invoices (id INTEGER PRIMARY KEY AUTOINCREMENT, supplier_id INTEGER NOT NULL, invoice_number TEXT NOT NULL UNIQUE, delivery_date TEXT NOT NULL, due_date TEXT NOT NULL, amount REAL NOT NULL, balance REAL NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN', created_at TEXT NOT NULL, FOREIGN KEY(supplier_id) REFERENCES suppliers(id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS stock_receipts (id INTEGER PRIMARY KEY AUTOINCREMENT, receipt_number TEXT NOT NULL UNIQUE, supplier_id INTEGER NOT NULL, supplier_name TEXT NOT NULL, invoice_number TEXT NOT NULL, delivery_date TEXT NOT NULL, notes TEXT, total_cost REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL, FOREIGN KEY(supplier_id) REFERENCES suppliers(id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS stock_receipt_lines (id INTEGER PRIMARY KEY AUTOINCREMENT, receipt_id INTEGER NOT NULL, product_id INTEGER NOT NULL, product_name TEXT NOT NULL, department TEXT NOT NULL, quantity REAL NOT NULL, unit TEXT NOT NULL, cost_price REAL NOT NULL DEFAULT 0, line_total REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL, FOREIGN KEY(receipt_id) REFERENCES stock_receipts(id), FOREIGN KEY(product_id) REFERENCES products(id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS stock_ledger_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, reference TEXT NOT NULL, product_id INTEGER NOT NULL, product_name TEXT NOT NULL, quantity REAL NOT NULL, unit TEXT NOT NULL, movement_type TEXT NOT NULL, direction TEXT NOT NULL, source TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(product_id) REFERENCES products(id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS block_test_allocations (id INTEGER PRIMARY KEY AUTOINCREMENT, receipt_id INTEGER NOT NULL, input_product_id INTEGER NOT NULL, output_product_id INTEGER NOT NULL, profile_code TEXT NOT NULL, baseline_percent REAL NOT NULL, expected_quantity REAL NOT NULL, low_quantity REAL NOT NULL, high_quantity REAL NOT NULL, cost_per_kg REAL NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(receipt_id) REFERENCES stock_receipts(id), FOREIGN KEY(input_product_id) REFERENCES products(id), FOREIGN KEY(output_product_id) REFERENCES products(id))"),
    db.prepare("CREATE INDEX IF NOT EXISTS block_test_allocation_receipt_idx ON block_test_allocations(receipt_id, profile_code)"),
    db.prepare("CREATE TABLE IF NOT EXISTS price_history (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, old_price REAL NOT NULL, new_price REAL NOT NULL, reason TEXT NOT NULL, effective_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS price_decrease_approvals (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, product_name TEXT NOT NULL, receipt_number TEXT NOT NULL, old_price REAL NOT NULL, proposed_price REAL NOT NULL, old_cost REAL NOT NULL, new_cost REAL NOT NULL, target_margin_percent REAL NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', requested_at TEXT NOT NULL, decided_at TEXT, FOREIGN KEY(product_id) REFERENCES products(id))"),
    db.prepare("CREATE INDEX IF NOT EXISTS price_decrease_status_idx ON price_decrease_approvals(status, requested_at)"),
    db.prepare("CREATE TABLE IF NOT EXISTS scale_devices (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, brand TEXT NOT NULL, connector_type TEXT NOT NULL, location TEXT NOT NULL, endpoint TEXT, database_table TEXT, active INTEGER NOT NULL DEFAULT 1, last_sync_at TEXT, last_sync_status TEXT NOT NULL DEFAULT 'NEVER', created_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS scale_sync_jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, device_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', source TEXT NOT NULL, item_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, completed_at TEXT, error TEXT, FOREIGN KEY(device_id) REFERENCES scale_devices(id))"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS stock_receipts_supplier_invoice_idx ON stock_receipts(supplier_id, invoice_number)"),
    db.prepare("CREATE INDEX IF NOT EXISTS stock_receipt_lines_receipt_idx ON stock_receipt_lines(receipt_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS stock_ledger_product_idx ON stock_ledger_entries(product_id, created_at)"),
  ]);
  const now = new Date().toISOString();
  await db.batch(BLOCK_TEST_PROFILES.flatMap(profile => [
    db.prepare("INSERT INTO products (sku,barcode,name,department,unit,cost_price,selling_price,quantity,imported_at,block_test_profile_code) VALUES (?,NULL,?,?, 'kg',0,0,0,?,?) ON CONFLICT(sku) DO UPDATE SET name=excluded.name,department=excluded.department,unit='kg',block_test_profile_code=excluded.block_test_profile_code").bind(profile.inputSku, profile.name, profile.department, now, profile.code),
    ...profile.items.map(item => db.prepare("INSERT OR IGNORE INTO products (sku,barcode,name,department,unit,cost_price,selling_price,quantity,imported_at) VALUES (?,NULL,?,?, 'kg',0,0,0,?)").bind(item.outputSku, item.name, profile.department, now)),
  ]));
  await db.prepare("UPDATE products SET target_margin_percent=CASE WHEN selling_price>cost_price AND selling_price>0 THEN ((selling_price-cost_price)/selling_price)*100 ELSE 30 END WHERE target_margin_percent<=0").run();
}

export async function GET() {
  await ensureSchema();
  const [products, suppliers, receipts, lines, allocations] = await Promise.all([
    env.DB.prepare("SELECT id, sku, barcode, name, department, unit, cost_price AS costPrice, selling_price AS sellingPrice, quantity, block_test_profile_code AS blockTestProfileCode FROM products ORDER BY CASE WHEN block_test_profile_code IS NULL THEN 1 ELSE 0 END,name LIMIT 5000").all(),
    env.DB.prepare("SELECT id, name, payment_terms_days AS paymentTermsDays, contact FROM suppliers WHERE active=1 ORDER BY name").all(),
    env.DB.prepare("SELECT id, receipt_number AS receiptNumber, supplier_name AS supplierName, invoice_number AS invoiceNumber, delivery_date AS deliveryDate, total_cost AS totalCost, created_at AS createdAt FROM stock_receipts ORDER BY id DESC LIMIT 50").all(),
    env.DB.prepare("SELECT id, receipt_id AS receiptId, product_name AS productName, department, quantity, unit, cost_price AS costPrice, line_total AS lineTotal FROM stock_receipt_lines WHERE receipt_id IN (SELECT id FROM stock_receipts ORDER BY id DESC LIMIT 50) ORDER BY id").all(),
    env.DB.prepare("SELECT a.id,a.receipt_id AS receiptId,a.profile_code AS profileCode,a.baseline_percent AS baselinePercent,a.expected_quantity AS expectedQuantity,a.low_quantity AS lowQuantity,a.high_quantity AS highQuantity,p.name AS outputName FROM block_test_allocations a JOIN products p ON p.id=a.output_product_id WHERE a.receipt_id IN (SELECT id FROM stock_receipts ORDER BY id DESC LIMIT 50) ORDER BY a.id").all(),
  ]);
  return Response.json({ products: products.results, suppliers: suppliers.results, receipts: receipts.results, lines: lines.results, allocations: allocations.results, blockProfiles: BLOCK_TEST_PROFILES });
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
type ProductRow = { id: number; name: string; department: string; unit: string; quantity: number; costPrice: number; sellingPrice: number; targetMarginPercent: number; blockTestProfileCode:string|null };
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
    const product = await env.DB.prepare("SELECT id, name, department, unit, quantity, cost_price AS costPrice, selling_price AS sellingPrice, target_margin_percent AS targetMarginPercent, block_test_profile_code AS blockTestProfileCode FROM products WHERE id=?").bind(productId).first<ProductRow>();
    if (!product) return Response.json({ error: "One of the selected products no longer exists." }, { status: 400 });
    products.push(product);
  }

  const normalizedLines = [] as Array<ProductRow & { quantityReceived: number; receivedCostPrice: number; lineTotal: number }>;
  for (const line of suppliedLines) {
    const product = products.find(item => item.id === Number(line.productId))!;
    const quantity = Number(line.quantity);
    const receivedCostPrice = Number(line.costPrice);
    if (!Number.isFinite(quantity) || quantity <= 0) return Response.json({ error: `Enter a valid quantity for ${product.name}.` }, { status: 400 });
    if (!Number.isFinite(receivedCostPrice) || receivedCostPrice <= 0) return Response.json({ error: `Enter the supplier cost per ${product.unit} for ${product.name}.` }, { status: 400 });
    if (product.unit.toLowerCase() !== "kg" && !Number.isInteger(quantity)) return Response.json({ error: `${product.name} is received in ${product.unit}; enter a whole unit quantity.` }, { status: 400 });
    normalizedLines.push({ ...product, quantityReceived: quantity, receivedCostPrice, lineTotal: quantity * receivedCostPrice });
  }
  const totalCost = normalizedLines.reduce((sum, line) => sum + line.lineTotal, 0);
  const now = new Date().toISOString();
  const receiptNumber = `REC-${deliveryDate.replaceAll("-", "").slice(2)}-${Date.now().toString().slice(-5)}`;

  let priceIncreases = 0; let decreaseApprovals = 0;
  try {
    if (payload.postToAccounts !== false && totalCost > 0) {
      const invoiceExists = await env.DB.prepare("SELECT id FROM supplier_invoices WHERE invoice_number=?").bind(invoiceNumber).first();
      if (invoiceExists) return Response.json({ error: `Invoice ${invoiceNumber} already exists in supplier accounts.` }, { status: 409 });
    }
    const result = await env.DB.prepare("INSERT INTO stock_receipts (receipt_number, supplier_id, supplier_name, invoice_number, delivery_date, notes, total_cost, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(receiptNumber, supplier.id, supplier.name, invoiceNumber, deliveryDate, payload.notes?.trim() || null, totalCost, now).run();
    const receiptId = result.meta.last_row_id;

    for (const line of normalizedLines) {
      const profile = blockTestProfile(line.blockTestProfileCode);
      if (profile) {
        await env.DB.batch([
          env.DB.prepare("INSERT INTO stock_receipt_lines (receipt_id, product_id, product_name, department, quantity, unit, cost_price, line_total, created_at) VALUES (?, ?, ?, ?, ?, 'kg', ?, ?, ?)").bind(receiptId, line.id, line.name, line.department, line.quantityReceived, line.receivedCostPrice, line.lineTotal, now),
          env.DB.prepare("INSERT INTO stock_ledger_entries (reference, product_id, product_name, quantity, unit, movement_type, direction, source, reason, created_at) VALUES (?, ?, ?, ?, 'kg', 'SUPPLIER_RECEIPT', 'IN', ?, ?, ?)").bind(receiptNumber, line.id, line.name, line.quantityReceived, supplier.name, `Supplier invoice ${invoiceNumber}`, now),
          env.DB.prepare("INSERT INTO stock_ledger_entries (reference, product_id, product_name, quantity, unit, movement_type, direction, source, reason, created_at) VALUES (?, ?, ?, ?, 'kg', 'AUTO_BLOCK_INPUT', 'OUT', ?, ?, ?)").bind(receiptNumber, line.id, line.name, line.quantityReceived, "Automatic block test", `${profile.name} converted at baseline yield`, now),
        ]);
        for (const item of profile.items) {
          const output = await env.DB.prepare("SELECT id,name,department,unit,quantity,cost_price AS costPrice,selling_price AS sellingPrice,target_margin_percent AS targetMarginPercent,block_test_profile_code AS blockTestProfileCode FROM products WHERE sku=?").bind(item.outputSku).first<ProductRow>();
          if (!output) throw new Error(`Block-test output ${item.name} is not configured.`);
          const outputQuantity = line.quantityReceived * item.percent / 100;
          const closingQuantity = output.quantity + outputQuantity;
          const weightedCost = closingQuantity > 0 ? ((output.quantity * output.costPrice) + (outputQuantity * line.receivedCostPrice)) / closingQuantity : line.receivedCostPrice;
          const outputStatements = [
            env.DB.prepare("UPDATE products SET quantity=quantity+?,cost_price=?,imported_at=? WHERE id=?").bind(outputQuantity, weightedCost, now, output.id),
            env.DB.prepare("INSERT INTO stock_ledger_entries (reference,product_id,product_name,quantity,unit,movement_type,direction,source,reason,created_at) VALUES (?,?,?,?,'kg','AUTO_BLOCK_OUTPUT','IN',?,?,?)").bind(receiptNumber, output.id, output.name, outputQuantity, profile.name, `${item.percent}% baseline · acceptable range ±2%`, now),
            env.DB.prepare("INSERT INTO block_test_allocations (receipt_id,input_product_id,output_product_id,profile_code,baseline_percent,expected_quantity,low_quantity,high_quantity,cost_per_kg,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(receiptId, line.id, output.id, profile.code, item.percent, outputQuantity, outputQuantity*.98, outputQuantity*1.02, line.receivedCostPrice, now),
          ];
          if (!item.byproduct) {
            const margin = Math.min(90, Math.max(0, output.targetMarginPercent || 30));
            const calculatedPrice = Math.ceil((line.receivedCostPrice / Math.max(.1, 1 - margin / 100)) * 100) / 100;
            if (calculatedPrice > output.sellingPrice + .004) {
              outputStatements.push(env.DB.prepare("UPDATE products SET selling_price=? WHERE id=?").bind(calculatedPrice, output.id), env.DB.prepare("INSERT INTO price_history (product_id,old_price,new_price,reason,effective_at) VALUES (?,?,?,?,?)").bind(output.id, output.sellingPrice, calculatedPrice, `Automatic block-test increase from ${receiptNumber} at ${margin.toFixed(2)}% margin`, now));
              priceIncreases += 1;
            } else if (calculatedPrice < output.sellingPrice - .004) {
              outputStatements.push(env.DB.prepare("INSERT INTO price_decrease_approvals (product_id,product_name,receipt_number,old_price,proposed_price,old_cost,new_cost,target_margin_percent,reason,status,requested_at) VALUES (?,?,?,?,?,?,?,?,?,'PENDING',?)").bind(output.id, output.name, receiptNumber, output.sellingPrice, calculatedPrice, output.costPrice, line.receivedCostPrice, margin, `${profile.name} supplier cost on invoice ${invoiceNumber}`, now));
              decreaseApprovals += 1;
            }
          }
          await env.DB.batch(outputStatements);
        }
        continue;
      }
      const openingValue = line.quantity * line.costPrice;
      const receivedValue = line.quantityReceived * line.receivedCostPrice;
      const closingQuantity = line.quantity + line.quantityReceived;
      const weightedCost = closingQuantity > 0 ? (openingValue + receivedValue) / closingQuantity : line.costPrice;
      const margin = Math.min(90, Math.max(0, line.targetMarginPercent || 30));
      const calculatedPrice = Math.ceil((line.receivedCostPrice / Math.max(.1, 1 - margin / 100)) * 100) / 100;
      const coreStatements = [
        env.DB.prepare("INSERT INTO stock_receipt_lines (receipt_id, product_id, product_name, department, quantity, unit, cost_price, line_total, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(receiptId, line.id, line.name, line.department, line.quantityReceived, line.unit, line.receivedCostPrice, line.lineTotal, now),
        env.DB.prepare("UPDATE products SET quantity=quantity+?, cost_price=?, imported_at=? WHERE id=?").bind(line.quantityReceived, weightedCost, now, line.id),
        env.DB.prepare("INSERT INTO stock_ledger_entries (reference, product_id, product_name, quantity, unit, movement_type, direction, source, reason, created_at) VALUES (?, ?, ?, ?, ?, 'SUPPLIER_RECEIPT', 'IN', ?, ?, ?)").bind(receiptNumber, line.id, line.name, line.quantityReceived, line.unit, supplier.name, `Supplier invoice ${invoiceNumber}`, now),
      ];
      if (calculatedPrice > line.sellingPrice + .004) {
        coreStatements.push(
          env.DB.prepare("UPDATE products SET selling_price=? WHERE id=?").bind(calculatedPrice, line.id),
          env.DB.prepare("INSERT INTO price_history (product_id, old_price, new_price, reason, effective_at) VALUES (?, ?, ?, ?, ?)").bind(line.id, line.sellingPrice, calculatedPrice, `Automatic increase from receipt ${receiptNumber} at ${margin.toFixed(2)}% margin`, now),
        );
        priceIncreases += 1;
      } else if (calculatedPrice < line.sellingPrice - .004) {
        coreStatements.push(env.DB.prepare("INSERT INTO price_decrease_approvals (product_id, product_name, receipt_number, old_price, proposed_price, old_cost, new_cost, target_margin_percent, reason, status, requested_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)").bind(line.id, line.name, receiptNumber, line.sellingPrice, calculatedPrice, line.costPrice, line.receivedCostPrice, margin, `Supplier cost received on invoice ${invoiceNumber}`, now));
        decreaseApprovals += 1;
      }
      await env.DB.batch(coreStatements);
    }

    if (priceIncreases) {
      const devices = await env.DB.prepare("SELECT id FROM scale_devices WHERE active=1 ORDER BY id").all<{id:number}>();
      if (devices.results.length) await env.DB.batch(devices.results.flatMap(device => [env.DB.prepare("INSERT INTO scale_sync_jobs (device_id,status,source,item_count,created_at) VALUES (?,'PENDING','RECEIVING_AUTO_INCREASE',?,?)").bind(device.id, priceIncreases, now), env.DB.prepare("UPDATE scale_devices SET last_sync_status='PENDING' WHERE id=?").bind(device.id)]));
    }

    let dueDate: string | null = null;
    if (payload.postToAccounts !== false && totalCost > 0) {
      dueDate = inclusiveDueDate(deliveryDate, supplier.paymentTermsDays);
      await env.DB.prepare("INSERT INTO supplier_invoices (supplier_id, invoice_number, delivery_date, due_date, amount, balance, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?)").bind(supplier.id, invoiceNumber, deliveryDate, dueDate, totalCost, totalCost, now).run();
    }
    return Response.json({ ok: true, receiptNumber, totalCost, dueDate, priceIncreases, decreaseApprovals });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The receipt could not be posted.";
    return Response.json({ error: message }, { status: 400 });
  }
}
