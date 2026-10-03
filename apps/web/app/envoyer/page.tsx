import type { Metadata } from "next";
import { resolveCourier } from "@/lib/courier/courier-context";
import { loadZones } from "@/lib/courier/courier-data";
import { CourierShell } from "@/components/courier/courier-shell";
import { SendForm } from "@/components/courier/send-form";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export async function generateMetadata(): Promise<Metadata> {
  const r = await resolveCourier("/envoyer");
  return r.status === "ok" ? { title: `Envoyer un colis — ${r.company.tenantName}` } : {};
}
export const dynamic = "force-dynamic";

export default async function SendPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const r = await resolveCourier("/envoyer");
  if (r.status === "suspended") return <PublicSiteSuspended tenantName={r.tenantName} />;
  if (r.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={r.tenantName} />;
  const { company } = r;
  const zones = await loadZones(company.tenantId);
  return (
    <CourierShell company={company}>
      <div className="mx-auto max-w-3xl px-4 pt-10 sm:px-8">
        <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent-secondary)]">Nouvelle course</p>
        <h1 className="mt-2 font-[family-name:var(--font-heading)] text-[42px] leading-[1] tracking-[-0.03em] sm:text-[58px]">Envoyer un colis</h1>
        <p className="mt-3 text-[16px] text-[var(--color-text-secondary)]">Le tarif est calculé selon la zone et le format, avant l&apos;envoi. Vous recevez un lien de suivi ; le destinataire, le sien avec son code de remise.</p>
        <div className="mt-8">
          {company.rules.publicRequests && zones.length ? (
            <SendForm zones={zones.map((z) => ({ id: z.id, label: z.label }))} maxCod={company.rules.maxCod} initialZone={typeof searchParams.zone === "string" ? searchParams.zone : null} initialSize={typeof searchParams.format === "string" ? searchParams.format : null} />
          ) : (
            <p className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-6 text-[16px] ring-1 ring-[var(--color-border)]">Les demandes en ligne sont momentanément fermées{company.contact.phone ? ` : appelez le ${company.contact.phone}` : ""}.</p>
          )}
        </div>
      </div>
    </CourierShell>
  );
}
