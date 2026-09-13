import type { Locale } from "@/lib/i18n";

export interface FooterLinkGroup {
  title: string;
  links: { label: string; href: string }[];
}

/** Pied de page — respecte `footerStyle.variant` (expanded ici : plusieurs colonnes). */
export function Footer({
  shopName,
  groups,
  locale,
}: {
  shopName: string;
  groups: FooterLinkGroup[];
  locale: Locale;
}) {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto grid max-w-[var(--content-max-width)] grid-cols-2 gap-8 px-6 py-14 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <p className="font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[var(--text-heading-sm)]">
            {shopName}
          </p>
          <p className="mt-2 text-[var(--color-text-muted)] text-[var(--text-body-sm)]">
            {locale === "en"
              ? "Made in Senegal, delivered nationwide."
              : "Fabriqué au Sénégal, livré partout au pays."}
          </p>
        </div>
        {groups.map((group) => (
          <div key={group.title}>
            <p className="mb-3 font-semibold text-[var(--color-text-primary)] text-[var(--text-body-sm)]">
              {group.title}
            </p>
            <ul className="flex flex-col gap-2">
              {group.links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-[var(--color-text-muted)] text-[var(--text-body-sm)] transition hover:text-[var(--color-primary)]"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-[var(--color-border)] px-6 py-4 text-center text-[var(--color-text-muted)] text-[var(--text-body-xs)]">
        © {new Date().getFullYear()} {shopName}.{" "}
        {locale === "en" ? "All rights reserved." : "Tous droits réservés."}
      </div>
    </footer>
  );
}
