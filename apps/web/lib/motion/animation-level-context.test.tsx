import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnimationLevelProvider, useAnimationLevel } from "./animation-level-context";

function Probe() {
  const level = useAnimationLevel();
  return <span data-testid="level">{level}</span>;
}

/**
 * Le test « prefers-reduced-motion force none » vit dans son propre fichier
 * (animation-level-context.reduced-motion.test.tsx) : le hook `useReducedMotion` de
 * Framer Motion met en cache sa détection au niveau du module après le premier rendu,
 * donc surcharger `window.matchMedia` APRÈS qu'un test de ce fichier ait déjà monté le
 * provider ne serait plus pris en compte — seul un module fraîchement chargé (un
 * fichier de test distinct, isolé par Vitest) réagit correctement.
 */
describe("AnimationLevelProvider", () => {
  it.each(["discreet", "dynamic", "immersive"] as const)(
    "propage le niveau « %s » choisi par l'entreprise quand le visiteur n'a pas demandé de mouvement réduit",
    (level) => {
      render(
        <AnimationLevelProvider level={level}>
          <Probe />
        </AnimationLevelProvider>,
      );
      expect(screen.getByTestId("level")).toHaveTextContent(level);
    },
  );
});
