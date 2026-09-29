import type { Metadata } from "next";
import { hasPermission } from "@yamacommerce/auth";
import { requireAutoPage } from "@/lib/auto/guard";
import { PageHeader } from "@/components/yc/panel";
import { EMPTY_VEHICLE, VehicleEditor } from "@/components/dashboard-auto/vehicle-editor";

export const metadata: Metadata = { title: "Nouveau véhicule — Y-COM", robots: { index: false, follow: false } };

export default async function NewVehiclePage() {
  const membership = await requireAutoPage("listings.create");
  return (
    <>
      <PageHeader eyebrow="Stock" title="Ajouter un véhicule" description="La fiche technique alimente les filtres du site ; le titre se compose tout seul (marque, modèle, version, année)." />
      <VehicleEditor listingId={null} initial={EMPTY_VEHICLE} canPublish={hasPermission(membership.permissions, "listings.publish")} />
    </>
  );
}
