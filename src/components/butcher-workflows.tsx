"use client";

import { useMemo, useState } from "react";
import {
  Check, ChevronDown, ChevronUp, CircleX, Clock3, PackageCheck,
  CreditCard, Plus, Printer, Scale, Search, ShoppingBasket, Trash2, X,
} from "lucide-react";
import Link from "next/link";
import { type ButcherTicket, type TicketStatus, useOperations } from "@/components/operations-store";
import { kg, zar } from "@/lib/utils";

const card = "rounded-xl border border-[#322a2a] bg-[#141111]/95 shadow-[inset_0_1px_rgba(255,255,255,.035),0_12px_50px_rgba(0,0,0,.13)]";
const label = "text-[10px] font-semibold uppercase tracking-[.15em] text-[#6f7a84]";
const input = "h-11 w-full rounded-lg border border-[#433637] bg-[#0d0b0b] px-3 text-sm text-[#edf2f5] outline-none transition focus:border-[#d93a3e] focus:ring-2 focus:ring-[#d93a3e]/15";
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#f4f0ed] px-4 text-sm font-semibold text-[#171010] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40";
const secondaryButton = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#433637] bg-[#1a1515] px-4 text-xs font-medium text-[#c2cbd1] transition hover:border-[#68474a] hover:bg-[#1a2025]";

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

function StatusBadge({ status }: { status: TicketStatus }) {
  const tones: Record<TicketStatus, string> = {
    Open: "border-[#713033] bg-[#2a1517] text-[#ff7779]",
    "Awaiting payment": "border-[#5f4820] bg-[#2c210d] text-[#e0aa4b]",
    Paid: "border-[#28533e] bg-[#10291f] text-[#5fc78f]",
    Cancelled: "border-[#613037] bg-[#2f1519] text-[#e87980]",
    Returned: "border-[#4a3b62] bg-[#21182e] text-[#b99bdd]",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.09em] ${tones[status]}`}>{status}</span>;
}

type CartLine = { productId: string; weight: string };

export function NewTicketScreen() {
  const { inventory, createTicket } = useOperations();
  const [query, setQuery] = useState("");
  const [customer, setCustomer] = useState("Walk-in");
  const [butcher, setButcher] = useState("Johan van Wyk");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string; ticket?: ButcherTicket } | null>(null);
  const products = useMemo(() => inventory.filter((item) => item.active && item.price > 0 && item.physical - item.reserved > 0 && item.product.toLowerCase().includes(query.toLowerCase())), [inventory, query]);

  const cartDetails = cart.map((line) => {
    const stock = inventory.find((item) => item.id === line.productId);
    const weightKg = Number(line.weight) || 0;
    return { ...line, stock, weightKg, lineTotal: weightKg * (stock?.price ?? 0), availableKg: stock ? stock.physical - stock.reserved : 0 };
  });
  const totalKg = cartDetails.reduce((sum, item) => sum + item.weightKg, 0);
  const total = cartDetails.reduce((sum, item) => sum + item.lineTotal, 0);
  const hasInvalidLine = cartDetails.some((item) => !item.stock || item.weightKg <= 0 || item.weightKg > item.availableKg);

  function addProduct(productId: string) {
    setCart((current) => current.some((item) => item.productId === productId) ? current : [...current, { productId, weight: "" }]);
    setMessage(null);
  }

  function updateWeight(productId: string, weight: string) {
    setCart((current) => current.map((item) => item.productId === productId ? { ...item, weight } : item));
    setMessage(null);
  }

  function removeProduct(productId: string) {
    setCart((current) => current.filter((item) => item.productId !== productId));
    setMessage(null);
  }

  function handleCreateTicket() {
    try {
      if (cart.length === 0) throw new Error("Add at least one product to the ticket");
      if (hasInvalidLine) throw new Error("Each item needs a valid scale weight within available stock");
      const ticket = createTicket({
        customer,
        butcher,
        items: cartDetails.map((item) => ({ productId: item.productId, weightKg: item.weightKg })),
      });
      setCart([]);
      setCustomer("Walk-in");
      setMessage({ type: "success", text: `${ticket.number} created. ${ticket.totalKg.toFixed(2)} kg is now reserved and ready for POS payment.`, ticket });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to create ticket" });
    }
  }

  return (
    <>
      <Header
        eyebrow="Butcher counter"
        title="New customer ticket"
        description="Select products, enter the scale weight, and reserve the meat for payment. Prices are snapshotted onto the ticket."
        action={<div className="flex items-center gap-2 rounded-full border border-[#254e3b] bg-[#10261d] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#5ed092]"><span className="size-1.5 rounded-full bg-[#4bd087]" /> Cooler stock live</div>}
      />

      {message && (
        <div className={`mb-4 flex items-start gap-3 rounded-lg border p-4 text-sm ${message.type === "success" ? "border-[#28533e] bg-[#10291f] text-[#70d09d]" : "border-[#613037] bg-[#2f1519] text-[#e87980]"}`}>
          {message.type === "success" ? <Check className="mt-0.5 shrink-0" size={17} /> : <CircleX className="mt-0.5 shrink-0" size={17} />}
          <div className="flex-1"><p>{message.text}</p>{message.ticket && <><p className="mt-1 font-mono text-xs text-[#8dbfa4]">{message.ticket.items.length} item{message.ticket.items.length === 1 ? "" : "s"} · {zar.format(message.ticket.total)}</p><div className="mt-3 flex flex-wrap gap-2"><Link className={secondaryButton} href="/pos/checkout"><CreditCard size={14} /> Take payment at POS</Link><button className={secondaryButton} onClick={() => window.print()}><Printer size={14} /> Print ticket</button></div></>}</div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <div className={`${card} overflow-hidden`}>
          <div className="flex flex-col gap-3 border-b border-[#322a2a] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-sm font-semibold">Available products</h2><p className="mt-1 text-xs text-[#6f7a84]">Tap a product once to add it to the ticket.</p></div>
            <label className="flex h-10 items-center gap-2 rounded-lg border border-[#433637] bg-[#0d0b0b] px-3">
              <Search size={15} className="text-[#6f7a84]" />
              <span className="sr-only">Search products</span>
              <input className="w-48 bg-transparent text-xs outline-none placeholder:text-[#66717a]" placeholder="Find a product…" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
          </div>
          <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((item) => {
              const selected = cart.some((line) => line.productId === item.id);
              return (
                <button
                  key={item.id}
                  className={`min-h-28 rounded-lg border p-4 text-left transition ${selected ? "border-[#49758c] bg-[#172832]" : "border-[#293139] bg-[#0e1114] hover:border-[#3b4851] hover:bg-[#14191d]"}`}
                  onClick={() => addProduct(item.id)}
                >
                  <div className="flex items-start justify-between gap-2"><span className="text-sm font-semibold">{item.product}</span>{selected ? <Check size={16} className="text-[#6ec698]" /> : <Plus size={16} className="text-[#6f7a84]" />}</div>
                  <p className="mt-4 font-mono text-lg font-semibold text-[#70cc9b]">{(item.physical - item.reserved).toFixed(2)} kg</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-[#6f7a84]">{zar.format(item.price)} / kg</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className={`${card} h-fit overflow-hidden xl:sticky xl:top-[96px]`}>
          <div className="flex items-center gap-3 border-b border-[#322a2a] p-5">
            <div className="grid size-10 place-items-center rounded-lg bg-[#281618] text-[#f06a6d]"><ShoppingBasket size={20} /></div>
            <div className="flex-1"><h2 className="text-sm font-semibold">Current ticket</h2><p className="mt-1 text-xs text-[#6f7a84]">{cart.length} product{cart.length === 1 ? "" : "s"} selected</p></div>
          </div>
          <div className="grid gap-4 border-b border-[#322a2a] p-5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <FormField fieldLabel="Customer"><input className={input} value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Walk-in or customer name" /></FormField>
            <FormField fieldLabel="Butcher"><select className={input} value={butcher} onChange={(event) => setButcher(event.target.value)}><option>Johan van Wyk</option><option>Lerato Molefe</option><option>Samkelo Dlamini</option></select></FormField>
          </div>
          <div className="max-h-[430px] space-y-2 overflow-y-auto p-4">
            {cartDetails.length === 0 ? (
              <div className="flex min-h-40 flex-col items-center justify-center text-center">
                <Scale size={28} className="text-[#68474a]" /><p className="mt-3 text-sm font-medium text-[#939da5]">No meat added yet</p><p className="mt-1 max-w-52 text-xs leading-5 text-[#657079]">Choose a product, then enter the physical scale weight.</p>
              </div>
            ) : cartDetails.map((item) => (
              <div key={item.productId} className="rounded-lg border border-[#293139] bg-[#0d0b0b] p-3">
                <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold">{item.stock?.product}</p><p className="mt-1 text-[10px] text-[#6f7a84]">{zar.format(item.stock?.price ?? 0)} / kg · {item.availableKg.toFixed(2)} kg available</p></div><button aria-label={`Remove ${item.stock?.product}`} className="grid size-8 place-items-center rounded-md text-[#7e8992] hover:bg-[#29171a] hover:text-[#e87980]" onClick={() => removeProduct(item.productId)}><Trash2 size={15} /></button></div>
                <div className="mt-3 grid grid-cols-[1fr_auto] gap-3">
                  <label><span className="sr-only">{item.stock?.product} weight in kg</span><div className="relative"><input aria-label={`${item.stock?.product} weight in kg`} className={`${input} pr-10 text-right font-mono text-base font-semibold`} inputMode="decimal" max={item.availableKg} min=".001" step=".001" type="number" value={item.weight} onChange={(event) => updateWeight(item.productId, event.target.value)} placeholder="0.000" /><span className="pointer-events-none absolute right-3 top-3.5 text-[10px] text-[#6f7a84]">kg</span></div></label>
                  <div className="min-w-24 text-right"><p className={label}>Line total</p><p className="mt-2 font-mono text-sm font-semibold">{zar.format(item.lineTotal)}</p></div>
                </div>
                {item.weightKg > item.availableKg && <p className="mt-2 text-[10px] text-[#e87980]">Only {item.availableKg.toFixed(2)} kg is available.</p>}
              </div>
            ))}
          </div>
          <div className="border-t border-[#322a2a] bg-[#100d0d] p-5">
            <div className="mb-4 flex items-end justify-between"><div><p className={label}>Reserved weight</p><p className="mt-2 font-mono text-lg font-semibold">{kg(totalKg)}</p></div><div className="text-right"><p className={label}>Ticket total</p><p className="mt-2 font-mono text-2xl font-semibold text-[#ff8a8c]">{zar.format(total)}</p></div></div>
            <button className={`${button} w-full`} disabled={cart.length === 0 || hasInvalidLine} onClick={handleCreateTicket}><PackageCheck size={17} /> Create & reserve ticket</button>
            <p className="mt-3 text-center text-[10px] leading-4 text-[#657079]">No payment is taken here. POS will convert reserved stock to sold stock later.</p>
          </div>
        </div>
      </div>
    </>
  );
}

export function OpenTicketsScreen() {
  const { tickets, cancelTicket } = useOperations();
  const openTickets = tickets.filter((ticket) => ticket.status === "Open" || ticket.status === "Awaiting payment");
  const [expandedId, setExpandedId] = useState<string | null>(openTickets[0]?.id ?? null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function confirmCancellation(ticket: ButcherTicket) {
    try {
      if (!reason) throw new Error("Select a cancellation reason");
      cancelTicket(ticket.id, reason);
      setCancellingId(null);
      setReason("");
      setExpandedId(null);
      setMessage({ type: "success", text: `${ticket.number} cancelled. ${ticket.totalKg.toFixed(2)} kg was released back to available Cooler stock.` });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to cancel ticket" });
    }
  }

  return (
    <>
      <Header eyebrow="Butcher counter" title="Open tickets" description="Tickets waiting for payment hold stock in reserve. Review an order or cancel it to return the meat to available stock." action={<div className="rounded-full border border-[#5f4820] bg-[#2c210d] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#e0aa4b]">{openTickets.length} awaiting payment</div>} />
      {message && <div className={`mb-4 flex gap-3 rounded-lg border p-4 text-sm ${message.type === "success" ? "border-[#28533e] bg-[#10291f] text-[#70d09d]" : "border-[#613037] bg-[#2f1519] text-[#e87980]"}`}>{message.type === "success" ? <Check size={17} /> : <CircleX size={17} />}<span>{message.text}</span></div>}
      <div className="space-y-3">
        {openTickets.length === 0 ? <EmptyTickets title="No open tickets" description="All butcher tickets have been paid or cancelled." /> : openTickets.map((ticket) => {
          const expanded = expandedId === ticket.id;
          return (
            <article key={ticket.id} className={`${card} overflow-hidden`}>
              <button className="flex w-full flex-col gap-4 p-5 text-left sm:flex-row sm:items-center" onClick={() => setExpandedId(expanded ? null : ticket.id)}>
                <div className="flex items-center gap-3 sm:w-56"><div className="grid size-10 place-items-center rounded-lg bg-[#281618] font-mono text-xs font-semibold text-[#8dbbd3]">{ticket.number.slice(-3)}</div><div><p className="font-mono text-sm font-semibold">{ticket.number}</p><p className="mt-1 text-[10px] text-[#6f7a84]">{formatDate(ticket.createdAt)}</p></div></div>
                <div className="flex-1"><p className="text-sm font-medium">{ticket.customer}</p><p className="mt-1 text-xs text-[#6f7a84]">{ticket.butcher} · {ticket.items.length} item{ticket.items.length === 1 ? "" : "s"}</p></div>
                <div className="flex items-center gap-6"><div className="text-right"><p className="font-mono text-sm font-semibold">{kg(ticket.totalKg)}</p><p className="mt-1 font-mono text-xs text-[#87b8d0]">{zar.format(ticket.total)}</p></div><StatusBadge status={ticket.status} />{expanded ? <ChevronUp size={17} className="text-[#7c8790]" /> : <ChevronDown size={17} className="text-[#7c8790]" />}</div>
              </button>
              {expanded && (
                <div className="border-t border-[#322a2a] bg-[#100d0d] p-5">
                  <div className="grid gap-2">
                    {ticket.items.map((item) => <div key={item.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-5 rounded-lg border border-[#312929] bg-[#141111] px-4 py-3 text-xs"><div><p className="font-semibold">{item.product}</p><p className="mt-1 text-[10px] text-[#6f7a84]">{zar.format(item.pricePerKg)} / kg</p></div><p className="font-mono font-semibold">{item.weightKg.toFixed(2)} kg</p><p className="w-24 text-right font-mono">{zar.format(item.lineTotal)}</p></div>)}
                  </div>
                  <div className="mt-4 flex flex-col gap-3 border-t border-[#312929] pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="flex items-center gap-2 text-xs text-[#7d8891]"><Clock3 size={14} className="text-[#d7a64f]" /> Reserved until cashier completes payment</p>
                    {cancellingId === ticket.id ? (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <select aria-label="Cancellation reason" className={`${input} min-w-56`} value={reason} onChange={(event) => setReason(event.target.value)}><option value="">Select reason…</option><option>Customer changed order</option><option>Incorrect weight</option><option>Wrong product</option><option>Duplicate ticket</option><option>Other</option></select>
                        <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#7b2e35] px-4 text-xs font-semibold text-white hover:bg-[#923942] disabled:opacity-40" disabled={!reason} onClick={() => confirmCancellation(ticket)}><CircleX size={15} /> Confirm cancellation</button>
                        <button className={secondaryButton} onClick={() => { setCancellingId(null); setReason(""); }}><X size={14} /> Keep ticket</button>
                      </div>
                    ) : <div className="flex flex-wrap gap-2"><Link className={secondaryButton} href="/pos/checkout"><CreditCard size={14} /> Send to POS</Link><button className={secondaryButton} onClick={() => window.print()}><Printer size={14} /> Print</button><button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#5a2d33] bg-[#251316] px-4 text-xs font-medium text-[#e27a81] hover:bg-[#30181c]" onClick={() => { setCancellingId(ticket.id); setReason(""); }}><CircleX size={15} /> Cancel & release stock</button></div>}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}

export function RecentTicketsScreen() {
  const { tickets } = useOperations();
  const [status, setStatus] = useState<"All" | TicketStatus>("All");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const filtered = tickets.filter((ticket) => (status === "All" || ticket.status === status) && (ticket.number.toLowerCase().includes(query.toLowerCase()) || ticket.customer.toLowerCase().includes(query.toLowerCase())));
  const paidTotal = tickets.filter((ticket) => ticket.status === "Paid").reduce((sum, ticket) => sum + ticket.total, 0);
  const cancelledKg = tickets.filter((ticket) => ticket.status === "Cancelled").reduce((sum, ticket) => sum + ticket.totalKg, 0);

  return (
    <>
      <Header eyebrow="Butcher counter" title="Recent tickets" description="Search the complete butcher-ticket history, including paid and cancelled orders, without changing historical prices." />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <MiniMetric title="Tickets recorded" value={String(tickets.length)} detail="Current device history" />
        <MiniMetric title="Paid ticket value" value={zar.format(paidTotal)} detail="Completed by POS" tone="green" />
        <MiniMetric title="Cancelled weight" value={kg(cancelledKg)} detail="Returned to available stock" tone="amber" />
      </div>
      <div className={`${card} overflow-hidden`}>
        <div className="flex flex-col gap-3 border-b border-[#322a2a] p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {(["All", "Awaiting payment", "Paid", "Cancelled"] as const).map((option) => <button key={option} className={`rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider ${status === option ? "border-[#743236] bg-[#2b1719] text-[#ff8a8c]" : "border-[#433637] bg-[#141111] text-[#7c8790] hover:text-white"}`} onClick={() => setStatus(option)}>{option}</button>)}
          </div>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-[#433637] bg-[#0d0b0b] px-3">
            <Search size={15} className="text-[#6f7a84]" /><span className="sr-only">Search tickets</span>
            <input className="w-full bg-transparent text-xs outline-none placeholder:text-[#66717a] sm:w-64" placeholder="Ticket number or customer…" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        </div>
        {filtered.length === 0 ? <EmptyTickets title="No matching tickets" description="Try a different status or search term." /> : (
          <div className="scrollbar overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead><tr className="border-b border-[#322a2a] text-[10px] uppercase tracking-[.12em] text-[#69747d]">{["Ticket", "Created", "Customer", "Butcher", "Items", "Weight", "Total", "Status", ""].map((heading, index) => <th key={`${heading}-${index}`} className={`px-5 py-3 font-medium ${index >= 4 && index <= 6 ? "text-right" : ""}`}>{heading}</th>)}</tr></thead>
              <tbody>
                {filtered.flatMap((ticket) => {
                  const mainRow = <tr key={ticket.id} className="border-b border-[#292222] text-xs hover:bg-[#1a1515]"><td className="px-5 py-4 font-mono font-semibold text-[#f0b2b4]">{ticket.number}</td><td className="px-5 py-4 text-[#7e8992]">{formatDate(ticket.createdAt)}</td><td className="px-5 py-4 font-medium">{ticket.customer}</td><td className="px-5 py-4 text-[#8b959d]">{ticket.butcher}</td><td className="px-5 py-4 text-right font-mono">{ticket.items.length}</td><td className="px-5 py-4 text-right font-mono">{ticket.totalKg.toFixed(2)} kg</td><td className="px-5 py-4 text-right font-mono font-semibold">{zar.format(ticket.total)}</td><td className="px-5 py-4"><StatusBadge status={ticket.status} /></td><td className="px-5 py-4"><button aria-label={`${expandedId === ticket.id ? "Hide" : "Show"} ${ticket.number} details`} className="grid size-8 place-items-center rounded-md border border-[#433637] text-[#89949d] hover:text-white" onClick={() => setExpandedId(expandedId === ticket.id ? null : ticket.id)}>{expandedId === ticket.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button></td></tr>;
                  if (expandedId !== ticket.id) return [mainRow];
                  return [mainRow, <tr key={`${ticket.id}-detail`} className="border-b border-[#292222] bg-[#100d0d]"><td colSpan={9} className="px-5 py-4"><div className="flex flex-wrap gap-2">{ticket.items.map((item) => <span key={item.id} className="rounded-md border border-[#293139] bg-[#14191d] px-3 py-2 text-xs"><strong>{item.product}</strong><span className="ml-2 font-mono text-[#82909a]">{item.weightKg.toFixed(2)} kg · {zar.format(item.lineTotal)}</span></span>)}</div>{ticket.cancellationReason && <p className="mt-3 text-xs text-[#d97980]">Cancellation reason: {ticket.cancellationReason}</p>}</td></tr>];
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function FormField({ fieldLabel, children }: { fieldLabel: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-medium text-[#a4adb4]">{fieldLabel}</span>{children}</label>;
}

function EmptyTickets({ title, description }: { title: string; description: string }) {
  return <div className={`${card} flex min-h-72 flex-col items-center justify-center p-8 text-center`}><div className="grid size-14 place-items-center rounded-xl border border-[#603236] bg-[#241416] text-[#f06a6d]"><ShoppingBasket size={24} /></div><h2 className="mt-4 text-base font-semibold">{title}</h2><p className="mt-2 text-sm text-[#7d8891]">{description}</p></div>;
}

function MiniMetric({ title, value, detail, tone = "neutral" }: { title: string; value: string; detail: string; tone?: "neutral" | "green" | "amber" }) {
  const tones = { neutral: "text-white", green: "text-[#67d098]", amber: "text-[#e5b45c]" };
  return <div className={`${card} p-4`}><p className={label}>{title}</p><p className={`mt-4 text-[23px] font-semibold tracking-[-.04em] ${tones[tone]}`}>{value}</p><p className="mt-2 text-[11px] text-[#69747e]">{detail}</p></div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
