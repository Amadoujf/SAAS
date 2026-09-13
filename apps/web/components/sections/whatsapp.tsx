"use client";

import { motion } from "framer-motion";
import type { WhatsappParams } from "./content-types";
import { useAnimationLevel } from "@/lib/motion/animation-level-context";
import { hoverLift } from "@/lib/motion/variants";
import { t, type Locale } from "@/lib/i18n";

function buildWhatsappUrl(params: WhatsappParams): string {
  const digits = params.phoneNumber.replace(/[^\d]/g, "");
  const text = params.defaultMessage ? `?text=${encodeURIComponent(params.defaultMessage)}` : "";
  return `https://wa.me/${digits}${text}`;
}

/**
 * WhatsApp — floating-button (bouton flottant persistant, coin bas-droit) ou
 * inline-banner (bandeau dans le fil de la page). Le numéro n'est jamais partagé
 * entre entreprises — voir adjustement #7, `WhatsAppConfig` par tenant.
 */
export function WhatsappSection({
  variant,
  params,
  locale,
}: {
  variant: string;
  params: WhatsappParams;
  locale: Locale;
}) {
  const level = useAnimationLevel();
  const hover = hoverLift(level);
  const href = buildWhatsappUrl(params);
  const label = t(locale, "whatsapp.default_label");

  if (variant === "inline-banner") {
    return (
      <section className="border-y border-[var(--color-border)] bg-[#25D366]/10 px-6 py-6 text-center">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[#128C7E] hover:underline"
        >
          💬 {label}
        </a>
      </section>
    );
  }

  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-2xl text-white shadow-lg"
      {...hover}
    >
      💬
    </motion.a>
  );
}
