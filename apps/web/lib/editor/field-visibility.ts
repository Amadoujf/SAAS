/**
 * Champs affichés dans l'éditeur selon les choix déjà faits : le formulaire (généré à
 * partir du schéma) ne montre que ce qui a un effet. Un champ masqué garde sa valeur
 * — rien n'est perdu si l'entreprise revient sur son choix. Module pur, testé.
 */

type Params = Record<string, unknown>;

/** Champs de premier niveau masqués pour cette section, dans cette variante. */
export function isFieldHidden(sectionKey: string, variant: string, name: string, params: Params): boolean {
  if (sectionKey === "immersive_showcase") {
    const source = (params.source as string | undefined) ?? "products";
    if (name === "productIds") return source !== "products";
    if (name === "listingIds") return source !== "listings";
    if (name === "items") return source !== "manual";
    if (name === "overrides") return source === "manual";
    if (name === "showPrice") return source === "manual";
  }
  if (sectionKey === "scroll_story") {
    if (name === "objectStyle") return variant !== "product";
  }
  if (sectionKey === "immersive_hero") {
    // Les calques composent une scène : sans objet dans la variante « grande photographie ».
    if (name === "layers" || name === "floating") return variant === "architectural";
  }
  return false;
}

/** Champs masqués DANS chaque élément d'une liste (ex. les étapes d'un récit). */
export function isItemFieldHidden(sectionKey: string, variant: string, listName: string, name: string): boolean {
  if (sectionKey === "scroll_story" && listName === "steps") {
    const productOnly = ["accentColor", "rotate", "objectScale"];
    const framingOnly = ["focusX", "focusY", "zoom"];
    if (variant === "product") return framingOnly.includes(name);
    return productOnly.includes(name);
  }
  return false;
}
