"use client";

import { useEffect, useState, type RefObject } from "react";
import { useAnimationLevel } from "./animation-level-context";

/**
 * Outils partagés des sections immersives. Règles tenues ici, pour toutes :
 * - rien ne tourne hors écran ni dans un onglet inactif ;
 * - `prefers-reduced-motion` (et une section réglée « aucune animation ») = scène fixe ;
 * - appareils modestes (peu de cœurs, peu de mémoire, économie de données) = effets allégés.
 */

/** Section visible à l'écran (IntersectionObserver) — `true` sans observateur disponible. */
export function useInView(ref: RefObject<Element>, rootMargin = "0px") {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setInView(Boolean(entry?.isIntersecting)), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);
  return inView;
}

/** Onglet au premier plan (Page Visibility). */
export function usePageVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== "hidden");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

/** Appareil modeste ou économie de données : on allège (pas de lumière suivant le
 *  pointeur, pas de flottement continu). Évalué côté client uniquement. */
export function useLowPower() {
  const [low, setLow] = useState(false);
  useEffect(() => {
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    setLow((nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4 || nav.connection?.saveData === true);
  }, []);
  return low;
}

/** Pointeur fin (souris/trackpad) : seuls ces appareils ont une lumière qui suit le curseur. */
export function useFinePointer() {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setFine(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return fine;
}

export type Intensity = "subtle" | "balanced" | "bold";

/** Amplitude des mouvements (0 = scène fixe) : niveau d'animation du site × intensité
 *  choisie pour la section. */
export function useMotionAmplitude(intensity: Intensity = "balanced") {
  const level = useAnimationLevel();
  if (level === "none") return 0;
  const byLevel = level === "discreet" ? 0.55 : level === "immersive" ? 1.25 : 1;
  const byIntensity = intensity === "subtle" ? 0.55 : intensity === "bold" ? 1.5 : 1;
  return byLevel * byIntensity;
}
