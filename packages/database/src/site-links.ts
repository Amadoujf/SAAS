import type { Prisma } from "@prisma/client";
import { withSuperAdminAccess } from "./tenant-context";

/**
 * Liens enregistrés dans le site d'une entreprise (sections, accueil, annonces) —
 * contrôlés CÔTÉ SERVEUR à chaque écriture, qu'ils viennent de l'éditeur, de
 * l'assistant IA ou d'un réglage :
 * - formes acceptées : chemin interne « /… », ancre « #… », « tel: », « mailto: »,
 *   adresse « https:// » ; tout le reste est refusé (`javascript:`, `data:`,
 *   `http:`, `//hôte`, antislash, caractères de contrôle…) ;
 * - un chemin interne ne mène jamais vers une zone privée de la plateforme
 *   (tableau de bord, API, administration, éditeur) ;
 * - une adresse https ne mène jamais vers le site d'une AUTRE entreprise de la
 *   plateforme (sous-domaine ou domaine personnalisé enregistré par une autre).
 */

export class SiteLinkError extends Error {}

const PRIVATE_PREFIXES = ["/api", "/dashboard", "/admin", "/editeur", "/apercu", "/invitation", "/_next"];

/** Erreur de forme d'un lien, ou `null` s'il est acceptable. */
export function linkSyntaxError(raw: string): string | null {
  const href = raw.trim();
  if (!href) return null;
  if (href.length > 300) return "Lien trop long.";
  // Caractères de contrôle ou antislash : techniques de contournement.
  if ([...href].some((ch) => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 || ch === "\\")) return `Lien refusé (« ${href.slice(0, 60)} ») : caractères non autorisés.`;
  if (/^tel:\+?[\d ().-]{3,30}$/i.test(href)) return null;
  if (/\s/.test(href)) return `Lien refusé (« ${href.slice(0, 60)} ») : espaces non autorisés.`;
  if (href.startsWith("#")) return null;
  if (href.startsWith("/")) {
    if (href.startsWith("//")) return `Lien refusé (« ${href.slice(0, 60)} ») : adresse sans protocole.`;
    // Chemin normalisé (« /./dashboard », « /a/../api », « /%64ashboard ») avant contrôle.
    let path: string;
    try {
      path = decodeURIComponent(new URL(href, "https://site.invalid").pathname).toLowerCase();
    } catch {
      return `Lien refusé (« ${href.slice(0, 60)} ») : chemin illisible.`;
    }
    if (path.includes("..") || path.includes("//")) return `Lien refusé (« ${href.slice(0, 60)} ») : chemin non autorisé.`;
    if (PRIVATE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return `Lien refusé (« ${href.slice(0, 60)} ») : cette page est privée.`;
    return null;
  }
  if (/^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(href)) return null;
  if (/^https:\/\/[a-z0-9.-]+(:\d+)?(\/[^\s]*)?$/i.test(href)) return null;
  return `Lien refusé (« ${href.slice(0, 60)} ») : utilisez un chemin de votre site, une adresse https, un téléphone ou un e-mail.`;
}

/** Tous les liens d'une valeur JSON (clés « href », « …Href », à toute profondeur). */
export function collectLinks(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) for (const v of value) collectLinks(v, out);
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === "string" && /href$/i.test(k)) out.push(v);
      else collectLinks(v, out);
    }
  }
  return out;
}

const hostOf = (href: string) => {
  try {
    return new URL(href).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
};

/**
 * Refuse (SiteLinkError) tout lien dangereux, privé ou vers une autre entreprise.
 * `platformSuffix` : suffixe des sous-domaines gratuits (ex. « yamacommerce.ai »).
 */
export async function assertTenantLinks(tx: Prisma.TransactionClient, tenantId: string, value: unknown, platformSuffix = process.env.PLATFORM_SUBDOMAIN_SUFFIX ?? "yamacommerce.ai") {
  const links = [...new Set(collectLinks(value).map((l) => l.trim()).filter(Boolean))];
  for (const href of links) {
    const error = linkSyntaxError(href);
    if (error) throw new SiteLinkError(error);
  }
  const hosts = [...new Set(links.filter((l) => l.toLowerCase().startsWith("https://")).map(hostOf).filter((h): h is string => !!h))];
  if (!hosts.length) return;
  const own = new Set((await tx.domain.findMany({ where: { tenantId }, select: { domain: true } })).map((d) => d.domain.toLowerCase()));
  const suffix = platformSuffix.toLowerCase();
  const foreign = hosts.filter((h) => !own.has(h));
  if (!foreign.length) return;
  // Les domaines des autres entreprises sont invisibles sous isolation : la
  // vérification d'appartenance se fait par une lecture minimale, hors isolation,
  // qui ne renvoie que les noms de domaine déjà cités par l'entreprise.
  const taken = await withSuperAdminAccess((sa) => sa.domain.findMany({ where: { domain: { in: foreign } }, select: { domain: true } }));
  const takenSet = new Set(taken.map((d) => d.domain.toLowerCase()));
  for (const h of foreign) {
    if (takenSet.has(h) || h === suffix || h.endsWith(`.${suffix}`)) {
      throw new SiteLinkError(`Lien refusé (« ${h} ») : ce site appartient à une autre entreprise de la plateforme.`);
    }
  }
}
