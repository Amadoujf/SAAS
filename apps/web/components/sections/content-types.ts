import type { z } from "zod";
import { sectionParamSchemas } from "@yamacommerce/templates";
import type { ProductCardData } from "@/components/ui/product-card";

/**
 * Deux familles de props pour les sections :
 *
 * 1. La plupart des sections (hero, benefits, testimonials, brands, gallery, video,
 *    newsletter, faq, cta, contact, whatsapp, custom_content) sont autoporteuses :
 *    leur configuration validée (`params`, voir @yamacommerce/templates) EST le
 *    contenu à afficher.
 * 2. Quatre sections référencent un catalogue par identifiants (categories,
 *    featured_products, new_arrivals, promotions) : leurs `params` sont validés tels
 *    quels (structure des identifiants), mais le RENDU consomme un contenu déjà
 *    résolu (voir `section-renderer.tsx`) — jamais de requête déclenchée depuis le
 *    composant de présentation lui-même.
 */

export type HeroParams = z.infer<typeof sectionParamSchemas.hero>;
export type BenefitsParams = z.infer<typeof sectionParamSchemas.benefits>;
export type TestimonialsParams = z.infer<typeof sectionParamSchemas.testimonials>;
export type BrandsParams = z.infer<typeof sectionParamSchemas.brands>;
export type GalleryParams = z.infer<typeof sectionParamSchemas.gallery>;
export type VideoParams = z.infer<typeof sectionParamSchemas.video>;
export type NewsletterParams = z.infer<typeof sectionParamSchemas.newsletter>;
export type FaqParams = z.infer<typeof sectionParamSchemas.faq>;
export type CtaParams = z.infer<typeof sectionParamSchemas.cta>;
export type ContactParams = z.infer<typeof sectionParamSchemas.contact>;
export type WhatsappParams = z.infer<typeof sectionParamSchemas.whatsapp>;
export type CustomContentParams = z.infer<typeof sectionParamSchemas.custom_content>;

export interface ResolvedCategoryItem {
  id: string;
  name: string;
  imageUrl: string;
  href: string;
}
export interface ResolvedCategoriesContent {
  title?: string;
  categories: ResolvedCategoryItem[];
}

export interface ResolvedProductsContent {
  title?: string;
  products: ProductCardData[];
}

export interface ResolvedPromotionsContent {
  title?: string;
  headline: string;
  description?: string;
  discountLabel?: string;
  imageUrl?: string;
  ctaLabel: string;
  ctaHref: string;
}
