"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Archive, BarChart3, Boxes, Building2, ChevronDown, ClipboardCheck,
  ClipboardList, CreditCard, Gauge, History, Menu, PackageCheck, Receipt,
  Scissors, Search, Settings, ShieldCheck, Store, Truck, Users,
  X, CircleDollarSign, Scale, TriangleAlert, UserRound,
  FileSpreadsheet, ShoppingCart, Thermometer, LayoutDashboard,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const groups = [
  { label: "Cooler", items: [
    ["Dashboard", "/", Gauge], ["Receive delivery", "/cooler/receive", Truck],
    ["Batches", "/cooler/batches", Archive], ["Processing", "/cooler/processing", Scissors],
    ["Inventory", "/cooler/inventory", Boxes], ["Stock count", "/cooler/stock-count", ClipboardCheck],
    ["Waste", "/cooler/waste", TriangleAlert],
  ]},
  { label: "Butcher", items: [
    ["New ticket", "/butcher/new", Scale], ["Open tickets", "/butcher/open", ClipboardList],
    ["Recent tickets", "/butcher/recent", History],
  ]},
  { label: "POS", items: [
    ["Checkout", "/pos/checkout", CreditCard], ["Sales", "/pos/sales", Receipt],
    ["Till", "/pos/till", CircleDollarSign],
  ]},
  { label: "Management", items: [
    ["Dashboard", "/management", BarChart3], ["Product profitability", "/management/products", Store],
    ["Batch profitability", "/management/batches", PackageCheck], ["Supplier performance", "/management/suppliers", Building2],
    ["Variances", "/management/variances", TriangleAlert], ["Reconciliation", "/management/reconciliation", ShieldCheck],
  ]},
  { label: "Back Office", items: [
    ["Overview", "/backoffice", LayoutDashboard], ["CSV import & export", "/backoffice/import", FileSpreadsheet],
    ["Purchase orders", "/backoffice/purchases", ShoppingCart], ["Food safety", "/backoffice/food-safety", Thermometer],
  ]},
  { label: "Settings", items: [
    ["Products & prices", "/settings/products", Settings], ["Block test profiles", "/settings/block-tests", ClipboardList],
    ["Suppliers", "/settings/suppliers", Truck], ["Users", "/settings/users", Users],
  ]},
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isPos = pathname.startsWith("/pos");
  const isManagement = pathname.startsWith("/management") || pathname.startsWith("/backoffice") || pathname.startsWith("/settings");
  const initials = isPos ? "AK" : isManagement ? "LD" : "NM";
  const userName = isPos ? "Ayanda Khumalo" : isManagement ? "Lerato Dlamini" : "Naledi Mokoena";
  const role = isPos ? "Cashier" : isManagement ? "Manager" : "Warehouse";
  return (
    <div className="min-h-screen">
      {mobileOpen && <button aria-label="Close menu" className="fixed inset-0 z-40 bg-black/70 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-[276px] flex-col border-r border-[#322728] bg-[#0b0909]/98 transition-transform lg:translate-x-0", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="relative border-b border-[#322728] px-4 py-3">
          <Link href="/" aria-label="George's Butchery dashboard" className="block overflow-hidden rounded-xl border border-[#542124] bg-black p-1.5 shadow-[0_8px_30px_rgba(0,0,0,.35),inset_0_0_0_1px_rgba(255,255,255,.025)]">
            <Image src="/georges-butchery-logo.jpg" alt="George's Butchery — Est 2010" width={960} height={520} priority className="h-[78px] w-full object-contain"/>
          </Link>
          <button aria-label="Close menu" className="absolute right-2 top-2 grid size-8 place-items-center rounded-full border border-[#542124] bg-[#130d0d] text-[#d7c8c8] lg:hidden" onClick={() => setMobileOpen(false)}><X size={17}/></button>
        </div>
        <nav className="scrollbar flex-1 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <div className="mb-5" key={group.label}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-[#59636d]">{group.label}</p>
              {group.items.map(([label, href, Icon]) => {
                const active = href === "/" ? pathname === "/" : pathname === href;
                return <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={cn("mb-0.5 flex min-h-9 items-center gap-3 rounded-md border border-transparent px-3 text-[13px] transition", active ? "border-[#5f292c] bg-[#261416] text-[#ff9b9d]" : "text-[#9f9696] hover:bg-[#191414] hover:text-white")}>
                  <Icon size={15} strokeWidth={1.8}/><span>{label}</span>{active && <span className="ml-auto size-1.5 rounded-full bg-[#ef3034] shadow-[0_0_8px_rgba(239,48,52,.65)]"/>}
                </Link>;
              })}
            </div>
          ))}
        </nav>
        <div className="border-t border-[#302728] p-3">
          <button className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-[#1a1515]">
            <div className="grid size-8 place-items-center rounded-full bg-[#3a2022] text-xs font-semibold text-[#f0b2b4]">{initials}</div>
            <div className="min-w-0 flex-1"><div className="truncate text-xs font-medium">{userName}</div><div className="text-[10px] uppercase tracking-wider text-[#69737d]">{role}</div></div>
            <ChevronDown size={14} className="text-[#69737d]"/>
          </button>
        </div>
      </aside>
      <main className="lg:pl-[276px]">
        <header className="sticky top-0 z-30 flex h-[72px] items-center border-b border-[#322728] bg-[#090707]/92 px-4 backdrop-blur-xl sm:px-7">
          <button aria-label="Open menu" className="mr-3 grid size-10 place-items-center rounded-lg border border-[#3a2f30] lg:hidden" onClick={() => setMobileOpen(true)}><Menu size={20}/></button>
          <div className="hidden items-center gap-2 rounded-lg border border-[#362c2d] bg-[#120f0f] px-3 text-[#756b6b] md:flex">
            <Search size={15}/><input aria-label="Search" className="h-9 w-56 bg-transparent text-xs text-white outline-none placeholder:text-[#776c6c]" placeholder="Search batch, product or transaction"/>
            <kbd className="rounded border border-[#443637] px-1.5 py-0.5 text-[9px]">⌘ K</kbd>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right md:block"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#ef5b5e]">George&apos;s Butchery</p><p className="mt-0.5 text-[10px] text-[#766c6c]">Operations system</p></div>
            <div className="hidden items-center gap-2 rounded-full border border-[#254e3b] bg-[#10261d] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#5ed092] sm:flex"><span className="size-1.5 rounded-full bg-[#4bd087] shadow-[0_0_8px_#4bd087]"/>Ledger online</div>
            <button aria-label="Profile" className="grid size-9 place-items-center rounded-full border border-[#413536] text-[#9b8f8f]"><UserRound size={17}/></button>
          </div>
        </header>
        <div className="grid-bg min-h-[calc(100vh-72px)] p-4 sm:p-7">{children}</div>
      </main>
    </div>
  );
}
