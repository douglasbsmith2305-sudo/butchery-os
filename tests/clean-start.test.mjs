import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
test("normal page loads never seed demo people, suppliers, accounts or tills", async () => {
  const [finance, payroll, scales, pos, profiles] = await Promise.all(["app/api/finance/route.ts", "app/api/payroll/route.ts", "app/api/scales/route.ts", "app/api/pos/route.ts", "lib/block-tests.ts"].map(read));
  assert.doesNotMatch(finance, /Karoo Prime|Mokoena Family|KPM-68142/);
  assert.doesNotMatch(payroll, /EMP-001|Naledi Mokoena|Johan Botha|Thandi Ndlovu/);
  assert.doesNotMatch(scales, /Front Counter Scale 1/);
  assert.doesNotMatch(pos, /sessionCount/);
  assert.doesNotMatch(profiles, /DEMO-/);
});
test("live inventory screens replace hardcoded batches and retain imported scale codes", async () => {
  const [page, views, stock, scales] = await Promise.all(["app/page.tsx", "app/components/LiveInventoryViews.tsx", "app/api/stock/route.ts", "app/api/scales/route.ts"].map(read));
  assert.doesNotMatch(page, /seedBatches|HQ-260812|KPM-68142/);
  assert.match(page, /<ManagerOverview/);
  assert.match(views, /\/api\/receiving/);
  assert.match(views, /No batches or deliveries recorded yet/);
  assert.match(stock, /scale_plu AS plu/);
  assert.match(scales, /COALESCE\(NULLIF\(p.scale_plu,''\)/);
});
