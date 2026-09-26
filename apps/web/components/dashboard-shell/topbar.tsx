"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { YcAppLogo } from "@/components/yc/logo";
import { IconBell, IconChevronDown, IconHome, IconLogout, IconSearch } from "@/components/yc/icons";

/** Libellé du fil d'Ariane pour chaque section de l'espace entreprise. */
const SECTION_LABELS: [string, string][] = [
  ["/dashboard/commandes", "Commandes"],
  ["/dashboard/produits", "Produits"],
  ["/dashboard/clients", "Clients"],
  ["/dashboard/livraison", "Livraisons"],
  ["/dashboard/paiements", "Paiements"],
  ["/dashboard/stocks", "Stocks"],
  ["/dashboard/categories", "Catégories"],
  ["/dashboard/facturation", "Facturation"],
  ["/dashboard/equipe", "Équipe"],
  ["/dashboard/mon-site", "Mon site"],
  ["/dashboard/mediatheque", "Médiathèque"],
];

export function sectionLabel(pathname: string) {
  return SECTION_LABELS.find(([href]) => pathname === href || pathname.startsWith(`${href}/`))?.[1] ?? "Vue d'ensemble";
}

export interface TopbarAlert { href: string; label: string; count: number }

function useDismiss(open: boolean, setOpen: (v: boolean) => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open, setOpen]);
  return ref;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
}

/** Cloche : uniquement ce qui attend réellement une action (files de commandes,
 *  stock faible). Le point rouge n'apparaît que s'il y a quelque chose à faire. */
function Notifications({ alerts }: { alerts: TopbarAlert[] }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, setOpen);
  const pending = alerts.filter((a) => a.count > 0);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label={pending.length ? `Notifications : ${pending.length} à traiter` : "Notifications"} aria-expanded={open} onClick={() => setOpen((v) => !v)}
        className="yc-focus relative grid h-10 w-10 place-items-center rounded-lg text-yc-ink hover:bg-yc-ink/5">
        <IconBell size={22} />
        {pending.length > 0 && <span className="absolute right-2 top-1.5 h-2.5 w-2.5 rounded-full bg-[#FF4D3D] ring-2 ring-white" />}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-[min(320px,calc(100vw-2rem))] overflow-hidden rounded-xl bg-white shadow-[0_24px_60px_-20px_rgb(12_22_48/0.35)] ring-1 ring-yc-ink/10">
          <p className="border-b border-yc-ink/[0.06] px-4 py-3 text-sm font-semibold">À traiter</p>
          {pending.length === 0 ? (
            <p className="px-4 py-5 text-sm text-yc-ink-soft">Rien en attente. Tout est à jour.</p>
          ) : (
            <ul className="py-1">
              {pending.map((a) => (
                <li key={a.href}>
                  <Link href={a.href} onClick={() => setOpen(false)} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-yc-ivory-100">
                    {a.label}<span className="yc-num rounded-full bg-[#FFF1E6] px-2 py-0.5 text-xs font-bold text-[#C2570C]">{a.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Account({ userName, userEmail, signOut }: { userName: string; userEmail: string | null; signOut: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, setOpen);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label="Mon compte" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="yc-focus flex items-center gap-1.5 rounded-full">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-[linear-gradient(135deg,#1F5BF0,#0F2E70)] text-sm font-bold text-white">{initials(userName)}</span>
        <IconChevronDown size={18} className="hidden text-yc-ink-soft sm:block" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-xl bg-white py-1.5 shadow-[0_24px_60px_-20px_rgb(12_22_48/0.35)] ring-1 ring-yc-ink/10">
          <div className="border-b border-yc-ink/[0.06] px-4 pb-3 pt-2">
            <p className="truncate text-sm font-semibold">{userName}</p>
            {userEmail && <p className="truncate text-xs text-yc-ink-soft">{userEmail}</p>}
          </div>
          <Link href="/dashboard/facturation" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-yc-ivory-100">Abonnement</Link>
          <form action={signOut}>
            <button type="submit" className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-yc-ivory-100"><IconLogout size={16} /> Déconnexion</button>
          </form>
        </div>
      )}
    </div>
  );
}

export function DashboardTopbar({ alerts, userName, userEmail, signOut, searchEnabled }: {
  alerts: TopbarAlert[];
  userName: string;
  userEmail: string | null;
  signOut: () => Promise<void>;
  searchEnabled: boolean;
}) {
  const pathname = usePathname();
  const label = sectionLabel(pathname);
  return (
    <header className="sticky top-0 z-30 border-b border-yc-ink/[0.07] bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center gap-4 px-4 sm:px-6 lg:h-[68px] lg:px-8">
        <Link href="/dashboard" className="text-yc-navy lg:hidden"><YcAppLogo compact id="yc-app-mark-top" /></Link>
        <nav aria-label="Fil d'Ariane" className="hidden shrink-0 items-center gap-2.5 whitespace-nowrap text-[15px] lg:flex">
          <IconHome size={18} className="text-yc-ink-soft" />
          <Link href="/dashboard" className="text-yc-ink-soft hover:text-yc-ink">Espace entreprise</Link>
          <span className="text-yc-ink-soft/60">/</span>
          <span aria-current="page" className="font-semibold text-yc-ink">{label}</span>
        </nav>
        {searchEnabled && (
          <form action="/dashboard/commandes" role="search" className="ml-auto hidden w-full min-w-0 max-w-[320px] md:block lg:max-w-[240px] xl:max-w-[320px]">
            <label className="flex h-11 items-center gap-2.5 rounded-lg border border-yc-ink/15 bg-white px-3.5 text-yc-ink-soft focus-within:border-yc-electric focus-within:ring-2 focus-within:ring-yc-electric/20">
              <IconSearch size={18} />
              <span className="sr-only">Rechercher une commande ou un client</span>
              <input name="q" type="search" placeholder="Rechercher…" className="min-w-0 flex-1 bg-transparent text-[15px] text-yc-ink outline-none placeholder:text-yc-ink-soft" />
            </label>
          </form>
        )}
        <div className={`flex items-center gap-2 sm:gap-3 ${searchEnabled ? "ml-auto md:ml-0" : "ml-auto"}`}>
          <Notifications alerts={alerts} />
          <Account userName={userName} userEmail={userEmail} signOut={signOut} />
        </div>
      </div>
    </header>
  );
}
