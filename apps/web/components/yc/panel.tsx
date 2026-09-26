import type { ReactNode } from "react";

export function Panel({ children, className = "", as: Tag = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" }) {
  return <Tag className={`rounded-xl bg-white shadow-[0_1px_2px_rgb(12_22_48/0.04),0_8px_24px_-16px_rgb(12_22_48/0.12)] ring-1 ring-yc-ink/[0.07] ${className}`}>{children}</Tag>;
}

export function PanelHeader({ title, description, action, eyebrow }: { title: ReactNode; description?: ReactNode; action?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 px-5 pb-3 pt-5 sm:px-6">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-yc-electric">{eyebrow}</p>}
        <h2 className="font-ui text-[18px] font-bold tracking-[-0.015em] text-yc-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-yc-ink-soft">{description}</p>}
      </div>
      {action}
    </header>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="yc-rise mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-yc-electric">{eyebrow}</p>}
        <h1 className="font-ui text-[28px] font-bold leading-[1.1] tracking-[-0.025em] text-yc-ink sm:text-[34px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] text-yc-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
