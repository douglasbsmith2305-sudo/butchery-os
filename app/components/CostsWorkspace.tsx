"use client";

import { useEffect, useRef, useState } from "react";
import type { CostData, CostEntry, CostItem, MaterialRow } from "@/lib/costs";
import { cents, currentCostPeriod, materialCost, productionCogs } from "@/lib/cost-calculations";

const money=(value:number)=>new Intl.NumberFormat("en-ZA",{style:"currency",currency:"ZAR"}).format(value/100);
const decimal=(value:number|null)=>value===null?"":String(value);
const rand=(value:number|null)=>value===null?"":(value/100).toFixed(2);
type MaterialDraft={productId:number;openingQuantity:string;openingValue:string;closingQuantity:string;alreadyCosted:boolean};

function summarize(data:CostData):CostData {
  const fixedCents=data.entries.filter(row=>row.status==="POSTED"&&row.category==="FIXED").reduce((sum,row)=>sum+row.amountCents,0);
  const variableCents=data.entries.filter(row=>row.status==="POSTED"&&row.category==="VARIABLE").reduce((sum,row)=>sum+row.amountCents,0);
  return {...data,totals:{...data.totals,fixedCents,variableCents,operatingCents:fixedCents+variableCents,budgetCents:data.items.filter(item=>item.active).reduce((sum,item)=>sum+item.budgetCents,0)}};
}

export default function CostsWorkspace({embedded=false,sandbox=false}:{embedded?:boolean;sandbox?:boolean}) {
  const [period,setPeriod]=useState(currentCostPeriod());
  const [tab,setTab]=useState("Monthly overview");
  const [data,setData]=useState<CostData|null>(null);
  const [refresh,setRefresh]=useState(0);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [itemForm,setItemForm]=useState({id:0,name:"",category:"VARIABLE",budget:"0",active:true});
  const [editing,setEditing]=useState(false);
  const [entry,setEntry]=useState({itemId:0,date:"",amount:"",reference:"",notes:""});
  const [reverseId,setReverseId]=useState(0);
  const [reason,setReason]=useState("");
  const [materials,setMaterials]=useState<MaterialDraft[]>([]);
  const [openingDeferred,setOpeningDeferred]=useState("0");
  const [closingDeferred,setClosingDeferred]=useState("0");
  const [notes,setNotes]=useState("");
  const requestKey=useRef("");
  const requestPayload=useRef("");

  useEffect(()=>{
    const controller=new AbortController();
    const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    setData(null);setMessage("Loading monthly costs…");setEntry({itemId:0,date:today.startsWith(period)?today:`${period}-01`,amount:"",reference:"",notes:""});
    fetch(`/api/costs?period=${period}`,{signal:controller.signal,cache:"no-store"}).then(async response=>{
      const result=await response.json();if(!response.ok)throw new Error(result.error??"Could not load costs.");return result as CostData;
    }).then(result=>{
      setData(result);setMaterials(result.materials.map(row=>({productId:row.productId,openingQuantity:decimal(row.openingQuantity),openingValue:rand(row.openingValueCents),closingQuantity:decimal(row.closingQuantity),alreadyCosted:row.alreadyCosted})));
      setOpeningDeferred(rand(result.openingDeferredCents));setClosingDeferred(rand(result.closingDeferredCents));setNotes(result.notes);setMessage(sandbox?"Snapshot loaded. Changes stay in this sand-box.":"Current month data loaded.");
    }).catch(error=>{if(!controller.signal.aborted)setMessage(error instanceof Error?error.message:"Could not load costs.");});
    return ()=>controller.abort();
  },[period,refresh,sandbox]);

  async function post(payload:object,success:string) {
    if(sandbox){setMessage("Sand-box changes cannot be written to the live system.");return false;}
    setBusy(true);
    try {const response=await fetch("/api/costs",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw new Error(result.error??"Could not save.");setRefresh(value=>value+1);setMessage(success);return true;}
    catch(error){setMessage(error instanceof Error?error.message:"Could not save costs.");return false;}
    finally{setBusy(false);}
  }

  function editItem(item?:CostItem) {
    setItemForm(item?{id:item.id,name:item.name,category:item.category,budget:rand(item.budgetCents),active:!!item.active}:{id:0,name:"",category:tab==="Fixed costs"?"FIXED":"VARIABLE",budget:"0",active:true});setEditing(true);
  }
  async function saveItem() {
    try {
      if(!itemForm.name.trim())throw new Error("Enter a cost item name.");
      const budgetCents=cents(itemForm.budget||"0");
      if(sandbox){setData(current=>current?summarize({...current,items:[...current.items.filter(item=>item.id!==itemForm.id),{id:itemForm.id||Date.now(),name:itemForm.name.trim(),category:itemForm.category as CostItem["category"],budgetCents,active:itemForm.active?1:0}]}):current);setEditing(false);setMessage("Cost item updated in this sand-box only.");}
      else if(await post({action:"item",...itemForm,id:itemForm.id||undefined},"Cost item saved."))setEditing(false);
    } catch(error){setMessage(error instanceof Error?error.message:"Check the cost item.");}
  }
  async function addEntry() {
    try {
      const amountCents=cents(entry.amount);const item=data?.items.find(item=>item.id===entry.itemId&&item.active);
      if(!item||!amountCents)throw new Error("Choose a cost item and enter a positive amount.");
      if(entry.date.slice(0,7)!==period)throw new Error("Choose a date in the selected month.");
      if(sandbox){const row:CostEntry={id:Date.now(),itemId:item.id,itemName:item.name,category:item.category,date:entry.date,amountCents,reference:entry.reference,notes:entry.notes,status:"POSTED",reversalReason:null};setData(current=>current?summarize({...current,entries:[row,...current.entries]}):current);setEntry(current=>({...current,amount:"",reference:"",notes:""}));setMessage("Cost recorded in this sand-box only.");return;}
      if(requestPayload.current!==JSON.stringify(entry)){requestKey.current=crypto.randomUUID();requestPayload.current=JSON.stringify(entry);}
      requestKey.current ||= crypto.randomUUID();
      if(await post({action:"entry",...entry,requestKey:requestKey.current},"Cost recorded.")){requestKey.current="";setEntry(current=>({...current,amount:"",reference:"",notes:""}));}
    } catch(error){setMessage(error instanceof Error?error.message:"Check the expenditure.");}
  }
  async function reverse() {
    if(!reason.trim())return setMessage("Enter a reason for the correction.");
    if(sandbox){setData(current=>current?summarize({...current,entries:current.entries.map(row=>row.id===reverseId?{...row,status:"REVERSED",reversalReason:reason}:row)}):current);setReverseId(0);setReason("");setMessage("Entry reversed in this sand-box only.");}
    else if(await post({action:"reverse",id:reverseId,reason},"Entry reversed; its history is retained.")){setReverseId(0);setReason("");}
  }
  function changeMaterial(productId:number,key:keyof Omit<MaterialDraft,"productId">,value:string|boolean) {setMaterials(current=>current.map(row=>row.productId===productId?{...row,[key]:value}:row));}
  function calculateDraft(row:MaterialDraft) {
    const source=data!.materials.find(item=>item.productId===row.productId)!;
    const openingQuantity=source.carried?source.openingQuantity:row.openingQuantity===""?null:Number(row.openingQuantity);
    const openingValueCents=source.carried?source.openingValueCents:row.openingValue===""?null:cents(row.openingValue);
    const closingQuantity=row.closingQuantity===""?null:Number(row.closingQuantity);
    return {...source,...materialCost({...source,openingQuantity,openingValueCents,closingQuantity,alreadyCosted:row.alreadyCosted}),openingQuantity,openingValueCents,closingQuantity,alreadyCosted:row.alreadyCosted};
  }
  async function saveMaterials() {
    try {
      const rows=materials.map(calculateDraft);
      if(rows.some(row=>!row.complete))throw new Error("Enter an opening count, opening value and unused closing count for every production input.");
      const openingCents=data!.deferredCarried?data!.openingDeferredCents:cents(openingDeferred);
      const closingCents=cents(closingDeferred);
      const additionalCogsCents=productionCogs(rows.reduce((sum,row)=>sum+row.additionalCogsCents,0),openingCents,closingCents);
      if(sandbox){setData(current=>current?{...current,materials:rows,openingDeferredCents:openingCents,closingDeferredCents:closingCents,notes,totals:{...current.totals,pendingCounts:0,consumedCents:rows.reduce((sum,row)=>sum+row.consumedCents,0),additionalConsumedCents:rows.reduce((sum,row)=>sum+row.additionalCogsCents,0),additionalCogsCents,closingCents:rows.reduce((sum,row)=>sum+row.closingValueCents,0)}}:current);setMessage("Materials recalculated in this sand-box only.");return;}
      await post({action:"materials",period,materials:materials.map(row=>({...row,openingQuantity:row.openingQuantity===""?null:Number(row.openingQuantity),closingQuantity:row.closingQuantity===""?null:Number(row.closingQuantity)})),openingDeferred,closingDeferred,notes},"Materials reconciled. Closing stock carries into next month.");
    }catch(error){setMessage(error instanceof Error?error.message:"Check the stock reconciliation.");}
  }

  const category=tab==="Fixed costs"?"FIXED":"VARIABLE";
  const groupItems=data?.items.filter(item=>item.category===category)??[];
  const groupEntries=data?.entries.filter(row=>row.category===category)??[];
  const totalCost=data?data.soldCogsCents+data.totals.additionalCogsCents+data.totals.operatingCents+data.recordedLossCents:0;
  const result=data?data.netRevenueCents-totalCost:0;
  return <div className={embedded?"cost-workspace":"content cost-workspace"}>
    {!embedded?<><div className="eyebrow">{sandbox?"SAND-BOX":"BACK OFFICE"} / COSTS & PRODUCTION</div><div className="page-heading"><div><h1>Know what it costs to run the shop.</h1><p>Record each fixed and variable cost, reconcile production inputs, and see the effect on the month&apos;s profit.</p></div><label className="cost-period">Reporting month<input type="month" value={period} onChange={event=>setPeriod(event.target.value||currentCostPeriod())}/></label></div></>:<label className="cost-period">Reporting month<input type="month" value={period} onChange={event=>setPeriod(event.target.value||currentCostPeriod())}/></label>}
    <div className="cost-message" role="status">{message}</div>
    <div className="finance-tabs">{["Monthly overview","Fixed costs","Variable costs","Cost of goods"].map(name=><button key={name} className={tab===name?"active":""} onClick={()=>setTab(name)}>{name}</button>)}<button onClick={()=>setRefresh(value=>value+1)} disabled={busy}>Refresh{sandbox?" snapshot":""}</button></div>
    {!data?<div className="panel empty-stock">{message.startsWith("Loading")?"Loading costs and supplier receipts…":"Monthly costs could not be loaded. Use Refresh to try again."}</div>:<>
    <section className="stat-grid cost-kpis"><article><small>FIXED COSTS</small><strong>{money(data.totals.fixedCents)}</strong><em>Posted this month</em></article><article><small>VARIABLE COSTS</small><strong>{money(data.totals.variableCents)}</strong><em>Including repeated top-ups</em></article><article><small>ADDITIONAL MATERIAL COST</small><strong>{money(data.totals.additionalCogsCents)}</strong><em>After unused stock & carry-forward</em></article><article><small>UNUSED INPUT STOCK</small><strong>{money(data.totals.closingCents)}</strong><em>{data.totals.pendingCounts?`${data.totals.pendingCounts} count(s) still needed`:"Carried forward at weighted cost"}</em></article></section>
    {tab==="Monthly overview"?<><div className="cost-overview-grid"><section className="panel"><div className="panel-head"><div><small>{period} / RECORDED COSTS</small><h2>Monthly profit bridge</h2></div></div><div className="cost-profit-lines"><div><span>Paid sales, excluding VAT</span><b>{money(data.netRevenueCents)}</b></div><div><span>Sold product cost · estimated from unit costs</span><b>− {money(data.soldCogsCents)}</b></div><div><span>Additional production materials</span><b>− {money(data.totals.additionalCogsCents)}</b></div><div><span>Fixed costs</span><b>− {money(data.totals.fixedCents)}</b></div><div><span>Variable costs</span><b>− {money(data.totals.variableCents)}</b></div><div><span>Recorded waste & stock shortages</span><b>− {money(data.recordedLossCents)}</b></div><div className="cost-result"><span>Result after recorded costs</span><strong className={result>=0?"green":"amber"}>{money(result)}</strong></div><div><span>Margin after recorded costs</span><b>{data.netRevenueCents?(result/data.netRevenueCents*100).toFixed(1)+"%":"Awaiting sales"}</b></div></div><p className="cost-help">This is an estimate from recorded data, before unrecorded costs and losses. Payroll is included here only when recorded as a cost. Budgets are planning figures, not posted expenses.</p></section><section className="panel"><div className="panel-head"><div><small>COST BREAKDOWN</small><h2>Where the money went</h2></div></div>{data.items.map(item=>{const total=data.entries.filter(row=>row.itemId===item.id&&row.status==="POSTED").reduce((sum,row)=>sum+row.amountCents,0);return <div className="cost-breakdown" key={item.id}><div><strong>{item.name}</strong><small>{item.category==="FIXED"?"Fixed":"Variable"} · budget {money(item.budgetCents)}</small></div><b>{money(total)}</b></div>;})}<div className="cost-breakdown"><div><strong>Cost of goods</strong><small>Additional materials, after carry-forward adjustments</small></div><b>{money(data.totals.additionalCogsCents)}</b></div></section></div><div className="cost-explainer"><strong>Opening stock + purchases − unused closing stock = materials consumed.</strong><p>The closing balance becomes next month&apos;s opening balance. Keep the material cost of unsold finished goods separate, and mark inputs already included in finished-product unit costs so they are not charged twice.</p>{data.totals.pendingCounts>0?<p className="amber">The material cost is provisional: {data.totals.pendingCounts} production-input count(s) are missing.</p>:null}{data.reconciliationError?<p className="amber">{data.reconciliationError}</p>:null}</div></>:null}
    {tab==="Fixed costs"||tab==="Variable costs"?<><div className="cost-entry-layout"><section className="panel"><div className="panel-head"><div><small>POST AN EXPENDITURE</small><h2>{tab==="Fixed costs"?"Fixed cost payment":"Variable cost payment / purchase"}</h2></div></div><div className="finance-form-body"><label className="wide">Cost item<select value={entry.itemId} onChange={event=>setEntry(current=>({...current,itemId:Number(event.target.value)}))}><option value={0}>Choose a cost item…</option>{groupItems.filter(item=>item.active).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Date<input type="date" value={entry.date} min={`${period}-01`} onChange={event=>setEntry(current=>({...current,date:event.target.value}))}/></label><label>Cost amount (R)<input type="number" min=".01" step=".01" value={entry.amount} onChange={event=>{requestKey.current="";setEntry(current=>({...current,amount:event.target.value}));}} placeholder="400.00"/></label><label className="wide">Invoice / payment reference<input value={entry.reference} onChange={event=>setEntry(current=>({...current,reference:event.target.value}))} placeholder="Supplier invoice or electricity token reference"/></label><label className="wide">Notes<input value={entry.notes} onChange={event=>setEntry(current=>({...current,notes:event.target.value}))} placeholder="Optional description"/></label><p className="cost-help wide">Enter costs excluding recoverable VAT. Add each R400 electricity purchase separately; the month totals automatically. Stock purchases belong in Receiving, not in this form.</p><button className="primary-action" disabled={busy} onClick={addEntry}>{sandbox?"Simulate cost":"Record cost"}<span>＋</span></button></div></section><section className="panel"><div className="panel-head"><div><small>REUSABLE COST ITEMS</small><h2>{tab}</h2></div><button onClick={()=>editItem()}>+ New item</button></div>{groupItems.map(item=><div className="cost-breakdown" key={item.id}><div><strong>{item.name}{!item.active?" · archived":""}</strong><small>Monthly planning budget {money(item.budgetCents)}</small></div><button className="cost-secondary" onClick={()=>editItem(item)}>Edit</button></div>)}{editing?<div className="finance-form-body cost-item-form"><label className="wide">Item name<input value={itemForm.name} onChange={event=>setItemForm(current=>({...current,name:event.target.value}))}/></label><label>Category<select value={itemForm.category} onChange={event=>setItemForm(current=>({...current,category:event.target.value}))}><option value="FIXED">Fixed cost</option><option value="VARIABLE">Variable cost</option></select></label><label>Monthly budget (R)<input type="number" min="0" step=".01" value={itemForm.budget} onChange={event=>setItemForm(current=>({...current,budget:event.target.value}))}/></label><label className="wide cost-check"><input type="checkbox" checked={itemForm.active} onChange={event=>setItemForm(current=>({...current,active:event.target.checked}))}/>Active for future entries</label><button className="primary-action" disabled={busy} onClick={saveItem}>Save cost item</button><button className="cost-secondary wide" onClick={()=>setEditing(false)}>Cancel</button></div>:null}</section></div><section className="panel cost-register"><div className="panel-head"><div><small>PERMANENT HISTORY</small><h2>{period} · {tab.toLowerCase()}</h2></div><span>{groupEntries.filter(row=>row.status==="POSTED").length} posted entries</span></div>{groupEntries.length?groupEntries.map(row=><div className={`cost-entry-row ${row.status==="REVERSED"?"reversed":""}`} key={row.id}><div><strong>{row.itemName}</strong><small>{row.date} · {row.reference||"No reference"}</small><small>{row.notes}{row.reversalReason?` · Correction: ${row.reversalReason}`:""}</small></div><b>{money(row.amountCents)}</b>{row.status==="POSTED"?<button className="cost-secondary" onClick={()=>{setReverseId(row.id);setReason("");}}>Correct / reverse</button>:<span>Reversed</span>}</div>):<div className="empty-stock">No costs recorded in this section for {period}.</div>}{reverseId?<div className="cost-reversal"><label>Correction reason<input value={reason} onChange={event=>setReason(event.target.value)} placeholder="Why should this entry be reversed?"/></label><button className="cost-secondary" disabled={busy} onClick={reverse}>Reverse entry</button><button className="cost-secondary" onClick={()=>setReverseId(0)}>Cancel</button></div>:null}</section></>:null}
    {tab==="Cost of goods"?<><div className="cost-explainer"><strong>Assign production inputs to Stock Master → Cost of goods.</strong><p>Use bulk assignment for spices, flour, casings, packaging and other inputs. Receive purchases normally; their quantities and invoice costs appear below automatically. Count unused stock at month-end. This worksheet values monthly consumption; operational inventory counts remain in Manager → Stock count.</p><p>Keep raw meat already covered by carcass / finished-product costs in its existing department. Tick “Already in unit cost” when an input is already included in finished-product unit costs.</p>{data.carriedInto?<p className="amber">These counts have carried into {data.carriedInto} and are preserved. Expenditure entries remain editable through reversals.</p>:null}</div><section className="panel cost-materials"><div className="panel-head"><div><small>MONTH-END STOCK VALUATION</small><h2>Production inputs · {period}</h2></div><span>Weighted average purchase cost</span></div><div className="cost-material-scroll"><div className="cost-material-row header"><span>INPUT PRODUCT</span><span>OPENING QTY</span><span>OPENING VALUE (R)</span><span>PURCHASES</span><span>UNUSED QTY</span><span>CONSUMED COST</span><span>ALREADY IN UNIT COST</span></div>{materials.map(row=>{const source=data.materials.find(item=>item.productId===row.productId)!;let calculated:ReturnType<typeof calculateDraft>|null=null;let error="";try{calculated=calculateDraft(row);}catch(caught){error=caught instanceof Error?caught.message:"Check counts";}return <div className="cost-material-row" key={row.productId}><div><strong>{source.name}</strong><small>{source.sku} · {source.unit}</small><small>{source.carried?`Opening from ${data.previousPeriod}`:"Enter the first opening balance"}</small>{error?<small className="amber">{error}</small>:null}</div><label><span className="sr-only">{source.name} opening quantity</span><input type="number" min="0" step=".001" value={row.openingQuantity} readOnly={source.carried||!!data.carriedInto} onChange={event=>changeMaterial(row.productId,"openingQuantity",event.target.value)}/></label><label><span className="sr-only">{source.name} opening value in rand</span><input type="number" min="0" step=".01" value={row.openingValue} readOnly={source.carried||!!data.carriedInto} onChange={event=>changeMaterial(row.productId,"openingValue",event.target.value)}/></label><div><b>{money(source.purchaseValueCents)}</b><small>{source.purchasedQuantity.toFixed(3)} {source.unit}</small></div><label><span className="sr-only">{source.name} unused closing quantity</span><input type="number" min="0" step=".001" value={row.closingQuantity} readOnly={!!data.carriedInto} onChange={event=>changeMaterial(row.productId,"closingQuantity",event.target.value)}/></label><div><b>{calculated?.complete?money(calculated.consumedCents):"Count needed"}</b><small>Unused {calculated?.complete?money(calculated.closingValueCents):"—"}</small></div><label className="cost-check"><input type="checkbox" aria-label={`${source.name} already included in finished product cost`} checked={row.alreadyCosted} disabled={!!data.carriedInto} onChange={event=>changeMaterial(row.productId,"alreadyCosted",event.target.checked)}/><span>{row.alreadyCosted?"Exclude duplicate":"Additional cost"}</span></label></div>;})}</div>{!materials.length?<div className="empty-stock">No production inputs yet. Assign items to the Cost of goods department in Stock Master, then refresh.</div>:null}<div className="finance-form-body"><label>Opening materials in unsold finished goods (R)<input type="number" min="0" step=".01" value={openingDeferred} readOnly={data.deferredCarried||!!data.carriedInto} onChange={event=>setOpeningDeferred(event.target.value)}/></label><label>Closing materials in unsold finished goods (R)<input type="number" min="0" step=".01" value={closingDeferred} readOnly={!!data.carriedInto} onChange={event=>setClosingDeferred(event.target.value)}/></label><p className="cost-help wide">Only the additional ingredient / packaging cost held in unfinished or unsold finished goods goes here. It is carried forward until the goods sell. Do not enter the full selling value or costs already covered by product unit costs.</p><label className="wide">Valuation notes<input value={notes} readOnly={!!data.carriedInto} onChange={event=>setNotes(event.target.value)} placeholder="Count date, valuation basis or explanation"/></label><button className="primary-action" disabled={busy||!!data.carriedInto} onClick={saveMaterials}>{sandbox?"Recalculate scenario":"Save monthly reconciliation"}<span>→</span></button></div></section><section className="panel cost-register"><div className="panel-head"><div><small>AUTOMATIC FROM RECEIVING</small><h2>Input purchases this month</h2></div></div>{data.purchases.map((row,index)=><div className="cost-entry-row" key={`${row.receiptNumber}-${row.productId}-${index}`}><div><strong>{row.productName}</strong><small>{row.deliveryDate} · {row.supplierName} · invoice {row.invoiceNumber}</small><small>{row.receiptNumber} · {row.quantity} received</small></div><b>{money(Math.round(row.total*100))}</b></div>)}{!data.purchases.length?<div className="empty-stock">Production-input receipts for this month will appear here.</div>:null}</section></>:null}
    </>}
  </div>;
}
