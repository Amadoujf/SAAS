"use client";

import { motion } from "framer-motion";
import { useAnimationLevel } from "./animation-level-context";
import { useAnimationDetail } from "./animation-detail-context";
import { revealVariant, type EffectiveAnimationLevel } from "./variants";

/**
 * Apparition progressive au défilement — voir docs/12 §12.2 et la liste d'animations
 * demandées (« apparition progressive au défilement »). Respecte le niveau
 * d'animation effectif (y compris `prefers-reduced-motion`, géré par
 * `AnimationLevelProvider`) : au niveau "none", les enfants s'affichent directement,
 * sans wrapper animé.
 *
 * Lit aussi `useAnimationDetail()` (type/direction/durée/délai, voir
 * animation-detail-context.tsx) — c'est ce qui permet au panneau « Animation » de
 * l'éditeur visuel de personnaliser une section SANS qu'aucun des 19+ composants de
 * section (qui appellent tous `<Reveal>` sans le savoir) n'ait besoin d'être modifié.
 */
export function Reveal({
  children,
  className,
  levelOverride,
}: {
  children: React.ReactNode;
  className?: string;
  /** Permet à une section de forcer "none" localement (voir `animationOverride`). */
  levelOverride?: EffectiveAnimationLevel;
}) {
  const contextLevel = useAnimationLevel();
  const detail = useAnimationDetail();
  const level = levelOverride ?? contextLevel;

  if (level === "none") {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-64px" }}
      variants={revealVariant(level, detail)}
    >
      {children}
    </motion.div>
  );
}
