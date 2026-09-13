"use client";

import { motion } from "framer-motion";
import { useAnimationLevel } from "@/lib/motion/animation-level-context";
import { buttonTap } from "@/lib/motion/variants";

/**
 * Bouton générique respectant `buttonStyle` (forme/taille/variante) via les variables
 * CSS posées par `designTokensToCssVariables` — voir docs/12 §12.8. La micro-animation
 * de clic respecte le niveau d'animation effectif (désactivée si "none").
 */
export function Button({
  children,
  href,
  variant = "solid",
  onClick,
  type = "button",
  ariaLabel,
}: {
  children: React.ReactNode;
  href?: string;
  variant?: "solid" | "outline" | "ghost";
  onClick?: () => void;
  type?: "button" | "submit";
  ariaLabel?: string;
}) {
  const level = useAnimationLevel();
  const tapProps = buttonTap(level);

  const base =
    "inline-flex items-center justify-center gap-2 rounded-[var(--button-radius)] px-6 py-3 text-[var(--text-body-sm)] font-medium transition-colors duration-[var(--motion-duration-fast)]";
  const styleByVariant: Record<string, string> = {
    solid: "bg-[var(--color-primary)] text-white hover:opacity-90",
    outline:
      "border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white",
    ghost: "text-[var(--color-primary)] hover:bg-[var(--color-surface-muted)]",
  };
  const className = `${base} ${styleByVariant[variant]}`;

  if (href) {
    return (
      <motion.a href={href} className={className} aria-label={ariaLabel} {...tapProps}>
        {children}
      </motion.a>
    );
  }

  return (
    <motion.button
      type={type}
      onClick={onClick}
      className={className}
      aria-label={ariaLabel}
      {...tapProps}
    >
      {children}
    </motion.button>
  );
}
