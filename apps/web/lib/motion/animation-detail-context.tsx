"use client";

import { createContext, useContext } from "react";

/**
 * Détail d'animation ambiant — voir @yamacommerce/templates `SectionAnimationDetail`
 * et docs/12 §12.2 (panneau « Animation »). Miroir exact du mécanisme déjà en place
 * pour le NIVEAU d'animation (`AnimationLevelContext`/`AnimationScopeOverride`, voir
 * animation-level-context.tsx) : `Reveal` lit ce contexte lui-même, ce qui permet à
 * `SectionRenderer` de poser un détail par section SANS modifier aucun des 19+
 * composants de section existants (ils appellent déjà tous `<Reveal>`).
 */
export interface AnimationDetail {
  type?: "fade" | "slide" | "scale";
  direction?: "up" | "down" | "left" | "right";
  durationMs?: number;
  delayMs?: number;
  hoverEffect?: "none" | "lift" | "zoom" | "glow";
}

const AnimationDetailContext = createContext<AnimationDetail>({});

export function useAnimationDetail(): AnimationDetail {
  return useContext(AnimationDetailContext);
}

/** Pose un détail d'animation pour toute la portée (une section) — absent de
 *  `override` ou champ non renseigné = comportement hérité, identique à avant
 *  l'ajout de ce mécanisme. */
export function AnimationDetailScope({
  override,
  children,
}: {
  override?: AnimationDetail;
  children: React.ReactNode;
}) {
  const ambient = useAnimationDetail();
  const value = override ? { ...ambient, ...override } : ambient;
  return (
    <AnimationDetailContext.Provider value={value}>{children}</AnimationDetailContext.Provider>
  );
}
