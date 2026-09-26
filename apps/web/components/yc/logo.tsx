/** Monogramme YamaCommerce : un « Y » formé de deux trajectoires qui convergent —
 *  la boutique et son client — sur un disque lumineux. */
export function YcMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="yc-mark-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgb(34 211 238)" />
          <stop offset="0.55" stopColor="rgb(59 91 255)" />
          <stop offset="1" stopColor="rgb(139 92 246)" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="url(#yc-mark-g)" />
      <path d="M11 11l9 10.5L29 11" stroke="white" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M20 21.5V30" stroke="white" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="29" cy="29" r="2.6" fill="white" opacity="0.9" />
    </svg>
  );
}

export function YcLogo({ tone = "dark", className = "" }: { tone?: "dark" | "light"; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <YcMark size={30} />
      <span className={`font-display text-[1.15rem] font-semibold tracking-tight ${tone === "light" ? "text-white" : "text-yc-ink"}`}>
        Yama<span className="text-yc-electric">Commerce</span>
      </span>
    </span>
  );
}
