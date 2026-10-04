/** Monogramme Y-COM : un « Y » à empattements, plein et délié comme une
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
    <span className={`inline-flex items-end gap-2 ${tone === "light" ? "text-yc-paper" : "text-yc-navy"} ${className}`}>
      {/* Le monogramme EST le « Y » du nom : « Y » + « -COM » se lit Y-COM. */}
      <YcMark size={34} />
      <span aria-hidden="true" className="-ml-2 font-editorial text-[1.55rem] leading-none tracking-[-0.01em]">-COM</span>
      <span className="sr-only">Y-COM</span>
    </span>
  );
}

/** Variante « application » (dashboard) : monogramme en dégradé bleu lumineux et
 *  nom en linéale — l'univers précis et dense de l'espace marchand. `id` unique par
 *  instance : un dégradé défini dans un élément masqué (display:none) ne s'affiche pas. */
export function YcAppLogo({ className = "", compact = false, id = "yc-app-mark" }: { className?: string; compact?: boolean; id?: string }) {
  return (
    <span className={`inline-flex items-end gap-2 ${className}`}>
      <svg width={compact ? 30 : 36} height={compact ? 30 : 36} viewBox="0 0 40 40" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0.8" y2="1">
            <stop offset="0" stopColor="#7DB4FF" />
            <stop offset="1" stopColor="#1F5BF0" />
          </linearGradient>
        </defs>
        <path fill={`url(#${id})`} d="M2 4h11.5l6.6 11.2L26.6 4H38L25.4 22.6V36h-10.8V22.6z" />
        <path fill="#fff" fillOpacity=".22" d="M2 4h11.5l6.6 11.2-3.9 5.9z" />
      </svg>
      <span aria-hidden="true" className={`-ml-2 font-ui font-bold tracking-[-0.02em] ${compact ? "text-[17px]" : "text-[21px]"}`}>-COM</span>
      <span className="sr-only">Y-COM</span>
    </span>
  );
}
