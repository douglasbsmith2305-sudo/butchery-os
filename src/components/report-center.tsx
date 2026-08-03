"use client";

import { BarChart3, Boxes, Download, FileSpreadsheet, Printer, Receipt, Scale, ShieldCheck, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { useOperations } from "@/components/operations-store";
import { buildSectionedCsv, downloadCsv, type ReportTable } from "@/lib/reports";
import { kg, zar } from "@/lib/utils";

const card = "rounded-xl border border-[#3a3030] bg-[#151212]";
const label = "text-[10px] font-semibold uppercase tracking-[.14em] text-[#938787]";
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition";

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
}

function Metric({ icon: Icon, name, value, detail }: { icon: typeof Boxes; name: string; value: string; detail: string }) {
  return <div className={`${card} p-5`}>
    <div className="flex items-start justify-between"><p className={label}>{name}</p><Icon className="text-[#ef5b5e]" size={18}/></div>
    <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
    <p className="mt-1 text-xs text-[#918686]">{detail}</p>
  </div>;
}

function Bar({ name, value, max, display }: { name: string; value: number; max: number; display: string }) {
  return <div>
    <div className="mb-2 flex items-center justify-between gap-4 text-xs"><span className="truncate text-[#c9bebe]">{name}</span><strong className="shrink-0 font-mono">{display}</strong></div>
    <div className="h-3 overflow-hidden rounded-full bg-[#2a2323]"><div className="h-full min-w-1 rounded-full bg-gradient-to-r from-[#9f2227] to-[#ef5b5e]" style={{ width: `${Math.max(2, value / Math.max(max, 1) * 100)}%` }}/></div>
  </div>;
}

export function ReportCenter() {
  const operations = useOperations();
  const [message, setMessage] = useState("");
  const completedSales = operations.sales.filter((sale) => sale.status === "Completed");
  const revenue = completedSales.reduce((sum, sale) => sum + sale.revenue, 0);
  const profit = completedSales.reduce((sum, sale) => sum + sale.grossProfit, 0);
  const stockKg = operations.inventory.reduce((sum, item) => sum + item.physical, 0);
  const stockValue = operations.inventory.reduce((sum, item) => sum + item.physical * item.cost, 0);
  const wasteKg = operations.waste.reduce((sum, item) => sum + item.weightKg, 0);
  const wasteValue = operations.waste.reduce((sum, item) => sum + item.costValue, 0);

  const inventoryChart = useMemo(() => operations.inventory
    .map((item) => ({ name: item.product, value: item.physical * item.cost }))
    .toSorted((a, b) => b.value - a.value)
    .slice(0, 6), [operations.inventory]);
  const maxInventoryValue = Math.max(1, ...inventoryChart.map((item) => item.value));

  const activityChart = [
    { name: "Received", value: operations.coolerBatches.reduce((sum, item) => sum + item.receivedKg, 0) },
    { name: "Processed", value: operations.processingRuns.reduce((sum, item) => sum + item.inputKg, 0) },
    { name: "Sold", value: completedSales.reduce((sum, item) => sum + item.totalKg, 0) },
    { name: "Waste", value: wasteKg },
  ];
  const maxActivity = Math.max(1, ...activityChart.map((item) => item.value));

  const tables: ReportTable[] = (() => {
    const summary: ReportTable = { title: "1. Business overview", headers: ["Measure", "Value", "Unit"], rows: [
      ["Stock on hand", stockKg.toFixed(3), "kg"], ["Stock value at cost", stockValue.toFixed(2), "ZAR"],
      ["Completed sales revenue", revenue.toFixed(2), "ZAR"], ["Gross profit", profit.toFixed(2), "ZAR"],
      ["Recorded waste", wasteKg.toFixed(3), "kg"], ["Waste value", wasteValue.toFixed(2), "ZAR"],
      ["Open butcher orders", operations.tickets.filter((item) => item.status === "Open" || item.status === "Awaiting payment").length, "orders"],
      ["Unprocessed raw stock", operations.coolerBatches.reduce((sum, item) => sum + item.remainingRawKg, 0).toFixed(3), "kg"],
    ] };
    const inventory: ReportTable = { title: "2. Inventory", headers: ["Product ID", "Product", "Category", "Physical kg", "Reserved kg", "Available kg", "Cost per kg", "Selling price per kg", "Stock value", "Scale PLU", "Reorder level kg", "Active"], rows: operations.inventory.map((item) => [item.id, item.product, item.category, item.physical, item.reserved, item.physical - item.reserved, item.cost, item.price, item.physical * item.cost, item.scalePlu, item.reorderLevelKg, item.active]) };
    const batches: ReportTable = { title: "3. Supplier deliveries and batches", headers: ["Batch", "Supplier", "Invoice", "Delivery date", "Meat type", "Units", "Invoice kg", "Received kg", "Cost per kg", "Total cost", "Raw kg remaining", "Status", "Profile", "Received by", "Notes"], rows: operations.coolerBatches.map((item) => [item.code, item.supplier, item.invoiceNumber, item.deliveryDate, item.meatType, item.unitCount, item.invoiceWeightKg, item.receivedKg, item.costPerKg, item.totalCost, item.remainingRawKg, item.status, item.profileName, item.receivedBy, item.notes]) };
    const batchYields: ReportTable = { title: "4. Batch yields", headers: ["Batch", "Product", "Profile percent", "Expected kg", "Actual kg", "Variance kg"], rows: operations.coolerBatches.flatMap((batch) => batch.yields.map((item) => [batch.code, item.product, item.percent, item.expectedKg, item.actualKg, item.actualKg - item.expectedKg])) };
    const processing: ReportTable = { title: "5. Processing runs", headers: ["Run", "Batch", "Input kg", "Output kg", "Loss kg", "Loss reason", "Completed by", "Completed at"], rows: operations.processingRuns.map((item) => [item.number, item.batchCode, item.inputKg, item.outputKg, item.lossKg, item.lossReason, item.completedBy, formatDate(item.completedAt)]) };
    const tickets: ReportTable = { title: "6. Butcher orders", headers: ["Ticket", "Customer", "Butcher", "Status", "Total kg", "Total value", "Created at", "Cancellation reason"], rows: operations.tickets.map((item) => [item.number, item.customer, item.butcher, item.status, item.totalKg, item.total, formatDate(item.createdAt), item.cancellationReason]) };
    const ticketLines: ReportTable = { title: "7. Butcher order items", headers: ["Ticket", "Product", "Weight kg", "Price per kg", "Line total"], rows: operations.tickets.flatMap((ticket) => ticket.items.map((item) => [ticket.number, item.product, item.weightKg, item.pricePerKg, item.lineTotal])) };
    const sales: ReportTable = { title: "8. POS sales", headers: ["Sale", "Receipt", "Status", "Customer", "Cashier", "Revenue", "Cost of goods", "Gross profit", "Gross margin percent", "Meat kg", "Retail units", "Created at", "Refund reason"], rows: operations.sales.map((item) => [item.number, item.receiptNumber, item.status, item.customer, item.cashier, item.revenue, item.costOfGoods, item.grossProfit, item.grossMargin, item.totalKg, item.totalUnits, formatDate(item.createdAt), item.refundReason]) };
    const saleLines: ReportTable = { title: "9. POS sale items", headers: ["Sale", "Source", "Product", "Barcode", "Ticket", "Weight kg", "Quantity", "Unit price", "Line total", "Cost of goods"], rows: operations.sales.flatMap((sale) => sale.items.map((item) => [sale.number, item.source, item.product, item.barcode, item.ticketNumber, item.weightKg, item.quantity, item.unitPrice, item.lineTotal, item.costOfGoods])) };
    const payments: ReportTable = { title: "10. Payments", headers: ["Sale", "Receipt", "Method", "Amount"], rows: operations.sales.flatMap((sale) => sale.payments.map((item) => [sale.number, sale.receiptNumber, item.method, item.amount])) };
    const till: ReportTable = { title: "11. Till sessions", headers: ["Session", "Status", "Cashier", "Opening float", "Expected cash", "Closing count", "Variance", "Opened at", "Closed at"], rows: operations.tillSessions.map((item) => [item.number, item.status, item.cashier, item.openingFloat, item.expectedCash, item.closingCount, item.variance, formatDate(item.openedAt), item.closedAt ? formatDate(item.closedAt) : ""]) };
    const waste: ReportTable = { title: "12. Waste", headers: ["Record", "Product", "Weight kg", "Cost value", "Reason", "Notes", "Recorded by", "Created at"], rows: operations.waste.map((item) => [item.number, item.product, item.weightKg, item.costValue, item.reason, item.notes, item.recordedBy, formatDate(item.createdAt)]) };
    const counts: ReportTable = { title: "13. Stock counts", headers: ["Count", "Counted by", "Date", "Items counted", "Variance kg", "Variance value"], rows: operations.stockCounts.map((item) => [item.number, item.countedBy, formatDate(item.createdAt), item.itemCount, item.varianceKg, item.varianceValue]) };
    const ledger: ReportTable = { title: "14. Stock movement ledger", headers: ["Reference", "Date", "Type", "Product", "Quantity kg", "Batch", "Reason"], rows: operations.ledger.map((item) => [item.reference, formatDate(item.createdAt), item.type.replaceAll("_", " "), item.product, item.quantityKg, item.batchCode, item.reason]) };
    const retail: ReportTable = { title: "15. Retail products", headers: ["SKU", "Product", "Barcode", "Category", "Price", "Cost", "Stock units", "Reorder level", "Active"], rows: operations.retailProducts.map((item) => [item.sku, item.name, item.barcode, item.category, item.price, item.cost, item.stockUnits, item.reorderLevelUnits, item.active]) };
    const suppliers: ReportTable = { title: "16. Suppliers", headers: ["Code", "Supplier", "Contact", "Phone", "Email", "Payment terms days", "Active"], rows: operations.suppliers.map((item) => [item.code, item.name, item.contactPerson, item.phone, item.email, item.paymentTermsDays, item.active]) };
    const purchases: ReportTable = { title: "17. Purchase orders", headers: ["Purchase order", "Supplier", "Delivery date", "Status", "Subtotal", "Created by", "Created at", "Notes"], rows: operations.purchaseOrders.map((item) => [item.number, item.supplier, item.deliveryDate, item.status, item.subtotal, item.createdBy, formatDate(item.createdAt), item.notes]) };
    const purchaseLines: ReportTable = { title: "18. Purchase order items", headers: ["Purchase order", "Description", "Ordered kg", "Cost per kg", "Line value"], rows: operations.purchaseOrders.flatMap((order) => order.lines.map((item) => [order.number, item.description, item.orderedKg, item.costPerKg, item.orderedKg * item.costPerKg])) };
    const safety: ReportTable = { title: "19. Food safety checks", headers: ["Check", "Area", "Temperature C", "Maximum C", "Status", "Corrective action", "Recorded by", "Created at"], rows: operations.foodSafetyChecks.map((item) => [item.number, item.area, item.temperatureC, item.maximumC, item.status, item.correctiveAction, item.recordedBy, formatDate(item.createdAt)]) };
    const reconciliations: ReportTable = { title: "20. Reconciliations", headers: ["Number", "Range", "Opening kg", "Received kg", "Sold kg", "Waste kg", "Expected closing kg", "Physical closing kg", "Variance kg", "Variance value", "Completed by", "Date", "Note"], rows: operations.reconciliations.map((item) => [item.number, item.range, item.openingKg, item.receivedKg, item.soldKg, item.wasteKg, item.expectedClosingKg, item.physicalClosingKg, item.varianceKg, item.varianceValue, item.completedBy, formatDate(item.createdAt), item.note]) };
    const imports: ReportTable = { title: "21. CSV import history", headers: ["Import", "Dataset", "Filename", "Rows", "Created", "Updated", "Skipped", "Imported by", "Date"], rows: operations.importBatches.map((item) => [item.number, item.dataset, item.filename, item.rowCount, item.createdCount, item.updatedCount, item.skippedCount, item.importedBy, formatDate(item.createdAt)]) };
    const users: ReportTable = { title: "22. Staff users", headers: ["Name", "Role", "Active"], rows: operations.staffUsers.map((item) => [item.name, item.role, item.active]) };
    const profiles: ReportTable = { title: "23. Block test profiles", headers: ["Profile", "Active", "Product", "Yield percent", "Updated at"], rows: operations.blockTestProfiles.flatMap((profile) => profile.lines.map((item) => [profile.name, profile.active, item.product, item.percent, formatDate(profile.updatedAt)])) };
    const reviews: ReportTable = { title: "24. Management reviews", headers: ["Issue", "Review note", "Reviewed by", "Reviewed at"], rows: operations.managementReviews.map((item) => [item.issueId, item.note, item.reviewedBy, formatDate(item.reviewedAt)]) };
    return [summary, inventory, batches, batchYields, processing, tickets, ticketLines, sales, saleLines, payments, till, waste, counts, ledger, retail, suppliers, purchases, purchaseLines, safety, reconciliations, imports, users, profiles, reviews];
  })();

  function handleDownload() {
    const generatedAt = new Date();
    const stamp = generatedAt.toISOString().slice(0, 10);
    const csv = buildSectionedCsv("George's Butchery — Complete operations report", generatedAt.toLocaleString("en-ZA"), tables);
    downloadCsv(`georges-butchery-complete-report-${stamp}.csv`, csv);
    setMessage(`Complete report downloaded with ${tables.length} clearly labelled sections.`);
  }

  return <div className="mx-auto max-w-[1280px] print:max-w-none">
    <div className="mb-7 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div><p className={`${label} text-[#ef5b5e]`}>Management / reports</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Business report</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#9b9090]">A simple overview of stock, sales, profit, waste and controls. Download every record as CSV, or print this visual overview to PDF.</p></div>
      <div className="flex flex-col gap-2 sm:flex-row print:hidden">
        <button className={`${button} border border-[#4a3d3d] bg-[#171313] text-white hover:bg-[#211a1a]`} onClick={() => window.print()}><Printer size={17}/> Print / save PDF</button>
        <button className={`${button} bg-[#f4f0ed] text-[#171010] hover:bg-white`} onClick={handleDownload}><Download size={17}/> Download complete CSV</button>
      </div>
    </div>
    {message && <div aria-live="polite" className="mb-4 flex items-center gap-3 rounded-lg border border-[#28533e] bg-[#10291f] p-4 text-sm text-[#70d09d]"><ShieldCheck size={17}/>{message}</div>}
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={Boxes} name="Stock on hand" value={kg(stockKg)} detail={zar.format(stockValue) + " at cost"}/>
      <Metric icon={Receipt} name="Completed sales" value={zar.format(revenue)} detail={`${completedSales.length} completed sale${completedSales.length === 1 ? "" : "s"}`}/>
      <Metric icon={BarChart3} name="Gross profit" value={zar.format(profit)} detail={`${revenue ? (profit / revenue * 100).toFixed(1) : "0.0"}% gross margin`}/>
      <Metric icon={TriangleAlert} name="Waste recorded" value={kg(wasteKg)} detail={zar.format(wasteValue) + " at cost"}/>
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      <section className={`${card} p-5 sm:p-6`}><div className="mb-6 flex items-center justify-between"><div><h2 className="font-semibold">Where stock value sits</h2><p className="mt-1 text-xs text-[#918686]">Top products by physical stock value</p></div><Boxes className="text-[#ef5b5e]" size={20}/></div><div className="space-y-5">{inventoryChart.map((item) => <Bar key={item.name} name={item.name} value={item.value} max={maxInventoryValue} display={zar.format(item.value)}/>)}</div></section>
      <section className={`${card} p-5 sm:p-6`}><div className="mb-6 flex items-center justify-between"><div><h2 className="font-semibold">Kilogram overview</h2><p className="mt-1 text-xs text-[#918686]">All recorded operational activity</p></div><Scale className="text-[#ef5b5e]" size={20}/></div><div className="space-y-5">{activityChart.map((item) => <Bar key={item.name} name={item.name} value={item.value} max={maxActivity} display={kg(item.value)}/>)}</div></section>
    </div>
    <section className={`${card} mt-4 overflow-hidden`}><div className="border-b border-[#3a3030] p-5"><div className="flex items-center gap-3"><FileSpreadsheet className="text-[#ef5b5e]" size={20}/><div><h2 className="font-semibold">What is included in the CSV</h2><p className="mt-1 text-xs text-[#918686]">One file, organised into readable sections with plain headings.</p></div></div></div><div className="grid gap-px bg-[#3a3030] sm:grid-cols-2 lg:grid-cols-3">{tables.map((table) => <div className="bg-[#151212] px-5 py-4" key={table.title}><p className="text-sm font-medium">{table.title}</p><p className="mt-1 text-xs text-[#918686]">{table.rows.length} record{table.rows.length === 1 ? "" : "s"}</p></div>)}</div></section>
    <p className="mt-4 text-xs text-[#746969] print:text-black">The download and printout are generated from the records currently stored in Butchery OS.</p>
  </div>;
}
