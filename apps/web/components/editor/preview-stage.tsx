"use client";

import { useEffect, useRef, useState } from "react";
import type { AnimationLevel, DesignTokens } from "@yamacommerce/design-tokens";
import type { ResolvedContentBySectionId } from "@/components/sections/section-renderer";
import type { Locale } from "@/lib/i18n";
import type { EditorPage } from "@/lib/editor/editor-reducer";
import {
  isAllowedOrigin,
  parseFrameToParentMessage,
  PREVIEW_CHANNEL,
  PREVIEW_PROTOCOL_VERSION,
  type ParentToFrameMessage,
} from "@/lib/editor/preview-protocol";

/**
 * Scène de prévisualisation de l'éditeur — voir docs/12 §12.2, « aperçu iframe
 * responsive » (21 septembre 2026).
 *
 * RÉÉCRITURE COMPLÈTE du 21 septembre 2026 : ce composant enveloppait auparavant un
 * `<div>` redimensionné DANS LE MÊME document que l'éditeur (voir la limite assumée du
 * 20 septembre 2026 — les classes Tailwind responsives des sections ne se
 * déclenchaient pas réellement). Il pilote maintenant un VRAI `<iframe>` chargeant un
 * document séparé (voir `PreviewFrameApp`) : le viewport de ce document est le VRAI
 * viewport de l'iframe (dimensionné en pixels réels, jamais mis à l'échelle avec
 * `transform` pour la LARGEUR effective — voir `zoom` ci-dessous pour la mise à
 * l'échelle purement visuelle), donc les media queries s'y déclenchent exactement
 * comme sur le site publié.
 *
 * Communication EXCLUSIVEMENT par `postMessage`, jamais par accès direct au DOM de
 * l'iframe (cross-document, donc de toute façon impossible pour un iframe d'une autre
 * origine — mais même en same-origin, on ne triche pas) : voir
 * lib/editor/preview-protocol.ts pour le format des messages et la vérification
 * stricte d'origine.
 */
export function PreviewStage({
  page,
  tokens,
  animationLevel,
  locale = "fr",
  resolvedContent,
  selectedSectionId,
  onSelectSection,
  previewSrc,
  width,
  height,
  zoom,
  reloadToken,
}: {
  page: EditorPage;
  tokens: DesignTokens;
  animationLevel: AnimationLevel;
  locale?: Locale;
  resolvedContent?: ResolvedContentBySectionId;
  selectedSectionId: string | null;
  onSelectSection: (sectionId: string) => void;
  /** Chemin du document d'aperçu à charger dans l'iframe (voir
   *  app/demo/editeur-visuel/apercu/page.tsx pour la démonstration, ou
   *  app/apercu/[tenantId]/page.tsx pour un vrai tenant). */
  previewSrc: string;
  /** Dimensions RÉELLES (en pixels CSS) du viewport de l'iframe — voir
   *  lib/editor/device-presets.ts. C'est CETTE valeur, jamais `zoom`, qui détermine
   *  quelles media queries se déclenchent à l'intérieur. */
  width: number;
  height: number;
  /** Échelle purement visuelle (voir lib/editor/device-presets.ts, `clampZoom`) — un
   *  simple `transform: scale()` du conteneur, à l'image du sélecteur d'appareil de
   *  Chrome DevTools : ne change JAMAIS la largeur réelle du document, seulement sa
   *  taille affichée à l'écran. */
  zoom: number;
  /** Change de valeur pour forcer un rechargement complet de l'iframe (voir « Rechargement de l'aperçu »). */
  reloadToken: number;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);
  const allowedOriginRef = useRef("");
  const lastSelectionSourceRef = useRef<"external" | "frame">("external");

  useEffect(() => {
    allowedOriginRef.current = window.location.origin;
  }, []);

  // Un rechargement (reloadToken) ou un changement de document (previewSrc) invalide
  // le "prêt" précédent : on ne redonne le contenu qu'une fois le NOUVEAU document
  // reparti de zéro et ayant renvoyé son propre READY — jamais de contenu envoyé à un
  // document qui n'écoute pas encore.
  useEffect(() => {
    setIsReady(false);
  }, [previewSrc, reloadToken]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!allowedOriginRef.current) return;
      if (!isAllowedOrigin(event.origin, [allowedOriginRef.current])) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      const message = parseFrameToParentMessage(event.data);
      if (!message) return;

      if (message.type === "READY") {
        setIsReady(true);
      } else if (message.type === "SECTION_CLICKED") {
        lastSelectionSourceRef.current = "frame";
        onSelectSection(message.payload.sectionId);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onSelectSection]);

  function postMessage(message: ParentToFrameMessage) {
    const win = iframeRef.current?.contentWindow;
    if (!win || !allowedOriginRef.current) return;
    win.postMessage(message, allowedOriginRef.current);
  }

  // Synchronisation immédiate : chaque changement de contenu/tokens/sélection publié
  // par le réducteur de l'éditeur est renvoyé à l'iframe dès que celle-ci est prête —
  // y compris les modifications NON enregistrées (voir « Les modifications non
  // enregistrées doivent pouvoir être envoyées temporairement à l'iframe »), puisque
  // ce message ne persiste jamais rien côté serveur, juste un rendu temporaire.
  useEffect(() => {
    if (!isReady) return;
    postMessage({
      channel: PREVIEW_CHANNEL,
      version: PREVIEW_PROTOCOL_VERSION,
      type: "CONTENT_UPDATE",
      payload: {
        page: {
          id: page.id,
          slug: page.slug,
          title: page.title,
          isHome: page.isHome,
          blocks: page.blocks,
        },
        tokens,
        animationLevel,
        locale,
        resolvedContent,
        selectedSectionId,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, page, tokens, animationLevel, locale, resolvedContent, selectedSectionId]);

  // Sélection déclenchée depuis la LISTE (pas depuis un clic DANS l'aperçu, déjà en
  // vue) : fait défiler l'iframe jusqu'à la section — voir « Défilement jusqu'à la
  // section sélectionnée ».
  useEffect(() => {
    if (!isReady || !selectedSectionId) return;
    if (lastSelectionSourceRef.current === "frame") {
      lastSelectionSourceRef.current = "external";
      return;
    }
    postMessage({
      channel: PREVIEW_CHANNEL,
      version: PREVIEW_PROTOCOL_VERSION,
      type: "SCROLL_TO_SECTION",
      payload: { sectionId: selectedSectionId },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, selectedSectionId]);

  return (
    <div
      className="mx-auto overflow-auto"
      style={{ width: width * zoom, height: height * zoom }}
    >
      <iframe
        key={reloadToken}
        ref={iframeRef}
        src={previewSrc}
        title="Aperçu du site"
        // Attribut sandbox MINIMAL — voir docs/12 §12.2, « médiathèque R2 » (21
        // septembre 2026), « Attribut sandbox minimal ». `allow-scripts` : le document
        // d'aperçu est une vraie application React, elle ne fonctionne pas sans JS.
        // `allow-same-origin` : sans lui, l'iframe reçoit une origine opaque
        // ("null"), qu'`isAllowedOrigin` refuse TOUJOURS explicitement (voir
        // preview-protocol.ts) — notre propre protocole postMessage cesserait de
        // fonctionner. Ni l'un ni l'autre n'est ajouté "par prudence" : chacun est
        // strictement nécessaire au fonctionnement déjà testé. Aucun autre privilège
        // (allow-forms, allow-popups, allow-top-navigation, allow-modals,
        // allow-downloads...) n'est accordé : un formulaire affiché dans l'aperçu
        // (newsletter, contact) ne doit jamais pouvoir réellement se soumettre ni
        // ouvrir de fenêtre depuis l'éditeur.
        sandbox="allow-scripts allow-same-origin"
        style={{
          width,
          height,
          border: "none",
          transform: `scale(${zoom})`,
          transformOrigin: "top left",
        }}
      />
    </div>
  );
}
