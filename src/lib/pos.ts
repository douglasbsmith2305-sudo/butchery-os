export type ScaleAmountType = "price" | "weight";

export type ScaleBarcodeFormat = {
  id: string;
  label: string;
  prefix: string;
  pluStart: number;
  pluLength: number;
  amountStart: number;
  amountLength: number;
  amountType: ScaleAmountType;
  amountDecimals: number;
};

export type ParsedScaleBarcode = {
  kind: "scale";
  raw: string;
  formatId: string;
  formatLabel: string;
  plu: string;
  amountType: ScaleAmountType;
  embeddedAmount: number;
};

export type ParsedRetailBarcode = {
  kind: "retail";
  raw: string;
};

export type ParsedBarcode = ParsedScaleBarcode | ParsedRetailBarcode;

export const DEFAULT_SCALE_FORMATS: ScaleBarcodeFormat[] = [
  {
    id: "teraoka-price-5",
    label: "20 + PLU4 + check + price5",
    prefix: "20",
    pluStart: 2,
    pluLength: 4,
    amountStart: 7,
    amountLength: 5,
    amountType: "price",
    amountDecimals: 2,
  },
  {
    id: "teraoka-price-6",
    label: "20 + PLU4 + price6",
    prefix: "20",
    pluStart: 2,
    pluLength: 4,
    amountStart: 6,
    amountLength: 6,
    amountType: "price",
    amountDecimals: 2,
  },
  {
    id: "teraoka-plu5-price4",
    label: "20 + PLU5 + check + price4",
    prefix: "20",
    pluStart: 2,
    pluLength: 5,
    amountStart: 8,
    amountLength: 4,
    amountType: "price",
    amountDecimals: 2,
  },
  {
    id: "teraoka-weight-5",
    label: "21 + PLU5 + weight5",
    prefix: "21",
    pluStart: 2,
    pluLength: 5,
    amountStart: 7,
    amountLength: 5,
    amountType: "weight",
    amountDecimals: 3,
  },
];

export function normalizeBarcode(value: string) {
  return value.trim().replaceAll(" ", "").replaceAll("-", "");
}

export function gtinCheckDigit(payload: string) {
  if (!/^\d+$/.test(payload)) throw new Error("Barcode payload must contain digits only");
  const sum = [...payload].reverse().reduce((total, digit, index) => {
    return total + Number(digit) * (index % 2 === 0 ? 3 : 1);
  }, 0);
  return (10 - (sum % 10)) % 10;
}

export function buildGtin13(payload12: string) {
  if (!/^\d{12}$/.test(payload12)) throw new Error("EAN-13 payload must be exactly 12 digits");
  return `${payload12}${gtinCheckDigit(payload12)}`;
}

export function isValidGtin(value: string) {
  const barcode = normalizeBarcode(value);
  if (!/^\d{8}$|^\d{12,14}$/.test(barcode)) return false;
  return gtinCheckDigit(barcode.slice(0, -1)) === Number(barcode.at(-1));
}

export function normalizePlu(value: string) {
  return value.replace(/^0+/, "") || "0";
}

export function parseBarcode(
  value: string,
  formats = DEFAULT_SCALE_FORMATS,
  knownPlus: string[] = [],
): ParsedBarcode {
  const raw = normalizeBarcode(value);
  if (!/^\d+$/.test(raw)) throw new Error("Scan a numeric EAN, UPC, or scale barcode");

  if (raw.length === 13) {
    const candidates = formats.filter((candidate) => {
      if (!raw.startsWith(candidate.prefix)) return false;
      const lastDataIndex = Math.max(
        candidate.pluStart + candidate.pluLength,
        candidate.amountStart + candidate.amountLength,
      );
      return lastDataIndex <= 12;
    });
    const known = new Set(knownPlus.map(normalizePlu));
    const format = candidates.find((candidate) => {
      const plu = raw.slice(candidate.pluStart, candidate.pluStart + candidate.pluLength);
      return known.has(normalizePlu(plu));
    }) ?? candidates[0];
    if (format) {
      const amountDigits = raw.slice(format.amountStart, format.amountStart + format.amountLength);
      return {
        kind: "scale",
        raw,
        formatId: format.id,
        formatLabel: format.label,
        plu: raw.slice(format.pluStart, format.pluStart + format.pluLength),
        amountType: format.amountType,
        embeddedAmount: Number(amountDigits) / (10 ** format.amountDecimals),
      };
    }
  }

  if (!isValidGtin(raw)) throw new Error("Barcode checksum is invalid—scan the item again");
  return { kind: "retail", raw };
}

export function calculateScaleLine(parsed: ParsedScaleBarcode, pricePerKg: number) {
  if (pricePerKg <= 0) throw new Error("The product needs a valid selling price per kg");
  const weightKg = parsed.amountType === "weight"
    ? parsed.embeddedAmount
    : parsed.embeddedAmount / pricePerKg;
  if (weightKg <= 0) throw new Error("The scale barcode contains a zero weight or price");
  const lineTotal = parsed.amountType === "price"
    ? parsed.embeddedAmount
    : weightKg * pricePerKg;
  return {
    weightKg: Math.round((weightKg + Number.EPSILON) * 1000) / 1000,
    lineTotal: Math.round((lineTotal + Number.EPSILON) * 100) / 100,
  };
}

export function paymentDifference(total: number, payments: { amount: number }[]) {
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  return Math.round((paid - total + Number.EPSILON) * 100) / 100;
}
