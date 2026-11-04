// One-off, explicitly authorized 4 November 2026 clean start. Never run on app startup.
// node --env-file=.env.local scripts/production-clean-start.mjs --backup
// node --env-file=.env.local scripts/production-clean-start.mjs --apply <backup-schema>
import { neon } from "@neondatabase/serverless";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const db = neon(process.env.DATABASE_URL ?? process.env.POSTGRES_URL);
const cutoff = "2026-11-02T22:00:00.000Z"; // 3 November in Johannesburg.
const mode = process.argv[2];
const tables = (await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name")).map(r => r.table_name);
if (tables.some(t => !/^[a-z_0-9]+$/.test(t))) throw new Error("Unexpected table identifier");
const directory = join(homedir(), ".codex", "backups", "butchery-os");
await mkdir(directory, { recursive: true, mode: 0o700 });

if (mode === "--backup") {
  const schema = `butchery_backup_20261104_${randomBytes(6).toString("hex")}`;
  const result = await db.transaction([
    db.query(`CREATE SCHEMA "${schema}"`),
    db.query(`REVOKE ALL ON SCHEMA "${schema}" FROM PUBLIC`),
    ...tables.map(t => db.query(`CREATE TABLE "${schema}"."${t}" AS TABLE public."${t}"`)),
    db.query(`SELECT COUNT(*) AS protected_products FROM "${schema}".products WHERE imported_at >= $1`, [cutoff]),
  ], { isolationLevel: "RepeatableRead" });
  const protectedProducts = Number(result.at(-1)[0].protected_products);
  if (protectedProducts !== 1136) throw new Error("Unexpected protected stock count; backup retained, no deletion attempted.");
  const manifest = { schema, createdAt: new Date().toISOString(), cutoff, protectedProducts, tables, purpose: "Private recovery snapshot before authorized demo cleanup" };
  const path = join(directory, `${schema}.json`);
  await writeFile(path, JSON.stringify(manifest, null, 2), { mode: 0o600, flag: "wx" });
  console.log(JSON.stringify({ backup: schema, manifest: path, protectedProducts }));
} else if (mode === "--apply") {
  const schema = process.argv[3];
  if (!/^butchery_backup_20261104_[a-f0-9]{12}$/.test(schema ?? "")) throw new Error("An exact validated backup schema is required");
  const remove = ["commission_entries", "pos_sale_items", "customer_purchase_items", "butcher_order_items", "payroll_runs", "commission_staff", "till_movements", "pos_sales", "till_sessions", "customer_purchases", "customer_accounts", "butcher_orders", "payroll_employees", "block_test_allocations", "stock_receipt_lines", "stock_ledger_entries", "stock_receipts", "supplier_invoices", "financial_transactions", "suppliers", "stock_counts", "waste_records", "price_decrease_approvals", "price_history", "scheduled_price_changes", "scale_sync_jobs", "scale_product_mappings", "scale_devices", "production_cost_counts", "cost_entries", "cost_months", "cost_audit"];
  if (remove.some(t => !tables.includes(t))) throw new Error("Schema changed; re-audit before deletion");
  const columns = await db.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'");
  const q = [db.query("SET LOCAL lock_timeout='10s'"), db.query(`LOCK TABLE ${tables.map(t => `public."${t}"`).join(",")} IN EXCLUSIVE MODE`)];
  const assert = (condition, params = []) => q.push(db.query(`SELECT 1 / CASE WHEN (${condition}) THEN 1 ELSE 0 END AS safety_check`, params));
  assert(`(SELECT COUNT(*) FROM "${schema}".products WHERE imported_at >= $1)=1136`, [cutoff]);
  // Abort if a real transaction was added after the audited cutoff. Staff are all removed by request.
  for (const table of remove.filter(t => !["commission_staff", "scale_product_mappings"].includes(t))) {
    const date = ["created_at", "entry_date", "updated_at", "effective_at", "requested_at", "opened_at"].find(c => columns.some(r => r.table_name === table && r.column_name === c));
    if (date) assert(`NOT EXISTS(SELECT 1 FROM public."${table}" WHERE "${date}">=$1)`, [cutoff]);
  }
  // Compare the exact protected IDs, allowing newly created zero-stock block configuration.
  const protectedIds = `SELECT id FROM "${schema}".products WHERE imported_at >= $1`;
  const sameProducts = `NOT EXISTS ((SELECT to_jsonb(p)-'scale_plu' AS row FROM public.products p WHERE id IN (${protectedIds}) EXCEPT SELECT to_jsonb(p)-'scale_plu' FROM "${schema}".products p WHERE imported_at >= $1) UNION ALL (SELECT to_jsonb(p)-'scale_plu' FROM "${schema}".products p WHERE imported_at >= $1 EXCEPT SELECT to_jsonb(p)-'scale_plu' FROM public.products p WHERE id IN (${protectedIds})))`;
  const sameDepartments = `NOT EXISTS ((TABLE public.departments EXCEPT TABLE "${schema}".departments) UNION ALL (TABLE "${schema}".departments EXCEPT TABLE public.departments))`;
  assert(sameProducts, [cutoff]); assert(sameDepartments);
  q.push(db.query("ALTER TABLE public.products ADD COLUMN IF NOT EXISTS scale_plu TEXT"));
  q.push(db.query(`UPDATE public.products p SET scale_plu=m.plu FROM "${schema}".scale_product_mappings m WHERE m.product_id=p.id AND m.plu=p.sku AND p.imported_at >= $1`, [cutoff]));
  q.push(db.query("UPDATE public.products SET scale_plu=sku WHERE imported_at >= $1 AND scale_plu IS NULL AND sku ~ '^[0-9]+$'", [cutoff]));
  for (const table of remove) q.push(db.query(`WITH removed AS (DELETE FROM public."${table}" RETURNING 1) SELECT $1 AS table_name, COUNT(*) AS removed FROM removed`, [table]));
  q.push(db.query("WITH removed AS (DELETE FROM public.products WHERE sku LIKE 'DEMO-%' AND imported_at < $1 RETURNING 1) SELECT 'demo_products' AS table_name, COUNT(*) AS removed FROM removed", [cutoff]));
  q.push(db.query("UPDATE public.business_settings SET value=CASE key WHEN 'monthly_operating_expenses' THEN '0' WHEN 'target_net_margin' THEN '8' END,updated_at=$1 WHERE key IN ('monthly_operating_expenses','target_net_margin')", [new Date().toISOString()]));
  assert(sameProducts, [cutoff]); assert(sameDepartments);
  assert(`NOT EXISTS (SELECT 1 FROM "${schema}".scale_product_mappings m JOIN public.products p ON p.id=m.product_id WHERE p.imported_at >= $1 AND m.plu=p.sku AND p.scale_plu IS DISTINCT FROM m.plu)`, [cutoff]);
  const results = await db.transaction(q);
  const removed = results.flat().filter(r => r.table_name);
  const report = { appliedAt: new Date().toISOString(), backup: schema, protectedProducts: 1136, removed };
  const path = join(directory, `${schema}-cleanup.json`);
  await writeFile(path, JSON.stringify(report, null, 2), { mode: 0o600, flag: "wx" });
  console.log(JSON.stringify({ ...report, report: path }));
} else throw new Error("Use --backup or --apply <exact-backup-schema>");
