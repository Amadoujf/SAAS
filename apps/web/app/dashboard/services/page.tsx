import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { requireAnyTenantPermission } from "@/lib/tenant-permissions";
import { STATE_LABELS, platformIntegrations, tenantIntegrations, type Integration } from "@/lib/integrations/status";
import { PageHeader, Panel, PanelHeader } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";

export const metadata: Metadata = { title: "État des services — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const GROUPS: { key: Integration["group"]; title: string; description: string }[] = [
  { key: "paiements", title: "Paiements", description: "Ce que vos clients peuvent réellement utiliser pour payer." },
  { key: "notifications", title: "Notifications", description: "Une notification « en file » n'est pas « envoyée » : elle ne l'est qu'après confirmation du fournisseur." },
  { key: "ia", title: "Assistant IA", description: "Une simulation n'est jamais présentée comme une génération IA." },
];

/** État réel des intégrations de la plateforme et de l'entreprise — sans valeur secrète. */
export default async function ServicesPage() {
  const membership = await getCurrentTenantMembership();
  if (!membership) redirect("/dashboard");
  if (!(await requireAnyTenantPermission(membership.tenantId, ["payments.view", "settings.branding"]))) redirect("/dashboard");
  const all = [...(await tenantIntegrations(membership.tenantId)), ...platformIntegrations()];
  return (
    <>
      <PageHeader eyebrow="Gestion" title="État des services" description="Ce qui fonctionne réellement aujourd'hui, ce qui ne l'est pas encore, et ce qu'il faut pour l'activer." />
      <div className="grid gap-5">
        {GROUPS.map((g) => (
          <Panel key={g.key} className="overflow-hidden">
            <PanelHeader title={g.title} description={g.description} />
            <ul className="divide-y divide-yc-ink/[0.06]">
              {all.filter((i) => i.group === g.key).map((i) => (
                <li key={i.key} className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-start">
                  <div className="min-w-0">
                    <p className="font-semibold">{i.label}</p>
                    <p className="mt-0.5 text-sm text-yc-ink-soft">{i.detail}</p>
                    {i.howTo && <p className="mt-1.5 text-[13px]"><span className="font-semibold">Pour l&apos;activer : </span>{i.howTo}</p>}
                  </div>
                  <Pill tone={STATE_LABELS[i.state].tone}>{STATE_LABELS[i.state].label}</Pill>
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
    </>
  );
}
