import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { withTenant } from "@yamacommerce/database";
import { auth } from "@/lib/auth";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { loadTenantEditor } from "@/lib/site-editor/editor-pipeline";
import { TenantSiteEditor } from "@/components/site-editor/tenant-site-editor";

export const metadata: Metadata = { title: "Éditeur du site — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Éditeur visuel plein écran de l'entreprise connectée (permission `site.edit`). */
export default async function TenantEditorPage() {
  const session = await auth();
  if (!session?.user) redirect("/connexion");
  const membership = await getCurrentTenantMembership();
  if (!membership) redirect("/dashboard");
  const editor = await loadTenantEditor();
  if (!editor) redirect("/dashboard");
  const domain = await withTenant(membership.tenantId, (tx) =>
    tx.domain.findFirst({ where: { tenantId: membership.tenantId, lifecycleStatus: "ACTIVE" }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] }),
  );
  return (
    <TenantSiteEditor
      tenantName={editor.tenantName}
      storeUrl={domain ? `https://${domain.domain}` : null}
      sectorKey={editor.sectorKey}
      pages={editor.pages}
      tokens={editor.tokens}
      animationLevel={editor.animationLevel}
      resolvedContent={editor.resolvedContent}
      idOptions={editor.idOptions}
      canPublish={editor.canPublish}
    />
  );
}
