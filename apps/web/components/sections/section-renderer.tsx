import { sectionParamSchemas, validateSectionInstance, type SectionInstance } from "@yamacommerce/templates";
import type { DesignTokens } from "@yamacommerce/design-tokens";
import type { Locale } from "@/lib/i18n";
import { AnimationScopeOverride } from "@/lib/motion/animation-level-context";
import { AnimationDetailScope } from "@/lib/motion/animation-detail-context";
import { SectionFallback } from "@/components/ui/section-fallback";
import {
  hasStyleOverride,
  hoverEffectClassName,
  spacingClassNameForSection,
  spacingOverrideToMediaCss,
  styleOverrideToCssVars,
} from "@/lib/editor/section-style";
import { HeroSection } from "./hero";
import { CategoriesSection } from "./categories";
import { FeaturedProductsSection } from "./featured-products";
import { NewArrivalsSection } from "./new-arrivals";
import { PromotionsSection } from "./promotions";
import { BenefitsSection } from "./benefits";
import { TestimonialsSection } from "./testimonials";
import { BrandsSection } from "./brands";
import { GallerySection } from "./gallery";
import { VideoSection } from "./video";
import { NewsletterSection } from "./newsletter";
import { FaqSection } from "./faq";
import { CtaSection } from "./cta";
import { ContactSection } from "./contact";
import { WhatsappSection } from "./whatsapp";
import { CustomContentSection } from "./custom-content";
import { BrandManifestoSection } from "./brand-manifesto";
import { SignatureProductSection } from "./signature-product";
import { HeritageSection } from "./heritage";
import { LookbookSection } from "./lookbook";
import { DesignersSection } from "./designers";
import { ProvenanceSection } from "./provenance";
import { CatalogSearchSection } from "./catalog-search";
import { ImmersiveHeroSection } from "./immersive/immersive-hero";
import { ImmersiveShowcaseSection } from "./immersive/immersive-showcase";
import { ScrollStorySection } from "./immersive/scroll-story";
import { SHOWCASE_POOL_KEY, isShowcasePool, selectShowcaseItems, type ShowcasePool } from "@/lib/showcase/showcase";
import type {
  ResolvedCategoriesContent,
  ResolvedProductsContent,
  ResolvedPromotionsContent,
  ResolvedLookbookContent,
  ResolvedDesignersContent,
} from "./content-types";

/**
 * Contenu résolu (catalogue) par identifiant de section — voir content-types.ts pour
 * l'explication de la séparation config validée / contenu résolu. Fourni par
 * l'appelant (page de démonstration ou, plus tard, le chargeur de données par tenant) ;
 * le moteur de rendu lui-même ne déclenche jamais de requête.
 */
export type ResolvedContentBySectionId = Record<
  string,
  | ResolvedCategoriesContent
  | ResolvedProductsContent
  | ResolvedPromotionsContent
  | ResolvedLookbookContent
  | ResolvedDesignersContent
  /** Réservoir des produits et fiches publiés (clé `SHOWCASE_POOL_KEY`) — voir lib/showcase. */
  | ShowcasePool
>;

/**
 * Rend UNE section à partir d'une instance brute (potentiellement invalide).
 *
 * Garanties : (1) la clé et la variante sont toujours revalidées ici, jamais
 * supposées correctes en amont ; (2) une section invalide, désactivée ou de clé
 * inconnue ne fait jamais planter la page — fallback propre ou `null` ; (3) le
 * registre de composants ci-dessous est un `switch` fermé sur des clés connues à la
 * compilation : aucun composant arbitraire fourni par une entreprise ne peut être
 * exécuté (voir l'exigence « ne jamais exécuter de composant arbitraire »).
 */
export function SectionRenderer({
  instance,
  locale,
  resolvedContent,
  tokens,
}: {
  instance: unknown;
  locale: Locale;
  resolvedContent?: ResolvedContentBySectionId;
  /** Tokens EFFECTIFS du site — nécessaires uniquement pour résoudre
   *  `styleOverride.headingSize/bodySize/radius/shadow` contre l'échelle réelle (voir
   *  lib/editor/section-style.ts). Absent = surcharges de style ignorées, comportement
   *  strictement identique à avant leur ajout (20 septembre 2026). */
  tokens?: DesignTokens;
}) {
  let validated: SectionInstance;
  try {
    validated = validateSectionInstance(instance);
  } catch (error) {
    const rawKey =
      typeof instance === "object" && instance !== null && "sectionKey" in instance
        ? String((instance as { sectionKey: unknown }).sectionKey)
        : "inconnue";
    // eslint-disable-next-line no-console
    console.error(`[section-renderer] section "${rawKey}" invalide :`, error);
    return <SectionFallback sectionKey={rawKey} />;
  }

  if (!validated.isEnabled) return null;

  const animationOverride =
    validated.animationOverride === "inherit" ? undefined : validated.animationOverride;

  const element = renderByKey(validated, locale, resolvedContent);

  const wrapped = (
    <AnimationScopeOverride override={animationOverride}>
      <AnimationDetailScope override={validated.animationDetail}>{element}</AnimationDetailScope>
    </AnimationScopeOverride>
  );

  // Panneaux avancés de personnalisation (20 septembre 2026) — voir docs/12 §12.2.
  // Conteneur ADDITIONNEL posé UNIQUEMENT quand une surcharge existe : une section
  // sans styleOverride/spacingOverride/hoverEffect (les 5 templates déjà livrés,
  // aujourd'hui) traverse ce composant EXACTEMENT comme avant leur ajout — aucun DOM
  // supplémentaire, donc aucun risque de régression visuelle.
  const styleVars = tokens ? styleOverrideToCssVars(validated.styleOverride, tokens) : {};
  const hasStyle = hasStyleOverride(validated.styleOverride) && tokens !== undefined;
  const hasSpacing = Boolean(validated.spacingOverride);
  const hoverClass = hoverEffectClassName(validated.animationDetail?.hoverEffect);

  if (!hasStyle && !hasSpacing && !hoverClass) {
    return wrapped;
  }

  const spacingClassName = hasSpacing ? spacingClassNameForSection(validated.id) : undefined;

  return (
    <div className={[spacingClassName, hoverClass].filter(Boolean).join(" ")} style={styleVars}>
      {hasSpacing && spacingClassName && (
        <style>{spacingOverrideToMediaCss(spacingClassName, validated.spacingOverride!)}</style>
      )}
      {wrapped}
    </div>
  );
}

function renderByKey(
  instance: SectionInstance,
  locale: Locale,
  resolvedContent?: ResolvedContentBySectionId,
): React.ReactNode {
  switch (instance.sectionKey) {
    // Note sur les casts `as any` ci-dessous : le `switch` sur `instance.sectionKey`
    // garantit à l'exécution que `params` correspond au schéma de cette clé (déjà
    // validé plus haut par `validateSectionInstance`) ; TypeScript ne peut pas le
    // savoir statiquement puisque `SectionInstance.params` est typé
    // `Record<string, unknown>` — cast explicite et documenté, jamais silencieux.
    case "hero":
      return <HeroSection variant={instance.variant} params={instance.params as any} />;

    case "categories": {
      const content = resolvedContent?.[instance.id] as ResolvedCategoriesContent | undefined;
      if (!content) return <SectionFallback sectionKey="categories" />;
      return <CategoriesSection variant={instance.variant} content={content} locale={locale} />;
    }

    case "featured_products": {
      const content = resolvedContent?.[instance.id] as ResolvedProductsContent | undefined;
      if (!content) return <SectionFallback sectionKey="featured_products" />;
      return (
        <FeaturedProductsSection variant={instance.variant} content={content} locale={locale} />
      );
    }

    case "new_arrivals": {
      const content = resolvedContent?.[instance.id] as ResolvedProductsContent | undefined;
      if (!content) return <SectionFallback sectionKey="new_arrivals" />;
      return <NewArrivalsSection variant={instance.variant} content={content} locale={locale} />;
    }

    case "promotions": {
      const content = resolvedContent?.[instance.id] as ResolvedPromotionsContent | undefined;
      if (!content) return <SectionFallback sectionKey="promotions" />;
      return <PromotionsSection variant={instance.variant} content={content} />;
    }

    case "benefits":
      return (
        <BenefitsSection
          variant={instance.variant}
          params={instance.params as any}
          locale={locale}
        />
      );

    case "testimonials":
      return (
        <TestimonialsSection
          variant={instance.variant}
          params={instance.params as any}
          locale={locale}
        />
      );

    case "brands":
      return <BrandsSection variant={instance.variant} params={instance.params as any} />;

    case "gallery":
      return (
        <GallerySection
          variant={instance.variant}
          params={instance.params as any}
          locale={locale}
        />
      );

    case "video":
      return <VideoSection variant={instance.variant} params={instance.params as any} />;

    case "newsletter":
      return (
        <NewsletterSection
          variant={instance.variant}
          params={instance.params as any}
          locale={locale}
        />
      );

    case "faq":
      return (
        <FaqSection variant={instance.variant} params={instance.params as any} locale={locale} />
      );

    case "cta":
      return <CtaSection variant={instance.variant} params={instance.params as any} />;

    case "contact":
      return (
        <ContactSection
          variant={instance.variant}
          params={instance.params as any}
          locale={locale}
        />
      );

    case "whatsapp":
      return (
        <WhatsappSection
          variant={instance.variant}
          params={instance.params as any}
          locale={locale}
        />
      );

    case "custom_content":
      return <CustomContentSection variant={instance.variant} params={instance.params as any} />;

    case "brand_manifesto":
      return <BrandManifestoSection variant={instance.variant} params={instance.params as any} />;

    case "signature_product":
      return <SignatureProductSection variant={instance.variant} params={instance.params as any} />;

    case "heritage":
      return <HeritageSection variant={instance.variant} params={instance.params as any} />;

    case "lookbook": {
      const content = resolvedContent?.[instance.id] as ResolvedLookbookContent | undefined;
      return (
        <LookbookSection
          variant={instance.variant}
          params={instance.params as any}
          content={content}
          locale={locale}
        />
      );
    }

    case "designers": {
      const content = resolvedContent?.[instance.id] as ResolvedDesignersContent | undefined;
      if (!content) return <SectionFallback sectionKey="designers" />;
      return <DesignersSection variant={instance.variant} content={content} locale={locale} />;
    }

    case "provenance":
      return (
        <ProvenanceSection
          variant={instance.variant}
          params={instance.params as any}
          locale={locale}
        />
      );

    case "catalog_search":
      return <CatalogSearchSection variant={instance.variant} params={instance.params as any} />;

    // Sections immersives : les réglages sont repassés par leur schéma pour obtenir les
    // valeurs PAR DÉFAUT (la validation d'instance contrôle sans les appliquer) — une
    // section enregistrée avec seulement un titre s'affiche donc complète.
    case "immersive_hero":
      return <ImmersiveHeroSection variant={instance.variant} params={sectionParamSchemas.immersive_hero.parse(instance.params)} />;

    case "immersive_showcase": {
      // Sélection calculée ici (fonction pure), depuis le réservoir fourni par le serveur
      // ou l'éditeur — un carrousel tout juste ajouté dans l'éditeur affiche donc déjà
      // les vrais contenus de l'entreprise, sans aller-retour serveur.
      const pool = resolvedContent?.[SHOWCASE_POOL_KEY];
      const params = sectionParamSchemas.immersive_showcase.parse(instance.params);
      const items = selectShowcaseItems(params, isShowcasePool(pool) ? pool : undefined);
      return <ImmersiveShowcaseSection variant={instance.variant} params={params} items={items} />;
    }

    case "scroll_story":
      return <ScrollStorySection variant={instance.variant} params={sectionParamSchemas.scroll_story.parse(instance.params)} />;

    default: {
      // Exhaustivité : si un 17e type de section est ajouté à SECTION_KEYS sans être
      // traité ici, TypeScript signale ce chemin comme inatteignable — jamais un
      // rendu silencieusement manquant.
      const exhaustiveCheck: never = instance.sectionKey;
      return <SectionFallback sectionKey={String(exhaustiveCheck)} />;
    }
  }
}
