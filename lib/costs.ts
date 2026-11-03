import { env } from "@/lib/db";
import { costPeriod, currentCostPeriod, materialTimeline, productionCogs, PRODUCTION_DEPARTMENT } from "@/lib/cost-calculations";

let schemaReady:Promise<void>|undefined;
export function ensureCostSchema() {
  return schemaReady??=setupCostSchema().catch(error=>{schemaReady=undefined;throw error;});
}

async function setupCostSchema() {
  await env.DB.atomic([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS cost_items (id SERIAL PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL CHECK(category IN ('FIXED','VARIABLE')), budget_cents BIGINT NOT NULL DEFAULT 0 CHECK(budget_cents>=0), active INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL, UNIQUE(name,category))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS cost_entries (id SERIAL PRIMARY KEY, request_key TEXT NOT NULL UNIQUE, item_id INTEGER NOT NULL REFERENCES cost_items(id), item_name TEXT NOT NULL, category TEXT NOT NULL, entry_date TEXT NOT NULL, amount_cents BIGINT NOT NULL CHECK(amount_cents>0), reference TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'POSTED', reversal_reason TEXT, created_at TEXT NOT NULL)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS cost_entries_month_idx ON cost_entries(entry_date,status)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS production_cost_counts (period TEXT NOT NULL, product_id INTEGER NOT NULL REFERENCES products(id), product_name TEXT NOT NULL, unit TEXT NOT NULL, opening_quantity NUMERIC(18,3), opening_value_cents BIGINT, closing_quantity NUMERIC(18,3), closing_value_cents BIGINT, already_costed INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, PRIMARY KEY(period,product_id))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS cost_months (period TEXT PRIMARY KEY, initial_deferred_cents BIGINT NOT NULL DEFAULT 0, closing_deferred_cents BIGINT NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS cost_audit (id SERIAL PRIMARY KEY, action TEXT NOT NULL, reference TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS departments (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, code TEXT NOT NULL UNIQUE, active INTEGER NOT NULL DEFAULT 1)"),
    env.DB.prepare("INSERT OR IGNORE INTO departments (name,code,active) VALUES (?,'COGS',1)").bind(PRODUCTION_DEPARTMENT),
  ]);
  const now=new Date().toISOString();
  const seeded=await env.DB.prepare("SELECT COUNT(*) AS count FROM cost_items").first<{count:number}>();
  if(Number(seeded?.count??0)>0)return;
  await env.DB.atomic([
    ...[["Rent","FIXED"],["Insurance","FIXED"],["Salaries & wages","FIXED"],["Electricity","VARIABLE"],["Water","VARIABLE"],["Fuel & transport","VARIABLE"],["Repairs & maintenance","VARIABLE"]].map(([name,category])=>env.DB.prepare("INSERT OR IGNORE INTO cost_items (name,category,budget_cents,updated_at) VALUES (?,?,0,?)").bind(name,category,now)),
  ]);
}

export type CostItem = {id:number;name:string;category:"FIXED"|"VARIABLE";budgetCents:number;active:number};
export type CostEntry = {id:number;itemId:number;itemName:string;category:"FIXED"|"VARIABLE";date:string;amountCents:number;reference:string;notes:string;status:string;reversalReason:string|null};
export type MaterialRow = {productId:number;name:string;sku:string;unit:string;stockQuantity:number;unitCost:number;openingQuantity:number|null;openingValueCents:number|null;closingQuantity:number|null;purchasedQuantity:number;purchaseValueCents:number;alreadyCosted:boolean;carried:boolean;closingValueCents:number;consumedCents:number;additionalCogsCents:number;consumedQuantity:number;complete:boolean};
export type CostData = Awaited<ReturnType<typeof loadCosts>>;

export async function loadCosts(period=currentCostPeriod()) {
  const range=costPeriod(period);
  const [items,entries,products,counts,purchases,months,sales,losses] = await Promise.all([
    env.DB.prepare("SELECT id,name,category,budget_cents AS budgetCents,active FROM cost_items ORDER BY category,name").all<CostItem>(),
    env.DB.prepare("SELECT id,item_id AS itemId,item_name AS itemName,category,entry_date AS date,amount_cents AS amountCents,reference,notes,status,reversal_reason AS reversalReason FROM cost_entries WHERE entry_date>=? AND entry_date<? ORDER BY entry_date DESC,id DESC").bind(range.start,range.end).all<CostEntry>(),
    env.DB.prepare("SELECT p.id AS productId,p.name,p.sku,p.unit,p.quantity AS stockQuantity,p.cost_price AS unitCost FROM products p WHERE (p.active=1 AND p.department=?) OR p.id IN (SELECT product_id FROM production_cost_counts WHERE period<=?) OR p.id IN (SELECT l.product_id FROM stock_receipt_lines l JOIN stock_receipts r ON r.id=l.receipt_id WHERE l.department=? AND r.delivery_date<?) ORDER BY p.name").bind(PRODUCTION_DEPARTMENT,period,PRODUCTION_DEPARTMENT,range.end).all<{productId:number;name:string;sku:string;unit:string;stockQuantity:number;unitCost:number}>(),
    env.DB.prepare("SELECT period,product_id AS productId,opening_quantity AS openingQuantity,opening_value_cents AS openingValueCents,closing_quantity AS closingQuantity,already_costed AS alreadyCosted FROM production_cost_counts WHERE period<=? ORDER BY period").bind(period).all<{period:string;productId:number;openingQuantity:number|null;openingValueCents:number|null;closingQuantity:number|null;alreadyCosted:number}>(),
    env.DB.prepare("SELECT l.product_id AS productId,l.product_name AS productName,l.quantity,l.line_total AS total,r.receipt_number AS receiptNumber,r.invoice_number AS invoiceNumber,r.supplier_name AS supplierName,r.delivery_date AS deliveryDate FROM stock_receipt_lines l JOIN stock_receipts r ON r.id=l.receipt_id WHERE r.delivery_date<? AND (l.department=? OR l.product_id IN (SELECT id FROM products WHERE department=?) OR l.product_id IN (SELECT product_id FROM production_cost_counts WHERE period<=?)) ORDER BY r.delivery_date,r.id").bind(range.end,PRODUCTION_DEPARTMENT,PRODUCTION_DEPARTMENT,period).all<{productId:number;productName:string;quantity:number;total:number;receiptNumber:string;invoiceNumber:string;supplierName:string;deliveryDate:string}>(),
    env.DB.prepare("SELECT period,initial_deferred_cents AS initialDeferredCents,closing_deferred_cents AS closingDeferredCents,notes FROM cost_months WHERE period IN (?,?)").bind(period,range.previous).all<{period:string;initialDeferredCents:number;closingDeferredCents:number;notes:string}>(),
    env.DB.prepare("SELECT COALESCE(SUM(i.line_total/(1+COALESCE(p.vat_percent,15)/100.0)),0) AS netRevenue,COALESCE(SUM(i.quantity*p.cost_price),0) AS soldCogs FROM pos_sale_items i JOIN pos_sales s ON s.id=i.sale_id JOIN products p ON p.id=i.product_id WHERE s.status='PAID' AND s.created_at>=? AND s.created_at<?").bind(range.startUtc,range.endUtc).first<{netRevenue:number;soldCogs:number}>(),
    env.DB.prepare("SELECT (SELECT COALESCE(SUM(w.value),0) FROM waste_records w JOIN products p ON p.id=w.product_id WHERE w.created_at>=? AND w.created_at<? AND p.department<>?) + (SELECT COALESCE(SUM(-c.variance*p.cost_price),0) FROM stock_counts c JOIN products p ON p.id=c.product_id WHERE c.created_at>=? AND c.created_at<? AND c.variance<0 AND p.department<>?) AS value").bind(range.startUtc,range.endUtc,PRODUCTION_DEPARTMENT,range.startUtc,range.endUtc,PRODUCTION_DEPARTMENT).first<{value:number}>(),
  ]);
  const materials:MaterialRow[]=products.results.map(product=>{
    const history=counts.results.filter(row=>row.productId===product.productId).map(row=>({...row,openingQuantity:row.openingQuantity===null?null:Number(row.openingQuantity),openingValueCents:row.openingValueCents===null?null:Number(row.openingValueCents),closingQuantity:row.closingQuantity===null?null:Number(row.closingQuantity),alreadyCosted:!!row.alreadyCosted}));
    const receipts=purchases.results.filter(row=>row.productId===product.productId).map(row=>({period:row.deliveryDate.slice(0,7),quantity:Number(row.quantity),valueCents:Math.round(Number(row.total)*100)}));
    try {return {...product,...materialTimeline(period,history,receipts)};}
    catch {const saved=history.find(row=>row.period===period);return {...product,openingQuantity:saved?.openingQuantity??null,openingValueCents:saved?.openingValueCents??null,closingQuantity:saved?.closingQuantity??null,purchasedQuantity:receipts.filter(row=>row.period===period).reduce((sum,row)=>sum+row.quantity,0),purchaseValueCents:receipts.filter(row=>row.period===period).reduce((sum,row)=>sum+row.valueCents,0),alreadyCosted:saved?.alreadyCosted??false,carried:false,complete:false,closingValueCents:0,consumedCents:0,additionalCogsCents:0,consumedQuantity:0};}
  });
  const month=months.results.find(row=>row.period===period);
  const previousMonth=months.results.find(row=>row.period===range.previous);
  const openingDeferredCents=Number(previousMonth?.closingDeferredCents??month?.initialDeferredCents??0);
  const closingDeferredCents=Number(month?.closingDeferredCents??openingDeferredCents);
  const normalizedEntries=entries.results.map(row=>({...row,amountCents:Number(row.amountCents)}));
  const fixedCents=normalizedEntries.filter(row=>row.status==="POSTED"&&row.category==="FIXED").reduce((sum,row)=>sum+row.amountCents,0);
  const variableCents=normalizedEntries.filter(row=>row.status==="POSTED"&&row.category==="VARIABLE").reduce((sum,row)=>sum+row.amountCents,0);
  const consumedCents=materials.reduce((sum,row)=>sum+row.consumedCents,0);
  const additionalConsumedCents=materials.reduce((sum,row)=>sum+row.additionalCogsCents,0);
  let additionalCogsCents=0;let reconciliationError="";
  try {additionalCogsCents=productionCogs(additionalConsumedCents,openingDeferredCents,closingDeferredCents);} catch(error){reconciliationError=error instanceof Error?error.message:"Recheck deferred material costs.";}
  return {period,previousPeriod:range.previous,department:PRODUCTION_DEPARTMENT,items:items.results.map(row=>({...row,budgetCents:Number(row.budgetCents)})),entries:normalizedEntries,materials,purchases:purchases.results.filter(row=>row.deliveryDate>=range.start).map(row=>({...row,total:Number(row.total),quantity:Number(row.quantity)})),openingDeferredCents,closingDeferredCents,deferredCarried:!!previousMonth,notes:month?.notes??"",carriedInto:null as string|null,recordedLossCents:Math.round(Number(losses?.value??0)*100),netRevenueCents:Math.round(Number(sales?.netRevenue??0)*100),soldCogsCents:Math.round(Number(sales?.soldCogs??0)*100),totals:{fixedCents,variableCents,operatingCents:fixedCents+variableCents,consumedCents,additionalConsumedCents,additionalCogsCents,purchaseCents:materials.reduce((sum,row)=>sum+row.purchaseValueCents,0),closingCents:materials.reduce((sum,row)=>sum+row.closingValueCents,0),pendingCounts:materials.filter(row=>!row.complete).length,budgetCents:items.results.filter(row=>row.active).reduce((sum,row)=>sum+Number(row.budgetCents),0)},reconciliationError};
}
