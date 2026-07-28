import { reconcileProcessing } from "./inventory";

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const round3 = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000;

export function calculateDeliveryVariance(invoiceKg: number, actualKg: number, costPerKg: number) {
  if (!Number.isFinite(invoiceKg) || invoiceKg <= 0) throw new Error("Invoice weight must be greater than zero");
  if (!Number.isFinite(actualKg) || actualKg <= 0) throw new Error("Actual scale weight must be greater than zero");
  if (!Number.isFinite(costPerKg) || costPerKg <= 0) throw new Error("Cost per kg must be greater than zero");
  const varianceKg = round3(actualKg - invoiceKg);
  return {
    varianceKg,
    variancePercent: round2(varianceKg / invoiceKg * 100),
    totalCost: round2(actualKg * costPerKg),
  };
}

export function nextBatchCode(existingCodes: string[], deliveryDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) throw new Error("Select a valid delivery date");
  const compact = deliveryDate.replaceAll("-", "");
  const prefix = `BF-${compact}-`;
  const next = Math.max(0, ...existingCodes.filter((code) => code.startsWith(prefix)).map((code) => Number(code.slice(-3)) || 0)) + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

export function validateBatchProcessing(inputKg: number, outputs: { productId: string; actualKg: number }[], lossKg: number) {
  if (!Number.isFinite(inputKg) || inputKg <= 0) throw new Error("Processing input must be greater than zero");
  if (outputs.length === 0 || outputs.every((output) => output.actualKg <= 0)) throw new Error("Capture at least one actual output");
  if (outputs.some((output) => !Number.isFinite(output.actualKg) || output.actualKg < 0)) throw new Error("Output weights cannot be negative");
  if (!Number.isFinite(lossKg) || lossKg < 0) throw new Error("Recorded loss cannot be negative");
  const result = reconcileProcessing(inputKg, outputs, lossKg);
  if (!result.reconciled) throw new Error(`${Math.abs(result.differenceKg).toFixed(3)} kg remains unaccounted`);
  return result;
}

export function weightedAverageCost(currentKg: number, currentCostKg: number, addedKg: number, addedCostKg: number) {
  if (currentKg < 0 || addedKg < 0) throw new Error("Stock weights cannot be negative");
  const totalKg = currentKg + addedKg;
  if (totalKg === 0) return 0;
  return round2((currentKg * currentCostKg + addedKg * addedCostKg) / totalKg);
}

export function processingStatus(receivedKg: number, remainingKg: number) {
  if (remainingKg <= .001) return "Processed" as const;
  if (remainingKg < receivedKg - .001) return "Part processed" as const;
  return "Raw" as const;
}
