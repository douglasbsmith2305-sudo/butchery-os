import { env } from "@/lib/db";
import { ensureCostSchema, loadCosts } from "@/lib/costs";
import { cents, costPeriod, currentCostPeriod, materialCost, productionCogs } from "@/lib/cost-calculations";

export async function GET(request:Request) {
  try {
    const period=new URL(request.url).searchParams.get("period")||currentCostPeriod();
    costPeriod(period);
    await ensureCostSchema();
    return Response.json(await loadCosts(period));
  } catch(error) {return Response.json({error:error instanceof Error?error.message:"Could not load costs."},{status:400});}
}

type Payload={action?:string;period?:string;id?:number;name?:string;category?:string;budget?:string;active?:boolean;itemId?:number;date?:string;amount?:string;reference?:string;notes?:string;requestKey?:string;reason?:string;openingDeferred?:string;closingDeferred?:string;materials?:Array<{productId:number;openingQuantity:number|null;openingValue:string;closingQuantity:number|null;alreadyCosted:boolean}>};

export async function POST(request:Request) {
  try {
    const payload=await request.json() as Payload;
    const now=new Date().toISOString();
    await ensureCostSchema();
    if(payload.action==="item") {
      const name=payload.name?.trim()??"";
      if(!name||name.length>100||!["FIXED","VARIABLE"].includes(payload.category??"")) throw new Error("Enter a cost item name and choose fixed or variable.");
      const budget=cents(payload.budget||"0");
      const existing=payload.id?await env.DB.prepare("SELECT id FROM cost_items WHERE id=?").bind(payload.id).first():null;
      if(payload.id&&!existing) return Response.json({error:"Cost item not found."},{status:404});
      await env.DB.atomic([
        payload.id?env.DB.prepare("UPDATE cost_items SET name=?,category=?,budget_cents=?,active=?,updated_at=? WHERE id=?").bind(name,payload.category,budget,payload.active===false?0:1,now,payload.id):env.DB.prepare("INSERT INTO cost_items (name,category,budget_cents,updated_at) VALUES (?,?,?,?)").bind(name,payload.category,budget,now),
        env.DB.prepare("INSERT INTO cost_audit (action,reference,detail,created_at) VALUES ('ITEM_SAVED',?,?,?)").bind(String(payload.id??name),JSON.stringify({name,category:payload.category,budgetCents:budget,active:payload.active!==false}),now),
      ]);
      return Response.json({ok:true});
    }
    if(payload.action==="entry") {
      const date=payload.date??"";
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(`${date}T12:00:00Z`).toISOString().slice(0,10)!==date) throw new Error("Choose a valid cost date.");
      const amount=cents(payload.amount??"");
      if(!amount) throw new Error("Enter an amount greater than zero.");
      if(!payload.requestKey||!/^[a-zA-Z0-9-]{16,80}$/.test(payload.requestKey)) throw new Error("A unique submission reference is required. Refresh and try again.");
      if((payload.reference?.length??0)>120||(payload.notes?.length??0)>1000) throw new Error("Keep the reference under 120 and notes under 1,000 characters.");
      const item=await env.DB.prepare("SELECT id,name,category FROM cost_items WHERE id=? AND active=1").bind(payload.itemId).first<{id:number;name:string;category:string}>();
      if(!item) throw new Error("Choose an active fixed or variable cost item.");
      // A retried network request cannot create a duplicate expenditure.
      await env.DB.prepare("INSERT INTO cost_entries (request_key,item_id,item_name,category,entry_date,amount_cents,reference,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(request_key) DO NOTHING").bind(payload.requestKey,item.id,item.name,item.category,date,amount,payload.reference?.trim()??"",payload.notes?.trim()??"",now).run();
      return Response.json({ok:true});
    }
    if(payload.action==="reverse") {
      const reason=payload.reason?.trim()??"";
      if(!reason||reason.length>500) throw new Error("Enter a correction reason (up to 500 characters).");
      const row=await env.DB.prepare("SELECT id FROM cost_entries WHERE id=? AND status='POSTED'").bind(payload.id).first();
      if(!row) return Response.json({error:"This entry has already been reversed or does not exist."},{status:409});
      await env.DB.atomic([
        env.DB.prepare("UPDATE cost_entries SET status='REVERSED',reversal_reason=? WHERE id=? AND status='POSTED'").bind(reason,payload.id),
        env.DB.prepare("INSERT INTO cost_audit (action,reference,detail,created_at) VALUES ('ENTRY_REVERSED',?,?,?)").bind(String(payload.id),reason,now),
      ]);
      return Response.json({ok:true});
    }
    if(payload.action==="materials") {
      const period=payload.period??"";costPeriod(period);
      if(period>currentCostPeriod()) throw new Error("Stock reconciliations can be saved for the current month or an earlier month.");
      const data=await loadCosts(period);
      const supplied=payload.materials??[];
      const unique=new Set(supplied.map(row=>row.productId));
      if(unique.size!==supplied.length||supplied.length!==data.materials.length||supplied.some(row=>!data.materials.some(item=>item.productId===row.productId))) throw new Error("The production-input list changed. Refresh before saving the reconciliation.");
      const normalized=supplied.map(row=>{
        const product=data.materials.find(item=>item.productId===row.productId)!;
        const openingQuantity=product.carried?product.openingQuantity:row.openingQuantity;
        const openingValueCents=product.carried?product.openingValueCents:cents(row.openingValue);
        if(openingQuantity===null||row.closingQuantity===null) throw new Error(`Enter opening and unused closing quantities for ${product.name}.`);
        if(![openingQuantity,row.closingQuantity].every(value=>Number.isFinite(value)&&value>=0&&Math.abs(value*1000-Math.round(value*1000))<.00001)) throw new Error("Enter stock quantities with at most three decimal places.");
        const calculated=materialCost({...product,openingQuantity,openingValueCents,closingQuantity:row.closingQuantity,alreadyCosted:row.alreadyCosted});
        return {...product,...calculated,openingQuantity,openingValueCents,closingQuantity:row.closingQuantity,alreadyCosted:!!row.alreadyCosted};
      });
      const openingDeferredCents=data.deferredCarried?data.openingDeferredCents:cents(payload.openingDeferred||"0");
      const closingDeferredCents=cents(payload.closingDeferred||"0");
      productionCogs(normalized.reduce((sum,row)=>sum+row.additionalCogsCents,0),openingDeferredCents,closingDeferredCents);
      await env.DB.atomic([
        ...normalized.map(row=>env.DB.prepare("INSERT INTO production_cost_counts (period,product_id,product_name,unit,opening_quantity,opening_value_cents,closing_quantity,closing_value_cents,already_costed,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(period,product_id) DO UPDATE SET opening_quantity=excluded.opening_quantity,opening_value_cents=excluded.opening_value_cents,closing_quantity=excluded.closing_quantity,closing_value_cents=excluded.closing_value_cents,already_costed=excluded.already_costed,updated_at=excluded.updated_at").bind(period,row.productId,row.name,row.unit,row.openingQuantity,row.openingValueCents,row.closingQuantity,row.closingValueCents,row.alreadyCosted?1:0,now)),
        env.DB.prepare("INSERT INTO cost_months (period,initial_deferred_cents,closing_deferred_cents,notes,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(period) DO UPDATE SET initial_deferred_cents=excluded.initial_deferred_cents,closing_deferred_cents=excluded.closing_deferred_cents,notes=excluded.notes,updated_at=excluded.updated_at").bind(period,openingDeferredCents,closingDeferredCents,payload.notes?.slice(0,2000)??"",now),
        env.DB.prepare("INSERT INTO cost_audit (action,reference,detail,created_at) VALUES ('MATERIAL_RECONCILIATION',?,?,?)").bind(period,JSON.stringify({materials:normalized,openingDeferredCents,closingDeferredCents}),now),
      ]);
      return Response.json({ok:true});
    }
    return Response.json({error:"Unknown cost action."},{status:400});
  } catch(error){return Response.json({error:error instanceof Error?error.message:"Could not record this cost."},{status:400});}
}
