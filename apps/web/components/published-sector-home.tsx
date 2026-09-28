import type { TenantSiteRenderProps } from "@/lib/rendering/resolve-tenant-site";
import type { StoreContext } from "@/lib/storefront/store-context";
import type { EstateContext } from "@/lib/real-estate/estate-context";
import { RenderTemplatePage } from "@/components/render-template-page";
import { SiteShell } from "@/components/site-shell";
import { StoreShell } from "@/components/store/store-shell";
import { EstateShell } from "@/components/estate/estate-shell";
import type { TravelContext } from "@/lib/travel/travel-context";
import { TravelShell } from "@/components/travel/travel-shell";
import type { SalonContext } from "@/lib/salon/salon-context";
import { SalonShell } from "@/components/salon/salon-shell";
import type { HotelContext } from "@/lib/hotel/hotel-context";
import { HotelShell } from "@/components/hotel/hotel-shell";
import type { RestaurantContext } from "@/lib/restaurant/restaurant-context";
import { RestaurantShell } from "@/components/restaurant/restaurant-shell";
import { RestaurantEssentials } from "@/components/restaurant/restaurant-essentials";

/**
 * Accueil PUBLIÉ depuis l'éditeur, dans l'habillage de SON secteur : une boutique garde
 * son en-tête (catégories, recherche, panier) et son pied de page, une agence le sien
 * (acheter, louer, appel) — le moteur de sections ne remplace que le contenu central.
 * `SiteShell` fournit les contextes (langue, devise, panier des sections historiques)
 * attendus par certaines sections du catalogue.
 */
export function PublishedSectorHome({ site, store, estate, travel, salon, hotel, restaurant, annotate = false }: { site: TenantSiteRenderProps; store?: StoreContext; estate?: EstateContext; travel?: TravelContext; salon?: SalonContext; hotel?: HotelContext; restaurant?: RestaurantContext; annotate?: boolean }) {
  const page = site.manifest.pages.find((p) => p.isHome) ?? site.manifest.pages[0];
  if (!page) return null;
  const content = (
    <SiteShell tokens={site.tokens} animationLevel={site.animationLevel}>
      <RenderTemplatePage page={page} tokens={site.tokens} animationLevel={site.animationLevel} resolvedContent={site.resolvedContent} locale="fr" annotate={annotate} />
    </SiteShell>
  );
  if (store) return <StoreShell store={store} preview={annotate}>{content}</StoreShell>;
  if (estate) return <EstateShell estate={estate}>{content}</EstateShell>;
  if (travel) return <TravelShell travel={travel}>{content}</TravelShell>;
  if (salon) return <SalonShell salon={salon}>{content}</SalonShell>;
  if (hotel) return <HotelShell hotel={hotel}>{content}</HotelShell>;
  // Restaurant : la page composée (scène, récits…) puis, toujours, commander / réserver.
  if (restaurant) return <RestaurantShell restaurant={restaurant}>{content}<RestaurantEssentials restaurant={restaurant} /></RestaurantShell>;
  return content;
}
