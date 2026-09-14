import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DEFAULT_DESIGN_TOKENS } from "@yamacommerce/design-tokens";
import { SectionRenderer } from "./section-renderer";
import { CurrencyProvider } from "@/lib/commerce/currency-context";

/** Certaines sections (lookbook, à terme d'autres) affichent un prix via
 *  `useCurrency()` (voir lib/commerce/currency-context.tsx) — ce hook exige un
 *  `<CurrencyProvider>` ancêtre, comme `useLocale()`. */
function renderSection(ui: React.ReactElement) {
  return render(<CurrencyProvider>{ui}</CurrencyProvider>);
}

/**
 * Vérifications explicitement demandées pour le moteur de rendu (validation du
 * 13 septembre 2026) : propriétés invalides, section inconnue, section désactivée.
 */
describe("SectionRenderer", () => {
  it("affiche un fallback propre pour des paramètres invalides (jamais de crash)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    renderSection(
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

    renderSection(
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
    const { container } = renderSection(
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
    renderSection(
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
    renderSection(
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
      renderSection(
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
      renderSection(
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
      renderSection(
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
      renderSection(
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
      renderSection(
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
      renderSection(
        <SectionRenderer
          instance={{
            id: "lookbook-1",
            sectionKey: "lookbook",
            variant: "mosaic",
            order: 0,
            params: {
              title: "Lookbook",
              images: [
                {
                  url: "https://images.unsplash.com/photo-test-look",
                  hotspots: [{ x: 50, y: 50, productId: "x" }],
                },
              ],
            },
          }}
          locale="fr"
        />,
      );
      expect(screen.getByText("Lookbook")).toBeInTheDocument();
    });
  });

  /**
   * Sections ajoutées pour « Boutique africaine contemporaine » (Teranga Atelier,
   * 20 septembre 2026) : créateurs en vedette et provenance des créations.
   */
  describe("nouvelles sections (Teranga Atelier)", () => {
    it("rend une section créateurs valide avec contenu résolu", () => {
      renderSection(
        <SectionRenderer
          instance={{
            id: "designers-1",
            sectionKey: "designers",
            variant: "grid",
            order: 0,
            params: { designerIds: ["aissatou-diop"] },
          }}
          locale="fr"
          resolvedContent={{
            "designers-1": {
              designers: [
                {
                  id: "aissatou-diop",
                  name: "Aïssatou Diop",
                  specialty: "Maroquinerie",
                  photoUrl: "https://images.unsplash.com/photo-test-designer",
                  href: "/createur/aissatou-diop",
                },
              ],
            },
          }}
        />,
      );
      expect(screen.getByText("Aïssatou Diop")).toBeInTheDocument();
    });

    it("affiche un fallback si le contenu créateurs résolu est manquant", () => {
      renderSection(
        <SectionRenderer
          instance={{
            id: "designers-2",
            sectionKey: "designers",
            variant: "grid",
            order: 0,
            params: { designerIds: ["x"] },
          }}
          locale="fr"
        />,
      );
      expect(screen.getByRole("alert")).toHaveTextContent("designers");
    });

    it("rend une section provenance valide (variante carte)", () => {
      renderSection(
        <SectionRenderer
          instance={{
            id: "provenance-1",
            sectionKey: "provenance",
            variant: "map",
            order: 0,
            params: {
              regions: [
                {
                  id: "casamance",
                  name: "Casamance",
                  craft: "Tissage",
                  description: "Tissage traditionnel en coton local.",
                  media: { url: "https://images.unsplash.com/photo-test-casamance" },
                  x: 30,
                  y: 70,
                },
              ],
            },
          }}
          locale="fr"
        />,
      );
      // "Casamance" apparaît deux fois (titre de la région active + puce de
      // sélection) — la variante carte n'est pas une simple liste, voir provenance.tsx.
      expect(screen.getAllByText("Casamance").length).toBeGreaterThan(0);
    });

    it("affiche un fallback pour une provenance sans région (paramètres invalides)", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      renderSection(
        <SectionRenderer
          instance={{
            id: "provenance-2",
            sectionKey: "provenance",
            variant: "map",
            order: 0,
            params: { regions: [] },
          }}
          locale="fr"
        />,
      );
      expect(screen.getByRole("alert")).toHaveTextContent("provenance");
      errorSpy.mockRestore();
    });
  });

  /** Section ajoutée pour Dakar Distribution Pro (template 5, 20 septembre 2026). */
  describe("nouvelle section (Dakar Distribution Pro)", () => {
    it("rend une recherche catalogue valide", () => {
      renderSection(
        <SectionRenderer
          instance={{
            id: "search-1",
            sectionKey: "catalog_search",
            variant: "hero",
            order: 0,
            params: { title: "Trouvez le produit qu'il vous faut" },
          }}
          locale="fr"
        />,
      );
      expect(
        screen.getByRole("heading", { name: "Trouvez le produit qu'il vous faut" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("searchbox")).toBeInTheDocument();
    });

    it("affiche un fallback pour une recherche catalogue sans titre (paramètres invalides)", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      renderSection(
        <SectionRenderer
          instance={{
            id: "search-2",
            sectionKey: "catalog_search",
            variant: "hero",
            order: 0,
            params: {},
          }}
          locale="fr"
        />,
      );
      expect(screen.getByRole("alert")).toHaveTextContent("catalog_search");
      errorSpy.mockRestore();
    });
  });

  /**
   * Panneaux avancés de personnalisation (20 septembre 2026, docs/12 §12.2) —
   * vérifie que `styleOverride`/`spacingOverride`/`animationDetail` ont un effet RÉEL
   * sur le DOM produit, et qu'une section SANS aucune surcharge n'est jamais enveloppée
   * dans un conteneur supplémentaire (zéro risque de régression pour les 5 templates
   * déjà livrés, qui ne posent aucun de ces champs).
   */
  describe("surcharges de style/espacement/animation par section", () => {
    it("n'ajoute AUCUN conteneur supplémentaire quand aucune surcharge n'est posée", () => {
      const { container } = renderSection(
        <SectionRenderer
          instance={{
            id: "cta-plain",
            sectionKey: "cta",
            variant: "banner",
            order: 0,
            params: { title: "Titre", buttonLabel: "Go", buttonHref: "/x" },
          }}
          locale="fr"
          tokens={DEFAULT_DESIGN_TOKENS}
        />,
      );
      // Le premier enfant direct doit être la <section> du CTA lui-même, pas un <div>
      // englobant posé par le mécanisme de surcharge.
      expect(container.firstElementChild?.tagName).toBe("SECTION");
    });

    it("pose la variable CSS correspondante quand `styleOverride` est renseigné", () => {
      const { container } = renderSection(
        <SectionRenderer
          instance={{
            id: "cta-styled",
            sectionKey: "cta",
            variant: "banner",
            order: 0,
            params: { title: "Titre", buttonLabel: "Go", buttonHref: "/x" },
            styleOverride: { colorPrimary: "#ff0000" },
          }}
          locale="fr"
          tokens={DEFAULT_DESIGN_TOKENS}
        />,
      );
      const wrapper = container.firstElementChild as HTMLElement;
      expect(wrapper.style.getPropertyValue("--color-primary")).toBe("#ff0000");
    });

    it("ignore silencieusement `styleOverride` si aucun `tokens` n'est fourni (jamais un plantage)", () => {
      const { container } = renderSection(
        <SectionRenderer
          instance={{
            id: "cta-styled-2",
            sectionKey: "cta",
            variant: "banner",
            order: 0,
            params: { title: "Titre", buttonLabel: "Go", buttonHref: "/x" },
            styleOverride: { colorPrimary: "#ff0000" },
          }}
          locale="fr"
          // `tokens` volontairement omis
        />,
      );
      expect(container.firstElementChild?.tagName).toBe("SECTION");
    });

    it("émet une règle @media par point de rupture quand `spacingOverride` est renseigné", () => {
      const { container } = renderSection(
        <SectionRenderer
          instance={{
            id: "cta-spaced",
            sectionKey: "cta",
            variant: "banner",
            order: 0,
            params: { title: "Titre", buttonLabel: "Go", buttonHref: "/x" },
            spacingOverride: { mobile: { paddingY: "12px" }, desktop: { paddingY: "80px" } },
          }}
          locale="fr"
        />,
      );
      const styleTag = container.querySelector("style");
      expect(styleTag?.textContent).toContain("padding-top: 12px");
      expect(styleTag?.textContent).toContain("@media (min-width: 1024px)");
    });

    it("pose la classe d'effet de survol correspondant à `animationDetail.hoverEffect`", () => {
      const { container } = renderSection(
        <SectionRenderer
          instance={{
            id: "cta-hover",
            sectionKey: "cta",
            variant: "banner",
            order: 0,
            params: { title: "Titre", buttonLabel: "Go", buttonHref: "/x" },
            animationDetail: { hoverEffect: "lift" },
          }}
          locale="fr"
        />,
      );
      const wrapper = container.firstElementChild as HTMLElement;
      expect(wrapper.className).toContain("hover:-translate-y-1");
    });
  });
});
