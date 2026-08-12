import { env } from "cloudflare:workers";

const DEFAULT_DEPARTMENTS = [
  ["Beef", "BEEF"], ["Chicken", "CHKN"], ["Lamb", "LAMB"], ["Game", "GAME"],
  ["Groceries", "GROC"], ["Cold Drinks", "DRNK"], ["Bakery", "BAKE"],
  ["Takeaways", "TAKE"], ["Biltong / Deli", "DELI"], ["Unmapped", "UNMP"],
];

async function ensureSchema() {
  const db = env.DB;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS departments (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, code TEXT NOT NULL UNIQUE, active INTEGER NOT NULL DEFAULT 1)"),
    db.prepare("CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, sku TEXT NOT NULL UNIQUE, barcode TEXT, name TEXT NOT NULL, department TEXT NOT NULL, unit TEXT NOT NULL DEFAULT 'each', cost_price REAL NOT NULL DEFAULT 0, selling_price REAL NOT NULL DEFAULT 0, quantity REAL NOT NULL DEFAULT 0, imported_at TEXT NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS products_department_idx ON products(department)"),
  ]);
  await db.batch(DEFAULT_DEPARTMENTS.map(([name, code]) => db.prepare("INSERT OR IGNORE INTO departments (name, code, active) VALUES (?, ?, 1)").bind(name, code)));
}

export async function GET() {
  await ensureSchema();
  const [departments, products] = await Promise.all([
    env.DB.prepare("SELECT id, name, code, active FROM departments ORDER BY name").all(),
    env.DB.prepare("SELECT id, sku, barcode, name, department, unit, cost_price AS costPrice, selling_price AS sellingPrice, quantity, imported_at AS importedAt FROM products ORDER BY name LIMIT 5000").all(),
  ]);
  return Response.json({ departments: departments.results, products: products.results });
}

type ImportRow = { sku?: string; barcode?: string; name?: string; department?: string; unit?: string; costPrice?: number; sellingPrice?: number; quantity?: number };

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
    "INSERT INTO products (sku, barcode, name, department, unit, cost_price, selling_price, quantity, imported_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(sku) DO UPDATE SET barcode=excluded.barcode, name=excluded.name, department=excluded.department, unit=excluded.unit, cost_price=excluded.cost_price, selling_price=excluded.selling_price, quantity=excluded.quantity, imported_at=excluded.imported_at"
  ).bind(row.sku?.trim() || `IMPORT-${Date.now()}-${index + 1}`, row.barcode?.trim() || null, row.name?.trim() || "Unnamed product", row.department?.trim() || "Unmapped", row.unit?.trim() || "each", Number(row.costPrice) || 0, Number(row.sellingPrice) || 0, Number(row.quantity) || 0, now));
  await env.DB.batch(statements);
  return Response.json({ ok: true, imported: rows.length });
}
