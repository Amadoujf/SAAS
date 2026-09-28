import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@yamacommerce/database";
import { getOrCreateDraftVersion, updatePageBlocks } from "@yamacommerce/database";
import { DEFAULT_DESIGN_TOKENS, type DesignTokens } from "@yamacommerce/design-tokens";
import type { SectionInstance } from "@yamacommerce/templates";
import { applyBranding } from "@/lib/storefront/home-content";
import { siteStyleTokens } from "./style-tokens";
import { isFontPair, isShape } from "@/lib/storefront/brand-kit";
import type { SiteState } from "./operations";
import type { SiteIdentity, SiteMotion } from "./types";
import { canonicalJson } from "./canonical-json";

/**
 * L'UNIQUE brouillon du site, vu par « Mon site », l'assistant, l'éditeur avancé et la
 * publication : les sections de la page d'accueil (Page du brouillon) + l'identité et
 * les animations proposées (`TenantSiteVersion.settings`). Rien de tout cela n'est en
 * ligne avant la publication.
 */

export interface DraftSettings {
  identity: SiteIdentity & { logoUrl: string | null };
  motion: SiteMotion;
}

export interface DraftSnapshot {
  blocks: SectionInstance[];
  settings: DraftSettings;
}

export interface LoadedDraft {
  versionId: string;
  homePageId: string;
  snapshot: DraftSnapshot;
  signature: string;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const color = (v: unknown) => (typeof v === "string" && HEX.test(v) ? v : null);

/** Identité et animations EN LIGNE (source : « Mon site » + réglages du site). */
export async function liveSettings(tx: Prisma.TransactionClient, tenantId: string): Promise<DraftSettings> {
  const [tenant, site] = await Promise.all([
    tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { branding: true } }),
    tx.tenantSite.findUnique({ where: { tenantId }, select: { animationLevelOverride: true, designTokenOverrides: true, template: { select: { defaultAnimationLevel: true } } } }),
  ]);
  const b = (tenant.branding ?? {}) as Record<string, unknown>;
  const style = str(b.templatePreference) ?? "sunu-marche";
  const overrides = (site?.designTokenOverrides ?? {}) as { animation?: { mobile?: string } };
  const level = (site?.animationLevelOverride ?? site?.template.defaultAnimationLevel ?? siteStyleTokens(style)?.animation.level ?? "dynamic") as SiteMotion["level"];
  const mobile = (["same", "reduced", "none"].includes(overrides.animation?.mobile ?? "") ? overrides.animation!.mobile : "same") as SiteMotion["mobile"];
  return {
    identity: {
      style,
      primaryColor: color(b.primaryColor),
      accentColor: color(b.accentColor),
      backgroundColor: color(b.backgroundColor),
      fontPair: isFontPair(b.fontPair) ? b.fontPair : null,
      shape: isShape(b.shape) ? b.shape : null,
      logoUrl: str(b.logoUrl),
    },
    motion: { level: ["discreet", "dynamic", "immersive"].includes(level) ? level : "dynamic", mobile },
  };
}

export function draftSignature(snapshot: DraftSnapshot): string {
  const blocks = snapshot.blocks.map((b, i) => ({ ...b, order: i }));
  return createHash("sha256").update(canonicalJson([blocks, snapshot.settings])).digest("hex").slice(0, 32);
}

/** Brouillon courant (créé depuis la version publiée s'il n'existe pas), VERROUILLÉ
 *  jusqu'à la fin de la transaction : deux modifications simultanées s'enchaînent,
 *  elles ne s'écrasent jamais. */
export async function loadDraft(tx: Prisma.TransactionClient, tenantId: string, tenantSiteId: string, lock = false): Promise<LoadedDraft> {
  const draft = await getOrCreateDraftVersion(tx, tenantId, tenantSiteId);
  if (lock) await tx.$queryRaw`SELECT id FROM "TenantSiteVersion" WHERE id = ${draft.id} FOR UPDATE`;
  const home = draft.pages.find((p) => p.isHome) ?? draft.pages[0];
  if (!home) throw new Error("Le brouillon n'a pas de page d'accueil.");
  const settings = isDraftSettings(draft.settings) ? draft.settings : await liveSettings(tx, tenantId);
  const snapshot = { blocks: home.blocks as unknown as SectionInstance[], settings };
  return { versionId: draft.id, homePageId: home.id, snapshot, signature: draftSignature(snapshot) };
}

export function isDraftSettings(value: unknown): value is DraftSettings {
  const v = value as DraftSettings | null;
  return Boolean(v && typeof v === "object" && v.identity && typeof v.identity.style === "string" && v.motion && typeof v.motion.level === "string");
}

export async function writeDraft(tx: Prisma.TransactionClient, draft: LoadedDraft, next: DraftSnapshot): Promise<string> {
  await updatePageBlocks(tx, draft.homePageId, next.blocks.map((b, i) => ({ ...b, order: i })));
  await tx.tenantSiteVersion.update({ where: { id: draft.versionId }, data: { settings: next.settings as unknown as Prisma.InputJsonValue } });
  return draftSignature(next);
}

export async function recordRevision(
  tx: Prisma.TransactionClient,
  tenantId: string,
  draft: LoadedDraft,
  input: { source: "ai" | "manual"; label: string; after: DraftSnapshot; aiJobId?: string; createdBy: string | null },
): Promise<string> {
  const row = await tx.siteRevision.create({
    data: {
      tenantId,
      tenantSiteVersionId: draft.versionId,
      source: input.source,
      label: input.label.slice(0, 200),
      before: draft.snapshot as unknown as Prisma.InputJsonValue,
      after: input.after as unknown as Prisma.InputJsonValue,
      afterSignature: draftSignature(input.after),
      aiJobId: input.aiJobId ?? null,
      createdBy: input.createdBy,
    },
    select: { id: true },
  });
  return row.id;
}

export function toSiteState(snapshot: DraftSnapshot): SiteState {
  const { logoUrl: _logo, ...identity } = snapshot.settings.identity;
  return { blocks: snapshot.blocks, identity, motion: snapshot.settings.motion };
}

export function fromSiteState(state: SiteState, logoUrl: string | null): DraftSnapshot {
  return { blocks: state.blocks, settings: { identity: { ...state.identity, logoUrl }, motion: state.motion } };
}

/** Design tokens d'un aperçu : style choisi + couleurs + animations du brouillon. */
export function previewTokens(settings: DraftSettings): DesignTokens {
  const base = siteStyleTokens(settings.identity.style) ?? DEFAULT_DESIGN_TOKENS;
  const branded = applyBranding(base, settings.identity);
  return { ...branded, animation: { ...branded.animation, level: settings.motion.level, mobile: settings.motion.mobile } };
}

/** Réglage d'identité fait à la main dans « Réglages avancés » (effet immédiat) :
 *  reporté dans le brouillon pour qu'une publication ultérieure ne l'annule pas. */
export async function patchDraftIdentity(tx: Prisma.TransactionClient, tenantId: string, patch: Partial<DraftSettings["identity"]>): Promise<void> {
  const site = await tx.tenantSite.findUnique({ where: { tenantId }, select: { id: true } });
  if (!site) return;
  const draft = await tx.tenantSiteVersion.findFirst({ where: { tenantSiteId: site.id, status: "draft" }, select: { id: true, settings: true } });
  if (!draft || !isDraftSettings(draft.settings)) return;
  const current = draft.settings as unknown as DraftSettings;
  const settings = { ...current, identity: { ...current.identity, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) } };
  await tx.tenantSiteVersion.update({ where: { id: draft.id }, data: { settings: settings as unknown as Prisma.InputJsonValue } });
}
