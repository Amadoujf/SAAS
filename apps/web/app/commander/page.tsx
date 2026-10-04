import type { Metadata } from "next";
import { SENEGAL_REGIONS } from "@yamacommerce/database";
import { resolveStore } from "@/lib/storefront/store-context";
import { StoreShell } from "@/components/store/store-shell";
import { CheckoutFlow } from "@/components/store/checkout-flow";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export const metadata: Metadata = { title: "Commander", robots: { index: false } };

export default async function CommanderPage() {
  const resolution = await resolveStore("/commander");
  if (resolution.status === "suspended") return <PublicSiteSuspended tenantName={resolution.tenantName} />;
  if (resolution.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={resolution.tenantName} />;
  return (
    <StoreShell store={resolution.store}>
      <CheckoutFlow regions={[...SENEGAL_REGIONS]} />
    </StoreShell>
  );
}
