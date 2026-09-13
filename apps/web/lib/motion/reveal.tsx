"use client";

import { motion } from "framer-motion";
import { useAnimationLevel } from "./animation-level-context";
import { fadeInUp, type EffectiveAnimationLevel } from "./variants";

/**
 * Apparition progressive au défilement — voir docs/12 §12.2 et la liste d'animations
 * demandées (« apparition progressive au défilement »). Respecte le niveau
 * d'animation effectif (y compris `prefers-reduced-motion`, géré par
 * `AnimationLevelProvider`) : au niveau "none", les enfants s'affichent directement,
 * sans wrapper animé.
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
      variants={fadeInUp(level)}
    >
      {children}
    </motion.div>
  );
}
