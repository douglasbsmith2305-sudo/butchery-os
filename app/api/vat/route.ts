import { env } from "@/lib/db";
import { costPeriod, currentCostPeriod } from "@/lib/cost-calculations";
import { ensurePurchaseVatSchema } from "@/lib/purchase-vat-schema";

type VatReceipt = { id:number; receiptNumber:string; supplierName:string; invoiceNumber:string; deliveryDate:string; subtotalCents:number|null; vatCents:number|null; invoiceTotalCents:number|null; legacyTotal:number; vatRate:number|null };
export async function GET(request: Request) {
  try {
    const period = new URL(request.url).searchParams.get("period") || currentCostPeriod();
    costPeriod(period);
    await ensurePurchaseVatSchema();
    const rows = await env.DB.prepare("SELECT id,receipt_number AS receiptNumber,supplier_name AS supplierName,invoice_number AS invoiceNumber,delivery_date AS deliveryDate,subtotal_cents AS subtotalCents,vat_cents AS vatCents,invoice_total_cents AS invoiceTotalCents,purchase_vat_rate AS vatRate,total_cost AS legacyTotal FROM stock_receipts WHERE SUBSTR(delivery_date,1,7)=? ORDER BY delivery_date DESC,id DESC").bind(period).all<VatReceipt>();
    const receipts = rows.results.map(row => ({ ...row, subtotalCents:row.subtotalCents===null?null:Number(row.subtotalCents), vatCents:row.vatCents===null?null:Number(row.vatCents), invoiceTotalCents:row.invoiceTotalCents===null?null:Number(row.invoiceTotalCents) }));
    const recorded = receipts.filter(row => row.vatCents!==null && row.subtotalCents!==null && row.invoiceTotalCents!==null);
    const totals = recorded.reduce((sum,row)=>({subtotalCents:sum.subtotalCents+row.subtotalCents!,vatCents:sum.vatCents+row.vatCents!,invoiceTotalCents:sum.invoiceTotalCents+row.invoiceTotalCents!}),{subtotalCents:0,vatCents:0,invoiceTotalCents:0});
    return Response.json({period,receipts,totals,recordedCount:recorded.length,unrecordedCount:receipts.length-recorded.length});
  } catch { return Response.json({error:"Could not load purchase VAT. Choose a valid reporting month and retry."},{status:400}); }
}
