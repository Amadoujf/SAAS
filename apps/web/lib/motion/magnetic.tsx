"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { useAnimationLevel } from "./animation-level-context";

/**
 * Effet « magnétique » léger sur un élément interactif — voir la refonte artistique du
 * 16 septembre 2026 (« effets magnétiques légers sur les boutons »). L'élément se
 * déplace très légèrement vers le curseur à l'intérieur de ses limites, revient à sa
 * position au survol terminé. Désactivé au niveau "none"/"discreet" et sur les
 * appareils tactiles (pas de `mousemove` pertinent).
 */
export function Magnetic({
  children,
  strength = 14,
  className,
}: {
  children: React.ReactNode;
  strength?: number;
  className?: string;
}) {
  const level = useAnimationLevel();
  const ref = useRef<HTMLDivElement>(null);
  const enabled = level === "immersive" || level === "dynamic";

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (!enabled || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const relX = (event.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    const relY = (event.clientY - rect.top - rect.height / 2) / (rect.height / 2);
    ref.current.style.transform = `translate(${relX * strength}px, ${relY * strength}px)`;
  }

  function handleMouseLeave() {
    if (!ref.current) return;
    ref.current.style.transform = "translate(0px, 0px)";
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
      style={{ transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)" }}
    >
      {children}
    </motion.div>
  );
}
