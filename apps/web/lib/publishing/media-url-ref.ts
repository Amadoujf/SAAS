/**
 * Reconnaît une URL de média de CE tenant (médiathèque interne) parmi les URLs
 * référencées par une page — voir docs/12 §12.3, « MÉDIAS ». Même convention d'URL que
 * `demoAssetPublicRef` (lib/media/demo-media-context.ts) : un chemin applicatif opaque
 * de la forme `.../api/(demo-)?media/{id}/file`, jamais une clé de stockage brute.
 *
 * Une URL qui ne correspond à AUCUN de ces deux motifs est un média EXTERNE (hébergé
 * ailleurs, jamais importé dans la médiathèque) — `null` dans ce cas, jamais une
 * exception : voir `checkPublishReadiness`, qui n'échoue jamais sur un média externe
 * inconnu (rien à vérifier de plus que ce que le schéma de section valide déjà).
 */
const MEDIA_URL_PATTERN = /\/api\/(?:demo-)?media\/([^/?#]+)\/file(?:[/?#]|$)/;

export function extractMediaAssetIdFromUrl(url: string): string | null {
  const match = MEDIA_URL_PATTERN.exec(url);
  return match ? decodeURIComponent(match[1]!) : null;
}
