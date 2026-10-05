/** Plafond absolu d'un envoi vers le stockage LOCAL (prévisualisation) : au-delà, refus
 *  même si une formule autorise plus (les gros fichiers passent par R2 en production). */
export const HARD_UPLOAD_LIMIT_BYTES = Number(process.env.LOCAL_UPLOAD_MAX_BYTES ?? 200 * 1024 * 1024);

/** Lit le corps d'une requête sans jamais dépasser `limit` octets en mémoire : null si
 *  la limite est dépassée (la lecture est interrompue aussitôt). */
export async function readBodyWithLimit(request: Request, limit: number): Promise<Uint8Array | null> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}
