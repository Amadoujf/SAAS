import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SectionRenderer } from "./section-renderer";

/**
 * Vérifications explicitement demandées pour le moteur de rendu (validation du
 * 13 septembre 2026) : propriétés invalides, section inconnue, section désactivée.
 */
describe("SectionRenderer", () => {
  it("affiche un fallback propre pour des paramètres invalides (jamais de crash)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <SectionRenderer
        instance={{ id: "s1", sectionKey: "hero", variant: "split", params: {}, order: 0 }}
        locale="fr"
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("hero");
    errorSpy.mockRestore();
  });

  it("affiche un fallback propre pour une clé de section inconnue", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <SectionRenderer
        instance={{
          id: "s2",
          sectionKey: "section-qui-nexiste-pas",
          variant: "x",
          params: {},
          order: 0,
        }}
        locale="fr"
      />,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    errorSpy.mockRestore();
  });

  it("ne rend rien pour une section désactivée (isEnabled: false)", () => {
    const { container } = render(
      <SectionRenderer
        instance={{
          id: "s3",
          sectionKey: "cta",
          variant: "banner",
          isEnabled: false,
          order: 0,
          params: { title: "Titre", buttonLabel: "Voir", buttonHref: "/x" },
        }}
        locale="fr"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("rend correctement une section valide", () => {
    render(
      <SectionRenderer
        instance={{
          id: "s4",
          sectionKey: "cta",
          variant: "banner",
          order: 0,
          params: {
            title: "Profitez-en maintenant",
            buttonLabel: "Découvrir",
            buttonHref: "/catalogue",
          },
        }}
        locale="fr"
      />,
    );

    expect(screen.getByText("Profitez-en maintenant")).toBeInTheDocument();
    expect(screen.getByText("Découvrir")).toBeInTheDocument();
  });

  it("affiche un fallback si le contenu catalogue résolu est manquant (categories)", () => {
    render(
      <SectionRenderer
        instance={{
          id: "categories-x",
          sectionKey: "categories",
          variant: "grid",
          order: 0,
          params: { categoryIds: ["a", "b"] },
        }}
        locale="fr"
        // resolvedContent volontairement omis
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("categories");
  });
});
