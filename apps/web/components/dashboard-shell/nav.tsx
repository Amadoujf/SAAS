"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { YcLogo, YcMark } from "@/components/yc/logo";
import {
  IconBag, IconBox, IconCard, IconChart, IconHome, IconLogout, IconMenu, IconReceipt, IconSettings,
  IconStack, IconTag, IconTruck, IconUsers, IconWallet, IconX,
} from "@/components/yc/icons";

export type NavIcon = "home" | "orders" | "customers" | "payments" | "products" | "categories" | "stock" | "delivery" | "settings" | "billing" | "chart";

const ICONS: Record<NavIcon, (p: { size?: number }) => JSX.Element> = {
  home: IconHome, orders: IconReceipt, customers: IconUsers, payments: IconWallet, products: IconBag,
  categories: IconTag, stock: IconStack, delivery: IconTruck, settings: IconSettings, billing: IconCard, chart: IconChart,
};

export interface NavItem { href: string; label: string; icon: NavIcon; badge?: number }
export interface NavGroup { label: string; items: NavItem[] }

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ groups, pathname, onNavigate }: { groups: NavGroup[]; pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Navigation du tableau de bord" className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-3 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/35">{group.label}</p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = ICONS[item.icon];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yc-cyan ${
                      active ? "bg-white/[0.09] text-white" : "text-white/60 hover:bg-white/[0.05] hover:text-white"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="yc-nav-active"
                        className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-gradient-to-b from-yc-cyan to-yc-violet"
                        transition={{ type: "spring", stiffness: 500, damping: 40 }}
                      />
                    )}
                    <span className={active ? "text-yc-cyan" : "text-white/45 group-hover:text-white/80"}>
                      <Icon size={19} />
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {item.badge ? (
                      <span className="yc-num rounded-full bg-yc-cyan px-2 py-0.5 text-[11px] font-bold text-yc-night-950">{item.badge}</span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function TenantCard({ tenantName, roleName }: { tenantName: string; roleName: string | null }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/[0.05] p-3 ring-1 ring-inset ring-white/10">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-yc-electric to-yc-violet font-display text-sm font-bold text-white">
        {tenantName.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{tenantName}</p>
        {roleName && <p className="truncate text-xs text-white/45">{roleName}</p>}
      </div>
    </div>
  );
}

export function DashboardSidebar({
  groups, tenantName, roleName, storeUrl, signOut,
}: {
  groups: NavGroup[];
  tenantName: string;
  roleName: string | null;
  storeUrl: string | null;
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const footer = (
    <div className="flex flex-col gap-2 border-t border-white/10 pt-4">
      {storeUrl && (
        <a href={storeUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white">
          <IconBox size={18} /> Voir ma boutique
        </a>
      )}
      <form action={signOut}>
        <button type="submit" className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yc-cyan">
          <IconLogout size={18} /> Déconnexion
        </button>
      </form>
    </div>
  );

  const mobilePrimary = groups.flatMap((g) => g.items).filter((i) => ["/dashboard", "/dashboard/commandes", "/dashboard/produits", "/dashboard/clients"].includes(i.href));

  return (
    <>
      {/* Bureau */}
      <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col gap-6 overflow-y-auto bg-yc-night-950 px-4 py-5 lg:flex">
        <div className="pointer-events-none absolute inset-0 yc-glow opacity-40" aria-hidden="true" />
        <div className="relative flex flex-col gap-6">
          <Link href="/dashboard" className="px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yc-cyan rounded-lg"><YcLogo tone="light" /></Link>
          <TenantCard tenantName={tenantName} roleName={roleName} />
          <NavLinks groups={groups} pathname={pathname} />
        </div>
        <div className="relative mt-auto">{footer}</div>
      </aside>

      {/* Mobile : barre supérieure */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/10 bg-yc-night-950/95 px-4 backdrop-blur lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2 text-white">
          <YcMark size={28} />
          <span className="max-w-[55vw] truncate text-sm font-semibold">{tenantName}</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le menu"
          aria-expanded={open}
          className="grid h-10 w-10 place-items-center rounded-xl text-white ring-1 ring-inset ring-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yc-cyan"
        >
          <IconMenu size={20} />
        </button>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" aria-label="Fermer le menu" className="absolute inset-0 bg-yc-night-950/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="absolute inset-y-0 left-0 flex w-[86vw] max-w-[320px] flex-col gap-6 overflow-y-auto bg-yc-night-950 px-4 py-5"
              initial={reduce ? false : { x: "-100%" }}
              animate={{ x: 0 }}
              exit={reduce ? { opacity: 0 } : { x: "-100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
            >
              <div className="flex items-center justify-between">
                <YcLogo tone="light" />
                <button type="button" onClick={() => setOpen(false)} aria-label="Fermer le menu" className="grid h-10 w-10 place-items-center rounded-xl text-white/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yc-cyan">
                  <IconX size={20} />
                </button>
              </div>
              <TenantCard tenantName={tenantName} roleName={roleName} />
              <NavLinks groups={groups} pathname={pathname} onNavigate={() => setOpen(false)} />
              <div className="mt-auto">{footer}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile : barre d'onglets au pouce */}
      <nav aria-label="Raccourcis" className="fixed inset-x-0 bottom-0 z-30 border-t border-yc-ink/10 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {mobilePrimary.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link href={item.href} aria-current={active ? "page" : undefined} className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${active ? "text-yc-electric" : "text-yc-ink-soft"}`}>
                  <Icon size={22} />
                  {item.label}
                  {item.badge ? <span className="absolute right-[calc(50%-22px)] top-1.5 h-2 w-2 rounded-full bg-yc-danger" aria-label={`${item.badge} à traiter`} /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
