"use client";

import { useMemo, useRef, useState } from "react";
import {
  Banknote, Barcode, Check, ChevronDown, ChevronUp, CircleAlert, CreditCard,
  Minus, PackageCheck, Plus, Printer, ReceiptText, ScanLine, Settings2, ShoppingCart, Trash2,
} from "lucide-react";
import {
  type ButcherTicket,
  type PaymentMethod,
  type RetailProduct,
  type SaleRecord,
  useOperations,
} from "@/components/operations-store";
import {
  calculateScaleLine,
  DEFAULT_SCALE_FORMATS,
  normalizeBarcode,
  normalizePlu,
  parseBarcode,
  paymentDifference,
} from "@/lib/pos";
import { kg, zar } from "@/lib/utils";

const card = "rounded-xl border border-[#272e34] bg-[#111418]/95 shadow-[inset_0_1px_rgba(255,255,255,.035),0_12px_50px_rgba(0,0,0,.13)]";
const label = "text-[10px] font-semibold uppercase tracking-[.15em] text-[#6f7a84]";
const input = "h-11 w-full rounded-lg border border-[#303840] bg-[#0c0f12] px-3 text-sm text-[#edf2f5] outline-none transition focus:border-[#528cad] focus:ring-2 focus:ring-[#528cad]/15";
const primaryButton = "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#dbe8ef] px-5 text-sm font-semibold text-[#10161a] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40";
const secondaryButton = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#303840] bg-[#15191d] px-4 text-xs font-medium text-[#c2cbd1] transition hover:border-[#46515a] hover:bg-[#1a2025]";

type ScaleCartLine = {
  key: string;
  source: "scale";
  productId: string;
  product: string;
  barcode: string;
  weightKg: number;
  unitPrice: number;
  lineTotal: number;
  formatLabel: string;
};

type TicketCartLine = {
  key: string;
  source: "ticket";
  ticketId: string;
  ticket: ButcherTicket;
};

type RetailCartLine = {
  key: string;
  source: "retail";
  retailProductId: string;
  product: RetailProduct;
  quantity: number;
};

type CartLine = ScaleCartLine | TicketCartLine | RetailCartLine;
type PaymentMode = PaymentMethod | "Split";

export function PosCheckoutScreen() {
  const {
    inventory,
    tickets,
    retailProducts,
    tillSessions,
    completeSale,
    updateScalePlu,
  } = useOperations();
  const [scanValue, setScanValue] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState("Walk-in");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("Card");
  const [cashTender, setCashTender] = useState("");
  const [splitCash, setSplitCash] = useState("");
  const [splitCard, setSplitCard] = useState("");
  const [splitEft, setSplitEft] = useState("");
  const [receipt, setReceipt] = useState<SaleRecord | null>(null);
  const [showScaleSetup, setShowScaleSetup] = useState(false);
  const [scaleFormatId, setScaleFormatId] = useState("teraoka-price-5");
  const scanRef = useRef<HTMLInputElement>(null);

  const openTill = tillSessions.find((session) => session.status === "Open");
  const openTickets = tickets.filter((ticket) => ticket.status === "Open" || ticket.status === "Awaiting payment");
  const scaleFormats = DEFAULT_SCALE_FORMATS.filter((format) => format.prefix === "20");
  const selectedScaleFormat = scaleFormats.find((format) => format.id === scaleFormatId) ?? scaleFormats[0];

  const total = useMemo(() => cart.reduce((sum, line) => {
    if (line.source === "scale") return sum + line.lineTotal;
    if (line.source === "ticket") return sum + line.ticket.total;
    return sum + (line.product.price * line.quantity);
  }, 0), [cart]);
  const roundedTotal = Math.round((total + Number.EPSILON) * 100) / 100;
  const totalKg = cart.reduce((sum, line) => {
    if (line.source === "scale") return sum + line.weightKg;
    if (line.source === "ticket") return sum + line.ticket.totalKg;
    return sum;
  }, 0);
  const totalUnits = cart.reduce((sum, line) => line.source === "retail" ? sum + line.quantity : sum, 0);
  const splitPayments = [
    { method: "Cash" as const, amount: Number(splitCash) || 0 },
    { method: "Card" as const, amount: Number(splitCard) || 0 },
    { method: "EFT" as const, amount: Number(splitEft) || 0 },
  ].filter((payment) => payment.amount > 0);
  const splitDifference = paymentDifference(roundedTotal, splitPayments);
  const cashChange = Math.max(0, (Number(cashTender) || 0) - roundedTotal);
  const canPay = Boolean(openTill) && roundedTotal > 0 && (
    paymentMode === "Cash"
      ? Number(cashTender) >= roundedTotal
      : paymentMode === "Split"
        ? Math.abs(splitDifference) < 0.001
        : true
  );

  function focusScanner() {
    window.setTimeout(() => scanRef.current?.focus(), 0);
  }

  function addTicket(ticket: ButcherTicket) {
    if (cart.some((line) => line.source === "ticket" && line.ticketId === ticket.id)) {
      setMessage({ type: "error", text: `${ticket.number} is already in the basket.` });
      return;
    }
    setCart((current) => [...current, { key: `ticket-${ticket.id}`, source: "ticket", ticketId: ticket.id, ticket }]);
    setMessage({ type: "success", text: `${ticket.number} added. Its reserved stock will move to sold when payment completes.` });
    focusScanner();
  }

  function processScan(rawValue: string) {
    const raw = rawValue.trim();
    if (!raw) return;
    setMessage(null);
    try {
      const ticket = openTickets.find((item) => item.number.toLowerCase() === raw.toLowerCase());
      if (ticket) {
        addTicket(ticket);
        setScanValue("");
        return;
      }

      const normalized = normalizeBarcode(raw);
      const formats = normalized.startsWith("21")
        ? DEFAULT_SCALE_FORMATS.filter((format) => format.prefix === "21")
        : selectedScaleFormat ? [selectedScaleFormat] : DEFAULT_SCALE_FORMATS;
      const parsed = parseBarcode(normalized, formats, inventory.map((item) => item.scalePlu));
      if (parsed.kind === "scale") {
        if (cart.some((line) => line.source === "scale" && line.barcode === parsed.raw)) {
          throw new Error("That weighted label is already in the basket");
        }
        const stock = inventory.find((item) => normalizePlu(item.scalePlu) === normalizePlu(parsed.plu));
        if (!stock) throw new Error(`Scale PLU ${parsed.plu} is not mapped. Open Scale setup to assign it.`);
        const calculated = calculateScaleLine(parsed, stock.price);
        if (calculated.weightKg > stock.physical - stock.reserved) {
          throw new Error(`${stock.product}: only ${(stock.physical - stock.reserved).toFixed(3)} kg is available`);
        }
        setCart((current) => [...current, {
          key: `scale-${parsed.raw}`,
          source: "scale",
          productId: stock.id,
          product: stock.product,
          barcode: parsed.raw,
          weightKg: calculated.weightKg,
          unitPrice: stock.price,
          lineTotal: calculated.lineTotal,
          formatLabel: parsed.formatLabel,
        }]);
        setMessage({ type: "success", text: `${stock.product} scanned: ${calculated.weightKg.toFixed(3)} kg at ${zar.format(calculated.lineTotal)}.` });
      } else {
        const retail = retailProducts.find((item) => item.barcode === parsed.raw);
        if (!retail) throw new Error(`Barcode ${parsed.raw} is not in the retail product catalog`);
        const existing = cart.find((line) => line.source === "retail" && line.retailProductId === retail.id);
        if (existing?.source === "retail" && existing.quantity >= retail.stockUnits) {
          throw new Error(`${retail.name}: no more units are available`);
        }
        setCart((current) => {
          const currentRetail = current.find((line) => line.source === "retail" && line.retailProductId === retail.id);
          if (!currentRetail) return [...current, {
            key: `retail-${retail.id}`,
            source: "retail",
            retailProductId: retail.id,
            product: retail,
            quantity: 1,
          }];
          if (currentRetail.source !== "retail") return current;
          return current.map((line) => line.key === currentRetail.key ? { ...currentRetail, quantity: currentRetail.quantity + 1 } : line);
        });
        setMessage({ type: "success", text: `${retail.name} added to the basket.` });
      }
      setScanValue("");
      focusScanner();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to read barcode" });
      setScanValue("");
      focusScanner();
    }
  }

  function changeRetailQuantity(key: string, delta: number) {
    setCart((current) => current.flatMap((line) => {
      if (line.key !== key || line.source !== "retail") return [line];
      const quantity = line.quantity + delta;
      if (quantity <= 0) return [];
      if (quantity > line.product.stockUnits) {
        setMessage({ type: "error", text: `${line.product.name}: only ${line.product.stockUnits} units available.` });
        return [line];
      }
      return [{ ...line, quantity }];
    }));
    focusScanner();
  }

  function removeLine(key: string) {
    setCart((current) => current.filter((line) => line.key !== key));
    setMessage(null);
    focusScanner();
  }

  function handlePayment() {
    try {
      let payments: { method: PaymentMethod; amount: number }[];
      if (paymentMode === "Cash") payments = [{ method: "Cash", amount: roundedTotal }];
      else if (paymentMode === "Split") payments = splitPayments;
      else payments = [{ method: paymentMode, amount: roundedTotal }];
      const sale = completeSale({
        customer,
        payments,
        lines: cart.map((line) => {
          if (line.source === "scale") return {
            source: "scale" as const,
            productId: line.productId,
            barcode: line.barcode,
            weightKg: line.weightKg,
            lineTotal: line.lineTotal,
          };
          if (line.source === "ticket") return { source: "ticket" as const, ticketId: line.ticketId };
          return { source: "retail" as const, retailProductId: line.retailProductId, quantity: line.quantity };
        }),
      });
      setReceipt(sale);
      setCart([]);
      setCustomer("Walk-in");
      setCashTender("");
      setSplitCash("");
      setSplitCard("");
      setSplitEft("");
      setMessage(null);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to complete sale" });
    }
  }

  if (receipt) {
    return <ReceiptView sale={receipt} onNewSale={() => { setReceipt(null); focusScanner(); }} />;
  }

  return (
    <>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className={`${label} mb-2 text-[#719bb2]`}>POS / live checkout</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[30px]">Scan & checkout</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#818c95]">Scan Teraoka meat labels, normal retail barcodes, or add a reserved butcher ticket. The scanner behaves like a keyboard and submits with Enter.</p>
        </div>
        <div className={`flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider ${openTill ? "border-[#28533e] bg-[#10291f] text-[#5fc78f]" : "border-[#613037] bg-[#2f1519] text-[#e87980]"}`}>
          <span className={`size-1.5 rounded-full ${openTill ? "bg-[#4bd087]" : "bg-[#e87980]"}`} />
          {openTill ? `${openTill.number} open · Ayanda` : "Till closed"}
        </div>
      </div>

      {!openTill && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-[#613037] bg-[#2f1519] p-4 text-sm text-[#e87980]">
          <CircleAlert size={18} /> Open the till from the Till screen before taking payment.
        </div>
      )}

      <form
        className={`${card} mb-4 border-[#395868] bg-[#10171b] p-4 sm:p-5`}
        onSubmit={(event) => { event.preventDefault(); processScan(scanValue); }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#18303c] text-[#82c4e5]"><ScanLine size={25} /></div>
          <div className="min-w-0 flex-1">
            <label className="mb-2 block text-xs font-semibold text-[#b9c6cd]" htmlFor="pos-barcode">Scanner input</label>
            <div className="relative">
              <Barcode className="pointer-events-none absolute left-3 top-3.5 text-[#62869a]" size={18} />
              <input
                ref={scanRef}
                autoFocus
                autoComplete="off"
                className="h-12 w-full rounded-lg border border-[#426a80] bg-[#080b0d] pl-11 pr-4 font-mono text-base tracking-[.08em] text-white outline-none focus:border-[#76b5d7] focus:ring-2 focus:ring-[#528cad]/20"
                id="pos-barcode"
                inputMode="numeric"
                placeholder="Scan barcode or enter BT-10482, then press Enter"
                value={scanValue}
                onChange={(event) => setScanValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  processScan(event.currentTarget.value);
                }}
              />
            </div>
          </div>
          <button className={`${primaryButton} md:mt-6`} type="submit"><ScanLine size={18} /> Add scan</button>
          <button className={`${secondaryButton} md:mt-6`} type="button" onClick={() => setShowScaleSetup((current) => !current)}>
            <Settings2 size={15} /> Scale setup {showScaleSetup ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-[#6f7a84]">
          <span className="mr-1 uppercase tracking-wider">Try demo</span>
          <button className="rounded-full border border-[#34404a] px-3 py-1.5 hover:text-white" type="button" onClick={() => processScan("2044442153356")}>Rump scale label</button>
          <button className="rounded-full border border-[#34404a] px-3 py-1.5 hover:text-white" type="button" onClick={() => processScan("5449000000996")}>Coke can</button>
          <span className="ml-auto hidden sm:inline">Active mask: {selectedScaleFormat?.label}</span>
        </div>
      </form>

      {showScaleSetup && (
        <div className={`${card} mb-4 p-5`}>
          <div className="flex flex-col gap-4 border-b border-[#272e34] pb-5 md:flex-row md:items-end md:justify-between">
            <div><h2 className="text-sm font-semibold">Teraoka scale setup</h2><p className="mt-1 text-xs leading-5 text-[#77838c]">Choose the barcode mask printed by your scale and match each scale PLU to a Cooler product.</p></div>
            <label className="block min-w-72"><span className="mb-2 block text-xs text-[#9ca6ad]">Price barcode mask</span><select className={input} value={scaleFormatId} onChange={(event) => setScaleFormatId(event.target.value)}>{scaleFormats.map((format) => <option key={format.id} value={format.id}>{format.label}</option>)}</select></label>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {inventory.filter((item) => item.price > 0).map((item) => (
              <label key={item.id} className="flex items-center gap-3 rounded-lg border border-[#293139] bg-[#0d1013] p-3">
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{item.product}</span>
                <input
                  aria-label={`${item.product} scale PLU`}
                  className="h-9 w-20 rounded-md border border-[#34404a] bg-[#080b0d] px-2 text-right font-mono text-xs outline-none focus:border-[#598da9]"
                  defaultValue={item.scalePlu}
                  inputMode="numeric"
                  maxLength={5}
                  onBlur={(event) => {
                    try {
                      updateScalePlu(item.id, event.target.value);
                      setMessage({ type: "success", text: `${item.product} mapped to scale PLU ${event.target.value}.` });
                    } catch (error) {
                      event.target.value = item.scalePlu;
                      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to update PLU" });
                    }
                  }}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {message && (
        <div className={`mb-4 flex items-start gap-3 rounded-lg border p-4 text-sm ${message.type === "success" ? "border-[#28533e] bg-[#10291f] text-[#70d09d]" : "border-[#613037] bg-[#2f1519] text-[#e87980]"}`}>
          {message.type === "success" ? <Check className="mt-0.5 shrink-0" size={17} /> : <CircleAlert className="mt-0.5 shrink-0" size={17} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid gap-4 2xl:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          <div className={`${card} overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-[#272e34] p-5">
              <div><h2 className="text-sm font-semibold">Current basket</h2><p className="mt-1 text-xs text-[#6f7a84]">{cart.length} line{cart.length === 1 ? "" : "s"} · {kg(totalKg)} · {totalUnits} retail unit{totalUnits === 1 ? "" : "s"}</p></div>
              {cart.length > 0 && <button className="text-xs text-[#d4777e] hover:text-[#f0959c]" onClick={() => setCart([])}>Clear basket</button>}
            </div>
            {cart.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
                <div className="grid size-14 place-items-center rounded-xl border border-[#344651] bg-[#14232c] text-[#79b5d4]"><ShoppingCart size={24} /></div>
                <h3 className="mt-4 text-sm font-semibold">Ready for the first scan</h3>
                <p className="mt-2 max-w-sm text-xs leading-5 text-[#77838c]">The scanner will identify a weighted meat label, retail barcode, or butcher ticket and add it here.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#252c32]">
                {cart.map((line) => (
                  <div key={line.key} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
                    <div className={`grid size-10 shrink-0 place-items-center rounded-lg ${line.source === "scale" ? "bg-[#172f3b] text-[#7fc3e4]" : line.source === "ticket" ? "bg-[#2d2413] text-[#deb15b]" : "bg-[#173025] text-[#6fd09a]"}`}>
                      {line.source === "scale" ? <Barcode size={19} /> : line.source === "ticket" ? <PackageCheck size={19} /> : <ShoppingCart size={19} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{line.source === "ticket" ? line.ticket.number : line.source === "retail" ? line.product.name : line.product}</p><span className="rounded-full border border-[#34404a] px-2 py-0.5 text-[9px] uppercase tracking-wider text-[#7e8992]">{line.source}</span></div>
                      {line.source === "scale" && <p className="mt-1 font-mono text-[10px] text-[#6f7a84]">{line.barcode} · {line.formatLabel}</p>}
                      {line.source === "ticket" && <p className="mt-1 text-xs text-[#78838c]">{line.ticket.customer} · {line.ticket.items.map((item) => item.product).join(", ")}</p>}
                      {line.source === "retail" && <p className="mt-1 font-mono text-[10px] text-[#6f7a84]">{line.product.barcode} · {line.product.stockUnits} in stock</p>}
                    </div>
                    {line.source === "retail" ? (
                      <div className="flex items-center gap-1 rounded-lg border border-[#303840] bg-[#0c0f12] p-1">
                        <button aria-label={`Decrease ${line.product.name}`} className="grid size-8 place-items-center rounded-md hover:bg-[#1c2328]" onClick={() => changeRetailQuantity(line.key, -1)}><Minus size={14} /></button>
                        <span className="w-8 text-center font-mono text-sm font-semibold">{line.quantity}</span>
                        <button aria-label={`Increase ${line.product.name}`} className="grid size-8 place-items-center rounded-md hover:bg-[#1c2328]" onClick={() => changeRetailQuantity(line.key, 1)}><Plus size={14} /></button>
                      </div>
                    ) : <p className="w-24 text-right font-mono text-sm font-semibold">{line.source === "scale" ? `${line.weightKg.toFixed(3)} kg` : kg(line.ticket.totalKg)}</p>}
                    <p className="w-28 text-right font-mono text-base font-semibold">{zar.format(line.source === "scale" ? line.lineTotal : line.source === "ticket" ? line.ticket.total : line.product.price * line.quantity)}</p>
                    <button aria-label="Remove line" className="grid size-9 place-items-center rounded-md text-[#7f8991] hover:bg-[#29171a] hover:text-[#e87980]" onClick={() => removeLine(line.key)}><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`${card} overflow-hidden`}>
            <div className="border-b border-[#272e34] p-5"><h2 className="text-sm font-semibold">Awaiting butcher tickets</h2><p className="mt-1 text-xs text-[#6f7a84]">Tap a ticket if its printed ticket barcode is unavailable.</p></div>
            <div className="grid gap-2 p-4 md:grid-cols-2">
              {openTickets.map((ticket) => (
                <button key={ticket.id} className="flex min-h-20 items-center gap-3 rounded-lg border border-[#293139] bg-[#0e1114] p-4 text-left hover:border-[#46515a]" onClick={() => addTicket(ticket)}>
                  <div className="grid size-10 place-items-center rounded-lg bg-[#2d2413] font-mono text-xs font-semibold text-[#deb15b]">{ticket.number.slice(-3)}</div>
                  <div className="min-w-0 flex-1"><p className="font-mono text-xs font-semibold">{ticket.number}</p><p className="mt-1 truncate text-[10px] text-[#77838c]">{ticket.customer} · {kg(ticket.totalKg)}</p></div>
                  <p className="font-mono text-sm font-semibold">{zar.format(ticket.total)}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <aside className={`${card} h-fit overflow-hidden 2xl:sticky 2xl:top-[96px]`}>
          <div className="border-b border-[#272e34] p-5">
            <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-lg bg-[#18303c] text-[#82c4e5]"><CreditCard size={20} /></div><div><h2 className="text-sm font-semibold">Payment</h2><p className="mt-1 text-xs text-[#6f7a84]">Complete the sale and issue a receipt</p></div></div>
          </div>
          <div className="border-b border-[#272e34] p-5">
            <label className="block"><span className="mb-2 block text-xs text-[#9ca6ad]">Customer</span><input className={input} value={customer} onChange={(event) => setCustomer(event.target.value)} /></label>
          </div>
          <div className="grid grid-cols-2 gap-2 p-4">
            {(["Card", "Cash", "EFT", "Customer account", "Split"] as PaymentMode[]).map((mode) => (
              <button key={mode} className={`min-h-12 rounded-lg border px-3 text-xs font-semibold transition ${paymentMode === mode ? "border-[#4d7c94] bg-[#172b36] text-[#9bd0e9]" : "border-[#303840] bg-[#0e1114] text-[#8f9aa2] hover:text-white"} ${mode === "Split" ? "col-span-2" : ""}`} onClick={() => setPaymentMode(mode)}>{mode}</button>
            ))}
          </div>
          {paymentMode === "Cash" && (
            <div className="border-t border-[#272e34] p-5">
              <label><span className="mb-2 block text-xs text-[#9ca6ad]">Cash tendered</span><input className={`${input} text-right font-mono text-lg font-semibold`} inputMode="decimal" placeholder="0.00" value={cashTender} onChange={(event) => setCashTender(event.target.value)} /></label>
              <div className="mt-3 flex justify-between text-xs"><span className="text-[#77838c]">Change</span><strong className="font-mono text-[#6bd09a]">{zar.format(cashChange)}</strong></div>
            </div>
          )}
          {paymentMode === "Split" && (
            <div className="space-y-3 border-t border-[#272e34] p-5">
              {[
                ["Cash", splitCash, setSplitCash],
                ["Card", splitCard, setSplitCard],
                ["EFT", splitEft, setSplitEft],
              ].map(([name, value, setter]) => (
                <label className="grid grid-cols-[70px_1fr] items-center gap-3" key={String(name)}><span className="text-xs text-[#9ca6ad]">{String(name)}</span><input className={`${input} text-right font-mono`} inputMode="decimal" placeholder="0.00" value={String(value)} onChange={(event) => (setter as React.Dispatch<React.SetStateAction<string>>)(event.target.value)} /></label>
              ))}
              <div className="flex justify-between border-t border-[#272e34] pt-3 text-xs"><span className="text-[#77838c]">{splitDifference < 0 ? "Still due" : "Difference"}</span><strong className={`font-mono ${Math.abs(splitDifference) < .001 ? "text-[#6bd09a]" : "text-[#e2ae55]"}`}>{zar.format(Math.abs(splitDifference))}</strong></div>
            </div>
          )}
          <div className="border-t border-[#272e34] bg-[#0c0f12] p-5">
            <div className="mb-5 flex items-end justify-between"><div><p className={label}>Basket</p><p className="mt-2 text-xs text-[#78838c]">{kg(totalKg)} · {totalUnits} units</p></div><div className="text-right"><p className={label}>Total due</p><p className="mt-2 font-mono text-3xl font-semibold tracking-tight text-[#8bc4e0]">{zar.format(roundedTotal)}</p></div></div>
            <button className={`${primaryButton} w-full`} disabled={!canPay} onClick={handlePayment}>{paymentMode === "Cash" ? <Banknote size={18} /> : <CreditCard size={18} />} Complete {paymentMode.toLowerCase()} payment</button>
            <p className="mt-3 text-center text-[10px] leading-4 text-[#657079]">Payment posts the sale, moves reserved meat to sold, and reduces unit stock.</p>
          </div>
        </aside>
      </div>
    </>
  );
}

function ReceiptView({ sale, onNewSale }: { sale: SaleRecord; onNewSale: () => void }) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className={`${label} mb-2 text-[#6fc890]`}>Payment complete</p><h1 className="text-2xl font-semibold">Receipt {sale.receiptNumber}</h1><p className="mt-2 text-sm text-[#818c95]">{sale.number} · {new Date(sale.createdAt).toLocaleString("en-ZA")}</p></div>
        <div className="flex gap-2"><button className={secondaryButton} onClick={() => window.print()}><Printer size={15} /> Print receipt</button><button className={primaryButton} onClick={onNewSale}><Plus size={16} /> New sale</button></div>
      </div>
      <div className={`${card} overflow-hidden`}>
        <div className="flex items-center gap-4 border-b border-[#272e34] p-6"><div className="grid size-12 place-items-center rounded-full bg-[#153524] text-[#6bd09a]"><Check size={24} /></div><div><h2 className="font-semibold">Sale successfully posted</h2><p className="mt-1 text-xs text-[#77838c]">{sale.customer} · Cashier {sale.cashier}</p></div><p className="ml-auto font-mono text-2xl font-semibold">{zar.format(sale.revenue)}</p></div>
        <div className="divide-y divide-[#252c32]">
          {sale.items.map((item) => <div className="grid grid-cols-[1fr_auto] gap-4 px-6 py-4 text-xs" key={item.id}><div><p className="font-semibold">{item.product}</p><p className="mt-1 text-[10px] text-[#6f7a84]">{item.ticketNumber ? `${item.ticketNumber} · ` : ""}{item.weightKg ? `${item.weightKg.toFixed(3)} kg @ ${zar.format(item.unitPrice)}/kg` : `${item.quantity} × ${zar.format(item.unitPrice)}`}</p></div><p className="font-mono font-semibold">{zar.format(item.lineTotal)}</p></div>)}
        </div>
        <div className="grid gap-4 border-t border-[#272e34] bg-[#0c0f12] p-6 sm:grid-cols-3">
          <ReceiptMetric labelText="Payment" value={sale.payments.map((payment) => payment.method).join(" + ")} />
          <ReceiptMetric labelText="Total weight" value={kg(sale.totalKg)} />
          <ReceiptMetric labelText="Gross margin" value={`${sale.grossMargin.toFixed(2)}%`} />
        </div>
      </div>
      <div className="mt-4 flex items-start gap-3 rounded-lg border border-[#2e4d5e] bg-[#12232c] p-4 text-xs leading-5 text-[#85b6ce]"><ReceiptText className="mt-0.5 shrink-0" size={16} /><p>The transaction, payment allocation, cost of goods, ticket link, and kilogram movements have been retained for reconciliation.</p></div>
    </div>
  );
}

function ReceiptMetric({ labelText, value }: { labelText: string; value: string }) {
  return <div><p className={label}>{labelText}</p><p className="mt-2 font-mono text-sm font-semibold">{value}</p></div>;
}
