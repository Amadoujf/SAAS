import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { withTenant, getPublishedPropertyBySlug, listProperties } from "@yamacommerce/database";
import { resolveEstate } from "@/lib/real-estate/estate-context";
import { placeOf, toEstateCard } from "@/lib/real-estate/estate-cards";
import { AMENITY_LABELS, DEAL_TYPE_LABELS, PROPERTY_TYPE_LABELS, formatPropertyPrice } from "@/lib/real-estate/labels";
import { EstateShell } from "@/components/estate/estate-shell";
import { PropertyGallery } from "@/components/estate/property-gallery";
import { PropertyCard } from "@/components/estate/property-card";
import { VisitRequestForm } from "@/components/estate/visit-request-form";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const r = await resolveEstate(`/biens/${params.slug}`);
  if (r.status !== "ok") return {};
  const l = await withTenant(r.estate.tenantId, (tx) => getPublishedPropertyBySlug(tx, r.estate.tenantId, params.slug));
  return l ? { title: `${l.title} — ${r.estate.tenantName}`, description: l.summary ?? undefined } : {};
}

const nf = new Intl.NumberFormat("fr-FR");

/** Fiche publique d'un bien PUBLIÉ : galerie, caractéristiques, description,
 *  équipements, localisation (commune et quartier seulement) et demande de visite. */
export default async function PropertyPage({ params }: { params: { slug: string } }) {
  const r = await resolveEstate(`/biens/${params.slug}`);
  if (r.status === "suspended") return <PublicSiteSuspended tenantName={r.tenantName} />;
  if (r.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={r.tenantName} />;
  const { estate } = r;
  const data = await withTenant(estate.tenantId, async (tx) => {
    const listing = await getPublishedPropertyBySlug(tx, estate.tenantId, params.slug);
    if (!listing?.property) return null;
    const similar = (await listProperties(tx, estate.tenantId, { publishedOnly: true, dealType: listing.property.dealType as "sale" | "rent", take: 8 })).filter((l) => l.id !== listing.id).slice(0, 3);
    return { listing, similar };
  });
  if (!data) notFound();
  const { listing, similar } = data;
  const d = listing.property!;
  const images = ((Array.isArray(listing.media) ? listing.media : []) as { url?: string; alt?: string }[]).filter((m): m is { url: string; alt?: string } => !!m.url).map((m) => ({ url: m.url, alt: m.alt || listing.title }));
  const place = placeOf(listing.location);
  const facts = [
    d.bedrooms != null && d.propertyType !== "land" ? { k: "Chambres", v: String(d.bedrooms) } : null,
    d.bathrooms != null && d.propertyType !== "land" ? { k: "Salles de bain", v: String(d.bathrooms) } : null,
    d.surfaceM2 ? { k: "Surface habitable", v: `${nf.format(d.surfaceM2)} m²` } : null,
    d.landSurfaceM2 ? { k: "Terrain", v: `${nf.format(d.landSurfaceM2)} m²` } : null,
    d.propertyType !== "land" ? { k: "Ameublement", v: d.furnished ? "Meublé" : "Non meublé" } : null,
    d.agencyReference ? { k: "Référence", v: d.agencyReference } : null,
  ].filter((f): f is { k: string; v: string } => !!f);

  return (
    <EstateShell estate={estate}>
      <div className="mx-auto max-w-[var(--content-max-width,1320px)] px-5 pt-8 sm:px-8">
        <nav aria-label="Fil d'Ariane" className="text-sm text-[var(--color-text-muted)]">
          <Link href="/" className="hover:text-[var(--color-text-primary)]">Accueil</Link> <span aria-hidden="true">/</span>{" "}
          <Link href={`/biens?transaction=${d.dealType}`} className="hover:text-[var(--color-text-primary)]">{d.dealType === "rent" ? "Louer" : "Acheter"}</Link> <span aria-hidden="true">/</span>{" "}
          <span className="text-[var(--color-text-secondary)]">{listing.title}</span>
        </nav>
        <header className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--color-accent-primary)]">{DEAL_TYPE_LABELS[d.dealType]} · {PROPERTY_TYPE_LABELS[d.propertyType]}{place ? ` · ${place}` : ""}</p>
            <h1 className="mt-3 font-[family-name:var(--font-heading)] text-[36px] leading-[1.06] sm:text-[52px]">{listing.title}</h1>
            {listing.summary && <p className="mt-3 text-lg text-[var(--color-text-secondary)]">{listing.summary}</p>}
          </div>
          <p className="shrink-0 font-[family-name:var(--font-heading)] text-[30px] sm:text-[36px]">{formatPropertyPrice(listing.price, listing.priceUnit)}</p>
        </header>
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_400px]">
          <div className="min-w-0">
            <PropertyGallery images={images} title={listing.title} />
            {facts.length > 0 && (
              <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-border)] ring-1 ring-[var(--color-border)] sm:grid-cols-3">
                {facts.map((f) => (
                  <div key={f.k} className="bg-[var(--color-background)] px-5 py-4">
                    <dt className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{f.k}</dt>
                    <dd className="mt-1 font-[family-name:var(--font-heading)] text-[22px]">{f.v}</dd>
                  </div>
                ))}
              </dl>
            )}
            {listing.description && (
              <section className="mt-12">
                <h2 className="font-[family-name:var(--font-heading)] text-[28px]">Le bien</h2>
                <div className="mt-4 max-w-3xl whitespace-pre-line text-[16px] leading-[1.75] text-[var(--color-text-secondary)]">{listing.description}</div>
              </section>
            )}
            {d.amenities.length > 0 && (
              <section className="mt-12">
                <h2 className="font-[family-name:var(--font-heading)] text-[28px]">Équipements</h2>
                <ul className="mt-5 flex flex-wrap gap-2.5">
                  {d.amenities.map((a) => <li key={a} className="rounded-[var(--radius-full)] bg-[var(--color-surface)] px-4 py-2 text-sm ring-1 ring-[var(--color-border)]">{AMENITY_LABELS[a] ?? a}</li>)}
                </ul>
              </section>
            )}
            {place && (
              <section className="mt-12">
                <h2 className="font-[family-name:var(--font-heading)] text-[28px]">Localisation</h2>
                <p className="mt-3 text-[var(--color-text-secondary)]">{place}. L&apos;adresse exacte est communiquée lors de la confirmation de la visite.</p>
              </section>
            )}
          </div>
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <VisitRequestForm slug={listing.slug} title={listing.title} />
            {estate.contact.phone && (
              <a href={`tel:${estate.contact.phone.replace(/\s/g, "")}`} className="mt-3 flex h-12 items-center justify-center rounded-[var(--radius-md)] text-[15px] font-semibold text-[var(--color-primary)] ring-1 ring-inset ring-[var(--color-border)] hover:bg-[var(--color-surface)]">
                Appeler l&apos;agence · {estate.contact.phone}
              </a>
            )}
          </aside>
        </div>
        {similar.length > 0 && (
          <section className="mt-24">
            <h2 className="mb-8 font-[family-name:var(--font-heading)] text-[34px] sm:text-[42px]">Biens similaires</h2>
            <ul className="grid gap-x-7 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((l) => <li key={l.id}><PropertyCard card={toEstateCard(l)} /></li>)}
            </ul>
          </section>
        )}
      </div>
    </EstateShell>
  );
}
