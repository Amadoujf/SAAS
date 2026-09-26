/** Monogramme YamaCommerce : un « Y » à empattements, plein et délié comme une
 *  capitale didone — l'identité éditoriale de la marque. `currentColor` : il prend
 *  la couleur du texte qui l'entoure (marine sur ivoire, ivoire sur marine). */
export function YcMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="currentColor" aria-hidden="true">
      <path d="M3 5.2h13.4v1.9h-3.1l8.3 12.4 6.9-12.4h-3.2V5.2H37v1.9h-2.6L23.4 24.9V33h3.6v1.9H13.4V33h3.6v-8.2L7.2 7.1H3z" />
    </svg>
  );
}

export function YcLogo({ tone = "dark", className = "" }: { tone?: "dark" | "light"; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${tone === "light" ? "text-yc-paper" : "text-yc-navy"} ${className}`}>
      <YcMark size={34} />
      <span className="font-editorial text-[1.55rem] leading-none tracking-[-0.01em]">YamaCommerce</span>
    </span>
  );
}
