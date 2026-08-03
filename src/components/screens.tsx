"use client";

import {
  ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Check, ChevronRight, CircleAlert,
  Clock3, PackageOpen, Plus, Receipt, Scale, Scissors, ShieldCheck, Sparkles, Truck,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { NewTicketScreen, OpenTicketsScreen, RecentTicketsScreen } from "@/components/butcher-workflows";
import {
  BatchDetailScreen, BatchesScreen, InventoryScreen, ProcessingScreen, ReceiveDeliveryScreen,
} from "@/components/cooler-operations";
import { StockCountScreen, WasteScreen } from "@/components/cooler-workflows";
import { useOperations } from "@/components/operations-store";
import { PosCheckoutScreen } from "@/components/pos-checkout";
import { PosSalesScreen } from "@/components/pos-sales";
import { PosTillScreen } from "@/components/pos-till";
import { ReportCenter } from "@/components/report-center";
import {
  BatchProfitabilityScreen,
  ManagementDashboard,
  ProductProfitabilityScreen,
  ReconciliationScreen,
  SupplierPerformanceScreen,
  VariancesScreen,
} from "@/components/management-screens";
import {
  BackOfficeDashboard, BlockTestProfilesScreen, CsvImportScreen, FoodSafetyScreen,
  ProductsSettingsScreen, PurchasingScreen, SuppliersSettingsScreen, UsersSettingsScreen,
} from "@/components/backoffice-screens";
import { batches, profile } from "@/lib/demo-data";
import { calculateProjectedYields, reconcileProcessing } from "@/lib/inventory";
import { kg, zar } from "@/lib/utils";

const card = "rounded-xl border border-[#322a2a] bg-[#141111]/95 metric-glow";
const label = "text-[10px] font-semibold uppercase tracking-[.15em] text-[#6f7a84]";
const input = "h-11 w-full rounded-lg border border-[#433637] bg-[#0d0b0b] px-3 text-sm text-[#edf2f5] outline-none transition focus:border-[#d93a3e] focus:ring-2 focus:ring-[#d93a3e]/15";
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#f4f0ed] px-4 text-sm font-semibold text-[#171010] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40";

function Title({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div><p className={`${label} mb-2 text-[#ef5b5e]`}>{eyebrow}</p><h1 className="text-2xl font-semibold tracking-tight sm:text-[30px]">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#818c95]">{copy}</p></div>{action}
  </div>;
}

function Badge({ children, tone = "blue" }: { children: React.ReactNode; tone?: "blue" | "green" | "amber" | "red" | "gray" }) {
  const styles = { blue: "border-[#713033] bg-[#2a1517] text-[#ff7779]", green: "border-[#28533e] bg-[#10291f] text-[#5fc78f]", amber: "border-[#5f4820] bg-[#2c210d] text-[#e0aa4b]", red: "border-[#613037] bg-[#2f1519] text-[#e87980]", gray: "border-[#4a3a3b] bg-[#1a1e22] text-[#a0a8af]" };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.09em] ${styles[tone]}`}>{children}</span>;
}

function Metric({ name, value, detail, trend, tone = "neutral" }: { name: string; value: string; detail: string; trend?: string; tone?: "neutral" | "green" | "amber" | "red" }) {
  const colors = { neutral: "text-white", green: "text-[#67d098]", amber: "text-[#e5b45c]", red: "text-[#ea7b82]" };
  return <div className={`${card} relative overflow-hidden p-4`}>
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#8ebbd2]/30 to-transparent"/>
    <p className={label}>{name}</p><div className={`mt-4 text-[25px] font-semibold tracking-[-.04em] ${colors[tone]}`}>{value}</div>
    <div className="mt-2 flex items-center justify-between text-[11px] text-[#69747e]"><span>{detail}</span>{trend && <span className={trend.startsWith("+") ? "text-[#56c587]" : "text-[#df737b]"}>{trend}</span>}</div>
  </div>;
}

function Dashboard() {
  const { coolerBatches, inventory, ledger, stockCounts, tickets, waste } = useOperations();
  const physicalKg = inventory.reduce((sum, item) => sum + item.physical, 0);
  const reservedKg = inventory.reduce((sum, item) => sum + item.reserved, 0);
  const inventoryValue = inventory.reduce((sum, item) => sum + item.physical * item.cost, 0);
  const openTickets = tickets.filter((ticket) => ticket.status === "Open" || ticket.status === "Awaiting payment").length;
  const today = new Date().toISOString().slice(0, 10);
  const wasteToday = waste.filter((item) => item.createdAt.slice(0, 10) === today).reduce((sum, item) => sum + item.weightKg, 0);
  const unprocessedKg = coolerBatches.reduce((sum, batch) => sum + batch.remainingRawKg, 0);
  const todayCount = stockCounts.find((count) => count.createdAt.slice(0, 10) === today);
  const lowStock = inventory.filter((item) => item.active && item.physical - item.reserved <= item.reorderLevelKg);
  const rawBatches = coolerBatches.filter((batch) => batch.remainingRawKg > 0);
  const movementSign = (type: typeof ledger[number]["type"]) => ["SUPPLIER_RECEIPT", "PROCESSING_OUTPUT", "BOOKING_CANCELLATION", "CUSTOMER_RETURN"].includes(type) ? "+" : "−";
  const quickActions = [
    { title: "Receive stock", copy: "Capture a supplier delivery", href: "/cooler/receive", icon: Truck },
    { title: "Process a batch", copy: "Turn raw meat into cuts", href: "/cooler/processing", icon: Scissors },
    { title: "New butcher order", copy: "Weigh and reserve an order", href: "/butcher/new", icon: Scale },
    { title: "Open checkout", copy: "Scan barcodes and take payment", href: "/pos/checkout", icon: Receipt },
  ];
  return <>
    <Title eyebrow="Today" title="What needs doing?" copy="Choose a task below. The system will guide you through it step by step." action={<Link className={button} href="/reports"><BarChart3 size={16}/> View business report</Link>}/>
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric name="Stock available" value={kg(physicalKg - reservedKg)} detail={`${reservedKg.toFixed(1)} kg set aside for orders`} tone="green"/>
      <Metric name="Stock value" value={zar.format(inventoryValue)} detail={`${inventory.length} products in the cooler`}/>
      <Metric name="Waiting to process" value={kg(unprocessedKg)} detail={`${rawBatches.length} batch${rawBatches.length === 1 ? "" : "es"}`} tone={rawBatches.length ? "amber" : "green"}/>
      <Metric name="Waste today" value={kg(wasteToday)} detail={wasteToday ? "Review the waste record" : "No waste recorded today"} tone={wasteToday ? "amber" : "green"}/>
    </div>
    <section className="mb-4"><div className="mb-3 flex items-center justify-between"><div><h2 className="text-base font-semibold">Start a job</h2><p className="mt-1 text-xs text-[#8f8484]">Most-used actions</p></div></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{quickActions.map(({ title, copy, href, icon: Icon }) => <Link className={`${card} group flex items-center gap-4 p-5 transition hover:border-[#713033] hover:bg-[#1b1415]`} href={href} key={href}><span className="grid size-11 shrink-0 place-items-center rounded-lg bg-[#291719] text-[#ef5b5e]"><Icon size={20}/></span><span className="min-w-0"><strong className="block text-sm">{title}</strong><span className="mt-1 block text-xs leading-5 text-[#8f8484]">{copy}</span></span><ChevronRight className="ml-auto shrink-0 text-[#6e6262] transition group-hover:translate-x-0.5 group-hover:text-[#ef5b5e]" size={17}/></Link>)}</div></section>
    <div className="grid gap-4 xl:grid-cols-[.85fr_1.15fr]">
      <section className={`${card} p-5`}><div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-semibold">Needs attention</h2><p className="mt-1 text-xs text-[#8f8484]">A short list of things to check</p></div><CircleAlert className="text-[#e2ab4d]" size={20}/></div>
        {[
          { label: "Raw batches waiting", value: String(rawBatches.length), href: "/cooler/processing", ok: rawBatches.length === 0 },
          { label: "Low-stock products", value: String(lowStock.length), href: "/cooler/inventory", ok: lowStock.length === 0 },
          { label: "Open butcher orders", value: String(openTickets), href: "/butcher/open", ok: openTickets === 0 },
          { label: "Today’s stock count", value: todayCount ? "Done" : "Not done", href: "/cooler/stock-count", ok: Boolean(todayCount) },
        ].map((item) => <Link className="flex min-h-14 items-center gap-3 border-t border-[#302728] text-sm first:border-t-0" href={item.href} key={item.label}><span className={`grid size-7 place-items-center rounded-full ${item.ok ? "bg-[#153629] text-[#61cd94]" : "bg-[#38290f] text-[#e1aa4b]"}`}>{item.ok ? <Check size={14}/> : <Clock3 size={14}/>}</span><span className="flex-1 text-[#c0b6b6]">{item.label}</span><strong className={item.ok ? "text-[#67d098]" : "text-[#e5b45c]"}>{item.value}</strong><ChevronRight className="text-[#6e6262]" size={15}/></Link>)}
      </section>
      <section className={`${card} overflow-hidden`}><div className="flex items-center justify-between border-b border-[#322a2a] p-5"><div><h2 className="text-sm font-semibold">Latest activity</h2><p className="mt-1 text-xs text-[#8f8484]">The five newest stock changes</p></div><Link className="text-xs font-medium text-[#f06a6d]" href="/cooler/inventory">See all stock</Link></div><div>{ledger.slice(0, 5).map((row) => <div className="flex items-center gap-3 border-b border-[#302728] px-5 py-4 last:border-0" key={row.id}><span className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${movementSign(row.type) === "+" ? "bg-[#153629] text-[#61cd94]" : "bg-[#38191c] text-[#e87980]"}`}>{movementSign(row.type)}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{row.product}</p><p className="mt-1 truncate text-xs text-[#8f8484]">{row.type.replaceAll("_", " ").toLowerCase()} · {row.reference}</p></div><div className="text-right"><p className="font-mono text-sm font-semibold">{row.quantityKg.toFixed(2)} kg</p><p className="mt-1 text-xs text-[#8f8484]">{new Date(row.createdAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}</p></div></div>)}</div></section>
    </div>
  </>;
}

function ReceiveDelivery() {
  const [invoiceKg, setInvoiceKg] = useState(718);
  const [actualKg, setActualKg] = useState(720);
  const [cost, setCost] = useState(92);
  const [saved, setSaved] = useState(false);
  const variance = actualKg - invoiceKg;
  const projections = useMemo(() => calculateProjectedYields(actualKg || 1, profile.map(([name, percent], i) => ({ productId: String(i), name, percent }))), [actualKg]);
  return <>
    <Title eyebrow="Cooler / receiving" title="Receive delivery" copy="Capture the supplier weight, verify it against your scale, and create a fully traceable raw batch."/>
    <div className="grid gap-4 xl:grid-cols-[1.08fr_.92fr]">
      <form onSubmit={(e)=>{e.preventDefault(); setSaved(true)}} className={`${card} p-5 sm:p-7`}>
        <div className="mb-6 flex items-center gap-3 border-b border-[#322a2a] pb-5"><div className="grid size-10 place-items-center rounded-lg bg-[#281618] text-[#f06a6d]"><Truck size={20}/></div><div><h2 className="text-sm font-semibold">Supplier & invoice</h2><p className="mt-1 text-xs text-[#6f7a84]">Actual scale weight becomes the stock quantity</p></div></div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="Supplier"><select className={input}><option>Karoo Prime Meats</option><option>Highveld Beef Co.</option></select></Field>
          <Field name="Supplier invoice number"><input className={input} defaultValue="KPM-77841"/></Field>
          <Field name="Delivery date"><input className={input} type="date" defaultValue="2026-07-27"/></Field>
          <Field name="Meat type"><select className={input}><option>Raw Beef</option><option>Lamb</option><option>Pork</option></select></Field>
          <Field name="Carcasses / sides / quarters"><input className={input} type="number" defaultValue="5"/></Field>
          <Field name="Cost per kg (R)"><input className={input} type="number" step=".01" value={cost} onChange={e=>setCost(+e.target.value)}/></Field>
          <Field name="Supplier invoice weight (kg)"><input className={input} type="number" step=".001" value={invoiceKg} onChange={e=>setInvoiceKg(+e.target.value)}/></Field>
          <Field name="Actual scale weight (kg)" hint="Primary stock quantity"><input className={`${input} border-[#743236] text-lg font-semibold`} type="number" step=".001" value={actualKg} onChange={e=>setActualKg(+e.target.value)}/></Field>
          <Field name="Notes" className="sm:col-span-2"><textarea className={`${input} h-20 py-3`} placeholder="Delivery condition, temperature, seals…"/></Field>
        </div>
        <div className="mt-6 flex flex-col items-stretch justify-between gap-4 rounded-lg border border-[#3b3031] bg-[#0d0b0b] p-4 sm:flex-row sm:items-center">
          <div><p className={label}>Weight variance</p><div className={`mt-2 flex items-baseline gap-2 font-mono text-lg font-semibold ${Math.abs(variance/invoiceKg*100) > .5 ? "text-[#e9ae4a]" : "text-[#65c992]"}`}><span>{variance >= 0 ? "+" : ""}{variance.toFixed(2)} kg</span><span className="text-xs">({variance >= 0 ? "+" : ""}{(variance/invoiceKg*100).toFixed(2)}%)</span></div></div>
          <div className="sm:text-right"><p className={label}>Purchase cost</p><p className="mt-2 font-mono text-lg font-semibold">{zar.format(actualKg*cost)}</p></div>
        </div>
        {saved && <div className="mt-4 flex items-center gap-3 rounded-lg border border-[#28533e] bg-[#10291f] p-4 text-sm text-[#70d09d]"><Check size={17}/> Delivery BF-20260727-004 validated and ready to post.</div>}
        <div className="mt-6 flex justify-end"><button className={button} type="submit"><ShieldCheck size={16}/>{saved ? "Post delivery to ledger" : "Review delivery"}</button></div>
      </form>
      <div className={`${card} overflow-hidden`}>
        <div className="border-b border-[#322a2a] p-5"><div className="flex items-center gap-3"><Sparkles size={18} className="text-[#f06a6d]"/><div><h2 className="text-sm font-semibold">Automatic theoretical block test</h2><p className="mt-1 text-xs text-[#6f7a84]">Projection only — no finished physical stock created</p></div></div></div>
        <div className="grid grid-cols-3 gap-px border-b border-[#322a2a] bg-[#322a2a]"><Mini name="Raw input" value={kg(actualKg)}/><Mini name="Profile" value="Standard Beef"/><Mini name="Total" value="100.00%"/></div>
        <div className="scrollbar max-h-[575px] overflow-y-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-[#141111]"><tr className="border-b border-[#322a2a] text-[10px] uppercase tracking-wider text-[#69747e]"><th className="px-5 py-3">Projected output</th><th className="px-4 py-3 text-right">Yield</th><th className="px-5 py-3 text-right">Expected kg</th></tr></thead><tbody>{projections.map(p=><tr key={p.name} className="border-b border-[#2a2323] last:border-0"><td className="px-5 py-3.5 font-medium">{p.name}</td><td className="px-4 py-3.5 text-right font-mono text-[#7c8790]">{p.percent.toFixed(1)}%</td><td className="px-5 py-3.5 text-right font-mono font-semibold">{p.expectedKg.toFixed(2)}</td></tr>)}</tbody></table></div>
        <div className="flex gap-3 border-t border-[#322a2a] bg-[#100d0d] p-4 text-xs leading-5 text-[#7e8992]"><CircleAlert size={16} className="mt-0.5 shrink-0 text-[#d6a348]"/><p>These expected cuts remain projected until a processing session records the actual physical output.</p></div>
      </div>
    </div>
  </>;
}

function Processing() {
  const expected = calculateProjectedYields(720, profile.map(([name, percent], i)=>({productId:String(i),name,percent})));
  const defaults = [48.2,63.1,30.1,11.4,121,38.8,36.1,57.4,130,36,105,39.6];
  const [outputs, setOutputs] = useState(defaults);
  const [loss, setLoss] = useState(3.3);
  const recon = reconcileProcessing(720, outputs.map((actualKg,i)=>({productId:String(i),actualKg})), loss);
  return <>
    <Title eyebrow="Cooler / processing" title="Block-out session" copy="Convert raw batch weight into physical finished inventory. Every kilogram must be assigned before completion." action={<Badge tone="amber">Draft session</Badge>}/>
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric name="Selected batch" value="BF-…-001" detail="Karoo Prime Meats"/><Metric name="Raw input" value="720.0 kg" detail="R 92.00 / kg"/><Metric name="Outputs captured" value={`${recon.outputKg.toFixed(1)} kg`} detail="Finished, bone & waste" tone="green"/><Metric name="Unaccounted" value={`${recon.differenceKg.toFixed(1)} kg`} detail={recon.reconciled ? "Fully reconciled" : "Assign before completion"} tone={recon.reconciled ? "green" : "red"}/></div>
    <div className={`${card} overflow-hidden`}>
      <div className="flex flex-col gap-3 border-b border-[#322a2a] p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-semibold">Expected vs actual yield</h2><p className="mt-1 text-xs text-[#6f7a84]">Enter scale weights to create finished inventory lots linked to this batch.</p></div><div className="flex items-center gap-2"><Badge tone={recon.reconciled ? "green" : "red"}>{recon.reconciled ? "Reconciled" : `${Math.abs(recon.differenceKg).toFixed(2)} kg discrepancy`}</Badge></div></div>
      <div className="scrollbar overflow-x-auto"><table className="w-full min-w-[780px] text-left"><thead><tr className="border-b border-[#322a2a] text-[10px] uppercase tracking-[.12em] text-[#69747d]">{["Product","Expected yield","Expected kg","Actual kg","Variance kg","Variance %","Status"].map((x,i)=><th key={x} className={`px-5 py-3 font-medium ${i>0&&i<6?"text-right":""}`}>{x}</th>)}</tr></thead>
      <tbody>{expected.map((p,i)=>{const v=outputs[i]-p.expectedKg; const vp=v/p.expectedKg*100; const severe=Math.abs(vp)>7; return <tr key={p.name} className="border-b border-[#292222] last:border-0"><td className="px-5 py-3 text-xs font-medium">{p.name}</td><td className="px-5 py-3 text-right font-mono text-xs text-[#7e8992]">{p.percent.toFixed(1)}%</td><td className="px-5 py-3 text-right font-mono text-xs">{p.expectedKg.toFixed(2)}</td><td className="px-5 py-2 text-right"><input aria-label={`${p.name} actual kg`} className="h-9 w-24 rounded-md border border-[#4c3a3c] bg-[#0b0e10] px-2 text-right font-mono text-xs font-semibold outline-none focus:border-[#8c3a3e]" type="number" step=".1" value={outputs[i]} onChange={e=>setOutputs(x=>x.map((v,j)=>j===i?+e.target.value:v))}/></td><td className={`px-5 py-3 text-right font-mono text-xs ${v<0?"text-[#df747b]":"text-[#5bc58c]"}`}>{v>0?"+":""}{v.toFixed(2)}</td><td className={`px-5 py-3 text-right font-mono text-xs ${severe?"text-[#e0a848]":"text-[#84909a]"}`}>{vp>0?"+":""}{vp.toFixed(2)}%</td><td className="px-5 py-3"><Badge tone={severe?"amber":"green"}>{severe?"Review":"Within range"}</Badge></td></tr>})}</tbody></table></div>
      <div className="grid gap-4 border-t border-[#322a2a] bg-[#100d0d] p-5 lg:grid-cols-[1fr_280px_auto] lg:items-end">
        <Field name="Reconciliation reason"><select className={input}><option>Moisture / processing loss</option><option>Trimming loss</option><option>Scale variance</option><option>Accepted variance</option></select></Field>
        <Field name="Recorded loss (kg)"><input className={input} type="number" step=".01" value={loss} onChange={e=>setLoss(+e.target.value)}/></Field>
        <button className={button} disabled={!recon.reconciled}><Check size={16}/> Complete processing</button>
      </div>
    </div>
  </>;
}

function Inventory() {
  const { inventory } = useOperations();
  return <><Title eyebrow="Cooler / stock" title="Finished inventory" copy="Physical, reserved and available kilograms calculated from the immutable stock ledger." action={<div className="flex gap-2"><Badge tone="green">Live ledger</Badge><Link className={button} href="/cooler/stock-count"><Scale size={16}/> Start stock count</Link></div>}/>
    <div className={`${card} overflow-hidden`}><div className="scrollbar overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead><tr className="border-b border-[#322a2a] text-[10px] uppercase tracking-[.12em] text-[#69747d]">{["Product","Physical kg","Reserved kg","Available kg","Avg cost/kg","Potential retail","Last movement","Status"].map((x,i)=><th key={x} className={`px-5 py-3 font-medium ${i>0&&i<6?"text-right":""}`}>{x}</th>)}</tr></thead><tbody>{inventory.map(x=><tr key={x.product} className="border-b border-[#292222] text-xs last:border-0 hover:bg-[#1a1515]"><td className="px-5 py-4 font-semibold">{x.product}</td><td className="px-5 py-4 text-right font-mono">{x.physical.toFixed(1)}</td><td className="px-5 py-4 text-right font-mono text-[#e2ad53]">{x.reserved.toFixed(1)}</td><td className="px-5 py-4 text-right font-mono font-semibold text-[#68cc98]">{(x.physical-x.reserved).toFixed(1)}</td><td className="px-5 py-4 text-right font-mono text-[#89949d]">{zar.format(x.cost)}</td><td className="px-5 py-4 text-right font-mono">{zar.format(x.physical*x.price)}</td><td className="px-5 py-4 text-[#7b868f]">{x.movement}</td><td className="px-5 py-4"><Badge tone={x.product==="Fat/Waste"?"gray":"green"}>{x.product==="Fat/Waste"?"Non-saleable":"Healthy"}</Badge></td></tr>)}</tbody></table></div></div></>;
}

function Batches() {
  return <><Title eyebrow="Cooler / traceability" title="Delivery batches" copy="Trace supplier deliveries through projected yield, processing, inventory and eventual revenue." action={<button className={button}><Plus size={16}/> Receive delivery</button>}/>
    <div className="grid gap-4 lg:grid-cols-2">{batches.map((b,i)=><div key={b.code} className={`${card} group p-5 transition hover:border-[#60383b]`}><div className="flex items-start justify-between"><div><p className="font-mono text-sm font-semibold text-[#ffabad]">{b.code}</p><p className="mt-2 text-xs text-[#78838c]">{b.supplier} · {b.date}</p></div><Badge tone={b.status==="Raw"?"blue":b.status==="Part processed"?"amber":"green"}>{b.status}</Badge></div><div className="my-5 grid grid-cols-3 gap-3 border-y border-[#312829] py-4"><Mini name="Received" value={kg(b.received)}/><Mini name="Raw remaining" value={kg(b.remaining)}/><Mini name="Purchase cost" value={zar.format(b.received*b.cost)}/></div><div className="flex items-center justify-between text-xs"><span className="text-[#77828b]">{i===0?"28 linked ledger entries":"Traceability chain intact"}</span><button className="flex items-center gap-1 text-[#f06a6d]">Open batch <ChevronRight size={14}/></button></div></div>)}</div></>;
}

function Placeholder({ path }: { path: string }) {
  const parts=path.split("/").filter(Boolean); const name=(parts.at(-1)||"dashboard").replaceAll("-"," ");
  return <><Title eyebrow={parts[0]||"Operations"} title={name.replace(/\b\w/g,x=>x.toUpperCase())} copy="This operational surface is scaffolded on the shared ledger, role and audit architecture and is scheduled for the next implementation phase."/>
  <div className={`${card} flex min-h-[420px] flex-col items-center justify-center p-8 text-center`}><div className="grid size-16 place-items-center rounded-2xl border border-[#603236] bg-[#241416] text-[#f06a6d]"><PackageOpen size={28}/></div><h2 className="mt-5 text-lg font-semibold">Foundation ready</h2><p className="mt-2 max-w-md text-sm leading-6 text-[#7d8891]">The database entities, navigation, role boundaries and ledger movement types for this module are already in place. Phase 1 and Phase 2 remain the active production scope.</p><button className="mt-6 flex items-center gap-2 text-sm font-medium text-[#f37a7c]">Return to Cooler dashboard <ArrowRight size={15}/></button></div></>;
}

function Field({ name, hint, className="", children }: { name: string; hint?: string; className?: string; children: React.ReactNode }) {
  return <label className={`block ${className}`}><span className="mb-2 flex items-center justify-between text-xs font-medium text-[#a4adb4]">{name}{hint&&<span className="text-[10px] font-normal text-[#907a7b]">{hint}</span>}</span>{children}</label>;
}
function Mini({ name, value }: { name: string; value: string }) { return <div className="bg-[#141111] px-4 py-3"><p className={label}>{name}</p><p className="mt-2 truncate font-mono text-xs font-semibold">{value}</p></div>; }

export function ScreenRouter({ path }: { path: string }) {
  if (path === "/") return <Dashboard/>;
  if (path === "/cooler/receive") return <ReceiveDeliveryScreen/>;
  if (path === "/cooler/processing") return <ProcessingScreen/>;
  if (path === "/cooler/inventory") return <InventoryScreen/>;
  if (path === "/cooler/batches") return <BatchesScreen/>;
  if (path.startsWith("/cooler/batches/")) return <BatchDetailScreen code={decodeURIComponent(path.slice("/cooler/batches/".length))}/>;
  if (path === "/cooler/stock-count") return <StockCountScreen/>;
  if (path === "/cooler/waste") return <WasteScreen/>;
  if (path === "/butcher/new") return <NewTicketScreen/>;
  if (path === "/butcher/open") return <OpenTicketsScreen/>;
  if (path === "/butcher/recent") return <RecentTicketsScreen/>;
  if (path === "/pos/checkout") return <PosCheckoutScreen/>;
  if (path === "/pos/sales") return <PosSalesScreen/>;
  if (path === "/pos/till") return <PosTillScreen/>;
  if (path === "/reports") return <ReportCenter/>;
  if (path === "/management") return <ManagementDashboard/>;
  if (path === "/management/products") return <ProductProfitabilityScreen/>;
  if (path === "/management/batches") return <BatchProfitabilityScreen/>;
  if (path === "/management/suppliers") return <SupplierPerformanceScreen/>;
  if (path === "/management/variances") return <VariancesScreen/>;
  if (path === "/management/reconciliation") return <ReconciliationScreen/>;
  if (path === "/backoffice") return <BackOfficeDashboard/>;
  if (path === "/backoffice/import") return <CsvImportScreen/>;
  if (path === "/backoffice/purchases") return <PurchasingScreen/>;
  if (path === "/backoffice/food-safety") return <FoodSafetyScreen/>;
  if (path === "/settings/products") return <ProductsSettingsScreen/>;
  if (path === "/settings/block-tests") return <BlockTestProfilesScreen/>;
  if (path === "/settings/suppliers") return <SuppliersSettingsScreen/>;
  if (path === "/settings/users") return <UsersSettingsScreen/>;
  return <Placeholder path={path}/>;
}
