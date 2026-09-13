"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Icône d'une fonctionnalité pas encore implémentée (compte client, etc.) — voir la
 * revue du 16 septembre 2026, point 2 : « ne conserve aucun faux bouton silencieux ».
 * N'importe où, jamais un lien qui navigue vers une page inexistante : au clic, une
 * étiquette « Bientôt disponible » apparaît brièvement, et l'icône reste visuellement
 * atténuée pour signaler que ce n'est pas encore actif.
 */
export function ComingSoonIconButton({
  icon,
  label,
  comingSoonLabel,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  comingSoonLabel: string;
  className?: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-disabled="true"
        aria-label={`${label} — ${comingSoonLabel}`}
        onClick={() => {
          setShow(true);
          window.setTimeout(() => setShow(false), 1800);
        }}
        className={`opacity-45 transition-opacity hover:opacity-70 ${className ?? ""}`}
      >
        {icon}
      </button>
      <AnimatePresence>
        {show && (
          <motion.span
            role="status"
            initial={{ opacity: 0, transform: "translateY(4px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-full z-30 mt-2 whitespace-nowrap rounded-[2px] bg-[var(--color-primary)] px-3 py-1.5 text-[11px] text-white shadow-lg"
          >
            {comingSoonLabel}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
