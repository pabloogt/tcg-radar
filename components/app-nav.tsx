"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/search", label: "Buscar", icon: "search" },
  { href: "/investment", label: "Investment", icon: "trend" },
  { href: "/products", label: "Products", icon: "box" },
  { href: "/stores", label: "Stores", icon: "store" },
  { href: "/listings", label: "Listings", icon: "tag" },
  { href: "/calculator", label: "Calculator", icon: "calculator" },
  { href: "/inventory", label: "Inventory", icon: "archive" },
] as const;

const settings = { href: "/settings", label: "Settings", icon: "settings" } as const;

type IconName = (typeof navigation)[number]["icon"] | typeof settings.icon;

function NavIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    trend: <><path d="m3 17 6-6 4 4 8-9" /><path d="M15 6h6v6" /></>,
    box: <><path d="m21 8-9-5-9 5 9 5 9-5Z" /><path d="m3 8 9 5 9-5v8l-9 5-9-5V8Z" /></>,
    store: <><path d="M4 10v11h16V10" /><path d="M3 4h18l-2 6H5L3 4Z" /><path d="M9 21v-6h6v6" /></>,
    tag: <><path d="M20 13 11 22l-9-9V4h9l9 9Z" /><circle cx="7" cy="9" r="1" /></>,
    calculator: <><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h4" /></>,
    archive: <><path d="M3 6h18v15H3V6Z" /><path d="M2 3h20v4H2V3ZM9 11h6" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21h-4v-.08a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3v-4h.08a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3h4v.08a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.24.6.83 1 1.55 1H21v4h-.08c-.7 0-1.3.4-1.55 1Z" /></>,
  };

  return <svg aria-hidden="true" className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">{paths[name]}</svg>;
}

function NavLink({ item }: { item: (typeof navigation)[number] | typeof settings }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <Link href={item.href} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}>
      <NavIcon name={item.icon} />
      {item.label}
    </Link>
  );
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 font-semibold tracking-tight text-slate-950">
      <span className="grid size-8 place-items-center rounded-lg bg-emerald-600 text-xs font-bold text-white">TR</span>
      <span>TCG Radar</span>
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-60 border-r bg-white lg:flex lg:flex-col">
      <div className="flex h-16 items-center border-b px-5"><Brand /></div>
      <nav aria-label="Primary navigation" className="flex flex-1 flex-col gap-1 p-3">
        <form action="/search" className="mb-2 flex rounded-lg border bg-slate-50 focus-within:border-emerald-400"><label htmlFor="sidebar-search" className="sr-only">Buscar productos</label><input id="sidebar-search" name="q" placeholder="Buscar producto…" className="h-9 min-w-0 flex-1 bg-transparent px-3 text-xs outline-none" /><button aria-label="Buscar" className="px-2 text-slate-500"><NavIcon name="search" /></button></form>
        {navigation.map((item) => <NavLink key={item.href} item={item} />)}
        <div className="mt-auto space-y-1 border-t pt-3"><NavLink item={settings} /><LogoutButton /></div>
      </nav>
    </aside>
  );
}

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-20 border-b bg-white/95 px-4 backdrop-blur lg:hidden">
      <div className="flex h-16 items-center justify-between">
        <Brand />
        <details className="relative">
          <summary aria-label="Open navigation" className="flex size-9 cursor-pointer list-none items-center justify-center rounded-lg border text-slate-600 marker:content-none hover:bg-slate-50">
            <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </summary>
          <nav aria-label="Mobile navigation" className="absolute right-0 mt-2 w-56 space-y-1 rounded-xl border bg-white p-2 shadow-xl shadow-slate-900/10">
            <form action="/search" className="mb-2 flex rounded-lg border bg-slate-50"><label htmlFor="mobile-search" className="sr-only">Buscar productos</label><input id="mobile-search" name="q" placeholder="Buscar producto…" className="h-9 min-w-0 flex-1 bg-transparent px-3 text-xs outline-none" /><button aria-label="Buscar" className="px-2 text-slate-500"><NavIcon name="search" /></button></form>
            {navigation.map((item) => <NavLink key={item.href} item={item} />)}
            <div className="space-y-1 border-t pt-1"><NavLink item={settings} /><LogoutButton /></div>
          </nav>
        </details>
      </div>
    </header>
  );
}
