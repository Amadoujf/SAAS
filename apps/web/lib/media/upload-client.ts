/**
 * Client d'import CÔTÉ NAVIGATEUR — voir docs/12 §12.2, « médiathèque R2 » (21
 * septembre 2026), parcours IMPORTATION. Parle uniquement aux routes HTTP
 * (`apiBase`), jamais à `@yamacommerce/storage` ni à un SDK directement — c'est le
 * serveur qui décide du fournisseur réel (voir « Ne lie pas directement les
 * composants React au SDK Cloudflare »).
 *
 * Utilise `XMLHttpRequest` (pas `fetch`) UNIQUEMENT pour l'étape d'envoi des octets :
 * c'est la seule API navigateur qui expose une VRAIE progression d'upload
 * (`upload.onprogress`) — voir « Barre de progression ».
 */

export interface UploadProgressCallback {
  (percent: number): void;
}

export type UploadOutcome =
  | { status: "ready"; asset: Record<string, unknown> }
  | { status: "failed"; reason: string; message: string };

export class UploadRequestError extends Error {
  constructor(
    message: string,
    public readonly reason?: string,
  ) {
    super(message);
    this.name = "UploadRequestError";
  }
}

function putWithProgress(url: string, file: Blob, onProgress?: UploadProgressCallback, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Échec de l'envoi (HTTP ${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Erreur réseau pendant l'envoi."));
    xhr.onabort = () => reject(new DOMException("Import annulé.", "AbortError"));
    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener("abort", () => xhr.abort());
    }
    xhr.send(file);
  });
}

/** Parcours complet d'un import — voir les étapes 2 à 9 documentées dans
 *  upload-pipeline.ts (le serveur, appelé ici via `apiBase`). `onProgress` ne reflète
 *  QUE l'étape 5 (envoi des octets) : les étapes serveur (génération d'autorisation,
 *  vérification, variantes) sont trop rapides pour justifier une barre séparée dans
 *  cette version — voir le rapport de livraison. */
export async function uploadMediaFile(
  apiBase: string,
  file: File,
  options: { folder?: string; onProgress?: UploadProgressCallback; signal?: AbortSignal } = {},
): Promise<UploadOutcome> {
  const requestResponse = await fetch(`${apiBase}/request-upload`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      originalFileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      folder: options.folder,
    }),
    signal: options.signal,
  });

  if (!requestResponse.ok) {
    const body = await requestResponse.json().catch(() => ({}));
    throw new UploadRequestError(body.error ?? "Import refusé.", body.reason);
  }
  const { mediaAssetId, uploadUrl } = await requestResponse.json();

  await putWithProgress(uploadUrl, file, options.onProgress, options.signal);

  const completeResponse = await fetch(`${apiBase}/complete-upload`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mediaAssetId }),
    signal: options.signal,
  });
  if (!completeResponse.ok) {
    throw new UploadRequestError("La vérification du fichier a échoué.");
  }
  return completeResponse.json();
}
