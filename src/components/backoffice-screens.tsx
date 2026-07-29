"use client";

import {
  AlertTriangle, Check, ClipboardCheck, Download, FileSpreadsheet, PackagePlus,
  Plus, Save, ShieldCheck, ShoppingCart, Thermometer, Upload, Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  type BlockTestProfile, type InventoryItem, type RetailProduct, type StaffUser,
  type Supplier, useOperations,
} from "@/components/operations-store";
import {
  createCsv, csvTemplates, previewCsv, type CsvPreview, type ImportDataset, type ImportMode,
} from "@/lib/csv";
import { kg, zar } from "@/lib/utils";

const card = "rounded-xl border border-[#322a2a] bg-[#141111]/95 metric-glow";
const input = "h-11 w-full rounded-lg border border-[#433637] bg-[#0d0b0b] px-3 text-sm text-[#edf2f5] outline-none focus:border-[#d93a3e] focus:ring-2 focus:ring-[#d93a3e]/15";
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#f4f0ed] px-4 text-sm font-semibold text-[#171010] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40";
const subtleButton = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#35404a] bg-[#1a1515] px-3 text-xs font-semibold text-[#b9c4cb] transition hover:border-[#6f393c] hover:text-white disabled:opacity-40";
const label = "text-[10px] font-semibold uppercase tracking-[.15em] text-[#6f7a84]";

function Title({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div><p className={`${label} mb-2 text-[#ef5b5e]`}>{eyebrow}</p><h1 className="text-2xl font-semibold tracking-tight sm:text-[30px]">{title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[#818c95]">{copy}</p></div>{action}
  </div>;
}

function Field({ name, children }: { name: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-medium text-[#a4adb4]">{name}</span>{children}</label>;
}

function Badge({ children, tone = "gray" }: { children: React.ReactNode; tone?: "green" | "amber" | "red" | "gray" | "blue" }) {
  const tones = {
    green: "border-[#28533e] bg-[#10291f] text-[#5fc78f]", amber: "border-[#5f4820] bg-[#2c210d] text-[#e0aa4b]",
    red: "border-[#613037] bg-[#2f1519] text-[#e87980]", gray: "border-[#4a3a3b] bg-[#1a1e22] text-[#a0a8af]",
    blue: "border-[#713033] bg-[#2a1517] text-[#ff7779]",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.09em] ${tones[tone]}`}>{children}</span>;
}

function download(filename: string, contents: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function BackOfficeDashboard() {
  const { inventory, retailProducts, suppliers, purchaseOrders, foodSafetyChecks, importBatches, staffUsers } = useOperations();
  const weightedLow = inventory.filter((item) => item.active && item.physical - item.reserved <= item.reorderLevelKg);
  const retailLow = retailProducts.filter((item) => item.active && item.stockUnits <= item.reorderLevelUnits);
  const openOrders = purchaseOrders.filter((item) => item.status === "Draft" || item.status === "Ordered");
  const safetyActions = foodSafetyChecks.filter((item) => item.status === "Action required");
  const controls = [
    { name: "CSV data import", copy: "Validate and preview products, barcodes, prices and suppliers before posting.", href: "/backoffice/import", icon: FileSpreadsheet, detail: `${importBatches.length} imports` },
    { name: "Purchasing", copy: "Create purchase orders, track due deliveries and hand them into Cooler receiving.", href: "/backoffice/purchases", icon: ShoppingCart, detail: `${openOrders.length} open` },
    { name: "Food safety", copy: "Log cooler temperatures and corrective actions with a time-stamped record.", href: "/backoffice/food-safety", icon: Thermometer, detail: safetyActions.length ? `${safetyActions.length} action` : "In range" },
    { name: "Products & pricing", copy: "Maintain weighted cuts, scale PLUs, retail barcodes, margins and reorder points.", href: "/settings/products", icon: PackagePlus, detail: `${inventory.length + retailProducts.length} products` },
    { name: "Suppliers", copy: "Keep ordering contacts, payment terms and active supplier records in one place.", href: "/settings/suppliers", icon: Users, detail: `${suppliers.filter((item) => item.active).length} active` },
    { name: "Roles & profiles", copy: "Control staff roles and the active theoretical block-test yield.", href: "/settings/users", icon: ShieldCheck, detail: `${staffUsers.filter((item) => item.active).length} staff` },
  ];
  return <>
    <Title eyebrow="Back Office" title="Operating control centre" copy="The master data and daily control layer behind Cooler, Butcher, POS and Management." action={<Link href="/backoffice/import" className={button}><Upload size={16}/> Import CSV</Link>}/>
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Low-stock products", String(weightedLow.length + retailLow.length), "Across weighted and retail stock", weightedLow.length + retailLow.length ? "amber" : "green"],
        ["Open purchase orders", String(openOrders.length), openOrders.reduce((sum, order) => sum + order.subtotal, 0) ? zar.format(openOrders.reduce((sum, order) => sum + order.subtotal, 0)) : "Nothing outstanding", "blue"],
        ["Food-safety actions", String(safetyActions.length), "Out-of-range checks", safetyActions.length ? "red" : "green"],
        ["Active suppliers", String(suppliers.filter((item) => item.active).length), "Available at receiving", "green"],
      ].map(([name, value, detail, tone]) => <div key={name} className={`${card} p-4`}><p className={label}>{name}</p><p className="mt-4 text-3xl font-semibold">{value}</p><div className="mt-2"><Badge tone={tone as "green" | "amber" | "red" | "blue"}>{detail}</Badge></div></div>)}
    </div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {controls.map(({ name, copy, href, icon: Icon, detail }) => <Link href={href} key={name} className={`${card} group p-5 transition hover:border-[#603236]`}>
        <div className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-lg border border-[#6d3033] bg-[#241416] text-[#f37a7c]"><Icon size={19}/></span><span className="text-[11px] text-[#6f7a84]">{detail}</span></div>
        <h2 className="mt-5 text-sm font-semibold group-hover:text-[#ffabad]">{name}</h2><p className="mt-2 text-xs leading-5 text-[#7d8891]">{copy}</p>
      </Link>)}
    </div>
  </>;
}

const datasetLabels: Record<ImportDataset, string> = {
  "weighted-products": "Weighted products",
  "retail-products": "Retail products",
  suppliers: "Suppliers",
};

export function CsvImportScreen() {
  const { importCsv, importBatches, inventory, retailProducts, suppliers } = useOperations();
  const [dataset, setDataset] = useState<ImportDataset>("weighted-products");
  const [mode, setMode] = useState<ImportMode>("upsert");
  const [filename, setFilename] = useState("");
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [message, setMessage] = useState("");
  const errorCount = (preview?.errors.length ?? 0) + (preview?.rows.reduce((sum, row) => sum + row.errors.length, 0) ?? 0);
  const warningCount = preview?.rows.reduce((sum, row) => sum + row.warnings.length, 0) ?? 0;

  function loadText(text: string, name: string) {
    setFilename(name);
    setPreview(previewCsv(dataset, text));
    setMessage("");
  }

  function exportCurrent() {
    if (dataset === "weighted-products") {
      download("butchery-os-weighted-products.csv", createCsv(
        ["product", "category", "scale_plu", "cost_per_kg", "selling_price_per_kg", "reorder_level_kg", "opening_stock_kg", "active"],
        inventory.map((item) => [item.product, item.category, item.scalePlu, item.cost, item.price, item.reorderLevelKg, item.physical, item.active]),
      ));
    } else if (dataset === "retail-products") {
      download("butchery-os-retail-products.csv", createCsv(
        ["sku", "name", "barcode", "category", "cost_per_unit", "selling_price_per_unit", "reorder_level_units", "opening_stock_units", "active"],
        retailProducts.map((item) => [item.sku, item.name, item.barcode, item.category, item.cost, item.price, item.reorderLevelUnits, item.stockUnits, item.active]),
      ));
    } else {
      download("butchery-os-suppliers.csv", createCsv(
        ["supplier_code", "name", "contact_person", "phone", "email", "payment_terms_days", "active"],
        suppliers.map((item) => [item.code, item.name, item.contactPerson, item.phone, item.email, item.paymentTermsDays, item.active]),
      ));
    }
  }

  function applyImport() {
    if (!preview || errorCount) return;
    try {
      const result = importCsv(dataset, preview.rows, filename || "pasted-data.csv", mode);
      setMessage(`${result.number}: ${result.createdCount} created, ${result.updatedCount} updated, ${result.skippedCount} skipped.`);
      setPreview(null);
      setFilename("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed");
    }
  }

  return <>
    <Title eyebrow="Back Office / data" title="CSV import & export" copy="Bring product, barcode, price and supplier lists into Butchery OS with a validation checkpoint before anything changes."/>
    <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
      <div className={`${card} h-fit p-5`}>
        <p className={label}>1 · Choose data type</p>
        <div className="mt-3 grid gap-2">{(Object.keys(datasetLabels) as ImportDataset[]).map((key) => <button key={key} onClick={() => { setDataset(key); setPreview(null); setFilename(""); }} className={`rounded-lg border p-3 text-left text-sm ${dataset === key ? "border-[#84383b] bg-[#2a1618] text-[#ffabad]" : "border-[#382d2e] bg-[#100d0d] text-[#8f9aa3]"}`}>{datasetLabels[key]}</button>)}</div>
        <p className={`${label} mt-6`}>2 · Get the correct columns</p>
        <div className="mt-3 grid gap-2">
          <button className={subtleButton} onClick={() => download(`${dataset}-template.csv`, csvTemplates[dataset])}><Download size={14}/> Download blank template</button>
          <button className={subtleButton} onClick={exportCurrent}><Download size={14}/> Export current data</button>
        </div>
        <p className={`${label} mt-6`}>3 · Duplicate handling</p>
        <select className={`${input} mt-3`} value={mode} onChange={(event) => setMode(event.target.value as ImportMode)}>
          <option value="upsert">Update matching + add new</option>
          <option value="add-only">Add new only; skip matches</option>
        </select>
        <div className="mt-5 rounded-lg border border-[#3d3627] bg-[#221b0e] p-3 text-xs leading-5 text-[#c9a55e]">Matching uses scale PLU/product, SKU/barcode or supplier code. Existing sales and batch history are never rewritten.</div>
      </div>
      <div className={`${card} overflow-hidden`}>
        <div className="border-b border-[#322a2a] p-5">
          <p className={label}>4 · Select and validate file</p>
          <label className="mt-4 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#5f3538] bg-[#0d0b0b] p-6 text-center transition hover:border-[#874044]">
            <Upload size={24} className="text-[#f06a6d]"/><span className="mt-3 text-sm font-semibold">{filename || `Choose ${datasetLabels[dataset]} CSV`}</span><span className="mt-1 text-xs text-[#707c85]">CSV only · data is previewed before import</span>
            <input className="sr-only" type="file" accept=".csv,text/csv" onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (!file.name.toLowerCase().endsWith(".csv")) return setMessage("Choose a .csv file");
              loadText(await file.text(), file.name);
              event.target.value = "";
            }}/>
          </label>
          <details className="mt-3"><summary className="cursor-pointer text-xs text-[#ef6f72]">Or paste CSV text</summary><textarea aria-label="Paste CSV text" className={`${input} mt-3 min-h-28 py-3 font-mono text-xs`} placeholder={csvTemplates[dataset]} onBlur={(event) => event.target.value.trim() && loadText(event.target.value, "pasted-data.csv")}/></details>
        </div>
        {preview ? <>
          <div className="flex flex-wrap items-center gap-2 border-b border-[#322a2a] p-4">
            <Badge tone={errorCount ? "red" : "green"}>{errorCount ? `${errorCount} errors` : `${preview.rows.length} rows valid`}</Badge>
            {warningCount > 0 && <Badge tone="amber">{warningCount} warnings</Badge>}
            <span className="ml-auto text-xs text-[#75818a]">Previewing first 100 rows</span>
          </div>
          {preview.errors.length > 0 && <div className="border-b border-[#4e292e] bg-[#281317] p-4 text-xs text-[#ee8a90]">{preview.errors.join(" · ")}</div>}
          <div className="scrollbar max-h-[440px] overflow-auto"><table className="min-w-full text-left text-xs"><thead className="sticky top-0 bg-[#141111]"><tr className="border-b border-[#322a2a]"><th className="px-4 py-3">Row</th>{preview.headers.map((header) => <th key={header} className="whitespace-nowrap px-4 py-3 font-medium text-[#7c8790]">{header}</th>)}<th className="px-4 py-3">Validation</th></tr></thead><tbody>
            {preview.rows.slice(0, 100).map((row) => <tr key={row.rowNumber} className="border-b border-[#292222]"><td className="px-4 py-3 font-mono text-[#78838c]">{row.rowNumber}</td>{preview.headers.map((header) => <td key={header} className="max-w-56 truncate px-4 py-3">{row.values[header] || "—"}</td>)}<td className="min-w-56 px-4 py-3">{row.errors.length ? <span className="text-[#e97a82]">{row.errors.join("; ")}</span> : row.warnings.length ? <span className="text-[#dfac53]">{row.warnings.join("; ")}</span> : <span className="text-[#60c990]">Ready</span>}</td></tr>)}
          </tbody></table></div>
          <div className="flex items-center justify-between gap-4 border-t border-[#322a2a] p-5"><p className="text-xs text-[#77828b]">{errorCount ? "Fix the source file and select it again." : "This creates an audit record and preserves transaction history."}</p><button disabled={Boolean(errorCount)} className={button} onClick={applyImport}><Check size={16}/> Apply import</button></div>
        </> : <div className="grid min-h-72 place-items-center p-8 text-center text-sm text-[#69747e]"><div><FileSpreadsheet className="mx-auto mb-3" size={30}/><p>Select a CSV to see its validation preview here.</p></div></div>}
        {message && <div className="border-t border-[#315141] bg-[#11241b] p-4 text-sm text-[#6fd09a]">{message}</div>}
      </div>
    </div>
    {importBatches.length > 0 && <div className={`${card} mt-4 overflow-hidden`}><div className="border-b border-[#322a2a] p-5"><h2 className="text-sm font-semibold">Import history</h2></div><div className="scrollbar overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead><tr className="border-b border-[#322a2a] text-[#6f7a84]">{["Import","Date","File","Dataset","Rows","Result","User"].map((item) => <th key={item} className="px-5 py-3 font-medium">{item}</th>)}</tr></thead><tbody>{importBatches.map((item) => <tr key={item.id} className="border-b border-[#292222] last:border-0"><td className="px-5 py-4 font-mono">{item.number}</td><td className="px-5 py-4">{new Date(item.createdAt).toLocaleString("en-ZA")}</td><td className="px-5 py-4">{item.filename}</td><td className="px-5 py-4">{datasetLabels[item.dataset]}</td><td className="px-5 py-4">{item.rowCount}</td><td className="px-5 py-4 text-[#70c99a]">{item.createdCount} added · {item.updatedCount} updated · {item.skippedCount} skipped</td><td className="px-5 py-4">{item.importedBy}</td></tr>)}</tbody></table></div></div>}
  </>;
}

function emptyInventory(): InventoryItem {
  return { id: crypto.randomUUID(), product: "", category: "Beef cuts", scalePlu: "", cost: 0, price: 0, reorderLevelKg: 15, physical: 0, reserved: 0, movement: "New", active: true };
}
function emptyRetail(): RetailProduct {
  return { id: crypto.randomUUID(), sku: "", name: "", barcode: "", category: "General retail", cost: 0, price: 0, reorderLevelUnits: 10, stockUnits: 0, active: true };
}

export function ProductsSettingsScreen() {
  const { inventory, retailProducts, saveInventoryProduct, saveRetailProduct } = useOperations();
  const [tab, setTab] = useState<"weighted" | "retail">("weighted");
  const [weighted, setWeighted] = useState<InventoryItem>(emptyInventory);
  const [retail, setRetail] = useState<RetailProduct>(emptyRetail);
  const [message, setMessage] = useState("");
  function save() {
    try {
      if (tab === "weighted") saveInventoryProduct(weighted);
      else saveRetailProduct(retail);
      setMessage("Product saved. New POS and butcher transactions will use these settings.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save product"); }
  }
  return <>
    <Title eyebrow="Settings / catalogue" title="Products, prices & barcodes" copy="Maintain the master product list used by scale labels, butcher tickets, POS checkout, stock control and profitability." action={<Link href="/backoffice/import" className={subtleButton}><Upload size={14}/> Import CSV</Link>}/>
    <div className="mb-4 flex gap-2"><button className={tab === "weighted" ? button : subtleButton} onClick={() => setTab("weighted")}>Weighted products</button><button className={tab === "retail" ? button : subtleButton} onClick={() => setTab("retail")}>Retail barcodes</button></div>
    <div className="grid gap-4 xl:grid-cols-[1fr_370px]">
      <div className={`${card} overflow-hidden`}><div className="scrollbar overflow-x-auto"><table className="w-full min-w-[820px] text-left text-xs"><thead><tr className="border-b border-[#322a2a] text-[#707c85]">
        {(tab === "weighted" ? ["Product","PLU","Category","Stock","Reorder","Cost","Price","Margin","Status"] : ["Product","SKU","Barcode","Stock","Reorder","Cost","Price","Margin","Status"]).map((item) => <th key={item} className="px-4 py-3 font-medium">{item}</th>)}
      </tr></thead><tbody>{tab === "weighted" ? inventory.map((item) => <tr key={item.id} onClick={() => setWeighted({ ...item })} className="cursor-pointer border-b border-[#292222] hover:bg-[#171c20]"><td className="px-4 py-4 font-semibold">{item.product}</td><td className="px-4 py-4 font-mono">{item.scalePlu}</td><td className="px-4 py-4">{item.category}</td><td className="px-4 py-4">{kg(item.physical)}</td><td className="px-4 py-4">{kg(item.reorderLevelKg)}</td><td className="px-4 py-4">{zar.format(item.cost)}</td><td className="px-4 py-4">{zar.format(item.price)}</td><td className="px-4 py-4">{item.price ? ((item.price - item.cost) / item.price * 100).toFixed(1) : "0.0"}%</td><td className="px-4 py-4"><Badge tone={item.active ? "green" : "gray"}>{item.active ? "Active" : "Inactive"}</Badge></td></tr>) : retailProducts.map((item) => <tr key={item.id} onClick={() => setRetail({ ...item })} className="cursor-pointer border-b border-[#292222] hover:bg-[#171c20]"><td className="px-4 py-4 font-semibold">{item.name}</td><td className="px-4 py-4 font-mono">{item.sku}</td><td className="px-4 py-4 font-mono">{item.barcode}</td><td className="px-4 py-4">{item.stockUnits}</td><td className="px-4 py-4">{item.reorderLevelUnits}</td><td className="px-4 py-4">{zar.format(item.cost)}</td><td className="px-4 py-4">{zar.format(item.price)}</td><td className="px-4 py-4">{item.price ? ((item.price - item.cost) / item.price * 100).toFixed(1) : "0.0"}%</td><td className="px-4 py-4"><Badge tone={item.active ? "green" : "gray"}>{item.active ? "Active" : "Inactive"}</Badge></td></tr>)}</tbody></table></div></div>
      <div className={`${card} h-fit p-5`}>
        <div className="mb-5 flex items-center justify-between"><div><h2 className="text-sm font-semibold">{tab === "weighted" ? (weighted.product || "New weighted product") : (retail.name || "New retail product")}</h2><p className="mt-1 text-xs text-[#748089]">Select a row to edit it.</p></div><button className={subtleButton} onClick={() => tab === "weighted" ? setWeighted(emptyInventory()) : setRetail(emptyRetail())}><Plus size={14}/> New</button></div>
        {tab === "weighted" ? <div className="grid gap-4"><Field name="Product name"><input className={input} value={weighted.product} onChange={(event) => setWeighted({ ...weighted, product: event.target.value })}/></Field><div className="grid grid-cols-2 gap-3"><Field name="Scale PLU"><input className={input} inputMode="numeric" value={weighted.scalePlu} onChange={(event) => setWeighted({ ...weighted, scalePlu: event.target.value })}/></Field><Field name="Category"><input className={input} value={weighted.category} onChange={(event) => setWeighted({ ...weighted, category: event.target.value })}/></Field><Field name="Cost / kg"><input className={input} type="number" step=".01" value={weighted.cost} onChange={(event) => setWeighted({ ...weighted, cost: Number(event.target.value) })}/></Field><Field name="Selling price / kg"><input className={input} type="number" step=".01" value={weighted.price} onChange={(event) => setWeighted({ ...weighted, price: Number(event.target.value) })}/></Field><Field name="Reorder level kg"><input className={input} type="number" step=".1" value={weighted.reorderLevelKg} onChange={(event) => setWeighted({ ...weighted, reorderLevelKg: Number(event.target.value) })}/></Field><Field name="Physical kg"><input className={input} type="number" step=".001" value={weighted.physical} onChange={(event) => setWeighted({ ...weighted, physical: Number(event.target.value) })}/></Field></div><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={weighted.active} onChange={(event) => setWeighted({ ...weighted, active: event.target.checked })}/> Active for new transactions</label></div>
        : <div className="grid gap-4"><Field name="Product name"><input className={input} value={retail.name} onChange={(event) => setRetail({ ...retail, name: event.target.value })}/></Field><div className="grid grid-cols-2 gap-3"><Field name="SKU"><input className={input} value={retail.sku} onChange={(event) => setRetail({ ...retail, sku: event.target.value })}/></Field><Field name="Barcode"><input className={input} inputMode="numeric" value={retail.barcode} onChange={(event) => setRetail({ ...retail, barcode: event.target.value })}/></Field><Field name="Category"><input className={input} value={retail.category} onChange={(event) => setRetail({ ...retail, category: event.target.value })}/></Field><Field name="Stock units"><input className={input} type="number" value={retail.stockUnits} onChange={(event) => setRetail({ ...retail, stockUnits: Number(event.target.value) })}/></Field><Field name="Cost / unit"><input className={input} type="number" step=".01" value={retail.cost} onChange={(event) => setRetail({ ...retail, cost: Number(event.target.value) })}/></Field><Field name="Selling price"><input className={input} type="number" step=".01" value={retail.price} onChange={(event) => setRetail({ ...retail, price: Number(event.target.value) })}/></Field><Field name="Reorder units"><input className={input} type="number" value={retail.reorderLevelUnits} onChange={(event) => setRetail({ ...retail, reorderLevelUnits: Number(event.target.value) })}/></Field></div><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={retail.active} onChange={(event) => setRetail({ ...retail, active: event.target.checked })}/> Active at POS</label></div>}
        <button className={`${button} mt-5 w-full`} onClick={save}><Save size={15}/> Save product</button>{message && <p className="mt-3 text-xs text-[#75c99b]">{message}</p>}
      </div>
    </div>
  </>;
}

function emptySupplier(): Supplier {
  return { id: crypto.randomUUID(), code: "", name: "", contactPerson: "", phone: "", email: "", paymentTermsDays: 30, active: true };
}

export function SuppliersSettingsScreen() {
  const { suppliers, saveSupplier } = useOperations();
  const [form, setForm] = useState<Supplier>(emptySupplier);
  const [message, setMessage] = useState("");
  return <>
    <Title eyebrow="Settings / purchasing" title="Supplier directory" copy="Approved suppliers, contacts and payment terms. Active suppliers become available in purchase orders and Cooler receiving." action={<button className={button} onClick={() => setForm(emptySupplier())}><Plus size={15}/> New supplier</button>}/>
    <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <div className="grid gap-3 md:grid-cols-2">{suppliers.map((supplier) => <button onClick={() => setForm({ ...supplier })} key={supplier.id} className={`${card} p-5 text-left hover:border-[#613438]`}><div className="flex items-start justify-between"><div><p className="font-mono text-xs text-[#ef6f72]">{supplier.code}</p><h2 className="mt-2 text-sm font-semibold">{supplier.name}</h2></div><Badge tone={supplier.active ? "green" : "gray"}>{supplier.active ? "Active" : "Inactive"}</Badge></div><p className="mt-4 text-xs text-[#828d96]">{supplier.contactPerson || "No contact"} · {supplier.phone || "No phone"}</p><p className="mt-1 text-xs text-[#65717a]">{supplier.paymentTermsDays} day terms</p></button>)}</div>
      <div className={`${card} h-fit p-5`}><h2 className="mb-5 text-sm font-semibold">{form.name || "New supplier"}</h2><div className="grid gap-4"><div className="grid grid-cols-[110px_1fr] gap-3"><Field name="Code"><input className={input} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })}/></Field><Field name="Supplier name"><input className={input} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}/></Field></div><Field name="Contact person"><input className={input} value={form.contactPerson} onChange={(event) => setForm({ ...form, contactPerson: event.target.value })}/></Field><div className="grid grid-cols-2 gap-3"><Field name="Phone"><input className={input} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })}/></Field><Field name="Payment terms"><input className={input} type="number" value={form.paymentTermsDays} onChange={(event) => setForm({ ...form, paymentTermsDays: Number(event.target.value) })}/></Field></div><Field name="Email"><input className={input} type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })}/></Field><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })}/> Approved and active</label><button className={button} onClick={() => { try { saveSupplier(form); setMessage("Supplier saved."); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save"); } }}><Save size={15}/> Save supplier</button>{message && <p className="text-xs text-[#75c99b]">{message}</p>}</div></div>
    </div>
  </>;
}

export function PurchasingScreen() {
  const { suppliers, purchaseOrders, savePurchaseOrder, updatePurchaseOrderStatus } = useOperations();
  const activeSuppliers = suppliers.filter((item) => item.active);
  const [supplierId, setSupplierId] = useState(activeSuppliers[0]?.id ?? "");
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("Raw Beef");
  const [orderedKg, setOrderedKg] = useState(700);
  const [costPerKg, setCostPerKg] = useState(92);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  function create() {
    try {
      const order = savePurchaseOrder({ supplierId, deliveryDate, description, orderedKg, costPerKg, notes });
      setMessage(`${order.number} saved as draft.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create purchase order"); }
  }
  return <>
    <Title eyebrow="Back Office / purchasing" title="Purchase orders" copy="Plan supplier deliveries before they arrive. Ordering is separated from receiving so actual scale weight and supplier invoice can still be checked in Cooler." action={<Link href="/cooler/receive" className={subtleButton}>Go to receiving</Link>}/>
    <div className={`${card} mb-4 p-5`}><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6 xl:items-end"><Field name="Supplier"><select className={input} value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>{activeSuppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field name="Due date"><input className={input} type="date" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)}/></Field><Field name="Description"><input className={input} value={description} onChange={(event) => setDescription(event.target.value)}/></Field><Field name="Ordered kg"><input className={input} type="number" step=".1" value={orderedKg} onChange={(event) => setOrderedKg(Number(event.target.value))}/></Field><Field name="Expected cost / kg"><input className={input} type="number" step=".01" value={costPerKg} onChange={(event) => setCostPerKg(Number(event.target.value))}/></Field><button className={button} onClick={create}><Plus size={15}/> Create draft</button></div><Field name="Notes"><input className={`${input} mt-3`} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Delivery or quality instructions"/></Field>{message && <p className="mt-3 text-xs text-[#76c99c]">{message}</p>}</div>
    <div className={`${card} overflow-hidden`}><div className="scrollbar overflow-x-auto"><table className="w-full min-w-[920px] text-left text-xs"><thead><tr className="border-b border-[#322a2a] text-[#6f7a84]">{["PO","Supplier","Due","Description","Ordered","Expected total","Status","Action"].map((item) => <th key={item} className="px-5 py-3 font-medium">{item}</th>)}</tr></thead><tbody>{purchaseOrders.map((order) => <tr key={order.id} className="border-b border-[#292222] last:border-0"><td className="px-5 py-4 font-mono">{order.number}</td><td className="px-5 py-4 font-semibold">{order.supplier}</td><td className="px-5 py-4">{order.deliveryDate}</td><td className="px-5 py-4">{order.lines.map((line) => line.description).join(", ")}</td><td className="px-5 py-4">{kg(order.lines.reduce((sum, line) => sum + line.orderedKg, 0))}</td><td className="px-5 py-4">{zar.format(order.subtotal)}</td><td className="px-5 py-4"><Badge tone={order.status === "Ordered" ? "blue" : order.status === "Draft" ? "amber" : order.status === "Received" ? "green" : "gray"}>{order.status}</Badge></td><td className="px-5 py-4"><div className="flex gap-2">{order.status === "Draft" && <button className={subtleButton} onClick={() => updatePurchaseOrderStatus(order.id, "Ordered")}>Place order</button>}{order.status === "Ordered" && <Link className={subtleButton} href="/cooler/receive">Receive</Link>}{(order.status === "Draft" || order.status === "Ordered") && <button className={subtleButton} onClick={() => updatePurchaseOrderStatus(order.id, "Cancelled")}>Cancel</button>}</div></td></tr>)}</tbody></table></div></div>
  </>;
}

export function BlockTestProfilesScreen() {
  const { blockTestProfiles, saveBlockTestProfile } = useOperations();
  const [selected, setSelected] = useState<BlockTestProfile>({ ...(blockTestProfiles[0] ?? { id: crypto.randomUUID(), name: "New profile", active: false, lines: [], updatedAt: new Date().toISOString() }), lines: [...(blockTestProfiles[0]?.lines ?? [])] });
  const [message, setMessage] = useState("");
  const total = selected.lines.reduce((sum, item) => sum + item.percent, 0);
  return <>
    <Title eyebrow="Settings / production" title="Block-test profiles" copy="Configure theoretical yields used for new delivery batches. Historical batches keep the profile and percentages they were received with."/>
    <div className="grid gap-4 xl:grid-cols-[280px_1fr]"><div className={`${card} h-fit p-3`}>{blockTestProfiles.map((item) => <button key={item.id} onClick={() => setSelected({ ...item, lines: item.lines.map((line) => ({ ...line })) })} className={`mb-2 w-full rounded-lg border p-4 text-left ${selected.id === item.id ? "border-[#81383b] bg-[#2a1618]" : "border-[#382d2e] bg-[#0e1114]"}`}><div className="flex justify-between gap-3"><span className="text-sm font-semibold">{item.name}</span>{item.active && <Badge tone="green">Active</Badge>}</div><p className="mt-2 text-xs text-[#748089]">{item.lines.length} outputs · {item.lines.reduce((sum, line) => sum + line.percent, 0).toFixed(2)}%</p></button>)}</div>
      <div className={`${card} overflow-hidden`}><div className="flex flex-col gap-3 border-b border-[#322a2a] p-5 sm:flex-row sm:items-end"><Field name="Profile name"><input className={input} value={selected.name} onChange={(event) => setSelected({ ...selected, name: event.target.value })}/></Field><label className="mb-3 flex items-center gap-2 text-xs"><input type="checkbox" checked={selected.active} onChange={(event) => setSelected({ ...selected, active: event.target.checked })}/> Use for new batches</label><div className="ml-auto"><Badge tone={Math.abs(total - 100) <= .01 ? "green" : "red"}>{total.toFixed(2)}% total</Badge></div></div><table className="w-full text-left text-xs"><thead><tr className="border-b border-[#322a2a] text-[#6f7a84]"><th className="px-5 py-3">Output product</th><th className="px-5 py-3 text-right">Yield %</th></tr></thead><tbody>{selected.lines.map((line, index) => <tr key={line.productId} className="border-b border-[#292222]"><td className="px-5 py-3 font-medium">{line.product}</td><td className="px-5 py-2 text-right"><input aria-label={`${line.product} yield`} className="h-9 w-28 rounded-md border border-[#4c3a3c] bg-[#0b0e10] px-2 text-right font-mono outline-none" type="number" step=".01" value={line.percent} onChange={(event) => setSelected({ ...selected, lines: selected.lines.map((item, itemIndex) => itemIndex === index ? { ...item, percent: Number(event.target.value) } : item) })}/></td></tr>)}</tbody></table><div className="flex items-center justify-between gap-4 p-5"><p className="text-xs text-[#78838c]">A production profile must total exactly 100%.</p><button disabled={Math.abs(total - 100) > .01} className={button} onClick={() => { try { saveBlockTestProfile(selected); setMessage("Profile saved."); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save"); } }}><Save size={15}/> Save profile</button></div>{message && <p className="px-5 pb-5 text-xs text-[#72c897]">{message}</p>}</div></div>
  </>;
}

export function UsersSettingsScreen() {
  const { staffUsers, saveStaffUser } = useOperations();
  const [form, setForm] = useState<StaffUser>({ id: crypto.randomUUID(), name: "", role: "Cashier", active: true });
  const [message, setMessage] = useState("");
  return <>
    <Title eyebrow="Settings / access" title="Staff roles" copy="Maintain the people and operational roles used across Butchery OS. Role-aware login enforcement will be enabled when the shared database and authentication are connected." action={<button className={button} onClick={() => setForm({ id: crypto.randomUUID(), name: "", role: "Cashier", active: true })}><Plus size={15}/> Add staff</button>}/>
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]"><div className={`${card} overflow-hidden`}><table className="w-full text-left text-xs"><thead><tr className="border-b border-[#322a2a] text-[#6f7a84]"><th className="px-5 py-3">Name</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Status</th></tr></thead><tbody>{staffUsers.map((user) => <tr onClick={() => setForm({ ...user })} key={user.id} className="cursor-pointer border-b border-[#292222] hover:bg-[#171c20]"><td className="px-5 py-4 font-semibold">{user.name}</td><td className="px-5 py-4">{user.role}</td><td className="px-5 py-4"><Badge tone={user.active ? "green" : "gray"}>{user.active ? "Active" : "Inactive"}</Badge></td></tr>)}</tbody></table></div><div className={`${card} h-fit p-5`}><div className="grid gap-4"><Field name="Staff member"><input className={input} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}/></Field><Field name="Operational role"><select className={input} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as StaffUser["role"] })}>{["Manager","Warehouse","Butcher","Cashier"].map((role) => <option key={role}>{role}</option>)}</select></Field><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })}/> Active</label><button className={button} onClick={() => { try { saveStaffUser(form); setMessage("Staff record saved."); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save"); } }}><Save size={15}/> Save staff</button>{message && <p className="text-xs text-[#72c897]">{message}</p>}</div></div></div>
  </>;
}

export function FoodSafetyScreen() {
  const { foodSafetyChecks, recordFoodSafetyCheck } = useOperations();
  const [area, setArea] = useState("Main cooler");
  const [temperatureC, setTemperatureC] = useState(3);
  const [maximumC, setMaximumC] = useState(5);
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [message, setMessage] = useState("");
  const requiresAction = temperatureC > maximumC;
  return <>
    <Title eyebrow="Back Office / compliance" title="Food-safety checks" copy="Record actual temperature against your operating limit. Out-of-range checks cannot be saved without a corrective action."/>
    <div className={`${card} mb-4 p-5`}><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_.7fr_.7fr_2fr_auto] xl:items-end"><Field name="Area / equipment"><input className={input} value={area} onChange={(event) => setArea(event.target.value)}/></Field><Field name="Actual °C"><input className={input} type="number" step=".1" value={temperatureC} onChange={(event) => setTemperatureC(Number(event.target.value))}/></Field><Field name="Maximum °C"><input className={input} type="number" step=".1" value={maximumC} onChange={(event) => setMaximumC(Number(event.target.value))}/></Field><Field name={requiresAction ? "Corrective action required" : "Notes / corrective action"}><input className={input} value={correctiveAction} onChange={(event) => setCorrectiveAction(event.target.value)} placeholder={requiresAction ? "e.g. Quarantined stock and called technician" : "Optional"}/></Field><button className={button} onClick={() => { try { const result = recordFoodSafetyCheck({ area, temperatureC, maximumC, correctiveAction }); setMessage(`${result.number} saved: ${result.status}.`); setCorrectiveAction(""); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save check"); } }}><ClipboardCheck size={15}/> Record</button></div>{requiresAction && <div className="mt-4 flex gap-2 rounded-lg border border-[#5d3036] bg-[#2b1519] p-3 text-xs text-[#e67b82]"><AlertTriangle size={16}/> Actual temperature exceeds the selected limit. Record what was done before saving.</div>}{message && <p className="mt-3 text-xs text-[#72c897]">{message}</p>}</div>
    <div className={`${card} overflow-hidden`}><div className="scrollbar overflow-x-auto"><table className="w-full min-w-[780px] text-left text-xs"><thead><tr className="border-b border-[#322a2a] text-[#6f7a84]">{["Check","Date / time","Area","Actual","Limit","Status","Corrective action","Recorded by"].map((item) => <th key={item} className="px-5 py-3 font-medium">{item}</th>)}</tr></thead><tbody>{foodSafetyChecks.map((check) => <tr key={check.id} className="border-b border-[#292222] last:border-0"><td className="px-5 py-4 font-mono">{check.number}</td><td className="px-5 py-4">{new Date(check.createdAt).toLocaleString("en-ZA")}</td><td className="px-5 py-4 font-semibold">{check.area}</td><td className="px-5 py-4 font-mono">{check.temperatureC.toFixed(1)}°C</td><td className="px-5 py-4 font-mono">≤ {check.maximumC.toFixed(1)}°C</td><td className="px-5 py-4"><Badge tone={check.status === "Pass" ? "green" : "red"}>{check.status}</Badge></td><td className="px-5 py-4">{check.correctiveAction || "—"}</td><td className="px-5 py-4">{check.recordedBy}</td></tr>)}</tbody></table></div></div>
  </>;
}
