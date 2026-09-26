"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { YcLogo } from "@/components/yc/logo";
import { IconMenu, IconX } from "@/components/yc/icons";
import { buttonClasses } from "@/components/yc/button";

const LINKS = [
  { href: "#fonctionnalites", label: "Fonctionnalités" },
  { href: "#templates", label: "Templates" },
  { href: "#paiements", label: "Paiements" },
  { href: "#tarifs", label: "Tarifs" },
];

export function PlatformHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${scrolled ? "bg-yc-night-950/80 py-3 shadow-[0_1px_0_rgb(255_255_255/0.06)] backdrop-blur-xl" : "py-5"}`}>
      <div className="mx-auto flex max-w-7xl items-center gap-8 px-5 sm:px-8">
        <Link href="/" aria-label="YamaCommerce, accueil" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yc-cyan"><YcLogo tone="light" /></Link>
        <nav aria-label="Principale" className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-full px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white">{l.label}</a>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 sm:flex">
          <Link href="/connexion" className="rounded-full px-4 py-2 text-sm font-semibold text-white/80 hover:text-white">Connexion</Link>
          <Link href="/creer-ma-boutique" className={buttonClasses("glow", "sm", "rounded-full px-5")}>Créer ma boutique</Link>
        </div>
        <button type="button" aria-label="Ouvrir le menu" aria-expanded={open} onClick={() => setOpen(true)} className="ml-auto grid h-11 w-11 place-items-center rounded-full text-white ring-1 ring-inset ring-white/15 sm:hidden lg:hidden">
          <IconMenu size={20} />
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 bg-yc-night-950/95 backdrop-blur-xl lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex items-center justify-between px-5 py-5">
              <YcLogo tone="light" />
              <button type="button" aria-label="Fermer le menu" onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center rounded-full text-white ring-1 ring-inset ring-white/15"><IconX size={20} /></button>
            </div>
            <nav aria-label="Menu mobile" className="flex flex-col gap-2 px-5 pt-6">
              {LINKS.map((l, i) => (
                <motion.a key={l.href} href={l.href} onClick={() => setOpen(false)} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}
                  className="border-b border-white/10 py-4 font-display text-3xl font-semibold text-white">{l.label}</motion.a>
              ))}
              <div className="mt-8 grid gap-3">
                <Link href="/creer-ma-boutique" className={buttonClasses("glow", "lg", "w-full rounded-full")}>Créer ma boutique</Link>
                <Link href="/connexion" className={buttonClasses("inverse", "lg", "w-full rounded-full")}>Connexion</Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
