import { describe, expect, it } from "vitest";
import { checkPublishReadiness, type PublishReadinessInput } from "./readiness";

function heroSection(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "hero-1",
    sectionKey: "hero" as const,
    variant: "split",
    order: 0,
    isEnabled: true,
    animationOverride: "inherit" as const,
    params: { title: "Bienvenue", media: { url: "https://x.test/a.jpg" } },
    ...overrides,
  };
}

function baseInput(overrides: Partial<PublishReadinessInput> = {}): PublishReadinessInput {
  return {
    tenantStatus: "ACTIVE",
    subscriptionStatus: "ACTIVE",
    templateStatus: "published",
    hasActiveVerifiedDomain: true,
    requestedDomainOwnerTenantId: null,
    currentTenantId: "tenant-a",
    isPublicationAlreadyInProgress: false,
    draftPages: [{ slug: "accueil", title: "Accueil", isHome: true, blocks: [heroSection()] }],
    mediaReferences: [],
    ...overrides,
  };
}

describe("checkPublishReadiness — cas valide", () => {
  it("autorise la publication quand tout est en ordre", () => {
    const report = checkPublishReadiness(baseInput());
    expect(report.canPublish).toBe(true);
    expect(report.issues).toEqual([]);
  });
});

describe("checkPublishReadiness — blocages", () => {
  it("bloque si une section est invalide", () => {
    const report = checkPublishReadiness(
      baseInput({
        draftPages: [
          { slug: "accueil", title: "Accueil", isHome: true, blocks: [heroSection({ params: {} })] },
        ],
      }),
    );
    expect(report.canPublish).toBe(false);
    expect(report.issues.map((i) => i.code)).toContain("invalid_section");
  });

  it("bloque si aucune page n'est la page d'accueil", () => {
    const report = checkPublishReadiness(
      baseInput({
        draftPages: [{ slug: "a-propos", title: "À propos", isHome: false, blocks: [heroSection()] }],
      }),
    );
    expect(report.issues.map((i) => i.code)).toContain("missing_home_page");
  });

  it("bloque si deux pages partagent la même URL", () => {
    const report = checkPublishReadiness(
      baseInput({
        draftPages: [
          { slug: "accueil", title: "Accueil", isHome: true, blocks: [heroSection()] },
          { slug: "accueil", title: "Doublon", isHome: false, blocks: [heroSection({ id: "hero-2" })] },
        ],
      }),
    );
    expect(report.issues.map((i) => i.code)).toContain("duplicate_page_slug");
  });

  it("bloque si un média référencé est en échec", () => {
    const report = checkPublishReadiness(
      baseInput({
        mediaReferences: [
          { url: "https://x.test/a.jpg", pageSlug: "accueil", sectionId: "hero-1", status: "FAILED" },
        ],
      }),
    );
    expect(report.issues.map((i) => i.code)).toContain("media_failed_or_trashed");
  });

  it("bloque si un média référencé est dans la corbeille", () => {
    const report = checkPublishReadiness(
      baseInput({
        mediaReferences: [
          { url: "https://x.test/a.jpg", pageSlug: "accueil", sectionId: "hero-1", status: "TRASHED" },
        ],
      }),
    );
    expect(report.issues.map((i) => i.code)).toContain("media_failed_or_trashed");
  });

  it("bloque si un document sensible est référencé (jamais promouvable public)", () => {
    const report = checkPublishReadiness(
      baseInput({
        mediaReferences: [
          {
            url: "https://x.test/contrat.pdf",
            pageSlug: "accueil",
            sectionId: "hero-1",
            status: "READY",
            isSensitiveDocument: true,
          },
        ],
      }),
    );
    expect(report.issues.map((i) => i.code)).toContain("media_private_cannot_promote");
  });

  it("n'échoue jamais sur un média externe inconnu (status undefined)", () => {
    const report = checkPublishReadiness(
      baseInput({
        mediaReferences: [{ url: "https://cdn.externe.test/x.jpg", pageSlug: "accueil", sectionId: "hero-1" }],
      }),
    );
    expect(report.canPublish).toBe(true);
  });

  it("bloque si le modèle est archivé", () => {
    const report = checkPublishReadiness(baseInput({ templateStatus: "archived" }));
    expect(report.issues.map((i) => i.code)).toContain("template_archived_or_incompatible");
  });

  it("bloque si le modèle n'est pas encore publié (encore en brouillon côté plateforme)", () => {
    const report = checkPublishReadiness(baseInput({ templateStatus: "draft" }));
    expect(report.issues.map((i) => i.code)).toContain("template_archived_or_incompatible");
  });

  it("TENANT SUSPENDU : bloque la publication", () => {
    const report = checkPublishReadiness(baseInput({ tenantStatus: "SUSPENDED" }));
    expect(report.issues.map((i) => i.code)).toContain("tenant_suspended");
  });

  it("ABONNEMENT EXPIRÉ : bloque si le statut est PAST_DUE", () => {
    const report = checkPublishReadiness(baseInput({ subscriptionStatus: "PAST_DUE" }));
    expect(report.issues.map((i) => i.code)).toContain("subscription_disallows_publish");
  });

  it("bloque si le statut est CANCELED", () => {
    const report = checkPublishReadiness(baseInput({ subscriptionStatus: "CANCELED" }));
    expect(report.issues.map((i) => i.code)).toContain("subscription_disallows_publish");
  });

  it("bloque si aucun abonnement n'existe", () => {
    const report = checkPublishReadiness(baseInput({ subscriptionStatus: null }));
    expect(report.issues.map((i) => i.code)).toContain("subscription_disallows_publish");
  });

  it("autorise en période d'essai (TRIALING)", () => {
    const report = checkPublishReadiness(baseInput({ subscriptionStatus: "TRIALING" }));
    expect(report.canPublish).toBe(true);
  });

  it("autorise ENCORE la publication pendant la période de grâce (GRACE_PERIOD) — voir docs/14, facturation SaaS", () => {
    const report = checkPublishReadiness(baseInput({ subscriptionStatus: "GRACE_PERIOD" }));
    expect(report.canPublish).toBe(true);
  });

  it("bloque si l'abonnement est SUSPENDED (grâce dépassée)", () => {
    const report = checkPublishReadiness(baseInput({ subscriptionStatus: "SUSPENDED" }));
    expect(report.issues.map((i) => i.code)).toContain("subscription_disallows_publish");
  });

  it("bloque si l'abonnement est EXPIRED", () => {
    const report = checkPublishReadiness(baseInput({ subscriptionStatus: "EXPIRED" }));
    expect(report.issues.map((i) => i.code)).toContain("subscription_disallows_publish");
  });

  it("bloque si l'abonnement est encore PENDING (aucun paiement confirmé)", () => {
    const report = checkPublishReadiness(baseInput({ subscriptionStatus: "PENDING" }));
    expect(report.issues.map((i) => i.code)).toContain("subscription_disallows_publish");
  });

  it("bloque si aucun domaine actif/vérifié n'existe", () => {
    const report = checkPublishReadiness(baseInput({ hasActiveVerifiedDomain: false }));
    expect(report.issues.map((i) => i.code)).toContain("domain_invalid_or_unverified");
  });

  it("ISOLATION : bloque si le domaine demandé appartient à un AUTRE tenant", () => {
    const report = checkPublishReadiness(baseInput({ requestedDomainOwnerTenantId: "tenant-b" }));
    expect(report.issues.map((i) => i.code)).toContain("domain_owned_by_another_tenant");
  });

  it("n'accuse pas le propre domaine du tenant d'appartenir à 'un autre tenant'", () => {
    const report = checkPublishReadiness(baseInput({ requestedDomainOwnerTenantId: "tenant-a" }));
    expect(report.issues.map((i) => i.code)).not.toContain("domain_owned_by_another_tenant");
  });

  it("PUBLICATION DÉJÀ EN COURS : bloque une seconde tentative", () => {
    const report = checkPublishReadiness(baseInput({ isPublicationAlreadyInProgress: true }));
    expect(report.issues.map((i) => i.code)).toContain("publication_in_progress");
  });

  it("rapporte PLUSIEURS problèmes à la fois plutôt que de s'arrêter au premier", () => {
    const report = checkPublishReadiness(
      baseInput({ tenantStatus: "SUSPENDED", hasActiveVerifiedDomain: false, subscriptionStatus: "CANCELED" }),
    );
    expect(report.issues.length).toBeGreaterThanOrEqual(3);
  });
});
