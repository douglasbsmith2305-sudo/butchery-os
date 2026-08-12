"use client";

import { useMemo, useState } from "react";

type Yield = { name: string; percent: number; price: number };
type Batch = { id: string; supplier: string; type: string; weight: number; date: string };

const TOLERANCE = 0.02;

const PROFILES: Record<string, Yield[]> = {
  "Beef hind quarter": [
    { name: "Rump", percent: 4, price: 169.99 },
    { name: "Topside", percent: 11, price: 139.99 },
    { name: "Silverside", percent: 10, price: 134.99 },
    { name: "Thick flank", percent: 9, price: 129.99 },
    { name: "Striploin", percent: 7, price: 184.99 },
    { name: "Fillet", percent: 2, price: 269.99 },
    { name: "Shin", percent: 6, price: 99.99 },
    { name: "Stew beef", percent: 12, price: 119.99 },
    { name: "Mince / trim", percent: 15, price: 109.99 },
    { name: "Bone", percent: 18, price: 24.99 },
    { name: "Fat / expected loss", percent: 6, price: 0 },
  ],
  "Beef fore quarter": [
    { name: "Chuck", percent: 14, price: 124.99 },
    { name: "Brisket", percent: 9, price: 139.99 },
    { name: "Short rib", percent: 10, price: 129.99 },
    { name: "Blade", percent: 8, price: 129.99 },
    { name: "Shin", percent: 7, price: 99.99 },
    { name: "Stew beef", percent: 13, price: 119.99 },
    { name: "Mince / trim", percent: 16, price: 109.99 },
    { name: "Bone", percent: 17, price: 24.99 },
    { name: "Fat / expected loss", percent: 6, price: 0 },
  ],
};

const seedBatches: Batch[] = [
  { id: "HQ-260812-002", supplier: "Karoo Prime Meats", type: "Beef hind quarter", weight: 186.4, date: "Today, 07:42" },
  { id: "FQ-260811-006", supplier: "Highveld Beef Co.", type: "Beef fore quarter", weight: 204.8, date: "Yesterday, 14:18" },
];

const kg = (value: number, digits = 2) => `${value.toLocaleString("en-ZA", { maximumFractionDigits: digits, minimumFractionDigits: digits })} kg`;
const money = (value: number) => value.toLocaleString("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 2 });

export default function Home() {
  const [section, setSection] = useState("Receiving");
  const [supplier, setSupplier] = useState("Karoo Prime Meats");
  const [profile, setProfile] = useState("Beef hind quarter");
  const [weight, setWeight] = useState(100);
  const [invoice, setInvoice] = useState("KPM-68142");
  const [batches, setBatches] = useState(seedBatches);
  const [notice, setNotice] = useState("");

  const estimates = useMemo(() => PROFILES[profile].map((item) => {
    const expected = weight * item.percent / 100;
    return { ...item, expected, low: expected * (1 - TOLERANCE), high: expected * (1 + TOLERANCE) };
  }), [profile, weight]);

  const retailValue = estimates.reduce((sum, item) => sum + item.expected * item.price, 0);
  const yieldTotal = PROFILES[profile].reduce((sum, item) => sum + item.percent, 0);

  function receiveDelivery() {
    if (!invoice.trim() || weight <= 0) {
      setNotice("Enter a valid invoice number and scale weight.");
      return;
    }
    const prefix = profile.includes("hind") ? "HQ" : "FQ";
    const id = `${prefix}-260812-${String(batches.length + 3).padStart(3, "0")}`;
    setBatches([{ id, supplier, type: profile, weight, date: "Just now" }, ...batches]);
    setNotice(`${id} received. ${kg(weight)} was allocated automatically using the ${profile.toLowerCase()} yield model.`);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">B</span><div><strong>BUTCHERY OS</strong><small>KG CONTROL</small></div></div>
        <nav aria-label="Main navigation">
          <p>OPERATIONS</p>
          {[
            ["Overview", "01"], ["Receiving", "02"], ["Cooler inventory", "03"], ["Butcher counter", "04"], ["POS", "05"],
          ].map(([name, number]) => <button key={name} className={section === name ? "active" : ""} onClick={() => setSection(name)}><span>{number}</span>{name}</button>)}
          <p>CONTROL</p>
          {["Stock count", "Waste & loss", "Reports", "Settings"].map((name, i) => <button key={name} onClick={() => setSection(name)}><span>0{i + 6}</span>{name}</button>)}
        </nav>
        <div className="operator"><span>NM</span><div><strong>Naledi Mokoena</strong><small>Warehouse operator</small></div></div>
      </aside>

      <main>
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open menu">☰</button>
          <div><span className="live-dot" /> LEDGER ONLINE</div>
          <div className="shift">WED 12 AUG · MORNING SHIFT</div>
        </header>

        <div className="content">
          <div className="eyebrow">COOLER / RECEIVING</div>
          <div className="page-heading">
            <div><h1>Receive meat. Know what you have.</h1><p>One scale weight creates estimated cut inventory automatically. No manual block test required.</p></div>
            <span className="status-pill">AUTO-YIELD ACTIVE</span>
          </div>

          <section className="stat-grid" aria-label="Stock summary">
            <article><small>RAW RECEIVED TODAY</small><strong>{kg(286.4, 1)}</strong><em>2 supplier lots</em></article>
            <article><small>ESTIMATED SALEABLE</small><strong>{kg(217.2, 1)}</strong><em>75.8% of received weight</em></article>
            <article><small>PROJECTED RETAIL VALUE</small><strong>{money(32184.70)}</strong><em>At current shelf prices</em></article>
            <article><small>CONTROL TOLERANCE</small><strong className="amber">± 2%</strong><em>Applied to every cut estimate</em></article>
          </section>

          <div className="workspace-grid">
            <section className="panel receive-panel">
              <div className="panel-head"><div><small>STEP 01</small><h2>Supplier delivery</h2></div><span>Scale weight is the stock source</span></div>
              <div className="form-grid">
                <label>Supplier<select value={supplier} onChange={(e) => setSupplier(e.target.value)}><option>Karoo Prime Meats</option><option>Highveld Beef Co.</option><option>Lowveld Livestock</option></select></label>
                <label>Supplier invoice<input value={invoice} onChange={(e) => setInvoice(e.target.value)} /></label>
                <label>Meat received<select value={profile} onChange={(e) => setProfile(e.target.value)}>{Object.keys(PROFILES).map((name) => <option key={name}>{name}</option>)}</select></label>
                <label>Delivery date<input type="date" defaultValue="2026-08-12" /></label>
                <label className="weight-field">Actual scale weight <span>PRIMARY STOCK QUANTITY</span><div><input type="number" min="0.01" step="0.1" value={weight} onChange={(e) => setWeight(Number(e.target.value))} /><b>kg</b></div></label>
              </div>
              <div className="logic-note"><span>✓</span><div><strong>Automatic allocation</strong><p>{kg(weight)} is distributed using the {profile.toLowerCase()} baseline. The system accepts normal movement within 2% of each calculated cut.</p></div></div>
              {notice && <div className="notice" role="status">{notice}</div>}
              <button className="primary-action" onClick={receiveDelivery}>Receive & allocate stock <span>→</span></button>
            </section>

            <section className="panel yield-panel">
              <div className="panel-head"><div><small>STEP 02 · AUTOMATIC</small><h2>Expected cooler stock</h2></div><span>{yieldTotal}% mass allocated</span></div>
              <div className="example-callout"><div><small>YOUR EXAMPLE</small><strong>100 kg hind quarter → 4.00 kg rump</strong></div><div><small>2% RANGE</small><strong>3.92–4.08 kg</strong></div></div>
              <div className="yield-table" role="table" aria-label="Automatic yield estimate">
                <div className="yield-row header" role="row"><span>CUT</span><span>BASE</span><span>EXPECTED</span><span>ACCEPTABLE RANGE</span></div>
                {estimates.map((item) => <div className="yield-row" role="row" key={item.name}><strong>{item.name}</strong><span>{item.percent.toFixed(1)}%</span><b>{kg(item.expected)}</b><span>{kg(item.low)} – {kg(item.high)}</span></div>)}
              </div>
              <footer><span>Projected retail value</span><strong>{money(retailValue)}</strong></footer>
            </section>
          </div>

          <section className="panel recent-panel">
            <div className="panel-head"><div><small>TRACEABILITY</small><h2>Recent automatic allocations</h2></div><button>View cooler inventory →</button></div>
            <div className="batch-table">
              {batches.slice(0, 3).map((batch) => <article key={batch.id}><span className="batch-icon">KG</span><div><strong>{batch.id}</strong><small>{batch.supplier}</small></div><div><small>MEAT TYPE</small><b>{batch.type}</b></div><div><small>SCALE WEIGHT</small><b>{kg(batch.weight, 1)}</b></div><div><small>ALLOCATION</small><b className="green">Automatic ±2%</b></div><time>{batch.date}</time></article>)}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
