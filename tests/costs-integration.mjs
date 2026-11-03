// Run with: node --env-file=.env.local tests/costs-integration.mjs
// Creates an isolated schema, exercises the real HTTP API, and removes its fixtures.
import assert from "node:assert/strict";
import { neon } from "@neondatabase/serverless";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const databaseUrl=process.env.DATABASE_URL??process.env.POSTGRES_URL;
if(!databaseUrl)throw new Error("DATABASE_URL is required for the isolated integration test.");
const admin=neon(databaseUrl);
const schema=`butchery_cost_test_${randomUUID().replaceAll("-","").slice(0,16)}`;
if(!/^butchery_cost_test_[a-f0-9]{16}$/.test(schema))throw new Error("Invalid test schema.");
let server;
let serverLog="";
const base="http://localhost:3007";
async function json(path,body){const response=await fetch(base+path,body?{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)}:undefined);return {status:response.status,data:await response.json()};}
try {
  await admin.query(`CREATE SCHEMA ${schema}`);
  // Neon HTTP ignores connection-string search_path options. Every fixture query
  // and application transaction explicitly uses SET LOCAL with no public fallback.
  const db={query:async(text,params=[])=>{const rows=await admin.transaction([admin.query(`SET LOCAL search_path TO "${schema}"`),admin.query(text,params)]);return rows[1];}};
  for(const name of ["products","stock_receipts","stock_receipt_lines","pos_sales","pos_sale_items","waste_records","stock_counts"]){
    // Schema copies contain no user rows. Fixture IDs are explicit.
    await admin.query(`CREATE TABLE ${schema}.${name} (LIKE public.${name} INCLUDING DEFAULTS INCLUDING CONSTRAINTS)`);
  }
  await admin.query(`ALTER TABLE ${schema}.products ADD PRIMARY KEY (id)`);
  assert.equal((await db.query("SELECT current_schema() AS name"))[0].name,schema);
  await db.query("INSERT INTO products (id,sku,name,department,unit,cost_price,selling_price,quantity,imported_at,active,vat_percent) VALUES (990001,'TEST-SPICE','Integration spice','Cost of goods','kg',10,0,30,'2026-09-01T08:00:00Z',1,15)");
  await db.query("INSERT INTO stock_receipts (id,receipt_number,supplier_id,supplier_name,invoice_number,delivery_date,total_cost,created_at) VALUES (990001,'TEST-RECEIPT',1,'Test supplier','TEST-INV','2026-09-03',200,'2026-09-03T08:00:00Z')");
  await db.query("INSERT INTO stock_receipt_lines (id,receipt_id,product_id,product_name,department,quantity,unit,cost_price,line_total,created_at) VALUES (990001,990001,990001,'Integration spice','Cost of goods',20,'kg',10,200,'2026-09-03T08:00:00Z')");
  server=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","--port","3007"],{env:{...process.env,BUTCHERY_TEST_SCHEMA:schema},stdio:["ignore","pipe","pipe"]});
  server.stdout.on("data",chunk=>{serverLog+=chunk;});server.stderr.on("data",chunk=>{serverLog+=chunk;});
  let ready=false;for(let attempt=0;attempt<60;attempt++){try{const response=await fetch(base);if(response.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}
  assert.equal(ready,true,"Integration server must start");
  let result=await json("/api/costs?period=2026-09");assert.equal(result.status,200,JSON.stringify(result.data));
  assert.equal(result.data.materials.length,1);assert.equal(result.data.materials[0].purchaseValueCents,20000);assert.equal(result.data.totals.pendingCounts,1);
  const electricity=result.data.items.find(item=>item.name==="Electricity");assert.ok(electricity);
  const entry={action:"entry",requestKey:randomUUID(),itemId:electricity.id,date:"2026-09-05",amount:"400.00",reference:"TOKEN-001"};
  assert.equal((await json("/api/costs",entry)).status,200);
  assert.equal((await json("/api/costs",entry)).status,200);
  result=await json("/api/costs?period=2026-09");assert.equal(result.data.entries.length,1);assert.equal(result.data.totals.variableCents,40000);
  const reconciliation={action:"materials",period:"2026-09",openingDeferred:"0",closingDeferred:"50.00",materials:[{productId:990001,openingQuantity:10,openingValue:"100.00",closingQuantity:8,alreadyCosted:false}]};
  result=await json("/api/costs",reconciliation);assert.equal(result.status,200,JSON.stringify(result.data));
  result=await json("/api/costs?period=2026-09");assert.equal(result.data.totals.consumedCents,22000);assert.equal(result.data.totals.closingCents,8000);assert.equal(result.data.totals.additionalCogsCents,17000);
  result=await json("/api/costs?period=2026-10");assert.equal(result.data.materials[0].openingQuantity,8);assert.equal(result.data.materials[0].openingValueCents,8000);assert.equal(result.data.openingDeferredCents,5000);
  const invalid=await json("/api/costs",{...reconciliation,materials:[{...reconciliation.materials[0],closingQuantity:31}]});assert.equal(invalid.status,400);
  result=await json("/api/costs?period=2026-09");assert.equal(result.data.materials[0].closingQuantity,8,"A rejected save must not partially update counts");
  const id=result.data.entries[0].id;assert.equal((await json("/api/costs",{action:"reverse",id,reason:"Duplicate bill correction"})).status,200);
  result=await json("/api/costs?period=2026-09");assert.equal(result.data.totals.variableCents,0);assert.equal(result.data.entries[0].status,"REVERSED");
  assert.equal((await json("/api/costs",{...reconciliation,closingDeferred:"0",materials:[{...reconciliation.materials[0],alreadyCosted:true}]})).status,200);
  result=await json("/api/costs?period=2026-09");assert.equal(result.data.totals.additionalCogsCents,0);assert.equal(result.data.totals.consumedCents,22000);
  const rows=await db.query("SELECT COUNT(*) AS count FROM cost_audit");assert.ok(Number(rows[0].count)>=3);
  assert.equal((await admin.query("SELECT COUNT(*) AS count FROM public.products WHERE id=990001"))[0].count,"0","No integration fixture may reach the live schema");
  console.log("PASS: real API receipt roll-up, idempotent expenditure, cents totals, reconciliation, carry-forward, invalid-save safety, reversals, duplicate-cost exclusion and audit history.");
} catch(error) {
  console.error(error.message);
  // Do not print server environment, credentials, or a connection URL.
  if(serverLog.includes("Error:"))console.error("Server reported an error; inspect the isolated local request before publishing.");
  process.exitCode=1;
} finally {
  if(server){server.kill("SIGTERM");await new Promise(resolve=>{server.once("exit",resolve);setTimeout(resolve,4000);});}
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  console.log("Isolated integration schema removed.");
}
