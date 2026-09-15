import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { resolvePublicSite } from "@/lib/rendering/resolve-public-site";
import { PublicSitePage } from "@/components/public-site-page";
import { PublicSiteSuspended } from "@/components/public-site-suspended";

/**
 * Toute page NON-accueil d'un site tenant publié — voir docs/12 §12.3, « RENDU
 * PUBLIC ». Les slugs de page (`Page.slug`, voir @yamacommerce/database) sont des
 * segments plats (« a-propos », « contact », jamais imbriqués), d'où un seul niveau
 * `[slug]` plutôt qu'un catch-all `[[...slug]]`.
 *
 * Un dossier statique existant au même niveau (`app/admin`, `app/api`, `app/apercu`,
 * `app/dashboard`, `app/demo`, `app/(auth)/connexion`) gagne TOUJOURS sur cette route
 * dynamique (priorité Next.js aux segments statiques) — ces mots restent donc des
 * slugs de page réservés, indisponibles pour une page personnalisée d'un tenant.
 */
export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "";
  const resolution = await resolvePublicSite(host);
  if (resolution.status !== "ok") return {};

  const page = resolution.site.manifest.pages.find((candidate) => candidate.slug === params.slug);
  if (!page) return {};

  return {
    title: `${page.title} — ${resolution.tenantName}`,
    alternates: { canonical: `https://${host}/${params.slug}` },
  };
}

export default async function TenantPage({ params }: { params: { slug: string } }) {
  const headerList = await headers();
  const host = headerList.get("host") ?? "";
  const resolution = await resolvePublicSite(host);

  if (resolution.status === "not_found" || resolution.status === "not_published") {
    notFound();
  }
  if (resolution.status === "suspended") {
    return <PublicSiteSuspended tenantName={resolution.tenantName} />;
  }

  return <PublicSitePage tenantName={resolution.tenantName} site={resolution.site} slug={params.slug} />;
}
