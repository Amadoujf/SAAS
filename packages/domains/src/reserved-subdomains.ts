/**
 * Sous-domaines réservés — voir docs/13 (assistant de domaines, 16 septembre 2026),
 * « PARCOURS 1 — SOUS-DOMAINE GRATUIT ». Ces libellés restent indisponibles pour un
 * tenant, qu'ils correspondent ou non à une route réelle de la plateforme : soit ils
 * SONT déjà utilisés (voir apps/web/app/ : admin, api, dashboard…), soit ils sont
 * trompeurs/sensibles (billing, security, support) et pourraient servir à une
 * usurpation d'identité de la plateforme elle-même (ex. "security.yamacommerce.ai").
 */
export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
  "admin",
  "api",
  "app",
  "dashboard",
  "support",
  "help",
  "mail",
  "www",
  "status",
  "billing",
  "payment",
  "security",
  // Compléments — routes réelles ou infrastructure de la plateforme.
  "apercu",
  "demo",
  "connexion",
  "auth",
  "login",
  "signup",
  "root",
  "ftp",
  "smtp",
  "pop",
  "imap",
  "ns1",
  "ns2",
  "autodiscover",
  "cpanel",
  "webmail",
  "cdn",
  "static",
  "assets",
  "docs",
  "blog",
  "yamacommerce",
]);

export function isReservedSubdomain(candidate: string): boolean {
  return RESERVED_SUBDOMAINS.has(candidate.toLowerCase());
}
