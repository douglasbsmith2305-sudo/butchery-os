"use client";

import { useEffect, useState } from "react";

type Product = { id: number; sku: string; name: string; department: string; unit: string; quantity: number; costPrice: number; sellingPrice: number; blockTestProfileCode?: string | null };
type Receipt = { id: number; receiptNumber: string; supplierName: string; invoiceNumber: string; deliveryDate: string; totalCost: number };
type Line = { id: number; receiptId: number; productName: string; quantity: number; unit: string; lineTotal: number };
type Allocation = { id: number; receiptId: number; outputName: string; expectedQuantity: number; lowQuantity: number; highQuantity: number };
type Snapshot = { products: Product[]; receipts: Receipt[]; lines: Line[]; allocations: Allocation[]; orders: { status: string }[] };
const money = (n: number) => n.toLocaleString("en-ZA", { style: "currency", currency: "ZAR" });
const quantity = (n: number, unit = "kg") => `${n.toLocaleString("en-ZA", { maximumFractionDigits: 3 })} ${unit}`;

function useSnapshot() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    Promise.all(["/api/receiving", "/api/orders"].map(async url => {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Could not load live inventory. Please retry.");
      return response.json();
    })).then(([inventory, orders]) => { if (!controller.signal.aborted) setData({ ...inventory, orders: orders.orders }); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [version]);
  return { data, error, retry: () => setVersion(v => v + 1) };
}

function Loading({ error, retry }: { error: string; retry: () => void }) {
  return <div className="content" role={error ? "alert" : "status"}><p>{error || "Loading live stock records…"}</p>{error ? <button onClick={retry}>Retry</button> : null}</div>;
}

export function ManagerOverview({ onNavigate }: { onNavigate: (section: string) => void }) {
  const { data, error, retry } = useSnapshot();
  if (error || !data) return <Loading error={error} retry={retry} />;
  const products = data.products.filter(p => !p.blockTestProfileCode);
  const negative = products.filter(p => p.quantity < 0).length;
  const openOrders = data.orders.filter(o => ["QUEUED", "IN_PROGRESS", "READY"].includes(o.status)).length;
  const actions = [["Receiving", "Receive stock", "Record supplier stock and invoices"], ["Orders", "Track orders", "Butcher, bakery and takeaway orders"], ["Stock count", "Count stock", "Reconcile physical quantities"], ["Waste & loss", "Record waste", "Explain stock lost or discarded"]];
  return <div className="content"><div className="eyebrow">GEORGE&apos;S BUTCHERY / LIVE OVERVIEW</div><div className="page-heading"><div><h1>What needs doing?</h1><p>Saved inventory and orders. No sample batches or estimated dashboard totals.</p></div><button onClick={retry}>Refresh</button></div>
    <section className="stat-grid"><article><small>STOCK ITEMS</small><strong>{products.length}</strong><em>Active stock master products</em></article><article><small>INVENTORY AT COST</small><strong>{money(products.reduce((sum, p) => sum + p.quantity * p.costPrice, 0))}</strong><em>Includes imported on-hand balances</em></article><article><small>OPEN ORDERS</small><strong>{openOrders}</strong><em>Queued, in progress or ready</em></article><article><small>NEGATIVE STOCK ITEMS</small><strong className={negative ? "amber" : "green"}>{negative}</strong><em>{negative ? "Verify with a physical stock count" : "No negative balances recorded"}</em></article></section>
    <section className="overview-actions">{actions.map(([target, title, copy]) => <button key={target} onClick={() => onNavigate(target)}><small>OPEN MODULE</small><strong>{title}</strong><span>{copy}</span><b>→</b></button>)}</section>
    <section className="panel"><div className="panel-head"><div><small>RECEIVING HISTORY</small><h2>Latest deliveries</h2></div></div>{data.receipts.length ? data.receipts.slice(0, 5).map(r => <div className="panel-head" key={r.id}><div><strong>{r.receiptNumber}</strong><p>{r.supplierName} · {r.invoiceNumber} · {r.deliveryDate}</p></div><b>{money(r.totalCost)}</b></div>) : <div className="receiving-empty"><strong>No deliveries recorded yet.</strong><span>Your first delivery will appear here after receiving.</span></div>}</section>
  </div>;
}

export function LiveBatchTracking() {
  const { data, error, retry } = useSnapshot();
  const [selected, setSelected] = useState(0);
  if (error || !data) return <Loading error={error} retry={retry} />;
  const receipt = data.receipts.find(r => r.id === selected) ?? data.receipts[0];
  return <div className="content"><div className="eyebrow">BACK OFFICE / BATCH TRACKING</div><div className="page-heading"><div><h1>Every delivery. Every kilogram.</h1><p>Recent saved receipts, invoice references and automatic cut allocations.</p></div><button onClick={retry}>Refresh</button></div>{receipt ? <><section className="panel"><div className="panel-head"><label>Supplier delivery<select value={receipt.id} onChange={e => setSelected(Number(e.target.value))}>{data.receipts.map(r => <option key={r.id} value={r.id}>{r.receiptNumber} · {r.supplierName} · {r.invoiceNumber}</option>)}</select></label><b>{money(receipt.totalCost)}</b></div><div className="panel-head"><h2>{receipt.receiptNumber}</h2><span>{receipt.supplierName} · invoice {receipt.invoiceNumber} · {receipt.deliveryDate}</span></div>{data.lines.filter(l => l.receiptId === receipt.id).map(l => <div className="panel-head" key={l.id}><strong>{l.productName}</strong><span>{quantity(l.quantity, l.unit)} · {money(l.lineTotal)}</span></div>)}</section><section className="panel"><div className="panel-head"><h2>Automatic yield allocations</h2><span>Baseline ±2% · estimates, not a measured block test</span></div>{data.allocations.filter(a => a.receiptId === receipt.id).length ? data.allocations.filter(a => a.receiptId === receipt.id).map(a => <div className="panel-head" key={a.id}><strong>{a.outputName}</strong><span>{quantity(a.expectedQuantity)} · range {quantity(a.lowQuantity)}–{quantity(a.highQuantity)}</span></div>) : <div className="receiving-empty">Direct item receipt — no carcass allocations.</div>}</section></> : <section className="panel receiving-empty"><strong>No batches or deliveries recorded yet.</strong><span>New receipts and their automatic allocations will appear here.</span></section>}</div>;
}

export function LiveCoolerInventory() {
  const { data, error, retry } = useSnapshot();
  const [search, setSearch] = useState("");
  if (error || !data) return <Loading error={error} retry={retry} />;
  const products = data.products.filter(p => p.unit.toLowerCase() === "kg" && !p.blockTestProfileCode && `${p.name} ${p.sku} ${p.department}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="content"><div className="eyebrow">MANAGER / COOLER INVENTORY</div><div className="page-heading"><div><h1>Current cooler stock.</h1><p>Stock master balances for kilogram products. Auto-yield receipts remain estimates until verified by a stock count.</p></div><button onClick={retry}>Refresh</button></div><section className="panel"><div className="panel-head"><label>Search cooler products<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, stock code or department" /></label><span>{products.length} products</span></div>{products.length ? products.map(p => <div className="panel-head" key={p.id}><div><strong>{p.name}</strong><p>{p.sku} · {p.department}</p></div><div><b className={p.quantity < 0 ? "amber" : ""}>{quantity(p.quantity)}</b><p>{money(p.costPrice)} cost/kg · {money(p.sellingPrice)} retail/kg</p></div></div>) : <div className="receiving-empty">No matching cooler products.</div>}</section></div>;
}
