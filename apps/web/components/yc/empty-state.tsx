import type { ReactNode } from "react";

const ART: Record<string, ReactNode> = {
  orders: (
    <>
      <rect x="34" y="22" width="92" height="76" rx="14" fill="rgb(var(--yc-ivory-100))" stroke="rgb(var(--yc-ink) / 0.12)" />
      <rect x="48" y="40" width="44" height="7" rx="3.5" fill="rgb(var(--yc-ink) / 0.14)" />
      <rect x="48" y="55" width="64" height="6" rx="3" fill="rgb(var(--yc-ink) / 0.08)" />
      <rect x="48" y="68" width="52" height="6" rx="3" fill="rgb(var(--yc-ink) / 0.08)" />
      <circle cx="118" cy="92" r="18" fill="rgb(var(--yc-cyan))" className="yc-pop" />
      <path d="M110 92l6 6 10-11" stroke="white" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  cart: (
    <>
      <path d="M40 38h12l12 46h52l10-34H60" stroke="rgb(var(--yc-ink) / 0.35)" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="70" cy="98" r="6" fill="rgb(var(--yc-ink) / 0.35)" />
      <circle cx="110" cy="98" r="6" fill="rgb(var(--yc-ink) / 0.35)" />
      <circle cx="120" cy="36" r="14" fill="rgb(var(--yc-violet) / 0.85)" className="yc-float" />
      <path d="M114 36h12M120 30v12" stroke="white" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  generic: (
    <>
      <circle cx="80" cy="62" r="38" fill="rgb(var(--yc-ivory-100))" stroke="rgb(var(--yc-ink) / 0.1)" />
      <path d="M62 64l12 12 24-26" stroke="rgb(var(--yc-electric))" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" className="yc-draw" style={{ ["--yc-dash" as string]: 70 }} />
    </>
  ),
};

/** État vide qui GUIDE : illustration légère, une phrase qui dit pourquoi c'est vide,
 *  et l'action qui fait avancer. */
export function EmptyState({
  art = "generic",
  title,
  description,
  action,
  tone = "light",
}: {
  art?: keyof typeof ART;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  tone?: "light" | "store";
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <svg width="160" height="124" viewBox="0 0 160 124" aria-hidden="true" className="mb-5">
        {ART[art]}
      </svg>
      <h3 className={tone === "store" ? "text-xl font-semibold" : "font-display text-xl font-semibold tracking-tight text-yc-ink"}>{title}</h3>
      {description && <p className={`mt-2 max-w-sm text-sm ${tone === "store" ? "opacity-70" : "text-yc-ink-soft"}`}>{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
