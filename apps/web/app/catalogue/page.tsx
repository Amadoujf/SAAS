import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { withTenant, listProducts, listCategories } from "@yamacommerce/database";
import { resolveActiveTenant } from "@/lib/rendering/resolve-public-site";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export const metadata: Metadata = { title: "Catalogue" };

/**
 * Liste RÉELLE du catalogue public d'un tenant — voir docs/08 §8.1, `/catalogue`, et
 * la revue du 18 septembre 2026 : « un dashboard soigné... relié aux sites publiés ».
 * Route dédiée (pas une section du manifeste éditeur) : filtres/tri/pagination d'un
 * vrai catalogue dépassent ce qu'une section configurable par bloc peut offrir.
 *
 * RÉUTILISE `resolveActiveTenant` (voir resolve-public-site.ts) — jamais une
 * résolution de tenant parallèle : un domaine/tenant suspendu ne doit JAMAIS servir
 * de contenu catalogue, exactement la même garantie que le reste du site (voir la
 * revue du 18 septembre 2026 sur ce point précis).
 *
 * Pas de panier/commande ici (étape 2 de l'ordre validé, pas encore construite) —
 * uniquement la consultation du catalogue réel.
 */
export default async function CataloguePage({
  searchParams,
}: {
  searchParams: { categorie?: string };
}) {
  const headerList = await headers();
  const host = headerList.get("host") ?? "";
  const active = await resolveActiveTenant(host);

  if (active.status === "not_found") notFound();
  if (active.status === "suspended") return <PublicSiteSuspended tenantName={active.tenantName} />;
  if (active.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={active.tenantName} />;
  if (active.status === "redirect") {
    permanentRedirect(`https://${active.targetDomain}/catalogue`);
  }

  const [categories, products] = await withTenant(active.tenantId, async (tx) => {
    const cats = await listCategories(tx, active.tenantId);
    const category = searchParams.categorie ? cats.find((c) => c.slug === searchParams.categorie) : undefined;
    const prods = await listProducts(tx, active.tenantId, {
      status: "PUBLISHED",
      ...(category ? { categoryId: category.id } : {}),
    });
    return [cats, prods];
  });

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">{active.tenantName} — Catalogue</h1>

      {categories.length > 0 && (
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/catalogue"
            className={`rounded-full border px-3 py-1 ${!searchParams.categorie ? "border-gray-900 font-medium" : "border-gray-300 text-gray-600"}`}
          >
            Tout
          </Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/catalogue?categorie=${encodeURIComponent(category.slug)}`}
              className={`rounded-full border px-3 py-1 ${
                searchParams.categorie === category.slug ? "border-gray-900 font-medium" : "border-gray-300 text-gray-600"
              }`}
            >
              {category.name}
            </Link>
          ))}
        </nav>
      )}

      {products.length === 0 ? (
        <p className="text-[var(--color-muted)]">Aucun produit disponible pour le moment.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {products.map((product) => (
            <Link key={product.id} href={`/p/${product.slug}`} className="group flex flex-col gap-2">
              <div className="aspect-square overflow-hidden rounded-lg bg-gray-100">
                {product.images[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.images[0].url}
                    alt={product.images[0].altText ?? product.name}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                )}
              </div>
              <p className="truncate text-sm font-medium">{product.name}</p>
              <p className="text-sm text-[var(--color-muted)]">{product.basePrice.toLocaleString("fr-FR")} FCFA</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
