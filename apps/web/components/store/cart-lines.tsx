"use client";

import { IconAlert, IconMinus, IconPlus } from "@/components/yc/icons";
import { fcfa, useStoreCart, type StoreCartLine } from "./cart-provider";

export function QuantityStepper({ line, compact = false }: { line: StoreCartLine; compact?: boolean }) {
  const { update, busyLine } = useStoreCart();
  const busy = busyLine === line.id;
  const size = compact ? "h-8 w-8" : "h-10 w-10";
  return (
    <div className="inline-flex items-center rounded-[var(--radius-full)] ring-1 ring-inset ring-[var(--color-border)]" role="group" aria-label={`Quantité de ${line.productName}`}>
      <button type="button" disabled={busy} onClick={() => update(line.id, line.quantity - 1)} aria-label="Diminuer" className={`grid ${size} place-items-center rounded-full transition hover:bg-[var(--color-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-40`}>
        <IconMinus size={16} />
      </button>
      <span className="min-w-[2ch] text-center text-sm font-semibold tabular-nums" aria-live="polite">{line.quantity}</span>
      <button type="button" disabled={busy || line.quantity >= line.availableQuantity} onClick={() => update(line.id, line.quantity + 1)} aria-label="Augmenter" className={`grid ${size} place-items-center rounded-full transition hover:bg-[var(--color-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-40`}>
        <IconPlus size={16} />
      </button>
    </div>
  );
}

export function CartLineRow({ line, compact = false }: { line: StoreCartLine; compact?: boolean }) {
  const { remove, busyLine } = useStoreCart();
  const short = line.quantity > line.availableQuantity;
  return (
    <li className={`flex gap-4 py-4 transition-opacity ${busyLine === line.id ? "opacity-60" : ""}`}>
      <span className={`${compact ? "h-24 w-20" : "h-32 w-28"} shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-surface-muted)]`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {line.imageUrl && <img src={line.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block font-semibold leading-snug">{line.productName}</span>
            <span className="block text-sm text-[var(--color-text-muted)]">{line.variantName}</span>
          </span>
          <span className="whitespace-nowrap font-semibold tabular-nums">{fcfa(line.lineTotal)}</span>
        </span>
        {short && (
          <span role="alert" className="mt-1 flex items-center gap-1 text-xs font-semibold text-[var(--color-danger)]">
            <IconAlert size={14} /> {line.availableQuantity === 0 ? "Plus en stock" : `Plus que ${line.availableQuantity} disponible(s)`}
          </span>
        )}
        <span className="mt-auto flex items-center justify-between pt-3">
          <QuantityStepper line={line} compact={compact} />
          <button type="button" onClick={() => remove(line.id)} className="rounded-md text-sm text-[var(--color-text-muted)] underline-offset-4 hover:text-[var(--color-text-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]">
            Retirer
          </button>
        </span>
      </span>
    </li>
  );
}

