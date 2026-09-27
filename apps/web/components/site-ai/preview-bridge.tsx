"use client";

import { useEffect } from "react";

/**
 * Pont de l'aperçu (dans l'iframe de « Mon site ») : un clic désigne une section
 * (message au parent, même origine), les liens ne quittent pas l'aperçu, les boutons
 * des sections (flèches, pause…) restent utilisables. Le parent peut surligner une
 * section et demander de s'y rendre.
 */
export function PreviewBridge() {
  useEffect(() => {
    let selected: HTMLElement | null = null;
    const style = document.createElement("style");
    style.textContent = `
      [data-section-id]{position:relative;cursor:pointer}
      @media (hover:hover){[data-section-id]:hover::after{content:"";position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 0 2px rgba(39,73,232,.45);z-index:60}}
      [data-section-id][data-yc-selected]::after{content:"";position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 0 3px #2749E8;z-index:61}
    `;
    document.head.appendChild(style);
    const post = (data: unknown) => window.parent !== window && window.parent.postMessage(data, window.location.origin);
    const select = (el: HTMLElement | null) => {
      selected?.removeAttribute("data-yc-selected");
      selected = el;
      el?.setAttribute("data-yc-selected", "");
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const link = target.closest("a");
      if (link) event.preventDefault();
      const section = target.closest<HTMLElement>("[data-section-id]");
      if (!section) return;
      select(section);
      post({ type: "yc-preview-select", sectionId: section.dataset.sectionId });
    };
    const onSubmit = (event: Event) => event.preventDefault();
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || typeof event.data !== "object" || !event.data) return;
      const data = event.data as { type?: string; sectionId?: string | null };
      if (data.type === "yc-preview-highlight") {
        const el = data.sectionId ? document.querySelector<HTMLElement>(`[data-section-id="${CSS.escape(data.sectionId)}"]`) : null;
        select(el);
        // Sous l'en-tête collant de la boutique, jamais caché derrière lui.
        const header = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
        if (el) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - header - 12), behavior: "smooth" });
      }
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener("message", onMessage);
    post({ type: "yc-preview-ready", sections: [...document.querySelectorAll<HTMLElement>("[data-section-id]")].map((el) => el.dataset.sectionId) });
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("message", onMessage);
      style.remove();
    };
  }, []);
  return null;
}
