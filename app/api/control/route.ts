import { env } from "@/lib/db";

async function ensureSchema() {
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS waste_records (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, product_name TEXT NOT NULL, quantity REAL NOT NULL, reason TEXT NOT NULL, value REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS stock_counts (id INTEGER PRIMARY KEY AUTOINCREMENT, count_number TEXT NOT NULL, product_id INTEGER NOT NULL, product_name TEXT NOT NULL, expected_quantity REAL NOT NULL, counted_quantity REAL NOT NULL, variance REAL NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS business_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS price_history (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, old_price REAL NOT NULL, new_price REAL NOT NULL, reason TEXT NOT NULL, effective_at TEXT NOT NULL)"),
    env.DB.prepare("ALTER TABLE products ADD COLUMN IF NOT EXISTS target_margin_percent DOUBLE PRECISION NOT NULL DEFAULT 0"),
    env.DB.prepare("ALTER TABLE products ADD COLUMN IF NOT EXISTS block_test_profile_code TEXT"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS price_decrease_approvals (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, product_name TEXT NOT NULL, receipt_number TEXT NOT NULL, old_price REAL NOT NULL, proposed_price REAL NOT NULL, old_cost REAL NOT NULL, new_cost REAL NOT NULL, target_margin_percent REAL NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', requested_at TEXT NOT NULL, decided_at TEXT, FOREIGN KEY(product_id) REFERENCES products(id))"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS price_decrease_status_idx ON price_decrease_approvals(status, requested_at)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_price_history_product_effective ON price_history(product_id,effective_at)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS scale_devices (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, brand TEXT NOT NULL, connector_type TEXT NOT NULL, location TEXT NOT NULL, endpoint TEXT, database_table TEXT, active INTEGER NOT NULL DEFAULT 1, last_sync_at TEXT, last_sync_status TEXT NOT NULL DEFAULT 'NEVER', created_at TEXT NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS scale_sync_jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, device_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', source TEXT NOT NULL, item_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, completed_at TEXT, error TEXT, FOREIGN KEY(device_id) REFERENCES scale_devices(id))"),
    env.DB.prepare("ALTER TABLE scale_devices ADD COLUMN IF NOT EXISTS scale_group TEXT NOT NULL DEFAULT 'All scales'"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS scheduled_price_changes (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, old_price REAL NOT NULL, new_price REAL NOT NULL, reason TEXT NOT NULL, effective_at TEXT NOT NULL, target_group TEXT NOT NULL DEFAULT 'All scales', status TEXT NOT NULL DEFAULT 'SCHEDULED', created_at TEXT NOT NULL)"),
  ]);
  await env.DB.prepare("UPDATE products SET target_margin_percent=CASE WHEN selling_price>cost_price AND selling_price>0 THEN ((selling_price-cost_price)/selling_price)*100 ELSE 30 END WHERE target_margin_percent<=0").run();
  await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO business_settings (key,value,updated_at) VALUES ('business_name','George''s Butchery',?)").bind(new Date().toISOString()),
    env.DB.prepare("INSERT OR IGNORE INTO business_settings (key,value,updated_at) VALUES ('yield_tolerance','2',?)").bind(new Date().toISOString()),
    env.DB.prepare("INSERT OR IGNORE INTO business_settings (key,value,updated_at) VALUES ('vat_rate','15',?)").bind(new Date().toISOString()),
    env.DB.prepare("INSERT OR IGNORE INTO business_settings (key,value,updated_at) VALUES ('default_terms','30',?)").bind(new Date().toISOString()),
    env.DB.prepare("INSERT OR IGNORE INTO business_settings (key,value,updated_at) VALUES ('low_stock_threshold','5',?)").bind(new Date().toISOString()),
    env.DB.prepare("INSERT OR IGNORE INTO business_settings (key,value,updated_at) VALUES ('order_lead_time','60',?)").bind(new Date().toISOString()),
    env.DB.prepare("INSERT OR IGNORE INTO business_settings (key,value,updated_at) VALUES ('receipt_footer','Thank you for supporting George''s Butchery',?)").bind(new Date().toISOString()),
    env.DB.prepare("INSERT OR IGNORE INTO business_settings (key,value,updated_at) VALUES ('target_net_margin','8',?)").bind(new Date().toISOString()),
    env.DB.prepare("INSERT OR IGNORE INTO business_settings (key,value,updated_at) VALUES ('monthly_operating_expenses','0',?)").bind(new Date().toISOString()),
  ]);
  const due=await env.DB.prepare("SELECT id,product_id AS productId,old_price AS oldPrice,new_price AS newPrice,reason,effective_at AS effectiveAt,target_group AS targetGroup FROM scheduled_price_changes WHERE status='SCHEDULED' AND effective_at<=? ORDER BY effective_at,id").bind(new Date().toISOString()).all<{id:number;productId:number;oldPrice:number;newPrice:number;reason:string;effectiveAt:string;targetGroup:string}>();
  for(const change of due.results){await env.DB.batch([env.DB.prepare("UPDATE products SET selling_price=? WHERE id=?").bind(change.newPrice,change.productId),env.DB.prepare("INSERT INTO price_history (product_id,old_price,new_price,reason,effective_at) VALUES (?,?,?,?,?)").bind(change.productId,change.oldPrice,change.newPrice,change.reason,change.effectiveAt),env.DB.prepare("UPDATE scheduled_price_changes SET status='PUBLISHED' WHERE id=?").bind(change.id)]);const devices=change.targetGroup==="All scales"?await env.DB.prepare("SELECT id FROM scale_devices WHERE active=1").all<{id:number}>():await env.DB.prepare("SELECT id FROM scale_devices WHERE active=1 AND scale_group=?").bind(change.targetGroup).all<{id:number}>();if(devices.results.length)await env.DB.batch(devices.results.flatMap(device=>[env.DB.prepare("INSERT INTO scale_sync_jobs (device_id,status,source,item_count,created_at) VALUES (?,'PENDING','SCHEDULED_PRICE_PUBLISH',1,?)").bind(device.id,change.effectiveAt),env.DB.prepare("UPDATE scale_devices SET last_sync_status='PENDING' WHERE id=?").bind(device.id)]));}
}

export async function GET() {
  await ensureSchema();
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0); const monthStartIso=monthStart.toISOString();
  const [products, wastes, counts, settings, sales, supplierInvoices, productSales, priceHistory, priceApprovals, monthWaste, monthVariance] = await Promise.all([
    env.DB.prepare("SELECT id,sku,barcode,name,department,unit,cost_price AS costPrice,selling_price AS sellingPrice,target_margin_percent AS targetMarginPercent,quantity FROM products WHERE block_test_profile_code IS NULL ORDER BY name").all(),
    env.DB.prepare("SELECT id,product_id AS productId,product_name AS productName,quantity,reason,value,created_at AS createdAt FROM waste_records ORDER BY id DESC LIMIT 100").all(),
    env.DB.prepare("SELECT id,count_number AS countNumber,product_id AS productId,product_name AS productName,expected_quantity AS expectedQuantity,counted_quantity AS countedQuantity,variance,reason,created_at AS createdAt FROM stock_counts ORDER BY id DESC LIMIT 100").all(),
    env.DB.prepare("SELECT key,value FROM business_settings ORDER BY key").all(),
    env.DB.prepare("SELECT total,payment_method AS paymentMethod,status,created_at AS createdAt FROM pos_sales ORDER BY id DESC LIMIT 1000").all(),
    env.DB.prepare("SELECT amount,balance,status,due_date AS dueDate FROM supplier_invoices ORDER BY id DESC LIMIT 1000").all(),
    env.DB.prepare("SELECT p.id,p.name,p.department,p.unit,p.cost_price AS costPrice,p.selling_price AS sellingPrice,p.target_margin_percent AS targetMarginPercent,p.quantity AS stockQuantity,COALESCE(SUM(CASE WHEN s.status='PAID' AND s.created_at>=? THEN i.quantity ELSE 0 END),0) AS soldQuantity,COALESCE(SUM(CASE WHEN s.status='PAID' AND s.created_at>=? THEN i.line_total ELSE 0 END),0) AS revenue FROM products p LEFT JOIN pos_sale_items i ON i.product_id=p.id LEFT JOIN pos_sales s ON s.id=i.sale_id WHERE p.block_test_profile_code IS NULL GROUP BY p.id,p.name,p.department,p.unit,p.cost_price,p.selling_price,p.target_margin_percent,p.quantity ORDER BY revenue DESC,p.name").bind(monthStartIso,monthStartIso).all(),
    env.DB.prepare("SELECT h.id,h.product_id AS productId,p.name AS productName,h.old_price AS oldPrice,h.new_price AS newPrice,h.reason,h.effective_at AS effectiveAt FROM price_history h JOIN products p ON p.id=h.product_id ORDER BY h.id DESC LIMIT 100").all(),
    env.DB.prepare("SELECT id,product_id AS productId,product_name AS productName,receipt_number AS receiptNumber,old_price AS oldPrice,proposed_price AS proposedPrice,old_cost AS oldCost,new_cost AS newCost,target_margin_percent AS targetMarginPercent,reason,status,requested_at AS requestedAt,decided_at AS decidedAt FROM price_decrease_approvals ORDER BY CASE WHEN status='PENDING' THEN 0 ELSE 1 END,id DESC LIMIT 100").all(),
    env.DB.prepare("SELECT COALESCE(SUM(value),0) AS value FROM waste_records WHERE created_at>=?").bind(monthStartIso).first<{value:number}>(),
    env.DB.prepare("SELECT COALESCE(SUM(CASE WHEN c.variance<0 THEN -c.variance*p.cost_price ELSE 0 END),0) AS value FROM stock_counts c JOIN products p ON p.id=c.product_id WHERE c.created_at>=?").bind(monthStartIso).first<{value:number}>(),
  ]);
  const productRows = products.results as Array<{ quantity: number; costPrice: number; sellingPrice: number }>;
  const saleRows = sales.results as Array<{ total: number; status: string }>;
  const wasteRows = wastes.results as Array<{ quantity: number; value: number }>;
  const invoiceRows = supplierInvoices.results as Array<{ balance: number; status: string }>;
  const performance = productSales.results as Array<{ id:number;name:string;department:string;unit:string;costPrice:number;sellingPrice:number;targetMarginPercent:number;stockQuantity:number;soldQuantity:number;revenue:number }>;
  const byproducts = performance.filter(p => /(^|\s)(bone|bones)(\s|$)|fat|waste|vet|been|bene/i.test(p.name));
  const byproductCostDrag = byproducts.reduce((sum,p)=>sum+Math.max(0,p.costPrice-p.sellingPrice)*p.stockQuantity,0);
  const saleableStockKg = performance.filter(p=>!byproducts.some(b=>b.id===p.id)&&p.unit.toLowerCase()==="kg").reduce((sum,p)=>sum+p.stockQuantity,0);
  const settingMap=Object.fromEntries((settings.results as Array<{ key: string; value: string }>).map(item => [item.key, item.value]));
  const monthRevenue=performance.reduce((sum,p)=>sum+p.revenue,0); const monthCogs=performance.reduce((sum,p)=>sum+p.soldQuantity*p.costPrice,0); const monthLosses=Number(monthWaste?.value??0)+Number(monthVariance?.value??0)+byproductCostDrag; const operatingExpenses=Number(settingMap.monthly_operating_expenses??0); const targetNetMargin=Number(settingMap.target_net_margin??8); const totalCostBurden=monthCogs+monthLosses+operatingExpenses; const targetRevenue=totalCostBurden/Math.max(.05,1-targetNetMargin/100);
  return Response.json({ products: products.results, wastes: wastes.results, counts: counts.results, productPerformance: performance, priceHistory: priceHistory.results, priceApprovals: priceApprovals.results, pricing: { byproducts, byproductCostDrag, saleableStockKg, recoveryPerKg: saleableStockKg ? byproductCostDrag/saleableStockKg : 0, monthRevenue, monthCogs, monthWaste:Number(monthWaste?.value??0), monthVarianceLoss:Number(monthVariance?.value??0), operatingExpenses, targetNetMargin, totalCostBurden, netProfit:monthRevenue-totalCostBurden, targetRevenue, revenueGap:Math.max(0,targetRevenue-monthRevenue), portfolioUplift:monthRevenue?Math.max(1,targetRevenue/monthRevenue):1 }, settings: settingMap, report: { revenue: saleRows.filter(s => s.status === "PAID").reduce((sum, sale) => sum + sale.total, 0), stockValue: productRows.reduce((sum, product) => sum + product.quantity * product.costPrice, 0), retailValue: productRows.reduce((sum, product) => sum + product.quantity * product.sellingPrice, 0), wasteKg: wasteRows.reduce((sum, waste) => sum + waste.quantity, 0), wasteValue: wasteRows.reduce((sum, waste) => sum + waste.value, 0), supplierBalance: invoiceRows.filter(i => i.status === "OPEN").reduce((sum, invoice) => sum + invoice.balance, 0), productCount: productRows.length } });
}

export async function POST(request: Request) {
  await ensureSchema();
  const payload = await request.json() as { action?: string; productId?: number; approvalId?:number; decision?:string; quantity?: number; countedQuantity?: number; reason?: string; settings?: Record<string,string>; prices?: Array<{ productId:number; newPrice:number }>; targetMargins?:Array<{productId:number;targetMarginPercent:number}>; effectiveAt?:string; targetGroup?:string };
  const now = new Date().toISOString();
  if (payload.action === "waste") {
    const product = await env.DB.prepare("SELECT id,name,quantity,cost_price AS costPrice FROM products WHERE id=?").bind(payload.productId).first<{ id: number; name: string; quantity: number; costPrice: number }>(); const quantity = Number(payload.quantity) || 0;
    if (!product || quantity <= 0 || quantity > product.quantity || !payload.reason?.trim()) return Response.json({ error: "Product, available quantity and reason are required" }, { status: 400 });
    await env.DB.batch([env.DB.prepare("UPDATE products SET quantity=quantity-? WHERE id=? AND quantity>=?").bind(quantity, product.id, quantity), env.DB.prepare("INSERT INTO waste_records (product_id,product_name,quantity,reason,value,created_at) VALUES (?,?,?,?,?,?)").bind(product.id, product.name, quantity, payload.reason.trim(), quantity * product.costPrice, now)]);
    return Response.json({ ok: true, reference: `WST-${Date.now().toString().slice(-8)}` });
  }
  if (payload.action === "stock_count") {
    const product = await env.DB.prepare("SELECT id,name,quantity FROM products WHERE id=?").bind(payload.productId).first<{ id: number; name: string; quantity: number }>(); const counted = Number(payload.countedQuantity);
    if (!product || counted < 0 || !payload.reason?.trim()) return Response.json({ error: "Product, counted quantity and reason are required" }, { status: 400 });
    const countNumber = `CNT-${Date.now().toString().slice(-8)}`; const variance = counted - product.quantity;
    await env.DB.batch([env.DB.prepare("UPDATE products SET quantity=? WHERE id=?").bind(counted, product.id), env.DB.prepare("INSERT INTO stock_counts (count_number,product_id,product_name,expected_quantity,counted_quantity,variance,reason,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(countNumber, product.id, product.name, product.quantity, counted, variance, payload.reason.trim(), now)]);
    return Response.json({ ok: true, reference: countNumber, variance });
  }
  if (payload.action === "settings") {
    const allowed = ["business_name","yield_tolerance","vat_rate","default_terms","low_stock_threshold","order_lead_time","receipt_footer","target_net_margin","monthly_operating_expenses"]; const entries = Object.entries(payload.settings ?? {}).filter(([key]) => allowed.includes(key));
    if (!entries.length) return Response.json({ error: "No settings supplied" }, { status: 400 });
    await env.DB.batch(entries.map(([key,value]) => env.DB.prepare("INSERT INTO business_settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(key, String(value), now)));
    return Response.json({ ok: true, reference: "SETTINGS-SAVED" });
  }
  if(payload.action==="price_decrease_decision"){
    const approval=await env.DB.prepare("SELECT id,product_id AS productId,product_name AS productName,old_price AS oldPrice,proposed_price AS proposedPrice,status FROM price_decrease_approvals WHERE id=?").bind(payload.approvalId).first<{id:number;productId:number;productName:string;oldPrice:number;proposedPrice:number;status:string}>();
    if(!approval||approval.status!=="PENDING")return Response.json({error:"This price request is no longer pending."},{status:409});
    const approved=payload.decision==="APPROVE";
    if(approved){
      await env.DB.batch([env.DB.prepare("UPDATE products SET selling_price=? WHERE id=?").bind(approval.proposedPrice,approval.productId),env.DB.prepare("INSERT INTO price_history (product_id,old_price,new_price,reason,effective_at) VALUES (?,?,?,?,?)").bind(approval.productId,approval.oldPrice,approval.proposedPrice,`Back Office approved decrease · ${payload.reason?.trim()||"Received cost-based margin price"}`,now),env.DB.prepare("UPDATE price_decrease_approvals SET status='APPROVED',decided_at=? WHERE id=?").bind(now,approval.id)]);
      const devices=await env.DB.prepare("SELECT id FROM scale_devices WHERE active=1 ORDER BY id").all<{id:number}>();if(devices.results.length)await env.DB.batch(devices.results.flatMap(device=>[env.DB.prepare("INSERT INTO scale_sync_jobs (device_id,status,source,item_count,created_at) VALUES (?,'PENDING','APPROVED_PRICE_DECREASE',1,?)").bind(device.id,now),env.DB.prepare("UPDATE scale_devices SET last_sync_status='PENDING' WHERE id=?").bind(device.id)]));
      return Response.json({ok:true,approved:true,productName:approval.productName,newPrice:approval.proposedPrice,scalesQueued:devices.results.length});
    }
    await env.DB.prepare("UPDATE price_decrease_approvals SET status='REJECTED',decided_at=? WHERE id=?").bind(now,approval.id).run();return Response.json({ok:true,approved:false,productName:approval.productName});
  }
  if (payload.action === "publish_prices") {
    const prices=(payload.prices??[]).filter(item=>item.productId&&Number(item.newPrice)>0); if(!prices.length) return Response.json({error:"No valid product prices supplied"},{status:400});
    const margins=(payload.targetMargins??[]).filter(item=>item.productId&&Number(item.targetMarginPercent)>=0&&Number(item.targetMarginPercent)<90);if(margins.length)await env.DB.batch(margins.map(item=>env.DB.prepare("UPDATE products SET target_margin_percent=? WHERE id=?").bind(item.targetMarginPercent,item.productId)));
    const products=await env.DB.prepare(`SELECT id,selling_price AS sellingPrice FROM products WHERE id IN (${prices.map(()=>"?").join(",")})`).bind(...prices.map(p=>p.productId)).all<{id:number;sellingPrice:number}>(); const current=new Map(products.results.map(p=>[p.id,p.sellingPrice]));
    const effectiveAt=payload.effectiveAt?new Date(payload.effectiveAt).toISOString():now;const targetGroup=payload.targetGroup?.trim()||"All scales";if(new Date(effectiveAt).getTime()>Date.now()+30000){await env.DB.batch(prices.flatMap(item=>{const old=current.get(item.productId);return old===undefined?[]:[env.DB.prepare("INSERT INTO scheduled_price_changes (product_id,old_price,new_price,reason,effective_at,target_group,status,created_at) VALUES (?,?,?,?,?,?,'SCHEDULED',?)").bind(item.productId,old,item.newPrice,payload.reason?.trim()||"Scheduled owner pricing update",effectiveAt,targetGroup,now)];}));return Response.json({ok:true,reference:`PRICE-SCHEDULE-${Date.now().toString().slice(-8)}`,updated:prices.length,scheduled:true,effectiveAt,targetGroup,scalesQueued:0});}
    await env.DB.batch(prices.flatMap(item=>{const old=current.get(item.productId);if(old===undefined)return[];return[env.DB.prepare("UPDATE products SET selling_price=? WHERE id=?").bind(item.newPrice,item.productId),env.DB.prepare("INSERT INTO price_history (product_id,old_price,new_price,reason,effective_at) VALUES (?,?,?,?,?)").bind(item.productId,old,item.newPrice,payload.reason?.trim()||"Owner pricing update",now)];}));
    const scaleDevices=targetGroup==="All scales"?await env.DB.prepare("SELECT id FROM scale_devices WHERE active=1 ORDER BY id").all<{id:number}>():await env.DB.prepare("SELECT id FROM scale_devices WHERE active=1 AND scale_group=? ORDER BY id").bind(targetGroup).all<{id:number}>();
    if(scaleDevices.results.length){await env.DB.batch(scaleDevices.results.flatMap(device=>[env.DB.prepare("INSERT INTO scale_sync_jobs (device_id,status,source,item_count,created_at) VALUES (?,'PENDING','GLOBAL_PRICE_PUBLISH',?,?)").bind(device.id,prices.length,now),env.DB.prepare("UPDATE scale_devices SET last_sync_status='PENDING' WHERE id=?").bind(device.id)]));}
    return Response.json({ok:true,reference:`PRICE-${Date.now().toString().slice(-8)}`,updated:prices.length,scalesQueued:scaleDevices.results.length});
  }
  return Response.json({ error: "Unknown control action" }, { status: 400 });
}
