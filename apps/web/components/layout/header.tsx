"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MegaMenuNav, type NavItem } from "@/components/layout/mega-menu-nav";
import { SearchOverlay, type SearchSuggestion } from "@/components/layout/search-overlay";
import { CartDrawer } from "@/components/layout/cart-drawer";
import { FavoritesDrawer } from "@/components/layout/favorites-drawer";
import {
  SearchIcon,
  BagIcon,
  MenuIcon,
  CloseIcon,
  HeartIcon,
  UserIcon,
} from "@/components/ui/icons";
import { ComingSoonIconButton } from "@/components/ui/coming-soon-icon-button";
import { LanguageSelector } from "@/components/layout/language-selector";
import { CurrencySelector } from "@/components/layout/currency-selector";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/locale-context";
import { useCart } from "@/lib/commerce/cart-context";
import { useFavorites } from "@/lib/commerce/favorites-context";

/**
 * En-tête du site — refonte du 16 septembre 2026 : transparent sur le hero puis solide
 * au défilement (`headerStyle.variant === "transparent-on-hero"`), recherche plein
 * écran, panier latéral, navigation à mega menu (voir mega-menu-nav.tsx). Toujours en
 * position fixe (jamais `sticky`) : le hero est conçu pour être visible EN DESSOUS,
 * pas repoussé par la hauteur du header (voir HeroFullbleed, `items-end`).
 *
 * Le tiroir mobile est rendu HORS du <header> — un ancêtre avec `backdrop-blur` crée un
 * nouveau "containing block" pour ses descendants `position: fixed`, ce qui piégeait le
 * tiroir dans la hauteur du header (bug corrigé le 13 septembre 2026).
 *
 * Langue, panier et favoris viennent désormais de contextes partagés (voir
 * components/site-shell.tsx) plutôt que de props statiques — revue du 16 septembre
 * 2026, point 2 : le sélecteur de langue, le panier et les favoris devaient cesser
 * d'être des boutons silencieux. Le compte client, lui, n'a pas encore de vraie
 * fonctionnalité derrière (authentification hors périmètre de cette étape) : son icône
 * l'indique clairement au lieu de faire semblant (voir ComingSoonIconButton).
 */
export function Header({
  shopName,
  navItems,
  searchSuggestions = [],
  transparentOverHero = false,
  showCurrencySelector = false,
}: {
  shopName: string;
  navItems: NavItem[];
  searchSuggestions?: SearchSuggestion[];
  transparentOverHero?: boolean;
  /** Vente à la diaspora (voir Teranga Atelier, 20 septembre 2026) — masqué par défaut
   *  pour ne rien changer aux templates qui ne vendent qu'en FCFA. */
  showCurrencySelector?: boolean;
}) {
  const { locale } = useLocale();
  const { count: cartCount } = useCart();
  const { count: favoritesCount } = useFavorites();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!transparentOverHero) return;
    function handleScroll() {
      setScrolled(window.scrollY > 32);
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [transparentOverHero]);

  const isDark = transparentOverHero && !scrolled;

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 flex h-[var(--header-height)] items-center transition-[background-color,border-color,box-shadow] duration-300 ${
          isDark
            ? "border-b border-transparent bg-transparent"
            : "border-b border-[var(--color-border)] backdrop-blur [box-shadow:var(--shadow-sm)]"
        }`}
        // Tailwind ne peut pas mélanger une opacité sur `var(--color-background)`
        // (même limite que `text-[length:var(...)]`) — `bg-[var(...)]/95` restait
        // largement transparent une fois défilé. `color-mix()` en style inline fixe ça.
        style={
          isDark
            ? undefined
            : { backgroundColor: "color-mix(in srgb, var(--color-background) 95%, transparent)" }
        }
      >
        <div className="mx-auto flex w-full max-w-[var(--content-max-width)] items-center justify-between px-6 lg:px-12">
          <a
            href="/"
            className={`font-[family-name:var(--font-heading)] text-[length:var(--text-heading-sm)] tracking-[0.04em] transition-colors ${
              isDark ? "text-white" : "text-[var(--color-text-primary)]"
            }`}
          >
            {shopName}
          </a>

          <MegaMenuNav items={navItems} locale={locale} isDark={isDark} />

          <div
            className={`flex items-center gap-5 transition-colors ${isDark ? "text-white" : "text-[var(--color-text-primary)]"}`}
          >
            <div className="hidden items-center gap-5 lg:flex">
              {showCurrencySelector && <CurrencySelector />}
              <LanguageSelector />
            </div>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label={locale === "en" ? "Search" : "Rechercher"}
              className="hidden transition-opacity hover:opacity-70 sm:block"
            >
              <SearchIcon />
            </button>
            <button
              type="button"
              onClick={() => setFavoritesOpen(true)}
              aria-label={locale === "en" ? "Wishlist" : "Favoris"}
              className="relative hidden transition-opacity hover:opacity-70 sm:block"
            >
              <HeartIcon />
              {favoritesCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-secondary)] text-[10px] font-bold text-white">
                  {favoritesCount}
                </span>
              )}
            </button>
            <div className="hidden sm:block">
              <ComingSoonIconButton
                icon={<UserIcon />}
                label={locale === "en" ? "Account" : "Mon compte"}
                comingSoonLabel={locale === "en" ? "Coming soon" : "Bientôt disponible"}
              />
            </div>
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              aria-label={locale === "en" ? "Cart" : "Panier"}
              className="relative transition-opacity hover:opacity-70"
            >
              <BagIcon />
              {cartCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-secondary)] text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </button>
            <button
              type="button"
              className="lg:hidden"
              aria-label={locale === "en" ? "Open menu" : "Ouvrir le menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <MenuIcon />
            </button>
            <div className="hidden lg:block">
              <Button
                href="/panier"
                variant={isDark ? "outline" : "solid"}
                className={
                  isDark
                    ? "border-white text-white hover:bg-white hover:text-[var(--color-primary)]"
                    : ""
                }
              >
                {locale === "en" ? "Shop now" : "Voir la boutique"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        locale={locale}
        suggestions={searchSuggestions}
      />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} locale={locale} />
      <FavoritesDrawer
        open={favoritesOpen}
        onClose={() => setFavoritesOpen(false)}
        locale={locale}
      />

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] bg-[var(--color-background)] lg:hidden"
          >
            <motion.div
              initial={{ transform: "translateX(100%)" }}
              animate={{ transform: "translateX(0%)" }}
              exit={{ transform: "translateX(100%)" }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="flex h-full flex-col gap-8 p-8"
            >
              <div className="flex items-center justify-between">
                <span className="font-[family-name:var(--font-heading)] text-[length:var(--text-heading-sm)] text-[var(--color-text-primary)]">
                  {shopName}
                </span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label={locale === "en" ? "Close menu" : "Fermer le menu"}
                  className="text-[var(--color-text-primary)]"
                >
                  <CloseIcon />
                </button>
              </div>
              <nav className="flex flex-col gap-6" aria-label="Navigation mobile">
                {navItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="font-[family-name:var(--font-heading)] text-[length:var(--text-heading-sm)] text-[var(--color-text-primary)]"
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
              <div className="mt-auto">
                <Button href="/panier" onClick={() => setMobileOpen(false)} className="w-full">
                  {locale === "en" ? "Shop now" : "Voir la boutique"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
