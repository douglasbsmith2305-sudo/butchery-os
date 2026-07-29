"use client";

import { useState } from "react";
import { Banknote, Check, CircleAlert, Clock3, LockKeyhole, UnlockKeyhole } from "lucide-react";
import { useOperations } from "@/components/operations-store";
import { zar } from "@/lib/utils";

const card = "rounded-xl border border-[#322a2a] bg-[#141111]/95 shadow-[inset_0_1px_rgba(255,255,255,.035),0_12px_50px_rgba(0,0,0,.13)]";
const label = "text-[10px] font-semibold uppercase tracking-[.15em] text-[#6f7a84]";
const input = "h-11 w-full rounded-lg border border-[#433637] bg-[#0d0b0b] px-3 text-sm text-[#edf2f5] outline-none transition focus:border-[#d93a3e] focus:ring-2 focus:ring-[#d93a3e]/15";
const primaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#f4f0ed] px-5 text-sm font-semibold text-[#171010] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40";

export function PosTillScreen() {
  const { tillSessions, sales, openTill, closeTill } = useOperations();
  const [openingFloat, setOpeningFloat] = useState("500");
  const [closingCount, setClosingCount] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const currentTill = tillSessions.find((session) => session.status === "Open");
  const tillSales = currentTill ? sales.filter((sale) => sale.status === "Completed" && sale.createdAt >= currentTill.openedAt) : [];
  const cashSales = tillSales.flatMap((sale) => sale.payments).filter((payment) => payment.method === "Cash").reduce((sum, payment) => sum + payment.amount, 0);
  const cardSales = tillSales.flatMap((sale) => sale.payments).filter((payment) => payment.method === "Card").reduce((sum, payment) => sum + payment.amount, 0);
  const otherSales = tillSales.flatMap((sale) => sale.payments).filter((payment) => payment.method !== "Cash" && payment.method !== "Card").reduce((sum, payment) => sum + payment.amount, 0);
  const expectedCash = (currentTill?.openingFloat ?? 0) + cashSales;
  const previewVariance = closingCount === "" ? null : Number(closingCount) - expectedCash;

  function handleOpen() {
    try {
      const opened = openTill(Number(openingFloat));
      setMessage({ type: "success", text: `${opened.number} opened with ${zar.format(opened.openingFloat)} float.` });
      setClosingCount("");
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to open till" });
    }
  }

  function handleClose() {
    try {
      const closed = closeTill(Number(closingCount));
      setConfirmClose(false);
      setClosingCount("");
      setMessage({ type: "success", text: `${closed.number} closed with a ${zar.format(closed.variance ?? 0)} cash variance.` });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to close till" });
    }
  }

  return (
    <>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className={`${label} mb-2 text-[#ef5b5e]`}>POS / cash control</p><h1 className="text-2xl font-semibold tracking-tight sm:text-[30px]">Till session</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#818c95]">Control the opening float, cash received, closing count, and signed cash variance for every cashier shift.</p></div>
        <div className={`flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider ${currentTill ? "border-[#28533e] bg-[#10291f] text-[#5fc78f]" : "border-[#4a3b62] bg-[#21182e] text-[#b99bdd]"}`}>{currentTill ? <UnlockKeyhole size={14} /> : <LockKeyhole size={14} />}{currentTill ? `${currentTill.number} open` : "Till closed"}</div>
      </div>

      {message && <div className={`mb-4 flex gap-3 rounded-lg border p-4 text-sm ${message.type === "success" ? "border-[#28533e] bg-[#10291f] text-[#70d09d]" : "border-[#613037] bg-[#2f1519] text-[#e87980]"}`}>{message.type === "success" ? <Check size={17} /> : <CircleAlert size={17} />}<span>{message.text}</span></div>}

      {currentTill ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric title="Opening float" value={zar.format(currentTill.openingFloat)} detail={formatDate(currentTill.openedAt)} />
            <Metric title="Cash sales" value={zar.format(cashSales)} detail={`${tillSales.length} completed sale${tillSales.length === 1 ? "" : "s"}`} tone="green" />
            <Metric title="Card & other" value={zar.format(cardSales + otherSales)} detail={`Card ${zar.format(cardSales)} · Other ${zar.format(otherSales)}`} />
            <Metric title="Expected cash" value={zar.format(expectedCash)} detail="Opening float + net cash sales" tone="blue" />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
            <div className={`${card} overflow-hidden`}>
              <div className="border-b border-[#322a2a] p-5"><h2 className="text-sm font-semibold">Shift activity</h2><p className="mt-1 text-xs text-[#6f7a84]">Payments captured since {formatDate(currentTill.openedAt)}</p></div>
              {tillSales.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center"><Clock3 size={28} className="text-[#52616a]" /><p className="mt-3 text-sm font-semibold">No sales in this shift yet</p></div> : (
                <div className="divide-y divide-[#312929]">{tillSales.map((sale) => <div className="grid gap-2 p-4 text-xs sm:grid-cols-[130px_1fr_auto] sm:items-center sm:px-5" key={sale.id}><div><p className="font-mono font-semibold text-[#f0b2b4]">{sale.number}</p><p className="mt-1 text-[10px] text-[#6f7a84]">{formatDate(sale.createdAt)}</p></div><p className="text-[#9ca6ad]">{sale.payments.map((payment) => payment.method).join(" + ")}</p><p className="font-mono text-sm font-semibold">{zar.format(sale.revenue)}</p></div>)}</div>
              )}
            </div>

            <aside className={`${card} h-fit overflow-hidden`}>
              <div className="flex items-center gap-3 border-b border-[#322a2a] p-5"><div className="grid size-10 place-items-center rounded-lg bg-[#2d2413] text-[#deb15b]"><Banknote size={20} /></div><div><h2 className="text-sm font-semibold">Close & count till</h2><p className="mt-1 text-xs text-[#6f7a84]">Count all physical cash in the drawer</p></div></div>
              <div className="p-5">
                <label><span className="mb-2 block text-xs text-[#9ca6ad]">Closing cash count</span><input className={`${input} text-right font-mono text-lg font-semibold`} inputMode="decimal" placeholder="0.00" value={closingCount} onChange={(event) => { setClosingCount(event.target.value); setConfirmClose(false); }} /></label>
                <div className="mt-4 space-y-3 rounded-lg border border-[#293139] bg-[#0d0b0b] p-4 text-xs">
                  <div className="flex justify-between text-[#7f8a93]"><span>Expected cash</span><strong className="font-mono text-white">{zar.format(expectedCash)}</strong></div>
                  <div className="flex justify-between text-[#7f8a93]"><span>Counted cash</span><strong className="font-mono text-white">{zar.format(Number(closingCount) || 0)}</strong></div>
                  <div className="flex justify-between border-t border-[#293139] pt-3"><span>Preview variance</span><strong className={`font-mono ${previewVariance === null || Math.abs(previewVariance) < .01 ? "text-[#67d098]" : "text-[#e2ae55]"}`}>{previewVariance === null ? "—" : zar.format(previewVariance)}</strong></div>
                </div>
                {!confirmClose ? <button className={`${primaryButton} mt-5 w-full`} disabled={closingCount === "" || Number(closingCount) < 0} onClick={() => setConfirmClose(true)}><LockKeyhole size={16} /> Review till close</button> : (
                  <div className="mt-5 space-y-2">
                    <div className="rounded-lg border border-[#5f4820] bg-[#2c210d] p-3 text-xs leading-5 text-[#e0aa4b]">Confirming will lock this shift and permanently record the {zar.format(previewVariance ?? 0)} variance.</div>
                    <button className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#7b2e35] px-4 text-sm font-semibold text-white" onClick={handleClose}><LockKeyhole size={16} /> Confirm close</button>
                    <button className="min-h-10 w-full text-xs text-[#89949d]" onClick={() => setConfirmClose(false)}>Keep till open</button>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </>
      ) : (
        <div className={`${card} mx-auto max-w-xl p-6 sm:p-8`}>
          <div className="mx-auto grid size-14 place-items-center rounded-xl border border-[#603236] bg-[#241416] text-[#f06a6d]"><UnlockKeyhole size={24} /></div>
          <h2 className="mt-5 text-center text-lg font-semibold">Open a new cashier shift</h2>
          <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-6 text-[#7d8891]">Count the starting cash float before the first transaction. Checkout remains locked until a till is open.</p>
          <label className="mt-6 block"><span className="mb-2 block text-xs text-[#9ca6ad]">Opening float</span><input className={`${input} text-right font-mono text-lg font-semibold`} inputMode="decimal" value={openingFloat} onChange={(event) => setOpeningFloat(event.target.value)} /></label>
          <button className={`${primaryButton} mt-5 w-full`} disabled={Number(openingFloat) < 0} onClick={handleOpen}><UnlockKeyhole size={16} /> Open till as Ayanda</button>
        </div>
      )}

      <div className={`${card} mt-4 overflow-hidden`}>
        <div className="border-b border-[#322a2a] p-5"><h2 className="text-sm font-semibold">Till history</h2><p className="mt-1 text-xs text-[#6f7a84]">Permanent opening and closing record</p></div>
        <div className="scrollbar overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead><tr className="border-b border-[#322a2a] text-[10px] uppercase tracking-wider text-[#69747d]">{["Session", "Cashier", "Opened", "Opening", "Expected", "Counted", "Variance", "Status"].map((heading) => <th className="px-5 py-3 font-medium" key={heading}>{heading}</th>)}</tr></thead><tbody>{tillSessions.map((session) => <tr className="border-b border-[#292222] last:border-0" key={session.id}><td className="px-5 py-4 font-mono font-semibold text-[#f0b2b4]">{session.number}</td><td className="px-5 py-4">{session.cashier}</td><td className="px-5 py-4 text-[#7f8a93]">{formatDate(session.openedAt)}</td><td className="px-5 py-4 font-mono">{zar.format(session.openingFloat)}</td><td className="px-5 py-4 font-mono">{session.expectedCash === undefined ? "—" : zar.format(session.expectedCash)}</td><td className="px-5 py-4 font-mono">{session.closingCount === undefined ? "—" : zar.format(session.closingCount)}</td><td className={`px-5 py-4 font-mono font-semibold ${session.variance === undefined || Math.abs(session.variance) < .01 ? "text-[#67d098]" : "text-[#e2ae55]"}`}>{session.variance === undefined ? "—" : zar.format(session.variance)}</td><td className="px-5 py-4"><span className={`rounded-full border px-2 py-1 text-[9px] uppercase tracking-wider ${session.status === "Open" ? "border-[#28533e] bg-[#10291f] text-[#5fc78f]" : "border-[#4a3a3b] bg-[#1a1e22] text-[#a0a8af]"}`}>{session.status}</span></td></tr>)}</tbody></table></div>
      </div>
    </>
  );
}

function Metric({ title, value, detail, tone = "neutral" }: { title: string; value: string; detail: string; tone?: "neutral" | "green" | "blue" }) {
  const colors = { neutral: "text-white", green: "text-[#67d098]", blue: "text-[#ff8a8c]" };
  return <div className={`${card} p-4`}><p className={label}>{title}</p><p className={`mt-4 text-[24px] font-semibold tracking-[-.04em] ${colors[tone]}`}>{value}</p><p className="mt-2 text-[11px] text-[#69747e]">{detail}</p></div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
