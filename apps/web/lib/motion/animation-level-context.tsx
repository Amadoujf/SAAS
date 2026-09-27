"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AnimationLevel, MobileAnimation } from "@yamacommerce/design-tokens";
import type { EffectiveAnimationLevel } from "./variants";

const AnimationLevelContext = createContext<EffectiveAnimationLevel>("dynamic");

/**
 * Fournit le niveau d'animation EFFECTIF à toute la page : celui choisi par
 * l'entreprise (`AnimationLevel`), sauf si le visiteur a activé
 * `prefers-reduced-motion`, auquel cas "none" prime toujours — voir docs/12 §12.2/§12.4.
 * Une section peut aussi se voir forcer "none" localement via `animationOverride`
 * (voir @yamacommerce/templates `SectionInstance`), géré au niveau de chaque section.
 */
/**
 * `prefers-reduced-motion`, lu APRÈS l'hydratation : le serveur ne connaît pas la
 * préférence du visiteur, le premier rendu client doit donc être identique au HTML
 * serveur (sinon React signale une erreur d'hydratation et reconstruit la page). Aucun
 * mouvement ne démarre avant les effets : la préférence est appliquée avant toute
 * animation ou lecture automatique.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

/** Petit écran (< 768 px), lu après l'hydratation comme la préférence de mouvement. */
function useSmallScreen(): boolean {
  const [small, setSmall] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setSmall(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return small;
}

export function AnimationLevelProvider({
  level,
  mobile = "same",
  children,
}: {
  level: AnimationLevel;
  /** Réglage « animations sur téléphone » du site (design tokens). */
  mobile?: MobileAnimation;
  children: React.ReactNode;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const small = useSmallScreen();
  const effectiveLevel: EffectiveAnimationLevel = useMemo(() => {
    if (prefersReducedMotion) return "none";
    if (small && mobile === "none") return "none";
    if (small && mobile === "reduced") return "discreet";
    return level;
  }, [prefersReducedMotion, level, small, mobile]);

  return (
    <AnimationLevelContext.Provider value={effectiveLevel}>
      {children}
    </AnimationLevelContext.Provider>
  );
}

export function useAnimationLevel(): EffectiveAnimationLevel {
  return useContext(AnimationLevelContext);
}

/**
 * Permet à UNE section de surcharger localement le niveau d'animation ambiant (voir
 * `SectionInstance.animationOverride`, @yamacommerce/templates) sans toucher au reste
 * de la page. `prefers-reduced-motion` reste toujours prioritaire : si le niveau
 * ambiant est déjà "none" (visiteur en mouvement réduit), la surcharge ne peut pas le
 * réactiver.
 */
export function AnimationScopeOverride({
  override,
  children,
}: {
  override?: EffectiveAnimationLevel;
  children: React.ReactNode;
}) {
  const ambient = useAnimationLevel();
  const value = ambient === "none" ? "none" : (override ?? ambient);
  return <AnimationLevelContext.Provider value={value}>{children}</AnimationLevelContext.Provider>;
}
