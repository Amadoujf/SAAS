import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { requireTenantPermission } from "@/lib/tenant-permissions";
import { PreviewFrameApp } from "@/components/editor/preview-frame-app";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Document de l'aperçu (dans l'iframe de l'éditeur) : réservé aux membres autorisés à
 *  modifier le site ; il n'affiche que ce que l'éditeur parent lui transmet. */
export default async function TenantEditorPreviewPage() {
  const session = await auth();
  if (!session?.user) redirect("/connexion");
  const membership = await getCurrentTenantMembership();
  if (!membership || !(await requireTenantPermission(membership.tenantId, "site.edit"))) redirect("/dashboard");
  return <PreviewFrameApp />;
}
