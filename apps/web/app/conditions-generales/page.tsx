import type { Metadata } from "next";
import { resolveLegalContext } from "@/lib/legal/legal-context";
import { LegalPage } from "@/components/legal/legal-page";
import { Terms } from "@/components/legal/documents";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await resolveLegalContext();
  const owner = ctx.kind === "tenant" ? ctx.tenant.tenantName : ctx.platform.brand;
  return { title: `Conditions générales — ${owner}` };
}

export default async function Page() {
  const ctx = await resolveLegalContext();
  return (
    <LegalPage ctx={ctx} title="Conditions générales" intro={ctx.kind === "tenant" ? "Les règles qui s'appliquent à vos commandes et réservations sur ce site." : "Les règles d'utilisation du service par les entreprises."} updatedAt={ctx.kind === "tenant" ? ctx.tenant.profile.updatedAt : null}>
      <Terms ctx={ctx} />
    </LegalPage>
  );
}
