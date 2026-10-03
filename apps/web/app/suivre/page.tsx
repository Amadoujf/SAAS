import type { Metadata } from "next";
import { resolveCourier } from "@/lib/courier/courier-context";
import { CourierShell } from "@/components/courier/courier-shell";
import { LookupForm } from "@/components/courier/lookup-form";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export const metadata: Metadata = { title: "Suivre un colis" };
export const dynamic = "force-dynamic";

export default async function LookupPage() {
  const r = await resolveCourier("/suivre");
  if (r.status === "suspended") return <PublicSiteSuspended tenantName={r.tenantName} />;
  if (r.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={r.tenantName} />;
  return (
    <CourierShell company={r.company}>
      <div className="mx-auto max-w-md px-4 pt-12 sm:px-8">
        <h1 className="font-[family-name:var(--font-heading)] text-[42px] leading-[1] tracking-[-0.03em]">Suivre un colis</h1>
        <p className="mt-3 text-[16px] text-[var(--color-text-secondary)]">Saisissez la référence et votre numéro (expéditeur ou destinataire).</p>
        <div className="mt-8"><LookupForm /></div>
      </div>
    </CourierShell>
  );
}
