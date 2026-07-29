"use client";

import {
  ArrowUpRight, Banknote, BarChart3, Boxes, Check,
  ChevronRight, CircleAlert, ClipboardCheck, PackageCheck, ReceiptText, Scale,
  Search, ShieldCheck, ShoppingCart, Sparkles, Target, TriangleAlert, Truck, WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useOperations } from "@/components/operations-store";
import {
  calculateBatchProfitability,
  calculateManagementSummary,
  calculateProductProfitability,
  calculateReconciliation,
  calculateSupplierPerformance,
  calculateVarianceIssues,
  completedSales,
  managementBatches,
  type ManagementRange,
  type VarianceIssue,
} from "@/lib/management";
import { profile } from "@/lib/demo-data";
import { kg, zar } from "@/lib/utils";

const card = "rounded-xl border border-[#322a2a] bg-[#141111]/95 metric-glow";
const label = "text-[10px] font-semibold uppercase tracking-[.15em] text-[#6f7a84]";
const input = "h-11 rounded-lg border border-[#433637] bg-[#0d0b0b] px-3 text-sm text-[#edf2f5] outline-none transition focus:border-[#d93a3e] focus:ring-2 focus:ring-[#d93a3e]/15";
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#f4f0ed] px-4 text-sm font-semibold text-[#171010] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40";

const ranges: { value: ManagementRange; label: string }[] = [
  { value: "today", label: "Today" }, { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" }, { value: "all", label: "All time" },
];

function Header({ eyebrow, title, copy, children }: { eyebrow: string; title: string; copy: string; children?: React.ReactNode }) {
  return <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
    <div><p className={`${label} mb-2 text-[#ef5b5e]`}>{eyebrow}</p><h1 className="text-2xl font-semibold tracking-tight sm:text-[30px]">{title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[#818c95]">{copy}</p></div>
    {children}
  </div>;
}

function RangePicker({ value, onChange }: { value: ManagementRange; onChange(value: ManagementRange): void }) {
  return <div className="inline-flex rounded-lg border border-[#2d343a] bg-[#0d0b0b] p-1">
    {ranges.map((range) => <button className={`rounded-md px-3 py-2 text-xs font-medium transition ${value === range.value ? "bg-[#243540] text-[#a7d0e5]" : "text-[#78838d] hover:text-white"}`} key={range.value} onClick={() => onChange(range.value)}>{range.label}</button>)}
  </div>;
}

function Metric({ title, value, detail, tone = "neutral", icon: Icon }: { title: string; value: string; detail: string; tone?: "neutral" | "green" | "amber" | "red"; icon: React.ComponentType<{ size?: number; className?: string }> }) {
  const colors = { neutral: "text-white", green: "text-[#67d098]", amber: "text-[#e5b45c]", red: "text-[#ea7b82]" };
  return <div className={`${card} relative overflow-hidden p-4`}>
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#8ebbd2]/30 to-transparent"/>
    <div className="flex items-start justify-between"><p className={label}>{title}</p><Icon className="text-[#4d6675]" size={16}/></div>
    <p className={`mt-4 text-[24px] font-semibold tracking-[-.04em] ${colors[tone]}`}>{value}</p>
    <p className="mt-2 text-[11px] text-[#69747e]">{detail}</p>
  </div>;
}

function Status({ children, tone = "green" }: { children: React.ReactNode; tone?: "green" | "amber" | "red" | "gray" | "blue" }) {
  const tones = {
    green: "border-[#28533e] bg-[#10291f] text-[#5fc78f]", amber: "border-[#5f4820] bg-[#2c210d] text-[#e0aa4b]",
    red: "border-[#613037] bg-[#2f1519] text-[#e87980]", gray: "border-[#4a3a3b] bg-[#1a1e22] text-[#a0a8af]",
    blue: "border-[#713033] bg-[#2a1517] text-[#ff7779]",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[.09em] ${tones[tone]}`}>{children}</span>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function ManagementDashboard() {
  const operations = useOperations();
  const [range, setRange] = useState<ManagementRange>("today");
  const summary = calculateManagementSummary({ ...operations, range });
  const sales = completedSales(operations.sales, range);
  const paymentTotals = (["Cash", "Card", "EFT", "Customer account"] as const).map((method) => ({
    method,
    amount: sales.flatMap((sale) => sale.payments).filter((payment) => payment.method === method).reduce((sum, payment) => sum + payment.amount, 0),
  }));
  const maxPayment = Math.max(1, ...paymentTotals.map((item) => item.amount));
  const varianceIssues = calculateVarianceIssues(operations);
  const openIssues = varianceIssues.filter((issue) => !operations.managementReviews.some((review) => review.issueId === issue.id));
  const reconciliation = calculateReconciliation({ ...operations, range });
  return <>
    <Header eyebrow="Management / command centre" title="Business control dashboard" copy="Revenue, kilogram flow, margin, exceptions, and cash controls in one operating view.">
      <RangePicker value={range} onChange={setRange}/>
    </Header>
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={WalletCards} title="Revenue" value={zar.format(summary.revenue)} detail={`${sales.length} completed sale${sales.length === 1 ? "" : "s"}`} tone="green"/>
      <Metric icon={BarChart3} title="Gross profit" value={zar.format(summary.grossProfit)} detail={`${summary.grossMargin.toFixed(2)}% gross margin`} tone="green"/>
      <Metric icon={Scale} title="Kg sold" value={kg(summary.kgSold)} detail={`${zar.format(summary.averageSellingPriceKg)} average / kg`}/>
      <Metric icon={Truck} title="Purchases" value={zar.format(summary.purchases)} detail={`${summary.purchaseKg.toFixed(1)} kg received`} tone="amber"/>
    </div>
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={TriangleAlert} title="Waste" value={kg(summary.wasteKg)} detail="Posted at weighted cost" tone={summary.wasteKg > 5 ? "amber" : "neutral"}/>
      <Metric icon={ClipboardCheck} title="Stock variance" value={kg(summary.stockVarianceKg)} detail="Signed physical-count movement" tone={Math.abs(summary.stockVarianceKg) > .01 ? "amber" : "green"}/>
      <Metric icon={Banknote} title="Cash variance" value={zar.format(summary.cashVariance)} detail="Closed till sessions" tone={Math.abs(summary.cashVariance) > .01 ? "red" : "green"}/>
      <Metric icon={Boxes} title="Cooler inventory" value={zar.format(summary.inventoryValue)} detail={`${summary.openTickets} open butcher ticket${summary.openTickets === 1 ? "" : "s"}`}/>
    </div>
    <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
      <div className={`${card} p-5`}>
        <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Payment mix</h2><p className="mt-1 text-xs text-[#6f7a84]">Completed transactions only; refunds excluded</p></div><ReceiptText className="text-[#719db4]" size={19}/></div>
        <div className="mt-6 space-y-4">{paymentTotals.map((item) => <div key={item.method}>
          <div className="mb-2 flex items-center justify-between text-xs"><span className="text-[#9ca6ae]">{item.method}</span><span className="font-mono font-semibold">{zar.format(item.amount)}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-[#292222]"><div className="h-full rounded-full bg-gradient-to-r from-[#37647c] to-[#71b3d4]" style={{ width: `${item.amount / maxPayment * 100}%` }}/></div>
        </div>)}</div>
        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-[#322a2a] pt-5">
          <div className="rounded-lg bg-[#100d0d] p-4"><p className={label}>Average sale</p><p className="mt-2 font-mono text-lg font-semibold">{zar.format(sales.length ? summary.revenue / sales.length : 0)}</p></div>
          <div className="rounded-lg bg-[#100d0d] p-4"><p className={label}>Stock integrity</p><p className={`mt-2 text-lg font-semibold ${reconciliation.reconciled ? "text-[#67d098]" : "text-[#e5b45c]"}`}>{reconciliation.reconciled ? "Reconciled" : `${reconciliation.varianceKg.toFixed(2)} kg variance`}</p></div>
        </div>
      </div>
      <div className={`${card} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-[#322a2a] p-5"><div><h2 className="text-sm font-semibold">Management attention</h2><p className="mt-1 text-xs text-[#6f7a84]">{openIssues.length} unreviewed exception{openIssues.length === 1 ? "" : "s"}</p></div><TriangleAlert className={openIssues.length ? "text-[#e0aa4b]" : "text-[#5fc78f]"} size={19}/></div>
        <div>{openIssues.slice(0, 5).map((issue) => <div className="flex items-center gap-3 border-b border-[#2b2424] p-4 last:border-0" key={issue.id}>
          <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${issue.severity === "High" ? "bg-[#2f1519] text-[#e87980]" : issue.severity === "Medium" ? "bg-[#2c210d] text-[#e0aa4b]" : "bg-[#281618] text-[#ff7779]"}`}><CircleAlert size={16}/></span>
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{issue.reference} · {issue.category}</p><p className="mt-1 truncate text-[11px] text-[#737e87]">{issue.description}</p></div>
          <span className="font-mono text-xs">{issue.quantityKg === undefined ? zar.format(issue.value) : `${issue.quantityKg > 0 ? "+" : ""}${issue.quantityKg.toFixed(2)} kg`}</span>
        </div>)}</div>
        <Link className="flex items-center justify-between border-t border-[#322a2a] p-4 text-xs font-semibold text-[#f06a6d] hover:bg-[#1a1515]" href="/management/variances">Review all exceptions <ChevronRight size={15}/></Link>
      </div>
    </div>
    <div className="mt-4 grid gap-3 md:grid-cols-3">
      {[
        { title: "Product profitability", copy: "Margin and kilogram performance by cut", href: "/management/products", icon: ShoppingCart },
        { title: "Batch economics", copy: "Supplier cost through realized revenue", href: "/management/batches", icon: PackageCheck },
        { title: "Daily reconciliation", copy: "Close the kilogram control loop", href: "/management/reconciliation", icon: ShieldCheck },
      ].map(({ title, copy, href, icon: Icon }) => <Link className={`${card} group flex items-center gap-4 p-5 transition hover:border-[#3c5361]`} href={href} key={href}><span className="grid size-10 place-items-center rounded-lg bg-[#281618] text-[#ff7779]"><Icon size={19}/></span><span className="flex-1"><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-xs text-[#727d86]">{copy}</span></span><ChevronRight className="text-[#56636c] transition group-hover:translate-x-1" size={16}/></Link>)}
    </div>
  </>;
}

export function ProductProfitabilityScreen() {
  const operations = useOperations();
  const [range, setRange] = useState<ManagementRange>("30d");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"profit" | "margin" | "sold" | "closing">("profit");
  const rows = useMemo(() => calculateProductProfitability({ ...operations, range })
    .filter((row) => row.product.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => sort === "profit" ? b.grossProfit - a.grossProfit : sort === "margin" ? b.grossMargin - a.grossMargin : sort === "sold" ? b.soldKg - a.soldKg : b.closingKg - a.closingKg), [operations, query, range, sort]);
  const totals = rows.reduce((sum, row) => ({ sold: sum.sold + row.soldKg, revenue: sum.revenue + row.revenue, profit: sum.profit + row.grossProfit, closing: sum.closing + row.closingKg }), { sold: 0, revenue: 0, profit: 0, closing: 0 });
  return <>
    <Header eyebrow="Management / product economics" title="Product profitability" copy="See which cuts create profit, which hold cash in stock, and where selling price or yield needs attention."><RangePicker value={range} onChange={setRange}/></Header>
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={Scale} title="Sold weight" value={kg(totals.sold)} detail={`${rows.length} product lines`}/>
      <Metric icon={WalletCards} title="Revenue" value={zar.format(totals.revenue)} detail="Completed meat sales" tone="green"/>
      <Metric icon={ArrowUpRight} title="Gross profit" value={zar.format(totals.profit)} detail={`${totals.revenue ? (totals.profit / totals.revenue * 100).toFixed(2) : "0.00"}% blended margin`} tone="green"/>
      <Metric icon={Boxes} title="Closing stock" value={kg(totals.closing)} detail="Physical Cooler quantity" tone="amber"/>
    </div>
    <div className={`${card} overflow-hidden`}>
      <div className="flex flex-col gap-3 border-b border-[#322a2a] p-4 md:flex-row md:items-center">
        <label className="relative flex-1"><Search className="absolute left-3 top-3 text-[#61717b]" size={16}/><input aria-label="Search products" className={`${input} w-full pl-10`} placeholder="Search a product…" value={query} onChange={(event) => setQuery(event.target.value)}/></label>
        <select aria-label="Sort products" className={input} value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="profit">Highest gross profit</option><option value="margin">Highest margin</option><option value="sold">Most kg sold</option><option value="closing">Most closing stock</option></select>
      </div>
      <div className="scrollbar overflow-x-auto"><table className="w-full min-w-[1240px] text-left text-xs"><thead><tr className="border-b border-[#322a2a] text-[9px] uppercase tracking-[.1em] text-[#69747d]">{["Product","Opening kg","Produced kg","Sold kg","Revenue","Avg sell/kg","Avg cost/kg","Gross profit","Margin","Closing kg","Variance"].map((heading, index) => <th className={`px-4 py-3 font-medium ${index > 0 ? "text-right" : ""}`} key={heading}>{heading}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr className="border-b border-[#292222] last:border-0 hover:bg-[#1a1515]" key={row.productId}><td className="px-4 py-4 font-semibold">{row.product}</td><td className="px-4 py-4 text-right font-mono text-[#7e8992]">{row.openingKg.toFixed(1)}</td><td className="px-4 py-4 text-right font-mono text-[#f06a6d]">{row.producedKg.toFixed(1)}</td><td className="px-4 py-4 text-right font-mono">{row.soldKg.toFixed(2)}</td><td className="px-4 py-4 text-right font-mono">{zar.format(row.revenue)}</td><td className="px-4 py-4 text-right font-mono">{zar.format(row.averageSellingPriceKg)}</td><td className="px-4 py-4 text-right font-mono text-[#8a949c]">{zar.format(row.averageCostKg)}</td><td className={`px-4 py-4 text-right font-mono font-semibold ${row.grossProfit >= 0 ? "text-[#67d098]" : "text-[#e87980]"}`}>{zar.format(row.grossProfit)}</td><td className="px-4 py-4 text-right"><Status tone={row.grossMargin >= 35 ? "green" : row.grossMargin >= 20 ? "amber" : "red"}>{row.grossMargin.toFixed(1)}%</Status></td><td className="px-4 py-4 text-right font-mono font-semibold">{row.closingKg.toFixed(1)}</td><td className={`px-4 py-4 text-right font-mono ${Math.abs(row.varianceKg) < .01 ? "text-[#77828b]" : "text-[#e5b45c]"}`}>{row.varianceKg > 0 ? "+" : ""}{row.varianceKg.toFixed(2)}</td></tr>)}</tbody>
      </table></div>
    </div>
  </>;
}

export function BatchProfitabilityScreen() {
  const [selected, setSelected] = useState(managementBatches[0].code);
  const selectedBatch = managementBatches.find((batch) => batch.code === selected) ?? managementBatches[0];
  const result = calculateBatchProfitability(selectedBatch);
  return <>
    <Header eyebrow="Management / batch economics" title="Batch profitability" copy="Follow supplier spend through actual yield, realized revenue, remaining stock value, and gross profit.">
      <select aria-label="Select batch" className={input} value={selected} onChange={(event) => setSelected(event.target.value)}>{managementBatches.map((batch) => <option key={batch.code}>{batch.code}</option>)}</select>
    </Header>
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={Truck} title="Purchase" value={zar.format(result.purchaseCost)} detail={`${result.receivedKg.toFixed(1)} kg @ ${zar.format(result.costPerKg)}/kg`}/>
      <Metric icon={Scale} title="Actual output" value={kg(result.actualOutputKg)} detail={`${result.yieldVarianceKg > 0 ? "+" : ""}${result.yieldVarianceKg.toFixed(2)} kg processing difference`} tone={Math.abs(result.yieldVarianceKg) <= 3 ? "green" : "amber"}/>
      <Metric icon={WalletCards} title="Revenue so far" value={zar.format(result.baseRevenue)} detail={`${result.soldEquivalentKg.toFixed(1)} kg equivalent sold`} tone="green"/>
      <Metric icon={ArrowUpRight} title="Realized gross profit" value={zar.format(result.grossProfit)} detail={`${result.grossMargin.toFixed(2)}% realized margin`} tone="green"/>
    </div>
    <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
      <div className={`${card} overflow-hidden`}>
        <div className="flex flex-col gap-3 border-b border-[#322a2a] p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-mono text-sm font-semibold text-[#ffabad]">{result.code}</h2><p className="mt-1 text-xs text-[#77828b]">{result.supplier} · {result.date}</p></div><Status tone={result.processedKg === 0 ? "blue" : result.remainingRawKg ? "amber" : "green"}>{result.processedKg === 0 ? "Raw" : result.remainingRawKg ? "Part processed" : "Processed"}</Status></div>
        {result.processedKg ? <div className="scrollbar overflow-x-auto"><table className="w-full min-w-[650px] text-xs"><thead><tr className="border-b border-[#322a2a] text-[9px] uppercase tracking-wider text-[#69747d]"><th className="px-5 py-3 text-left font-medium">Output</th><th className="px-5 py-3 text-right font-medium">Profile</th><th className="px-5 py-3 text-right font-medium">Expected kg</th><th className="px-5 py-3 text-right font-medium">Actual kg</th><th className="px-5 py-3 text-right font-medium">Variance</th></tr></thead><tbody>{profile.map(([name, percent]) => { const expected = result.expectedYields[name] ?? 0; const actual = result.actualYields[name] ?? 0; const variance = actual - expected; return <tr className="border-b border-[#292222] last:border-0" key={name}><td className="px-5 py-3 font-medium">{name}</td><td className="px-5 py-3 text-right font-mono text-[#7e8992]">{percent.toFixed(1)}%</td><td className="px-5 py-3 text-right font-mono">{expected.toFixed(2)}</td><td className="px-5 py-3 text-right font-mono font-semibold">{actual.toFixed(2)}</td><td className={`px-5 py-3 text-right font-mono ${variance >= 0 ? "text-[#67d098]" : "text-[#e87980]"}`}>{variance > 0 ? "+" : ""}{variance.toFixed(2)}</td></tr>; })}</tbody></table></div> : <div className="grid min-h-80 place-items-center p-8 text-center"><div><PackageCheck className="mx-auto text-[#476474]" size={32}/><h3 className="mt-4 font-semibold">Awaiting processing</h3><p className="mt-2 text-sm text-[#77828b]">Expected yield exists, but actual outputs remain empty until block-out.</p></div></div>}
      </div>
      <div className="space-y-4">
        <div className={`${card} p-5`}><h2 className="text-sm font-semibold">Economic position</h2><div className="mt-5 space-y-4 text-xs">
          {[["Purchase cost", result.purchaseCost],["Realized cost of sold kg", result.realizedCost],["Revenue generated", result.baseRevenue],["Remaining stock at cost", result.remainingValue]].map(([name, value]) => <div className="flex justify-between border-b border-[#312829] pb-3 last:border-0" key={String(name)}><span className="text-[#7e8992]">{name}</span><strong className="font-mono">{zar.format(Number(value))}</strong></div>)}
        </div><div className="mt-4 rounded-lg border border-[#28533e] bg-[#10291f] p-4"><p className={label}>Saleable yield</p><p className="mt-2 text-2xl font-semibold text-[#67d098]">{result.saleableYield.toFixed(2)}%</p><p className="mt-1 text-[11px] text-[#71a58a]">Excludes bone and fat/waste</p></div></div>
        <div className={`${card} p-5`}><h2 className="text-sm font-semibold">Traceability chain</h2><div className="mt-4 space-y-3">{["Supplier invoice retained","Actual receiving weight retained",result.processedKg ? "Actual outputs linked" : "Actual outputs pending","Sale economics allocated","Remaining stock valued"].map((step, index) => <div className="flex items-center gap-3 text-xs" key={step}><span className={`grid size-6 place-items-center rounded-full ${index === 2 && !result.processedKg ? "bg-[#2c210d] text-[#e0aa4b]" : "bg-[#163a2a] text-[#61cd94]"}`}>{index === 2 && !result.processedKg ? <CircleAlert size={12}/> : <Check size={12}/>}</span><span className="text-[#9ca5ad]">{step}</span></div>)}</div></div>
      </div>
    </div>
  </>;
}

export function SupplierPerformanceScreen() {
  const suppliers = calculateSupplierPerformance();
  const [metric, setMetric] = useState<"saleableYield" | "rumpYield" | "steakYield" | "boneYield" | "economicIndex">("saleableYield");
  const max = Math.max(1, ...suppliers.map((supplier) => supplier[metric]));
  const metricLabel = { saleableYield: "Saleable yield", rumpYield: "Rump yield", steakYield: "Steak yield", boneYield: "Bone yield", economicIndex: "Economic index" }[metric];
  return <>
    <Header eyebrow="Management / supplier intelligence" title="Supplier performance" copy="Compare the economic yield each supplier creates—not only the price paid per kilogram.">
      <select aria-label="Supplier comparison metric" className={input} value={metric} onChange={(event) => setMetric(event.target.value as typeof metric)}><option value="saleableYield">Saleable yield</option><option value="rumpYield">Rump yield</option><option value="steakYield">Steak yield</option><option value="boneYield">Bone yield</option><option value="economicIndex">Economic index</option></select>
    </Header>
    <div className="mb-4 grid gap-4 lg:grid-cols-3">{suppliers.map((supplier, index) => <div className={`${card} relative overflow-hidden p-5`} key={supplier.supplier}>
      {index === 0 && supplier.sampleReady && <div className="absolute right-4 top-4"><Status tone="green">Best economics</Status></div>}
      <p className={label}>Supplier {index + 1}</p><h2 className="mt-3 pr-28 text-lg font-semibold">{supplier.supplier}</h2><p className="mt-1 text-xs text-[#78838c]">{supplier.deliveries} deliveries · {supplier.receivedKg.toFixed(1)} kg received</p>
      <div className="my-5 grid grid-cols-2 gap-3"><div className="rounded-lg bg-[#100d0d] p-3"><p className={label}>Avg carcass</p><p className="mt-2 font-mono font-semibold">{supplier.averageCarcassKg.toFixed(1)} kg</p></div><div className="rounded-lg bg-[#100d0d] p-3"><p className={label}>Avg cost</p><p className="mt-2 font-mono font-semibold">{zar.format(supplier.averageCostKg)}/kg</p></div></div>
      <div className="space-y-3">{[["Rump",supplier.rumpYield],["Steak",supplier.steakYield],["Bone",supplier.boneYield],["Saleable",supplier.saleableYield]].map(([name,value]) => <div className="flex items-center justify-between text-xs" key={String(name)}><span className="text-[#7d8790]">{name} yield</span><strong className={`font-mono ${name === "Saleable" ? "text-[#67d098]" : ""}`}>{Number(value).toFixed(2)}%</strong></div>)}</div>
      {!supplier.sampleReady && <div className="mt-5 rounded-lg border border-[#5f4820] bg-[#2c210d] p-3 text-xs text-[#e0aa4b]">Yield score pending first completed block-out.</div>}
    </div>)}</div>
    <div className={`${card} p-5`}>
      <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">{metricLabel} comparison</h2><p className="mt-1 text-xs text-[#6f7a84]">Calculated from actual processed outputs</p></div><Target className="text-[#719db4]" size={19}/></div>
      <div className="mt-6 space-y-5">
        {suppliers.map((supplier) => {
          const value = supplier[metric];
          return <div key={supplier.supplier}>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span>{supplier.supplier}</span>
              <strong className="font-mono">{value.toFixed(2)}{metric === "economicIndex" ? "" : "%"}</strong>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-[#292222]">
              <div className={`h-full rounded-full ${supplier.sampleReady ? "bg-gradient-to-r from-[#315b72] to-[#70b5d8]" : "bg-[#4b3a20]"}`} style={{ width: `${value / max * 100}%` }}/>
            </div>
          </div>;
        })}
      </div>
      <div className="mt-6 flex gap-3 rounded-lg border border-[#2e4d5e] bg-[#12232c] p-4 text-xs leading-5 text-[#85b6ce]"><Sparkles className="mt-0.5 shrink-0" size={16}/><p>Economic index combines saleable yield with weighted purchase cost. A cheaper carcass can still rank lower if it produces more bone and less premium meat.</p></div>
    </div>
  </>;
}

function VarianceRow({ issue, reviewed, onReview }: { issue: VarianceIssue; reviewed: boolean; onReview(issue: VarianceIssue): void }) {
  return <tr className="border-b border-[#292222] text-xs last:border-0 hover:bg-[#1a1515]"><td className="px-5 py-4"><Status tone={issue.severity === "High" ? "red" : issue.severity === "Medium" ? "amber" : "blue"}>{issue.severity}</Status></td><td className="px-5 py-4">{issue.category}</td><td className="px-5 py-4 font-mono font-semibold text-[#ffabad]">{issue.reference}</td><td className="px-5 py-4 text-[#7d8790]">{formatDate(issue.occurredAt)}</td><td className="max-w-xs px-5 py-4 text-[#9ca6ad]">{issue.description}</td><td className={`px-5 py-4 text-right font-mono ${issue.quantityKg && issue.quantityKg < 0 ? "text-[#e87980]" : "text-[#67d098]"}`}>{issue.quantityKg === undefined ? "—" : `${issue.quantityKg > 0 ? "+" : ""}${issue.quantityKg.toFixed(2)} kg`}</td><td className={`px-5 py-4 text-right font-mono ${issue.value < 0 ? "text-[#e87980]" : ""}`}>{zar.format(issue.value)}</td><td className="px-5 py-4 text-right">{reviewed ? <Status tone="green">Reviewed</Status> : <button className="rounded-md border border-[#3a4851] px-3 py-2 text-[10px] font-semibold text-[#88bad3] hover:bg-[#281618]" onClick={() => onReview(issue)}>Review</button>}</td></tr>;
}

export function VariancesScreen() {
  const operations = useOperations();
  const [category, setCategory] = useState("All");
  const [showReviewed, setShowReviewed] = useState(false);
  const [selected, setSelected] = useState<VarianceIssue | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const issues = calculateVarianceIssues(operations).filter((issue) => category === "All" || issue.category === category).filter((issue) => showReviewed || !operations.managementReviews.some((review) => review.issueId === issue.id));
  const totalExposure = issues.reduce((sum, issue) => sum + Math.abs(issue.value), 0);
  function completeReview() {
    if (!selected) return;
    try {
      operations.reviewManagementIssue(selected.id, note);
      setMessage(`${selected.reference} marked as reviewed by Lerato Dlamini.`);
      setSelected(null);
      setNote("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save review");
    }
  }
  return <>
    <Header eyebrow="Management / exception control" title="Variances & waste" copy="Investigate every stock, receiving, till, and waste exception; record management sign-off without deleting the source event.">
      <div className="flex gap-2"><select aria-label="Variance category" className={input} value={category} onChange={(event) => setCategory(event.target.value)}><option>All</option><option>Stock count</option><option>Waste</option><option>Till</option><option>Receiving</option></select><button className={`rounded-lg border px-3 text-xs ${showReviewed ? "border-[#713033] bg-[#2a1517] text-[#ff7779]" : "border-[#433637] text-[#8c969e]"}`} onClick={() => setShowReviewed((value) => !value)}>Include reviewed</button></div>
    </Header>
    <div className="mb-4 grid gap-3 sm:grid-cols-3"><Metric icon={TriangleAlert} title="Open issues" value={String(issues.length)} detail="Current filter" tone={issues.length ? "amber" : "green"}/><Metric icon={Banknote} title="Value exposure" value={zar.format(totalExposure)} detail="Absolute financial impact" tone="amber"/><Metric icon={ShieldCheck} title="Reviewed" value={String(operations.managementReviews.length)} detail="Signed management notes" tone="green"/></div>
    {message && <div className="mb-4 rounded-lg border border-[#28533e] bg-[#10291f] p-4 text-sm text-[#67d098]">{message}</div>}
    <div className={`${card} overflow-hidden`}><div className="scrollbar overflow-x-auto"><table className="w-full min-w-[1100px] text-left"><thead><tr className="border-b border-[#322a2a] text-[9px] uppercase tracking-wider text-[#69747d]">{["Risk","Category","Reference","Date","Reason","Kg impact","Value impact","Control"].map((heading, index) => <th className={`px-5 py-3 font-medium ${index > 4 ? "text-right" : ""}`} key={heading}>{heading}</th>)}</tr></thead><tbody>{issues.map((issue) => <VarianceRow issue={issue} key={issue.id} reviewed={operations.managementReviews.some((review) => review.issueId === issue.id)} onReview={setSelected}/>)}</tbody></table></div>{issues.length === 0 && <div className="grid min-h-56 place-items-center text-center"><div><ShieldCheck className="mx-auto text-[#5fc78f]" size={32}/><h3 className="mt-4 font-semibold">No open exceptions</h3><p className="mt-2 text-sm text-[#77828b]">Everything in this view has management sign-off.</p></div></div>}</div>
    {selected && <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4"><div className={`${card} w-full max-w-lg p-6`} role="dialog" aria-modal="true" aria-labelledby="variance-review-title"><div className="flex items-start justify-between"><div><p className={label}>Management sign-off</p><h2 className="mt-2 text-lg font-semibold" id="variance-review-title">{selected.reference}</h2><p className="mt-1 text-xs text-[#7c8790]">{selected.description}</p></div><Status tone={selected.severity === "High" ? "red" : selected.severity === "Medium" ? "amber" : "blue"}>{selected.severity}</Status></div><label className="mt-5 block text-xs font-medium text-[#a4adb4]">Review note<textarea autoFocus className={`${input} mt-2 h-24 w-full py-3`} placeholder="What was checked and what action is required?" value={note} onChange={(event) => setNote(event.target.value)}/></label><div className="mt-5 flex justify-end gap-2"><button className="min-h-11 rounded-lg border border-[#433637] px-4 text-sm" onClick={() => { setSelected(null); setNote(""); }}>Cancel</button><button className={primary} disabled={!note.trim()} onClick={completeReview}><Check size={16}/> Save review</button></div></div></div>}
  </>;
}

export function ReconciliationScreen() {
  const operations = useOperations();
  const [range, setRange] = useState<ManagementRange>("today");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  const result = calculateReconciliation({ ...operations, range });
  const flows = [
    { label: "Opening physical stock", value: result.openingKg, sign: "" },
    { label: "Supplier receipts", value: result.receivedKg, sign: "+" },
    { label: "Customer returns", value: result.returnsKg, sign: "+" },
    { label: "Completed sales", value: result.soldKg, sign: "−" },
    { label: "Recorded waste", value: result.wasteKg, sign: "−" },
    { label: "Stock-count adjustments", value: result.adjustmentsKg, sign: result.adjustmentsKg >= 0 ? "+" : "" },
  ];
  function complete() {
    try {
      const record = operations.completeReconciliation({ ...result, range, note });
      setMessage(`${record.number} completed and locked for audit review.`);
      setNote("");
      setConfirming(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to complete reconciliation");
    }
  }
  return <>
    <Header eyebrow="Management / kilogram control" title="Daily stock reconciliation" copy="Prove the movement from opening stock to expected closing stock, then compare it with the latest physical position."><RangePicker value={range} onChange={setRange}/></Header>
    {message && <div className="mb-4 rounded-lg border border-[#28533e] bg-[#10291f] p-4 text-sm text-[#67d098]">{message}</div>}
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Boxes} title="Opening stock" value={kg(result.openingKg)} detail="Calculated opening position"/><Metric icon={Scale} title="Expected closing" value={kg(result.expectedClosingKg)} detail="Ledger movement result"/><Metric icon={ClipboardCheck} title="Physical closing" value={kg(result.physicalClosingKg)} detail={`${result.reservedKg.toFixed(1)} kg reserved`} tone="green"/><Metric icon={result.reconciled ? ShieldCheck : TriangleAlert} title="Variance" value={kg(result.varianceKg)} detail={zar.format(result.varianceValue)} tone={result.reconciled ? "green" : "red"}/></div>
    <div className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
      <div className={`${card} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-[#322a2a] p-5"><div><h2 className="text-sm font-semibold">Ledger bridge</h2><p className="mt-1 text-xs text-[#6f7a84]">Opening + inflows − outflows ± adjustments</p></div><Status tone={result.reconciled ? "green" : "red"}>{result.reconciled ? "Balanced" : "Investigate"}</Status></div>
        <div className="p-5">{flows.map((flow, index) => <div className={`flex items-center gap-4 py-4 ${index < flows.length - 1 ? "border-b border-[#302728]" : ""}`} key={flow.label}><span className={`grid size-9 place-items-center rounded-lg font-mono font-semibold ${flow.sign === "+" ? "bg-[#163a2a] text-[#61cd94]" : flow.sign === "−" ? "bg-[#2f1519] text-[#e87980]" : "bg-[#281618] text-[#ff7779]"}`}>{flow.sign || "="}</span><span className="flex-1 text-sm text-[#9ca6ad]">{flow.label}</span><strong className="font-mono">{flow.sign}{Math.abs(flow.value).toFixed(2)} kg</strong></div>)}</div>
        <div className="grid grid-cols-2 gap-px border-t border-[#322a2a] bg-[#322a2a]"><div className="bg-[#100d0d] p-5"><p className={label}>Theoretical closing</p><p className="mt-2 font-mono text-xl font-semibold">{result.expectedClosingKg.toFixed(2)} kg</p></div><div className="bg-[#100d0d] p-5"><p className={label}>Counted / system physical</p><p className="mt-2 font-mono text-xl font-semibold">{result.physicalClosingKg.toFixed(2)} kg</p></div></div>
      </div>
      <div className={`${card} p-5`}>
        <div className="flex items-center gap-3"><span className={`grid size-11 place-items-center rounded-xl ${result.reconciled ? "bg-[#163a2a] text-[#61cd94]" : "bg-[#2f1519] text-[#e87980]"}`}>{result.reconciled ? <ShieldCheck size={23}/> : <TriangleAlert size={23}/>}</span><div><h2 className="text-sm font-semibold">{result.reconciled ? "Ready for management sign-off" : "Variance requires investigation"}</h2><p className="mt-1 text-xs text-[#6f7a84]">Completion stores an immutable management snapshot.</p></div></div>
        <div className="mt-5 space-y-3 rounded-lg border border-[#293139] bg-[#0d0b0b] p-4 text-xs"><div className="flex justify-between"><span className="text-[#7d8790]">Physical less expected</span><strong className={`font-mono ${result.reconciled ? "text-[#67d098]" : "text-[#e87980]"}`}>{result.varianceKg > 0 ? "+" : ""}{result.varianceKg.toFixed(3)} kg</strong></div><div className="flex justify-between"><span className="text-[#7d8790]">Value impact</span><strong className="font-mono">{zar.format(result.varianceValue)}</strong></div><div className="flex justify-between"><span className="text-[#7d8790]">Open butcher reservations</span><strong className="font-mono">{result.reservedKg.toFixed(3)} kg</strong></div></div>
        <label className="mt-5 block text-xs font-medium text-[#a4adb4]">Management note<textarea className={`${input} mt-2 h-24 w-full py-3`} placeholder="Checks completed, known timing differences, or follow-up action…" value={note} onChange={(event) => setNote(event.target.value)}/></label>
        {!confirming ? <button className={`${primary} mt-5 w-full`} disabled={!note.trim()} onClick={() => setConfirming(true)}><ClipboardCheck size={17}/> Review reconciliation</button> : <div className="mt-5 space-y-3"><div className="rounded-lg border border-[#5f4820] bg-[#2c210d] p-3 text-xs leading-5 text-[#e0aa4b]">Confirming locks this kilogram snapshot as a completed management record. Source ledger events remain unchanged.</div><div className="flex gap-2"><button className="min-h-11 flex-1 rounded-lg border border-[#433637] text-sm" onClick={() => setConfirming(false)}>Go back</button><button className={`${primary} flex-1`} onClick={complete}><Check size={16}/> Confirm & lock</button></div></div>}
      </div>
    </div>
    <div className={`${card} mt-4 overflow-hidden`}><div className="border-b border-[#322a2a] p-5"><h2 className="text-sm font-semibold">Completed reconciliations</h2><p className="mt-1 text-xs text-[#6f7a84]">Permanent management snapshots</p></div>{operations.reconciliations.length ? <div className="scrollbar overflow-x-auto"><table className="w-full min-w-[760px] text-xs"><thead><tr className="border-b border-[#322a2a] text-[9px] uppercase tracking-wider text-[#69747d]">{["Record","Range","Expected","Physical","Variance","Completed by","Time"].map((heading) => <th className="px-5 py-3 text-left font-medium" key={heading}>{heading}</th>)}</tr></thead><tbody>{operations.reconciliations.map((record) => <tr className="border-b border-[#292222] last:border-0" key={record.id}><td className="px-5 py-4 font-mono font-semibold text-[#ffabad]">{record.number}</td><td className="px-5 py-4 uppercase">{record.range}</td><td className="px-5 py-4 font-mono">{record.expectedClosingKg.toFixed(2)} kg</td><td className="px-5 py-4 font-mono">{record.physicalClosingKg.toFixed(2)} kg</td><td className="px-5 py-4 font-mono">{record.varianceKg.toFixed(3)} kg</td><td className="px-5 py-4">{record.completedBy}</td><td className="px-5 py-4 text-[#7d8790]">{formatDate(record.createdAt)}</td></tr>)}</tbody></table></div> : <div className="p-8 text-center text-sm text-[#77828b]">No completed management reconciliation yet.</div>}</div>
  </>;
}
