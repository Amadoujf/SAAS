"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Arrivée progressive des éléments au défilement (décalage de 70 ms entre enfants).
 * Rien n'est caché sans JavaScript, ni ce qui est déjà visible au chargement, ni si
 * l'utilisateur demande moins d'animations.
 */
export function Reveal({ children, className = "", as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "ul" | "section" }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const items = Array.from(root.children) as HTMLElement[];
    const hidden = items.filter((el) => el.getBoundingClientRect().top > window.innerHeight);
    if (!hidden.length) return;
    hidden.forEach((el) => el.setAttribute("data-reveal", "pending"));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          const delay = (hidden.indexOf(el) % 6) * 70;
          el.style.transitionDelay = `${delay}ms`;
          el.setAttribute("data-reveal", "shown");
          io.unobserve(el);
        });
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    hidden.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return <Tag ref={ref as never} className={className}>{children}</Tag>;
}
