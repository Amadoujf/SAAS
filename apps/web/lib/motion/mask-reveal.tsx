"use client";

import { motion } from "framer-motion";
import { useAnimationLevel } from "./animation-level-context";

/**
 * Révèle son contenu (typiquement une image) par un effet de "rideau" plutôt qu'un
 * simple fondu — voir la refonte artistique du 16 septembre 2026 (« images dévoilées
 * par masque »). Un panneau plein de la couleur `primary` du template glisse pour
 * découvrir le contenu. Désactivé (rendu direct) au niveau "none".
 */
export function MaskReveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const level = useAnimationLevel();

  if (level === "none") {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      {children}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 z-10 bg-[var(--color-primary)]"
        initial={{ transform: "scaleX(1)" }}
        whileInView={{ transform: "scaleX(0)" }}
        viewport={{ once: true, margin: "-10% 0px" }}
        transition={{ duration: 0.9, ease: [0.83, 0, 0.17, 1], delay }}
        style={{ transformOrigin: "right" }}
      />
    </div>
  );
}
