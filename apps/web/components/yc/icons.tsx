import type { SVGProps } from "react";

/** Iconographie Y-COM — tracés 1.75 px, coins arrondis, grille 24. Inline :
 *  aucune dépendance ni requête réseau, héritent de `currentColor`. */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

export const IconHome = (p: IconProps) => (<svg {...base(p)}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M10 20v-5h4v5" /></svg>);
export const IconBag = (p: IconProps) => (<svg {...base(p)}><path d="M5 8h14l-1.2 12.1a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>);
export const IconReceipt = (p: IconProps) => (<svg {...base(p)}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" /><path d="M9 8h6M9 12h6M9 16h3" /></svg>);
export const IconUsers = (p: IconProps) => (<svg {...base(p)}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 20a6.5 6.5 0 0 0-3-5.5" /></svg>);
export const IconBox = (p: IconProps) => (<svg {...base(p)}><path d="m3 7.5 9-4.5 9 4.5v9L12 21l-9-4.5Z" /><path d="m3 7.5 9 4.5 9-4.5M12 12v9" /></svg>);
export const IconTag = (p: IconProps) => (<svg {...base(p)}><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9Z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>);
export const IconStack = (p: IconProps) => (<svg {...base(p)}><path d="m12 3 9 5-9 5-9-5Z" /><path d="m3 13 9 5 9-5" /></svg>);
export const IconTruck = (p: IconProps) => (<svg {...base(p)}><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></svg>);
export const IconCard = (p: IconProps) => (<svg {...base(p)}><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 10h18M7 15h4" /></svg>);
export const IconWallet = (p: IconProps) => (<svg {...base(p)}><path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2h11" /><path d="M16 13.5h.01" /></svg>);
export const IconGlobe = (p: IconProps) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18" /></svg>);
export const IconBrush = (p: IconProps) => (<svg {...base(p)}><path d="M14 4 20 10l-8.5 8.5a3 3 0 0 1-4.2 0l-1.8-1.8a3 3 0 0 1 0-4.2Z" /><path d="M4 20c1-3 2.5-4 4-4" /></svg>);
export const IconSettings = (p: IconProps) => (<svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>);
export const IconSearch = (p: IconProps) => (<svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>);
export const IconPlus = (p: IconProps) => (<svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>);
export const IconMinus = (p: IconProps) => (<svg {...base(p)}><path d="M5 12h14" /></svg>);
export const IconX = (p: IconProps) => (<svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>);
export const IconCheck = (p: IconProps) => (<svg {...base(p)}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>);
export const IconArrowRight = (p: IconProps) => (<svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const IconArrowLeft = (p: IconProps) => (<svg {...base(p)}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>);
export const IconChevronDown = (p: IconProps) => (<svg {...base(p)}><path d="m6 9 6 6 6-6" /></svg>);
export const IconChevronRight = (p: IconProps) => (<svg {...base(p)}><path d="m9 6 6 6-6 6" /></svg>);
export const IconMenu = (p: IconProps) => (<svg {...base(p)}><path d="M4 7h16M4 12h16M4 17h10" /></svg>);
export const IconDownload = (p: IconProps) => (<svg {...base(p)}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>);
export const IconPrinter = (p: IconProps) => (<svg {...base(p)}><path d="M7 9V3h10v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" /></svg>);
export const IconAlert = (p: IconProps) => (<svg {...base(p)}><path d="M12 3 2 20h20Z" /><path d="M12 10v4M12 17h.01" /></svg>);
export const IconClock = (p: IconProps) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
export const IconSpark = (p: IconProps) => (<svg {...base(p)}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></svg>);
export const IconPhone = (p: IconProps) => (<svg {...base(p)}><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></svg>);
export const IconMapPin = (p: IconProps) => (<svg {...base(p)}><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></svg>);
export const IconStore = (p: IconProps) => (<svg {...base(p)}><path d="M4 9.5 5.5 4h13L20 9.5a3 3 0 0 1-5.3 1.9A3 3 0 0 1 12 12.5a3 3 0 0 1-2.7-1.1A3 3 0 0 1 4 9.5Z" /><path d="M5 12v8h14v-8" /></svg>);
export const IconShield = (p: IconProps) => (<svg {...base(p)}><path d="M12 3 4.5 6v6c0 4.5 3.2 7.7 7.5 9 4.3-1.3 7.5-4.5 7.5-9V6Z" /><path d="m9 12 2 2 4-4" /></svg>);
export const IconLogout = (p: IconProps) => (<svg {...base(p)}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 16l-4-4 4-4M6 12h10" /></svg>);
export const IconUpload = (p: IconProps) => (<svg {...base(p)}><path d="M12 20V9M7 14l5-5 5 5M5 4h14" /></svg>);
export const IconBell = (p: IconProps) => (<svg {...base(p)}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>);
export const IconChart = (p: IconProps) => (<svg {...base(p)}><path d="M4 20V4M4 20h16" /><path d="m7 15 4-4 3 3 5-6" /></svg>);
export const IconSparkles = (p: IconProps) => (<svg {...base(p)}><path d="M12 3l1.8 4.9L19 9.7l-5.2 1.8L12 16.5l-1.8-5L5 9.7l5.2-1.8Z" /><path d="M19 15l.7 1.8L21.5 17.5l-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7Z" /></svg>);
