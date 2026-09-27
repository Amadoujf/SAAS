import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { requireTenantPermission } from "@/lib/tenant-permissions";
import { PageHeader, Panel } from "@/components/yc/panel";
import { MediaLibrary } from "@/components/media/media-library";

export const metadata: Metadata = { title: "Médiathèque — Y-COM", robots: { index: false, follow: false } };

/** Médiathèque réelle de l'entreprise : import, variantes optimisées, quotas de la formule. */
export default async function MediaPage() {
  const membership = await getCurrentTenantMembership();
  if (!membership) redirect("/dashboard");
  if (!(await requireTenantPermission(membership.tenantId, "products.view"))) redirect("/dashboard");
  return (
    <>
      <PageHeader eyebrow="Gestion" title="Médiathèque" description="Vos photos et vidéos. Les images sont automatiquement optimisées pour le web et le mobile." />
      <Panel className="p-4 sm:p-5"><MediaLibrary apiBase="/api/media" /></Panel>
    </>
  );
}
