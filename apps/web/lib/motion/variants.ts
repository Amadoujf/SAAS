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

/**
 * Généralisation de `fadeInUp` — voir docs/12 §12.2, panneau « Animation » (type
 * d'apparition, direction, durée, délai). `fadeInUp` reste inchangée et exportée
 * (d'autres sections l'appellent directement pour leurs propres listes en cascade,
 * ex. heritage.tsx) : cette fonction est un AJOUT, pas un remplacement.
 */
export interface RevealDetail {
  type?: "fade" | "slide" | "scale";
  direction?: "up" | "down" | "left" | "right";
  durationMs?: number;
  delayMs?: number;
}

export function revealVariant(level: EffectiveAnimationLevel, detail: RevealDetail = {}): Variants {
  if (level === "none") {
    return { hidden: { opacity: 1 }, visible: { opacity: 1 } };
  }

  const type = detail.type ?? "fade";
  const direction = detail.direction ?? "up";
  const duration = detail.durationMs != null ? detail.durationMs / 1000 : DURATION_BY_LEVEL[level];
  const delay = detail.delayMs != null ? detail.delayMs / 1000 : 0;
  const transition = { duration, delay, ease: [0.4, 0, 0.2, 1] as const };

  if (type === "scale") {
    return {
      hidden: { opacity: 0, transform: "scale(0.92)" },
      visible: { opacity: 1, transform: "scale(1)", transition },
    };
  }

  // "fade" (décalage léger, l'apparition classique) et "slide" (décalage plus
  // marqué, l'entrée se remarque davantage) partagent le même axe de direction —
  // seule l'amplitude du décalage initial diffère.
  const distance = DISTANCE_BY_LEVEL[level] * (type === "slide" ? 2.5 : 1);
  const AXIS: Record<NonNullable<RevealDetail["direction"]>, string> = {
    up: `translateY(${distance}px)`,
    down: `translateY(-${distance}px)`,
    left: `translateX(${distance}px)`,
    right: `translateX(-${distance}px)`,
  };

  return {
    hidden: { opacity: 0, transform: AXIS[direction] },
    visible: { opacity: 1, transform: "translate(0px, 0px)", transition },
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
