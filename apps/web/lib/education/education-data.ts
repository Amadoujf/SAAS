import "server-only";
import { withTenant, listPrograms, getPublicProgramBySlug } from "@yamacommerce/database";
import type { Slot } from "./labels";

export interface ProgramCardData {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  tuition: number | null;
  featured: boolean;
  category: string;
  level: string | null;
  format: string;
  durationLabel: string | null;
  registrationFee: number;
  defaultInstallments: number;
  audience: string;
  images: { url: string; alt: string; demo: boolean }[];
}

export interface PublicClass {
  id: string;
  name: string;
  room: string | null;
  schedule: Slot[];
  startDate: string;
  endDate: string;
  capacity: number;
  remaining: number;
}

const mediaOf = (media: unknown) =>
  (Array.isArray(media) ? media : []).filter((m): m is { url: string; alt?: string; demo?: boolean } => !!m && typeof (m as { url?: unknown }).url === "string").map((m) => ({ url: m.url, alt: m.alt ?? "", demo: m.demo === true }));

type Row = Awaited<ReturnType<typeof listPrograms>>[number];

export function toProgramCard(l: Row): ProgramCardData {
  const p = l.program!;
  return {
    id: l.id,
    slug: l.slug,
    title: l.title,
    summary: l.summary,
    description: l.description,
    tuition: l.price,
    featured: l.featured,
    category: p.category,
    level: p.level,
    format: p.format,
    durationLabel: p.durationLabel,
    registrationFee: p.registrationFee,
    defaultInstallments: p.defaultInstallments,
    audience: p.audience,
    images: mediaOf(l.media).map((m) => ({ ...m, alt: m.alt || l.title })),
  };
}

export async function loadPrograms(tenantId: string, q: { category?: string } = {}) {
  const rows = await withTenant(tenantId, (tx) => listPrograms(tx, tenantId, { publishedOnly: true, category: q.category }));
  return rows.filter((r) => r.program).map(toProgramCard);
}

export async function loadProgram(tenantId: string, slug: string) {
  const row = await withTenant(tenantId, (tx) => getPublicProgramBySlug(tx, tenantId, slug));
  if (!row) return null;
  const classes: PublicClass[] = row.classes.map((c) => ({
    id: c.id,
    name: c.name,
    room: c.room,
    schedule: (c.schedule as unknown as Slot[]) ?? [],
    startDate: c.startDate.toISOString().slice(0, 10),
    endDate: c.endDate.toISOString().slice(0, 10),
    capacity: c.capacity,
    remaining: c.remaining,
  }));
  return { program: toProgramCard(row), classes };
}
