import type { Variants } from "framer-motion";
import type { AnimationLevel } from "@yamacommerce/design-tokens";

/**
 * Presets d'animation par niveau — voir docs/12-systeme-templates-et-direction-artistique.md
 * §12.2. Exclusivement `transform`/`opacity` (jamais `top`/`left`/`width`) pour rester
 * fluide à 60 fps, conformément à §12.4.
 *
 * "none" est un niveau interne supplémentaire (pas dans `AnimationLevel`) utilisé quand
 * `prefers-reduced-motion` est actif — voir `use-animation-level.ts`.
 */
export type EffectiveAnimationLevel = AnimationLevel | "none";

const DISTANCE_BY_LEVEL: Record<AnimationLevel, number> = {
  discreet: 8,
  dynamic: 24,
  immersive: 48,
};

const DURATION_BY_LEVEL: Record<AnimationLevel, number> = {
  discreet: 0.25,
  dynamic: 0.45,
  immersive: 0.7,
};

export function fadeInUp(level: EffectiveAnimationLevel): Variants {
  if (level === "none") {
    return { hidden: { opacity: 1 }, visible: { opacity: 1 } };
  }
  return {
    hidden: { opacity: 0, transform: `translateY(${DISTANCE_BY_LEVEL[level]}px)` },
    visible: {
      opacity: 1,
      transform: "translateY(0px)",
      transition: { duration: DURATION_BY_LEVEL[level], ease: [0.4, 0, 0.2, 1] },
    },
  };
}

export function staggerChildren(level: EffectiveAnimationLevel): Variants {
  if (level === "none") return { hidden: {}, visible: {} };
  const stagger = level === "immersive" ? 0.12 : level === "dynamic" ? 0.08 : 0.04;
  return {
    hidden: {},
    visible: { transition: { staggerChildren: stagger } },
  };
}

export function scaleIn(level: EffectiveAnimationLevel): Variants {
  if (level === "none") {
    return {
      hidden: { opacity: 1, transform: "scale(1)" },
      visible: { opacity: 1, transform: "scale(1)" },
    };
  }
  const from = level === "immersive" ? 0.9 : level === "dynamic" ? 0.95 : 0.98;
  return {
    hidden: { opacity: 0, transform: `scale(${from})` },
    visible: {
      opacity: 1,
      transform: "scale(1)",
      transition: { duration: DURATION_BY_LEVEL[level], ease: [0.4, 0, 0.2, 1] },
    },
  };
}

/** Effet de survol léger (cartes, boutons) — désactivé au niveau "discreet"/"none". */
export function hoverLift(level: EffectiveAnimationLevel) {
  if (level === "none" || level === "discreet") return {};
  const lift = level === "immersive" ? -8 : -4;
  return {
    whileHover: { transform: `translateY(${lift}px)` },
    whileTap: { transform: "scale(0.98)" },
  };
}

/** Micro-animation de bouton (clic) — subtile même en "discreet". */
export function buttonTap(level: EffectiveAnimationLevel) {
  if (level === "none") return {};
  return { whileTap: { transform: "scale(0.96)" } };
}
