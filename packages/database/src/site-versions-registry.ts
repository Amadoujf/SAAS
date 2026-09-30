import { assertTenantLinks } from "./site-links";
import { Prisma } from "@prisma/client";
import {
  pageDefinitionSchema,
  validateSectionInstance,
  type SectionInstance,
} from "@yamacommerce/templates";
import { validateTemplateManifest } from "@yamacommerce/templates";
import { computeChangesSummary, type PageSnapshot } from "@yamacommerce/publishing";
import { nextCounterValue } from "./counters";

/**
 * Fondation données de l'éditeur visuel — voir docs/12 §12.2 et docs/04 §4.5.7.
 *
 * Portée VOLONTAIREMENT limitée à la persistance (brouillon/publié, historique,
 * restauration, marquage "programmé") : le glisser-déposer, les panneaux de
 * personnalisation par section et le job qui promeut réellement une version
 * "scheduled" à l'heure prévue sont des étapes suivantes, pas construites ici
 * ("sans passer à l'élément suivant sans confirmation", voir docs/09 §Méthode de
 * livraison).
 *
 * Principe central (comme `templates-registry.ts`) : chaque `TenantSiteVersion` porte
 * son propre jeu COMPLET de `Page` — publier fige une nouvelle version et archive
 * l'ancienne, ne modifie jamais une version existante. C'est ce qui donne
 * l'historique/l'annuler-rétablir "gratuitement" (voir docs/12 §12.2, tableau
 * « Mécanique »).
 */

export type TenantSiteVersionStatus = "draft" | "scheduled" | "published" | "archived";

/** Une page telle qu'écrite/lue par l'éditeur — mêmes champs qu'un `PageDefinition`
 *  de @yamacommerce/templates (slug/title/isHome/sections), `blocks` étant le nom de
 *  colonne côté base pour les sections. */
export interface PageInput {
  slug: string;
  title: string;
  isHome?: boolean;
  blocks: SectionInstance[];
}

/**
 * `pageDefinitionSchema.parse` valide chaque section via le schéma STRUCTUREL
 * seulement (`sectionInstanceSchema` — voir @yamacommerce/templates), pas la
 * compatibilité variante/section ni les paramètres spécifiques à cette section
 * (voir `validateSectionInstance`, plus stricte). Ce dernier verrou avant
 * publication (voir `finalizePublish`) doit être AU MOINS aussi strict que
 * `checkPublishReadiness` (@yamacommerce/publishing) qui, lui, appelle déjà
 * `validateSectionInstance` — sans quoi un appelant qui court-circuiterait la
 * vérification de préparation pourrait publier une variante invalide.
 */
function validatePageInput(input: PageInput) {
  const page = pageDefinitionSchema.parse({
    slug: input.slug,
    title: input.title,
    isHome: input.isHome ?? false,
    sections: input.blocks,
  });
  for (const section of page.sections) {
    validateSectionInstance(section);
  }
  return page;
}

/**
 * Retourne le brouillon courant d'un site tenant, en le créant s'il n'existe pas
 * encore. Un tenant qui n'a JAMAIS ouvert l'éditeur reçoit un brouillon initial
 * seedé depuis `SiteTemplate.pageManifest` (son site public continue entre-temps de
 * servir directement ce manifeste par défaut — voir resolve-tenant-site.ts, qui ne
 * bascule sur le contenu personnalisé qu'une fois une version PUBLIÉE).
 */
export async function getOrCreateDraftVersion(
  tx: Prisma.TransactionClient,
  tenantId: string,
  tenantSiteId: string,
) {
  const existingDraft = await tx.tenantSiteVersion.findFirst({
    where: { tenantSiteId, status: "draft" },
    include: { pages: true },
  });
  if (existingDraft) return existingDraft;

  // Le plus récent, PUBLIÉ de préférence (le site continue de fonctionner tel quel
  // pendant que l'édition reprend) ; sinon la version la plus récente de quelque
  // statut que ce soit — voir « BUG corrigé le 18 septembre 2026 » ci-dessous.
  const mostRecentPublished = await tx.tenantSiteVersion.findFirst({
    where: { tenantSiteId, status: "published" },
    include: { pages: true },
  });
  const mostRecentAny =
    mostRecentPublished ??
    (await tx.tenantSiteVersion.findFirst({
      where: { tenantSiteId },
      orderBy: { createdAt: "desc" },
      include: { pages: true },
    }));

  // Premier brouillon jamais créé pour ce site : on le seed depuis le manifeste par
  // défaut du template, pour que l'entrepreneur parte de son template choisi plutôt
  // que d'une page blanche.
  //
  // BUG corrigé le 18 septembre 2026 (trouvé via un test réel contre PostgreSQL,
  // voir la revue de l'assistant de domaines) : quand une version existe déjà mais
  // qu'AUCUNE n'a le statut "draft" (ex. la seule version existante est
  // "scheduled" — voir `publishScheduledVersion`, dont la note de tête de fichier
  // décrit précisément ce scénario), ce brouillon devient le brouillon COURANT
  // vu par l'éditeur : le laisser vide effacerait silencieusement tout le contenu
  // du site aux yeux de quiconque rouvre l'éditeur pendant l'attente d'une
  // publication programmée. Il doit toujours reprendre le contenu de la version la
  // plus pertinente déjà connue, jamais une page blanche, une fois le tout premier
  // brouillon déjà créé une fois pour ce site.
  let seedPages: { slug: string; title: string; isHome: boolean; blocks: SectionInstance[] }[] = [];
  if (!mostRecentAny) {
    const tenantSite = await tx.tenantSite.findUniqueOrThrow({
      where: { id: tenantSiteId },
      include: { template: true },
    });
    const manifest = validateTemplateManifest(tenantSite.template.pageManifest);
    seedPages = manifest.pages.map((page) => ({
      slug: page.slug,
      title: page.title,
      isHome: page.isHome,
      blocks: page.sections,
    }));
  } else {
    seedPages = mostRecentAny.pages.map((page) => ({
      slug: page.slug,
      title: page.title,
      isHome: page.isHome,
      blocks: page.blocks as unknown as SectionInstance[],
    }));
  }

  return tx.tenantSiteVersion.create({
    data: {
      tenantId,
      tenantSiteId,
      status: "draft",
      // Identité et animations proposées : reprises de la version de départ (sinon
      // aucune — le site garde alors son identité en ligne).
      ...(mostRecentAny?.settings ? { settings: mostRecentAny.settings as Prisma.InputJsonValue } : {}),
      pages: {
        create: seedPages.map((page) => ({
          tenantId,
          slug: page.slug,
          title: page.title,
          isHome: page.isHome,
          blocks: page.blocks as unknown as Prisma.InputJsonValue,
        })),
      },
    },
    include: { pages: true },
  });
}

export async function getPublishedVersion(tx: Prisma.TransactionClient, tenantSiteId: string) {
  return tx.tenantSiteVersion.findFirst({
    where: { tenantSiteId, status: "published" },
    include: { pages: true },
  });
}

/** Versions archivées/publiées, les plus récentes d'abord — alimente l'écran
 *  "historique" de l'éditeur (restauration). */
export async function listVersionHistory(tx: Prisma.TransactionClient, tenantSiteId: string) {
  return tx.tenantSiteVersion.findMany({
    where: { tenantSiteId, status: { in: ["published", "archived"] } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Remplace le contenu (sections) d'une page du BROUILLON courant. Refuse
 * explicitement toute écriture sur une page appartenant à une version publiée ou
 * archivée — l'éditeur ne doit jamais pouvoir modifier l'historique ni le site en
 * ligne directement, seulement via `publishVersion()`.
 */
export async function updatePageBlocks(
  tx: Prisma.TransactionClient,
  pageId: string,
  blocks: SectionInstance[],
) {
  const page = await tx.page.findUniqueOrThrow({
    where: { id: pageId },
    include: { tenantSiteVersion: true },
  });
  if (page.tenantSiteVersion.status !== "draft") {
    throw new Error(
      `updatePageBlocks : la page "${page.slug}" appartient à une version ` +
        `"${page.tenantSiteVersion.status}", pas au brouillon — modification refusée.`,
    );
  }

  const validatedBlocks = blocks.map((block) => validateSectionInstance(block));
  // Liens contrôlés côté serveur (forme, zones privées, sites d'autres entreprises).
  await assertTenantLinks(tx, page.tenantId, validatedBlocks);
  const blockIds = new Set<string>();
  for (const block of validatedBlocks) {
    if (blockIds.has(block.id)) {
      throw new Error(`updatePageBlocks : identifiant de section dupliqué "${block.id}".`);
    }
    blockIds.add(block.id);
  }

  return tx.page.update({
    where: { id: pageId },
    data: { blocks: validatedBlocks as unknown as Prisma.InputJsonValue },
  });
}

/** Met à jour titre/isHome d'une page du brouillon courant (même garde que
 *  `updatePageBlocks` : jamais sur une version publiée/archivée). */
export async function updatePageMeta(
  tx: Prisma.TransactionClient,
  pageId: string,
  meta: { title?: string; isHome?: boolean },
) {
  const page = await tx.page.findUniqueOrThrow({
    where: { id: pageId },
    include: { tenantSiteVersion: true },
  });
  if (page.tenantSiteVersion.status !== "draft") {
    throw new Error(
      `updatePageMeta : la page "${page.slug}" appartient à une version ` +
        `"${page.tenantSiteVersion.status}", pas au brouillon — modification refusée.`,
    );
  }
  return tx.page.update({ where: { id: pageId }, data: meta });
}

/**
 * Duplique une page du brouillon courant sous un nouveau slug — voir docs/12 §12.2,
 * "Duplication de page". `isHome` n'est jamais copié tel quel : une version ne peut
 * avoir qu'une seule page d'accueil (même règle que `validateTemplateManifest`).
 */
export async function duplicatePage(
  tx: Prisma.TransactionClient,
  pageId: string,
  newSlug: string,
  newTitle: string,
) {
  const source = await tx.page.findUniqueOrThrow({
    where: { id: pageId },
    include: { tenantSiteVersion: true },
  });
  if (source.tenantSiteVersion.status !== "draft") {
    throw new Error(
      `duplicatePage : la page "${source.slug}" appartient à une version ` +
        `"${source.tenantSiteVersion.status}", pas au brouillon — duplication refusée.`,
    );
  }

  return tx.page.create({
    data: {
      tenantId: source.tenantId,
      tenantSiteVersionId: source.tenantSiteVersionId,
      slug: newSlug,
      title: newTitle,
      isHome: false,
      blocks: source.blocks as Prisma.InputJsonValue,
    },
  });
}

function toPageSnapshot(page: { slug: string; title: string; blocks: Prisma.JsonValue }): PageSnapshot {
  return { slug: page.slug, title: page.title, contentFingerprint: JSON.stringify(page.blocks) };
}

/** Scope de compteur pour la numérotation séquentielle des versions PUBLIÉES d'un
 *  site (voir @yamacommerce/database `nextCounterValue`) — un compteur par site, pas
 *  par tenant, puisqu'un tenant n'a qu'un seul `TenantSite` de toute façon en Phase 1. */
export function siteVersionCounterScope(tenantSiteId: string): string {
  return `site-version-${tenantSiteId}`;
}

export interface PublishVersionOptions {
  /** Message facultatif saisi par le publieur — voir docs/12 §12.3. */
  publishMessage?: string;
  /** Domaine/sous-domaine effectivement servi par cette version au moment de la
   *  publication (snapshot, voir `TenantSiteVersion.domainUsed`). */
  domainUsed?: string | null;
  /** Vrai quand cette publication provient du job de publication programmée plutôt
   *  que d'un clic direct sur "Publier maintenant". */
  wasScheduled?: boolean;
  /** Renseignés UNIQUEMENT par le pipeline de restauration (voir
   *  apps/web/lib/publishing/restore-pipeline.ts) : trace la version archivée source
   *  et, pour une restauration Super Admin, la justification obligatoire — jamais
   *  saisis directement par un appel "Publier maintenant" normal. */
  restoredFromVersionId?: string;
  restoreJustification?: string;
}

type PageRow = { slug: string; title: string; isHome: boolean; blocks: Prisma.JsonValue };

/**
 * Cœur commun de `publishVersion` (source = le brouillon courant) et
 * `publishScheduledVersion` (source = une version précise déjà marquée "scheduled") —
 * factorisé pour qu'une seule et même logique de validation/archivage/numérotation
 * s'applique aux deux chemins de publication (voir docs/12 §12.3, « PUBLICATION
 * ATOMIQUE »). Ne touche JAMAIS au brouillon courant : la gestion du nouveau brouillon
 * après publication diffère entre les deux appelants (voir leurs commentaires
 * respectifs) et reste donc de LEUR responsabilité, pas de celle-ci.
 */
async function finalizePublish(
  tx: Prisma.TransactionClient,
  tenantId: string,
  tenantSiteId: string,
  sourceVersionId: string,
  sourcePages: PageRow[],
  options: PublishVersionOptions,
) {
  if (sourcePages.length === 0) {
    throw new Error("finalizePublish : la version à publier n'a aucune page — publication refusée.");
  }
  for (const page of sourcePages) {
    validatePageInput({
      slug: page.slug,
      title: page.title,
      isHome: page.isHome,
      blocks: page.blocks as unknown as SectionInstance[],
    });
  }

  const previousPublished = await tx.tenantSiteVersion.findFirst({
    where: { tenantSiteId, status: "published" },
    include: { pages: true },
  });

  const changesSummary = computeChangesSummary(
    (previousPublished?.pages ?? []).map(toPageSnapshot),
    sourcePages.map(toPageSnapshot),
  );

  if (previousPublished) {
    await tx.tenantSiteVersion.update({
      where: { id: previousPublished.id },
      data: { status: "archived" },
    });
  }

  const versionNumber = await nextCounterValue(tx, tenantId, siteVersionCounterScope(tenantSiteId));

  const now = new Date();
  const published = await tx.tenantSiteVersion.update({
    where: { id: sourceVersionId },
    data: {
      status: "published",
      publishedAt: now,
      versionNumber,
      publishMessage: options.publishMessage ?? null,
      changesSummary: changesSummary as unknown as Prisma.InputJsonValue,
      domainUsed: options.domainUsed ?? null,
      wasScheduled: options.wasScheduled ?? false,
      restoredFromVersionId: options.restoredFromVersionId ?? null,
      restoreJustification: options.restoreJustification ?? null,
    },
  });

  await tx.tenantSite.update({
    where: { id: tenantSiteId },
    data: { isPublished: true, publishedAt: now },
  });

  return { published, changesSummary };
}

function copyPagesData(tenantId: string, pages: PageRow[]) {
  return pages.map((page) => ({
    tenantId,
    slug: page.slug,
    title: page.title,
    isHome: page.isHome,
    blocks: page.blocks as Prisma.InputJsonValue,
  }));
}

/**
 * Publie le brouillon courant : la version publiée précédente (s'il y en a une) est
 * archivée — jamais supprimée, jamais écrasée — puis le brouillon est promu "published"
 * et un NOUVEAU brouillon (copie fidèle de ce qui vient d'être publié) est créé pour que
 * l'édition puisse continuer sans interruption. Met aussi à jour
 * `TenantSite.isPublished`/`publishedAt` pour rester compatible avec
 * `resolve-tenant-site.ts` tant qu'une version publiée existe.
 *
 * Fige `versionNumber` (compteur séquentiel), `changesSummary` (calculé UNE FOIS ici,
 * jamais recalculé plus tard — voir @yamacommerce/publishing) et le reste des métadonnées
 * d'historique. Les VALIDATIONS de préparation (`checkPublishReadiness`) sont la
 * responsabilité de l'appelant (voir apps/web/lib/publishing/publish-pipeline.ts) : cette
 * fonction reste le dernier verrou (pages non vides, sections valides), pas le seul.
 */
export async function publishVersion(
  tx: Prisma.TransactionClient,
  tenantId: string,
  tenantSiteId: string,
  options: PublishVersionOptions = {},
) {
  const draft = await tx.tenantSiteVersion.findFirst({
    where: { tenantSiteId, status: "draft" },
    include: { pages: true },
  });
  if (!draft) {
    throw new Error("publishVersion : aucun brouillon à publier pour ce site.");
  }

  const { published, changesSummary } = await finalizePublish(
    tx,
    tenantId,
    tenantSiteId,
    draft.id,
    draft.pages,
    options,
  );

  const newDraft = await tx.tenantSiteVersion.create({
    data: {
      tenantId,
      tenantSiteId,
      status: "draft",
      pages: { create: copyPagesData(tenantId, draft.pages) },
    },
    include: { pages: true },
  });

  return { published, newDraft, changesSummary };
}

/**
 * Publie une version PRÉCISE déjà marquée "scheduled" — voir docs/12 §12.3,
 * « PUBLICATION PROGRAMMÉE » : le job planifié appelle CETTE fonction, jamais
 * `publishVersion()`, car `scheduleVersionPublish()` ne fait que marquer le brouillon
 * courant "scheduled" SANS en créer un nouveau : `publishVersion()` chercherait alors
 * un brouillon "draft" et, si l'utilisateur en a entre-temps créé un nouveau en
 * continuant à éditer pendant l'attente, publierait CE brouillon-là par erreur au lieu
 * de la version programmée. Idempotent : si la version n'est déjà plus "scheduled"
 * (déjà publiée ou annulée par ailleurs), ne fait rien et retourne `null` — c'est ce
 * qui permet au job planifié d'être rejoué sans risque de double publication.
 *
 * Ne crée un nouveau brouillon QUE s'il n'en existe pas déjà un — si l'utilisateur a
 * continué à éditer pendant l'attente, CE brouillon reste intact et devient le
 * brouillon courant après publication, sans être remplacé par une copie de la version
 * qui vient d'être publiée.
 */
export async function publishScheduledVersion(
  tx: Prisma.TransactionClient,
  tenantId: string,
  tenantSiteId: string,
  versionId: string,
  options: PublishVersionOptions = {},
) {
  const scheduled = await tx.tenantSiteVersion.findUnique({
    where: { id: versionId },
    include: { pages: true },
  });
  if (!scheduled || scheduled.tenantSiteId !== tenantSiteId) {
    throw new Error(`publishScheduledVersion : version "${versionId}" introuvable pour ce site.`);
  }
  if (scheduled.status !== "scheduled") {
    // Idempotence : déjà publiée, annulée, ou rejouée après un job précédent réussi.
    return null;
  }

  const { published, changesSummary } = await finalizePublish(
    tx,
    tenantId,
    tenantSiteId,
    scheduled.id,
    scheduled.pages,
    { ...options, wasScheduled: true },
  );

  const existingDraft = await tx.tenantSiteVersion.findFirst({
    where: { tenantSiteId, status: "draft" },
    include: { pages: true },
  });
  const newDraft =
    existingDraft ??
    (await tx.tenantSiteVersion.create({
      data: {
        tenantId,
        tenantSiteId,
        status: "draft",
        pages: { create: copyPagesData(tenantId, scheduled.pages) },
      },
      include: { pages: true },
    }));

  return { published, newDraft, changesSummary };
}

/**
 * Restaure une version archivée (ou publiée) DANS le brouillon courant — voir
 * docs/12 §12.2, "Historique / Annuler-rétablir" : « restaurer copie les Page d'une
 * version archivée dans le brouillon courant ». Remplace entièrement les pages du
 * brouillon (elles ne sont pas fusionnées) ; la version archivée elle-même n'est ni
 * modifiée ni supprimée — restaurer n'efface jamais l'historique.
 */
export async function restoreVersionIntoDraft(
  tx: Prisma.TransactionClient,
  tenantId: string,
  tenantSiteId: string,
  sourceVersionId: string,
) {
  const source = await tx.tenantSiteVersion.findUniqueOrThrow({
    where: { id: sourceVersionId },
    include: { pages: true },
  });
  if (source.tenantSiteId !== tenantSiteId) {
    throw new Error("restoreVersionIntoDraft : la version source n'appartient pas à ce site.");
  }

  const draft = await getOrCreateDraftVersion(tx, tenantId, tenantSiteId);
  await tx.tenantSiteVersion.update({ where: { id: draft.id }, data: { settings: source.settings === null ? Prisma.DbNull : (source.settings as Prisma.InputJsonValue) } });
  await tx.page.deleteMany({ where: { tenantSiteVersionId: draft.id } });
  await tx.page.createMany({
    data: source.pages.map((page) => ({
      tenantId,
      tenantSiteVersionId: draft.id,
      slug: page.slug,
      title: page.title,
      isHome: page.isHome,
      blocks: page.blocks as Prisma.InputJsonValue,
    })),
  });

  return tx.tenantSiteVersion.findUniqueOrThrow({
    where: { id: draft.id },
    include: { pages: true },
  });
}

/**
 * Marque le brouillon courant "scheduled" — voir docs/12 §12.2, "Publication
 * programmée". NE promeut PAS la version à l'heure dite : c'est le rôle d'un job
 * planifié (file `site-publishing`, pas encore construite) qui appellera
 * `publishVersion()` lorsque `scheduledAt` est atteint.
 */
export async function scheduleVersionPublish(
  tx: Prisma.TransactionClient,
  versionId: string,
  scheduledAt: Date,
) {
  if (scheduledAt.getTime() <= Date.now()) {
    throw new Error("scheduleVersionPublish : la date programmée doit être dans le futur.");
  }
  return tx.tenantSiteVersion.update({
    where: { id: versionId },
    data: { status: "scheduled", scheduledAt },
  });
}

/** Annule une programmation — repasse la version en brouillon normal. */
export async function cancelScheduledPublish(tx: Prisma.TransactionClient, versionId: string) {
  return tx.tenantSiteVersion.update({
    where: { id: versionId },
    data: { status: "draft", scheduledAt: null },
  });
}
