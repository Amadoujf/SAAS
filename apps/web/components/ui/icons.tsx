/**
 * Icônes trait fin (SVG inline, pas de dépendance) — remplacent les emojis (🛍️, ☰)
 * dont l'aspect « brouillon technique » a été signalé lors de la revue visuelle du 16
 * septembre 2026. `currentColor` partout : elles héritent la couleur du texte
 * environnant, y compris en surimpression blanche sur le hero.
 */
const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true } as const;

export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function BagIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <path
        d="M6.5 8.5h11l.9 11.2a1.5 1.5 0 0 1-1.5 1.6H7.1a1.5 1.5 0 0 1-1.5-1.6l.9-11.2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function MenuIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function TruckIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <path
        d="M3 7h10v9H3zM13 10h4l3 3v3h-7z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="18" r="1.6" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="17" cy="18" r="1.6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function CraftIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <path
        d="M4 15.5 14.5 5a2.1 2.1 0 0 1 3 3L7 18.5 3.5 20l1.5-3.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12.5 7 17 11.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <path
        d="M12 3.5 19 6.5v5c0 5-3 8-7 9-4-1-7-4-7-9v-5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="m9 12 2 2 4-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HeartIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg {...common} className={className} fill={filled ? "currentColor" : "none"}>
      <path
        d="M12 20.5s-7.5-4.6-9.8-9A5.2 5.2 0 0 1 12 6.2a5.2 5.2 0 0 1 9.8 5.3c-2.3 4.4-9.8 9-9.8 9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EyeIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <path
        d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5-9.5-6.5-9.5-6.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <path d="M4 12.5l5 5L20 6.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function UserIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.5 20c1.4-3.6 4.3-5.4 7.5-5.4s6.1 1.8 7.5 5.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.4 3.8 5.4 3.8 8.5s-1.3 6.1-3.8 8.5c-2.5-2.4-3.8-5.4-3.8-8.5S9.5 5.9 12 3.5Z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WhatsappIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className} fill="currentColor">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.38 1.26 4.8L2 22l5.42-1.35a9.9 9.9 0 0 0 4.62 1.15h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.06c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.12.11-1.8-.11-.42-.13-.96-.31-1.65-.6-2.9-1.25-4.79-4.16-4.94-4.36-.14-.2-1.18-1.57-1.18-3 0-1.43.75-2.13 1.02-2.42.27-.29.58-.36.78-.36h.55c.18 0 .41-.03.64.49.24.55.8 1.9.87 2.04.07.14.12.3.02.49-.1.19-.15.31-.29.48-.15.17-.31.38-.44.51-.15.15-.3.31-.13.6.17.29.75 1.24 1.62 2.01 1.11 1 2.05 1.31 2.34 1.46.29.15.46.13.63-.05.17-.19.72-.84.92-1.13.19-.29.39-.24.65-.14.27.1 1.7.8 1.99.95.29.14.48.22.55.34.07.13.07.72-.17 1.42Z" />
    </svg>
  );
}

export function ReturnIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <path
        d="M4 12a8 8 0 1 1 2.6 5.9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M4 12V7M4 12h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
