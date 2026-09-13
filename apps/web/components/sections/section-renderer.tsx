import { validateSectionInstance, type SectionInstance } from "@yamacommerce/templates";
import type { Locale } from "@/lib/i18n";
import { AnimationScopeOverride } from "@/lib/motion/animation-level-context";
import { SectionFallback } from "@/components/ui/section-fallback";
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
import type {
  ResolvedCategoriesContent,
  ResolvedProductsContent,
  ResolvedPromotionsContent,
} from "./content-types";

/**
 * Contenu résolu (catalogue) par identifiant de section — voir content-types.ts pour
 * l'explication de la séparation config validée / contenu résolu. Fourni par
 * l'appelant (page de démonstration ou, plus tard, le chargeur de données par tenant) ;
 * le moteur de rendu lui-même ne déclenche jamais de requête.
 */
export type ResolvedContentBySectionId = Record<
  string,
  ResolvedCategoriesContent | ResolvedProductsContent | ResolvedPromotionsContent
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
}: {
  instance: unknown;
  locale: Locale;
  resolvedContent?: ResolvedContentBySectionId;
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

  return <AnimationScopeOverride override={animationOverride}>{element}</AnimationScopeOverride>;
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

    default: {
      // Exhaustivité : si un 17e type de section est ajouté à SECTION_KEYS sans être
      // traité ici, TypeScript signale ce chemin comme inatteignable — jamais un
      // rendu silencieusement manquant.
      const exhaustiveCheck: never = instance.sectionKey;
      return <SectionFallback sectionKey={String(exhaustiveCheck)} />;
    }
  }
}
