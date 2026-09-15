/**
 * Résumé des changements entre deux versions — voir docs/12 §12.3, « historique des
 * versions » : « Nombre de pages modifiées », « Résumé des changements ». Calculé UNE
 * SEULE FOIS au moment de la publication et figé sur la version publiée
 * (`TenantSiteVersion.changesSummary`, voir @yamacommerce/database) — jamais recalculé
 * après coup contre une version qui aurait depuis changé, ce qui romprait
 * l'immuabilité d'une version déjà publiée.
 */

export interface PageSnapshot {
  slug: string;
  title: string;
  /** Sérialisation stable des blocs (ex. `JSON.stringify` des `SectionInstance[]`
   *  déjà triés par id) — cette fonction ne connaît pas la forme d'une section,
   *  seulement si elle a changé, pour rester sector-agnostic. */
  contentFingerprint: string;
}

export interface ChangesSummary {
  addedPageSlugs: string[];
  removedPageSlugs: string[];
  changedPageSlugs: string[];
  unchangedPageCount: number;
  /** Somme de `added` + `removed` + `changed` — la valeur affichée pour « Nombre de
   *  pages modifiées ». */
  totalChangedPages: number;
}

export function computeChangesSummary(
  previousPages: PageSnapshot[],
  nextPages: PageSnapshot[],
): ChangesSummary {
  const previousBySlug = new Map(previousPages.map((page) => [page.slug, page]));
  const nextBySlug = new Map(nextPages.map((page) => [page.slug, page]));

  const addedPageSlugs: string[] = [];
  const changedPageSlugs: string[] = [];
  let unchangedPageCount = 0;

  for (const [slug, page] of nextBySlug) {
    const previous = previousBySlug.get(slug);
    if (!previous) {
      addedPageSlugs.push(slug);
    } else if (previous.contentFingerprint !== page.contentFingerprint || previous.title !== page.title) {
      changedPageSlugs.push(slug);
    } else {
      unchangedPageCount += 1;
    }
  }

  const removedPageSlugs = [...previousBySlug.keys()].filter((slug) => !nextBySlug.has(slug));

  return {
    addedPageSlugs,
    removedPageSlugs,
    changedPageSlugs,
    unchangedPageCount,
    totalChangedPages: addedPageSlugs.length + removedPageSlugs.length + changedPageSlugs.length,
  };
}
