export const PRODUCTION_DEPARTMENT = "Cost of goods";

export function currentCostPeriod(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit"}).format(date);
}

export function costPeriod(period: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error("Choose a valid month (YYYY-MM).");
  const [year, month] = period.split("-").map(Number);
  return {
    start: `${period}-01`,
    end: new Date(Date.UTC(year, month, 1)).toISOString().slice(0,10),
    previous: new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0,7),
    // Johannesburg has a fixed UTC+2 offset. Sales timestamps are stored in UTC.
    startUtc: new Date(`${period}-01T00:00:00+02:00`).toISOString(),
    endUtc: new Date(`${new Date(Date.UTC(year, month, 1)).toISOString().slice(0,10)}T00:00:00+02:00`).toISOString(),
  };
}

export function cents(value: string | number) {
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error("Enter a non-negative rand amount with no more than two decimal places.");
  const [whole, fraction = ""] = text.split(".");
  const result = Number(whole)*100 + Number(fraction.padEnd(2,"0"));
  if (!Number.isSafeInteger(result) || result > 100_000_000_000) throw new Error("Amount is too large.");
  return result;
}

export type MaterialInput = {
  openingQuantity: number | null;
  openingValueCents: number | null;
  purchasedQuantity: number;
  purchaseValueCents: number;
  closingQuantity: number | null;
  alreadyCosted: boolean;
};

export function materialCost(row: MaterialInput) {
  const {openingQuantity, openingValueCents, purchasedQuantity, purchaseValueCents, closingQuantity} = row;
  if ([purchasedQuantity,purchaseValueCents].some(value=>!Number.isFinite(value)||value<0)) throw new Error("Purchases must be non-negative.");
  if (openingQuantity===null || openingValueCents===null || closingQuantity===null) return {complete:false,closingValueCents:0,consumedQuantity:0,consumedCents:0,additionalCogsCents:0};
  if ([openingQuantity,openingValueCents,closingQuantity].some(value=>!Number.isFinite(value)||value<0)) throw new Error("Stock counts and opening value must be non-negative.");
  if (!openingQuantity && openingValueCents) throw new Error("Opening value must be zero when opening quantity is zero.");
  const availableQuantity = openingQuantity + purchasedQuantity;
  const availableCents = openingValueCents + purchaseValueCents;
  if (closingQuantity > availableQuantity + .000001) throw new Error("Closing stock cannot exceed opening stock plus purchases. Record missing receipts or correct the opening count.");
  const closingValueCents = availableQuantity ? Math.round(availableCents * closingQuantity / availableQuantity) : 0;
  const consumedCents = availableCents-closingValueCents;
  return {complete:true,closingValueCents,consumedQuantity:Math.max(0,availableQuantity-closingQuantity),consumedCents,additionalCogsCents:row.alreadyCosted?0:consumedCents};
}

export function productionCogs(consumedCents:number,openingDeferredCents:number,closingDeferredCents:number) {
  if (![consumedCents,openingDeferredCents,closingDeferredCents].every(value=>Number.isSafeInteger(value)&&value>=0)) throw new Error("Production values must be non-negative cents.");
  if (closingDeferredCents>consumedCents+openingDeferredCents) throw new Error("Material cost carried in unsold finished goods cannot exceed available unallocated material costs.");
  return consumedCents+openingDeferredCents-closingDeferredCents;
}

export type MaterialCount = {period:string;openingQuantity:number|null;openingValueCents:number|null;closingQuantity:number|null;alreadyCosted:boolean};
export function materialTimeline(period:string,counts:MaterialCount[],receipts:Array<{period:string;quantity:number;valueCents:number}>) {
  // Recompute carry-forward values from their original inputs, so a corrected past
  // receipt/count flows through later months without relying on a stale cost snapshot.
  let prior:({period:string;closingQuantity:number|null;closingValueCents:number;complete:boolean})|null=null;
  const periods=[...new Set([...counts.filter(row=>row.period<=period).map(row=>row.period),period])].sort();
  let result:MaterialInput&ReturnType<typeof materialCost>&{carried:boolean}={openingQuantity:null,openingValueCents:null,purchasedQuantity:0,purchaseValueCents:0,closingQuantity:null,alreadyCosted:false,complete:false,closingValueCents:0,consumedQuantity:0,consumedCents:0,additionalCogsCents:0,carried:false};
  for(const month of periods){
    const saved=counts.find(row=>row.period===month);
    const carried=!!prior?.complete&&prior.period===costPeriod(month).previous;
    const purchases=receipts.filter(row=>row.period===month);
    const input:MaterialInput={openingQuantity:carried?prior!.closingQuantity:saved?.openingQuantity??null,openingValueCents:carried?prior!.closingValueCents:saved?.openingValueCents??null,closingQuantity:saved?.closingQuantity??null,purchasedQuantity:purchases.reduce((sum,row)=>sum+row.quantity,0),purchaseValueCents:purchases.reduce((sum,row)=>sum+row.valueCents,0),alreadyCosted:saved?.alreadyCosted??false};
    result={...input,...materialCost(input),carried};
    prior={period:month,closingQuantity:input.closingQuantity,closingValueCents:result.closingValueCents,complete:result.complete};
  }
  return result;
}
