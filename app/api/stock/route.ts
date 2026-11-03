import { env } from "@/lib/db";

const DEFAULT_DEPARTMENTS = [
  ["Beef", "BEEF"], ["Pork", "PORK"], ["Chicken", "CHKN"], ["Lamb", "LAMB"], ["Game", "GAME"],
  ["Groceries", "GROC"], ["Cold Drinks", "DRNK"], ["Bakery", "BAKE"],
  ["Takeaways", "TAKE"], ["Biltong / Deli", "DELI"], ["Unmapped", "UNMP"],
  ["Cost of goods", "COGS"],
];

async function ensureSchema() {
  const db = env.DB;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS departments (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, code TEXT NOT NULL UNIQUE, active INTEGER NOT NULL DEFAULT 1)"),
    db.prepare("CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, sku TEXT NOT NULL UNIQUE, barcode TEXT, name TEXT NOT NULL, department TEXT NOT NULL, unit TEXT NOT NULL DEFAULT 'each', cost_price REAL NOT NULL DEFAULT 0, selling_price REAL NOT NULL DEFAULT 0, quantity REAL NOT NULL DEFAULT 0, imported_at TEXT NOT NULL)"),
    db.prepare("ALTER TABLE products ADD COLUMN IF NOT EXISTS vat_percent DOUBLE PRECISION NOT NULL DEFAULT 15"),
    db.prepare("ALTER TABLE products ADD COLUMN IF NOT EXISTS active INTEGER NOT NULL DEFAULT 1"),
    db.prepare("ALTER TABLE products ADD COLUMN IF NOT EXISTS block_test_profile_code TEXT"),
    db.prepare("CREATE TABLE IF NOT EXISTS scale_devices (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, brand TEXT NOT NULL, connector_type TEXT NOT NULL, location TEXT NOT NULL, endpoint TEXT, database_table TEXT, active INTEGER NOT NULL DEFAULT 1, last_sync_at TEXT, last_sync_status TEXT NOT NULL DEFAULT 'NEVER', created_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS scale_product_mappings (id INTEGER PRIMARY KEY AUTOINCREMENT, device_id INTEGER NOT NULL, product_id INTEGER NOT NULL, plu TEXT NOT NULL, barcode_prefix TEXT NOT NULL DEFAULT '20', label_name TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, last_synced_price REAL, updated_at TEXT NOT NULL, UNIQUE(device_id,product_id), UNIQUE(device_id,plu), FOREIGN KEY(device_id) REFERENCES scale_devices(id), FOREIGN KEY(product_id) REFERENCES products(id))"),
    db.prepare("CREATE INDEX IF NOT EXISTS products_department_idx ON products(department)"),
  ]);
  await db.batch(DEFAULT_DEPARTMENTS.map(([name, code]) => db.prepare("INSERT OR IGNORE INTO departments (name, code, active) VALUES (?, ?, 1)").bind(name, code)));
}

export async function GET() {
  await ensureSchema();
  const [departments, products] = await Promise.all([
    env.DB.prepare("SELECT id, name, code, active FROM departments ORDER BY name").all(),
    env.DB.prepare("SELECT id, sku, barcode, name, department, unit, cost_price AS costPrice, selling_price AS sellingPrice, quantity, vat_percent AS vatPercent, imported_at AS importedAt FROM products WHERE active=1 ORDER BY name LIMIT 5000").all(),
  ]);
  return Response.json({ departments: departments.results, products: products.results });
}

type ImportRow = { sku?: string; barcode?: string; plu?: string; name?: string; department?: string; unit?: string; costPrice?: number; sellingPrice?: number; quantity?: number; vatPercent?: number };

export async function POST(request: Request) {
  await ensureSchema();
  const payload = await request.json() as { action?: string; name?: string; department?: string; productIds?: number[]; rows?: ImportRow[] };
  if (payload.action === "department") {
    const name = payload.name?.trim();
    if (!name) return Response.json({ error: "Department name is required" }, { status: 400 });
    const code = name.replace(/[^a-z0-9]/gi, "").slice(0, 5).toUpperCase() || "DEPT";
    await env.DB.prepare("INSERT OR IGNORE INTO departments (name, code, active) VALUES (?, ?, 1)").bind(name, code).run();
    return Response.json({ ok: true });
  }
  if (payload.action === "bulk_assign" || payload.action === "bulk_delete") {
    const productIds = [...new Set((payload.productIds ?? []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
    if (!productIds.length) return Response.json({ error: "Select at least one product" }, { status: 400 });
    if (productIds.length > 5000) return Response.json({ error: "Bulk actions are limited to 5,000 products" }, { status: 400 });
    const placeholders = productIds.map(() => "?").join(",");
    if (payload.action === "bulk_assign") {
      const department = payload.department?.trim();
      if (!department) return Response.json({ error: "Choose a department" }, { status: 400 });
      const valid = await env.DB.prepare("SELECT name FROM departments WHERE name=? AND active=1").bind(department).first<{name:string}>();
      if (!valid) return Response.json({ error: "Department not found" }, { status: 404 });
      if(department==="Cost of goods") {
        const carcass=await env.DB.prepare(`SELECT id FROM products WHERE id IN (${placeholders}) AND block_test_profile_code IS NOT NULL LIMIT 1`).bind(...productIds).first();
        if(carcass)return Response.json({error:"Keep automatic carcass and quarter inputs in their meat departments. Cost of goods is for additional production ingredients and packaging."},{status:400});
      }
      await env.DB.atomic([
        env.DB.prepare(`UPDATE products SET department=? WHERE active=1 AND id IN (${placeholders})`).bind(department, ...productIds),
        ...(department==="Cost of goods"?[env.DB.prepare(`UPDATE scale_product_mappings SET enabled=0,updated_at=? WHERE product_id IN (${placeholders})`).bind(new Date().toISOString(),...productIds)]:[]),
      ]);
      return Response.json({ ok: true, updated: productIds.length, department });
    }
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(`UPDATE products SET active=0,imported_at=? WHERE active=1 AND id IN (${placeholders})`).bind(now, ...productIds),
      env.DB.prepare(`UPDATE scale_product_mappings SET enabled=0,updated_at=? WHERE product_id IN (${placeholders})`).bind(now, ...productIds),
    ]);
    return Response.json({ ok: true, deleted: productIds.length });
  }
  const rows = payload.rows ?? [];
  if (!rows.length) return Response.json({ error: "No stock rows supplied" }, { status: 400 });
  if (rows.length > 5000) return Response.json({ error: "Import is limited to 5,000 products at a time" }, { status: 400 });
  const now = new Date().toISOString();
  const statements = rows.map((row, index) => env.DB.prepare(
    "INSERT INTO products (sku, barcode, name, department, unit, cost_price, selling_price, quantity, vat_percent, imported_at, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1) ON CONFLICT(sku) DO UPDATE SET barcode=excluded.barcode, name=excluded.name, department=excluded.department, unit=excluded.unit, cost_price=excluded.cost_price, selling_price=excluded.selling_price, quantity=excluded.quantity, vat_percent=excluded.vat_percent, imported_at=excluded.imported_at, active=1"
  ).bind(row.sku?.trim() || `IMPORT-${Date.now()}-${index + 1}`, row.barcode?.trim() || null, row.name?.trim() || "Unnamed product", row.department?.trim() || "Unmapped", row.unit?.trim() || "each", Number(row.costPrice) || 0, Number(row.sellingPrice) || 0, Number(row.quantity) || 0, Number.isFinite(Number(row.vatPercent)) ? Number(row.vatPercent) : 15, now));
  await env.DB.batch(statements);
  const mappable=rows.filter(row=>row.plu?.trim()&&row.sku?.trim()&&row.unit?.trim().toLowerCase()==="kg");
  await env.DB.batch(mappable.map(row=>env.DB.prepare("INSERT INTO scale_product_mappings (device_id,product_id,plu,barcode_prefix,label_name,enabled,updated_at) SELECT d.id,p.id,?,'20',?,1,? FROM scale_devices d CROSS JOIN products p WHERE d.active=1 AND p.sku=? ON CONFLICT(device_id,product_id) DO UPDATE SET plu=excluded.plu,label_name=excluded.label_name,enabled=1,updated_at=excluded.updated_at").bind(row.plu!.trim(),(row.name?.trim()||"Stock item").slice(0,30),now,row.sku!.trim())));
  const devices=await env.DB.prepare("SELECT COUNT(*) AS count FROM scale_devices WHERE active=1").first<{count:number}>();
  return Response.json({ ok: true, imported: rows.length, mappedProducts:mappable.length, scaleMappings:mappable.length*Number(devices?.count??0) });
}
