// Isolated real HTTP verification; no user rows or public sequence defaults are used.
import assert from "node:assert/strict";
import { neon } from "@neondatabase/serverless";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
const db = neon(process.env.DATABASE_URL ?? process.env.POSTGRES_URL);
const schema = `butchery_cost_test_${randomBytes(8).toString("hex")}`;
if (!/^butchery_cost_test_[a-f0-9]{16}$/.test(schema)) throw new Error("Invalid schema");
let server;
const base = "http://localhost:3008";
async function get(path) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200, `GET ${path}`);
  return response.json();
}
try {
  const tables = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
  const serials = await db.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND column_default LIKE 'nextval(%'");
  await db.query(`CREATE SCHEMA "${schema}"`);
  const commands = [];
  for (const { table_name: t } of tables) {
    if (!/^[a-z_0-9]+$/.test(t)) throw new Error("Invalid table");
    commands.push(db.query(`CREATE TABLE "${schema}"."${t}" (LIKE public."${t}" INCLUDING ALL)`));
    for (const { column_name: c } of serials.filter(s => s.table_name === t)) {
      if (!/^[a-z_0-9]+$/.test(c)) throw new Error("Invalid column");
      commands.push(db.query(`CREATE SEQUENCE "${schema}"."${t}_${c}_test_seq"`));
      commands.push(db.query(`ALTER TABLE "${schema}"."${t}" ALTER COLUMN "${c}" SET DEFAULT nextval('"${schema}"."${t}_${c}_test_seq"')`));
    }
  }
  await db.transaction(commands);
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--port", "3008"], { env: { ...process.env, BUTCHERY_TEST_SCHEMA: schema }, stdio: "ignore" });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, "Isolated server must start");
  for (let pass = 0; pass < 2; pass++) {
    const finance = await get("/api/finance");
    for (const key of ["suppliers", "invoices", "transactions", "accounts", "purchases", "purchaseItems"]) assert.equal(finance[key].length, 0, key);
    const payroll = await get("/api/payroll");
    assert.equal(payroll.employees.length, 0); assert.equal(payroll.runs.length, 0);
    const pos = await get("/api/pos");
    assert.equal(pos.activeSession, null); assert.equal(pos.sales.length, 0); assert.equal(pos.tillSessions.length, 0);
    const scales = await get("/api/scales");
    assert.equal(scales.devices.length, 0); assert.equal(scales.mappings.length, 0);
    const receiving = await get("/api/receiving");
    assert.equal(receiving.receipts.length, 0); assert.equal(receiving.suppliers.length, 0);
    assert.ok(receiving.products.every(p => !p.sku.startsWith("DEMO-") && p.quantity === 0));
    assert.equal((await get("/api/orders")).orders.length, 0);
    await get("/api/control"); await get("/api/commission");
    assert.equal((await get("/api/stock")).departments.length, 12);
  }
  const response = await fetch(base + "/api/stock", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows: [{ sku: "4567", plu: "4567", name: "Isolated PLU test", department: "Beef", unit: "kg", quantity: 2, costPrice: 10, sellingPrice: 20 }] }) });
  assert.equal(response.status, 200);
  const product = (await get("/api/stock")).products.find(p => p.sku === "4567");
  assert.equal(product.plu, "4567"); assert.equal(product.quantity, 2);
  console.log("PASS: repeated fresh API loads keep staff, suppliers, accounts, sales, tills and batches empty; all 12 departments and zero-stock block profiles remain; PLUs persist without any scale device.");
} finally {
  if (server) { server.kill("SIGTERM"); await new Promise(resolve => { server.once("exit", resolve); setTimeout(resolve, 4000); }); }
  await db.query(`DROP SCHEMA "${schema}" CASCADE`);
  console.log("Isolated verification schema removed.");
}
