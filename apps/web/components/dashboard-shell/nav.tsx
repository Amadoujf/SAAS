"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { YcAppLogo } from "@/components/yc/logo";
import {
  IconArrowRight, IconBag, IconBox, IconCard, IconChart, IconChevronDown, IconGlobe, IconHome, IconLogout, IconMenu, IconPhone, IconReceipt,
  IconSettings, IconStack, IconTag, IconTruck, IconUsers, IconWallet, IconX,
} from "@/components/yc/icons";

export type NavIcon = "home" | "orders" | "customers" | "payments" | "products" | "categories" | "stock" | "delivery" | "settings" | "billing" | "chart" | "site" | "media";

const ICONS: Record<NavIcon, (p: { size?: number }) => JSX.Element> = {
  home: IconHome, orders: IconReceipt, customers: IconUsers, payments: IconWallet, products: IconBag,
  categories: IconTag, stock: IconStack, delivery: IconTruck, settings: IconSettings, billing: IconCard, chart: IconChart, site: IconGlobe,
  media: (p: { size?: number }) => (
    <svg width={p.size ?? 20} height={p.size ?? 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="m21 16-5-5-9 9" /></svg>
  ),
};

export interface NavItem { href: string; label: string; icon: NavIcon; badge?: number; external?: boolean }
export interface NavGroup { label: string; items: NavItem[] }

export function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname.startsWith(`${href}/`);
}

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8FB8FF]";

function NavLinks({ groups, pathname, onNavigate }: { groups: NavGroup[]; pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Navigation de l'espace entreprise" className="flex flex-col">
      {groups.map((group, gi) => (
        <div key={group.label} className={gi > 0 ? "mt-4 border-t border-white/[0.12] pt-4" : ""}>
          <p className="sr-only">{group.label}</p>
          <ul className="flex flex-col gap-1">
            {group.items.map((item) => {
              const active = !item.external && isActive(pathname, item.href);
              const Icon = ICONS[item.icon];
              const cls = `group flex items-center gap-3.5 rounded-lg px-3.5 py-2.5 text-[15px] transition-colors duration-200 ${focusRing} ${
                active ? "bg-[rgb(44_84_170)] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]" : "text-white/85 hover:bg-white/[0.07] hover:text-white"
              }`;
              const content = (
                <>
                  <span className={active ? "text-white" : "text-white/80 group-hover:text-white"}><Icon size={21} /></span>
                  <span className="flex-1">{item.label}</span>
                  {item.badge ? <span className="yc-num min-w-[22px] rounded-full bg-[#FF8A3D] px-1.5 py-0.5 text-center text-[11px] font-bold text-white">{item.badge}</span> : null}
                  {item.external ? <IconArrowRight size={15} className="-rotate-45 text-white/50" /> : null}
                </>
              );
              return (
                <li key={item.href}>
                  {item.external ? (
                    <a href={item.href} target="_blank" rel="noreferrer" className={cls}>{content}</a>
                  ) : (
                    <Link href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cls}>{content}</Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Sélecteur d'entreprise : nom, statut du site (en ligne si un domaine est actif)
 *  et raccourcis réels. Un compte n'est rattaché qu'à une entreprise aujourd'hui. */
function TenantSwitcher({ tenantName, roleName, storeUrl }: { tenantName: string; roleName: string | null; storeUrl: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-3 rounded-lg border border-white/25 px-3.5 py-3 text-left text-white transition-colors hover:bg-white/[0.06] ${focusRing}`}>
        <IconBox size={20} />
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{tenantName}</span>
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${storeUrl ? "bg-[#4C8DFF]" : "bg-white/30"}`} title={storeUrl ? "Site en ligne" : "Site non publié"} aria-label={storeUrl ? "Site en ligne" : "Site non publié"} />
        <IconChevronDown size={18} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-10 mt-2 overflow-hidden rounded-lg bg-white py-1.5 text-yc-ink shadow-[0_20px_50px_-20px_rgb(0_0_0/0.5)]">
          <p className="px-4 py-2 text-xs text-yc-ink-soft">{roleName === "OWNER" ? "Propriétaire" : roleName ?? "Membre"} de <span className="font-semibold text-yc-ink">{tenantName}</span></p>
          {storeUrl && <a href={storeUrl} target="_blank" rel="noreferrer" className="block px-4 py-2 text-sm hover:bg-yc-ivory-100">Voir mon site</a>}
          <Link href="/dashboard/facturation" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm hover:bg-yc-ivory-100">Abonnement</Link>
        </div>
      )}
    </div>
  );
}

function HelpCard({ supportUrl }: { supportUrl: string | null }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/[0.04] p-4 text-white">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[rgb(44_84_170)]"><IconPhone size={19} /></span>
        <div>
          <p className="text-[15px] font-semibold">Besoin d&apos;aide ?</p>
          <p className="mt-1 text-[13px] leading-snug text-white/70">{supportUrl ? "Nos équipes sont là pour vous accompagner." : "Suivez les premiers pas pour être prêt à vendre."}</p>
        </div>
      </div>
      {supportUrl ? (
        <a href={supportUrl} target="_blank" rel="noreferrer" className={`mt-4 flex items-center justify-center gap-2 rounded-lg border border-white/60 py-2.5 text-sm font-semibold hover:bg-white/10 ${focusRing}`}>Centre d&apos;aide <IconArrowRight size={16} /></a>
      ) : (
        <Link href="/dashboard#premiers-pas" className={`mt-4 flex items-center justify-center gap-2 rounded-lg border border-white/60 py-2.5 text-sm font-semibold hover:bg-white/10 ${focusRing}`}>Premiers pas <IconArrowRight size={16} /></Link>
      )}
    </div>
  );
}

export function DashboardSidebar({
  groups, tenantName, roleName, storeUrl, supportUrl, signOut,
}: {
  groups: NavGroup[];
  tenantName: string;
  roleName: string | null;
  storeUrl: string | null;
  supportUrl: string | null;
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

  const all = groups.flatMap((g) => g.items);
  const tabs = ["/dashboard", "/dashboard/commandes", "/dashboard/produits"].map((h) => all.find((i) => i.href === h)).filter((i): i is NavItem => !!i);
  const panel = "bg-[linear-gradient(180deg,#0F2E70_0%,#0B2459_100%)]";

  return (
    <>
      {/* Bureau */}
      <aside className={`sticky top-0 hidden h-screen w-[268px] shrink-0 flex-col gap-6 overflow-y-auto px-4 py-6 lg:flex ${panel}`}>
        <Link href="/dashboard" className={`rounded-lg px-2 text-white ${focusRing}`}><YcAppLogo /></Link>
        <TenantSwitcher tenantName={tenantName} roleName={roleName} storeUrl={storeUrl} />
        <NavLinks groups={groups} pathname={pathname} />
        <div className="mt-auto flex flex-col gap-3">
          <HelpCard supportUrl={supportUrl} />
        </div>
      </aside>

      {/* Mobile : tiroir ouvert par l'onglet « Plus » */}
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" aria-label="Fermer le menu" className="absolute inset-0 bg-[#06122e]/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className={`absolute inset-y-0 left-0 flex w-[86vw] max-w-[320px] flex-col gap-6 overflow-y-auto px-4 py-5 ${panel}`}
              initial={reduce ? false : { x: "-100%" }}
              animate={{ x: 0 }}
              exit={reduce ? { opacity: 0 } : { x: "-100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
            >
              <div className="flex items-center justify-between text-white">
                <YcAppLogo compact id="yc-app-mark-drawer" />
                <button type="button" onClick={() => setOpen(false)} aria-label="Fermer le menu" className={`grid h-10 w-10 place-items-center rounded-lg text-white/80 hover:text-white ${focusRing}`}>
                  <IconX size={20} />
                </button>
              </div>
              <TenantSwitcher tenantName={tenantName} roleName={roleName} storeUrl={storeUrl} />
              <NavLinks groups={groups} pathname={pathname} onNavigate={() => setOpen(false)} />
              <div className="mt-auto flex flex-col gap-3">
                <HelpCard supportUrl={supportUrl} />
                <form action={signOut}>
                  <button type="submit" className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm text-white/80 hover:bg-white/[0.07] hover:text-white ${focusRing}`}>
                    <IconLogout size={18} /> Déconnexion
                  </button>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile : barre d'onglets au pouce */}
      <nav aria-label="Raccourcis" className="fixed inset-x-0 bottom-0 z-30 border-t border-yc-ink/10 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {tabs.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link href={item.href} aria-current={active ? "page" : undefined} className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${active ? "text-yc-electric" : "text-yc-ink-soft"}`}>
                  <Icon size={22} />
                  {item.href === "/dashboard" ? "Accueil" : item.label}
                  {item.badge ? <span className="absolute right-[calc(50%-22px)] top-1.5 h-2 w-2 rounded-full bg-[#FF8A3D]" aria-label={`${item.badge} à traiter`} /> : null}
                </Link>
              </li>
            );
          })}
          <li>
            <button type="button" onClick={() => setOpen(true)} aria-expanded={open} className="flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-semibold text-yc-ink-soft">
              <IconMenu size={22} /> Plus
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
