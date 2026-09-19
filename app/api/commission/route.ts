import { env } from "@/lib/db";

async function ensureSchema(){
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS commission_settings (id INTEGER PRIMARY KEY, default_rate_percent REAL NOT NULL DEFAULT 5, calculation_basis TEXT NOT NULL DEFAULT 'EXCLUDING_VAT', updated_at TEXT NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS commission_staff (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL UNIQUE, staff_code TEXT NOT NULL UNIQUE, custom_rate_percent REAL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(employee_id) REFERENCES payroll_employees(id))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS commission_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id INTEGER, sale_item_id INTEGER, staff_id INTEGER NOT NULL, product_id INTEGER NOT NULL, product_name TEXT NOT NULL, quantity REAL NOT NULL, gross_amount REAL NOT NULL, net_ex_vat REAL NOT NULL, rate_percent REAL NOT NULL, commission_amount REAL NOT NULL, entry_type TEXT NOT NULL DEFAULT 'EARNED', reference TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(sale_id) REFERENCES pos_sales(id), FOREIGN KEY(sale_item_id) REFERENCES pos_sale_items(id), FOREIGN KEY(staff_id) REFERENCES commission_staff(id), FOREIGN KEY(product_id) REFERENCES products(id))"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS commission_entries_staff_date_idx ON commission_entries(staff_id,created_at)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS commission_entries_sale_idx ON commission_entries(sale_id,sale_item_id)"),
  ]);
  const now=new Date().toISOString();
  await env.DB.prepare("INSERT OR IGNORE INTO commission_settings (id,default_rate_percent,calculation_basis,updated_at) VALUES (1,5,'EXCLUDING_VAT',?)").bind(now).run();
  const employees=await env.DB.prepare("SELECT id FROM payroll_employees WHERE active=1 ORDER BY id LIMIT 9").all<{id:number}>();
  await env.DB.batch(employees.results.map((employee,index)=>env.DB.prepare("INSERT OR IGNORE INTO commission_staff (employee_id,staff_code,custom_rate_percent,active,created_at,updated_at) VALUES (?,?,NULL,1,?,?)").bind(employee.id,String(index+1),now,now)));
}

function monthBounds(month:string){
  const safe=/^\d{4}-\d{2}$/.test(month)?month:new Date().toISOString().slice(0,7);
  const start=`${safe}-01`;const end=new Date(`${start}T12:00:00Z`);end.setUTCMonth(end.getUTCMonth()+1);
  return{month:safe,start,end:end.toISOString().slice(0,10)};
}

export async function GET(request:Request){
  await ensureSchema();const url=new URL(request.url);const bounds=monthBounds(url.searchParams.get("month")??"");
  const [settings,staff,entries,summary,pluMappings]=await Promise.all([
    env.DB.prepare("SELECT default_rate_percent AS defaultRatePercent,calculation_basis AS calculationBasis,updated_at AS updatedAt FROM commission_settings WHERE id=1").first(),
    env.DB.prepare("SELECT c.id,c.employee_id AS employeeId,c.staff_code AS staffCode,c.custom_rate_percent AS customRatePercent,c.active,e.employee_number AS employeeNumber,e.full_name AS fullName,e.job_title AS jobTitle FROM commission_staff c JOIN payroll_employees e ON e.id=c.employee_id ORDER BY CAST(c.staff_code AS INTEGER),e.full_name").all(),
    env.DB.prepare("SELECT c.id,c.staff_id AS staffId,e.full_name AS staffName,e.employee_number AS employeeNumber,c.product_name AS productName,c.quantity,c.gross_amount AS grossAmount,c.net_ex_vat AS netExVat,c.rate_percent AS ratePercent,c.commission_amount AS commissionAmount,c.entry_type AS entryType,c.reference,c.created_at AS createdAt FROM commission_entries c JOIN commission_staff s ON s.id=c.staff_id JOIN payroll_employees e ON e.id=s.employee_id WHERE c.created_at>=? AND c.created_at<? ORDER BY c.id DESC LIMIT 500").bind(bounds.start,bounds.end).all(),
    env.DB.prepare("SELECT s.id AS staffId,e.full_name AS staffName,e.employee_number AS employeeNumber,s.staff_code AS staffCode,COALESCE(SUM(CASE WHEN c.entry_type='EARNED' THEN c.quantity ELSE -c.quantity END),0) AS quantity,COALESCE(SUM(CASE WHEN c.entry_type='EARNED' THEN c.gross_amount ELSE -c.gross_amount END),0) AS grossSales,COALESCE(SUM(CASE WHEN c.entry_type='EARNED' THEN c.net_ex_vat ELSE -c.net_ex_vat END),0) AS netExVat,COALESCE(SUM(CASE WHEN c.entry_type='EARNED' THEN c.commission_amount ELSE -c.commission_amount END),0) AS commissionAmount,COUNT(c.id) AS entryCount FROM commission_staff s JOIN payroll_employees e ON e.id=s.employee_id LEFT JOIN commission_entries c ON c.staff_id=s.id AND c.created_at>=? AND c.created_at<? WHERE s.active=1 GROUP BY s.id,e.full_name,e.employee_number,s.staff_code ORDER BY 8 DESC,e.full_name").bind(bounds.start,bounds.end).all(),
    env.DB.prepare("SELECT m.product_id AS productId,m.plu,p.name AS productName,d.name AS deviceName FROM scale_product_mappings m JOIN products p ON p.id=m.product_id JOIN scale_devices d ON d.id=m.device_id WHERE m.enabled=1 ORDER BY d.id,CAST(m.plu AS INTEGER) LIMIT 100").all(),
  ]);
  return Response.json({settings,staff:staff.results,entries:entries.results,summary:summary.results,pluMappings:pluMappings.results,month:bounds.month});
}

export async function POST(request:Request){
  await ensureSchema();const body=await request.json() as Record<string,unknown>;const now=new Date().toISOString();
  if(body.action==="settings"){
    const rate=Number(body.defaultRatePercent);if(!Number.isFinite(rate)||rate<0||rate>100)return Response.json({error:"Commission rate must be between 0% and 100%."},{status:400});
    await env.DB.prepare("UPDATE commission_settings SET default_rate_percent=?,calculation_basis='EXCLUDING_VAT',updated_at=? WHERE id=1").bind(rate,now).run();
    return Response.json({ok:true,defaultRatePercent:rate});
  }
  if(body.action==="staff"){
    const employeeId=Number(body.employeeId);const staffCode=String(body.staffCode??"").trim();const custom=body.customRatePercent===""||body.customRatePercent===null||body.customRatePercent===undefined?null:Number(body.customRatePercent);
    if(!employeeId||!/^[1-9]$/.test(staffCode))return Response.json({error:"Choose an employee and use a unique staff code from 1 to 9."},{status:400});
    if(custom!==null&&(!Number.isFinite(custom)||custom<0||custom>100))return Response.json({error:"Custom rate must be between 0% and 100%."},{status:400});
    try{await env.DB.prepare("INSERT INTO commission_staff (employee_id,staff_code,custom_rate_percent,active,created_at,updated_at) VALUES (?,?,?,1,?,?) ON CONFLICT(employee_id) DO UPDATE SET staff_code=excluded.staff_code,custom_rate_percent=excluded.custom_rate_percent,active=1,updated_at=excluded.updated_at").bind(employeeId,staffCode,custom,now,now).run();}
    catch{return Response.json({error:`Staff code ${staffCode} is already assigned to another employee.`},{status:409});}
    return Response.json({ok:true});
  }
  return Response.json({error:"Unknown commission action"},{status:400});
}
