export const profile = [
  ["Rump", 7], ["T-Bone", 8.5], ["Club Steak", 4], ["Fillet", 1.5],
  ["Steak", 17], ["Short Rib", 5.5], ["Brisket", 5], ["Chuck", 8],
  ["Mince/Wors Meat", 18], ["Stew Beef", 5], ["Bone", 15], ["Fat/Waste", 5.5],
] as const;

export const inventory = [
  { product: "Rump", physical: 86.4, reserved: 7.2, cost: 96.4, price: 169.99, movement: "8 min ago" },
  { product: "T-Bone", physical: 112.8, reserved: 12.5, cost: 101.2, price: 179.99, movement: "14 min ago" },
  { product: "Club Steak", physical: 48.1, reserved: 2.8, cost: 94.8, price: 164.99, movement: "31 min ago" },
  { product: "Fillet", physical: 21.6, reserved: 1.2, cost: 148.7, price: 269.99, movement: "42 min ago" },
  { product: "Steak", physical: 184.3, reserved: 18.9, cost: 88.4, price: 149.99, movement: "54 min ago" },
  { product: "Short Rib", physical: 72.5, reserved: 4.4, cost: 72.2, price: 129.99, movement: "1 hr ago" },
  { product: "Brisket", physical: 64.8, reserved: 3.1, cost: 76.9, price: 139.99, movement: "1 hr ago" },
  { product: "Chuck", physical: 98.2, reserved: 8.6, cost: 68.5, price: 124.99, movement: "2 hrs ago" },
  { product: "Mince/Wors Meat", physical: 213.7, reserved: 22.4, cost: 57.1, price: 109.99, movement: "2 hrs ago" },
  { product: "Stew Beef", physical: 61.2, reserved: 3.5, cost: 62.8, price: 119.99, movement: "3 hrs ago" },
  { product: "Bone", physical: 175.4, reserved: 0, cost: 9.4, price: 24.99, movement: "3 hrs ago" },
  { product: "Fat/Waste", physical: 34.6, reserved: 0, cost: 0, price: 0, movement: "4 hrs ago" },
];

export const batches = [
  { code: "BF-20260727-001", supplier: "Karoo Prime Meats", received: 720, remaining: 0, status: "Processed", cost: 92, date: "27 Jul 2026" },
  { code: "BF-20260726-003", supplier: "Karoo Prime Meats", received: 684.5, remaining: 184.5, status: "Part processed", cost: 91.5, date: "26 Jul 2026" },
  { code: "BF-20260726-002", supplier: "Highveld Beef Co.", received: 712.2, remaining: 712.2, status: "Raw", cost: 93.2, date: "26 Jul 2026" },
  { code: "BF-20260725-001", supplier: "Lowveld Livestock", received: 648.9, remaining: 0, status: "Processed", cost: 89.8, date: "25 Jul 2026" },
];

export const recentLedger = [
  { id: "TX-84932", time: "10:42", product: "Rump", batch: "BF-…001", kg: "+48.2", type: "Processing output", user: "J. Botha" },
  { id: "TX-84931", time: "10:42", product: "T-Bone", batch: "BF-…001", kg: "+63.1", type: "Processing output", user: "J. Botha" },
  { id: "TX-84930", time: "10:41", product: "Raw Beef", batch: "BF-…001", kg: "−720.0", type: "Processing input", user: "J. Botha" },
  { id: "TX-84929", time: "10:16", product: "Steak", batch: "BF-…003", kg: "−4.8", type: "Butcher booking", user: "J. van Wyk" },
  { id: "TX-84928", time: "09:58", product: "Raw Beef", batch: "BF-…002", kg: "+712.2", type: "Supplier receipt", user: "N. Mokoena" },
];
