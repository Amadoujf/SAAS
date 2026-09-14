/**
 * Icônes propres à l'éditeur visuel (voir docs/12 §12.2) — même style trait fin que
 * components/ui/icons.tsx (`currentColor`, sans dépendance), mais séparées dans ce
 * fichier : ce sont des icônes d'outil d'administration, pas des icônes de vitrine
 * publique — aucun template n'a besoin d'en importer une seule.
 */
const common = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  "aria-hidden": true,
} as const;

export function DragHandleIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <circle cx="9" cy="6" r="1.4" fill="currentColor" />
      <circle cx="15" cy="6" r="1.4" fill="currentColor" />
      <circle cx="9" cy="12" r="1.4" fill="currentColor" />
      <circle cx="15" cy="12" r="1.4" fill="currentColor" />
      <circle cx="9" cy="18" r="1.4" fill="currentColor" />
      <circle cx="15" cy="18" r="1.4" fill="currentColor" />
    </svg>
  );
}

export function DuplicateIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <rect x="8" y="8" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4H5.5A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function TrashIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <path
        d="M5 7h14M10 11v6M14 11v6M6.5 7l1-3h9l1 3M8 7v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <path
        d="M3 3l18 18M9.9 5.2A10.4 10.4 0 0 1 12 5c6 0 9.5 6.5 9.5 6.5a15.6 15.6 0 0 1-3.3 4M6.5 6.8C4 8.6 2.5 11.5 2.5 11.5S6 18 12 18c1.1 0 2.1-.2 3-.5M9.9 12.6a2.5 2.5 0 0 0 3.5 3.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function UndoIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <path
        d="M7 8H4V5M4 8c1.8-2.5 4.5-4 7.5-4a8.5 8.5 0 1 1-8.1 11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RedoIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <path
        d="M17 8h3V5M20 8c-1.8-2.5-4.5-4-7.5-4a8.5 8.5 0 1 0 8.1 11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Réinitialisation d'un réglage unique — voir docs/12 §12.2, « réinitialisation d'un
 *  réglage ». Flèche circulaire, distincte de `UndoIcon` (historique global). */
export function ResetIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <path
        d="M4 12a8 8 0 1 1 2.6 5.9M4 12V7M4 12h5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WarningIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <path
        d="M12 3.5 21.5 20h-19L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12 9.5v4.2M12 16.8v.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Rotation portrait/paysage de l'aperçu (voir docs/12 §12.2, « rotation
 *  portrait/paysage »). */
export function RotateDeviceIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <rect
        x="7"
        y="3"
        width="10"
        height="16"
        rx="1.8"
        stroke="currentColor"
        strokeWidth="1.5"
        transform="rotate(90 12 12)"
      />
      <path
        d="M4 9a8 8 0 0 1 13-5.5M20 15a8 8 0 0 1-13 5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M17.5 3v3.5H14M6.5 21v-3.5H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Rechargement complet de l'aperçu (voir docs/12 §12.2, « rechargement de l'aperçu »). */
export function ReloadIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <path
        d="M4 12a8 8 0 0 1 14.2-5M20 12a8 8 0 0 1-14.2 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M18.5 3.5V7H15M5.5 20.5V17H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CloseSmallIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
