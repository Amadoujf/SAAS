import Link from "next/link";
import type { ReactNode } from "react";
import { ycFontVariables } from "@/lib/yc-fonts";
import { YcLogo } from "@/components/yc/logo";
import type { LegalContext } from "@/lib/legal/legal-context";
import { LegalLinks } from "./legal-links";

/** Gabarit commun des pages légales : lisible, sobre, identique sur téléphone et ordinateur. */
export function LegalPage({ ctx, title, intro, updatedAt, children }: { ctx: LegalContext; title: string; intro: ReactNode; updatedAt: Date | null; children: ReactNode }) {
  const owner = ctx.kind === "tenant" ? ctx.tenant.tenantName : ctx.platform.brand;
  return (
    <div className={`${ycFontVariables} min-h-screen bg-yc-paper font-ui text-yc-navy-ink antialiased`}>
      <header className="border-b border-yc-navy/10">
        <div className="mx-auto flex max-w-[860px] items-center justify-between gap-4 px-4 py-5 sm:px-8">
          <Link href="/" className="min-w-0 truncate font-editorial text-[22px] leading-none text-yc-navy" aria-label={`Retour à l'accueil de ${owner}`}>
            {ctx.kind === "tenant" ? owner : <YcLogo />}
          </Link>
          <Link href="/" className="shrink-0 text-sm text-yc-ink-soft underline-offset-4 hover:text-yc-royal hover:underline">Retour au site</Link>
        </div>
      </header>
      <main className="mx-auto max-w-[860px] px-4 pb-20 pt-10 sm:px-8 sm:pt-14">
        {ctx.kind === "tenant" && ctx.tenant.isDemo && (
          <p className="mb-8 rounded-yc border border-yc-warning/40 bg-yc-warning/10 px-4 py-3 text-sm">
            Entreprise de démonstration : les informations ci-dessous sont fictives.
          </p>
        )}
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-yc-royal">{owner}</p>
        <h1 className="mt-3 font-editorial text-[38px] leading-[1.05] sm:text-[48px]">{title}</h1>
        <div className="mt-5 max-w-2xl text-[16px] leading-relaxed text-yc-navy-ink/80">{intro}</div>
        {updatedAt && <p className="mt-4 text-xs text-yc-ink-soft">Dernière mise à jour : {updatedAt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>}
        <div className="mt-10 flex flex-col gap-10">{children}</div>
      </main>
      <footer className="border-t border-yc-navy/10">
        <div className="mx-auto flex max-w-[860px] flex-col gap-3 px-4 py-8 text-sm text-yc-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>© {new Date().getFullYear()} {owner}</span>
          <LegalLinks />
        </div>
      </footer>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-editorial text-[24px] leading-tight text-yc-navy">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-[15px] leading-relaxed text-yc-navy-ink/85 [&_a]:text-yc-royal [&_a]:underline [&_a]:underline-offset-4 [&_li]:ml-5 [&_li]:list-disc">{children}</div>
    </section>
  );
}

/** Liste de faits ; une valeur absente s'affiche « non renseigné », jamais inventée. */
export function LegalFacts({ items }: { items: [label: string, value: ReactNode | null][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-yc border border-yc-navy/10 bg-white/60 p-4 sm:grid-cols-[minmax(0,220px)_1fr] sm:p-5">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-sm text-yc-ink-soft">{label}</dt>
          <dd className={`text-[15px] ${value ? "" : "italic text-yc-ink-soft"}`}>{value ?? "Non renseigné"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Texte saisi par l'entreprise : paragraphes conservés, aucun HTML interprété. */
export function LegalText({ text }: { text: string }) {
  return <>{text.split(/\n{2,}/).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}</>;
}
