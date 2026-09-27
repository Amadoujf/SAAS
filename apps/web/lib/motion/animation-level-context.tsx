"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AnimationLevel } from "@yamacommerce/design-tokens";
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

export function AnimationLevelProvider({
  level,
  children,
}: {
  level: AnimationLevel;
  children: React.ReactNode;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const effectiveLevel: EffectiveAnimationLevel = useMemo(
    () => (prefersReducedMotion ? "none" : level),
    [prefersReducedMotion, level],
  );

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
