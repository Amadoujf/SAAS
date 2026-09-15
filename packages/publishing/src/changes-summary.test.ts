import { describe, expect, it } from "vitest";
import { computeChangesSummary, type PageSnapshot } from "./changes-summary";

function page(slug: string, title: string, fingerprint: string): PageSnapshot {
  return { slug, title, contentFingerprint: fingerprint };
}

describe("computeChangesSummary", () => {
  it("ne signale rien quand les deux versions sont identiques", () => {
    const previous = [page("accueil", "Accueil", "abc")];
    const next = [page("accueil", "Accueil", "abc")];
    const summary = computeChangesSummary(previous, next);
    expect(summary.totalChangedPages).toBe(0);
    expect(summary.unchangedPageCount).toBe(1);
  });

  it("détecte une page ajoutée", () => {
    const previous = [page("accueil", "Accueil", "abc")];
    const next = [page("accueil", "Accueil", "abc"), page("contact", "Contact", "xyz")];
    const summary = computeChangesSummary(previous, next);
    expect(summary.addedPageSlugs).toEqual(["contact"]);
    expect(summary.totalChangedPages).toBe(1);
  });

  it("détecte une page supprimée", () => {
    const previous = [page("accueil", "Accueil", "abc"), page("contact", "Contact", "xyz")];
    const next = [page("accueil", "Accueil", "abc")];
    const summary = computeChangesSummary(previous, next);
    expect(summary.removedPageSlugs).toEqual(["contact"]);
  });

  it("détecte une page modifiée (contenu différent)", () => {
    const previous = [page("accueil", "Accueil", "abc")];
    const next = [page("accueil", "Accueil", "def")];
    const summary = computeChangesSummary(previous, next);
    expect(summary.changedPageSlugs).toEqual(["accueil"]);
  });

  it("détecte une page modifiée quand seul le TITRE change (contenu identique)", () => {
    const previous = [page("accueil", "Accueil", "abc")];
    const next = [page("accueil", "Bienvenue", "abc")];
    const summary = computeChangesSummary(previous, next);
    expect(summary.changedPageSlugs).toEqual(["accueil"]);
  });

  it("cumule ajouts + suppressions + modifications dans le total", () => {
    const previous = [page("accueil", "Accueil", "abc"), page("a-propos", "À propos", "111")];
    const next = [page("accueil", "Accueil", "changed"), page("contact", "Contact", "222")];
    const summary = computeChangesSummary(previous, next);
    expect(summary.addedPageSlugs).toEqual(["contact"]);
    expect(summary.removedPageSlugs).toEqual(["a-propos"]);
    expect(summary.changedPageSlugs).toEqual(["accueil"]);
    expect(summary.totalChangedPages).toBe(3);
  });

  it("un premier historique (aucune version précédente) compte toutes les pages comme ajoutées", () => {
    const summary = computeChangesSummary([], [page("accueil", "Accueil", "abc")]);
    expect(summary.addedPageSlugs).toEqual(["accueil"]);
  });
});
