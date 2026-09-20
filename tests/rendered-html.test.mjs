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
  assert.match(page, /targetChangeFactor/);
  assert.match(page, /marginFloor/);
  assert.match(page, /forecastFactor/);
  assert.match(page, /p\.sellingPrice\*uplift,marginFloor\*targetChangeFactor/);
  assert.match(page, /PROPOSED \/ UNIT/);
  assert.match(page, /CURRENT NET MARGIN/);
  assert.match(page, /currentNetMargin/);
  assert.match(page, /accruedExpenses/);
  assert.match(page, /setDrafts\(\{\}\)/);
  assert.match(page, /\(bone\|bones\).*been\|bene/);
  assert.match(control, /\(bone\|bones\).*been\|bene/);
  assert.match(control, /price_decrease_decision/);
  assert.match(control, /APPROVED_PRICE_DECREASE/);
  assert.match(control, /target_margin_percent/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS price_decrease_approvals/);
});

test("four bulk meat inputs run automatic block tests while other stock remains direct", async () => {
  const [profiles, page, route, migration] = await Promise.all([
    projectFile("lib/block-tests.ts"),
    projectFile("app/page.tsx"),
    projectFile("app/api/receiving/route.ts"),
    projectFile("drizzle/0012_automatic_block_tests.sql"),
  ]);

  for (const name of ["Beef Hind Quarter", "Beef Front Quarter", "Lamb Carcass", "Pork Carcass"]) assert.match(profiles, new RegExp(name));
  assert.equal((profiles.match(/\{ outputSku:.*percent:/g) ?? []).length, 36);
  assert.match(page, /AUTOMATIC YIELD PREVIEW/);
  assert.match(page, /DIRECT ITEM STOCK/);
  assert.match(route, /AUTO_BLOCK_INPUT/);
  assert.match(route, /AUTO_BLOCK_OUTPUT/);
  assert.match(route, /outputQuantity\*\.98/);
  assert.match(route, /outputQuantity\*1\.02/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS block_test_allocations/);
});

test("sandbox copies live manager and back office data without write requests", async () => {
  const [page, sandbox, styles] = await Promise.all([
    projectFile("app/page.tsx"),
    projectFile("app/components/SandboxWorkspace.tsx"),
    projectFile("app/globals.css"),
  ]);

  assert.match(page, /\["Sand-box", "Sandbox"\]/);
  assert.match(page, /portal === "Sandbox" \? <SandboxWorkspace/);
  assert.match(sandbox, /Promise\.all\(\[/);
  for (const endpoint of ["control", "finance", "orders", "payroll", "receiving", "scales", "commission"]) assert.match(sandbox, new RegExp(`/api/${endpoint}`));
  assert.match(sandbox, /method:"GET"/);
  assert.doesNotMatch(sandbox, /method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/);
  assert.match(sandbox, /nothing can be written back/i);
  assert.match(sandbox, /Reset scenario/);
  assert.match(styles, /\.sandbox-lock/);
});

test("staff commission is editable, VAT-exclusive and attributed through scale PLUs", async () => {
  const [page, commission, pos, scales, migration, sandbox] = await Promise.all([
    projectFile("app/page.tsx"),
    projectFile("app/api/commission/route.ts"),
    projectFile("app/api/pos/route.ts"),
    projectFile("app/api/scales/route.ts"),
    projectFile("drizzle/0013_staff_commission.sql"),
    projectFile("app/components/SandboxWorkspace.tsx"),
  ]);

  assert.match(page, /OWNER BACK OFFICE \/ COMMISSION/);
  assert.match(page, /Save commission rate/);
  assert.match(page, /% of VAT-exclusive paid sales/);
  assert.match(commission, /default_rate_percent REAL NOT NULL DEFAULT 5/);
  assert.match(commission, /calculation_basis='EXCLUDING_VAT'/);
  assert.match(commission, /custom_rate_percent/);
  assert.match(pos, /gross\/\(1\+vatRate\/100\)/);
  assert.match(pos, /entry_type,reference,created_at/);
  assert.match(pos, /'REVERSAL'/);
  assert.match(scales, /function expandedItems/);
  assert.match(scales, /const aliasPlu=/);
  assert.match(scales, /commissionStaffId/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS commission_entries/);
  assert.match(sandbox, /function SandboxCommission/);
});

test("manager can access the shared accounts and calendar workspace", async () => {
  const page = await projectFile("app/page.tsx");

  assert.match(page, /portal === "Manager" \? \["Manager overview", "Receiving", "Stock master", "Cooler inventory", "Orders", "Stock count", "Waste & loss", "Accounts & Calendar"\]/);
  assert.match(page, /section === "Accounts & Calendar" \? <FinancialControl initialTab="Accounts overview" \/>/);
});

test("owner overview holds pricing decisions and performance while reports show real carcass cost", async () => {
  const [page, theme] = await Promise.all([
    projectFile("app/page.tsx"),
    projectFile("app/theme.css"),
  ]);

  const overview = page.slice(page.indexOf("function OwnerOverview"), page.indexOf("function StockCount"));
  const pricing = page.slice(page.indexOf("function PricingEngine"), page.indexOf("function ScaleNetwork"));
  const reports = page.slice(page.indexOf("function ManagementReports"), page.indexOf("function BusinessSettings"));

  assert.match(overview, /Price decreases awaiting approval/);
  assert.match(overview, /Approve decrease ✓/);
  assert.match(overview, /TOP SELLERS · THIS MONTH/);
  assert.match(overview, /UNDER-PERFORMING · THIS MONTH/);
  assert.doesNotMatch(pricing, /Price decreases awaiting approval/);
  assert.doesNotMatch(pricing, /THE REAL CARCASS COST/);
  assert.match(reports, /"Real carcass cost"/);
  assert.match(reports, /BONE \/ FAT COST DRAG/);
  assert.match(reports, /RECOVERY REQUIRED/);
  assert.match(theme, /html\.dark-theme \.performance-split>\.panel\{[^}]+!important/);
});

test("POS supports discounts, daily cash-up and department-routed orders", async () => {
  const [page, pos, orders, migration, styles] = await Promise.all([
    projectFile("app/page.tsx"),
    projectFile("app/api/pos/route.ts"),
    projectFile("app/api/orders/route.ts"),
    projectFile("drizzle/0014_pos_cashup_discount_order_routing.sql"),
    projectFile("app/globals.css"),
  ]);

  assert.match(page, /className="discount-block"/);
  assert.match(page, /discountPercent/);
  assert.match(page, /max="100"/);
  assert.match(page, /END-OF-DAY CASH-UP/);
  assert.match(page, /Close daily sales & cash up/);
  for (const label of ["Send to Butcher", "Send to Takeaways", "Send to Bakery"]) assert.match(page, new RegExp(label));
  assert.match(page, /queueDestination/);
  assert.match(pos, /payload\.action==="CASH_UP"/);
  assert.match(pos, /payload\.action==="OPEN_TILL"/);
  assert.match(pos, /discount_amount/);
  assert.match(pos, /expectedCash/);
  assert.match(orders, /destination/);
  assert.match(orders, /\["BUTCHER","TAKEAWAYS","BAKERY"\]/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS till_sessions/);
  assert.match(migration, /ALTER TABLE butcher_orders ADD COLUMN IF NOT EXISTS destination/);
  assert.match(styles, /\.cashup-form/);
  assert.match(styles, /\.destination-tabs/);
});
