"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CloseIcon } from "@/components/ui/icons";
import type { Locale } from "@/lib/i18n";

export interface SizeGuideRow {
  size: string;
  chest?: string;
  waist?: string;
  hips?: string;
  note?: string;
}

/**
 * Guide des tailles — fonctionnalité demandée pour « Boutique africaine contemporaine »
 * (Teranga Atelier, 20 septembre 2026). Générique (colonnes optionnelles) : reste
 * réutilisable par n'importe quel template vendant des vêtements, pas seulement celui-ci.
 */
export function SizeGuideModal({
  open,
  onClose,
  rows,
  locale,
}: {
  open: boolean;
  onClose: () => void;
  rows: SizeGuideRow[];
  locale: Locale;
}) {
  const hasChest = rows.some((r) => r.chest);
  const hasWaist = rows.some((r) => r.waist);
  const hasHips = rows.some((r) => r.hips);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, transform: "scale(0.96)" }}
            animate={{ opacity: 1, transform: "scale(1)" }}
            exit={{ opacity: 0, transform: "scale(0.96)" }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-[var(--color-background)] p-6 shadow-[var(--shadow-lg)] lg:p-8"
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-[family-name:var(--font-heading)] text-[length:var(--text-heading-sm)] text-[var(--color-text-primary)]">
                {locale === "en" ? "Size guide" : "Guide des tailles"}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={locale === "en" ? "Close" : "Fermer"}
                className="text-[var(--color-text-primary)]"
              >
                <CloseIcon />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] border-collapse text-left text-[length:var(--text-body-sm)]">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-[length:var(--text-body-xs)] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                    <th className="py-2 pr-4">{locale === "en" ? "Size" : "Taille"}</th>
                    {hasChest && (
                      <th className="py-2 pr-4">
                        {locale === "en" ? "Chest (cm)" : "Poitrine (cm)"}
                      </th>
                    )}
                    {hasWaist && (
                      <th className="py-2 pr-4">
                        {locale === "en" ? "Waist (cm)" : "Taille (cm)"}
                      </th>
                    )}
                    {hasHips && (
                      <th className="py-2 pr-4">
                        {locale === "en" ? "Hips (cm)" : "Hanches (cm)"}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.size}
                      className="border-b border-[var(--color-border)] last:border-0"
                    >
                      <td className="py-3 pr-4 font-medium text-[var(--color-text-primary)]">
                        {row.size}
                      </td>
                      {hasChest && (
                        <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                          {row.chest ?? "—"}
                        </td>
                      )}
                      {hasWaist && (
                        <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                          {row.waist ?? "—"}
                        </td>
                      )}
                      {hasHips && (
                        <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                          {row.hips ?? "—"}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-[length:var(--text-body-xs)] text-[var(--color-text-muted)]">
              {locale === "en"
                ? "Measurements are indicative — each piece is finished by hand and may vary slightly."
                : "Mesures indicatives — chaque pièce est finie à la main et peut varier légèrement."}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
