"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { useAnimationLevel } from "@/lib/motion/animation-level-context";

/**
 * Curseur personnalisé — voir la refonte artistique du 16 septembre 2026 (« curseur
 * personnalisé sur ordinateur »). Un point suit la souris avec un léger ressort, et
 * grossit au survol de tout élément interactif (lien, bouton) porteur de
 * `data-cursor-hover` — voir la classe utilitaire posée sur les liens/boutons
 * concernés. Ne s'affiche JAMAIS sur un appareil tactile (`pointer: coarse`), et
 * seulement aux niveaux d'animation "dynamic"/"immersive" (jamais si
 * `prefers-reduced-motion`, qui force déjà le niveau effectif à "none").
 */
export function CustomCursor() {
  const level = useAnimationLevel();
  const [enabled, setEnabled] = useState(false);
  const [hovering, setHovering] = useState(false);
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const springX = useSpring(x, { damping: 28, stiffness: 400, mass: 0.4 });
  const springY = useSpring(y, { damping: 28, stiffness: 400, mass: 0.4 });

  useEffect(() => {
    const canHover = window.matchMedia("(pointer: fine)").matches;
    setEnabled(canHover);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    function handleMove(event: MouseEvent) {
      x.set(event.clientX);
      y.set(event.clientY);
      const target = event.target as HTMLElement;
      setHovering(Boolean(target.closest('a, button, [data-cursor-hover]')));
    }
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, [enabled, x, y]);

  const active = enabled && (level === "immersive" || level === "dynamic");

  useEffect(() => {
    if (!active) return;
    document.body.style.cursor = "none";
    return () => {
      document.body.style.cursor = "";
    };
  }, [active]);

  if (!active) return null;

  // Anneau (pas un disque plein en `mix-blend-difference`) : ce dernier produisait un
  // rendu terne/grisâtre au-dessus des zones semi-transparentes (en-tête sur le hero,
  // superpositions) — un simple contour avec ombre portée reste lisible sur n'importe
  // quel fond, clair ou sombre, sans cet artefact.
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[100]"
      style={{ x: springX, y: springY }}
    >
      <motion.div
        className="rounded-full border-[1.5px] border-white bg-white/10 [box-shadow:0_0_0_1px_rgba(0,0,0,0.35)]"
        animate={{
          width: hovering ? 44 : 10,
          height: hovering ? 44 : 10,
          x: hovering ? -22 : -5,
          y: hovering ? -22 : -5,
          backgroundColor: hovering ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.9)",
        }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      />
    </motion.div>
  );
}
