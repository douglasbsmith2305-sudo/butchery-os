// Run against an isolated, row-free schema; never posts test records to production.
import assert from "node:assert/strict";
import { neon } from "@neondatabase/serverless";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
const db=neon(process.env.DATABASE_URL??process.env.POSTGRES_URL);
const schema=`butchery_cost_test_${randomBytes(8).toString("hex")}`;
if(!/^butchery_cost_test_[a-f0-9]{16}$/.test(schema))throw Error("Invalid test schema");
const base="http://localhost:3008";
const query=async(sql,params=[])=>{const result=await db.transaction([db.query(`SET LOCAL search_path TO "${schema}"`),db.query(sql,params)]);return result[1];};
let server;
async function request(path,payload){const r=await fetch(base+path,payload?{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)}:undefined);return {status:r.status,data:await r.json()};}
try{
  const tables=await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
  const serials=await db.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND column_default LIKE 'nextval(%'");
  await db.query(`CREATE SCHEMA "${schema}"`);
  const commands=[];
  for(const {table_name:t}of tables){
    if(!/^[a-z_0-9]+$/.test(t))throw Error("Invalid table");
    commands.push(db.query(`CREATE TABLE "${schema}"."${t}" (LIKE public."${t}" INCLUDING ALL)`));
    for(const {column_name:c}of serials.filter(s=>s.table_name===t)){
      if(!/^[a-z_0-9]+$/.test(c))throw Error("Invalid column");
      commands.push(db.query(`CREATE SEQUENCE "${schema}"."${t}_${c}_test_seq"`),db.query(`ALTER TABLE "${schema}"."${t}" ALTER COLUMN "${c}" SET DEFAULT nextval('"${schema}"."${t}_${c}_test_seq"')`));
    }
  }
  await db.transaction(commands);
  await query("INSERT INTO products (id,sku,name,department,unit,cost_price,selling_price,quantity,imported_at) VALUES (900001,'ISOLATED-ORDER','Isolated order product','Bakery','each',10,20,10,$1)",[new Date().toISOString()]);
  server=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","--port","3008"],{env:{...process.env,BUTCHERY_TEST_SCHEMA:schema},stdio:["ignore","pipe","pipe"]});
  let logs="";server.stdout.on("data",chunk=>logs+=chunk);server.stderr.on("data",chunk=>logs+=chunk);
  let ready=false;for(let i=0;i<60;i++){try{if((await fetch(base)).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}assert.ok(ready);
  const period="2026-11",date="2026-11-07";
  let r=await request("/api/receiving",{action:"create_supplier",supplierName:"Isolated VAT Supplier",paymentTermsDays:7});assert.equal(r.status,200,JSON.stringify(r.data));const supplierId=r.data.supplier.id;
  await query("INSERT INTO products (id,sku,name,department,unit,cost_price,selling_price,quantity,imported_at) VALUES (900002,'ISOLATED-VAT-ZERO','Isolated zero-rated input','Cost of goods','each',0,0,0,$1)",[new Date().toISOString()]);
  const receive=(invoiceNumber,lines,postToAccounts=true)=>request("/api/receiving",{supplierId,invoiceNumber,deliveryDate:date,lines,postToAccounts});
  r=await receive("VAT-001",[{productId:900001,quantity:10,costPrice:100}]);assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.subtotalCents,100000);assert.equal(r.data.vatCents,15000);assert.equal(r.data.invoiceTotalCents,115000);
  let stock=(await query("SELECT quantity,cost_price FROM products WHERE id=900001"))[0];assert.equal(Number(stock.quantity),20);assert.equal(Number(stock.cost_price),55,"VAT must not inflate weighted stock cost");
  let finance=(await request("/api/finance")).data;assert.equal(finance.invoices.find(i=>i.invoiceNumber==="VAT-001").amount,1150);assert.equal(finance.invoices[0].balance,1150);
  assert.equal((await receive("VAT-001",[{productId:900001,quantity:10,costPrice:100}])).status,409);
  assert.equal((await receive("VAT-INVALID",[{productId:900001,quantity:1,costPrice:100,vatPercent:17}])).status,400);
  r=await receive("VAT-002",[{productId:900001,quantity:1,costPrice:100},{productId:900002,quantity:2,costPrice:50,vatPercent:0}],false);assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.subtotalCents,20000);assert.equal(r.data.vatCents,1500);assert.equal(r.data.invoiceTotalCents,21500);
  const input=(await query("SELECT id FROM products WHERE sku='BULK-BEEF-HIND'"))[0];
  r=await receive("VAT-003",[{productId:input.id,quantity:100,costPrice:10}]);assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.vatCents,15000);assert.equal(r.data.invoiceTotalCents,115000);
  const mass=(await query("SELECT SUM(expected_quantity) AS kg FROM block_test_allocations"))[0];assert.equal(Number(mass.kg),100);
  await query("INSERT INTO stock_receipts (id,receipt_number,supplier_id,supplier_name,invoice_number,delivery_date,total_cost,created_at) VALUES (999001,'LEGACY-VAT',$1,'Isolated VAT Supplier','VAT-OLD',$2,555,$3)",[supplierId,date,new Date().toISOString()]);
  r=await request("/api/vat?period="+period);assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.recordedCount,3);assert.equal(r.data.unrecordedCount,1);assert.deepEqual(r.data.totals,{subtotalCents:220000,vatCents:31500,invoiceTotalCents:251500});assert.equal(r.data.receipts.find(x=>x.invoiceNumber==="VAT-OLD").vatCents,null);
  finance=(await request("/api/finance")).data;assert.equal(finance.invoices.length,2,"Stock-only receiving must not create a supplier payable");
  assert.equal((await request("/api/vat?period=2026-12")).data.recordedCount,0);assert.equal((await request("/api/vat?period=bad")).status,400);
  console.log("PASS: 15% receipt VAT, gross supplier payable, net stock costing, mixed zero-rated lines, block-test receiving, duplicate safety, stock-only VAT, monthly totals and untouched historical VAT.");
  if(process.argv.includes("--hold")){console.log("READY for isolated browser verification on port 3008. Send SIGTERM to finish.");await new Promise(resolve=>process.once("SIGTERM",resolve));}
}finally{
  if(server){server.kill("SIGTERM");await new Promise(resolve=>{server.once("exit",resolve);setTimeout(resolve,4000);});}
  await db.query(`DROP SCHEMA "${schema}" CASCADE`);
  console.log("Isolated test schema removed.");
}

