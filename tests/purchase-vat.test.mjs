import assert from "node:assert/strict";
import test from "node:test";
import { purchaseLineCents, purchaseVatTotals } from "../lib/purchase-vat.ts";
test("received stock adds 15% to the VAT-exclusive invoice subtotal",()=>{
  assert.deepEqual(purchaseVatTotals([{quantity:10,costPrice:100}]),{subtotalCents:100000,taxableCents:100000,vatCents:15000,invoiceTotalCents:115000,vatRate:15});
});
test("mixed zero-rated goods remain in stock cost without added VAT",()=>{
  const totals=purchaseVatTotals([{quantity:10,costPrice:100},{quantity:2,costPrice:50,vatPercent:0}]);
  assert.equal(totals.subtotalCents,110000);assert.equal(totals.vatCents,15000);assert.equal(totals.invoiceTotalCents,125000);
});
test("invoice VAT is rounded once on the taxable subtotal with decimal-safe cents",()=>{
  assert.equal(purchaseLineCents(1,1.005),101);
  assert.equal(purchaseLineCents(.1,.2),2);
  assert.equal(purchaseVatTotals(Array.from({length:4},()=>({quantity:1,costPrice:.01}))).vatCents,1);
  assert.equal(purchaseVatTotals([{quantity:1.234,costPrice:12.34}]).subtotalCents,1523);
});
test("invalid rates and unsafe invoice amounts are rejected",()=>{
  for(const line of [{quantity:1,costPrice:10,vatPercent:14},{quantity:-1,costPrice:10},{quantity:Infinity,costPrice:10},{quantity:1e20,costPrice:1e20}])assert.throws(()=>purchaseVatTotals([line]));
  assert.equal(purchaseVatTotals([]).invoiceTotalCents,0);
});
