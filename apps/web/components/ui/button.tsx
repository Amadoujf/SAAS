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
  size = "token",
  onClick,
  type = "button",
  ariaLabel,
  disabled = false,
  className: extraClassName,
}: {
  children: React.ReactNode;
  href?: string;
  variant?: "solid" | "outline" | "ghost";
  /** "token" respecte `buttonStyle.size` du template ; "xl" est réservé aux CTA hero. */
  size?: "token" | "xl";
  onClick?: () => void;
  type?: "button" | "submit";
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const level = useAnimationLevel();
  const tapProps = disabled ? {} : buttonTap(level);

  const base =
    "inline-flex items-center justify-center gap-2 rounded-[var(--button-radius)] font-medium tracking-wide transition-colors duration-[var(--motion-duration-fast)]";
  const sizing =
    size === "xl"
      ? "px-9 py-5 text-base sm:text-lg"
      : "px-[var(--button-padding-x)] py-[var(--button-padding-y)] text-[length:var(--button-font-size)]";
  const styleByVariant: Record<string, string> = {
    solid: "bg-[var(--color-primary)] text-white hover:opacity-90",
    outline:
      "border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white",
    ghost: "text-[var(--color-primary)] hover:bg-[var(--color-surface-muted)]",
  };
  const disabledClasses = disabled ? "cursor-not-allowed opacity-60 hover:opacity-60" : "";
  const className = `${base} ${sizing} ${styleByVariant[variant]} ${disabledClasses} ${extraClassName ?? ""}`;

  if (href && !disabled) {
    return (
      <motion.a href={href} className={className} aria-label={ariaLabel} {...tapProps}>
        {children}
      </motion.a>
    );
  }

  return (
    <motion.button
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className={className}
      aria-label={ariaLabel}
      {...tapProps}
    >
      {children}
    </motion.button>
  );
}
