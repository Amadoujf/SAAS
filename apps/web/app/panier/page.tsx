import type { Metadata } from "next";
import { resolveStore } from "@/lib/storefront/store-context";
import { loadProductCards } from "@/lib/storefront/catalog-view";
import { StoreShell } from "@/components/store/store-shell";
import { CartPage } from "@/components/store/cart-page";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export const metadata: Metadata = { title: "Panier", robots: { index: false } };

export default async function PanierPage() {
  const resolution = await resolveStore("/panier");
  if (resolution.status === "suspended") return <PublicSiteSuspended tenantName={resolution.tenantName} />;
  if (resolution.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={resolution.tenantName} />;
  const suggestions = (await loadProductCards(resolution.store.tenantId, { limit: 12 })).filter((p) => !p.soldOut).slice(0, 8);
  return (
    <StoreShell store={resolution.store}>
      <CartPage suggestions={suggestions} />
    </StoreShell>
  );
}
