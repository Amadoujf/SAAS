/**
 * URL enregistrée dans une section : un média de la médiathèque est servi par
 * l'application elle-même, sur CHAQUE domaine de l'entreprise (sous-domaine, domaine
 * personnalisé, aperçu). L'adresse absolue renvoyée par l'API (« http://hôte/api/… »)
 * ne vaudrait que pour l'hôte de l'éditeur : on garde donc le chemin (« /api/… »).
 * Une adresse d'un autre hôte (CDN, image externe) est laissée telle quelle.
 */
export function toPortableUrl(url: string, origin: string): string {
  try {
    const parsed = new URL(url, origin);
    if (parsed.origin === origin && parsed.pathname.startsWith("/api/")) return `${parsed.pathname}${parsed.search}`;
  } catch {
    // URL illisible : laissée telle quelle, le schéma de la section la refusera.
  }
  return url;
}
