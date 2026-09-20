import { env } from "@/lib/db";

type OrderLine = { productId: number; name: string; quantity: number; unit: string; unitPrice: number };

async function ensureSchema() {
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS butcher_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, order_number TEXT NOT NULL UNIQUE, customer_name TEXT NOT NULL, customer_contact TEXT, requested_time TEXT, notes TEXT, status TEXT NOT NULL DEFAULT 'QUEUED', total REAL NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT 'POS', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"),
    env.DB.prepare("ALTER TABLE butcher_orders ADD COLUMN IF NOT EXISTS destination TEXT NOT NULL DEFAULT 'BUTCHER'"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS butcher_order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, product_id INTEGER NOT NULL, product_name TEXT NOT NULL, quantity REAL NOT NULL, unit TEXT NOT NULL, unit_price REAL NOT NULL, line_total REAL NOT NULL, FOREIGN KEY(order_id) REFERENCES butcher_orders(id))"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS butcher_orders_status_idx ON butcher_orders(status,created_at)"),
  ]);
}

export async function GET() {
  await ensureSchema();
  const [orders, items] = await Promise.all([
    env.DB.prepare("SELECT id,order_number AS orderNumber,customer_name AS customerName,customer_contact AS customerContact,requested_time AS requestedTime,notes,status,total,source,destination,created_at AS createdAt,updated_at AS updatedAt FROM butcher_orders ORDER BY CASE status WHEN 'QUEUED' THEN 1 WHEN 'IN_PROGRESS' THEN 2 WHEN 'READY' THEN 3 ELSE 4 END,id DESC LIMIT 200").all(),
    env.DB.prepare("SELECT id,order_id AS orderId,product_id AS productId,product_name AS productName,quantity,unit,unit_price AS unitPrice,line_total AS lineTotal FROM butcher_order_items ORDER BY id").all(),
  ]);
  return Response.json({ orders: orders.results, items: items.results });
}

export async function POST(request: Request) {
  await ensureSchema();
  const payload = await request.json() as { action?: string; customerName?: string; customerContact?: string; requestedTime?: string; notes?: string; lines?: OrderLine[]; orderId?: number; status?: string; source?: string; destination?:string };
  const now = new Date().toISOString();
  if (payload.action === "create") {
    const lines = (payload.lines ?? []).filter(line => line.productId && line.quantity > 0); if (!payload.customerName?.trim() || !lines.length) return Response.json({ error: "Customer name and at least one order item are required" }, { status: 400 });
    const destinations=["BUTCHER","TAKEAWAYS","BAKERY"]; const destination=destinations.includes(payload.destination??"")?payload.destination!:"BUTCHER"; const prefix=destination==="TAKEAWAYS"?"TAK":destination==="BAKERY"?"BAK":"BCH"; const orderNumber = `${prefix}-${Date.now().toString().slice(-8)}`; const total = lines.reduce((sum,line)=>sum+line.quantity*line.unitPrice,0);
    const source = payload.source === "ONLINE" ? "ONLINE" : "POS";
    const result = await env.DB.prepare("INSERT INTO butcher_orders (order_number,customer_name,customer_contact,requested_time,notes,status,total,source,destination,created_at,updated_at) VALUES (?,?,?,?,?,'QUEUED',?,?,?,?,?)").bind(orderNumber,payload.customerName.trim(),payload.customerContact?.trim()||"",payload.requestedTime||"",payload.notes?.trim()||"",total,source,destination,now,now).run(); const orderId=Number(result.meta.last_row_id);
    await env.DB.batch(lines.map(line=>env.DB.prepare("INSERT INTO butcher_order_items (order_id,product_id,product_name,quantity,unit,unit_price,line_total) VALUES (?,?,?,?,?,?,?)").bind(orderId,line.productId,line.name,line.quantity,line.unit,line.unitPrice,line.quantity*line.unitPrice)));
    return Response.json({ ok:true,orderNumber,destination });
  }
  if (payload.action === "status") {
    const allowed=["QUEUED","IN_PROGRESS","READY","COLLECTED","CANCELLED"]; if (!payload.orderId || !allowed.includes(payload.status??"")) return Response.json({error:"Valid order and status required"},{status:400});
    await env.DB.prepare("UPDATE butcher_orders SET status=?,updated_at=? WHERE id=?").bind(payload.status,now,payload.orderId).run(); return Response.json({ok:true,reference:`ORDER-${payload.orderId}`});
  }
  return Response.json({error:"Unknown order action"},{status:400});
}
