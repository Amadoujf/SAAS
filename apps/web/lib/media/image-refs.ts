const MEDIA_URL = /^\/api\/media\/([0-9a-f-]{36})\/file(?:\?variant=(?:thumbnail|small|medium|large))?$/;
const DEMO_URL = /^\/demo-templates\/[a-z0-9-]+\/[a-z0-9-]+\.webp$/;

/** Une image affichée sur le site d'une entreprise vient de SA médiathèque, des
 *  visuels de démonstration, ou d'une adresse https — jamais d'un autre chemin de
 *  l'application. Les identifiants de médiathèque rencontrés sont ajoutés à `mediaIds`
 *  pour que l'appelant vérifie qu'ils appartiennent bien à l'entreprise. */
export function checkImage(url: string | null | undefined, mediaIds: Set<string>): string | null {
  if (!url) return null;
  const media = url.match(MEDIA_URL);
  if (media) {
    mediaIds.add(media[1]!);
    return null;
  }
  if (DEMO_URL.test(url) || /^https:\/\/[^\s]+$/.test(url)) return null;
  return "Image invalide : choisissez-la dans la médiathèque.";
}
