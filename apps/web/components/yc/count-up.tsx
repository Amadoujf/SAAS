"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

/** Chiffre animé à l'apparition. Le rendu serveur contient déjà la VALEUR FINALE
 *  (lisible sans JavaScript, sans saut de mise en page) ; l'animation ne part de 0
 *  qu'une fois hydratée et jamais si l'utilisateur réduit les animations. */
export function CountUp({ value, format = "number", duration = 900 }: { value: number; format?: "number" | "fcfa"; duration?: number }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (reduce || value === 0) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    setDisplay(0);
    frame = requestAnimationFrame(tick);
    // Nettoyage : si l'effet est rejoué (mode strict, nouvelle valeur), la valeur
    // finale est posée immédiatement — jamais un compteur figé à 0.
    return () => {
      cancelAnimationFrame(frame);
      setDisplay(value);
    };
  }, [value, duration, reduce]);

  const text = new Intl.NumberFormat("fr-SN", { maximumFractionDigits: 0 }).format(display);
  return (
    <span className="yc-num">
      {text}
      {format === "fcfa" && <span className="ml-1 text-[0.55em] font-semibold tracking-normal opacity-60">FCFA</span>}
    </span>
  );
}
