import { validateSectionInstance, type SectionInstance } from "@yamacommerce/templates";

/**
 * Validation de préparation à la publication — voir docs/12 §12.3, « publication
 * définitive » (22 septembre 2026), sections VALIDATIONS AVANT PUBLICATION et
 * PUBLICATION ATOMIQUE (étapes 3-6). Module PUR, sector-agnostic : ne connaît ni
 * Prisma, ni le stockage, ni la session — reçoit un instantané déjà résolu par
 * l'appelant (voir apps/web/lib/publishing/publish-pipeline.ts) et rend un rapport
 * structuré, jamais un simple booléen : « Afficher un rapport clair avec erreurs
 * bloquantes et avertissements non bloquants. ».
 *
 * « Une image requise manque » n'a PAS de vérification dédiée ici : un champ média
 * requis vide (`mediaSchema.url` = `z.string().url()`, jamais optionnel dans son
 * propre objet) fait déjà échouer `validateSectionInstance` — c'est une simple
 * conséquence de la validation de section (code `invalid_section`), pas un cas à
 * part, ce qui évite de dupliquer une règle déjà appliquée ailleurs dans le projet.
 */

export type PublishIssueCode =
  | "invalid_section"
  | "missing_home_page"
  | "duplicate_page_slug"
  | "media_failed_or_trashed"
  | "media_private_cannot_promote"
  | "template_archived_or_incompatible"
  | "tenant_suspended"
  | "subscription_disallows_publish"
  | "domain_invalid_or_unverified"
  | "domain_owned_by_another_tenant"
  | "publication_in_progress";

export interface PublishIssue {
  code: PublishIssueCode;
  severity: "error" | "warning";
  message: string;
  pageSlug?: string;
  sectionId?: string;
}

export interface PublishReadinessReport {
  /** `true` seulement si AUCUNE entrée de `issues` n'est de sévérité "error" — des
   *  avertissements seuls n'empêchent jamais la publication. */
  canPublish: boolean;
  issues: PublishIssue[];
}

export interface DraftPageInput {
  slug: string;
  title: string;
  isHome: boolean;
  blocks: SectionInstance[];
}

/** Référence média trouvée dans le brouillon et déjà résolue par l'appelant (voir
 *  apps/web/lib/publishing/media-scan.ts, réutilise le même scanner générique par
 *  introspection de schéma que la médiathèque — lib/editor/media-references.ts). */
export interface MediaReferenceCheckInput {
  url: string;
  pageSlug: string;
  sectionId: string;
  /** `undefined` = média externe, jamais importé dans la médiathèque de ce tenant —
   *  rien à vérifier de plus (voir « seuls les médias RÉELLEMENT utilisés » : on ne
   *  peut vérifier le statut que de ce qu'on connaît). */
  status?: "PENDING" | "READY" | "FAILED" | "TRASHED";
  /** Un document marqué "sensible" (voir MediaAsset, @yamacommerce/database) ne peut
   *  jamais être promu public, quel que soit son statut par ailleurs. */
  isSensitiveDocument?: boolean;
}

export interface PublishReadinessInput {
  tenantStatus: "PENDING" | "ACTIVE" | "SUSPENDED" | "DELETED";
  /// Étendu le 20 septembre 2026 (facturation SaaS) — voir
  /// `packages/database/prisma/schema.prisma`, enum `SubscriptionStatus`. `GRACE_PERIOD`
  /// autorise ENCORE la publication (aucune pénalité avant la fin de la grâce) ;
  /// `PENDING`/`PAST_DUE`/`SUSPENDED`/`EXPIRED` la bloquent, comme `CANCELED` déjà.
  subscriptionStatus:
    | "PENDING"
    | "TRIALING"
    | "ACTIVE"
    | "GRACE_PERIOD"
    | "PAST_DUE"
    | "SUSPENDED"
    | "CANCELED"
    | "EXPIRED"
    | null;
  templateStatus: "draft" | "published" | "archived";
  hasActiveVerifiedDomain: boolean;
  /** Id du tenant propriétaire du domaine demandé, si celui-ci existe déjà pour un
   *  AUTRE tenant — `null` si le domaine est libre ou déjà à CE tenant. */
  requestedDomainOwnerTenantId: string | null;
  currentTenantId: string;
  isPublicationAlreadyInProgress: boolean;
  draftPages: DraftPageInput[];
  mediaReferences: MediaReferenceCheckInput[];
}

const ALLOWED_SUBSCRIPTION_STATUSES = new Set(["TRIALING", "ACTIVE", "GRACE_PERIOD"]);

/**
 * Calcule le rapport de préparation à la publication — jamais d'exception : chaque
 * règle produit une entrée dans `issues` plutôt que d'interrompre les autres
 * vérifications, pour que l'utilisateur voie TOUS les problèmes en une seule fois.
 */
export function checkPublishReadiness(input: PublishReadinessInput): PublishReadinessReport {
  const issues: PublishIssue[] = [];

  // --- 1. Sections de chaque page (voir la note de tête de fichier pour "image requise manquante"). ---
  for (const page of input.draftPages) {
    for (const block of page.blocks) {
      try {
        validateSectionInstance(block);
      } catch (error) {
        issues.push({
          code: "invalid_section",
          severity: "error",
          message: `Section "${block.sectionKey ?? "?"}" invalide sur la page "${page.slug}" : ${
            error instanceof Error ? error.message : String(error)
          }`,
          pageSlug: page.slug,
          sectionId: typeof block.id === "string" ? block.id : undefined,
        });
      }
    }
  }

  // --- 2. Page d'accueil obligatoire. ---
  if (!input.draftPages.some((page) => page.isHome)) {
    issues.push({
      code: "missing_home_page",
      severity: "error",
      message: "Aucune page n'est définie comme page d'accueil.",
    });
  }

  // --- 3. URL de page dupliquée. ---
  const seenSlugs = new Map<string, number>();
  for (const page of input.draftPages) {
    seenSlugs.set(page.slug, (seenSlugs.get(page.slug) ?? 0) + 1);
  }
  for (const [slug, count] of seenSlugs) {
    if (count > 1) {
      issues.push({
        code: "duplicate_page_slug",
        severity: "error",
        message: `L'URL de page "${slug}" est utilisée par ${count} pages différentes.`,
        pageSlug: slug,
      });
    }
  }

  // --- 4. Médias référencés : en échec/corbeille, ou document sensible non promouvable. ---
  for (const reference of input.mediaReferences) {
    if (reference.status === "FAILED" || reference.status === "TRASHED") {
      issues.push({
        code: "media_failed_or_trashed",
        severity: "error",
        message: `Le média utilisé sur "${reference.pageSlug}" est ${
          reference.status === "FAILED" ? "en échec d'import" : "dans la corbeille"
        } (${reference.url}).`,
        pageSlug: reference.pageSlug,
        sectionId: reference.sectionId,
      });
    }
    if (reference.isSensitiveDocument) {
      issues.push({
        code: "media_private_cannot_promote",
        severity: "error",
        message: `Un document sensible ne peut pas être rendu public (utilisé sur "${reference.pageSlug}").`,
        pageSlug: reference.pageSlug,
        sectionId: reference.sectionId,
      });
    }
  }

  // --- 5. Modèle (template) archivé ou incompatible. ---
  if (input.templateStatus !== "published") {
    issues.push({
      code: "template_archived_or_incompatible",
      severity: "error",
      message:
        input.templateStatus === "archived"
          ? "Le modèle utilisé par ce site est archivé."
          : "Le modèle utilisé par ce site n'est pas encore publié par la plateforme.",
    });
  }

  // --- 6. Tenant suspendu. ---
  if (input.tenantStatus !== "ACTIVE") {
    issues.push({
      code: "tenant_suspended",
      severity: "error",
      message:
        input.tenantStatus === "SUSPENDED"
          ? "Ce compte est suspendu : la publication est bloquée."
          : `Ce compte n'est pas actif (statut : ${input.tenantStatus}).`,
    });
  }

  // --- 7. Abonnement ne permettant pas la publication. ---
  if (!input.subscriptionStatus || !ALLOWED_SUBSCRIPTION_STATUSES.has(input.subscriptionStatus)) {
    issues.push({
      code: "subscription_disallows_publish",
      severity: "error",
      message: input.subscriptionStatus
        ? `L'abonnement (statut : ${input.subscriptionStatus}) ne permet plus de publier.`
        : "Aucun abonnement actif : la publication est bloquée.",
    });
  }

  // --- 8. Domaine invalide/non vérifié, ou appartenant à un autre tenant. ---
  if (!input.hasActiveVerifiedDomain) {
    issues.push({
      code: "domain_invalid_or_unverified",
      severity: "error",
      message: "Aucun domaine actif et vérifié n'est configuré pour ce site.",
    });
  }
  if (input.requestedDomainOwnerTenantId && input.requestedDomainOwnerTenantId !== input.currentTenantId) {
    issues.push({
      code: "domain_owned_by_another_tenant",
      severity: "error",
      message: "Le domaine demandé appartient déjà à une autre entreprise.",
    });
  }

  // --- 9. Publication déjà en cours. ---
  if (input.isPublicationAlreadyInProgress) {
    issues.push({
      code: "publication_in_progress",
      severity: "error",
      message: "Une publication est déjà en cours pour ce site.",
    });
  }

  const canPublish = !issues.some((issue) => issue.severity === "error");
  return { canPublish, issues };
}
