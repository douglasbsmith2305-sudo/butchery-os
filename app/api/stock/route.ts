import { env } from "@/lib/db";

const DEFAULT_DEPARTMENTS = [
  ["Beef", "BEEF"], ["Pork", "PORK"], ["Chicken", "CHKN"], ["Lamb", "LAMB"], ["Game", "GAME"],
  ["Groceries", "GROC"], ["Cold Drinks", "DRNK"], ["Bakery", "BAKE"],
  ["Takeaways", "TAKE"], ["Biltong / Deli", "DELI"], ["Unmapped", "UNMP"],
];

async function ensureSchema() {
  const db = env.DB;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS departments (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, code TEXT NOT NULL UNIQUE, active INTEGER NOT NULL DEFAULT 1)"),
    db.prepare("CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, sku TEXT NOT NULL UNIQUE, barcode TEXT, name TEXT NOT NULL, department TEXT NOT NULL, unit TEXT NOT NULL DEFAULT 'each', cost_price REAL NOT NULL DEFAULT 0, selling_price REAL NOT NULL DEFAULT 0, quantity REAL NOT NULL DEFAULT 0, imported_at TEXT NOT NULL)"),
    db.prepare("ALTER TABLE products ADD COLUMN IF NOT EXISTS vat_percent DOUBLE PRECISION NOT NULL DEFAULT 15"),
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
    env.DB.prepare("SELECT id, sku, barcode, name, department, unit, cost_price AS costPrice, selling_price AS sellingPrice, quantity, vat_percent AS vatPercent, imported_at AS importedAt FROM products ORDER BY name LIMIT 5000").all(),
  ]);
  return Response.json({ departments: departments.results, products: products.results });
}

type ImportRow = { sku?: string; barcode?: string; plu?: string; name?: string; department?: string; unit?: string; costPrice?: number; sellingPrice?: number; quantity?: number; vatPercent?: number };

export async function POST(request: Request) {
  await ensureSchema();
  const payload = await request.json() as { action?: string; name?: string; rows?: ImportRow[] };
  if (payload.action === "department") {
    const name = payload.name?.trim();
    if (!name) return Response.json({ error: "Department name is required" }, { status: 400 });
    const code = name.replace(/[^a-z0-9]/gi, "").slice(0, 5).toUpperCase() || "DEPT";
    await env.DB.prepare("INSERT OR IGNORE INTO departments (name, code, active) VALUES (?, ?, 1)").bind(name, code).run();
    return Response.json({ ok: true });
  }
  const rows = payload.rows ?? [];
  if (!rows.length) return Response.json({ error: "No stock rows supplied" }, { status: 400 });
  if (rows.length > 5000) return Response.json({ error: "Import is limited to 5,000 products at a time" }, { status: 400 });
  const now = new Date().toISOString();
  const statements = rows.map((row, index) => env.DB.prepare(
    "INSERT INTO products (sku, barcode, name, department, unit, cost_price, selling_price, quantity, vat_percent, imported_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(sku) DO UPDATE SET barcode=excluded.barcode, name=excluded.name, department=excluded.department, unit=excluded.unit, cost_price=excluded.cost_price, selling_price=excluded.selling_price, quantity=excluded.quantity, vat_percent=excluded.vat_percent, imported_at=excluded.imported_at"
  ).bind(row.sku?.trim() || `IMPORT-${Date.now()}-${index + 1}`, row.barcode?.trim() || null, row.name?.trim() || "Unnamed product", row.department?.trim() || "Unmapped", row.unit?.trim() || "each", Number(row.costPrice) || 0, Number(row.sellingPrice) || 0, Number(row.quantity) || 0, Number.isFinite(Number(row.vatPercent)) ? Number(row.vatPercent) : 15, now));
  await env.DB.batch(statements);
  const mappable=rows.filter(row=>row.plu?.trim()&&row.sku?.trim()&&row.unit?.trim().toLowerCase()==="kg");
  await env.DB.batch(mappable.map(row=>env.DB.prepare("INSERT INTO scale_product_mappings (device_id,product_id,plu,barcode_prefix,label_name,enabled,updated_at) SELECT d.id,p.id,?,'20',?,1,? FROM scale_devices d CROSS JOIN products p WHERE d.active=1 AND p.sku=? ON CONFLICT(device_id,product_id) DO UPDATE SET plu=excluded.plu,label_name=excluded.label_name,enabled=1,updated_at=excluded.updated_at").bind(row.plu!.trim(),(row.name?.trim()||"Stock item").slice(0,30),now,row.sku!.trim())));
  const devices=await env.DB.prepare("SELECT COUNT(*) AS count FROM scale_devices WHERE active=1").first<{count:number}>();
  return Response.json({ ok: true, imported: rows.length, mappedProducts:mappable.length, scaleMappings:mappable.length*Number(devices?.count??0) });
}
