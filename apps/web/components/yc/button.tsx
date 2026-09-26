import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "glow" | "inverse";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-yc-night-900 text-white shadow-[0_1px_0_rgb(255_255_255/0.12)_inset,0_10px_24px_-12px_rgb(10_16_42/0.8)] hover:bg-yc-night-800 active:translate-y-px",
  glow:
    "text-yc-night-950 bg-[linear-gradient(100deg,rgb(var(--yc-cyan))_0%,rgb(125_211_252)_50%,rgb(var(--yc-cyan))_100%)] bg-[length:200%_100%] bg-left hover:bg-right shadow-[0_0_0_1px_rgb(255_255_255/0.25)_inset,0_12px_32px_-10px_rgb(var(--yc-cyan)/0.75)] active:translate-y-px",
  secondary:
    "bg-white text-yc-ink ring-1 ring-inset ring-yc-ink/10 shadow-[0_1px_2px_rgb(10_16_42/0.06)] hover:ring-yc-ink/25 hover:bg-yc-ivory-50",
  ghost: "text-yc-ink-soft hover:text-yc-ink hover:bg-yc-ink/5",
  danger: "bg-white text-yc-danger ring-1 ring-inset ring-yc-danger/30 hover:bg-yc-danger/5",
  inverse: "bg-white/10 text-white ring-1 ring-inset ring-white/20 backdrop-blur hover:bg-white/15",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5 rounded-[10px]",
  md: "h-11 px-5 text-sm gap-2 rounded-xl",
  lg: "h-[52px] px-7 text-[15px] gap-2.5 rounded-2xl",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", extra = "") {
  return [
    "yc-focus inline-flex select-none items-center justify-center whitespace-nowrap font-ui font-semibold tracking-[-0.01em]",
    "transition-all duration-300 ease-yc disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    extra,
  ].join(" ");
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button {...props} disabled={props.disabled || loading} aria-busy={loading || undefined} className={buttonClasses(variant, size, className)}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
  prefetch,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  prefetch?: boolean;
}) {
  return (
    <Link href={href} prefetch={prefetch} className={buttonClasses(variant, size, className)}>
      {children}
    </Link>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
