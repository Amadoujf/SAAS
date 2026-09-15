import "server-only";
import { randomUUID } from "node:crypto";
import type { SectionInstance } from "@yamacommerce/templates";
import {
  checkPublishReadiness,
  computeChangesSummary,
  resolveScheduledPublishUtc,
  type ChangesSummary,
  type PublishReadinessInput,
  type PublishReadinessReport,
} from "@yamacommerce/publishing";
import { InMemoryDistributedLock, LockAcquisitionError, withLock } from "@yamacommerce/queue";

/**
 * Démonstration de la publication définitive — voir docs/12 §12.3 : « Utilise
 * l'adaptateur local pour la démonstration, mais conserve exactement la même
 * interface pour PostgreSQL, BullMQ et R2. ».
 *
 * RÉUTILISE le VRAI code partagé avec la production : `checkPublishReadiness`,
 * `computeChangesSummary`, `resolveScheduledPublishUtc` (@yamacommerce/publishing,
 * 100% pur) et `InMemoryDistributedLock`/`withLock` (@yamacommerce/queue — la MÊME
 * classe utilisée par les tests unitaires du pipeline réel, voir
 * publish-pipeline.test.ts). Seule la couche de STOCKAGE des versions est simplifiée
 * (tableaux en mémoire de processus plutôt que `TenantSiteVersion`/`Page` via Prisma) —
 * documenté ici plutôt que dupliquer @yamacommerce/database `site-versions-registry.ts`
 * dans une version "démo" parallèle, qui apporterait plus de code à maintenir que de
 * valeur pédagogique.
 *
 * Quatre "simulations" (cases à cocher, voir components/editor/publish-panel.tsx)
 * injectent directement les conditions que `checkPublishReadiness` sait bloquer —
 * sans avoir besoin d'un vrai tenant/abonnement/domaine/média pour les démontrer.
 *
 * `globalThis` — même raison que `demo-media-context.ts` : chaque route Next.js en
 * développement est un bundle webpack séparé.
 */

export interface DemoPage {
  id: string;
  slug: string;
  title: string;
  isHome: boolean;
  blocks: SectionInstance[];
}

export type DemoVersionStatus = "draft" | "scheduled" | "published" | "archived";

export interface DemoVersion {
  id: string;
  status: DemoVersionStatus;
  versionNumber: number | null;
  publishMessage: string | null;
  changesSummary: ChangesSummary | null;
  wasScheduled: boolean;
  restoredFromVersionId: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  pages: DemoPage[];
}

export interface DemoSimulationToggles {
  tenantSuspended: boolean;
  subscriptionExpired: boolean;
  domainMissing: boolean;
  privateMediaReferenced: boolean;
}

interface DemoPublishingState {
  versions: DemoVersion[];
  versionCounter: number;
  lock: InMemoryDistributedLock;
}

const globalForDemoPublishing = globalThis as typeof globalThis & {
  __yamacommerceDemoPublishing?: DemoPublishingState;
};

function seedPages(title: string): DemoPage[] {
  return [
    {
      id: randomUUID(),
      slug: "accueil",
      title: "Accueil",
      isHome: true,
      blocks: [
        {
          id: "hero-1",
          sectionKey: "hero",
          variant: "split",
          order: 0,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            title,
            media: { url: "https://images.unsplash.com/photo-1441986300917-64674bd600d8", alt: "Boutique" },
          },
        },
      ],
    },
  ];
}

function initialState(): DemoPublishingState {
  const now = new Date();
  const published: DemoVersion = {
    id: randomUUID(),
    status: "published",
    versionNumber: 1,
    publishMessage: "Mise en ligne initiale",
    changesSummary: computeChangesSummary([], seedPages("Bienvenue").map(toSnapshot)),
    wasScheduled: false,
    restoredFromVersionId: null,
    scheduledAt: null,
    publishedAt: now.toISOString(),
    createdAt: now.toISOString(),
    pages: seedPages("Bienvenue"),
  };
  const draft: DemoVersion = {
    id: randomUUID(),
    status: "draft",
    versionNumber: null,
    publishMessage: null,
    changesSummary: null,
    wasScheduled: false,
    restoredFromVersionId: null,
    scheduledAt: null,
    publishedAt: null,
    createdAt: now.toISOString(),
    pages: seedPages("Bienvenue"),
  };
  return { versions: [published, draft], versionCounter: 1, lock: new InMemoryDistributedLock() };
}

const state: DemoPublishingState =
  globalForDemoPublishing.__yamacommerceDemoPublishing ??
  (globalForDemoPublishing.__yamacommerceDemoPublishing = initialState());

function toSnapshot(page: DemoPage) {
  return { slug: page.slug, title: page.title, contentFingerprint: JSON.stringify(page.blocks) };
}

function findDraft(): DemoVersion {
  const draft = state.versions.find((v) => v.status === "draft");
  if (draft) return draft;
  const created: DemoVersion = {
    id: randomUUID(),
    status: "draft",
    versionNumber: null,
    publishMessage: null,
    changesSummary: null,
    wasScheduled: false,
    restoredFromVersionId: null,
    scheduledAt: null,
    publishedAt: null,
    createdAt: new Date().toISOString(),
    pages: seedPages("Bienvenue"),
  };
  state.versions.push(created);
  return created;
}

function findPublished(): DemoVersion | undefined {
  return state.versions.find((v) => v.status === "published");
}

export function getDemoPublishingSnapshot() {
  return {
    draft: findDraft(),
    published: findPublished() ?? null,
    history: [...state.versions]
      .filter((v) => v.status === "published" || v.status === "archived" || v.status === "scheduled")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  };
}

function buildReadinessInput(pages: DemoPage[], toggles: DemoSimulationToggles): PublishReadinessInput {
  return {
    tenantStatus: toggles.tenantSuspended ? "SUSPENDED" : "ACTIVE",
    subscriptionStatus: toggles.subscriptionExpired ? "CANCELED" : "ACTIVE",
    templateStatus: "published",
    hasActiveVerifiedDomain: !toggles.domainMissing,
    requestedDomainOwnerTenantId: null,
    currentTenantId: "demo-tenant-publication",
    isPublicationAlreadyInProgress: false,
    draftPages: pages.map((p) => ({ slug: p.slug, title: p.title, isHome: p.isHome, blocks: p.blocks })),
    mediaReferences: toggles.privateMediaReferenced
      ? [
          {
            url: "demo://document-sensible.pdf",
            pageSlug: pages[0]?.slug ?? "accueil",
            sectionId: "demo-document",
            status: "READY",
            isSensitiveDocument: true,
          },
        ]
      : [],
  };
}

const DEMO_LOCK_KEY = "demo-site-publish";
const DEMO_LOCK_TTL_MS = 15_000;

export type DemoPublishOutcome =
  | { outcome: "published"; version: DemoVersion }
  | { outcome: "blocked"; report: PublishReadinessReport }
  | { outcome: "already_in_progress" };

export async function demoPublishNow(
  toggles: DemoSimulationToggles,
  publishMessage?: string,
): Promise<DemoPublishOutcome> {
  try {
    return await withLock(state.lock, DEMO_LOCK_KEY, DEMO_LOCK_TTL_MS, async () => runDemoPublish(toggles, publishMessage));
  } catch (error) {
    if (error instanceof LockAcquisitionError) return { outcome: "already_in_progress" };
    throw error;
  }
}

/** Exposé séparément pour la démonstration "deux publications concurrentes" (voir
 *  publish-panel.tsx) : simule une opération plus longue avant de publier réellement,
 *  pour qu'un second clic pendant ce délai heurte bien le verrou. */
export async function demoPublishNowSlow(
  toggles: DemoSimulationToggles,
  delayMs: number,
): Promise<DemoPublishOutcome> {
  try {
    return await withLock(state.lock, DEMO_LOCK_KEY, DEMO_LOCK_TTL_MS, async () => {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return runDemoPublish(toggles, undefined);
    });
  } catch (error) {
    if (error instanceof LockAcquisitionError) return { outcome: "already_in_progress" };
    throw error;
  }
}

function runDemoPublish(toggles: DemoSimulationToggles, publishMessage: string | undefined): DemoPublishOutcome {
  const draft = findDraft();
  const readinessInput = buildReadinessInput(draft.pages, toggles);
  const report = checkPublishReadiness(readinessInput);
  if (!report.canPublish) {
    return { outcome: "blocked", report };
  }

  const previousPublished = findPublished();
  const changesSummary = computeChangesSummary(
    (previousPublished?.pages ?? []).map(toSnapshot),
    draft.pages.map(toSnapshot),
  );
  if (previousPublished) previousPublished.status = "archived";

  state.versionCounter += 1;
  draft.status = "published";
  draft.versionNumber = state.versionCounter;
  draft.publishMessage = publishMessage ?? null;
  draft.changesSummary = changesSummary;
  draft.publishedAt = new Date().toISOString();

  const newDraft: DemoVersion = {
    id: randomUUID(),
    status: "draft",
    versionNumber: null,
    publishMessage: null,
    changesSummary: null,
    wasScheduled: false,
    restoredFromVersionId: null,
    scheduledAt: null,
    publishedAt: null,
    createdAt: new Date().toISOString(),
    pages: draft.pages.map((p) => ({ ...p, id: randomUUID() })),
  };
  state.versions.push(newDraft);

  return { outcome: "published", version: draft };
}

export type DemoScheduleOutcome =
  | { outcome: "scheduled"; version: DemoVersion }
  | { outcome: "blocked"; report: PublishReadinessReport };

export function demoSchedulePublish(
  toggles: DemoSimulationToggles,
  dateTimeLocal: string,
  timeZone: string,
): DemoScheduleOutcome {
  const draft = findDraft();
  const report = checkPublishReadiness(buildReadinessInput(draft.pages, toggles));
  if (!report.canPublish) return { outcome: "blocked", report };

  const scheduledAtUtc = resolveScheduledPublishUtc(dateTimeLocal, timeZone);
  draft.status = "scheduled";
  draft.scheduledAt = scheduledAtUtc.toISOString();
  return { outcome: "scheduled", version: draft };
}

export function demoCancelSchedule(versionId: string): void {
  const version = state.versions.find((v) => v.id === versionId);
  if (version && version.status === "scheduled") {
    version.status = "draft";
    version.scheduledAt = null;
  }
}

/** Simule le job planifié qui promeut une version "scheduled" arrivée à échéance —
 *  voir promoteScheduledPublish (schedule-pipeline.ts) pour l'équivalent réel. */
export async function demoPromoteScheduled(versionId: string): Promise<DemoPublishOutcome> {
  const version = state.versions.find((v) => v.id === versionId);
  if (!version || version.status !== "scheduled") {
    return { outcome: "already_in_progress" }; // déjà traité (idempotence) — réutilise ce statut pour l'UI démo.
  }
  return withLock(state.lock, DEMO_LOCK_KEY, DEMO_LOCK_TTL_MS, async () => {
    version.wasScheduled = true;
    const previousPublished = findPublished();
    const changesSummary = computeChangesSummary(
      (previousPublished?.pages ?? []).map(toSnapshot),
      version.pages.map(toSnapshot),
    );
    if (previousPublished) previousPublished.status = "archived";
    state.versionCounter += 1;
    version.status = "published";
    version.versionNumber = state.versionCounter;
    version.changesSummary = changesSummary;
    version.publishedAt = new Date().toISOString();

    if (!state.versions.some((v) => v.status === "draft")) {
      state.versions.push({
        id: randomUUID(),
        status: "draft",
        versionNumber: null,
        publishMessage: null,
        changesSummary: null,
        wasScheduled: false,
        restoredFromVersionId: null,
        scheduledAt: null,
        publishedAt: null,
        createdAt: new Date().toISOString(),
        pages: version.pages.map((p) => ({ ...p, id: randomUUID() })),
      });
    }
    return { outcome: "published", version };
  });
}

export function demoRestoreIntoDraft(sourceVersionId: string): DemoVersion {
  const source = state.versions.find((v) => v.id === sourceVersionId);
  if (!source) throw new Error("Version introuvable.");
  const draft = findDraft();
  draft.pages = source.pages.map((p) => ({ ...p, id: randomUUID() }));
  return draft;
}

export async function demoRestoreAndPublish(
  sourceVersionId: string,
  toggles: DemoSimulationToggles,
): Promise<DemoPublishOutcome> {
  const source = state.versions.find((v) => v.id === sourceVersionId);
  if (!source) throw new Error("Version introuvable.");
  demoRestoreIntoDraft(sourceVersionId);
  const result = await demoPublishNow(toggles, `Restauration de la version ${source.versionNumber ?? "?"}`);
  if (result.outcome === "published") {
    result.version.restoredFromVersionId = sourceVersionId;
  }
  return result;
}

/** Mute `state` EN PLACE plutôt que de réassigner `globalForDemoPublishing...` — ce
 *  dernier ne changerait pas la référence déjà capturée par la constante `state`
 *  ci-dessus, utilisée partout ailleurs dans ce module. */
export function resetDemoPublishingState(): void {
  const fresh = initialState();
  state.versions = fresh.versions;
  state.versionCounter = fresh.versionCounter;
  state.lock = fresh.lock;
}
