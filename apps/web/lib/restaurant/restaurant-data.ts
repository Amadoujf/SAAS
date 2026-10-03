import "server-only";
import { withTenant, getMenu, pickupSlots, serviceStatus } from "@yamacommerce/database";

export interface MenuDish {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  imageDemo: boolean;
  badges: string[];
  isAvailable: boolean;
  groups: { id: string; name: string; min: number; max: number; options: { id: string; name: string; priceDelta: number; isAvailable: boolean }[] }[];
}
export interface MenuSectionData {
  id: string;
  name: string;
  description: string | null;
  /** Plage de service (minutes) ; null = toute la journée. */
  window: { from: number; to: number } | null;
  dishes: MenuDish[];
}

/** Carte publique (rubriques et plats actifs ; les épuisés restent visibles, grisés). */
export async function loadMenu(tenantId: string): Promise<MenuSectionData[]> {
  const sections = await withTenant(tenantId, (tx) => getMenu(tx, tenantId, { publicOnly: true }));
  return sections
    .filter((s) => s.dishes.length > 0)
    .map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      window: s.availableFrom != null && s.availableTo != null ? { from: s.availableFrom, to: s.availableTo } : null,
      dishes: s.dishes.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        price: d.price,
        imageUrl: d.imageUrl,
        imageDemo: d.imageDemo,
        badges: d.badges,
        isAvailable: d.isAvailable,
        groups: d.optionGroups.map((g) => ({ id: g.id, name: g.name, min: g.minChoices, max: g.maxChoices, options: g.options.map((o) => ({ id: o.id, name: o.name, priceDelta: o.priceDelta, isAvailable: o.isAvailable })) })),
      })),
    }));
}

/** Ouvert maintenant ? Heure de fermeture, prochaine ouverture, heures de retrait du jour. */
export async function loadService(tenantId: string) {
  const [status, pickup] = await withTenant(tenantId, (tx) => Promise.all([serviceStatus(tx, tenantId), pickupSlots(tx, tenantId)]));
  return {
    open: status.open,
    minute: status.minute,
    today: status.today,
    closesAt: status.closesAt,
    next: status.next,
    pickup: pickup.slots.map((s) => ({ minute: s.minute, at: s.at.toISOString() })),
  };
}
export type ServiceState = Awaited<ReturnType<typeof loadService>>;
