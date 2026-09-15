import { headers } from "next/headers";
import type { MetadataRoute } from "next";
import { resolvePublicSite } from "@/lib/rendering/resolve-public-site";

/**
 * Sitemap PAR TENANT — voir docs/12 §12.3, « RENDU PUBLIC » : « générer sitemap et
 * robots.txt par tenant ». Doit résoudre le tenant à la requête (`headers()`) : ceci
 * n'est PAS un unique fichier statique pour toute la plateforme — chaque domaine/
 * sous-domaine tenant a son propre `/sitemap.xml`, reflétant UNIQUEMENT ses pages
 * publiées. Un tenant sans site publié (ou inconnu, ou suspendu) reçoit un sitemap
 * vide plutôt qu'une erreur — jamais de brouillon indexé.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "";
  const resolution = await resolvePublicSite(host);
  if (resolution.status !== "ok") return [];

  return resolution.site.manifest.pages.map((page) => ({
    url: `https://${host}${page.isHome ? "" : `/${page.slug}`}`,
    lastModified: new Date(),
  }));
}
