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

  /**
   * Sections ajoutées pour la refonte artistique du 16 septembre 2026
   * (brand_manifesto, signature_product, heritage, lookbook) — voir la revue du même
   * jour, point 4 : elles doivent être validées, se rendre correctement avec des
   * paramètres valides, et échouer proprement (fallback, jamais un crash) avec des
   * paramètres invalides, exactement comme les sections préexistantes.
   */
  describe("nouvelles sections (refonte artistique)", () => {
    it("rend un manifeste de marque valide", () => {
      render(
        <SectionRenderer
          instance={{
            id: "manifesto-1",
            sectionKey: "brand_manifesto",
            variant: "image-right",
            order: 0,
            params: {
              statement: "Le luxe se façonne à la main.",
              media: { url: "https://images.unsplash.com/photo-test-manifesto" },
            },
          }}
          locale="fr"
        />,
      );
      // `RevealText` scinde la phrase en un `<span>` par mot pour l'animation en
      // cascade (voir lib/motion/reveal-text.tsx) — le texte visible n'est donc jamais
      // un seul nœud contigu ; l'assertion porte sur le nom accessible du titre
      // (`aria-label`, posé exprès pour les lecteurs d'écran).
      expect(screen.getByRole("heading", { name: /luxe se façonne/i })).toBeInTheDocument();
    });

    it("affiche un fallback pour un manifeste de marque sans média (paramètres invalides)", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      render(
        <SectionRenderer
          instance={{
            id: "manifesto-2",
            sectionKey: "brand_manifesto",
            variant: "image-right",
            order: 0,
            params: { statement: "Sans média" },
          }}
          locale="fr"
        />,
      );
      expect(screen.getByRole("alert")).toHaveTextContent("brand_manifesto");
      errorSpy.mockRestore();
    });

    it("rend un produit signature valide", () => {
      render(
        <SectionRenderer
          instance={{
            id: "signature-1",
            sectionKey: "signature_product",
            variant: "leather",
            order: 0,
            params: {
              title: "Le Sac Signature",
              media: { url: "https://images.unsplash.com/photo-test-signature" },
            },
          }}
          locale="fr"
        />,
      );
      expect(screen.getByText("Le Sac Signature")).toBeInTheDocument();
    });

    it("rend une section héritage/savoir-faire valide, y compris ses chiffres clés", () => {
      render(
        <SectionRenderer
          instance={{
            id: "heritage-1",
            sectionKey: "heritage",
            variant: "image-left",
            order: 0,
            params: {
              title: "Un savoir-faire dakarois",
              body: "Chaque pièce est façonnée à la main.",
              media: { url: "https://images.unsplash.com/photo-test-heritage" },
              stats: [{ value: "12", label: "Artisans" }],
            },
          }}
          locale="fr"
        />,
      );
      expect(screen.getByText("Un savoir-faire dakarois")).toBeInTheDocument();
      expect(screen.getByText("12")).toBeInTheDocument();
    });

    it("affiche un fallback pour une section héritage sans corps de texte (paramètres invalides)", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      render(
        <SectionRenderer
          instance={{
            id: "heritage-2",
            sectionKey: "heritage",
            variant: "image-left",
            order: 0,
            params: { title: "Titre seul", media: { url: "https://example.com/x.jpg" } },
          }}
          locale="fr"
        />,
      );
      expect(screen.getByRole("alert")).toHaveTextContent("heritage");
      errorSpy.mockRestore();
    });

    it("rend un lookbook valide même sans contenu résolu pour ses points interactifs", () => {
      render(
        <SectionRenderer
          instance={{
            id: "lookbook-1",
            sectionKey: "lookbook",
            variant: "mosaic",
            order: 0,
            params: {
              title: "Lookbook",
              images: [{ url: "https://images.unsplash.com/photo-test-look", hotspots: [{ x: 50, y: 50, productId: "x" }] }],
            },
          }}
          locale="fr"
        />,
      );
      expect(screen.getByText("Lookbook")).toBeInTheDocument();
    });
  });
});
