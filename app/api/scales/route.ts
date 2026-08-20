import { env } from "@/lib/db";
import { decodeWeightedBarcode } from "@/lib/scales/gateway";

async function ensureSchema() {
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS scale_devices (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, brand TEXT NOT NULL, connector_type TEXT NOT NULL, location TEXT NOT NULL, endpoint TEXT, database_table TEXT, active INTEGER NOT NULL DEFAULT 1, last_sync_at TEXT, last_sync_status TEXT NOT NULL DEFAULT 'NEVER', created_at TEXT NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS scale_product_mappings (id INTEGER PRIMARY KEY AUTOINCREMENT, device_id INTEGER NOT NULL, product_id INTEGER NOT NULL, plu TEXT NOT NULL, barcode_prefix TEXT NOT NULL DEFAULT '20', label_name TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, last_synced_price REAL, updated_at TEXT NOT NULL, UNIQUE(device_id,product_id), UNIQUE(device_id,plu), FOREIGN KEY(device_id) REFERENCES scale_devices(id), FOREIGN KEY(product_id) REFERENCES products(id))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS scale_sync_jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, device_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', source TEXT NOT NULL, item_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, completed_at TEXT, error TEXT, FOREIGN KEY(device_id) REFERENCES scale_devices(id))"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS scale_sync_jobs_device_status_idx ON scale_sync_jobs(device_id,status,created_at)"),
    env.DB.prepare("ALTER TABLE scale_devices ADD COLUMN IF NOT EXISTS scale_group TEXT NOT NULL DEFAULT 'All scales'"),
    env.DB.prepare("ALTER TABLE scale_devices ADD COLUMN IF NOT EXISTS last_heartbeat_at TEXT"),
    env.DB.prepare("ALTER TABLE scale_product_mappings ADD COLUMN IF NOT EXISTS barcode_mode TEXT NOT NULL DEFAULT 'PRICE'"),
    env.DB.prepare("ALTER TABLE scale_product_mappings ADD COLUMN IF NOT EXISTS label_format TEXT NOT NULL DEFAULT 'Butchery Standard'"),
    env.DB.prepare("ALTER TABLE scale_product_mappings ADD COLUMN IF NOT EXISTS tare_kg DOUBLE PRECISION NOT NULL DEFAULT 0"),
    env.DB.prepare("ALTER TABLE scale_product_mappings ADD COLUMN IF NOT EXISTS shelf_life_days INTEGER NOT NULL DEFAULT 4"),
    env.DB.prepare("ALTER TABLE scale_product_mappings ADD COLUMN IF NOT EXISTS packed_on INTEGER NOT NULL DEFAULT 1"),
  ]);
  const now=new Date().toISOString();
  await env.DB.prepare("INSERT OR IGNORE INTO scale_devices (name,brand,connector_type,location,endpoint,database_table,active,last_sync_status,created_at) VALUES ('Front Counter Scale 1','DIGI / Teraoka','MYSQL_BRIDGE','Butcher counter','','plu_master',1,'NEVER',?)").bind(now).run();
}

const productSelect="SELECT m.id,m.device_id AS deviceId,m.product_id AS productId,m.plu,m.barcode_prefix AS barcodePrefix,m.label_name AS labelName,m.barcode_mode AS barcodeMode,m.label_format AS labelFormat,m.tare_kg AS tareKg,m.shelf_life_days AS shelfLifeDays,m.packed_on AS packedOn,m.enabled,m.last_synced_price AS lastSyncedPrice,p.sku,p.barcode,p.name,p.department,p.unit,p.selling_price AS sellingPrice FROM scale_product_mappings m JOIN products p ON p.id=m.product_id";

async function ensureMappings(deviceId:number) {
  const now=new Date().toISOString();
  const products=await env.DB.prepare("SELECT id,name FROM products WHERE LOWER(unit)='kg' ORDER BY id").all<{id:number;name:string}>();
  await env.DB.batch(products.results.map(product=>env.DB.prepare("INSERT INTO scale_product_mappings (device_id,product_id,plu,barcode_prefix,label_name,enabled,updated_at) VALUES (?,?,?,?,?,1,?) ON CONFLICT(device_id,product_id) DO UPDATE SET label_name=excluded.label_name,updated_at=excluded.updated_at").bind(deviceId,product.id,String(1000+product.id),"20",product.name.slice(0,30),now)));
  return products.results.length;
}

function csvCell(value:unknown){const text=String(value??"");return /[",\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;}

export async function GET(request:Request) {
  await ensureSchema(); const url=new URL(request.url); const deviceId=Number(url.searchParams.get("device")); const format=url.searchParams.get("format");
  const scanned=url.searchParams.get("barcode")?.replace(/\D/g,"");
  if(scanned){const rows=await env.DB.prepare(`${productSelect} WHERE m.enabled=1`).all<Record<string,unknown>>();for(const item of rows.results){const decoded=decodeWeightedBarcode(scanned,{barcodePrefix:String(item.barcodePrefix),plu:String(item.plu),barcodeMode:String(item.barcodeMode),sellingPrice:Number(item.sellingPrice)});if(decoded){const stock=await env.DB.prepare("SELECT quantity FROM products WHERE id=?").bind(item.productId).first<{quantity:number}>();return Response.json({ok:true,product:{id:item.productId,name:item.name,unit:item.unit,sellingPrice:item.sellingPrice,quantityAvailable:Number(stock?.quantity??0)},...decoded,barcode:scanned});}}return Response.json({error:"Weighted scale barcode not recognised"},{status:404});}
  if(deviceId)await ensureMappings(deviceId);
  if(deviceId&&(format==="csv"||format==="json")){
    const device=await env.DB.prepare("SELECT id,name,brand,connector_type AS connectorType,location,endpoint,database_table AS databaseTable,last_sync_at AS lastSyncAt,last_sync_status AS lastSyncStatus FROM scale_devices WHERE id=? AND active=1").bind(deviceId).first<Record<string,unknown>>();
    if(!device)return Response.json({error:"Scale not found"},{status:404});
    const mappings=await env.DB.prepare(`${productSelect} WHERE m.device_id=? AND m.enabled=1 ORDER BY CAST(m.plu AS INTEGER),p.name`).bind(deviceId).all<Record<string,unknown>>();
    if(format==="csv"){
      const headers=["PLU","SKU","BarcodePrefix","LabelName","Department","Unit","PricePerKg"];
      const rows=mappings.results.map(item=>[item.plu,item.sku,item.barcodePrefix,item.labelName,item.department,item.unit,Number(item.sellingPrice).toFixed(2)]);
      const csv=[headers,...rows].map(row=>row.map(csvCell).join(",")).join("\r\n");
      return new Response(csv,{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":`attachment; filename="scale-${deviceId}-price-book.csv"`}});
    }
    const job=await env.DB.prepare("SELECT id,status,source,item_count AS itemCount,created_at AS createdAt FROM scale_sync_jobs WHERE device_id=? AND status='PENDING' ORDER BY id LIMIT 1").bind(deviceId).first();
    return Response.json({device,job,generatedAt:new Date().toISOString(),items:mappings.results.map(item=>({productId:item.productId,plu:item.plu,sku:item.sku,barcodePrefix:item.barcodePrefix,barcodeMode:item.barcodeMode,labelName:item.labelName,labelFormat:item.labelFormat,tareKg:item.tareKg,shelfLifeDays:item.shelfLifeDays,packedOn:Boolean(item.packedOn),department:item.department,unit:item.unit,pricePerKg:item.sellingPrice}))});
  }
  const activeDevices=await env.DB.prepare("SELECT id FROM scale_devices WHERE active=1 ORDER BY id").all<{id:number}>();
  for(const device of activeDevices.results)await ensureMappings(device.id);
  const [devices,mappings,jobs]=await Promise.all([
    env.DB.prepare("SELECT id,name,brand,connector_type AS connectorType,location,endpoint,database_table AS databaseTable,scale_group AS scaleGroup,active,last_sync_at AS lastSyncAt,last_sync_status AS lastSyncStatus,last_heartbeat_at AS lastHeartbeatAt,created_at AS createdAt FROM scale_devices ORDER BY name").all(),
    env.DB.prepare(`${productSelect} ORDER BY m.device_id,CAST(m.plu AS INTEGER),p.name`).all(),
    env.DB.prepare("SELECT j.id,j.device_id AS deviceId,d.name AS deviceName,j.status,j.source,j.item_count AS itemCount,j.created_at AS createdAt,j.completed_at AS completedAt,j.error FROM scale_sync_jobs j JOIN scale_devices d ON d.id=j.device_id ORDER BY j.id DESC LIMIT 100").all(),
  ]);
  return Response.json({devices:devices.results,mappings:mappings.results,jobs:jobs.results});
}

export async function POST(request:Request) {
  await ensureSchema(); const body=await request.json() as Record<string,unknown>; const now=new Date().toISOString();
  if(body.action==="device"){
    const name=String(body.name??"").trim(); if(!name)return Response.json({error:"Scale name is required"},{status:400});
    await env.DB.prepare("INSERT INTO scale_devices (name,brand,connector_type,location,endpoint,database_table,scale_group,active,last_sync_status,created_at) VALUES (?,?,?,?,?,?,?,1,'NEVER',?) ON CONFLICT(name) DO UPDATE SET brand=excluded.brand,connector_type=excluded.connector_type,location=excluded.location,endpoint=excluded.endpoint,database_table=excluded.database_table,scale_group=excluded.scale_group,active=1").bind(name,String(body.brand??"Other"),String(body.connectorType??"CSV"),String(body.location??"Store"),String(body.endpoint??""),String(body.databaseTable??"plu_master"),String(body.scaleGroup??"All scales"),now).run(); return Response.json({ok:true});
  }
  if(body.action==="mapping"){
    const deviceId=Number(body.deviceId),productId=Number(body.productId),plu=String(body.plu??"").trim(); if(!deviceId||!productId||!plu)return Response.json({error:"Scale, product and PLU are required"},{status:400});
    const product=await env.DB.prepare("SELECT name FROM products WHERE id=?").bind(productId).first<{name:string}>(); if(!product)return Response.json({error:"Product not found"},{status:404});
    await env.DB.prepare("INSERT INTO scale_product_mappings (device_id,product_id,plu,barcode_prefix,label_name,barcode_mode,label_format,tare_kg,shelf_life_days,packed_on,enabled,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,1,?) ON CONFLICT(device_id,product_id) DO UPDATE SET plu=excluded.plu,barcode_prefix=excluded.barcode_prefix,label_name=excluded.label_name,barcode_mode=excluded.barcode_mode,label_format=excluded.label_format,tare_kg=excluded.tare_kg,shelf_life_days=excluded.shelf_life_days,packed_on=excluded.packed_on,enabled=1,updated_at=excluded.updated_at").bind(deviceId,productId,plu,String(body.barcodePrefix??"20"),String(body.labelName??product.name).slice(0,30),String(body.barcodeMode??"PRICE"),String(body.labelFormat??"Butchery Standard"),Number(body.tareKg??0),Number(body.shelfLifeDays??4),body.packedOn===false?0:1,now).run(); return Response.json({ok:true});
  }
  if(body.action==="heartbeat"){const deviceId=Number(body.deviceId);await env.DB.prepare("UPDATE scale_devices SET last_heartbeat_at=?,last_sync_status=CASE WHEN last_sync_status='OFFLINE' THEN 'CONNECTED' ELSE last_sync_status END WHERE id=?").bind(now,deviceId).run();return Response.json({ok:true,serverTime:now});}
  if(body.action==="sync"){
    const requested=Number(body.deviceId); const devices=requested?(await env.DB.prepare("SELECT id FROM scale_devices WHERE id=? AND active=1").bind(requested).all<{id:number}>()).results:(await env.DB.prepare("SELECT id FROM scale_devices WHERE active=1 ORDER BY id").all<{id:number}>()).results;
    let itemCount=0; for(const device of devices){itemCount=await ensureMappings(device.id);await env.DB.prepare("INSERT INTO scale_sync_jobs (device_id,status,source,item_count,created_at) VALUES (?,'PENDING',?,?,?)").bind(device.id,String(body.source??"MANUAL_GLOBAL_PUSH"),itemCount,now).run();await env.DB.prepare("UPDATE scale_devices SET last_sync_status='PENDING' WHERE id=?").bind(device.id).run();}
    return Response.json({ok:true,devices:devices.length,itemCount,message:`${itemCount} prices queued for ${devices.length} scale(s)`});
  }
  if(body.action==="ack"){
    const jobId=Number(body.jobId),success=body.success!==false; await env.DB.prepare("UPDATE scale_sync_jobs SET status=?,completed_at=?,error=? WHERE id=?").bind(success?'COMPLETED':'FAILED',now,success?null:String(body.error??"Scale bridge failed"),jobId).run(); const job=await env.DB.prepare("SELECT device_id AS deviceId FROM scale_sync_jobs WHERE id=?").bind(jobId).first<{deviceId:number}>(); if(job){await env.DB.prepare("UPDATE scale_devices SET last_sync_at=?,last_sync_status=? WHERE id=?").bind(now,success?'COMPLETED':'FAILED',job.deviceId).run();if(success)await env.DB.prepare("UPDATE scale_product_mappings SET last_synced_price=(SELECT selling_price FROM products WHERE products.id=scale_product_mappings.product_id),updated_at=? WHERE device_id=?").bind(now,job.deviceId).run();} return Response.json({ok:true});
  }
  return Response.json({error:"Unknown scale action"},{status:400});
}
