"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ycFontVariables } from "@/lib/yc-fonts";

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
  fill = false,
}: {
  src: string;
  device: Device;
  label: string;
  tone?: "draft" | "proposal";
  highlight?: string | null;
  onSelect?: (sectionId: string) => void;
  /** Vignette : true = bandeau, « tall » = format portrait qui montre plusieurs sections. */
  compact?: boolean | "tall";
  /** Plein écran : l'aperçu prend toute la hauteur disponible (barre du haut déduite). */
  fill?: boolean;
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
  const height = compact === "tall" ? Math.round(logical.width * 1.05) : compact ? Math.round(logical.width * 0.62) : device === "phone" ? (fill ? Math.max(logical.height, Math.round((viewportHeight - 110) / scale)) : logical.height) : Math.round(Math.max(520, viewportHeight - (fill ? 100 : 230)) / scale);

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
          // Vignette (compact) : le clic va au bouton qui l'entoure (« Voir en grand »),
          // jamais au site miniature affiché dedans.
          className={`block origin-top-left border-0 bg-white ${compact ? "pointer-events-none" : ""}`}
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

/**
 * Aperçu plein écran (ordinateur ou téléphone). Les onglets (directions) et les actions
 * (« Choisir ») sont fournis par le parent ; Échap ferme, ← → changent d'onglet.
 */
export function PreviewOverlay({
  src,
  label,
  initialDevice,
  tabs,
  activeTab,
  onTab,
  actions,
  onClose,
}: {
  src: string;
  label: string;
  initialDevice: Device;
  tabs?: string[];
  activeTab?: number;
  onTab?: (i: number) => void;
  actions?: ReactNode;
  onClose: () => void;
}) {
  const [device, setDevice] = useState<Device>(initialDevice);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (tabs && onTab && activeTab !== undefined) {
        if (e.key === "ArrowRight") onTab((activeTab + 1) % tabs.length);
        if (e.key === "ArrowLeft") onTab((activeTab + tabs.length - 1) % tabs.length);
      }
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [activeTab, tabs, onTab, onClose]);
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Plein écran : ${label}`} className={`${ycFontVariables} fixed inset-0 z-[80] flex flex-col bg-[#101114] font-ui text-white`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2.5 sm:gap-3 sm:px-5">
        {tabs && onTab ? (
          <div className="flex max-w-full overflow-x-auto rounded-full bg-white/[0.08] p-1 [scrollbar-width:none]" role="tablist" aria-label="Directions">
            {tabs.map((t, i) => (
              <button key={t} type="button" role="tab" aria-selected={i === activeTab} onClick={() => onTab(i)} className={`min-h-9 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold ${i === activeTab ? "bg-white text-[#101114]" : "text-white/65 hover:text-white"}`}>
                <span className="mr-1.5 font-mono text-[11px] opacity-60">{String(i + 1).padStart(2, "0")}</span>{t}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[14px] font-semibold">{label}</p>
        )}
        <DeviceToggle device={device} onChange={setDevice} tone="dark" />
        <div className="ml-auto flex items-center gap-2">
          {actions}
          <button type="button" onClick={onClose} aria-label="Fermer le plein écran" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-[18px] leading-none hover:bg-white/20">×</button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3 sm:px-6 sm:py-5">
        <div className={device === "phone" ? "mx-auto w-full max-w-[420px]" : "mx-auto w-full max-w-[1480px]"}>
          <StudioPreview key={`${src}-${device}`} src={src} device={device} label={label} fill />
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Bascule ordinateur / téléphone, en clair (studio) ou en sombre (plein écran). */
export function DeviceToggle({ device, onChange, tone = "light" }: { device: Device; onChange: (d: Device) => void; tone?: "light" | "dark" }) {
  return (
    <div role="group" aria-label="Appareil de l'aperçu" className={`flex rounded-full p-1 ${tone === "dark" ? "bg-white/[0.08]" : "bg-white ring-1 ring-inset ring-yc-ink/10"}`}>
      {(["desktop", "phone"] as const).map((d) => (
        <button
          key={d}
          type="button"
          aria-pressed={device === d}
          onClick={() => onChange(d)}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ${device === d ? (tone === "dark" ? "bg-white text-[#101114]" : "bg-yc-night-950 text-white") : tone === "dark" ? "text-white/65 hover:text-white" : "text-yc-ink-soft hover:text-yc-ink"}`}
        >
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {d === "desktop" ? <><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></> : <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></>}
          </svg>
          <span className={tone === "light" ? "max-[400px]:sr-only" : ""}>{d === "desktop" ? "Ordinateur" : "Téléphone"}</span>
        </button>
      ))}
    </div>
  );
}
