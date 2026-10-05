/**
 * Prévisualisation PRIVÉE : quand `PREVIEW_ACCESS_CODE` est défini (variable
 * d'environnement du serveur, jamais dans le code), tout le site — plateforme, sites des
 * entreprises de démonstration, espaces — n'est accessible qu'après saisie du code, et
 * rien n'est indexable. Sans cette variable, ce verrou n'existe pas (production normale).
 *
 * Utilisable sur le runtime Edge (middleware) : Web Crypto uniquement.
 */
export const PREVIEW_COOKIE = "yc_preview";

export const previewEnabled = () => Boolean(process.env.PREVIEW_ACCESS_CODE?.trim());

/** Empreinte stockée dans le cookie : jamais le code lui-même. */
export async function previewFingerprint(code: string) {
  const data = new TextEncoder().encode(`yamacommerce-preview:${code.trim()}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Chemins toujours accessibles : la page du code, sa vérification, le contrôle TLS de Caddy, les appels internes, les ressources. */
export function isPreviewExempt(pathname: string) {
  return (
    pathname === "/acces-previsualisation" ||
    pathname === "/api/preview-access" ||
    pathname === "/api/domains/ask" ||
    // Appels internes worker → web : protégés par leur propre secret, et refusés depuis
    // Internet par Caddy (infra/preview/Caddyfile) — jamais par le code d'accès.
    pathname.startsWith("/api/internal/") ||
    pathname === "/robots.txt" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/fonts/") ||
    pathname === "/favicon.ico"
  );
}

/** Retour après saisie du code : chemin relatif uniquement (jamais une autre origine). */
export function safeNext(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value.slice(0, 300);
}
