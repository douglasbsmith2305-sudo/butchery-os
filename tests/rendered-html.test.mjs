import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("universal receiving supports searchable mixed-unit stock intake", async () => {
  const [page, styles] = await Promise.all([
    projectFile("app/page.tsx"),
    projectFile("app/globals.css"),
  ]);

  assert.match(page, /function UniversalReceiving\(\)/);
  assert.match(page, /Search all Stock Master items/);
  assert.match(page, /Product, SKU, barcode or department/);
  assert.match(page, /selected\.unit\.toLowerCase\(\)!=="kg"&&!Number\.isInteger/);
  assert.match(page, /Receive all products/);
  assert.match(page, /\["Pork", \["pork", "vark", "varkvleis"/);
  assert.match(page, /Add the invoice value to supplier accounts and payment calendar/);
  assert.match(page, /supplier cost per \$\{selected\.unit\}/i);
  assert.match(page, /sent to Back Office approval/i);
  assert.match(styles, /\.receiving-layout/);
  assert.match(styles, /@media\(max-width:760px\).*\.receiving-fields/s);
});

test("receiving persists stock, cost, supplier invoices and ledger movements", async () => {
  const [route, database, migration] = await Promise.all([
    projectFile("app/api/receiving/route.ts"),
    projectFile("lib/db.ts"),
    projectFile("drizzle/0010_universal_receiving.sql"),
  ]);

  assert.match(route, /UPDATE products SET quantity=quantity\+\?, cost_price=\?/);
  assert.match(route, /SUPPLIER_RECEIPT/);
  assert.match(route, /stock_receipt_lines/);
  assert.match(route, /supplier_invoices/);
  assert.match(route, /inclusiveDueDate/);
  assert.match(route, /RECEIVING_AUTO_INCREASE/);
  assert.match(route, /price_decrease_approvals/);
  assert.match(database, /"stock_receipts"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS stock_receipts/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS stock_ledger_entries/);
});

test("back office controls target margins and price decrease approvals", async () => {
  const [page, control, migration] = await Promise.all([
    projectFile("app/page.tsx"),
    projectFile("app/api/control/route.ts"),
    projectFile("drizzle/0011_cost_based_pricing_approvals.sql"),
  ]);

  assert.match(page, /Price decreases awaiting approval/);
  assert.match(page, /Approve decrease/);
  assert.match(page, /TARGET MARGIN/);
  assert.match(control, /price_decrease_decision/);
  assert.match(control, /APPROVED_PRICE_DECREASE/);
  assert.match(control, /target_margin_percent/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS price_decrease_approvals/);
});
