import "server-only";
import { z } from "zod";
import {
  AiUsageError,
  failAiJob,
  finishAiJob,
  getAiUsage,
  markAiJobApproved,
  startAiJob,
  updateTenantBranding,
  withTenant,
  type Prisma,
} from "@yamacommerce/database";
import { validateSectionInstance, type SectionInstance } from "@yamacommerce/templates";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { requireTenantPermission } from "@/lib/tenant-permissions";
import { AiProviderError, DEFAULT_MODEL, generateStructured, getAiStatus } from "@/lib/ai/provider";
import { releaseAiCall, reserveAiCall, settleAiCall } from "@/lib/ai/budget";
import { failedCallCharge } from "@/lib/ai/charge";
import { ensureTenantEditorSite, syncEditorSiteIdentity } from "@/lib/site-editor/tenant-site";
import { publishTenantDraft } from "@/lib/site-editor/editor-pipeline";
import { getHomeStatus } from "@/lib/site-editor/home-status";
import { checkImage } from "@/lib/media/image-refs";
import { loadSiteAiContext } from "./context";
import { compileDirection, distinctArchetypes, type CompiledSite } from "./compile";
import { ARCHETYPES } from "./archetypes";
import { canonicalJson } from "./canonical-json";
import { applyOperations, sectionLabel } from "./operations";
import { auditPhotos } from "./photo-audit";
import { DIRECTIONS_SYSTEM, EDIT_SYSTEM, IMPROVE_REQUEST, directionsPrompt, editPrompt } from "./prompts";
import { directionsOutputSchema, editOutputSchema, type AiEditOperation } from "./schemas";
import { simulateDirections, simulateEdit, simulateImprove } from "./simulate";
import { draftSignature, fromSiteState, loadDraft, recordRevision, toSiteState, writeDraft, type DraftSnapshot, type LoadedDraft } from "./site-state";
import { STYLE_WORDS, type SiteBrief } from "./types";

/**
 * Création et personnalisation du site assistées par IA — chaque action est serveur,
 * authentifiée, limitée à l'entreprise du membre (RLS) et à ses permissions :
 *   site.edit    → générer, proposer, appliquer, annuler, modifier une image
 *   site.publish → publier (toujours une action volontaire, jamais automatique)
 * Une génération n'écrit JAMAIS le brouillon : elle produit une proposition ; seule une
 * action explicite de l'entreprise l'applique (et reste annulable).
 */

export type StudioResult<T = unknown> = { ok: true; data: T } | { ok: false; status: number; error: string };

async function actor(permission: "site.edit" | "site.publish") {
  const membership = await getCurrentTenantMembership();
  if (!membership) return null;
  const allowed = await requireTenantPermission(membership.tenantId, permission);
  if (!allowed) return null;
  const tenantSiteId = await ensureTenantEditorSite(membership.tenantId, membership.tenantName);
  return { tenantId: membership.tenantId, tenantName: membership.tenantName, userId: allowed.userId, tenantSiteId };
}

const deny = { ok: false as const, status: 403, error: "Action non autorisée." };

function usageError(error: unknown): StudioResult<never> | null {
  if (error instanceof AiUsageError) return { ok: false, status: error.reason === "busy" ? 409 : 402, error: error.message };
  if (error instanceof AiProviderError) return { ok: false, status: error.reason === "unavailable" ? 503 : 502, error: error.message };
  return null;
}

/** Génération encadrée : budget de la plateforme réservé, quota vérifié, job journalisé,
 *  appel au fournisseur HORS transaction, coût imputé (réel, ou maximal s'il est
 *  inconnu), résultat ou échec enregistré. Ne touche jamais au brouillon. */
async function runJob<T>(
  who: { tenantId: string; userId: string },
  type: "site_directions" | "site_edit" | "site_improve",
  payload: Record<string, unknown>,
  call: () => Promise<{ data: T; model: string | null; simulated: boolean; inputTokens: number; outputTokens: number; costXOF: number }>,
  toOutput: (data: T) => Record<string, unknown>,
): Promise<{ jobId: string; output: Record<string, unknown>; simulated: boolean }> {
  const status = getAiStatus();
  if (!status.available) throw new AiProviderError("unavailable", status.reason ?? "IA indisponible.");
  const reservation = status.kind === "anthropic" ? await reserveAiCall(status.model ?? DEFAULT_MODEL) : null;
  let job: { id: string };
  try {
    job = await withTenant(who.tenantId, (tx) =>
      startAiJob(tx, who.tenantId, { type, payload: payload as Prisma.InputJsonValue, createdBy: who.userId, simulated: status.kind === "simulated", model: status.model, reservation }),
    );
  } catch (error) {
    if (reservation) await releaseAiCall(reservation);
    throw error;
  }
  let received: Awaited<ReturnType<typeof call>> | null = null;
  try {
    received = await call();
    const result = received;
    const output = toOutput(result.data);
    if (reservation) await settleAiCall(job.id, result.costXOF);
    await withTenant(who.tenantId, (tx) => finishAiJob(tx, who.tenantId, job.id, output as Prisma.InputJsonValue, result));
    return { jobId: job.id, output, simulated: result.simulated };
  } catch (error) {
    const providerError = error instanceof AiProviderError ? error : null;
    const charged = failedCallCharge({
      receivedCostXOF: received?.costXOF ?? null,
      billing: providerError?.billing ?? null,
      knownCostXOF: providerError?.usage.costXOF ?? 0,
      reservedXOF: reservation?.amountXOF ?? 0,
    });
    if (reservation) await settleAiCall(job.id, charged);
    const usage = received ? { inputTokens: received.inputTokens, outputTokens: received.outputTokens, costXOF: charged } : { ...(providerError?.usage ?? { inputTokens: 0, outputTokens: 0 }), costXOF: charged };
    await withTenant(who.tenantId, (tx) => failAiJob(tx, who.tenantId, job.id, error instanceof Error ? error.message : "Échec", usage));
    throw error;
  }
}

async function context(tx: Prisma.TransactionClient, who: { tenantId: string; tenantName: string }, draft: LoadedDraft) {
  return loadSiteAiContext(tx, who.tenantId, who.tenantName, draft.snapshot.settings.identity.logoUrl);
}

// --- Lecture : tout ce que « Mon site » affiche ------------------------------------

export async function loadStudio() {
  const who = await actor("site.edit");
  if (!who) return null;
  const ai = getAiStatus();
  return withTenant(who.tenantId, async (tx) => {
    const draft = await loadDraft(tx, who.tenantId, who.tenantSiteId);
    const ctx = await context(tx, who, draft);
    const [usage, homeStatus, lastRevision, jobs] = await Promise.all([
      getAiUsage(tx, who.tenantId),
      getHomeStatus(tx, who.tenantId),
      tx.siteRevision.findFirst({ where: { tenantId: who.tenantId, tenantSiteVersionId: draft.versionId, undoneAt: null }, orderBy: { createdAt: "desc" }, select: { id: true, label: true, source: true, afterSignature: true, createdAt: true } }),
      tx.aIGenerationJob.findMany({ where: { tenantId: who.tenantId, type: { in: ["site_directions", "site_edit", "site_improve"] } }, orderBy: { createdAt: "desc" }, take: 16 }),
    ]);
    const lastDirections = jobs.find((j) => j.type === "site_directions" && j.status === "completed");
    return {
      tenantName: who.tenantName,
      ai: { available: ai.available, simulated: ai.kind === "simulated", reason: ai.reason ?? null, usage },
      draft: { signature: draft.signature, snapshot: draft.snapshot, sections: draft.snapshot.blocks.map((b) => ({ id: b.id, label: sectionLabel(b), sectionKey: b.sectionKey, images: imageSlots(b) })) },
      homeStatus,
      audit: auditPhotos(ctx),
      catalog: {
        mode: ctx.mode ?? "commerce",
        products: ctx.products.length,
        illustrated: ctx.products.filter((p) => p.imageUrl).length,
        categories: ctx.categories.length,
        // Quelques vraies photos du catalogue : l'aperçu de création se construit avec elles.
        samples: ctx.products.filter((p) => p.imageUrl).slice(0, 8).map((p) => ({ name: p.name, imageUrl: p.imageUrl!, category: p.category })),
        categoryNames: ctx.categories.filter((c) => c.productCount > 0).map((c) => c.name).slice(0, 6),
      },
      canUndo: Boolean(lastRevision && lastRevision.afterSignature === draft.signature),
      lastRevision: lastRevision ? { label: lastRevision.label, source: lastRevision.source, at: lastRevision.createdAt.toISOString() } : null,
      brief: (lastDirections?.inputPayload as { brief?: SiteBrief } | null)?.brief ?? null,
      directions: lastDirections ? { jobId: lastDirections.id, chosen: lastDirections.approved, simulated: lastDirections.simulated, ...(lastDirections.outputPayload as object) } : null,
      conversation: jobs
        .filter((j) => j.type !== "site_directions")
        .reverse()
        .map((j) => ({
          jobId: j.id,
          status: j.status,
          request: (j.inputPayload as { message?: string }).message ?? "Améliorer mon site",
          simulated: j.simulated,
          applied: j.approved,
          error: j.errorMessage,
          ...(j.status === "completed" ? pickReply(j.outputPayload) : {}),
        })),
    };
  });
}

function pickReply(payload: unknown) {
  const p = (payload ?? {}) as { reply?: string; changes?: string[]; rejected?: string[]; focus?: string | null };
  return { reply: p.reply ?? "", changes: p.changes ?? [], rejected: p.rejected ?? [], focus: p.focus ?? null };
}

function firstChangedSection(before: SectionInstance[], after: SectionInstance[]): string | null {
  const previous = new Map(before.map((b) => [b.id, canonicalJson({ ...b, order: 0 })]));
  return after.find((b) => previous.get(b.id) !== canonicalJson({ ...b, order: 0 }))?.id ?? null;
}

/** Emplacements d'image d'une section, modifiables directement depuis l'aperçu. */
export function imageSlots(block: SectionInstance): { field: string; label: string; url: string | null }[] {
  const p = block.params as Record<string, unknown>;
  const slots: { field: string; label: string; url: string | null }[] = [];
  if (block.sectionKey === "immersive_hero") slots.push({ field: "subjectImage", label: "Image principale", url: (p.subjectImage as string) ?? null });
  if (block.sectionKey === "scroll_story") {
    slots.push({ field: "image", label: "Image du récit", url: (p.image as string) ?? null });
    ((p.steps as { imageUrl?: string; title?: string }[] | undefined) ?? []).forEach((s, i) => slots.push({ field: `steps.${i}.imageUrl`, label: `Étape ${i + 1}${s.title ? ` — ${s.title}` : ""}`, url: s.imageUrl ?? null }));
  }
  return slots;
}

// --- 1. Questionnaire → trois directions -------------------------------------------

export const briefSchema = z.object({
  activity: z.string().trim().min(10, "Décrivez votre activité en une ou deux phrases.").max(400),
  audience: z.string().trim().max(200).default(""),
  styles: z.array(z.enum(STYLE_WORDS)).max(3).default([]),
  likes: z.string().trim().max(300).default(""),
});

export async function generateDirections(raw: unknown): Promise<StudioResult<{ jobId: string }>> {
  const who = await actor("site.edit");
  if (!who) return deny;
  const parsed = briefSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400, error: parsed.error.issues[0]?.message ?? "Description invalide." };
  const brief = parsed.data;
  const ctx = await withTenant(who.tenantId, async (tx) => context(tx, who, await loadDraft(tx, who.tenantId, who.tenantSiteId)));
  if (!ctx.products.length) return { ok: false, status: 409, error: ctx.mode === "restaurant" ? "Ajoutez d'abord vos plats à la carte : l'assistant compose le site avec VOTRE carte." : ctx.mode === "automobile" ? "Publiez d'abord des véhicules de votre stock : l'assistant compose le site avec VOS véhicules." : ctx.mode === "education" ? "Publiez d'abord vos formations : l'assistant compose le site avec VOS formations." : "Ajoutez d'abord quelques produits à votre catalogue : l'assistant compose le site avec VOS produits." };
  const audit = auditPhotos(ctx);
  try {
    const { jobId } = await runJob(
      who,
      "site_directions",
      { brief },
      () => generateStructured({ system: DIRECTIONS_SYSTEM, prompt: directionsPrompt(brief, ctx, audit), schema: directionsOutputSchema, effort: "high", simulate: () => simulateDirections(brief, ctx) }),
      (data) => ({
        audit: audit.advice,
        directions: distinctArchetypes(data.directions).map((d) => {
          const compiled: CompiledSite = compileDirection(d, ctx);
          const archetype = ARCHETYPES[d.archetype];
          return {
            name: d.name,
            pitch: d.pitch,
            palette: d.palette,
            style: d.style,
            animation: d.animation,
            archetype: d.archetype,
            archetypeLabel: archetype.label,
            typography: d.typography,
            shape: d.shape,
            // Plan en mots simples, d'après les sections RÉELLEMENT composées.
            outline: archetype.slots.flatMap((slot, k) => (compiled.blocks.some((b) => b.id === slot.id) ? [archetype.outline[k] ?? slot.id] : [])),
            compiled,
          };
        }),
      }),
    );
    return { ok: true, data: { jobId } };
  } catch (error) {
    return usageError(error) ?? { ok: false, status: 500, error: "La génération a échoué. Votre site n'a pas été modifié." };
  }
}

// --- 2. Choix d'une direction → brouillon ------------------------------------------

export async function chooseDirection(raw: unknown): Promise<StudioResult<{ signature: string }>> {
  const who = await actor("site.edit");
  if (!who) return deny;
  const input = z.object({ jobId: z.string().uuid(), index: z.number().int().min(0).max(2) }).safeParse(raw);
  if (!input.success) return { ok: false, status: 400, error: "Choix invalide." };
  try {
    const signature = await withTenant(who.tenantId, async (tx) => {
      const job = await tx.aIGenerationJob.findFirst({ where: { id: input.data.jobId, tenantId: who.tenantId, type: "site_directions", status: "completed" } });
      const direction = (job?.outputPayload as { directions?: { name: string; compiled: CompiledSite }[] } | null)?.directions?.[input.data.index];
      if (!job || !direction) throw new Error("Proposition introuvable.");
      const draft = await loadDraft(tx, who.tenantId, who.tenantSiteId, true);
      // Revalidation au moment d'écrire : aucune section non conforme n'entre dans le brouillon.
      const blocks = direction.compiled.blocks.map((b) => validateSectionInstance(b));
      const next: DraftSnapshot = { blocks, settings: { identity: { ...direction.compiled.identity, logoUrl: draft.snapshot.settings.identity.logoUrl }, motion: direction.compiled.motion } };
      await recordRevision(tx, who.tenantId, draft, { source: "ai", label: `Direction « ${direction.name} » appliquée`, after: next, aiJobId: job.id, createdBy: who.userId });
      await markAiJobApproved(tx, who.tenantId, job.id, who.userId);
      return writeDraft(tx, draft, next);
    });
    return { ok: true, data: { signature } };
  } catch (error) {
    return { ok: false, status: 409, error: error instanceof Error ? error.message : "Application impossible." };
  }
}

// --- 3. Conversation : proposition limitée, prévisualisable ------------------------

export async function proposeEdit(raw: unknown): Promise<StudioResult<{ jobId: string }>> {
  const who = await actor("site.edit");
  if (!who) return deny;
  const input = z.object({ message: z.string().trim().min(2).max(500), selectedSectionId: z.string().max(80).nullable().default(null), improve: z.boolean().default(false) }).safeParse(raw);
  if (!input.success) return { ok: false, status: 400, error: "Message invalide." };
  const { message, selectedSectionId, improve } = input.data;
  const { draft, ctx, history } = await withTenant(who.tenantId, async (tx) => {
    const draft = await loadDraft(tx, who.tenantId, who.tenantSiteId);
    const jobs = await tx.aIGenerationJob.findMany({ where: { tenantId: who.tenantId, type: "site_edit", status: "completed" }, orderBy: { createdAt: "desc" }, take: 3 });
    const history = jobs.reverse().flatMap((j) => [
      { role: "client" as const, text: (j.inputPayload as { message?: string }).message ?? "" },
      { role: "assistant" as const, text: (j.outputPayload as { reply?: string }).reply ?? "" },
    ]);
    return { draft, ctx: await context(tx, who, draft), history };
  });
  const state = toSiteState(draft.snapshot);
  const request = improve ? IMPROVE_REQUEST : message;
  try {
    const { jobId } = await runJob(
      who,
      improve ? "site_improve" : "site_edit",
      { message: improve ? "Améliorer mon site avec l'IA" : message, selectedSectionId, baseSignature: draft.signature },
      () =>
        generateStructured({
          system: EDIT_SYSTEM,
          prompt: editPrompt(request, state, ctx, history, selectedSectionId),
          schema: editOutputSchema,
          effort: improve ? "high" : "medium",
          simulate: () => (improve ? simulateImprove(state, ctx) : simulateEdit(message, state, selectedSectionId, ctx.mode === "restaurant" ? "plats" : ctx.mode === "automobile" ? "véhicules" : ctx.mode === "education" ? "formations" : "produits")),
        }),
      (data) => {
        const result = applyOperations(state, data.operations, ctx);
        return {
          reply: data.reply,
          operations: data.operations,
          changes: result.changes,
          rejected: result.rejected,
          baseSignature: draft.signature,
          after: fromSiteState(result.state, draft.snapshot.settings.identity.logoUrl),
          // Première section ajoutée ou modifiée : l'aperçu de la proposition s'y rend.
          focus: firstChangedSection(state.blocks, result.state.blocks),
        };
      },
    );
    return { ok: true, data: { jobId } };
  } catch (error) {
    return usageError(error) ?? { ok: false, status: 500, error: "La proposition a échoué. Votre site n'a pas été modifié." };
  }
}

/** Applique une proposition au brouillon. Si le brouillon a changé entre-temps (autre
 *  onglet, modification manuelle), les MÊMES opérations sont rejouées sur l'état
 *  actuel — elles ne visent que leurs cibles — ; si elles ne s'appliquent plus
 *  entièrement, rien n'est écrit et l'entreprise est invitée à redemander. */
export async function applyProposal(raw: unknown): Promise<StudioResult<{ signature: string; changes: string[] }>> {
  const who = await actor("site.edit");
  if (!who) return deny;
  const input = z.object({ jobId: z.string().uuid() }).safeParse(raw);
  if (!input.success) return { ok: false, status: 400, error: "Proposition invalide." };
  try {
    const result = await withTenant(who.tenantId, async (tx) => {
      const job = await tx.aIGenerationJob.findFirst({ where: { id: input.data.jobId, tenantId: who.tenantId, type: { in: ["site_edit", "site_improve"] }, status: "completed" } });
      const out = job?.outputPayload as { operations: AiEditOperation[]; changes: string[]; baseSignature: string; after: DraftSnapshot; reply: string } | null;
      if (!job || !out) throw new Error("Proposition introuvable.");
      if (job.approved) throw new Error("Cette proposition a déjà été appliquée.");
      if (!out.changes.length) throw new Error("Cette proposition ne contient aucune modification à appliquer.");
      const draft = await loadDraft(tx, who.tenantId, who.tenantSiteId, true);
      let next = out.after;
      let changes = out.changes;
      if (draft.signature !== out.baseSignature) {
        const replay = applyOperations(toSiteState(draft.snapshot), out.operations, await context(tx, who, draft));
        if (replay.rejected.length > 0 || replay.changes.length !== out.changes.length) {
          throw new Error("Votre site a été modifié depuis cette proposition : redemandez-la pour qu'elle tienne compte des derniers changements.");
        }
        next = fromSiteState(replay.state, draft.snapshot.settings.identity.logoUrl);
        changes = replay.changes;
      }
      next = { ...next, blocks: next.blocks.map((b) => validateSectionInstance(b)) };
      await recordRevision(tx, who.tenantId, draft, { source: "ai", label: changes.length === 1 ? changes[0]! : `${changes.length} modifications de l'assistant`, after: next, aiJobId: job.id, createdBy: who.userId });
      await markAiJobApproved(tx, who.tenantId, job.id, who.userId);
      return { signature: await writeDraft(tx, draft, next), changes };
    });
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, status: 409, error: error instanceof Error ? error.message : "Application impossible." };
  }
}

/** Annule la DERNIÈRE modification du brouillon (assistant ou manuelle), tant que rien
 *  n'a changé depuis — jamais un retour en arrière qui effacerait un travail plus récent. */
export async function undoLastChange(): Promise<StudioResult<{ signature: string; label: string }>> {
  const who = await actor("site.edit");
  if (!who) return deny;
  try {
    const result = await withTenant(who.tenantId, async (tx) => {
      const draft = await loadDraft(tx, who.tenantId, who.tenantSiteId, true);
      const last = await tx.siteRevision.findFirst({ where: { tenantId: who.tenantId, tenantSiteVersionId: draft.versionId, undoneAt: null }, orderBy: { createdAt: "desc" } });
      if (!last) throw new Error("Aucune modification à annuler.");
      if (last.afterSignature !== draft.signature) throw new Error("Le site a changé depuis cette modification : annulez depuis l'éditeur avancé ou refaites la modification.");
      const before = last.before as unknown as DraftSnapshot;
      await tx.siteRevision.update({ where: { id: last.id }, data: { undoneAt: new Date() } });
      if (last.aiJobId) await tx.aIGenerationJob.updateMany({ where: { id: last.aiJobId, tenantId: who.tenantId }, data: { approved: false } });
      return { signature: await writeDraft(tx, draft, before), label: last.label };
    });
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, status: 409, error: error instanceof Error ? error.message : "Annulation impossible." };
  }
}

// --- Modifications manuelles depuis l'aperçu (sans IA) -----------------------------

const manualSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("image"), sectionId: z.string().max(80), field: z.string().max(40), url: z.string().max(500), alt: z.string().max(140).optional() }),
  z.object({ kind: z.literal("logo"), url: z.string().max(500).nullable() }),
]);

export async function manualChange(raw: unknown): Promise<StudioResult<{ signature: string }>> {
  const who = await actor("site.edit");
  if (!who) return deny;
  const input = manualSchema.safeParse(raw);
  if (!input.success) return { ok: false, status: 400, error: "Modification invalide." };
  const change = input.data;
  const mediaIds = new Set<string>();
  const url = change.url ?? null;
  const problem = checkImage(url, mediaIds);
  if (problem) return { ok: false, status: 400, error: problem };
  try {
    const signature = await withTenant(who.tenantId, async (tx) => {
      if (mediaIds.size && (await tx.mediaAsset.count({ where: { tenantId: who.tenantId, id: { in: [...mediaIds] }, status: "READY" } })) !== mediaIds.size) {
        throw new Error("Cette image n'est plus disponible dans la médiathèque.");
      }
      const draft = await loadDraft(tx, who.tenantId, who.tenantSiteId, true);
      let next: DraftSnapshot;
      let label: string;
      if (change.kind === "logo") {
        next = { ...draft.snapshot, settings: { ...draft.snapshot.settings, identity: { ...draft.snapshot.settings.identity, logoUrl: url } } };
        label = url ? "Logo remplacé" : "Logo retiré";
      } else {
        const index = draft.snapshot.blocks.findIndex((b) => b.id === change.sectionId);
        const block = draft.snapshot.blocks[index];
        if (!block || !imageSlots(block).some((s) => s.field === change.field)) throw new Error("Emplacement d'image inconnu.");
        const params = structuredClone(block.params) as Record<string, unknown>;
        const [head, stepIndex, key] = change.field.split(".");
        if (head === "steps") {
          const steps = params.steps as Record<string, unknown>[];
          steps[Number(stepIndex)] = { ...steps[Number(stepIndex)], [key!]: url, ...(change.alt ? { imageAlt: change.alt } : {}) };
        } else {
          params[head!] = url;
          if (change.alt) params[head === "subjectImage" ? "subjectAlt" : "imageAlt"] = change.alt;
        }
        const updated = validateSectionInstance({ ...block, params });
        next = { ...draft.snapshot, blocks: draft.snapshot.blocks.map((b, i) => (i === index ? updated : b)) };
        label = `${sectionLabel(block)} : image remplacée`;
      }
      await recordRevision(tx, who.tenantId, draft, { source: "manual", label, after: next, createdBy: who.userId });
      return writeDraft(tx, draft, next);
    });
    return { ok: true, data: { signature } };
  } catch (error) {
    return { ok: false, status: 409, error: error instanceof Error ? error.message : "Modification impossible." };
  }
}

// --- Publication volontaire ----------------------------------------------------------

/** Publie le brouillon (sections) par le pipeline existant, puis rend l'identité et les
 *  animations du brouillon effectives sur tout le site. Jamais déclenchée par l'IA. */
export async function publishStudioDraft(): Promise<StudioResult<{ versionNumber: number | null }>> {
  const who = await actor("site.publish");
  if (!who) return { ok: false, status: 403, error: "Vous n'avez pas le droit de publier le site." };
  const settings = await withTenant(who.tenantId, async (tx) => (await loadDraft(tx, who.tenantId, who.tenantSiteId)).snapshot.settings);
  const published = await publishTenantDraft();
  if (!published.ok) return published;
  await withTenant(who.tenantId, async (tx) => {
    const { identity, motion } = settings;
    await updateTenantBranding(tx, who.tenantId, {
      templatePreference: identity.style,
      primaryColor: identity.primaryColor,
      accentColor: identity.accentColor,
      backgroundColor: identity.backgroundColor,
      fontPair: identity.fontPair ?? null,
      shape: identity.shape ?? null,
      logoUrl: identity.logoUrl,
    });
    const site = await tx.tenantSite.findUniqueOrThrow({ where: { tenantId: who.tenantId }, select: { id: true, designTokenOverrides: true } });
    const overrides = (site.designTokenOverrides ?? {}) as Record<string, Record<string, unknown>>;
    await tx.tenantSite.update({
      where: { id: site.id },
      data: { animationLevelOverride: motion.level, designTokenOverrides: { ...overrides, animation: { ...(overrides.animation ?? {}), mobile: motion.mobile } } as Prisma.InputJsonValue },
    });
  });
  await syncEditorSiteIdentity(who.tenantId);
  return { ok: true, data: published.data };
}

export { draftSignature };
