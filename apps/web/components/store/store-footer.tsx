import Link from "next/link";
import type { StoreLayout } from "@/lib/storefront/store-templates";

interface FooterProps {
  tenantName: string;
  layout: StoreLayout;
  categories: { slug: string; name: string }[];
}

const SERVICE = [
  { href: "/catalogue", label: "Tout le catalogue" },
  { href: "/suivi", label: "Suivre ma commande" },
  { href: "/panier", label: "Panier" },
];
const PAYMENT = "Paiement à la livraison, Wave ou Orange Money. Livraison au Sénégal.";

/** Pied de page de la boutique, accordé au cadre du site (même vocabulaire que
 *  l'en-tête). Uniquement des liens réels de la boutique ; aucune inscription ni
 *  promesse qui n'existerait pas. */
export function StoreFooter({ tenantName, layout, categories }: FooterProps) {
  const universes = categories.slice(0, 5).map((c) => ({ href: `/catalogue?categorie=${c.slug}`, label: c.name }));
  const year = new Date().getFullYear();

  if (layout === "editorial") {
    return (
      <footer className="mt-24 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto max-w-[var(--content-max-width,1280px)] px-4 pb-10 pt-16 sm:px-6">
          <p className="text-center font-[family-name:var(--font-heading)] text-[clamp(2.6rem,8vw,6.5rem)] uppercase leading-none tracking-[0.18em]">{tenantName}</p>
          <div className="mx-auto mt-14 grid max-w-4xl gap-10 text-center sm:grid-cols-3 sm:text-left">
            <FooterColumn title="Collections" links={universes} />
            <FooterColumn title="Service" links={SERVICE} />
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">La maison</p>
              <p className="mt-4 text-sm leading-relaxed text-[var(--color-text-secondary)]">{PAYMENT}</p>
            </div>
          </div>
          <p className="mt-14 border-t border-[var(--color-border)] pt-6 text-center text-xs text-[var(--color-text-muted)]">© {year} {tenantName} · Boutique propulsée par Y-COM</p>
        </div>
      </footer>
    );
  }

  if (layout === "sculptural") {
    return (
      <footer className="mt-24 bg-[var(--color-surface-muted)]">
        <div className="mx-auto grid max-w-[var(--content-max-width,1280px)] gap-10 px-4 py-16 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <p className="text-[22px] font-light uppercase tracking-[0.42em]">{tenantName}</p>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-[var(--color-text-secondary)]">{PAYMENT}</p>
          </div>
          <FooterColumn title="Collections" links={universes} />
          <FooterColumn title="Service" links={SERVICE} />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Commander</p>
            <Link href="/catalogue" className="mt-4 inline-flex items-center gap-2 border-b border-current pb-1 text-sm font-medium">Voir toute la collection →</Link>
          </div>
        </div>
        <p className="mx-auto max-w-[var(--content-max-width,1280px)] border-t border-[var(--color-border)] px-4 py-6 text-xs text-[var(--color-text-muted)] sm:px-8">© {year} {tenantName} · Boutique propulsée par Y-COM</p>
      </footer>
    );
  }

  if (layout === "studio") {
    return (
      <footer className="mt-24 overflow-hidden bg-[var(--color-primary)] text-white">
        <div className="mx-auto grid max-w-[var(--content-max-width,1280px)] gap-10 px-4 pt-14 sm:grid-cols-3 sm:px-6">
          <FooterColumn title="Collections" links={universes} tone="light" />
          <FooterColumn title="Service" links={SERVICE} tone="light" />
          <p className="text-sm leading-relaxed text-white/80">{PAYMENT}</p>
        </div>
        {/* Le nom tient toujours sur la largeur : plus il est long, plus les lettres sont petites. */}
        <p aria-hidden="true" className="mt-12 select-none overflow-hidden whitespace-nowrap px-2 text-center font-[family-name:var(--font-heading)] font-extrabold uppercase leading-[0.78] tracking-[-0.05em]" style={{ fontSize: `clamp(2.5rem, ${Math.round(150 / Math.max(5, tenantName.length))}vw, 19rem)` }}>
          {tenantName}
        </p>
        <p className="mx-auto max-w-[var(--content-max-width,1280px)] px-4 pb-6 pt-4 text-xs text-white/70 sm:px-6">© {year} {tenantName} · Boutique propulsée par Y-COM</p>
      </footer>
    );
  }

  return (
    <footer className="mt-16 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto grid max-w-[var(--content-max-width,1280px)] gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
        <div>
          <p className="font-[family-name:var(--font-heading)] text-lg font-semibold">{tenantName}</p>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">{PAYMENT}</p>
        </div>
        <nav aria-label="Pied de page" className="flex flex-col gap-2 text-sm">
          <Link href="/catalogue" className="hover:underline">Catalogue</Link>
          <Link href="/panier" className="hover:underline">Panier</Link>
          <Link href="/suivi" className="hover:underline">Suivre ma commande</Link>
        </nav>
        <p className="text-xs text-[var(--color-text-muted)] sm:text-right">Boutique propulsée par Y-COM</p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links, tone = "default" }: { title: string; links: { href: string; label: string }[]; tone?: "default" | "light" }) {
  if (!links.length) return null;
  return (
    <nav aria-label={title}>
      <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${tone === "light" ? "text-white/60" : "text-[var(--color-text-muted)]"}`}>{title}</p>
      <ul className="mt-4 grid gap-2.5 text-sm">
        {links.map((l) => (
          <li key={l.href}><Link href={l.href} className={`transition-opacity hover:opacity-60 ${tone === "light" ? "text-white" : ""}`}>{l.label}</Link></li>
        ))}
      </ul>
    </nav>
  );
}
