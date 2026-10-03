import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { withTenant, listOrdersForTenant } from "@yamacommerce/database";
import { resolveDashboardTenant } from "@/lib/orders/dashboard-pipeline";
import { formatAmount, formatRelative } from "@/lib/format";
import { PageHeader, Panel, PanelHeader } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { EmptyState } from "@/components/yc/empty-state";
import { IconShield } from "@/components/yc/icons";
import { CodCard, ManualMethodCard, type ManualMethodView } from "@/components/dashboard-settings/payment-settings";

export const metadata: Metadata = { title: "Paiements — Y-COM", robots: { index: false, follow: false } };

export default async function PaymentsPage() {
  const ctx = await resolveDashboardTenant("payments.view");
  if (!ctx) redirect("/dashboard");
  const { configs, proofs } = await withTenant(ctx.tenantId, async (tx) => ({
    configs: await tx.paymentProviderConfig.findMany({ where: { tenantId: ctx.tenantId } }),
    proofs: await listOrdersForTenant(tx, ctx.tenantId, { status: "awaiting_proof", take: 20 }),
  }));
  const byProvider = new Map(configs.map((c) => [c.provider, c]));
  const manual = (provider: ManualMethodView["provider"]): ManualMethodView => {
    const c = byProvider.get(provider);
    return { provider, isEnabled: c?.isEnabled ?? false, accountNumber: c?.accountNumber ?? null, accountHolderName: c?.accountHolderName ?? null, publicInstructions: c?.publicInstructions ?? null };
  };
  const psp = configs.find((c) => ["paydunya", "paytech"].includes(c.provider));
  const pspReady = psp?.isEnabled && psp.credentialsCiphertext;

  return (
    <>
      <PageHeader eyebrow="Ventes" title="Paiements" description="Choisissez comment vos clients vous paient. Une commande n'est marquée payée qu'après vérification — jamais sur simple déclaration." />

      {proofs.orders.length > 0 && (
        <Panel className="mb-5 ring-2 ring-yc-warning/40">
          <PanelHeader eyebrow="À vérifier" title={`${proofs.total} preuve(s) de paiement en attente`} />
          <ul className="divide-y divide-yc-ink/[0.06] px-5 pb-3 sm:px-6">
            {proofs.orders.map((o) => (
              <li key={o.id}>
                <Link href={`/dashboard/commandes/${o.id}`} className="yc-focus flex items-center justify-between gap-3 rounded-xl py-3 hover:bg-yc-ivory-50">
                  <span>
                    <span className="block font-semibold">{o.orderNumber} · {o.customer.firstName} {o.customer.lastName ?? ""}</span>
                    <span className="block text-xs text-yc-ink-soft">Preuve déposée {o.payments[0]?.proofSubmittedAt ? formatRelative(o.payments[0].proofSubmittedAt) : ""}</span>
                  </span>
                  <span className="yc-num font-semibold">{formatAmount(o.total)} F</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel><ManualMethodCard method={manual("wave_direct")} /></Panel>
        <Panel><ManualMethodCard method={manual("orange_money_direct")} /></Panel>
        <Panel><CodCard enabled={byProvider.get("cod")?.isEnabled ?? false} /></Panel>
        <Panel>
          <div className="flex gap-4 p-5 sm:p-6">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-yc-night-900 text-yc-cyan"><IconShield size={22} /></span>
            <div>
              <p className="flex flex-wrap items-center gap-2 font-display text-lg font-semibold">
                Paiement en ligne automatique {pspReady ? <Pill tone="success">Connecté</Pill> : <Pill tone="neutral">Non connecté</Pill>}
              </p>
              <p className="mt-1 text-sm text-yc-ink-soft">
                Avec votre propre compte marchand (PayDunya), le paiement est confirmé automatiquement par un webhook vérifié. Les identifiants sont chiffrés au repos.
                {!pspReady && " La connexion d'un compte marchand se fait avec l'équipe Y-COM."}
              </p>
              <p className="mt-3 text-xs text-yc-ink-soft">Les abonnements Y-COM (Chariow) sont totalement séparés : ils ne transitent jamais par vos paiements clients.</p>
            </div>
          </div>
        </Panel>
      </div>
      {proofs.orders.length === 0 && (
        <Panel className="mt-5"><EmptyState title="Aucune preuve en attente" description="Les transferts Wave et Orange Money déclarés par vos clients apparaîtront ici pour validation." /></Panel>
      )}
    </>
  );
}
