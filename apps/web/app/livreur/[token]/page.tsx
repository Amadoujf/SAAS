import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveCourier } from "@/lib/courier/courier-context";
import { getDriverSpace } from "@/lib/courier/public-pipeline";
import { formatXof } from "@/lib/courier/labels";
import { designTokensToStyle } from "@/lib/design-tokens-to-css";
import { templateFontVariables } from "@/lib/storefront/template-fonts";
import { DriverBoard } from "@/components/courier/driver-board";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export const metadata: Metadata = { title: "Mes courses", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Espace livreur par lien personnel : ses courses seulement, les espèces qu'il détient. */
export default async function DriverPage({ params }: { params: { token: string } }) {
  const r = await resolveCourier(`/livreur/${params.token}`);
  if (r.status === "suspended") return <PublicSiteSuspended tenantName={r.tenantName} />;
  if (r.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={r.tenantName} />;
  const { company } = r;
  const space = await getDriverSpace(company.tenantId, params.token);
  if (!space) notFound();
  return (
    <div style={designTokensToStyle(company.tokens)} className={`${templateFontVariables} min-h-screen bg-[var(--color-background)] font-[family-name:var(--font-body)] text-[var(--color-text-primary)]`}>
      <header className="bg-[var(--color-primary)] px-4 pb-6 pt-5 text-white">
        <div className="mx-auto max-w-xl">
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--color-accent-primary)]">{company.tenantName}{company.demoData ? " · démonstration" : ""}</p>
          <h1 className="mt-1 font-[family-name:var(--font-heading)] text-[32px] leading-tight">Bonjour {space.deliverer.name.split(" ")[0]}</h1>
          <p className="yc-num mt-3 rounded-[var(--radius-md)] bg-white/10 px-4 py-3 text-[15px]">Espèces en main : <strong className="text-[var(--color-accent-primary)]">{formatXof(space.cash.amount)}</strong>{space.cash.jobs ? ` · ${space.cash.jobs} course${space.cash.jobs > 1 ? "s" : ""} à verser au bureau` : ""}</p>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-5">
        <DriverBoard token={params.token} jobs={space.jobs} />
        <p className="mt-8 text-center text-[12.5px] text-[var(--color-text-muted)]">Lien personnel : ne le partagez pas. En cas de perte du téléphone, le bureau le renouvelle.</p>
      </main>
    </div>
  );
}
