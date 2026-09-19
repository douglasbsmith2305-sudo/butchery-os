"use client";

import { useEffect, useMemo, useState } from "react";
import { blockTestProfile } from "@/lib/block-tests";

type Product = { id:number;sku:string;barcode?:string;name:string;department:string;unit:string;costPrice:number;sellingPrice:number;targetMarginPercent?:number;quantity:number;blockTestProfileCode?:string|null };
type Order = { id:number;orderNumber:string;customerName:string;status:string;total:number;source:string;createdAt:string };
type SupplierInvoice = { id:number;invoiceNumber:string;supplierName:string;deliveryDate:string;dueDate:string;amount:number;balance:number;status:string };
type Account = { id:number;accountNumber:string;name:string;creditLimit:number;balance:number;voucherBalance:number;status:string };
type Receipt = { id:number;receiptNumber:string;supplierName:string;invoiceNumber:string;deliveryDate:string;totalCost:number;createdAt:string };
type ReceiptLine = { id:number;receiptId:number;productName:string;department:string;quantity:number;unit:string;costPrice:number;lineTotal:number };
type Waste = { id:number;productId:number;productName:string;quantity:number;reason:string;value:number;createdAt:string };
type Count = { id:number;countNumber:string;productId:number;productName:string;expectedQuantity:number;countedQuantity:number;variance:number;reason:string;createdAt:string };
type ScaleDevice = { id:number;name:string;brand:string;location:string;scaleGroup:string;lastSyncStatus:string };
type PayrollEmployee = { id:number;employeeNumber:string;fullName:string;jobTitle:string;baseSalary:number;meatBenefit:number;accountNumber:string };
type PayrollRun = { id:number;payrollNumber:string;employeeId:number;fullName:string;payPeriod:string;netPay:number;paid:number };
type CommissionStaff = { id:number;employeeId:number;employeeNumber:string;fullName:string;jobTitle:string;staffCode:number;customRatePercent:number|null };
type CommissionSummary = { staffId:number;netExVat:number;commissionAmount:number;entryCount:number };
type ControlReport = { revenue:number;stockValue:number;retailValue:number;wasteKg:number;wasteValue:number;supplierBalance:number;productCount:number };
type Snapshot = {
  products: Product[];
  orders: Order[];
  invoices: SupplierInvoice[];
  accounts: Account[];
  receipts: Receipt[];
  receiptLines: ReceiptLine[];
  wastes: Waste[];
  counts: Count[];
  devices: ScaleDevice[];
  employees: PayrollEmployee[];
  payrollRuns: PayrollRun[];
  commissionRate: number;
  commissionStaff: CommissionStaff[];
  commissionSummary: CommissionSummary[];
  settings: Record<string,string>;
  report: ControlReport;
};

const blankReport:ControlReport={revenue:0,stockValue:0,retailValue:0,wasteKg:0,wasteValue:0,supplierBalance:0,productCount:0};
const clone=<T,>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
const money=(value:number)=>value.toLocaleString("en-ZA",{style:"currency",currency:"ZAR",maximumFractionDigits:2});
const quantity=(value:number,unit="kg")=>`${value.toLocaleString("en-ZA",{maximumFractionDigits:2})} ${unit}`;

async function readJson(path:string){
  const response=await fetch(path,{method:"GET",cache:"no-store"});
  if(!response.ok)throw new Error(`Could not read ${path}`);
  return response.json() as Promise<Record<string,unknown>>;
}

export default function SandboxWorkspace({section}:{section:string}){
  const [baseline,setBaseline]=useState<Snapshot|null>(null);
  const [scenario,setScenario]=useState<Snapshot|null>(null);
  const [loadedAt,setLoadedAt]=useState<Date|null>(null);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("Loading a safe snapshot of the live system…");
  const [priceChanges,setPriceChanges]=useState(0);

  async function loadSnapshot(){
    setLoading(true); setMessage("Reading current live data. No changes are being made.");
    try{
      const [control,finance,orders,payroll,receiving,scales,commission]=await Promise.all([
        readJson("/api/control"),readJson("/api/finance"),readJson("/api/orders"),readJson("/api/payroll"),readJson("/api/receiving"),readJson("/api/scales"),readJson("/api/commission")
      ]);
      const next:Snapshot={
        products:(receiving.products??control.products??[]) as Product[],
        orders:(orders.orders??[]) as Order[],
        invoices:(finance.invoices??[]) as SupplierInvoice[],
        accounts:(finance.accounts??[]) as Account[],
        receipts:(receiving.receipts??[]) as Receipt[],
        receiptLines:(receiving.lines??[]) as ReceiptLine[],
        wastes:(control.wastes??[]) as Waste[],
        counts:(control.counts??[]) as Count[],
        devices:(scales.devices??[]) as ScaleDevice[],
        employees:(payroll.employees??[]) as PayrollEmployee[],
        payrollRuns:(payroll.runs??[]) as PayrollRun[],
        commissionRate:Number((commission.settings as { defaultRatePercent?:number }|undefined)?.defaultRatePercent??5),
        commissionStaff:(commission.staff??[]) as CommissionStaff[],
        commissionSummary:(commission.summary??[]) as CommissionSummary[],
        settings:(control.settings??{}) as Record<string,string>,
        report:(control.report??blankReport) as ControlReport,
      };
      setBaseline(clone(next)); setScenario(clone(next)); setLoadedAt(new Date()); setPriceChanges(0);
      setMessage("Live snapshot loaded into the isolated sandbox.");
    }catch(error){setMessage(error instanceof Error?error.message:"The sandbox snapshot could not be loaded.");}
    finally{setLoading(false);}
  }
  useEffect(()=>{void loadSnapshot();},[]);

  function reset(){if(!baseline)return;setScenario(clone(baseline));setPriceChanges(0);setMessage("Scenario reset to the snapshot captured when you entered.");}
  function updateProduct(productId:number,changes:Partial<Product>){setScenario(current=>current?{...current,products:current.products.map(product=>product.id===productId?{...product,...changes}:product)}:current);}
  const changed=useMemo(()=>baseline&&scenario?JSON.stringify(baseline)!==JSON.stringify(scenario):false,[baseline,scenario]);

  if(loading&&!scenario)return <div className="content sandbox-page"><SandboxBanner loadedAt={loadedAt} changed={false} message={message} onRefresh={loadSnapshot} onReset={reset}/><div className="sandbox-loading">Building your isolated organisation snapshot…</div></div>;
  if(!scenario)return <div className="content sandbox-page"><SandboxBanner loadedAt={loadedAt} changed={false} message={message} onRefresh={loadSnapshot} onReset={reset}/><div className="sandbox-loading error">The live data remains untouched. Use “Refresh live snapshot” to try again.</div></div>;

  const shared={data:scenario,setData:setScenario,setMessage};
  return <div className="content sandbox-page">
    <SandboxBanner loadedAt={loadedAt} changed={changed} message={message} onRefresh={loadSnapshot} onReset={reset}/>
    {section==="Sandbox overview"?<SandboxOverview data={scenario}/>
      :section==="Receiving"?<SandboxReceiving {...shared}/>
      :section==="Stock master"?<SandboxStock data={scenario} mode="master"/>
      :section==="Cooler inventory"?<SandboxStock data={scenario} mode="cooler"/>
      :section==="Orders"?<SandboxOrders {...shared}/>
      :section==="Stock count"?<SandboxStockCount {...shared}/>
      :section==="Waste & loss"?<SandboxWaste {...shared}/>
      :section==="Owner overview"?<SandboxOwner data={scenario}/>
      :section==="Pricing"?<SandboxPricing data={scenario} updateProduct={updateProduct} changes={priceChanges} onChange={()=>setPriceChanges(value=>value+1)}/>
      :section==="Scale network"?<SandboxScales data={scenario} changes={priceChanges} setMessage={setMessage}/>
      :section==="Batch tracking"?<SandboxBatches data={scenario}/>
      :section==="Accounts & Calendar"?<SandboxAccounts {...shared}/>
      :section==="Payroll"?<SandboxPayroll {...shared}/>
      :section==="Commission"?<SandboxCommission {...shared}/>
      :section==="Reports"?<SandboxReports data={scenario}/>
      :section==="Settings"?<SandboxSettings {...shared}/>
      :<SandboxOverview data={scenario}/>} 
  </div>;
}

function SandboxBanner({loadedAt,changed,message,onRefresh,onReset}:{loadedAt:Date|null;changed:boolean;message:string;onRefresh:()=>void;onReset:()=>void}){
  return <><div className="sandbox-lock"><div><small>ISOLATED TEST ENVIRONMENT</small><strong>Sand-box — nothing can be written back</strong><span>{message} {loadedAt?`Snapshot: ${loadedAt.toLocaleString("en-ZA")}.`:""}</span></div><div><b className={changed?"changed":""}>{changed?"SCENARIO CHANGED":"LIVE SNAPSHOT COPY"}</b><button onClick={onReset}>Reset scenario</button><button onClick={onRefresh}>Refresh live snapshot</button></div></div></>;
}

function SandboxOverview({data}:{data:Snapshot}){
  const stockCost=data.products.reduce((sum,p)=>sum+p.quantity*p.costPrice,0);const retail=data.products.reduce((sum,p)=>sum+p.quantity*p.sellingPrice,0);const gross=retail-stockCost;const openOrders=data.orders.filter(o=>!["COLLECTED","CANCELLED"].includes(o.status)).length;const debtors=data.accounts.reduce((sum,a)=>sum+a.balance,0);const creditors=data.invoices.reduce((sum,i)=>sum+i.balance,0);
  return <><div className="eyebrow">SANDBOX / ENTIRE ORGANISATION</div><div className="page-heading"><div><h1>Experiment with the whole business.</h1><p>Manager and Back Office data is connected inside this copy, so a simulated stock, cost or price change flows through the scenario only.</p></div><span className="status-pill">ZERO LIVE WRITES</span></div><section className="sandbox-kpis"><article><small>STOCK COST</small><strong>{money(stockCost)}</strong><span>{data.products.length} products</span></article><article><small>POTENTIAL RETAIL</small><strong>{money(retail)}</strong><span>{gross>0?`${(gross/retail*100).toFixed(1)}% gross margin`:"No margin"}</span></article><article><small>OPEN ORDERS</small><strong>{openOrders}</strong><span>{money(data.orders.reduce((s,o)=>s+o.total,0))} order value</span></article><article><small>DEBTORS / CREDITORS</small><strong>{money(debtors)}</strong><span>{money(creditors)} supplier balance</span></article></section><section className="panel sandbox-guide"><div className="panel-head"><div><small>HOW THIS COPY WORKS</small><h2>One scenario across Manager and Back Office</h2></div></div><div><article><b>1</b><strong>Start with live data</strong><span>The sandbox reads the current system when you enter or refresh.</span></article><article><b>2</b><strong>Change anything here</strong><span>Receive stock, count, waste, price, settle accounts or test payroll.</span></article><article><b>3</b><strong>Compare the outcome</strong><span>Overview and reports recalculate from the sandbox copy.</span></article><article><b>4</b><strong>Reset safely</strong><span>Nothing in this portal calls a write API or updates the live database.</span></article></div></section></>;
}

function SandboxOwner({data}:{data:Snapshot}){
  const cost=data.products.reduce((s,p)=>s+p.quantity*p.costPrice,0);const retail=data.products.reduce((s,p)=>s+p.quantity*p.sellingPrice,0);const waste=data.wastes.reduce((s,w)=>s+w.value,0);const profit=retail-cost-waste;
  const ranked=[...data.products].filter(p=>p.sellingPrice>0).sort((a,b)=>((b.sellingPrice-b.costPrice)/b.sellingPrice)-((a.sellingPrice-a.costPrice)/a.sellingPrice));
  return <><div className="eyebrow">SANDBOX / OWNER OVERVIEW</div><div className="page-heading"><div><h1>Scenario owner view.</h1><p>See how experimental Manager and Back Office decisions change the organisation.</p></div></div><section className="sandbox-kpis"><article><small>SCENARIO PROFIT</small><strong>{money(profit)}</strong><span>Potential stock less cost and losses</span></article><article><small>GROSS MARGIN</small><strong>{retail?`${(profit/retail*100).toFixed(1)}%`:"0%"}</strong><span>8% net target remains visible</span></article><article><small>WASTE VALUE</small><strong>{money(waste)}</strong><span>{quantity(data.wastes.reduce((s,w)=>s+w.quantity,0))}</span></article><article><small>SUPPLIER DUE</small><strong>{money(data.invoices.reduce((s,i)=>s+i.balance,0))}</strong><span>{data.invoices.filter(i=>i.status==="OPEN").length} open invoices</span></article></section><div className="performance-split"><RankPanel title="STRONGEST SCENARIO MARGINS" products={ranked.slice(0,5)}/><RankPanel title="UNDERPERFORMING SCENARIO PRODUCTS" products={ranked.slice(-5).reverse()} under/></div></>;
}

function RankPanel({title,products,under=false}:{title:string;products:Product[];under?:boolean}){return <section className="panel"><div className="panel-head"><div><small>PORTFOLIO</small><h2>{title}</h2></div></div>{products.map((p,index)=><div className={`performance-row ${under?"under":""}`} key={p.id}><b>{index+1}</b><div><strong>{p.name}</strong><small>{p.department} · {money(p.sellingPrice)} / {p.unit}</small></div><span>{p.sellingPrice?`${((p.sellingPrice-p.costPrice)/p.sellingPrice*100).toFixed(1)}%`:"0%"}</span></div>)}</section>}

type MutatingProps={data:Snapshot;setData:React.Dispatch<React.SetStateAction<Snapshot|null>>;setMessage:(message:string)=>void};

function SandboxReceiving({data,setData,setMessage}:MutatingProps){
  const [productId,setProductId]=useState(data.products[0]?.id??0);const [amount,setAmount]=useState(1);const [cost,setCost]=useState(data.products[0]?.costPrice??0);const selected=data.products.find(p=>p.id===productId);const profile=blockTestProfile(selected?.blockTestProfileCode);
  function choose(id:number){setProductId(id);setCost(data.products.find(p=>p.id===id)?.costPrice??0);}
  function receive(){if(!selected||amount<=0||cost<=0)return;setData(current=>{if(!current)return current;let products=current.products.map(p=>p.id===selected.id?{...p,costPrice:cost,quantity:profile?p.quantity:p.quantity+amount}:p);if(profile){products=products.map(p=>{const output=profile.items.find(item=>item.outputSku===p.sku);return output?{...p,quantity:p.quantity+amount*output.percent/100}:p;});}const receiptId=-Date.now();const receipt:Receipt={id:receiptId,receiptNumber:`SIM-${String(Math.abs(receiptId)).slice(-6)}`,supplierName:"Sandbox supplier",invoiceNumber:"SIMULATION",deliveryDate:new Date().toISOString().slice(0,10),totalCost:amount*cost,createdAt:new Date().toISOString()};const line:ReceiptLine={id:receiptId,receiptId,productName:selected.name,department:selected.department,quantity:amount,unit:selected.unit,costPrice:cost,lineTotal:amount*cost};return{...current,products,receipts:[receipt,...current.receipts],receiptLines:[line,...current.receiptLines]};});setMessage(`${selected.name} received inside the scenario only${profile?` and allocated through ${profile.name}`:""}.`);}
  return <><div className="eyebrow">SANDBOX / MANAGER / RECEIVING</div><div className="page-heading"><div><h1>Test receiving and cost changes.</h1><p>Simulated receipts update this scenario&apos;s stock and downstream values only.</p></div></div><section className="panel sandbox-form"><label>Product<select value={productId} onChange={e=>choose(Number(e.target.value))}>{data.products.map(p=><option value={p.id} key={p.id}>{p.name} · {p.department}</option>)}</select></label><label>Quantity / weight<input type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(Number(e.target.value))}/></label><label>Supplier cost per {selected?.unit??"unit"}<input type="number" min="0" step="0.01" value={cost} onChange={e=>setCost(Number(e.target.value))}/></label><button onClick={receive}>Simulate receipt</button>{profile&&<p className="sandbox-form-note">{profile.name} will automatically allocate its expected outputs with the existing ±2% control logic.</p>}</section><SandboxBatches data={data}/></>;
}

function SandboxStock({data,mode}:{data:Snapshot;mode:"master"|"cooler"}){const [search,setSearch]=useState("");const products=data.products.filter(p=>(mode==="master"||p.unit.toLowerCase()==="kg")&&`${p.name} ${p.department} ${p.sku}`.toLowerCase().includes(search.toLowerCase()));return <><div className="eyebrow">SANDBOX / MANAGER / {mode==="master"?"STOCK MASTER":"COOLER INVENTORY"}</div><div className="page-heading"><div><h1>{mode==="master"?"Scenario stock master.":"Scenario cooler inventory."}</h1><p>Quantities and values reflect sandbox receiving, counts and waste.</p></div></div><section className="panel sandbox-table"><div className="sandbox-search"><input placeholder="Search product, SKU or department…" value={search} onChange={e=>setSearch(e.target.value)}/><span>{products.length} products</span></div><div className="sandbox-row header"><span>PRODUCT</span><span>DEPARTMENT</span><span>QUANTITY</span><span>COST</span><span>SELLING</span><span>STOCK VALUE</span></div>{products.slice(0,100).map(p=><div className="sandbox-row" key={p.id}><div><strong>{p.name}</strong><small>{p.sku}</small></div><span>{p.department}</span><b>{quantity(p.quantity,p.unit)}</b><span>{money(p.costPrice)}</span><span>{money(p.sellingPrice)}</span><b>{money(p.quantity*p.costPrice)}</b></div>)}</section></>}

function SandboxOrders({data,setData,setMessage}:MutatingProps){const states=["QUEUED","IN_PROGRESS","READY","COLLECTED","CANCELLED"];function move(id:number,status:string){setData(current=>current?{...current,orders:current.orders.map(o=>o.id===id?{...o,status}:o)}:current);setMessage("Order status changed inside the scenario only.");}return <><div className="eyebrow">SANDBOX / MANAGER / ORDERS</div><div className="page-heading"><div><h1>Test the butcher order queue.</h1><p>Move orders through the workflow without notifying staff or altering live tickets.</p></div></div><section className="panel sandbox-order-list">{data.orders.length?data.orders.map(o=><article key={o.id}><div><strong>{o.orderNumber}</strong><small>{o.customerName} · {o.source}</small></div><b>{money(o.total)}</b><select value={o.status} onChange={e=>move(o.id,e.target.value)}>{states.map(state=><option key={state}>{state}</option>)}</select></article>):<div className="sandbox-empty">No live orders were present when this snapshot was captured.</div>}</section></>}

function SandboxStockCount({data,setData,setMessage}:MutatingProps){const [id,setId]=useState(data.products[0]?.id??0);const product=data.products.find(p=>p.id===id);const [counted,setCounted]=useState(product?.quantity??0);function choose(next:number){setId(next);setCounted(data.products.find(p=>p.id===next)?.quantity??0);}function post(){if(!product||counted<0)return;const variance=counted-product.quantity;setData(current=>current?{...current,products:current.products.map(p=>p.id===id?{...p,quantity:counted}:p),counts:[{id:-Date.now(),countNumber:"SIM-COUNT",productId:id,productName:product.name,expectedQuantity:product.quantity,countedQuantity:counted,variance,reason:"Sandbox scenario",createdAt:new Date().toISOString()},...current.counts]}:current);setMessage(`Scenario count posted with a ${quantity(variance,product.unit)} variance.`);}return <SandboxAction title="Test a physical stock count" copy="The variance changes only the sandbox quantity and reports."><label>Product<select value={id} onChange={e=>choose(Number(e.target.value))}>{data.products.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label><label>System quantity<input value={product?.quantity??0} readOnly/></label><label>Counted quantity<input type="number" min="0" step="0.01" value={counted} onChange={e=>setCounted(Number(e.target.value))}/></label><button onClick={post}>Post sandbox count</button></SandboxAction>}

function SandboxWaste({data,setData,setMessage}:MutatingProps){const [id,setId]=useState(data.products[0]?.id??0);const [amount,setAmount]=useState(0);const product=data.products.find(p=>p.id===id);function post(){if(!product||amount<=0||amount>product.quantity)return setMessage("Enter a loss that does not exceed scenario stock.");setData(current=>current?{...current,products:current.products.map(p=>p.id===id?{...p,quantity:p.quantity-amount}:p),wastes:[{id:-Date.now(),productId:id,productName:product.name,quantity:amount,reason:"Sandbox loss",value:amount*product.costPrice,createdAt:new Date().toISOString()},...current.wastes]}:current);setAmount(0);setMessage("Waste deducted from the scenario only.");}return <><SandboxAction title="Test waste and loss" copy="Deduct stock and see the effect on simulated profitability."><label>Product<select value={id} onChange={e=>setId(Number(e.target.value))}>{data.products.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label><label>Available<input value={product?quantity(product.quantity,product.unit):""} readOnly/></label><label>Loss quantity<input type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(Number(e.target.value))}/></label><button onClick={post}>Record sandbox loss</button></SandboxAction><section className="panel sandbox-mini-list">{data.wastes.slice(0,12).map(w=><article key={w.id}><strong>{w.productName}</strong><span>{quantity(w.quantity)}</span><b>{money(w.value)}</b><small>{w.reason}</small></article>)}</section></>}

function SandboxAction({title,copy,children}:{title:string;copy:string;children:React.ReactNode}){return <><div className="eyebrow">SANDBOX / MANAGER CONTROL</div><div className="page-heading"><div><h1>{title}.</h1><p>{copy}</p></div></div><section className="panel sandbox-form">{children}</section></>}

function SandboxPricing({data,updateProduct,changes,onChange}:{data:Snapshot;updateProduct:(id:number,changes:Partial<Product>)=>void;changes:number;onChange:()=>void}){
  const [search,setSearch]=useState("");const products=data.products.filter(p=>p.sellingPrice>0&&`${p.name} ${p.department}`.toLowerCase().includes(search.toLowerCase()));const cost=products.reduce((s,p)=>s+p.quantity*p.costPrice,0);const retail=products.reduce((s,p)=>s+p.quantity*p.sellingPrice,0);
  function changePrice(p:Product,value:number){updateProduct(p.id,{sellingPrice:Math.max(0,value),targetMarginPercent:value?((value-p.costPrice)/value)*100:0});onChange();}
  function changeMargin(p:Product,value:number){const margin=Math.min(89,Math.max(0,value));updateProduct(p.id,{targetMarginPercent:margin,sellingPrice:p.costPrice/(1-margin/100)});onChange();}
  return <><div className="eyebrow">SANDBOX / BACK OFFICE / PRICING</div><div className="page-heading"><div><h1>Build a pricing scenario.</h1><p>Change prices or target margins globally. Stock value, profit and scale impact recalculate here only.</p></div><span className="status-pill">{changes} LOCAL CHANGES</span></div><section className="sandbox-kpis"><article><small>SCENARIO RETAIL</small><strong>{money(retail)}</strong></article><article><small>SCENARIO COST</small><strong>{money(cost)}</strong></article><article><small>GROSS PROFIT</small><strong>{money(retail-cost)}</strong></article><article><small>PORTFOLIO MARGIN</small><strong>{retail?`${((retail-cost)/retail*100).toFixed(1)}%`:"0%"}</strong></article></section><section className="panel sandbox-table"><div className="sandbox-search"><input placeholder="Search pricing…" value={search} onChange={e=>setSearch(e.target.value)}/><span>Never sent to scales</span></div><div className="sandbox-price-row header"><span>PRODUCT</span><span>COST</span><span>TARGET MARGIN</span><span>SELLING PRICE</span><span>UNIT PROFIT</span></div>{products.slice(0,100).map(p=><div className="sandbox-price-row" key={p.id}><div><strong>{p.name}</strong><small>{p.department}</small></div><span>{money(p.costPrice)}</span><label><input type="number" min="0" max="89" step="0.1" value={Number(p.targetMarginPercent??((p.sellingPrice-p.costPrice)/p.sellingPrice*100)).toFixed(1)} onChange={e=>changeMargin(p,Number(e.target.value))}/><b>%</b></label><label><b>R</b><input type="number" min="0" step="0.01" value={p.sellingPrice.toFixed(2)} onChange={e=>changePrice(p,Number(e.target.value))}/></label><strong>{money(p.sellingPrice-p.costPrice)}</strong></div>)}</section></>;
}

function SandboxScales({data,changes,setMessage}:{data:Snapshot;changes:number;setMessage:(message:string)=>void}){const [queued,setQueued]=useState(0);return <><div className="eyebrow">SANDBOX / BACK OFFICE / SCALE NETWORK</div><div className="page-heading"><div><h1>Preview scale deployment.</h1><p>See which scale network would receive scenario pricing. No job is sent to a real scale.</p></div></div><section className="panel scale-command"><div><small>SIMULATED GLOBAL PUSH</small><h2>{changes} price changes ready for {data.devices.length} scales</h2><p>This button only creates a local preview count.</p></div><button className="primary-action" onClick={()=>{setQueued(changes*data.devices.length);setMessage("Scale push simulated locally. No device or bridge was contacted.");}}>Simulate global push →</button></section><section className="panel sandbox-mini-list">{data.devices.map(d=><article key={d.id}><strong>{d.name}</strong><span>{d.brand} · {d.location}</span><b>{d.scaleGroup}</b><small>{queued?`${changes} updates previewed`:d.lastSyncStatus}</small></article>)}</section></>}

function SandboxBatches({data}:{data:Snapshot}){return <><div className="eyebrow">SANDBOX / BACK OFFICE / BATCH TRACKING</div><div className="page-heading"><div><h1>Scenario batch register.</h1><p>Includes live receipts plus simulated receipts added during this session.</p></div></div><section className="panel sandbox-mini-list">{data.receipts.slice(0,30).map(r=><article key={r.id}><div><strong>{r.receiptNumber}</strong><small>{r.supplierName} · invoice {r.invoiceNumber}</small></div><span>{r.deliveryDate}</span><b>{money(r.totalCost)}</b><small>{data.receiptLines.filter(line=>line.receiptId===r.id).map(line=>`${line.productName} ${quantity(line.quantity,line.unit)}`).join(" · ")||"Receipt details"}</small></article>)}</section></>}

function SandboxAccounts({data,setData,setMessage}:MutatingProps){function payInvoice(id:number){setData(current=>current?{...current,invoices:current.invoices.map(i=>i.id===id?{...i,balance:0,status:"PAID"}:i)}:current);setMessage("Supplier invoice marked paid in the scenario only.");}function clearAccount(id:number){setData(current=>current?{...current,accounts:current.accounts.map(a=>a.id===id?{...a,balance:0}:a)}:current);setMessage("Customer account cleared in the scenario only.");}return <><div className="eyebrow">SANDBOX / BACK OFFICE / ACCOUNTS & CALENDAR</div><div className="page-heading"><div><h1>Test cash-flow decisions.</h1><p>Settle debtors or supplier invoices without creating payments or ledger entries.</p></div></div><div className="sandbox-two"><section className="panel"><div className="panel-head"><div><small>DEBTORS</small><h2>Customer accounts</h2></div></div>{data.accounts.map(a=><div className="sandbox-account" key={a.id}><div><strong>{a.name}</strong><small>{a.accountNumber}</small></div><b>{money(a.balance)}</b><button disabled={!a.balance} onClick={()=>clearAccount(a.id)}>Simulate payment</button></div>)}</section><section className="panel"><div className="panel-head"><div><small>PAYMENT CALENDAR</small><h2>Supplier invoices</h2></div></div>{data.invoices.map(i=><div className="sandbox-account" key={i.id}><div><strong>{i.supplierName}</strong><small>{i.invoiceNumber} · due {i.dueDate}</small></div><b>{money(i.balance)}</b><button disabled={!i.balance} onClick={()=>payInvoice(i.id)}>Simulate paid</button></div>)}</section></div></>}

function SandboxPayroll({data,setData,setMessage}:MutatingProps){function toggle(id:number){setData(current=>current?{...current,payrollRuns:current.payrollRuns.map(r=>r.id===id?{...r,paid:r.paid?0:1}:r)}:current);setMessage("Payroll status changed in the scenario only; no staff account was settled.");}return <><div className="eyebrow">SANDBOX / BACK OFFICE / PAYROLL</div><div className="page-heading"><div><h1>Test payroll status.</h1><p>Review packages and model who is paid without clearing live staff accounts.</p></div></div><section className="panel payroll-status">{data.payrollRuns.length?<><div className="payroll-status-row header"><span>EMPLOYEE</span><span>PERIOD</span><span>NET PAY</span><span>STATUS</span></div>{data.payrollRuns.map(r=><div className="payroll-status-row" key={r.id}><div><strong>{r.fullName||data.employees.find(e=>e.id===r.employeeId)?.fullName||r.payrollNumber}</strong><small>{r.payrollNumber}</small></div><span>{r.payPeriod}</span><b>{money(r.netPay)}</b><button className={r.paid?"paid":""} onClick={()=>toggle(r.id)}>{r.paid?"✓ Paid":"Mark paid"}</button></div>)}</>:<div className="sandbox-empty">No payroll runs were present in this snapshot.</div>}</section></>}

function SandboxCommission({data,setData,setMessage}:MutatingProps){
  const totalNet=data.commissionSummary.reduce((sum,row)=>sum+Number(row.netExVat),0);
  const projected=totalNet*data.commissionRate/100;
  function changeRate(value:number){setData(current=>current?{...current,commissionRate:Math.min(100,Math.max(0,value))}:current);setMessage("Commission rate changed inside the scenario only.");}
  return <><div className="eyebrow">SANDBOX / BACK OFFICE / COMMISSION</div><div className="page-heading"><div><h1>Test the commission model.</h1><p>Change the VAT-exclusive rate and compare staff outcomes without altering live commission settings or transactions.</p></div><span className="status-pill">NO LIVE WRITES</span></div><section className="commission-target"><div><small>SCENARIO COMMISSION RATE</small><h2>Commission on sales excluding VAT</h2><p>The live default is copied into this sandbox. Staff overrides remain visible below.</p></div><label><input type="number" min="0" max="100" step="0.1" value={data.commissionRate} onChange={event=>changeRate(Number(event.target.value))}/><b>%</b></label></section><section className="sandbox-kpis"><article><small>VAT-EXCLUSIVE SALES</small><strong>{money(totalNet)}</strong></article><article><small>SCENARIO COMMISSION</small><strong>{money(projected)}</strong><span>At {data.commissionRate.toFixed(2)}%</span></article><article><small>STAFF CODES</small><strong>{data.commissionStaff.length}</strong><span>Scale aliases remain simulated</span></article><article><small>TRANSACTIONS</small><strong>{data.commissionSummary.reduce((sum,row)=>sum+Number(row.entryCount),0)}</strong><span>From the live snapshot</span></article></section><section className="panel"><div className="panel-head"><div><small>STAFF PROJECTION</small><h2>Commission by butcher</h2></div></div>{data.commissionStaff.map(staff=>{const totals=data.commissionSummary.find(row=>row.staffId===staff.id);const rate=staff.customRatePercent??data.commissionRate;const net=Number(totals?.netExVat??0);return <div className="commission-ledger-row" key={staff.id}><div><strong>{staff.fullName}</strong><small>{staff.employeeNumber} · scale code {staff.staffCode}</small></div><span>{money(net)} excl. VAT</span><b>{rate.toFixed(2)}%</b><strong>{money(net*rate/100)}</strong></div>})}</section></>;
}

function SandboxReports({data}:{data:Snapshot}){const departments=Object.values(data.products.reduce<Record<string,{name:string;cost:number;retail:number;quantity:number}>>((map,p)=>{const entry=map[p.department]??{name:p.department,cost:0,retail:0,quantity:0};entry.cost+=p.costPrice*p.quantity;entry.retail+=p.sellingPrice*p.quantity;entry.quantity+=p.quantity;map[p.department]=entry;return map;},{})).sort((a,b)=>b.retail-a.retail);return <><div className="eyebrow">SANDBOX / BACK OFFICE / REPORTS</div><div className="page-heading"><div><h1>Scenario profitability report.</h1><p>All figures recalculate from the current sandbox model.</p></div></div><section className="panel sandbox-table"><div className="sandbox-report-row header"><span>DEPARTMENT</span><span>QUANTITY</span><span>COST VALUE</span><span>RETAIL VALUE</span><span>GROSS MARGIN</span></div>{departments.map(d=><div className="sandbox-report-row" key={d.name}><strong>{d.name}</strong><span>{quantity(d.quantity,"units/kg")}</span><span>{money(d.cost)}</span><b>{money(d.retail)}</b><em>{d.retail?`${((d.retail-d.cost)/d.retail*100).toFixed(1)}%`:"0%"}</em></div>)}</section></>}

function SandboxSettings({data,setData,setMessage}:MutatingProps){function change(key:string,value:string){setData(current=>current?{...current,settings:{...current.settings,[key]:value}}:current);setMessage("Setting changed inside the scenario only.");}const fields:[[string,string],[string,string],[string,string],[string,string],[string,string],[string,string]]=[["business_name","Business name"],["yield_tolerance","Yield tolerance %"],["vat_rate","VAT rate %"],["default_terms","Default payment terms"],["target_net_margin","Target net margin %"],["monthly_operating_expenses","Monthly operating expenses"]];return <><div className="eyebrow">SANDBOX / BACK OFFICE / SETTINGS</div><div className="page-heading"><div><h1>Test business settings.</h1><p>Explore changes without replacing live rules.</p></div></div><section className="panel sandbox-settings">{fields.map(([key,label])=><label key={key}>{label}<input value={data.settings[key]??""} onChange={e=>change(key,e.target.value)}/></label>)}</section></>}
