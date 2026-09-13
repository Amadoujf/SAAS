"use client";

import { useRef } from "react";
import { useScroll, useTransform, motion, useReducedMotion } from "framer-motion";
import { useAnimationLevel } from "./animation-level-context";

/**
 * Parallaxe subtil lié au défilement — voir la refonte artistique du 16 septembre 2026
 * (« effet de profondeur subtil », « animation de parallaxe »). Le contenu se déplace
 * légèrement plus lentement que le défilement de la page. Désactivé au niveau "none"
 * (respecte `prefers-reduced-motion` en plus, indépendamment du niveau choisi).
 */
export function Parallax({
  children,
  strength = 60,
  className,
}: {
  children: React.ReactNode;
  strength?: number;
  className?: string;
}) {
  const level = useAnimationLevel();
  const prefersReducedMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [-strength, strength]);

  if (level === "none" || prefersReducedMotion) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }

  return (
    <div ref={ref} className={`overflow-hidden ${className ?? ""}`}>
      <motion.div style={{ y, height: "calc(100% + 120px)", marginTop: "-60px" }}>{children}</motion.div>
    </div>
  );
}
