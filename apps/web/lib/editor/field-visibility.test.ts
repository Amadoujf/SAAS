import { describe, expect, it } from "vitest";
import { isFieldHidden, isItemFieldHidden } from "./field-visibility";

describe("champs affichés selon les choix", () => {
  it("carrousel : seule la source choisie est proposée", () => {
    const hidden = (source: string | undefined) => ["productIds", "listingIds", "items", "overrides", "showPrice"].filter((n) => isFieldHidden("immersive_showcase", "arc", n, { source }));
    expect(hidden(undefined)).toEqual(["listingIds", "items"]);
    expect(hidden("listings")).toEqual(["productIds", "items"]);
    expect(hidden("manual")).toEqual(["productIds", "listingIds", "overrides", "showPrice"]);
  });
  it("récit : pose de l'objet pour « product », cadrage pour les autres", () => {
    expect(isFieldHidden("scroll_story", "focus", "objectStyle", {})).toBe(true);
    expect(isFieldHidden("scroll_story", "product", "objectStyle", {})).toBe(false);
    expect(isItemFieldHidden("scroll_story", "product", "steps", "rotate")).toBe(false);
    expect(isItemFieldHidden("scroll_story", "product", "steps", "zoom")).toBe(true);
    expect(isItemFieldHidden("scroll_story", "focus", "steps", "rotate")).toBe(true);
    expect(isItemFieldHidden("scroll_story", "focus", "steps", "focusX")).toBe(false);
  });
  it("les autres sections ne sont pas touchées", () => {
    expect(isFieldHidden("hero", "split", "title", {})).toBe(false);
  });
});
