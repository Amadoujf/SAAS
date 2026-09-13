export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <h3 className="font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[var(--text-heading-sm)]">
        {title}
      </h3>
      {description && (
        <p className="text-[var(--color-text-muted)] text-[var(--text-body-md)]">{description}</p>
      )}
      {actionLabel && actionHref && (
        <a
          href={actionHref}
          className="mt-2 rounded-[var(--button-radius)] bg-[var(--color-primary)] px-5 py-2.5 font-medium text-[var(--text-body-sm)] text-white transition hover:opacity-90"
        >
          {actionLabel}
        </a>
      )}
    </div>
  );
}
