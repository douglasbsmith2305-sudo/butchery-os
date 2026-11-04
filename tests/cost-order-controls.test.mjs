import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
test("cost creation is prominent and payments cannot leak across cost sections", async () => {
  const ui = await read("app/components/CostsWorkspace.tsx");
  assert.match(ui, /Add fixed cost/); assert.match(ui, /Add variable cost/);
  assert.match(ui, /editItem\(undefined,"FIXED"\)/); assert.match(ui, /editItem\(undefined,"VARIABLE"\)/);
  assert.match(ui, /item.category!==category/);
  assert.match(ui, /action:"item"/); assert.match(ui, /action:"entry"/);
});
test("order delivery details are validated, persisted and visible to preparation staff", async () => {
  const [api, ui] = await Promise.all([read("app/api/orders/route.ts"), read("app/page.tsx")]);
  assert.match(api, /fulfillment_type AS fulfillmentType/); assert.match(api, /delivery_address AS deliveryAddress/);
  assert.match(api, /fulfillmentType==="DELIVERY"&&\(!deliveryAddress/);
  assert.match(api, /payload.fulfillmentType\?\?"PICKUP"/);
  assert.match(ui, /aria-label="Order fulfillment"/); assert.match(ui, /Delivery address<textarea required/);
  assert.match(ui, /order.deliveryAddress/); assert.match(ui, /"Delivered ✓":"Collected ✓"/);
});
test("order completion dates travel from the cashier to saved preparation orders", async () => {
  const [api, ui] = await Promise.all([read("app/api/orders/route.ts"), read("app/page.tsx")]);
  assert.match(ui, /Completion date<input required type="date"/);
  assert.match(ui, /requestedDate:orderDate/);
  assert.match(ui, /order.requestedDate\|\|order.requestedTime/);
  assert.match(api, /requested_date AS requestedDate/);
  assert.match(api, /requested_date ASC NULLS LAST/);
  assert.match(api, /Choose a valid completion date/);
});
