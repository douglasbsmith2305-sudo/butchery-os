"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Archive, BarChart3, Boxes, Building2, ChevronDown, ClipboardCheck,
  ClipboardList, CreditCard, Gauge, History, Menu, PackageCheck, Receipt,
  Scissors, Settings, ShieldCheck, Store, Truck, Users,
  X, CircleDollarSign, Scale, TriangleAlert, UserRound,
  FileSpreadsheet, ShoppingCart, Thermometer, LayoutDashboard, FileBarChart, Check,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const primaryGroups = [
  { label: "Today's work", items: [
    ["Home", "/", Gauge], ["Receive stock", "/cooler/receive", Truck],
    ["Process a batch", "/cooler/processing", Scissors], ["Count stock", "/cooler/stock-count", ClipboardCheck],
    ["Record waste", "/cooler/waste", TriangleAlert],
  ]},
  { label: "Orders & sales", items: [
    ["New butcher order", "/butcher/new", Scale], ["Open orders", "/butcher/open", ClipboardList],
    ["Checkout", "/pos/checkout", CreditCard], ["Sales history", "/pos/sales", Receipt],
  ]},
  { label: "Management", items: [
    ["Business overview", "/management", BarChart3], ["Reports & downloads", "/reports", FileBarChart],
  ]},
] as const;

const moreGroups = [
  { label: "Stock records", items: [["Inventory", "/cooler/inventory", Boxes], ["Delivery batches", "/cooler/batches", Archive]] },
  { label: "Sales records", items: [["Recent butcher orders", "/butcher/recent", History], ["Till", "/pos/till", CircleDollarSign]] },
  { label: "Management detail", items: [["Product profitability", "/management/products", Store], ["Batch profitability", "/management/batches", PackageCheck], ["Supplier performance", "/management/suppliers", Building2], ["Variances", "/management/variances", TriangleAlert], ["Reconciliation", "/management/reconciliation", ShieldCheck]] },
  { label: "Back office", items: [["Back office home", "/backoffice", LayoutDashboard], ["CSV import", "/backoffice/import", FileSpreadsheet], ["Purchase orders", "/backoffice/purchases", ShoppingCart], ["Food safety", "/backoffice/food-safety", Thermometer]] },
  { label: "Setup", items: [["Products & prices", "/settings/products", Settings], ["Block test profiles", "/settings/block-tests", ClipboardList], ["Suppliers", "/settings/suppliers", Truck], ["Users", "/settings/users", Users]] },
] as const;

function NavLink({ label, href, Icon, pathname, onNavigate }: { label: string; href: string; Icon: typeof Gauge; pathname: string; onNavigate(): void }) {
  const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  return <Link href={href} onClick={onNavigate} className={cn("mb-1 flex min-h-10 items-center gap-3 rounded-lg border border-transparent px-3 text-[13px] transition", active ? "border-[#713033] bg-[#2c1719] text-white" : "text-[#aaa0a0] hover:bg-[#1b1515] hover:text-white")}>
    <Icon size={16} strokeWidth={1.8}/><span>{label}</span>{active && <span className="ml-auto size-1.5 rounded-full bg-[#ef3034] shadow-[0_0_8px_rgba(239,48,52,.65)]"/>}
  </Link>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isPos = pathname.startsWith("/pos");
  const isManagement = pathname === "/reports" || pathname.startsWith("/management") || pathname.startsWith("/backoffice") || pathname.startsWith("/settings");
  const initials = isPos ? "AK" : isManagement ? "LD" : "NM";
  const userName = isPos ? "Ayanda Khumalo" : isManagement ? "Lerato Dlamini" : "Naledi Mokoena";
  const role = isPos ? "Cashier" : isManagement ? "Manager" : "Warehouse";
  const moreActive = moreGroups.some((group) => group.items.some(([, href]) => pathname === href || pathname.startsWith(`${href}/`)));
  const currentArea = pathname === "/" ? "Home" : pathname.startsWith("/cooler") ? "Stock & cooler" : pathname.startsWith("/butcher") ? "Butcher orders" : pathname.startsWith("/pos") ? "Checkout & sales" : pathname === "/reports" ? "Reports" : "Management";
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
          {primaryGroups.map((group) => (
            <div className="mb-5" key={group.label}>
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-[#756969]">{group.label}</p>
              {group.items.map(([label, href, Icon]) => <NavLink Icon={Icon} href={href} key={href} label={label} onNavigate={() => setMobileOpen(false)} pathname={pathname}/>) }
            </div>
          ))}
          <details className="group rounded-lg border border-[#302728] bg-[#100d0d]" open={moreActive ? true : undefined}>
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-3 text-[13px] font-medium text-[#aaa0a0]"><Settings size={16}/><span>More records & setup</span><ChevronDown className="ml-auto transition group-open:rotate-180" size={15}/></summary>
            <div className="border-t border-[#302728] px-2 pb-2 pt-3">{moreGroups.map((group) => <div className="mb-4 last:mb-0" key={group.label}><p className="mb-1.5 px-3 text-[9px] font-semibold uppercase tracking-[.14em] text-[#756969]">{group.label}</p>{group.items.map(([label, href, Icon]) => <NavLink Icon={Icon} href={href} key={href} label={label} onNavigate={() => setMobileOpen(false)} pathname={pathname}/>)}</div>)}</div>
          </details>
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
          <div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#ef5b5e]">You are in</p><p className="mt-1 text-sm font-medium">{currentArea}</p></div>
          <div className="ml-auto flex items-center gap-3">
            <Link className="hidden min-h-9 items-center gap-2 rounded-lg border border-[#4a3a3b] px-3 text-xs font-medium text-[#d8cece] hover:bg-[#1b1515] sm:flex" href="/reports"><FileBarChart size={15}/> Reports</Link>
            <div className="hidden items-center gap-2 rounded-full border border-[#254e3b] bg-[#10261d] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#5ed092] md:flex"><Check size={12}/> Saved on this device</div>
            <button aria-label="Profile" className="grid size-9 place-items-center rounded-full border border-[#413536] text-[#9b8f8f]"><UserRound size={17}/></button>
          </div>
        </header>
        <div className="grid-bg min-h-[calc(100vh-72px)] p-4 sm:p-7">{children}</div>
      </main>
    </div>
  );
}
