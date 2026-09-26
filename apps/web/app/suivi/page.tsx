import type { Metadata } from "next";
import { resolveStore } from "@/lib/storefront/store-context";
import { StoreShell } from "@/components/store/store-shell";
import { GuestLookup } from "@/components/store/guest-lookup";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export const metadata: Metadata = { title: "Suivre ma commande" };

export default async function SuiviPage() {
  const resolution = await resolveStore("/suivi");
  if (resolution.status === "suspended") return <PublicSiteSuspended tenantName={resolution.tenantName} />;
  if (resolution.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={resolution.tenantName} />;
  return (
    <StoreShell store={resolution.store}>
      <div className="mx-auto max-w-md px-4 pt-14 sm:px-6">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-tight">Suivre ma commande</h1>
        <p className="mt-2 text-[var(--color-text-muted)]">Sans compte : il suffit du numéro reçu à la commande et de votre téléphone.</p>
        <GuestLookup />
      </div>
    </StoreShell>
  );
}
