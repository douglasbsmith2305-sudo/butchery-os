export type PurchaseVatLine = { quantity: number; costPrice: number; vatPercent?: number };
export const PURCHASE_VAT_RATE = 15;

function fraction(value: number): [bigint, bigint] {
  if (!Number.isFinite(value) || value < 0) throw new Error("Enter a valid non-negative stock cost and quantity.");
  const [mantissa, exponent = "0"] = String(value).toLowerCase().split("e");
  const [whole, decimals = ""] = mantissa.split(".");
  const power = decimals.length - Number(exponent);
  return power >= 0 ? [BigInt(whole + decimals), BigInt(10) ** BigInt(power)] : [BigInt(whole + decimals) * BigInt(10) ** BigInt(-power), BigInt(1)];
}
function safe(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("The invoice amount is too large.");
  return Number(value);
}
export function purchaseLineCents(quantity: number, costPrice: number): number {
  const [q, qd] = fraction(quantity), [p, pd] = fraction(costPrice);
  const denominator = qd * pd;
  return safe((q * p * BigInt(200) + denominator) / (BigInt(2) * denominator));
}
export function purchaseVatTotals(lines: PurchaseVatLine[]) {
  let subtotal = BigInt(0), taxable = BigInt(0);
  for (const line of lines) {
    const rate = line.vatPercent ?? PURCHASE_VAT_RATE;
    if (rate !== 0 && rate !== PURCHASE_VAT_RATE) throw new Error("Choose 15% or 0% purchase VAT.");
    const value = BigInt(purchaseLineCents(line.quantity, line.costPrice));
    subtotal += value;
    if (rate === PURCHASE_VAT_RATE) taxable += value;
  }
  const vat = (taxable * BigInt(15) + BigInt(50)) / BigInt(100);
  return { subtotalCents: safe(subtotal), taxableCents: safe(taxable), vatCents: safe(vat), invoiceTotalCents: safe(subtotal + vat), vatRate: PURCHASE_VAT_RATE };
}
