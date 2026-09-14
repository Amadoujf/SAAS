"use client";

import { MediaLibrary } from "@/components/media/media-library";

/**
 * Démonstration autonome de la médiathèque — voir docs/12 §12.2, « médiathèque R2 »
 * (21 septembre 2026). Fonctionne ENTIÈREMENT sans PostgreSQL ni compte Cloudflare
 * réel (voir app/api/demo-media/* et lib/media/demo-media-context.ts), comme tous les
 * autres `/demo/*` de ce projet — stockage local réel, traitement d'image réel
 * (sharp), quota réel, mais métadonnées en mémoire de processus (perdues au
 * redémarrage du serveur de développement).
 */
export default function MediaLibraryDemoPage() {
  return (
    <div className="h-screen p-4">
      <div className="h-full overflow-hidden rounded-lg border border-gray-200">
        <MediaLibrary apiBase="/api/demo-media" />
      </div>
    </div>
  );
}
