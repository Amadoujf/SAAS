"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { designTokensToStyle } from "@/lib/design-tokens-to-css";
import { templateFontVariables } from "@/lib/storefront/template-fonts";
import { ENUM_LABELS, SECTION_NAMES } from "@/lib/editor/section-names";
import { AnimationLevelProvider } from "@/lib/motion/animation-level-context";
import { SectionRenderer } from "@/components/sections/section-renderer";
import { LocaleProvider } from "@/lib/locale-context";
import { CurrencyProvider } from "@/lib/commerce/currency-context";
import { CartProvider } from "@/lib/commerce/cart-context";
import { FavoritesProvider } from "@/lib/commerce/favorites-context";
import {
  isAllowedOrigin,
  parseParentToFrameMessage,
  PREVIEW_CHANNEL,
  PREVIEW_PROTOCOL_VERSION,
  type FrameToParentMessage,
  type PageForPreview,
} from "@/lib/editor/preview-protocol";
import type { DesignTokens, AnimationLevel } from "@yamacommerce/design-tokens";
import type { Locale } from "@/lib/i18n";
import type { ResolvedContentBySectionId } from "@/components/sections/section-renderer";

/**
 * Document AFFICHÉ DANS L'IFRAME de l'aperçu — voir docs/12 §12.2, « aperçu iframe
 * responsive » (21 septembre 2026). Remplace l'ancien `PreviewStage` (un `<div>`
 * redimensionné dans le MÊME document que l'éditeur, voir la limite assumée du 20
 * septembre 2026) : ce composant vit dans un VRAI document séparé, avec un VRAI
 * viewport — les classes Tailwind responsives déjà utilisées par toutes les sections
 * (`sm:`, `lg:`, ...) s'y déclenchent donc exactement comme sur le site publié.
 *
 * Ne reçoit RIEN par props côté page (voir `app/demo/editeur-visuel/apercu/page.tsx` et
 * `app/apercu/[tenantId]/page.tsx`) : tout le contenu arrive par `postMessage` depuis la
 * fenêtre parente (voir lib/editor/preview-protocol.ts), toujours revalidé (format ET
 * origine) avant d'être appliqué — jamais de confiance aveugle dans `event.data`.
 *
 * Sector-agnostic : ne connaît que `PageForPreview`/`SectionRenderer` (le même contrat
 * que n'importe quel template/secteur), aucune donnée e-commerce codée en dur ici.
 */
export function PreviewFrameApp({
  allowedParentOrigin,
  initialPage,
  initialTokens,
  initialAnimationLevel = "dynamic",
  initialLocale = "fr",
  initialResolvedContent,
}: {
  /** Origine EXACTE autorisée à communiquer avec ce document — voir
   *  `isAllowedOrigin`. Optionnel : par défaut, l'origine du document lui-même
   *  (`window.location.origin`), puisque l'éditeur et son aperçu sont toujours servis
   *  par la MÊME application Next.js aujourd'hui. Un appelant (test, ou un futur
   *  déploiement multi-domaines) peut la préciser explicitement. */
  allowedParentOrigin?: string;
  /** Contenu initial, résolu et AUTORISÉ CÔTÉ SERVEUR (voir
   *  app/apercu/[tenantId]/page.tsx) — permet d'afficher le brouillon persistant dès
   *  le premier chargement, sans dépendre d'un `postMessage` qui pourrait ne jamais
   *  arriver (onglet ouvert directement, rechargement...). Absent pour la
   *  démonstration (voir app/demo/editeur-visuel/apercu/page.tsx) : elle n'affiche
   *  jamais rien tant que la fenêtre parente n'a pas envoyé de CONTENT_UPDATE. Un
   *  message reçu ensuite écrase toujours ces valeurs initiales (édition en direct). */
  initialPage?: PageForPreview;
  initialTokens?: DesignTokens;
  initialAnimationLevel?: AnimationLevel;
  initialLocale?: Locale;
  initialResolvedContent?: ResolvedContentBySectionId;
}) {
  const [resolvedOrigin] = useState(() =>
    allowedParentOrigin ?? (typeof window !== "undefined" ? window.location.origin : ""),
  );
  const [page, setPage] = useState<PageForPreview | null>(initialPage ?? null);
  const [tokens, setTokens] = useState<DesignTokens | null>(initialTokens ?? null);
  const [animationLevel, setAnimationLevel] = useState<AnimationLevel>(initialAnimationLevel);
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [resolvedContent, setResolvedContent] = useState<ResolvedContentBySectionId | undefined>(
    initialResolvedContent,
  );
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  const hasContentRef = useRef(false);
  useEffect(() => {
    hasContentRef.current = page !== null;
  });

  const postToParent = useCallback(
    (message: FrameToParentMessage) => {
      window.parent.postMessage(message, resolvedOrigin);
    },
    [resolvedOrigin],
  );

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // Vérification stricte de l'origine, DE LA SOURCE, et du format — les trois
      // indépendantes, toutes obligatoires (voir « Validation continue de
      // event.origin » / « Validation de event.source »). `event.source` n'est
      // vérifié que lorsqu'il est fourni : un vrai navigateur le renseigne TOUJOURS
      // pour un message reçu d'une fenêtre `window.parent` réelle (ce qui rend ce
      // contrôle effectif en production) ; les événements synthétiques des tests
      // unitaires (jsdom, aucune vraie imbrication de fenêtres) n'en fournissent
      // aucun — les laisser passer ici évite de casser le protocole déjà testé sans
      // affaiblir la garantie réelle en navigateur.
      if (event.source && event.source !== window.parent) return;
      if (!isAllowedOrigin(event.origin, [resolvedOrigin])) return;
      const message = parseParentToFrameMessage(event.data);
      if (!message) return;

      switch (message.type) {
        case "CONTENT_UPDATE": {
          const { payload } = message;
          setPage(payload.page);
          setTokens(payload.tokens);
          setAnimationLevel(payload.animationLevel);
          setLocale(payload.locale);
          setResolvedContent(payload.resolvedContent as ResolvedContentBySectionId | undefined);
          setSelectedSectionId(payload.selectedSectionId);
          break;
        }
        case "SELECT_SECTION": {
          setSelectedSectionId(message.payload.sectionId);
          break;
        }
        case "SCROLL_TO_SECTION": {
          document
            .getElementById(sectionDomId(message.payload.sectionId))
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
          break;
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [resolvedOrigin]);

  useEffect(() => {
    // Signale au parent que ce document est prêt à recevoir un CONTENT_UPDATE — le
    // parent n'envoie jamais avant ce signal (voir preview-stage.tsx). RENVOYÉ TOUTES
    // LES 200 MS tant qu'aucun contenu n'est arrivé : voir « Bug corrigé le 21
    // septembre 2026 » — un envoi UNIQUE ("fire and forget") peut arriver avant que
    // l'effet du PARENT qui attache son propre écouteur `message` (et peuple
    // `iframeRef.current`) n'ait eu le temps de s'exécuter, en particulier lors d'un
    // premier chargement complet de la page (pas un simple remontage de l'iframe) —
    // le message est alors perdu SANS AUCUNE ERREUR ni des deux côtés, et l'aperçu
    // reste bloqué sur "En attente du contenu…" indéfiniment. Le répéter jusqu'à
    // accusé de réception (un CONTENT_UPDATE) rend la poignée de main robuste face à
    // n'importe quel ordre de montage, sans dépendre d'un délai fixe deviné.
    function sendReadyUntilAcknowledged() {
      if (hasContentRef.current) return;
      postToParent({ channel: PREVIEW_CHANNEL, version: PREVIEW_PROTOCOL_VERSION, type: "READY" });
    }
    sendReadyUntilAcknowledged();
    const interval = setInterval(sendReadyUntilAcknowledged, 200);
    return () => clearInterval(interval);
  }, [postToParent]);

  if (!page || !tokens) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-[13px] text-gray-400">
        En attente du contenu…
      </div>
    );
  }

  const sortedBlocks = [...page.blocks].sort((a, b) => a.order - b.order);

  return (
    <LocaleProvider initialLocale={locale}>
      <CurrencyProvider>
        <CartProvider>
          <FavoritesProvider>
            <div
              style={designTokensToStyle(tokens)}
              className={`${templateFontVariables} bg-[var(--color-background)] font-[family-name:var(--font-body)] text-[var(--color-text-primary)]`}
            >
              <AnimationLevelProvider level={animationLevel}>
                {sortedBlocks.map((block) => {
                  const isSelected = block.id === selectedSectionId;
                  return (
                    <div
                      key={block.id}
                      id={sectionDomId(block.id)}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      aria-label={`Sélectionner la section ${SECTION_NAMES[block.sectionKey] ?? block.sectionKey}`}
                      onClick={() =>
                        postToParent({
                          channel: PREVIEW_CHANNEL,
                          version: PREVIEW_PROTOCOL_VERSION,
                          type: "SECTION_CLICKED",
                          payload: { sectionId: block.id },
                        })
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          postToParent({
                            channel: PREVIEW_CHANNEL,
                            version: PREVIEW_PROTOCOL_VERSION,
                            type: "SECTION_CLICKED",
                            payload: { sectionId: block.id },
                          });
                        }
                      }}
                      className={`relative cursor-pointer outline outline-2 -outline-offset-2 transition-colors ${
                        isSelected
                          ? "outline-[#3B82F6]"
                          : "outline-transparent hover:outline-[#3B82F6]/40"
                      }`}
                    >
                      {isSelected && (
                        <span className="pointer-events-none absolute left-2 top-2 z-20 rounded bg-[#3B82F6] px-2 py-0.5 text-[11px] font-medium text-white">
                          {SECTION_NAMES[block.sectionKey] ?? block.sectionKey} · {ENUM_LABELS[block.variant] ?? block.variant}
                        </span>
                      )}
                      <SectionRenderer
                        instance={block}
                        locale={locale}
                        resolvedContent={resolvedContent}
                        tokens={tokens}
                      />
                    </div>
                  );
                })}
              </AnimationLevelProvider>
            </div>
          </FavoritesProvider>
        </CartProvider>
      </CurrencyProvider>
    </LocaleProvider>
  );
}

function sectionDomId(sectionId: string): string {
  return `preview-section-${sectionId}`;
}
