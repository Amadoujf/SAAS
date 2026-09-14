/**
 * Isolation des clés de stockage — voir docs/12 §12.2, « médiathèque R2 » (21
 * septembre 2026) : « Toutes les clés de stockage doivent être préfixées par un
 * identifiant de tenant non devinable. »
 *
 * Le préfixe utilisé EST l'identifiant du tenant (`Tenant.id`, un UUID v4 généré par
 * Prisma — voir packages/database/prisma/schema.prisma, `@default(uuid())`) : 122 bits
 * d'entropie aléatoire, structurellement non devinable et non séquentiel. Aucune
 * colonne de "sel" supplémentaire n'est nécessaire pour satisfaire l'exigence — en
 * ajouter une créerait un état à synchroniser sans bénéfice de sécurité réel puisque
 * l'UUID lui-même n'est JAMAIS exposé au navigateur en clair dans un chemin
 * prévisible (voir `createSignedUrl`, qui sert des URLs temporaires, pas les clés).
 *
 * Module PUR : aucune donnée réelle, aucun accès disque/réseau — c'est ce qui permet
 * de tester exhaustivement l'isolation SANS backend (voir storage-key.test.ts) et de
 * réutiliser EXACTEMENT la même logique dans `LocalStorageProvider` et
 * `R2StorageProvider` (voir provider.ts) : aucun des deux ne réimplémente sa propre
 * vérification de préfixe.
 */

const KEY_SEGMENT_PATTERN = /^[a-zA-Z0-9_.-]+$/;

export class StorageIsolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageIsolationError";
  }
}

/** Préfixe racine de TOUS les objets d'un tenant — jamais construit autrement que par
 *  cette fonction (voir `buildStorageKey`/`assertOwnedKey` ci-dessous). */
export function tenantPrefix(tenantId: string): string {
  if (!tenantId) {
    throw new StorageIsolationError("tenantId manquant — refus de construire un préfixe de stockage.");
  }
  return `tenants/${tenantId}`;
}

/**
 * Construit une clé de stockage pour un nouvel objet — TOUJOURS sous le préfixe du
 * tenant. `segments` (dossier éventuel + nom de fichier interne) sont validés
 * individuellement : aucun `..`, `/` ou caractère permettant de "remonter" hors du
 * préfixe (voir « déduire les noms ou chemins internes » — un segment qui échoue cette
 * validation est un signe d'entrée non fiable, jamais silencieusement nettoyé).
 */
export function buildStorageKey(tenantId: string, ...segments: string[]): string {
  const cleaned = segments.filter((segment) => segment.length > 0);
  if (cleaned.length === 0) {
    throw new StorageIsolationError("buildStorageKey: au moins un segment est requis.");
  }
  for (const segment of cleaned) {
    if (segment === "." || segment === ".." || !KEY_SEGMENT_PATTERN.test(segment)) {
      throw new StorageIsolationError(`Segment de clé de stockage invalide : "${segment}".`);
    }
  }
  return [tenantPrefix(tenantId), ...cleaned].join("/");
}

/**
 * Vérifie qu'une clé de stockage appartient RÉELLEMENT au tenant donné — le point de
 * contrôle central appelé par CHAQUE méthode de `StorageProvider` recevant une clé
 * fournie par l'appelant (voir provider.ts). Compare le préfixe EXACT (avec le `/`
 * terminal) pour qu'un tenant dont l'id est un préfixe littéral d'un autre
 * (ex. "abc" vs "abcdef") ne puisse jamais matcher par erreur.
 */
export function assertOwnedKey(tenantId: string, storageKey: string): void {
  const prefix = `${tenantPrefix(tenantId)}/`;
  if (!storageKey.startsWith(prefix)) {
    throw new StorageIsolationError(
      `Accès refusé : la clé de stockage n'appartient pas au tenant "${tenantId}".`,
    );
  }
  if (storageKey.includes("..")) {
    throw new StorageIsolationError("Clé de stockage invalide (segment '..' détecté).");
  }
}
