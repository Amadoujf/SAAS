import "server-only";
import {
  withTenant,
  listServices,
  listStaff,
  computeAvailability,
  addDays,
  utcToLocal,
  type MinuteRange,
} from "@yamacommerce/database";

export interface MenuItem {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  category: string;
  durationMinutes: number;
  price: number | null;
  priceFrom: boolean;
  onlineBooking: boolean;
  image: { url: string; alt: string; demo: boolean } | null;
  staffIds: string[];
}

export interface TeamMember {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  photoUrl: string | null;
  serviceIds: string[];
}

const mediaOf = (media: unknown) =>
  Array.isArray(media) ? media.filter((m): m is { url: string; alt?: string; demo?: boolean } => !!m && typeof (m as { url?: unknown }).url === "string") : [];

/** Plages d'ouverture du salon, jour par jour = union des horaires de l'équipe active. */
export function openingHours(staffHours: { weekday: number; startMinute: number; endMinute: number }[]) {
  const out: Record<number, MinuteRange[]> = {};
  for (let d = 0; d < 7; d++) {
    const ranges = staffHours.filter((h) => h.weekday === d).sort((a, b) => a.startMinute - b.startMinute);
    const merged: MinuteRange[] = [];
    for (const r of ranges) {
      const last = merged.at(-1);
      if (last && r.startMinute <= last.endMinute) last.endMinute = Math.max(last.endMinute, r.endMinute);
      else merged.push({ startMinute: r.startMinute, endMinute: r.endMinute });
    }
    out[d] = merged;
  }
  return out;
}

/** Carte des prestations publiées, équipe proposée en ligne, horaires d'ouverture. */
export async function loadSalonCatalog(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    const [services, staff] = await Promise.all([listServices(tx, tenantId, { publishedOnly: true }), listStaff(tx, tenantId, { activeOnly: true })]);
    const onlineStaff = staff.filter((s) => s.acceptsOnline);
    const menu: MenuItem[] = services
      .filter((s) => s.service)
      .map((s) => {
        const img = mediaOf(s.media)[0];
        return {
          id: s.id,
          slug: s.slug,
          title: s.title,
          summary: s.summary,
          category: s.service!.category,
          durationMinutes: s.service!.durationMinutes,
          price: s.price,
          priceFrom: s.service!.priceFrom,
          onlineBooking: s.service!.onlineBooking,
          image: img ? { url: img.url, alt: img.alt ?? s.title, demo: img.demo === true } : null,
          staffIds: s.service!.skills.filter((k) => k.staff.isActive && k.staff.acceptsOnline).map((k) => k.staffId),
        };
      });
    const team: TeamMember[] = onlineStaff.map((s) => ({ id: s.id, name: s.displayName, title: s.title, bio: s.bio, photoUrl: s.photoUrl, serviceIds: s.skills.map((k) => k.listingId) }));
    const categories = [...new Set(menu.map((m) => m.category))];
    return { menu, team, categories, hours: openingHours(staff.flatMap((s) => s.hours)) };
  });
}

/**
 * Prochain horaire RÉELLEMENT libre, toutes prestations en ligne confondues (la plus
 * courte), sur 7 jours — affiché sur l'accueil. `null` si rien n'est libre : on ne
 * l'invente jamais.
 */
export async function nextFreeSlot(tenantId: string, timezone: string, menu: MenuItem[]) {
  const candidate = menu.filter((m) => m.onlineBooking && m.staffIds.length).sort((a, b) => a.durationMinutes - b.durationMinutes)[0];
  if (!candidate) return null;
  const today = utcToLocal(new Date(), timezone).date;
  return withTenant(tenantId, async (tx) => {
    for (let i = 0; i < 7; i++) {
      const date = addDays(today, i);
      const { slots } = await computeAvailability(tx, tenantId, { listingId: candidate.id, date, public: true });
      if (slots[0]) return { startAt: slots[0].startAt, date, dayOffset: i };
    }
    return null;
  });
}
