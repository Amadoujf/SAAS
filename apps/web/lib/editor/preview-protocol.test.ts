import { describe, expect, it } from "vitest";
import { DEFAULT_DESIGN_TOKENS } from "@yamacommerce/design-tokens";
import {
  PREVIEW_CHANNEL,
  PREVIEW_PROTOCOL_VERSION,
  isAllowedOrigin,
  parseFrameToParentMessage,
  parseParentToFrameMessage,
} from "./preview-protocol";

const VALID_PAGE = {
  id: "home",
  slug: "accueil",
  title: "Accueil",
  isHome: true,
  blocks: [
    {
      id: "hero-1",
      sectionKey: "hero" as const,
      variant: "split",
      params: { title: "Bonjour", media: { url: "https://x.test/a.jpg" } },
      order: 0,
      isEnabled: true,
      animationOverride: "inherit" as const,
    },
  ],
};

describe("parseParentToFrameMessage — validation stricte du format", () => {
  it("accepte un CONTENT_UPDATE valide", () => {
    const message = {
      channel: PREVIEW_CHANNEL,
      version: PREVIEW_PROTOCOL_VERSION,
      type: "CONTENT_UPDATE",
      payload: {
        page: VALID_PAGE,
        tokens: DEFAULT_DESIGN_TOKENS,
        animationLevel: "dynamic",
        locale: "fr",
        selectedSectionId: null,
      },
    };
    const parsed = parseParentToFrameMessage(message);
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe("CONTENT_UPDATE");
  });

  it("accepte SELECT_SECTION et SCROLL_TO_SECTION valides", () => {
    expect(
      parseParentToFrameMessage({
        channel: PREVIEW_CHANNEL,
        version: PREVIEW_PROTOCOL_VERSION,
        type: "SELECT_SECTION",
        payload: { sectionId: "hero-1" },
      })?.type,
    ).toBe("SELECT_SECTION");
    expect(
      parseParentToFrameMessage({
        channel: PREVIEW_CHANNEL,
        version: PREVIEW_PROTOCOL_VERSION,
        type: "SCROLL_TO_SECTION",
        payload: { sectionId: "hero-1" },
      })?.type,
    ).toBe("SCROLL_TO_SECTION");
  });

  it("rejette un canal étranger (jamais notre protocole)", () => {
    expect(
      parseParentToFrameMessage({
        channel: "some-other-extension-channel",
        version: 1,
        type: "SELECT_SECTION",
        payload: { sectionId: "hero-1" },
      }),
    ).toBeNull();
  });

  it("rejette une version de protocole différente", () => {
    expect(
      parseParentToFrameMessage({
        channel: PREVIEW_CHANNEL,
        version: 2,
        type: "SELECT_SECTION",
        payload: { sectionId: "hero-1" },
      }),
    ).toBeNull();
  });

  it("rejette un type inconnu", () => {
    expect(
      parseParentToFrameMessage({
        channel: PREVIEW_CHANNEL,
        version: PREVIEW_PROTOCOL_VERSION,
        type: "DELETE_EVERYTHING",
        payload: {},
      }),
    ).toBeNull();
  });

  it("rejette une charge utile malformée (page invalide)", () => {
    expect(
      parseParentToFrameMessage({
        channel: PREVIEW_CHANNEL,
        version: PREVIEW_PROTOCOL_VERSION,
        type: "CONTENT_UPDATE",
        payload: {
          page: { id: "home" /* champs requis manquants */ },
          tokens: DEFAULT_DESIGN_TOKENS,
          animationLevel: "dynamic",
          locale: "fr",
          selectedSectionId: null,
        },
      }),
    ).toBeNull();
  });

  it("ne lève jamais, même sur une entrée totalement étrangère (string, null, tableau)", () => {
    expect(() => parseParentToFrameMessage("un texte quelconque")).not.toThrow();
    expect(parseParentToFrameMessage("un texte quelconque")).toBeNull();
    expect(parseParentToFrameMessage(null)).toBeNull();
    expect(parseParentToFrameMessage([1, 2, 3])).toBeNull();
    expect(parseParentToFrameMessage(undefined)).toBeNull();
  });
});

describe("parseFrameToParentMessage", () => {
  it("accepte READY et SECTION_CLICKED valides", () => {
    expect(
      parseFrameToParentMessage({
        channel: PREVIEW_CHANNEL,
        version: PREVIEW_PROTOCOL_VERSION,
        type: "READY",
      })?.type,
    ).toBe("READY");
    expect(
      parseFrameToParentMessage({
        channel: PREVIEW_CHANNEL,
        version: PREVIEW_PROTOCOL_VERSION,
        type: "SECTION_CLICKED",
        payload: { sectionId: "hero-1" },
      })?.type,
    ).toBe("SECTION_CLICKED");
  });

  it("rejette un message du mauvais sens (un CONTENT_UPDATE n'est jamais envoyé par l'iframe)", () => {
    expect(
      parseFrameToParentMessage({
        channel: PREVIEW_CHANNEL,
        version: PREVIEW_PROTOCOL_VERSION,
        type: "CONTENT_UPDATE",
        payload: {},
      }),
    ).toBeNull();
  });
});

describe("isAllowedOrigin — vérification stricte", () => {
  it("autorise une origine présente dans la liste, par égalité exacte", () => {
    expect(isAllowedOrigin("https://boutique.example.com", ["https://boutique.example.com"])).toBe(
      true,
    );
  });

  it("refuse une origine absente de la liste", () => {
    expect(isAllowedOrigin("https://attaquant.example.com", ["https://boutique.example.com"])).toBe(
      false,
    );
  });

  it("refuse une correspondance partielle (sous-domaine, préfixe)", () => {
    expect(
      isAllowedOrigin("https://boutique.example.com.attaquant.test", [
        "https://boutique.example.com",
      ]),
    ).toBe(false);
    expect(isAllowedOrigin("https://evil.boutique.example.com", ["https://boutique.example.com"])).toBe(
      false,
    );
  });

  it("refuse toujours l'origine littérale 'null', même si présente dans la liste par erreur", () => {
    expect(isAllowedOrigin("null", ["null", "https://boutique.example.com"])).toBe(false);
  });

  it("refuse une liste vide", () => {
    expect(isAllowedOrigin("https://boutique.example.com", [])).toBe(false);
  });
});
