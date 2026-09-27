"use client";

import { useEffect, useRef, useState } from "react";

export type Device = "desktop" | "phone";

const LOGICAL = { desktop: { width: 1280, height: 820 }, phone: { width: 390, height: 780 } } as const;

/**
 * Grand aperçu RÉEL du site (iframe du brouillon ou d'une proposition), mis à l'échelle
 * de la place disponible : ordinateur (1 280 px) ou téléphone (390 px). Un clic dans
 * l'aperçu sélectionne une section ; le parent peut en surligner une.
 */
export function StudioPreview({
  src,
  device,
  label,
  tone = "draft",
  highlight,
  onSelect,
  compact = false,
}: {
  src: string;
  device: Device;
  label: string;
  tone?: "draft" | "proposal";
  highlight?: string | null;
  onSelect?: (sectionId: string) => void;
  /** Vignette : true = bandeau, « tall » = format portrait qui montre plusieurs sections. */
  compact?: boolean | "tall";
}) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [width, setWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(900);
  const [loading, setLoading] = useState(true);
  const logical = LOGICAL[device];
  const available = device === "phone" ? Math.min(width, 420) : width;
  const scale = available > 0 ? Math.min(1, available / logical.width) : 0;
  // Grand aperçu : il occupe la hauteur de l'écran (barres du tableau de bord déduites).
  const height = compact === "tall" ? Math.round(logical.width * 1.05) : compact ? Math.round(logical.width * 0.62) : device === "phone" ? logical.height : Math.round(Math.max(520, viewportHeight - 230) / scale);

  useEffect(() => {
    const update = () => setViewportHeight(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => setLoading(true), [src]);

  // Le pont de l'aperçu annonce qu'il écoute (après hydratation) : la section à montrer
  // lui est (re)envoyée à ce moment-là, jamais avant.
  const [ready, setReady] = useState(0);
  useEffect(() => setReady(0), [src]);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      const data = event.data as { type?: string; sectionId?: string };
      if (data?.type === "yc-preview-ready") setReady((n) => n + 1);
      if (data?.type === "yc-preview-select" && data.sectionId) onSelect?.(data.sectionId);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onSelect]);

  useEffect(() => {
    if (highlight === undefined || !ready) return;
    frame.current?.contentWindow?.postMessage({ type: "yc-preview-highlight", sectionId: highlight }, window.location.origin);
  }, [highlight, ready]);

  return (
    <div ref={box} className="w-full min-w-0 overflow-hidden">
      {scale > 0 && (
      <div
        className={`relative mx-auto overflow-hidden bg-white ${device === "phone" ? "rounded-[34px] ring-[10px] ring-yc-night-900 shadow-yc-float" : "rounded-2xl ring-1 ring-yc-ink/10 shadow-yc-float"}`}
        style={{ width: logical.width * scale, height: height * scale }}
      >
        {device === "desktop" && !compact && (
          <div className="flex h-8 items-center gap-1.5 border-b border-yc-ink/[0.06] bg-[#F4F5F8] px-3" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-yc-ink/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-yc-ink/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-yc-ink/15" />
            <span className={`ml-3 truncate rounded-md px-2 py-0.5 text-[11px] font-medium ${tone === "proposal" ? "bg-yc-electric/10 text-yc-electric" : "bg-white text-yc-ink-soft"}`}>{label}</span>
          </div>
        )}
        <iframe
          ref={frame}
          key={src}
          src={src}
          title={label}
          onLoad={() => setLoading(false)}
          className="block origin-top-left border-0 bg-white"
          style={{ width: logical.width, height: (height - (device === "desktop" && !compact ? 32 / scale : 0)), transform: `scale(${scale})` }}
          tabIndex={compact ? -1 : 0}
        />
        {loading && (
          <div className="absolute inset-0 grid place-items-center bg-white/70 backdrop-blur-[2px]" aria-live="polite">
            <span className="flex items-center gap-2 text-sm font-medium text-yc-ink-soft">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-yc-ink/15 border-t-yc-electric" aria-hidden="true" />
              Chargement de l&apos;aperçu…
            </span>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
