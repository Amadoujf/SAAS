import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { withTenant, getProductBySlugForTenant } from "@yamacommerce/database";
import { resolveActiveTenant } from "@/lib/rendering/resolve-public-site";
import { PublicSiteSuspended } from "@/components/public-site-suspended";

/**
 * Fiche produit publique RÉELLE — voir docs/08 §8.1, `/p/[slug]`. Même garde
 * domaine/tenant que `/catalogue` (voir `resolveActiveTenant`) : jamais de contenu
 * pour un tenant/domaine suspendu, même par lien direct vers un produit précis.
 *
 * Pas de panier/achat ici (étape 2 de l'ordre validé, pas encore construite) —
 * uniquement la consultation détaillée du produit et de ses variantes.
 */
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "";
  const active = await resolveActiveTenant(host);
  if (active.status !== "ok") return {};

  const product = await withTenant(active.tenantId, (tx) =>
    getProductBySlugForTenant(tx, active.tenantId, params.slug, "PUBLISHED"),
  );
  if (!product) return {};
  return { title: `${product.name} — ${active.tenantName}`, description: product.shortDescription ?? undefined };
}

export default async function ProductDetailPage({ params }: { params: { slug: string } }) {
  const headerList = await headers();
  const host = headerList.get("host") ?? "";
  const active = await resolveActiveTenant(host);

  if (active.status === "not_found") notFound();
  if (active.status === "suspended") return <PublicSiteSuspended tenantName={active.tenantName} />;
  if (active.status === "redirect") {
    permanentRedirect(`https://${active.targetDomain}/p/${params.slug}`);
  }

  const product = await withTenant(active.tenantId, (tx) =>
    getProductBySlugForTenant(tx, active.tenantId, params.slug, "PUBLISHED"),
  );
  if (!product) notFound();

  return (
    <main className="mx-auto grid max-w-4xl grid-cols-1 gap-8 px-4 py-12 md:grid-cols-2">
      <div className="flex flex-col gap-3">
        <div className="aspect-square overflow-hidden rounded-lg bg-gray-100">
          {product.images[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.images[0].url}
              alt={product.images[0].altText ?? product.name}
              className="h-full w-full object-cover"
            />
          )}
        </div>
        {product.images.length > 1 && (
          <div className="flex gap-2">
            {product.images.slice(1).map((image) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={image.id}
                src={image.url}
                alt={image.altText ?? product.name}
                className="h-16 w-16 rounded object-cover"
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{product.name}</h1>
          <p className="mt-1 text-xl text-[var(--color-muted)]">
            {product.basePrice.toLocaleString("fr-FR")} FCFA
            {product.compareAtPrice && (
              <span className="ml-2 text-base line-through opacity-60">
                {product.compareAtPrice.toLocaleString("fr-FR")} FCFA
              </span>
            )}
          </p>
        </div>

        {product.description && <p className="text-[var(--color-text-primary)]">{product.description}</p>}

        {product.variants.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">Options disponibles</h2>
            <ul className="flex flex-wrap gap-2">
              {product.variants.map((variant) => {
                const inStock = variant.inventoryItems.some((item) => item.quantity > 0);
                return (
                  <li
                    key={variant.id}
                    className={`rounded-full border px-3 py-1 text-sm ${
                      inStock ? "border-gray-300" : "border-gray-200 text-gray-400 line-through"
                    }`}
                  >
                    {variant.name}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
