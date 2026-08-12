"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type Yield = { name: string; percent: number; price: number };
type Batch = { id: string; supplier: string; type: string; weight: number; date: string };
type StockProduct = { id?: number; sku: string; barcode: string; name: string; department: string; unit: string; costPrice: number; sellingPrice: number; quantity: number };

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
            ["Overview", "01"], ["Receiving", "02"], ["Stock master", "03"], ["Cooler inventory", "04"], ["Butcher counter", "05"], ["POS", "06"],
          ].map(([name, number]) => <button key={name} className={section === name ? "active" : ""} onClick={() => setSection(name)}><span>{number}</span>{name}</button>)}
          <p>CONTROL</p>
          {["Stock count", "Waste & loss", "Reports", "Settings"].map((name, i) => <button key={name} className={section === name ? "active" : ""} onClick={() => setSection(name)}><span>{i + 7}</span>{name}</button>)}
        </nav>
        <div className="operator"><span>NM</span><div><strong>Naledi Mokoena</strong><small>Warehouse operator</small></div></div>
      </aside>

      <main>
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open menu">☰</button>
          <div><span className="live-dot" /> LEDGER ONLINE</div>
          <div className="shift">WED 12 AUG · MORNING SHIFT</div>
        </header>

        {section === "Stock master" ? <StockMaster /> : <div className="content">
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
        </div>}
      </main>
    </div>
  );
}

const DEPARTMENT_RULES: Array<[string, string[]]> = [
  ["Chicken", ["chicken", "hoender", "wing", "drumstick", "poultry"]],
  ["Lamb", ["lamb", "lam", "skaap", "mutton"]],
  ["Game", ["venison", "game", "wild", "wildsvleis", "springbok", "kudu", "impala"]],
  ["Cold Drinks", ["coke", "cola", "sprite", "fanta", "drink", "koeldrank", "koel drank", "juice", "water", "energy"]],
  ["Bakery", ["bread", "roll", "bun", "cake", "pie", "bakery"]],
  ["Takeaways", ["takeaway", "wegneem", "burger", "chips", "meal", "cooked"]],
  ["Biltong / Deli", ["biltong", "droewors", "deli", "salami", "ham"]],
  ["Beef", ["beef", "bees", "beesvleis", "rump", "t-bone", "steak", "brisket", "chuck", "fillet", "mince"]],
  ["Groceries", ["grocery", "spice", "sauce", "tin", "oil", "flour", "sugar"]],
];

function detectDepartment(name: string, supplied: string, valid: string[]) {
  const direct = valid.find((department) => department.toLowerCase() === supplied.trim().toLowerCase());
  if (direct) return direct;
  const haystack = `${name} ${supplied}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/\bplate\s*[1-7]\b/.test(haystack)) return "Takeaways";
  return DEPARTMENT_RULES.find(([, terms]) => terms.some((term) => haystack.includes(term)))?.[0] ?? "Unmapped";
}

function parseCsvLine(line: string) {
  const cells: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') { cell += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { cells.push(cell.trim()); cell = ""; }
    else cell += char;
  }
  cells.push(cell.trim()); return cells;
}

function StockMaster() {
  const defaults = ["Beef", "Chicken", "Lamb", "Game", "Groceries", "Cold Drinks", "Bakery", "Takeaways", "Biltong / Deli", "Unmapped"];
  const [departments, setDepartments] = useState(defaults);
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [preview, setPreview] = useState<StockProduct[]>([]);
  const [message, setMessage] = useState("Loading the stock register…");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All departments");
  const [newDepartment, setNewDepartment] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function loadStock() {
    try {
      const response = await fetch("/api/stock"); const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setDepartments(data.departments.map((item: { name: string }) => item.name));
      setProducts(data.products); setMessage(`${data.products.length} products in the stock master`);
    } catch { setMessage("Stock database is preparing. Refresh once the deployment is complete."); }
  }
  useEffect(() => { void loadStock(); }, []);

  async function readStockFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    const text = await file.text(); const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) { setMessage("The CSV file has no product rows."); return; }
    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const find = (...names: string[]) => headers.findIndex((header) => names.includes(header));
    const indexes = { sku: find("sku", "stockcode", "code", "productcode"), barcode: find("barcode", "ean", "plu"), name: find("name", "description", "product", "stockdescription"), department: find("department", "category", "group"), unit: find("unit", "uom", "measure"), cost: find("cost", "costprice", "averagecost"), price: find("price", "sellingprice", "retailprice"), quantity: find("quantity", "qty", "stockonhand", "onhand") };
    if (indexes.name < 0) { setMessage("Could not find a Product, Name or Description column."); return; }
    const value = (cells: string[], index: number) => index >= 0 ? cells[index] ?? "" : "";
    const rows = lines.slice(1).map((line, row) => { const cells = parseCsvLine(line); const name = value(cells, indexes.name); const supplied = value(cells, indexes.department); return { sku: value(cells, indexes.sku) || `IMPORT-${row + 1}`, barcode: value(cells, indexes.barcode), name, department: detectDepartment(name, supplied, departments), unit: value(cells, indexes.unit) || "each", costPrice: Number(value(cells, indexes.cost).replace(/[^0-9.-]/g, "")) || 0, sellingPrice: Number(value(cells, indexes.price).replace(/[^0-9.-]/g, "")) || 0, quantity: Number(value(cells, indexes.quantity).replace(/[^0-9.-]/g, "")) || 0 }; }).filter((row) => row.name);
    setPreview(rows); setMessage(`${rows.length} products ready to import; ${rows.filter((row) => row.department === "Unmapped").length} need a department review.`);
  }

  async function importProducts() {
    const response = await fetch("/api/stock", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows: preview }) });
    const data = await response.json(); if (!response.ok) { setMessage(data.error); return; }
    setPreview([]); setMessage(`${data.imported} products imported successfully.`); await loadStock();
  }

  async function createDepartment() {
    const name = newDepartment.trim(); if (!name) return;
    const response = await fetch("/api/stock", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "department", name }) });
    if (response.ok) { setNewDepartment(""); await loadStock(); setMessage(`${name} department created.`); }
  }

  const visible = products.filter((product) => (filter === "All departments" || product.department === filter) && `${product.sku} ${product.barcode} ${product.name}`.toLowerCase().includes(search.toLowerCase()));
  const shown = preview.length ? preview : visible;

  return <div className="content stock-master">
    <div className="eyebrow">STOCK SYSTEM / MASTER DATA</div>
    <div className="page-heading"><div><h1>Your complete stock list, organised.</h1><p>Import the current system once, then manage every product inside its operating department.</p></div><span className="status-pill">{departments.length - 1} DEPARTMENTS</span></div>
    <section className="department-grid">{departments.filter((name) => name !== "Unmapped").map((name) => <button key={name} onClick={() => setFilter(name)} className={filter === name ? "selected" : ""}><small>DEPARTMENT</small><strong>{name}</strong><span>{products.filter((p) => p.department === name).length} products</span></button>)}</section>
    <div className="stock-actions">
      <section className="panel import-card"><div className="panel-head"><div><small>BULK SETUP</small><h2>Upload current stock list</h2></div><span>CSV · up to 5,000 rows</span></div><div className="import-body"><input ref={inputRef} type="file" accept=".csv,text/csv" onChange={readStockFile} hidden /><button className="upload-zone" onClick={() => inputRef.current?.click()}><b>↑</b><strong>Choose stock-list CSV</strong><span>Recognises stock code, barcode, description, department, unit, cost, selling price and quantity.</span></button>{preview.length > 0 && <button className="primary-action import-button" onClick={importProducts}>Import {preview.length} products <span>→</span></button>}</div></section>
      <section className="panel create-dept"><div className="panel-head"><div><small>STRUCTURE</small><h2>Create department</h2></div></div><div><label>Department name<input placeholder="e.g. Frozen Foods" value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)} /></label><button onClick={createDepartment}>Add department</button><p>New departments become available for imported and manually created products.</p></div></section>
    </div>
    <section className="panel stock-register"><div className="panel-head"><div><small>{preview.length ? "IMPORT PREVIEW" : "PRODUCT REGISTER"}</small><h2>{preview.length ? "Check department matching" : "All stock items"}</h2></div><span>{message}</span></div>
      <div className="stock-toolbar"><input placeholder="Search code, barcode or product…" value={search} onChange={(e) => setSearch(e.target.value)} /><select value={filter} onChange={(e) => setFilter(e.target.value)}><option>All departments</option>{departments.map((name) => <option key={name}>{name}</option>)}</select>{preview.length > 0 && <button onClick={() => setPreview([])}>Cancel preview</button>}</div>
      <div className="product-table"><div className="product-row header"><span>STOCK CODE</span><span>PRODUCT</span><span>DEPARTMENT</span><span>UNIT</span><span>ON HAND</span><span>SELLING PRICE</span></div>{shown.slice(0, 200).map((product, index) => <div className={`product-row ${product.department === "Unmapped" ? "unmapped" : ""}`} key={`${product.sku}-${index}`}><b>{product.sku}</b><strong>{product.name}</strong><span>{product.department}</span><span>{product.unit}</span><span>{product.quantity}</span><span>{money(product.sellingPrice)}</span></div>)}{!shown.length && <div className="empty-stock">No products to show. Upload your current stock-list CSV to begin.</div>}</div>
    </section>
  </div>;
}
