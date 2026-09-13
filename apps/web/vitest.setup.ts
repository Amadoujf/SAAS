import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { config } from "dotenv";
import { resolve } from "node:path";
import { createElement } from "react";

// `next/image` valide ses hôtes distants (`next.config.mjs`) via une configuration
// injectée par le build/dev server de Next — absente sous Vitest, ce qui fait échouer
// TOUT rendu d'image avec une URL distante valide, quel que soit l'hôte (découvert le
// 16 septembre 2026 en testant les nouvelles sections de la refonte artistique : même
// `images.unsplash.com`, pourtant autorisé, échouait). Un remplacement par une simple
// `<img>` est le contournement standard pour tester des composants qui utilisent
// `next/image` sans dépendre du serveur Next.
vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { fill: _fill, priority: _priority, sizes: _sizes, loader: _loader, ...rest } = props;
    return createElement("img", rest);
  },
}));

// `globals: true` n'est pas activé (voir vitest.config.ts) : React Testing Library ne
// démonte donc pas automatiquement le DOM entre les tests d'un même fichier — sans ce
// nettoyage explicite, plusieurs `render()` dans un `describe`/`it.each` accumulent des
// éléments et cassent les requêtes `getByTestId`/`getByRole` (« multiple elements »).
afterEach(() => {
  cleanup();
});

// Charge le .env à la racine du monorepo — nécessaire pour les tests DB de
// lib/rendering (DATABASE_URL, MIGRATE_DATABASE_URL, REQUIRE_DB_TESTS).
config({ path: resolve(__dirname, "../../.env") });

// jsdom n'implémente pas matchMedia — requis par `useReducedMotion()` de Framer
// Motion (voir lib/motion/animation-level-context.tsx). Par défaut : pas de préférence
// pour le mouvement réduit ; les tests qui veulent l'émuler surchargent ce mock.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

// jsdom n'implémente pas IntersectionObserver — requis par les animations
// `whileInView` de Framer Motion (voir lib/motion/reveal.tsx, utilisé par la plupart
// des sections). Un stub minimal suffit : les tests ne vérifient pas le déclenchement
// réel du scroll, seulement que le rendu ne plante pas.
if (typeof window !== "undefined" && !window.IntersectionObserver) {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null = null;
    readonly rootMargin: string = "";
    readonly thresholds: ReadonlyArray<number> = [];
    disconnect() {}
    observe() {}
    unobserve() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
  global.IntersectionObserver = window.IntersectionObserver;
}
