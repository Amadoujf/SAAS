import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DEFAULT_DESIGN_TOKENS } from "@yamacommerce/design-tokens";
import { RenderTemplatePage } from "./render-template-page";
import type { PageDefinition } from "@yamacommerce/templates";

function ctaSection(id: string, order: number, title: string) {
  return {
    id,
    sectionKey: "cta" as const,
    variant: "banner",
    order,
    isEnabled: true,
    animationOverride: "inherit" as const,
    params: { title, buttonLabel: "Go", buttonHref: "/x" },
  };
}

/** Vérifie l'ordre d'affichage des sections — exigence explicite du moteur de rendu. */
describe("RenderTemplatePage — ordre des sections", () => {
  it("affiche les sections dans l'ordre défini par `order`, pas par leur position dans le tableau", () => {
    const page: PageDefinition = {
      slug: "accueil",
      title: "Accueil",
      isHome: true,
      // Volontairement mélangé : la section "order: 0" est en dernière position du
      // tableau — le rendu doit quand même l'afficher en premier.
      sections: [
        ctaSection("c", 2, "Troisième"),
        ctaSection("a", 0, "Première"),
        ctaSection("b", 1, "Deuxième"),
      ],
    };

    render(
      <RenderTemplatePage
        page={page}
        tokens={DEFAULT_DESIGN_TOKENS}
        animationLevel="dynamic"
        locale="fr"
      />,
    );

    const headings = screen.getAllByRole("heading", { level: 2 }).map((el) => el.textContent);
    expect(headings).toEqual(["Première", "Deuxième", "Troisième"]);
  });

  it("exclut les sections désactivées du rendu", () => {
    const page: PageDefinition = {
      slug: "accueil",
      title: "Accueil",
      isHome: true,
      sections: [
        ctaSection("a", 0, "Visible"),
        { ...ctaSection("b", 1, "Cachée"), isEnabled: false },
      ],
    };

    render(
      <RenderTemplatePage
        page={page}
        tokens={DEFAULT_DESIGN_TOKENS}
        animationLevel="dynamic"
        locale="fr"
      />,
    );

    expect(screen.getByText("Visible")).toBeInTheDocument();
    expect(screen.queryByText("Cachée")).not.toBeInTheDocument();
  });
});
