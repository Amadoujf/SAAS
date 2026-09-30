import { headers } from "next/headers";
import type { MetadataRoute } from "next";
import { resolvePublicSite } from "@/lib/rendering/resolve-public-site";
import { previewEnabled } from "@/lib/preview/private-preview";

/**
 * robots.txt PAR TENANT — voir docs/12 §12.3, « RENDU PUBLIC » et « SÉCURITÉ ET
 * FIABILITÉ » : « aucun brouillon dans les résultats publics ou moteurs de
 * recherche ». `/apercu/*` (aperçu du brouillon) et `/api/*` sont TOUJOURS interdits
 * d'indexation, quel que soit le tenant — le brouillon n'est de toute façon jamais
 * exposé par une autre route que celle-ci (voir preview-access.ts), mais robots.txt
 * reste une seconde couche de défense contre l'indexation accidentelle.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  // Prévisualisation privée : aucune page n'est indexable.
  if (previewEnabled()) return { rules: { userAgent: "*", disallow: "/" } };
  const headerList = await headers();
  const host = headerList.get("host") ?? "";
  const resolution = await resolvePublicSite(host);

  if (resolution.status !== "ok") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/apercu/", "/dashboard/", "/admin/"],
    },
    sitemap: `https://${host}/sitemap.xml`,
  };
}
