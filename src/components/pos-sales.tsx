"use client";

import { useState } from "react";
import {
  Check, ChevronDown, ChevronUp, CircleAlert, CreditCard, RotateCcw, Search, X,
} from "lucide-react";
import { type SaleRecord, useOperations } from "@/components/operations-store";
import { kg, zar } from "@/lib/utils";

const card = "rounded-xl border border-[#272e34] bg-[#111418]/95 shadow-[inset_0_1px_rgba(255,255,255,.035),0_12px_50px_rgba(0,0,0,.13)]";
const label = "text-[10px] font-semibold uppercase tracking-[.15em] text-[#6f7a84]";
const input = "h-11 w-full rounded-lg border border-[#303840] bg-[#0c0f12] px-3 text-sm text-[#edf2f5] outline-none transition focus:border-[#528cad] focus:ring-2 focus:ring-[#528cad]/15";
const secondaryButton = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#303840] bg-[#15191d] px-4 text-xs font-medium text-[#c2cbd1] transition hover:border-[#46515a] hover:bg-[#1a2025]";

export function PosSalesScreen() {
  const { sales, refundSale } = useOperations();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"All" | "Completed" | "Refunded">("All");
  const [expandedId, setExpandedId] = useState<string | null>(sales[0]?.id ?? null);
  const [refundId, setRefundId] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const filtered = sales.filter((sale) => {
    const matchesStatus = status === "All" || sale.status === status;
    const search = query.toLowerCase();
    return matchesStatus && (
      sale.number.toLowerCase().includes(search)
      || sale.receiptNumber.toLowerCase().includes(search)
      || sale.customer.toLowerCase().includes(search)
    );
  });
  const completed = sales.filter((sale) => sale.status === "Completed");
  const revenue = completed.reduce((sum, sale) => sum + sale.revenue, 0);
  const grossProfit = completed.reduce((sum, sale) => sum + sale.grossProfit, 0);
  const totalKg = completed.reduce((sum, sale) => sum + sale.totalKg, 0);

  function confirmRefund(sale: SaleRecord) {
    try {
      if (!refundReason) throw new Error("Select a refund reason");
      refundSale(sale.id, refundReason);
      setRefundId(null);
      setRefundReason("");
      setMessage({ type: "success", text: `${sale.number} refunded. Meat and retail stock were returned and the reversal was recorded.` });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to refund sale" });
    }
  }

  return (
    <>
      <div className="mb-7">
        <p className={`${label} mb-2 text-[#719bb2]`}>POS / transaction history</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[30px]">Sales & refunds</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#818c95]">Review receipts, payment allocation, product mix, profit, and controlled full-sale refunds.</p>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Completed sales" value={String(completed.length)} detail={`${sales.filter((sale) => sale.status === "Refunded").length} refunded`} />
        <Metric title="Net revenue" value={zar.format(revenue)} detail="Completed transactions" tone="blue" />
        <Metric title="Gross profit" value={zar.format(grossProfit)} detail={revenue ? `${((grossProfit / revenue) * 100).toFixed(2)}% margin` : "No completed sales"} tone="green" />
        <Metric title="Meat sold" value={kg(totalKg)} detail="Scale labels and tickets" />
      </div>

      {message && <div className={`mb-4 flex gap-3 rounded-lg border p-4 text-sm ${message.type === "success" ? "border-[#28533e] bg-[#10291f] text-[#70d09d]" : "border-[#613037] bg-[#2f1519] text-[#e87980]"}`}>{message.type === "success" ? <Check size={17} /> : <CircleAlert size={17} />}<span>{message.text}</span></div>}

      <div className={`${card} overflow-hidden`}>
        <div className="flex flex-col gap-3 border-b border-[#272e34] p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2">
            {(["All", "Completed", "Refunded"] as const).map((option) => <button key={option} className={`rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider ${status === option ? "border-[#416b81] bg-[#172a35] text-[#8bc0dc]" : "border-[#303840] bg-[#111418] text-[#7c8790]"}`} onClick={() => setStatus(option)}>{option}</button>)}
          </div>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-[#303840] bg-[#0c0f12] px-3">
            <Search size={15} className="text-[#6f7a84]" /><span className="sr-only">Search sales</span>
            <input className="w-full bg-transparent text-xs outline-none placeholder:text-[#66717a] sm:w-64" placeholder="Sale, receipt, or customer…" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        </div>

        {filtered.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center"><CreditCard size={28} className="text-[#52616a]" /><p className="mt-3 text-sm font-semibold">No matching sales</p><p className="mt-2 text-xs text-[#77838c]">Try another filter or receipt number.</p></div>
        ) : (
          <div className="divide-y divide-[#252c32]">
            {filtered.map((sale) => {
              const expanded = expandedId === sale.id;
              return (
                <article key={sale.id}>
                  <button className="grid w-full gap-3 p-5 text-left sm:grid-cols-[150px_1fr_120px_130px_130px_30px] sm:items-center" onClick={() => setExpandedId(expanded ? null : sale.id)}>
                    <div><p className="font-mono text-sm font-semibold text-[#a7c8d9]">{sale.number}</p><p className="mt-1 font-mono text-[10px] text-[#6f7a84]">{sale.receiptNumber}</p></div>
                    <div><p className="text-sm font-medium">{sale.customer}</p><p className="mt-1 text-[10px] text-[#6f7a84]">{formatDate(sale.createdAt)} · {sale.cashier}</p></div>
                    <div className="sm:text-right"><p className="font-mono text-xs font-semibold">{kg(sale.totalKg)}</p><p className="mt-1 text-[10px] text-[#6f7a84]">{sale.totalUnits} units</p></div>
                    <p className="font-mono text-sm font-semibold sm:text-right">{zar.format(sale.revenue)}</p>
                    <div className="sm:text-right"><StatusBadge sale={sale} /></div>
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {expanded && (
                    <div className="border-t border-[#20262b] bg-[#0c0f12] p-5">
                      <div className="grid gap-2">
                        {sale.items.map((item) => (
                          <div key={item.id} className="grid gap-2 rounded-lg border border-[#252c32] bg-[#111418] p-3 text-xs sm:grid-cols-[1fr_auto_auto] sm:items-center">
                            <div><p className="font-semibold">{item.product}</p><p className="mt-1 text-[10px] text-[#6f7a84]">{item.source === "retail" ? `${item.quantity} × ${zar.format(item.unitPrice)}` : `${item.weightKg?.toFixed(3)} kg @ ${zar.format(item.unitPrice)}/kg`}{item.ticketNumber ? ` · ${item.ticketNumber}` : ""}</p></div>
                            <p className="font-mono text-[#7f8a93]">Cost {zar.format(item.costOfGoods)}</p>
                            <p className="w-28 text-right font-mono font-semibold">{zar.format(item.lineTotal)}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 grid gap-3 border-t border-[#252c32] pt-4 md:grid-cols-[1fr_auto] md:items-end">
                        <div className="flex flex-wrap gap-4 text-xs text-[#7d8891]">
                          <span>Paid: <strong className="text-[#bec7cd]">{sale.payments.map((payment) => `${payment.method} ${zar.format(payment.amount)}`).join(" + ")}</strong></span>
                          <span>Gross profit: <strong className="text-[#67d098]">{zar.format(sale.grossProfit)} ({sale.grossMargin.toFixed(2)}%)</strong></span>
                          {sale.refundReason && <span className="text-[#e87980]">Refund: {sale.refundReason}</span>}
                        </div>
                        {sale.status === "Completed" && (
                          refundId === sale.id ? (
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <select aria-label="Refund reason" className={`${input} min-w-56`} value={refundReason} onChange={(event) => setRefundReason(event.target.value)}><option value="">Select reason…</option><option>Customer complaint</option><option>Product quality issue</option><option>Incorrect item</option><option>Duplicate charge</option><option>Other</option></select>
                              <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#7b2e35] px-4 text-xs font-semibold text-white disabled:opacity-40" disabled={!refundReason} onClick={() => confirmRefund(sale)}><RotateCcw size={15} /> Confirm full refund</button>
                              <button className={secondaryButton} onClick={() => { setRefundId(null); setRefundReason(""); }}><X size={14} /> Keep sale</button>
                            </div>
                          ) : <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#5a2d33] bg-[#251316] px-4 text-xs font-medium text-[#e27a81]" onClick={() => setRefundId(sale.id)}><RotateCcw size={15} /> Refund sale</button>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function Metric({ title, value, detail, tone = "neutral" }: { title: string; value: string; detail: string; tone?: "neutral" | "blue" | "green" }) {
  const colors = { neutral: "text-white", blue: "text-[#8bc4e0]", green: "text-[#67d098]" };
  return <div className={`${card} p-4`}><p className={label}>{title}</p><p className={`mt-4 text-[24px] font-semibold tracking-[-.04em] ${colors[tone]}`}>{value}</p><p className="mt-2 text-[11px] text-[#69747e]">{detail}</p></div>;
}

function StatusBadge({ sale }: { sale: SaleRecord }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider ${sale.status === "Completed" ? "border-[#28533e] bg-[#10291f] text-[#5fc78f]" : "border-[#613037] bg-[#2f1519] text-[#e87980]"}`}>{sale.status}</span>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
