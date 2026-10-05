import type { Metadata } from "next";
import { resolveLegalContext } from "@/lib/legal/legal-context";
import { LegalPage } from "@/components/legal/legal-page";
import { Privacy } from "@/components/legal/documents";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await resolveLegalContext();
  const owner = ctx.kind === "tenant" ? ctx.tenant.tenantName : ctx.platform.brand;
  return { title: `Politique de confidentialité — ${owner}` };
}

export default async function Page() {
  const ctx = await resolveLegalContext();
  return (
    <LegalPage ctx={ctx} title="Politique de confidentialité" intro={"Quelles données sont collectées, pourquoi, et comment exercer vos droits."} updatedAt={ctx.kind === "tenant" ? ctx.tenant.profile.updatedAt : null}>
      <Privacy ctx={ctx} />
    </LegalPage>
  );
}
