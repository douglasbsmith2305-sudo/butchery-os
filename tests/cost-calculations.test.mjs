import assert from "node:assert/strict";
import test from "node:test";
import { cents, materialCost, materialTimeline, productionCogs, costPeriod, currentCostPeriod } from "../lib/cost-calculations.ts";

const input={openingQuantity:10,openingValueCents:10000,purchasedQuantity:20,purchaseValueCents:20000,closingQuantity:8,alreadyCosted:false};
test("opening stock plus purchases less unused stock charges only consumed materials",()=>{
  const result=materialCost(input);
  assert.equal(result.closingValueCents,8000);
  assert.equal(result.consumedCents,22000);
  assert.equal(result.consumedQuantity,22);
  assert.equal(result.additionalCogsCents,22000);
});
test("weighted purchase costs reconcile exactly in cents",()=>{
  const result=materialCost({...input,openingQuantity:100,openingValueCents:100000,purchasedQuantity:50,purchaseValueCents:75000,closingQuantity:40});
  assert.equal(result.closingValueCents,46667);
  assert.equal(result.consumedCents,128333);
  assert.equal(result.closingValueCents+result.consumedCents,175000);
});
test("all unused stock remains an asset and is not charged as consumption",()=>{
  const result=materialCost({...input,closingQuantity:30});
  assert.equal(result.consumedCents,0);assert.equal(result.closingValueCents,30000);
});
test("costs already in finished unit prices are not counted twice",()=>{
  const result=materialCost({...input,alreadyCosted:true});
  assert.equal(result.consumedCents,22000);assert.equal(result.additionalCogsCents,0);
});
test("missing opening or closing counts are pending rather than assumed consumption",()=>{
  assert.equal(materialCost({...input,closingQuantity:null}).complete,false);
  assert.equal(materialCost({...input,openingQuantity:null}).additionalCogsCents,0);
});
test("impossible counts and negative balances are rejected",()=>{
  assert.throws(()=>materialCost({...input,closingQuantity:31}),/cannot exceed/);
  assert.throws(()=>materialCost({...input,openingQuantity:-1}),/non-negative/);
  assert.throws(()=>materialCost({...input,openingQuantity:0}),/Opening value/);
});
test("materials in unsold finished goods are deferred then released next month",()=>{
  assert.equal(productionCogs(22000,0,5000),17000);
  assert.equal(productionCogs(10000,5000,2000),13000);
  assert.throws(()=>productionCogs(10000,0,11000),/cannot exceed/);
});
test("currency inputs retain exact cents and reject invalid values",()=>{
  assert.equal(cents("400.10"),40010);assert.equal(cents("0.01"),1);
  assert.throws(()=>cents("0.001"));assert.throws(()=>cents("-400"));assert.throws(()=>cents("Infinity"));
});
test("monthly reporting uses Johannesburg boundaries and handles year rollover",()=>{
  const period=costPeriod("2026-01");
  assert.equal(period.previous,"2025-12");assert.equal(period.end,"2026-02-01");
  assert.equal(period.startUtc,"2025-12-31T22:00:00.000Z");
  assert.equal(currentCostPeriod(new Date("2026-10-31T22:00:00Z")),"2026-11");
  assert.throws(()=>costPeriod("2026-13"));
});
test("prior closing counts carry forward and corrected historical purchases revalue subsequent months",()=>{
  const counts=[{period:"2026-09",openingQuantity:10,openingValueCents:10000,closingQuantity:8,alreadyCosted:false},{period:"2026-10",openingQuantity:999,openingValueCents:99900,closingQuantity:3,alreadyCosted:false}];
  const receipts=[{period:"2026-09",quantity:20,valueCents:20000}];
  const october=materialTimeline("2026-10",counts,receipts);
  assert.equal(october.carried,true);assert.equal(october.openingQuantity,8);assert.equal(october.openingValueCents,8000);assert.equal(october.consumedCents,5000);
  const corrected=materialTimeline("2026-10",counts,[{...receipts[0],valueCents:35000}]);
  assert.equal(corrected.openingValueCents,12000);assert.equal(corrected.consumedCents,7500);
});
