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
  const period=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit"}).format(new Date()).slice(0,7);
  for(const [category,name,amount]of [["FIXED","Isolated Rental","1000.00"],["VARIABLE","Isolated Electricity","400.50"]]){
    let r=await request("/api/costs",{action:"item",name,category,budget:"0"});assert.equal(r.status,200,JSON.stringify(r.data));
    r=await request(`/api/costs?period=${period}`);assert.equal(r.status,200);const item=r.data.items.find(i=>i.name===name);assert.equal(item.category,category);
    const payload={action:"entry",itemId:item.id,date:`${period}-04`,amount,requestKey:randomUUID(),reference:"Isolated verification"};
    assert.equal((await request("/api/costs",payload)).status,200);assert.equal((await request("/api/costs",payload)).status,200);
  }
  const costs=(await request(`/api/costs?period=${period}`)).data;assert.equal(costs.totals.fixedCents,100000);assert.equal(costs.totals.variableCents,40050);assert.equal(costs.entries.length,2);
  const order={action:"create",customerName:"Isolated Customer",customerContact:"",destination:"BAKERY",lines:[{productId:900001,name:"Isolated order product",quantity:2,unit:"each",unitPrice:20}]};
  for(const deliveryAddress of [undefined,"   ","a".repeat(1001)])assert.equal((await request("/api/orders",{...order,fulfillmentType:"DELIVERY",deliveryAddress})).status,400);
  assert.equal((await request("/api/orders",{...order,fulfillmentType:"INVALID"})).status,400);
  assert.equal((await request("/api/orders")).data.orders.length,0);
  let r=await request("/api/orders",{...order,fulfillmentType:"DELIVERY",deliveryAddress:"  123 Test Road\nTest Suburb  "});assert.equal(r.status,200,JSON.stringify(r.data));
  const deliveryNumber=r.data.orderNumber;
  r=await request("/api/orders",{...order,fulfillmentType:"PICKUP",deliveryAddress:"Discard stale address"});assert.equal(r.status,200);
  assert.equal(r.data.deliveryAddress,null);
  r=await request("/api/orders",order);assert.equal(r.status,200);assert.equal(r.data.fulfillmentType,"PICKUP");
  const orders=(await request("/api/orders")).data;
  const delivery=orders.orders.find(o=>o.orderNumber===deliveryNumber);assert.equal(delivery.deliveryAddress,"123 Test Road\nTest Suburb");assert.equal(delivery.fulfillmentType,"DELIVERY");assert.equal(delivery.destination,"BAKERY");assert.equal(delivery.total,40);
  assert.equal(orders.items.filter(i=>i.orderId===delivery.id).length,1);
  assert.equal(Number((await query("SELECT quantity FROM products WHERE id=900001"))[0].quantity),10,"Orders must not deduct inventory before paid sale");
  console.log("PASS: custom fixed/variable items, repeated payment idempotency, monthly totals, required address validation, delivery/pickup persistence, legacy pickup default, preparation routing and unchanged inventory.");
  if(process.argv.includes("--hold")){console.log("READY for isolated browser verification on port 3008. Send SIGTERM to finish.");await new Promise(resolve=>process.once("SIGTERM",resolve));}
}finally{
  if(server){server.kill("SIGTERM");await new Promise(resolve=>{server.once("exit",resolve);setTimeout(resolve,4000);});}
  await db.query(`DROP SCHEMA "${schema}" CASCADE`);
  console.log("Isolated test schema removed.");
}
