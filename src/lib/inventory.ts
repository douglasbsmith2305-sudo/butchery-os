export type YieldLine = { productId: string; name: string; percent: number };
export type OutputLine = { productId: string; actualKg: number };

const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

export function validateYieldProfile(lines: YieldLine[]) {
  const total = round3(lines.reduce((sum, line) => sum + line.percent, 0));
  if (Math.abs(total - 100) > 0.001) {
    throw new Error(`Block-test profile must total 100%. Current total: ${total}%`);
  }
  return true;
}

export function calculateProjectedYields(inputKg: number, lines: YieldLine[]) {
  if (inputKg <= 0) throw new Error("Input weight must be positive");
  validateYieldProfile(lines);
  return lines.map((line) => ({
    ...line,
    expectedKg: round3(inputKg * (line.percent / 100)),
  }));
}

export function reconcileProcessing(inputKg: number, outputs: OutputLine[], recordedLossKg = 0) {
  const outputKg = round3(outputs.reduce((sum, line) => sum + line.actualKg, 0));
  const accountedKg = round3(outputKg + recordedLossKg);
  const differenceKg = round3(inputKg - accountedKg);
  return {
    inputKg: round3(inputKg),
    outputKg,
    recordedLossKg: round3(recordedLossKg),
    accountedKg,
    differenceKg,
    reconciled: Math.abs(differenceKg) <= 0.01,
  };
}

export function assertCanConsume(availableKg: number, requestedKg: number) {
  if (requestedKg <= 0) throw new Error("Requested weight must be positive");
  if (round3(requestedKg) > round3(availableKg)) {
    throw new Error(`Insufficient stock: ${availableKg} kg available`);
  }
}

export function weightedAverageCost(
  currentKg: number,
  currentCostKg: number,
  incomingKg: number,
  incomingCostKg: number,
) {
  const totalKg = currentKg + incomingKg;
  if (totalKg <= 0) return 0;
  return Math.round((((currentKg * currentCostKg) + (incomingKg * incomingCostKg)) / totalKg) * 100) / 100;
}

export function grossMargin(revenue: number, cost: number) {
  if (revenue === 0) return 0;
  return Math.round((((revenue - cost) / revenue) * 100) * 100) / 100;
}

export function reserveStock(availableKg: number, reservedKg: number, bookingKg: number) {
  assertCanConsume(availableKg, bookingKg);
  return { availableKg: round3(availableKg - bookingKg), reservedKg: round3(reservedKg + bookingKg) };
}

export function cancelReservation(availableKg: number, reservedKg: number, cancelKg: number) {
  assertCanConsume(reservedKg, cancelKg);
  return { availableKg: round3(availableKg + cancelKg), reservedKg: round3(reservedKg - cancelKg) };
}

export function completeSale(reservedKg: number, soldKg: number, saleKg: number) {
  assertCanConsume(reservedKg, saleKg);
  return { reservedKg: round3(reservedKg - saleKg), soldKg: round3(soldKg + saleKg) };
}

export function reverseSale(availableKg: number, soldKg: number, returnKg: number) {
  assertCanConsume(soldKg, returnKg);
  return { availableKg: round3(availableKg + returnKg), soldKg: round3(soldKg - returnKg) };
}

export function recordWaste(physicalKg: number, reservedKg: number, wasteKg: number) {
  assertCanConsume(round3(physicalKg - reservedKg), wasteKg);
  return {
    physicalKg: round3(physicalKg - wasteKg),
    reservedKg: round3(reservedKg),
    availableKg: round3(physicalKg - reservedKg - wasteKg),
  };
}

export function reconcileStockCount(expectedKg: number, countedKg: number) {
  if (countedKg < 0) throw new Error("Counted stock cannot be negative");
  const varianceKg = round3(countedKg - expectedKg);
  return {
    expectedKg: round3(expectedKg),
    countedKg: round3(countedKg),
    varianceKg,
    direction: varianceKg > 0 ? "IN" as const : varianceKg < 0 ? "OUT" as const : "NONE" as const,
  };
}
