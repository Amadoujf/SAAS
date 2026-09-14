import { z } from "zod";
import { designTokensSchema, animationLevelSchema } from "@yamacommerce/design-tokens";
import { sectionInstanceSchema } from "@yamacommerce/templates";
import { SUPPORTED_LOCALES } from "@/lib/i18n";

/**
 * Protocole `postMessage` entre l'éditeur (fenêtre parente) et l'aperçu (document dans
 * un `<iframe>` séparé) — voir docs/12 §12.2, « aperçu iframe responsive » (21
 * septembre 2026). Remplace l'ancien aperçu en `<div>` redimensionné (voir la limite
 * assumée du 20 septembre 2026) : l'aperçu est maintenant un VRAI document, avec un
 * VRAI viewport, dans lequel les media queries Tailwind (`sm:`, `lg:`, ...) déjà
 * utilisées par toutes les sections se déclenchent réellement.
 *
 * Chaque message est validé par un schéma Zod ICI, des deux côtés — jamais de
 * `JSON.parse`/cast implicite sur `event.data`. `parsePreviewMessage` ne lève jamais :
 * un message malformé, d'une origine imprévue, ou d'un canal étranger (une autre
 * extension de page envoyant des messages `window.postMessage` non liés) est ignoré
 * silencieusement plutôt que de faire planter l'un ou l'autre document — voir
 * « vérification stricte de l'origine et du format des messages ».
 */

/** Canal + version — permet de distinguer nos messages de ceux d'une autre origine ou
 *  d'un futur protocole incompatible, sans jamais deviner la forme d'un message qui ne
 *  porte pas cette signature exacte. */
export const PREVIEW_CHANNEL = "yamacommerce.editor-preview" as const;
export const PREVIEW_PROTOCOL_VERSION = 1 as const;

const pageForPreviewSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  isHome: z.boolean(),
  blocks: z.array(sectionInstanceSchema),
});
export type PageForPreview = z.infer<typeof pageForPreviewSchema>;

/** Contenu résolu par section — voir components/sections/content-types.ts. Composé
 *  entièrement de données sérialisables (chaînes/nombres/tableaux/objets), jamais de
 *  fonction ni d'élément React : `postMessage` utilise l'algorithme de clonage
 *  structuré, qui ne sait transporter que cela. On ne valide pas sa forme précise ici
 *  (elle dépend du secteur/catalogue, hors du contrat générique de l'éditeur) — un
 *  enregistrement libre, revalidé de toute façon par `SectionRenderer` à l'affichage. */
const resolvedContentSchema = z.record(z.unknown());

/** Message ENVOYÉ PAR LE PARENT (éditeur) VERS l'iframe (aperçu). */
export const parentToFrameMessageSchema = z.discriminatedUnion("type", [
  z.object({
    channel: z.literal(PREVIEW_CHANNEL),
    version: z.literal(PREVIEW_PROTOCOL_VERSION),
    type: z.literal("CONTENT_UPDATE"),
    payload: z.object({
      page: pageForPreviewSchema,
      tokens: designTokensSchema,
      animationLevel: animationLevelSchema,
      locale: z.enum(SUPPORTED_LOCALES),
      resolvedContent: resolvedContentSchema.optional(),
      selectedSectionId: z.string().nullable(),
    }),
  }),
  z.object({
    channel: z.literal(PREVIEW_CHANNEL),
    version: z.literal(PREVIEW_PROTOCOL_VERSION),
    type: z.literal("SELECT_SECTION"),
    payload: z.object({ sectionId: z.string().nullable() }),
  }),
  z.object({
    channel: z.literal(PREVIEW_CHANNEL),
    version: z.literal(PREVIEW_PROTOCOL_VERSION),
    type: z.literal("SCROLL_TO_SECTION"),
    payload: z.object({ sectionId: z.string() }),
  }),
]);
export type ParentToFrameMessage = z.infer<typeof parentToFrameMessageSchema>;

/** Message ENVOYÉ PAR L'IFRAME (aperçu) VERS le parent (éditeur). */
export const frameToParentMessageSchema = z.discriminatedUnion("type", [
  z.object({
    channel: z.literal(PREVIEW_CHANNEL),
    version: z.literal(PREVIEW_PROTOCOL_VERSION),
    type: z.literal("READY"),
  }),
  z.object({
    channel: z.literal(PREVIEW_CHANNEL),
    version: z.literal(PREVIEW_PROTOCOL_VERSION),
    type: z.literal("SECTION_CLICKED"),
    payload: z.object({ sectionId: z.string() }),
  }),
]);
export type FrameToParentMessage = z.infer<typeof frameToParentMessageSchema>;

/**
 * Parse défensif d'un `MessageEvent.data` reçu côté parent — retourne `null` pour
 * absolument tout ce qui n'est pas un message de notre protocole (autre canal, version
 * différente, forme invalide) plutôt que de lever. Ne vérifie PAS l'origine (voir
 * `isAllowedOrigin`, appelée séparément par l'appelant sur `event.origin` — les deux
 * vérifications sont indépendantes et toutes deux obligatoires).
 */
export function parseParentToFrameMessage(raw: unknown): ParentToFrameMessage | null {
  const result = parentToFrameMessageSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export function parseFrameToParentMessage(raw: unknown): FrameToParentMessage | null {
  const result = frameToParentMessageSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/**
 * Vérification stricte de l'origine — égalité EXACTE avec une liste d'origines
 * autorisées, jamais de correspondance partielle/regex (voir « vérification stricte de
 * l'origine »). `"null"` (chaîne littérale, origine d'un document `sandbox`/`file://`)
 * n'est JAMAIS autorisé même si présent dans la liste par erreur d'appel.
 */
export function isAllowedOrigin(origin: string, allowedOrigins: readonly string[]): boolean {
  if (origin === "null") return false;
  return allowedOrigins.includes(origin);
}
