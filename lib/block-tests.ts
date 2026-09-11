export type BlockTestItem = {
  outputSku: string;
  name: string;
  percent: number;
  byproduct?: boolean;
};

export type BlockTestProfile = {
  code: string;
  inputSku: string;
  name: string;
  department: string;
  items: BlockTestItem[];
};

export const BLOCK_TEST_PROFILES: BlockTestProfile[] = [
  {
    code: "BEEF_HIND",
    inputSku: "BULK-BEEF-HIND",
    name: "Beef Hind Quarter",
    department: "Beef",
    items: [
      { outputSku: "DEMO-BF-RUMP", name: "Bees Rump", percent: 4 },
      { outputSku: "BT-BF-TOPSIDE", name: "Bees Topside", percent: 11 },
      { outputSku: "BT-BF-SILVERSIDE", name: "Bees Silverside", percent: 10 },
      { outputSku: "BT-BF-THICK-FLANK", name: "Bees Thick Flank", percent: 9 },
      { outputSku: "BT-BF-STRIPLOIN", name: "Bees Striploin", percent: 7 },
      { outputSku: "DEMO-BF-FILLET", name: "Bees Fillet", percent: 2 },
      { outputSku: "BT-BF-SHIN", name: "Bees Shin", percent: 6 },
      { outputSku: "BT-BF-STEW", name: "Bees Stew Beef", percent: 12 },
      { outputSku: "DEMO-BF-MINCE", name: "Bees Maalvleis / Trim", percent: 15 },
      { outputSku: "DEMO-BF-BONE", name: "Bees Bene", percent: 18, byproduct: true },
      { outputSku: "DEMO-BF-FAT", name: "Bees Vet / Loss", percent: 6, byproduct: true },
    ],
  },
  {
    code: "BEEF_FRONT",
    inputSku: "BULK-BEEF-FRONT",
    name: "Beef Front Quarter",
    department: "Beef",
    items: [
      { outputSku: "BT-BF-CHUCK", name: "Bees Chuck", percent: 14 },
      { outputSku: "DEMO-BF-BRISKET", name: "Bees Brisket", percent: 9 },
      { outputSku: "BT-BF-SHORT-RIB", name: "Bees Short Rib", percent: 10 },
      { outputSku: "BT-BF-BLADE", name: "Bees Blade", percent: 8 },
      { outputSku: "BT-BF-SHIN", name: "Bees Shin", percent: 7 },
      { outputSku: "BT-BF-STEW", name: "Bees Stew Beef", percent: 13 },
      { outputSku: "DEMO-BF-MINCE", name: "Bees Maalvleis / Trim", percent: 16 },
      { outputSku: "DEMO-BF-BONE", name: "Bees Bene", percent: 17, byproduct: true },
      { outputSku: "DEMO-BF-FAT", name: "Bees Vet / Loss", percent: 6, byproduct: true },
    ],
  },
  {
    code: "LAMB_CARCASS",
    inputSku: "BULK-LAMB-CARCASS",
    name: "Lamb Carcass",
    department: "Lamb",
    items: [
      { outputSku: "DEMO-LM-LEG", name: "Skaapboud", percent: 32 },
      { outputSku: "DEMO-LM-CHOP", name: "Lam Tjops / Loin", percent: 16 },
      { outputSku: "BT-LM-SHOULDER", name: "Lam Skouer", percent: 22 },
      { outputSku: "BT-LM-BREAST", name: "Lam Bors / Rib", percent: 10 },
      { outputSku: "BT-LM-NECK-SHANK", name: "Lam Nek / Skenkel", percent: 8 },
      { outputSku: "BT-LM-TRIM", name: "Lam Maalvleis / Trim", percent: 5 },
      { outputSku: "BT-LM-BONE", name: "Lam Bene", percent: 5, byproduct: true },
      { outputSku: "BT-LM-FAT", name: "Lam Vet / Loss", percent: 2, byproduct: true },
    ],
  },
  {
    code: "PORK_CARCASS",
    inputSku: "BULK-PORK-CARCASS",
    name: "Pork Carcass",
    department: "Pork",
    items: [
      { outputSku: "BT-PK-LEG", name: "Varkboud / Ham", percent: 24 },
      { outputSku: "BT-PK-LOIN", name: "Vark Loin / Tjops", percent: 20 },
      { outputSku: "BT-PK-SHOULDER", name: "Vark Skouer", percent: 18 },
      { outputSku: "BT-PK-BELLY", name: "Vark Pens / Belly", percent: 14 },
      { outputSku: "BT-PK-RIBS", name: "Vark Rib", percent: 6 },
      { outputSku: "BT-PK-TRIM", name: "Vark Maalvleis / Trim", percent: 8 },
      { outputSku: "BT-PK-BONE", name: "Vark Bene", percent: 6, byproduct: true },
      { outputSku: "BT-PK-FAT", name: "Vark Vet / Loss", percent: 4, byproduct: true },
    ],
  },
];

export const blockTestProfile = (code?: string | null) => BLOCK_TEST_PROFILES.find(profile => profile.code === code);
