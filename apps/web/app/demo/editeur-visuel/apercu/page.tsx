import type { Metadata } from "next";
import { PreviewFrameApp } from "@/components/editor/preview-frame-app";

/**
 * Document chargé DANS L'IFRAME de la démonstration de l'éditeur visuel — voir
 * docs/12 §12.2, « aperçu iframe responsive » (21 septembre 2026). Page 100%
 * publique et sans donnée serveur, à l'image des autres démonstrations `/demo/*` :
 * cette page n'affiche RIEN tant qu'elle n'a pas reçu de `CONTENT_UPDATE` par
 * `postMessage` depuis la fenêtre parente (voir `apps/web/app/demo/editeur-visuel/page.tsx`).
 *
 * Attention, DIFFÉRENT du futur `app/apercu/[tenantId]/page.tsx` (aperçu réel d'un
 * tenant) : celui-là devra vérifier l'authentification et l'autorisation AVANT de
 * rendre quoi que ce soit côté serveur (voir lib/editor/preview-access.ts,
 * « Rendu du brouillon uniquement pour les utilisateurs autorisés »). Cette page de
 * démonstration ne représente jamais un brouillon réel d'entreprise — il n'y a pas
 * de tenant ici, donc rien à protéger, exactement comme les autres `/demo/*`.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function EditorPreviewDemoPage() {
  return <PreviewFrameApp />;
}
