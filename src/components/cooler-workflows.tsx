"use client";

import { useMemo, useState } from "react";
import { Check, ClipboardCheck, RotateCcw, Scale, Search, ShieldCheck, TriangleAlert } from "lucide-react";
import { useOperations } from "@/components/operations-store";
import { reconcileStockCount } from "@/lib/inventory";
import { kg, zar } from "@/lib/utils";

const card = "rounded-xl border border-[#322a2a] bg-[#141111]/95 shadow-[inset_0_1px_rgba(255,255,255,.035),0_12px_50px_rgba(0,0,0,.13)]";
const label = "text-[10px] font-semibold uppercase tracking-[.15em] text-[#6f7a84]";
const input = "h-11 w-full rounded-lg border border-[#433637] bg-[#0d0b0b] px-3 text-sm text-[#edf2f5] outline-none transition focus:border-[#d93a3e] focus:ring-2 focus:ring-[#d93a3e]/15";
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#f4f0ed] px-4 text-sm font-semibold text-[#171010] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40";
const secondaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#433637] bg-[#1a1515] px-4 text-sm font-medium text-[#c2cbd1] transition hover:border-[#68474a] hover:bg-[#1a2025]";

function Header({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className={`${label} mb-2 text-[#ef5b5e]`}>{eyebrow}</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[30px]">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#818c95]">{description}</p>
      </div>
      {action}
    </div>
  );
}

function StatusBadge({ children, tone }: { children: React.ReactNode; tone: "green" | "amber" | "red" | "blue" }) {
  const tones = {
    green: "border-[#28533e] bg-[#10291f] text-[#5fc78f]",
    amber: "border-[#5f4820] bg-[#2c210d] text-[#e0aa4b]",
    red: "border-[#613037] bg-[#2f1519] text-[#e87980]",
    blue: "border-[#713033] bg-[#2a1517] text-[#ff7779]",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.09em] ${tones[tone]}`}>{children}</span>;
}

type CountDraft = Record<string, { counted: string; reason: string }>;

export function StockCountScreen() {
  const { inventory, stockCounts, submitStockCount } = useOperations();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<CountDraft>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const rows = useMemo(() => inventory.filter((item) => item.product.toLowerCase().includes(query.toLowerCase())), [inventory, query]);
  const countedRows = useMemo(() => inventory.flatMap((item) => {
    const raw = draft[item.id]?.counted;
    if (raw === undefined || raw === "") return [];
    const countedKg = Number(raw);
    if (!Number.isFinite(countedKg) || countedKg < 0) return [];
    return [{ item, reason: draft[item.id]?.reason ?? "", ...reconcileStockCount(item.physical, countedKg) }];
  }), [draft, inventory]);
  const totalVarianceKg = countedRows.reduce((sum, row) => sum + row.varianceKg, 0);
  const totalVarianceValue = countedRows.reduce((sum, row) => sum + row.varianceKg * row.item.cost, 0);
  const needsReason = countedRows.some((row) => row.varianceKg !== 0 && !row.reason);
  const hasInvalidCount = inventory.some((item) => {
    const raw = draft[item.id]?.counted;
    if (raw === undefined || raw === "") return false;
    const countedKg = Number(raw);
    return !Number.isFinite(countedKg) || countedKg < item.reserved;
  });

  function updateDraft(productId: string, patch: Partial<CountDraft[string]>) {
    setDraft((current) => ({ ...current, [productId]: { counted: current[productId]?.counted ?? "", reason: current[productId]?.reason ?? "", ...patch } }));
    setMessage(null);
  }

  function fillSystemValues() {
    setDraft(Object.fromEntries(inventory.map((item) => [item.id, { counted: String(item.physical), reason: "" }])));
    setMessage(null);
  }

  function handleSubmit() {
    try {
      if (countedRows.length === 0) throw new Error("Enter at least one physical stock weight");
      if (hasInvalidCount) throw new Error("A physical count cannot be negative or below its reserved stock");
      if (needsReason) throw new Error("Select a reason for every product with a variance");
      const record = submitStockCount(countedRows.map((row) => ({ productId: row.item.id, countedKg: row.countedKg, reason: row.reason || "Count matched system" })));
      setDraft({});
      setMessage({ type: "success", text: `${record.number} posted. ${record.itemCount} products counted and all adjustments were written to the ledger.` });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to post stock count" });
    }
  }

  return (
    <>
      <Header
        eyebrow="Cooler / control"
        title="Physical stock count"
        description="Count what is physically on the scale. Variances require a reason and post as permanent correcting ledger entries."
        action={<button className={secondaryButton} onClick={fillSystemValues}><RotateCcw size={16} /> Start with system weights</button>}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary name="Products entered" value={`${countedRows.length} / ${inventory.length}`} detail="Blank products are not submitted" />
        <Summary name="Net variance" value={kg(totalVarianceKg)} detail="Physical less system" tone={Math.abs(totalVarianceKg) > 0.01 ? "amber" : "green"} />
        <Summary name="Variance value" value={zar.format(totalVarianceValue)} detail="At weighted average cost" tone={totalVarianceValue < 0 ? "red" : "neutral"} />
        <Summary name="Last completed count" value={stockCounts[0]?.number ?? "No count yet"} detail={stockCounts[0] ? formatDate(stockCounts[0].createdAt) : "Start the first count below"} />
      </div>

      {message && (
        <div className={`mb-4 flex items-start gap-3 rounded-lg border p-4 text-sm ${message.type === "success" ? "border-[#28533e] bg-[#10291f] text-[#70d09d]" : "border-[#613037] bg-[#2f1519] text-[#e87980]"}`}>
          {message.type === "success" ? <Check className="mt-0.5 shrink-0" size={17} /> : <TriangleAlert className="mt-0.5 shrink-0" size={17} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className={`${card} overflow-hidden`}>
        <div className="flex flex-col gap-3 border-b border-[#322a2a] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Count sheet</h2>
            <p className="mt-1 text-xs text-[#6f7a84]">Reserved stock is included in physical kg and cannot be counted below its reserved weight.</p>
          </div>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-[#433637] bg-[#0d0b0b] px-3">
            <Search size={15} className="text-[#6f7a84]" />
            <span className="sr-only">Search products</span>
            <input className="w-48 bg-transparent text-xs outline-none placeholder:text-[#66717a]" placeholder="Find product…" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        </div>
        <div className="scrollbar overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead>
              <tr className="border-b border-[#322a2a] text-[10px] uppercase tracking-[.12em] text-[#69747d]">
                {["Product", "System kg", "Reserved kg", "Physical count kg", "Variance kg", "Reason for variance"].map((heading, index) => <th key={heading} className={`px-5 py-3 font-medium ${index > 0 && index < 5 ? "text-right" : ""}`}>{heading}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const raw = draft[item.id]?.counted ?? "";
                const counted = raw === "" ? null : Number(raw);
                const variance = counted === null || !Number.isFinite(counted) ? null : counted - item.physical;
                return (
                  <tr key={item.id} className="border-b border-[#292222] text-xs last:border-0">
                    <td className="px-5 py-3.5 font-semibold">{item.product}</td>
                    <td className="px-5 py-3.5 text-right font-mono">{item.physical.toFixed(2)}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-[#e1aa4b]">{item.reserved.toFixed(2)}</td>
                    <td className="px-5 py-2 text-right">
                      <input
                        aria-label={`${item.product} physical count`}
                        className="h-10 w-28 rounded-md border border-[#4c3a3c] bg-[#0b0e10] px-2 text-right font-mono text-sm font-semibold outline-none focus:border-[#8c3a3e]"
                        inputMode="decimal"
                        min={item.reserved}
                        step=".001"
                        type="number"
                        value={raw}
                        onChange={(event) => updateDraft(item.id, { counted: event.target.value })}
                      />
                    </td>
                    <td className={`px-5 py-3.5 text-right font-mono font-semibold ${variance === null || Math.abs(variance) < 0.001 ? "text-[#77828b]" : variance < 0 ? "text-[#e87980]" : "text-[#63ca94]"}`}>
                      {variance === null ? "—" : `${variance > 0 ? "+" : ""}${variance.toFixed(2)}`}
                    </td>
                    <td className="px-5 py-2">
                      {variance !== null && Math.abs(variance) >= 0.001 ? (
                        <select aria-label={`${item.product} variance reason`} className="h-10 w-full min-w-48 rounded-md border border-[#4c3a3c] bg-[#0b0e10] px-2 text-xs outline-none focus:border-[#8c3a3e]" value={draft[item.id]?.reason ?? ""} onChange={(event) => updateDraft(item.id, { reason: event.target.value })}>
                          <option value="">Select reason…</option>
                          <option>Scale error</option><option>Unrecorded waste</option><option>Butcher variance</option>
                          <option>Processing error</option><option>Theft suspected</option><option>Admin correction</option><option>Unknown</option>
                        </select>
                      ) : <span className="text-[#59646d]">Not required</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-4 border-t border-[#322a2a] bg-[#100d0d] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 text-xs leading-5 text-[#7e8992]">
            <ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#6db6d9]" />
            <p>Submitting creates one stock count record and adjustment movements only for products whose weights differ.</p>
          </div>
          <button className={button} disabled={countedRows.length === 0 || needsReason || hasInvalidCount} onClick={handleSubmit}><ClipboardCheck size={16} /> Post stock count</button>
        </div>
      </div>
    </>
  );
}

export function WasteScreen() {
  const { inventory, waste, recordWaste } = useOperations();
  const eligible = inventory.filter((item) => item.physical - item.reserved > 0);
  const [productId, setProductId] = useState(eligible[0]?.id ?? "");
  const [weight, setWeight] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const selected = inventory.find((item) => item.id === productId);
  const weightKg = Number(weight) || 0;
  const availableKg = selected ? selected.physical - selected.reserved : 0;
  const invalidWeight = weightKg <= 0 || weightKg > availableKg;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (!selected) throw new Error("Select a product");
      if (invalidWeight) throw new Error(`Enter a weight between 0 and ${availableKg.toFixed(2)} kg`);
      if (!reason) throw new Error("Select a waste reason");
      const created = recordWaste({ productId, weightKg, reason, notes });
      setWeight("");
      setReason("");
      setNotes("");
      setMessage({ type: "success", text: `${created.number} recorded. ${created.weightKg.toFixed(2)} kg was removed from available stock.` });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to record waste" });
    }
  }

  const wasteToday = waste.filter((item) => item.createdAt.slice(0, 10) === new Date().toISOString().slice(0, 10));
  return (
    <>
      <Header eyebrow="Cooler / control" title="Waste control" description="Record damaged, spoiled, trimmed, or rejected meat immediately. Waste reduces physical stock and remains permanently traceable." />
      <div className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
        <form className={`${card} h-fit p-5 sm:p-6`} onSubmit={handleSubmit}>
          <div className="mb-6 flex items-center gap-3 border-b border-[#322a2a] pb-5">
            <div className="grid size-10 place-items-center rounded-lg bg-[#2d1c12] text-[#e0a455]"><TriangleAlert size={20} /></div>
            <div><h2 className="text-sm font-semibold">Record waste</h2><p className="mt-1 text-xs text-[#6f7a84]">Available stock only—reserved customer meat is protected.</p></div>
          </div>
          <div className="space-y-5">
            <FormField label="Product">
              <select className={input} value={productId} onChange={(event) => { setProductId(event.target.value); setMessage(null); }}>
                {eligible.map((item) => <option key={item.id} value={item.id}>{item.product}</option>)}
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-[#293139] bg-[#0d0b0b] p-4">
              <div><p className={label}>Available</p><p className="mt-2 font-mono text-lg font-semibold text-[#67cc98]">{kg(availableKg)}</p></div>
              <div className="text-right"><p className={label}>Average cost</p><p className="mt-2 font-mono text-lg font-semibold">{zar.format(selected?.cost ?? 0)}</p></div>
            </div>
            <FormField label="Waste weight (kg)" hint="Scale weight">
              <input className={`${input} text-lg font-semibold`} inputMode="decimal" max={availableKg} min="0.001" step=".001" type="number" value={weight} onChange={(event) => { setWeight(event.target.value); setMessage(null); }} placeholder="0.000" />
            </FormField>
            <FormField label="Reason">
              <select className={input} value={reason} onChange={(event) => { setReason(event.target.value); setMessage(null); }}>
                <option value="">Select reason…</option><option>Spoilage</option><option>Trimming loss</option><option>Quality rejection</option>
                <option>Temperature breach</option><option>Damaged packaging</option><option>Bone / fat disposal</option><option>Other</option>
              </select>
            </FormField>
            <FormField label="Notes" hint="Optional">
              <textarea className={`${input} h-20 py-3`} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Condition, cause, corrective action…" />
            </FormField>
            <div className="flex items-center justify-between rounded-lg border border-[#3f3322] bg-[#21190d] p-4">
              <div><p className={label}>Estimated cost impact</p><p className="mt-1 text-xs text-[#8d7d64]">Recorded at weighted average cost</p></div>
              <p className="font-mono text-lg font-semibold text-[#e4ad52]">{zar.format(weightKg * (selected?.cost ?? 0))}</p>
            </div>
            {message && <div className={`flex gap-3 rounded-lg border p-3 text-xs leading-5 ${message.type === "success" ? "border-[#28533e] bg-[#10291f] text-[#70d09d]" : "border-[#613037] bg-[#2f1519] text-[#e87980]"}`}>{message.type === "success" ? <Check className="mt-0.5 shrink-0" size={15} /> : <TriangleAlert className="mt-0.5 shrink-0" size={15} />}<span>{message.text}</span></div>}
            <button className={`${button} w-full`} disabled={invalidWeight || !reason} type="submit"><Scale size={16} /> Record waste movement</button>
          </div>
        </form>

        <div className={`${card} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-[#322a2a] p-5">
            <div><h2 className="text-sm font-semibold">Waste register</h2><p className="mt-1 text-xs text-[#6f7a84]">Permanent stock and cost history</p></div>
            <StatusBadge tone="amber">{wasteToday.reduce((sum, item) => sum + item.weightKg, 0).toFixed(2)} kg today</StatusBadge>
          </div>
          <div className="scrollbar overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead><tr className="border-b border-[#322a2a] text-[10px] uppercase tracking-[.12em] text-[#69747d]">{["Reference", "Date", "Product", "Reason", "Weight", "Cost impact", "Recorded by"].map((heading, index) => <th key={heading} className={`px-5 py-3 font-medium ${index === 4 || index === 5 ? "text-right" : ""}`}>{heading}</th>)}</tr></thead>
              <tbody>
                {waste.map((item) => (
                  <tr key={item.id} className="border-b border-[#292222] text-xs last:border-0 hover:bg-[#1a1515]">
                    <td className="px-5 py-4 font-mono text-[#9ba8b1]">{item.number}</td>
                    <td className="px-5 py-4 text-[#7e8992]">{formatDate(item.createdAt)}</td>
                    <td className="px-5 py-4 font-semibold">{item.product}</td>
                    <td className="px-5 py-4"><StatusBadge tone="amber">{item.reason}</StatusBadge>{item.notes && <p className="mt-1 max-w-52 truncate text-[10px] text-[#6f7a84]">{item.notes}</p>}</td>
                    <td className="px-5 py-4 text-right font-mono font-semibold text-[#e87980]">−{item.weightKg.toFixed(2)} kg</td>
                    <td className="px-5 py-4 text-right font-mono">{zar.format(item.costValue)}</td>
                    <td className="px-5 py-4 text-[#7e8992]">{item.recordedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function Summary({ name, value, detail, tone = "neutral" }: { name: string; value: string; detail: string; tone?: "neutral" | "green" | "amber" | "red" }) {
  const tones = { neutral: "text-white", green: "text-[#67d098]", amber: "text-[#e5b45c]", red: "text-[#ea7b82]" };
  return <div className={`${card} p-4`}><p className={label}>{name}</p><p className={`mt-4 text-[23px] font-semibold tracking-[-.04em] ${tones[tone]}`}>{value}</p><p className="mt-2 text-[11px] text-[#69747e]">{detail}</p></div>;
}

function FormField({ label: fieldLabel, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 flex items-center justify-between text-xs font-medium text-[#a4adb4]">{fieldLabel}{hint && <span className="text-[10px] font-normal text-[#907a7b]">{hint}</span>}</span>{children}</label>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
