import type { Metadata } from "next";
import { resolveLegalContext } from "@/lib/legal/legal-context";
import { LegalPage } from "@/components/legal/legal-page";
import { LegalNotice } from "@/components/legal/documents";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await resolveLegalContext();
  const owner = ctx.kind === "tenant" ? ctx.tenant.tenantName : ctx.platform.brand;
  return { title: `Mentions légales — ${owner}` };
}

export default async function Page() {
  const ctx = await resolveLegalContext();
  return (
    <LegalPage ctx={ctx} title="Mentions légales" intro={"Qui édite ce site, qui l'héberge et comment nous joindre."} updatedAt={ctx.kind === "tenant" ? ctx.tenant.profile.updatedAt : null}>
      <LegalNotice ctx={ctx} />
    </LegalPage>
  );
}
