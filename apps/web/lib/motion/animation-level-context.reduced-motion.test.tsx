import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnimationLevelProvider, useAnimationLevel } from "./animation-level-context";

// Doit être appliqué avant le tout premier rendu du fichier : Framer Motion met en
// cache sa détection de `prefers-reduced-motion` au niveau du module (voir la note
// dans animation-level-context.test.tsx) — d'où ce fichier séparé, isolé par Vitest.
window.matchMedia = ((query: string) => ({
  matches: query.includes("prefers-reduced-motion"),
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

function Probe() {
  const level = useAnimationLevel();
  return <span data-testid="level">{level}</span>;
}

describe("AnimationLevelProvider — prefers-reduced-motion", () => {
  it("force le niveau à « none » quand `prefers-reduced-motion: reduce` est actif, quel que soit le niveau choisi par l'entreprise", () => {
    render(
      <AnimationLevelProvider level="immersive">
        <Probe />
      </AnimationLevelProvider>,
    );
    expect(screen.getByTestId("level")).toHaveTextContent("none");
  });
});
