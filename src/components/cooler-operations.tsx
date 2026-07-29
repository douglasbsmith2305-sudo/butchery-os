"use client";

import {
  ArrowLeft, Check, ChevronRight, CircleAlert, ClipboardCheck, PackageOpen,
  Plus, Scale, Search, ShieldCheck, Sparkles, Truck,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { type BatchStatus, type CoolerBatch, useOperations } from "@/components/operations-store";
import { calculateDeliveryVariance } from "@/lib/cooler";
import { kg, zar } from "@/lib/utils";

const card = "rounded-xl border border-[#322a2a] bg-[#141111]/95 metric-glow";
const label = "text-[10px] font-semibold uppercase tracking-[.15em] text-[#6f7a84]";
const input = "h-11 w-full rounded-lg border border-[#433637] bg-[#0d0b0b] px-3 text-sm text-[#edf2f5] outline-none transition focus:border-[#d93a3e] focus:ring-2 focus:ring-[#d93a3e]/15";
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#f4f0ed] px-4 text-sm font-semibold text-[#171010] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40";
const secondary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#433637] bg-[#1a1515] px-4 text-sm font-medium text-[#c2cbd1] transition hover:border-[#68474a]";

function Header({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className={`${label} mb-2 text-[#ef5b5e]`}>{eyebrow}</p><h1 className="text-2xl font-semibold tracking-tight sm:text-[30px]">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#818c95]">{copy}</p></div>{action}</div>;
}

function Field({ name, hint, className = "", children }: { name: string; hint?: string; className?: string; children: React.ReactNode }) {
  return <label className={`block ${className}`}><span className="mb-2 flex items-center justify-between text-xs font-medium text-[#a4adb4]">{name}{hint && <span className="text-[10px] font-normal text-[#907a7b]">{hint}</span>}</span>{children}</label>;
}

function Badge({ status }: { status: BatchStatus }) {
  const tone = status === "Raw" ? "border-[#713033] bg-[#2a1517] text-[#ff7779]" : status === "Part processed" ? "border-[#5f4820] bg-[#2c210d] text-[#e0aa4b]" : "border-[#28533e] bg-[#10291f] text-[#5fc78f]";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.09em] ${tone}`}>{status}</span>;
}

function Metric({ name, value, detail }: { name: string; value: string; detail: string }) {
  return <div className={`${card} p-4`}><p className={label}>{name}</p><p className="mt-4 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-2 text-[11px] text-[#69747e]">{detail}</p></div>;
}

function supplierCode(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 4).toUpperCase();
}

export function ReceiveDeliveryScreen() {
  const { receiveDelivery, suppliers, blockTestProfiles } = useOperations();
  const [supplier, setSupplier] = useState("Karoo Prime Meats");
  const [invoice, setInvoice] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [meatType, setMeatType] = useState("Raw Beef");
  const [units, setUnits] = useState("5");
  const [invoiceKg, setInvoiceKg] = useState("718");
  const [actualKg, setActualKg] = useState("720");
  const [cost, setCost] = useState("92");
  const [notes, setNotes] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string; code?: string } | null>(null);
  const calculation = useMemo(() => {
    try { return calculateDeliveryVariance(Number(invoiceKg), Number(actualKg), Number(cost)); } catch { return null; }
  }, [invoiceKg, actualKg, cost]);
  const actual = Number(actualKg) || 0;
  const activeProfile = blockTestProfiles.find((item) => item.active) ?? blockTestProfiles[0];
  const projections = useMemo(() => (activeProfile?.lines ?? []).map(({ product, percent }) => ({ product, percent, expected: actual * percent / 100 })), [actual, activeProfile]);

  function submit() {
    try {
      if (!reviewed) {
        if (!invoice.trim()) throw new Error("Enter the supplier invoice number");
        if (!calculation) throw new Error("Enter valid delivery weights and cost");
        setReviewed(true);
        setMessage({ type: "success", text: "Review complete. Confirm the details, then post the receipt." });
        return;
      }
      const batch = receiveDelivery({
        supplier, invoiceNumber: invoice, deliveryDate: date, meatType, unitCount: Number(units),
        invoiceWeightKg: Number(invoiceKg), actualWeightKg: Number(actualKg), costPerKg: Number(cost), notes,
      });
      setMessage({ type: "success", text: `${batch.code} posted. ${batch.receivedKg.toFixed(3)} kg is now available for processing.`, code: batch.code });
      setReviewed(false);
      setInvoice("");
      setNotes("");
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to receive delivery" });
    }
  }

  return <>
    <Header eyebrow="Cooler / receiving" title="Receive supplier delivery" copy="Verify the supplier document against your own scale. The actual scale weight becomes the raw batch quantity." />
    {message && <div className={`mb-4 rounded-lg border p-4 text-sm ${message.type === "success" ? "border-[#28533e] bg-[#10291f] text-[#70d09d]" : "border-[#613037] bg-[#2f1519] text-[#e87980]"}`}><div className="flex items-start gap-3"><Check className="mt-0.5 shrink-0" size={17} /><div className="flex-1"><p>{message.text}</p>{message.code && <div className="mt-3 flex flex-wrap gap-2"><Link className={secondary} href={`/cooler/batches/${message.code}`}>Open batch <ChevronRight size={15} /></Link><Link className={secondary} href="/cooler/processing">Process batch</Link></div>}</div></div></div>}
    <div className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
      <div className={`${card} p-5 sm:p-7`}>
        <div className="mb-6 flex items-center gap-3 border-b border-[#322a2a] pb-5"><div className="grid size-10 place-items-center rounded-lg bg-[#281618] text-[#f06a6d]"><Truck size={20} /></div><div><h2 className="text-sm font-semibold">Supplier document and scale check</h2><p className="mt-1 text-xs text-[#6f7a84]">Required fields are retained on the batch trace</p></div></div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="Supplier"><select className={input} value={supplier} onChange={(event) => { setSupplier(event.target.value); setReviewed(false); }}>{suppliers.filter((item) => item.active).map((item) => <option key={item.id}>{item.name}</option>)}</select></Field>
          <Field name="Supplier invoice number"><input className={input} value={invoice} onChange={(event) => { setInvoice(event.target.value); setReviewed(false); }} placeholder={`${supplierCode(supplier)}-00000`} /></Field>
          <Field name="Delivery date"><input className={input} type="date" value={date} onChange={(event) => { setDate(event.target.value); setReviewed(false); }} /></Field>
          <Field name="Meat type"><select className={input} value={meatType} onChange={(event) => { setMeatType(event.target.value); setReviewed(false); }}><option>Raw Beef</option><option>Lamb</option><option>Pork</option></select></Field>
          <Field name="Carcasses / sides / quarters"><input className={input} min="1" step="1" type="number" value={units} onChange={(event) => { setUnits(event.target.value); setReviewed(false); }} /></Field>
          <Field name="Cost per kg (R)"><input className={input} min=".01" step=".01" type="number" value={cost} onChange={(event) => { setCost(event.target.value); setReviewed(false); }} /></Field>
          <Field name="Supplier invoice weight (kg)"><input className={input} min=".001" step=".001" type="number" value={invoiceKg} onChange={(event) => { setInvoiceKg(event.target.value); setReviewed(false); }} /></Field>
          <Field name="Actual scale weight (kg)" hint="Stock quantity"><input className={`${input} border-[#743236] font-mono text-lg font-semibold`} min=".001" step=".001" type="number" value={actualKg} onChange={(event) => { setActualKg(event.target.value); setReviewed(false); }} /></Field>
          <Field name="Delivery notes" className="sm:col-span-2"><textarea className={`${input} h-20 py-3`} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Temperature, condition, seals or exceptions…" /></Field>
        </div>
        <div className="mt-6 grid gap-3 rounded-lg border border-[#3b3031] bg-[#0d0b0b] p-4 sm:grid-cols-2">
          <div><p className={label}>Weight variance</p><p className={`mt-2 font-mono text-lg font-semibold ${Math.abs(calculation?.variancePercent ?? 0) > .5 ? "text-[#e9ae4a]" : "text-[#65c992]"}`}>{calculation ? `${calculation.varianceKg >= 0 ? "+" : ""}${calculation.varianceKg.toFixed(3)} kg (${calculation.variancePercent.toFixed(2)}%)` : "—"}</p></div>
          <div className="sm:text-right"><p className={label}>Actual purchase cost</p><p className="mt-2 font-mono text-lg font-semibold">{zar.format(calculation?.totalCost ?? 0)}</p></div>
        </div>
        {Math.abs(calculation?.variancePercent ?? 0) > .5 && <p className="mt-3 flex gap-2 text-xs text-[#e0aa4b]"><CircleAlert size={15} /> Variance is above 0.5%. Check the scale and supplier document before posting.</p>}
        <div className="mt-6 flex justify-end"><button className={button} onClick={submit}><ShieldCheck size={16} />{reviewed ? "Post receipt & create batch" : "Review delivery"}</button></div>
      </div>
      <div className={`${card} h-fit overflow-hidden`}>
        <div className="border-b border-[#322a2a] p-5"><div className="flex items-center gap-3"><Sparkles size={18} className="text-[#f06a6d]" /><div><h2 className="text-sm font-semibold">Expected block test</h2><p className="mt-1 text-xs text-[#6f7a84]">Planning only — finished stock is created during processing</p></div></div></div>
        <div className="grid grid-cols-3 border-b border-[#322a2a]"><div className="p-4"><p className={label}>Raw input</p><p className="mt-2 font-mono text-xs font-semibold">{kg(actual)}</p></div><div className="border-x border-[#322a2a] p-4"><p className={label}>Profile</p><p className="mt-2 text-xs font-semibold">{activeProfile?.name ?? "No active profile"}</p></div><div className="p-4"><p className={label}>Total yield</p><p className="mt-2 font-mono text-xs font-semibold">{(activeProfile?.lines.reduce((sum, item) => sum + item.percent, 0) ?? 0).toFixed(2)}%</p></div></div>
        <table className="w-full text-left text-xs"><thead><tr className="border-b border-[#322a2a] text-[10px] uppercase tracking-wider text-[#69747e]"><th className="px-5 py-3">Product</th><th className="px-4 py-3 text-right">Yield</th><th className="px-5 py-3 text-right">Expected kg</th></tr></thead><tbody>{projections.map((row) => <tr key={String(row.product)} className="border-b border-[#2a2323] last:border-0"><td className="px-5 py-2.5 font-medium">{row.product}</td><td className="px-4 py-2.5 text-right font-mono text-[#7c8790]">{row.percent.toFixed(1)}%</td><td className="px-5 py-2.5 text-right font-mono font-semibold">{row.expected.toFixed(3)}</td></tr>)}</tbody></table>
      </div>
    </div>
  </>;
}

export function BatchesScreen() {
  const { coolerBatches } = useOperations();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"All" | BatchStatus>("All");
  const filtered = coolerBatches.filter((batch) => (status === "All" || batch.status === status) && `${batch.code} ${batch.supplier} ${batch.invoiceNumber}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <Header eyebrow="Cooler / traceability" title="Delivery batches" copy="Open any lot to trace its supplier receipt, processing runs, yields and stock movements." action={<Link className={button} href="/cooler/receive"><Plus size={16} /> Receive delivery</Link>} />
    <div className="mb-4 grid gap-3 sm:grid-cols-3"><Metric name="Total batches" value={String(coolerBatches.length)} detail="Supplier lots retained" /><Metric name="Raw remaining" value={kg(coolerBatches.reduce((sum, batch) => sum + batch.remainingRawKg, 0))} detail="Across open batches" /><Metric name="Purchase value" value={zar.format(coolerBatches.reduce((sum, batch) => sum + batch.totalCost, 0))} detail="Actual scale weight basis" /></div>
    <div className={`${card} mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}>
      <div className="flex flex-wrap gap-2">{(["All", "Raw", "Part processed", "Processed"] as const).map((option) => <button key={option} className={`rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider ${status === option ? "border-[#743236] bg-[#2b1719] text-[#ff8a8c]" : "border-[#433637] text-[#7c8790]"}`} onClick={() => setStatus(option)}>{option}</button>)}</div>
      <label className="flex h-10 items-center gap-2 rounded-lg border border-[#433637] bg-[#0d0b0b] px-3"><Search size={15} className="text-[#6f7a84]" /><input aria-label="Search batches" className="bg-transparent text-xs outline-none" placeholder="Batch, supplier or invoice…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    </div>
    {filtered.length === 0 ? <div className={`${card} p-12 text-center text-sm text-[#7d8891]`}>No batches match this filter.</div> : <div className="grid gap-4 lg:grid-cols-2">{filtered.map((batch) => <article key={batch.id} className={`${card} p-5 transition hover:border-[#60383b]`}><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-sm font-semibold text-[#ffabad]">{batch.code}</p><p className="mt-2 text-xs text-[#78838c]">{batch.supplier} · {new Date(`${batch.deliveryDate}T12:00:00`).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}</p></div><Badge status={batch.status} /></div><div className="my-5 grid grid-cols-3 gap-3 border-y border-[#312829] py-4"><div><p className={label}>Received</p><p className="mt-2 font-mono text-xs font-semibold">{kg(batch.receivedKg)}</p></div><div><p className={label}>Raw remaining</p><p className="mt-2 font-mono text-xs font-semibold">{kg(batch.remainingRawKg)}</p></div><div><p className={label}>Purchase cost</p><p className="mt-2 font-mono text-xs font-semibold">{zar.format(batch.totalCost)}</p></div></div><div className="flex items-center justify-between text-xs"><span className="text-[#77828b]">Invoice {batch.invoiceNumber}</span><Link className="flex min-h-10 items-center gap-1 px-2 text-[#f06a6d]" href={`/cooler/batches/${batch.code}`}>Open batch <ChevronRight size={14} /></Link></div></article>)}</div>}
  </>;
}

export function BatchDetailScreen({ code }: { code: string }) {
  const { coolerBatches, processingRuns, ledger } = useOperations();
  const batch = coolerBatches.find((item) => item.code === code);
  if (!batch) return <><Header eyebrow="Cooler / traceability" title="Batch not found" copy="This batch may have been removed from the current device data." /><Link className={secondary} href="/cooler/batches"><ArrowLeft size={15} /> Back to batches</Link></>;
  const runs = processingRuns.filter((run) => run.batchId === batch.id);
  const movements = ledger.filter((movement) => movement.batchCode === batch.code);
  const varianceKg = batch.receivedKg - batch.invoiceWeightKg;
  return <>
    <Header eyebrow="Cooler / batch trace" title={batch.code} copy={`${batch.supplier} · supplier invoice ${batch.invoiceNumber}`} action={<div className="flex flex-wrap gap-2"><Link className={secondary} href="/cooler/batches"><ArrowLeft size={15} /> Batches</Link>{batch.remainingRawKg > 0 && <Link className={button} href="/cooler/processing">Process remaining stock</Link>}</div>} />
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric name="Status" value={batch.status} detail={`${kg(batch.remainingRawKg)} raw remaining`} /><Metric name="Received weight" value={kg(batch.receivedKg)} detail={`${varianceKg >= 0 ? "+" : ""}${varianceKg.toFixed(3)} kg vs invoice`} /><Metric name="Purchase cost" value={zar.format(batch.totalCost)} detail={`${zar.format(batch.costPerKg)} per kg`} /><Metric name="Linked events" value={String(1 + runs.length + movements.length)} detail="Receipt, processing and ledger" /></div>
    <div className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
      <div className="space-y-4">
        <section className={`${card} p-5`}><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Receipt record</h2><Badge status={batch.status} /></div><dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 text-xs">{[["Supplier", batch.supplier], ["Supplier code", batch.supplierCode], ["Invoice", batch.invoiceNumber], ["Delivery date", batch.deliveryDate], ["Meat type", batch.meatType], ["Units", String(batch.unitCount)], ["Invoice weight", kg(batch.invoiceWeightKg)], ["Actual scale weight", kg(batch.receivedKg)], ["Received by", batch.receivedBy], ["Yield profile", batch.profileName]].map(([term, value]) => <div key={term}><dt className={label}>{term}</dt><dd className="mt-2 text-[#c5cdd2]">{value}</dd></div>)}</dl>{batch.notes && <div className="mt-5 border-t border-[#322a2a] pt-4"><p className={label}>Notes</p><p className="mt-2 text-xs leading-5 text-[#929ca4]">{batch.notes}</p></div>}</section>
        <section className={`${card} p-5`}><div className="flex items-center gap-3"><ClipboardCheck size={18} className="text-[#67c996]" /><div><h2 className="text-sm font-semibold">Traceability chain</h2><p className="mt-1 text-xs text-[#6f7a84]">Who, what, when and reference retained</p></div></div><div className="mt-5 space-y-3"><Timeline title="Supplier receipt validated" detail={`${batch.receivedBy} · ${batch.invoiceNumber}`} date={batch.createdAt} />{runs.map((run) => <Timeline key={run.id} title={`${run.number} · ${kg(run.inputKg)} processed`} detail={`${run.completedBy} · ${kg(run.outputKg)} output · ${kg(run.lossKg)} loss`} date={run.completedAt} />)}{movements.map((movement) => <Timeline key={movement.id} title={movement.type.replaceAll("_", " ")} detail={`${movement.product} · ${kg(movement.quantityKg)} · ${movement.reference}`} date={movement.createdAt} />)}</div></section>
      </div>
      <section className={`${card} overflow-hidden`}><div className="border-b border-[#322a2a] p-5"><h2 className="text-sm font-semibold">Expected vs actual cumulative yield</h2><p className="mt-1 text-xs text-[#6f7a84]">Actual kilograms update after every processing run.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead><tr className="border-b border-[#322a2a] text-[10px] uppercase tracking-wider text-[#69747e]"><th className="px-5 py-3">Product</th><th className="px-5 py-3 text-right">Yield</th><th className="px-5 py-3 text-right">Expected</th><th className="px-5 py-3 text-right">Actual</th><th className="px-5 py-3 text-right">Variance</th></tr></thead><tbody>{batch.yields.map((row) => { const variance = row.actualKg - row.expectedKg; return <tr key={row.productId} className="border-b border-[#2a2323] last:border-0"><td className="px-5 py-3 font-medium">{row.product}</td><td className="px-5 py-3 text-right font-mono text-[#7c8790]">{row.percent.toFixed(1)}%</td><td className="px-5 py-3 text-right font-mono">{row.expectedKg.toFixed(3)}</td><td className="px-5 py-3 text-right font-mono font-semibold">{row.actualKg ? row.actualKg.toFixed(3) : "—"}</td><td className={`px-5 py-3 text-right font-mono ${row.actualKg === 0 ? "text-[#69747e]" : variance < 0 ? "text-[#df747b]" : "text-[#5bc58c]"}`}>{row.actualKg === 0 ? "—" : `${variance >= 0 ? "+" : ""}${variance.toFixed(3)}`}</td></tr>; })}</tbody></table></div></section>
    </div>
  </>;
}

function Timeline({ title, detail, date }: { title: string; detail: string; date: string }) {
  return <div className="flex gap-3"><span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#ef4549]" /><div><p className="text-xs font-medium">{title}</p><p className="mt-1 text-[10px] text-[#7b868f]">{detail}</p><p className="mt-1 text-[10px] text-[#59636b]">{new Date(date).toLocaleString("en-ZA")}</p></div></div>;
}

function defaultOutputs(batch: CoolerBatch, inputKg: number) {
  const values = Object.fromEntries(batch.yields.map((row) => [row.productId, (inputKg * row.percent / 100).toFixed(3)]));
  return values;
}

export function ProcessingScreen() {
  const operations = useOperations();
  const available = operations.coolerBatches.filter((batch) => batch.remainingRawKg > .001);
  const [batchId, setBatchId] = useState(available[0]?.id ?? "");
  const initialBatch = available.find((batch) => batch.id === batchId) ?? available[0];
  const [inputKg, setInputKg] = useState(initialBatch ? String(initialBatch.remainingRawKg) : "");
  const [outputs, setOutputs] = useState<Record<string, string>>(initialBatch ? defaultOutputs(initialBatch, initialBatch.remainingRawKg) : {});
  const [lossKg, setLossKg] = useState("0");
  const [lossReason, setLossReason] = useState("Moisture / processing loss");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string; code?: string } | null>(null);
  const batch = available.find((item) => item.id === batchId) ?? initialBatch;
  const inputWeight = Number(inputKg) || 0;
  const outputWeight = batch?.yields.reduce((sum, row) => sum + (Number(outputs[row.productId]) || 0), 0) ?? 0;
  const difference = inputWeight - outputWeight - (Number(lossKg) || 0);

  function selectBatch(id: string) {
    const selected = available.find((item) => item.id === id);
    setBatchId(id);
    setInputKg(selected ? String(selected.remainingRawKg) : "");
    setOutputs(selected ? defaultOutputs(selected, selected.remainingRawKg) : {});
    setLossKg("0");
    setMessage(null);
  }

  function useExpected() {
    if (!batch) return;
    setOutputs(defaultOutputs(batch, inputWeight));
    setLossKg("0");
  }

  function complete() {
    if (!batch) return;
    try {
      const run = operations.processBatch({
        batchId: batch.id, inputKg: inputWeight,
        outputs: batch.yields.map((row) => ({ productId: row.productId, actualKg: Number(outputs[row.productId]) || 0 })),
        lossKg: Number(lossKg) || 0, lossReason,
      });
      setMessage({ type: "success", text: `${run.number} posted. ${run.outputKg.toFixed(3)} kg was added to finished inventory.`, code: batch.code });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to complete processing" });
    }
  }

  if (!batch) return <><Header eyebrow="Cooler / processing" title="No raw batches to process" copy="All received batches are fully processed. Receive a new supplier delivery to continue." /><Link className={button} href="/cooler/receive"><Truck size={16} /> Receive delivery</Link></>;
  return <>
    <Header eyebrow="Cooler / processing" title="Process raw batch" copy="Record the actual cut weights from the scale. Outputs plus recorded loss must equal the raw input before posting." action={<Link className={secondary} href={`/cooler/batches/${batch.code}`}>View selected batch</Link>} />
    {message && <div className={`mb-4 rounded-lg border p-4 text-sm ${message.type === "success" ? "border-[#28533e] bg-[#10291f] text-[#70d09d]" : "border-[#613037] bg-[#2f1519] text-[#e87980]"}`}><div className="flex gap-3"><Check size={17} /><div><p>{message.text}</p>{message.code && <Link className="mt-2 inline-flex items-center gap-1 text-xs underline" href={`/cooler/batches/${message.code}`}>Open updated batch <ChevronRight size={13} /></Link>}</div></div></div>}
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric name="Selected batch" value={batch.code.slice(-7)} detail={batch.supplier} /><Metric name="Raw available" value={kg(batch.remainingRawKg)} detail={`${zar.format(batch.costPerKg)} / kg`} /><Metric name="Outputs captured" value={kg(outputWeight)} detail="Finished cuts, bone and fat" /><Metric name="Unaccounted" value={kg(Math.abs(difference))} detail={Math.abs(difference) <= .001 ? "Fully reconciled" : difference > 0 ? "Still needs assignment" : "Outputs exceed input"} /></div>
    <div className={`${card} overflow-hidden`}>
      <div className="grid gap-4 border-b border-[#322a2a] p-5 md:grid-cols-3">
        <Field name="Raw batch"><select className={input} value={batch.id} onChange={(event) => selectBatch(event.target.value)}>{available.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.remainingRawKg.toFixed(3)} kg</option>)}</select></Field>
        <Field name="Raw input for this run (kg)"><input className={input} max={batch.remainingRawKg} min=".001" step=".001" type="number" value={inputKg} onChange={(event) => { const value = event.target.value; setInputKg(value); setOutputs(defaultOutputs(batch, Number(value) || 0)); }} /></Field>
        <div className="flex items-end"><button className={`${secondary} w-full`} onClick={useExpected}><Sparkles size={15} /> Use expected weights</button></div>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead><tr className="border-b border-[#322a2a] text-[10px] uppercase tracking-wider text-[#69747e]"><th className="px-5 py-3">Product</th><th className="px-5 py-3 text-right">Expected yield</th><th className="px-5 py-3 text-right">Expected kg</th><th className="px-5 py-3 text-right">Actual scale kg</th><th className="px-5 py-3 text-right">Variance</th></tr></thead><tbody>{batch.yields.map((row) => { const expected = inputWeight * row.percent / 100; const actual = Number(outputs[row.productId]) || 0; return <tr key={row.productId} className="border-b border-[#2a2323] last:border-0"><td className="px-5 py-3 font-medium">{row.product}</td><td className="px-5 py-3 text-right font-mono text-[#7c8790]">{row.percent.toFixed(1)}%</td><td className="px-5 py-3 text-right font-mono">{expected.toFixed(3)}</td><td className="px-5 py-2 text-right"><input aria-label={`${row.product} actual kg`} className="h-9 w-28 rounded-md border border-[#4c3a3c] bg-[#0b0e10] px-2 text-right font-mono font-semibold outline-none focus:border-[#8c3a3e]" min="0" step=".001" type="number" value={outputs[row.productId] ?? ""} onChange={(event) => setOutputs((current) => ({ ...current, [row.productId]: event.target.value }))} /></td><td className={`px-5 py-3 text-right font-mono ${actual < expected ? "text-[#df747b]" : "text-[#5bc58c]"}`}>{actual - expected >= 0 ? "+" : ""}{(actual - expected).toFixed(3)}</td></tr>; })}</tbody></table></div>
      <div className="grid gap-4 border-t border-[#322a2a] bg-[#100d0d] p-5 lg:grid-cols-[1fr_220px_auto] lg:items-end">
        <Field name="Loss reason"><select className={input} value={lossReason} onChange={(event) => setLossReason(event.target.value)}><option>Moisture / processing loss</option><option>Trimming loss</option><option>Scale variance</option><option>Accepted variance</option></select></Field>
        <Field name="Recorded loss (kg)"><input className={input} min="0" step=".001" type="number" value={lossKg} onChange={(event) => setLossKg(event.target.value)} /></Field>
        <button className={button} disabled={Math.abs(difference) > .001 || inputWeight <= 0 || inputWeight > batch.remainingRawKg} onClick={complete}><Check size={16} /> Complete processing</button>
      </div>
    </div>
  </>;
}

export function InventoryScreen() {
  const { inventory, ledger } = useOperations();
  const physical = inventory.reduce((sum, item) => sum + item.physical, 0);
  const reserved = inventory.reduce((sum, item) => sum + item.reserved, 0);
  return <>
    <Header eyebrow="Cooler / stock" title="Finished inventory" copy="Physical, reserved and available kilograms update from receiving, processing, butcher tickets, POS, waste and stock counts." action={<div className="flex flex-wrap gap-2"><Link className={secondary} href="/cooler/waste">Record waste</Link><Link className={button} href="/cooler/stock-count"><Scale size={16} /> Start stock count</Link></div>} />
    <div className="mb-4 grid gap-3 sm:grid-cols-3"><Metric name="Physical stock" value={kg(physical)} detail={`${inventory.length} inventory products`} /><Metric name="Reserved" value={kg(reserved)} detail="Held by open butcher tickets" /><Metric name="Available" value={kg(physical - reserved)} detail="Available to sell or reserve" /></div>
    <div className={`${card} overflow-hidden`}><div className="overflow-x-auto"><table className="w-full min-w-[950px] text-left text-xs"><thead><tr className="border-b border-[#322a2a] text-[10px] uppercase tracking-wider text-[#69747e]"><th className="px-5 py-3">Product</th><th className="px-5 py-3">Scale PLU</th><th className="px-5 py-3 text-right">Physical kg</th><th className="px-5 py-3 text-right">Reserved kg</th><th className="px-5 py-3 text-right">Available kg</th><th className="px-5 py-3 text-right">Avg cost/kg</th><th className="px-5 py-3 text-right">Stock value</th><th className="px-5 py-3">Latest source</th></tr></thead><tbody>{inventory.map((item) => { const latest = ledger.find((movement) => movement.product === item.product); return <tr key={item.id} className="border-b border-[#2a2323] last:border-0 hover:bg-[#1a1515]"><td className="px-5 py-4 font-semibold">{item.product}</td><td className="px-5 py-4 font-mono text-[#7c8790]">{item.scalePlu}</td><td className="px-5 py-4 text-right font-mono">{item.physical.toFixed(3)}</td><td className="px-5 py-4 text-right font-mono text-[#e2ad53]">{item.reserved.toFixed(3)}</td><td className="px-5 py-4 text-right font-mono font-semibold text-[#68cc98]">{(item.physical - item.reserved).toFixed(3)}</td><td className="px-5 py-4 text-right font-mono">{zar.format(item.cost)}</td><td className="px-5 py-4 text-right font-mono">{zar.format(item.physical * item.cost)}</td><td className="px-5 py-4 text-[#7b868f]">{latest ? `${latest.type.replaceAll("_", " ")} · ${latest.reference}` : item.movement}</td></tr>; })}</tbody></table></div></div>
    <div className="mt-4 flex gap-3 rounded-lg border border-[#493234] bg-[#151111] p-4 text-xs leading-5 text-[#958989]"><PackageOpen className="mt-0.5 shrink-0 text-[#ef6f72]" size={16} /><p>Processing adds finished kilograms. Butcher tickets reserve them; POS, waste and stock counts reduce or reconcile them. Reserved stock is never presented as available.</p></div>
  </>;
}
