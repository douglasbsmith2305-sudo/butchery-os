import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const sql = postgres(url, { prepare: false });

const products = [
  ["RAW-BEEF","Raw Beef",false],["RUMP","Rump",true],["T-BONE","T-Bone",true],
  ["CLUB","Club Steak",true],["FILLET","Fillet",true],["STEAK","Steak",true],
  ["SHORT-RIB","Short Rib",true],["BRISKET","Brisket",true],["CHUCK","Chuck",true],
  ["MINCE","Mince",true],["WORS","Wors",true],["MINCE-WORS","Mince/Wors Meat",true],
  ["STEW","Stew Beef",true],["BONE","Bone",true],["FAT-WASTE","Fat/Waste",false],
] as const;

async function seed() {
  await sql`insert into users (email,name,role) values ('admin@butcheryos.co.za','Naledi Mokoena','ADMIN') on conflict (email) do nothing`;
  await sql`insert into suppliers (name,code) values ('Karoo Prime Meats','KPM') on conflict (code) do nothing`;
  for (const [sku,name,saleable] of products) {
    await sql`insert into products (sku,name,is_raw,saleable,selling_price_kg,average_cost_kg)
      values (${sku},${name},${sku === "RAW-BEEF"},${saleable},${saleable ? 129.99 : 0},${sku === "RAW-BEEF" ? 92 : 78})
      on conflict (sku) do nothing`;
  }
  const [profile] = await sql`insert into block_test_profiles (name) values ('Standard Beef') returning id`;
  const yields = [["RUMP",7],["T-BONE",8.5],["CLUB",4],["FILLET",1.5],["STEAK",17],["SHORT-RIB",5.5],["BRISKET",5],["CHUCK",8],["MINCE-WORS",18],["STEW",5],["BONE",15],["FAT-WASTE",5.5]] as const;
  for (const [sku,pct] of yields) await sql`insert into block_test_profile_items (profile_id,product_id,yield_percent) select ${profile.id}, id, ${pct} from products where sku=${sku}`;
  console.log("Butchery OS seed complete");
}

seed().finally(() => sql.end());
