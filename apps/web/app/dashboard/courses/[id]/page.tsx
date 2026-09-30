import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { withTenant, expectedCollection, getCourierJob, listCouriers } from "@yamacommerce/database";
import { hasPermission } from "@yamacommerce/auth";
import { requireCourierPage } from "@/lib/courier/guard";
import { JOB_LABELS, SIZE_LABELS, dateTimeIn, formatNumber, zoneLabel } from "@/lib/courier/labels";
import { PageHeader, Panel } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { JobActions } from "@/components/dashboard-courier/job-panels";

export const metadata: Metadata = { title: "Course — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Une course : trajet, colis, sommes, preuve, historique ; actions selon le statut. */
export default async function JobPage({ params }: { params: { id: string } }) {
  const membership = await requireCourierPage("delivery.view");
  if (!/^[0-9a-f-]{36}$/.test(params.id)) notFound();
  const tenantId = membership.tenantId;
  const data = await withTenant(tenantId, async (tx) => {
    const j = await getCourierJob(tx, tenantId, params.id);
    if (!j) return null;
    return {
      j,
      tz: (await tx.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } }))?.timezone || "Africa/Dakar",
      couriers: (await listCouriers(tx, tenantId)).filter((c) => c.isActive),
      domain: await tx.domain.findFirst({ where: { tenantId, lifecycleStatus: "ACTIVE" }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] }),
    };
  });
  if (!data) notFound();
  const { j, tz } = data;
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(membership.permissions, p);
  const st = JOB_LABELS[j.status] ?? { label: j.status, tone: "neutral" as const };
  const host = (await headers()).get("host") ?? "";
  const origin = data.domain ? `https://${data.domain.domain}` : `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
  const collect = expectedCollection(j);
  const row = (k: string, v: React.ReactNode) => <div className="flex justify-between gap-3"><dt className="text-yc-ink-soft">{k}</dt><dd className="text-right font-medium">{v}</dd></div>;
  return (
    <>
      <PageHeader eyebrow={<Link href="/dashboard/courses">← Courses</Link>} title={<span className="yc-num">{j.reference}</span>} description={`${j.sender.firstName} → ${j.recipientName}`} actions={<Pill tone={st.tone}>{st.label}</Pill>} />
      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <div className="grid content-start gap-5">
          <Panel className="p-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-yc-ink-soft">Retrait</p><p className="mt-1 font-semibold">{j.pickupName}</p><p className="text-sm">{j.pickupAddress}{j.pickupCommune ? `, ${j.pickupCommune}` : ""}</p><a href={`tel:${j.pickupPhone}`} className="yc-num text-sm font-semibold text-yc-electric">{j.pickupPhone}</a></div>
              <div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-yc-ink-soft">Remise</p><p className="mt-1 font-semibold">{j.recipientName}</p><p className="text-sm">{j.dropoffAddress}{j.zone ? ` · ${zoneLabel(j.zone)}` : ""}</p><a href={`tel:${j.recipientPhone}`} className="yc-num text-sm font-semibold text-yc-electric">{j.recipientPhone}</a></div>
            </div>
            {j.instructions && <p className="mt-4 rounded-lg bg-yc-ivory-50 px-3 py-2 text-sm ring-1 ring-yc-ink/[0.06]">Consignes : {j.instructions}</p>}
            <dl className="yc-num mt-4 grid gap-1.5 border-t border-yc-ink/[0.06] pt-4 text-sm">
              {row("Colis", `${j.packageDescription} · ${SIZE_LABELS[j.size]?.label}`)}
              {row("Tarif", `${formatNumber(j.fee)} F · ${j.feePaidBy === "recipient" ? "payé par le destinataire" : "à la charge de l'expéditeur"}`)}
              {row("À encaisser pour l'expéditeur", `${formatNumber(j.codAmount)} F`)}
              {row("Le livreur encaisse", <strong>{formatNumber(collect)} F</strong>)}
              {j.collectedAmount != null && row("Encaissé", `${formatNumber(j.collectedAmount)} F`)}
              {j.deliveredAt && row("Remis", `${dateTimeIn(j.deliveredAt, tz)} · ${j.proofType === "code" ? "code vérifié" : `au nom de ${j.proofName}`}`)}
              {j.failureReason && row("Dernier échec", j.failureReason)}
              {j.cancelReason && row("Annulation", j.cancelReason)}
              {row("Versé au bureau", j.remittance ? `${j.remittance.receiptNumber}` : j.collectedAmount ? "Pas encore" : "—")}
              {row("Reversé à l'expéditeur", j.settlement ? `${j.settlement.receiptNumber}` : "Pas encore")}
            </dl>
          </Panel>
          {(can("delivery.assign") || can("delivery.update_status")) && !["delivered", "returned", "canceled"].includes(j.status) && (
            <Panel className="p-5">
              <h2 className="mb-3 text-[15px] font-bold">Actions</h2>
              <JobActions jobId={j.id} status={j.status} toCollect={collect} couriers={data.couriers.map((c) => ({ id: c.id, name: c.name ?? c.phone }))} currentCourier={j.delivererId} canAssign={can("delivery.assign")} canUpdate={can("delivery.update_status")} />
            </Panel>
          )}
        </div>
        <div className="grid content-start gap-5">
          <Panel className="p-5">
            <h2 className="text-[15px] font-bold">Livreur</h2>
            <p className="mt-1 text-sm">{j.deliverer ? `${j.deliverer.name ?? ""} · ${j.deliverer.phone}${j.deliverer.vehicleType ? ` · ${j.deliverer.vehicleType}` : ""}` : "Pas encore affecté."}</p>
          </Panel>
          <Panel className="p-5">
            <h2 className="text-[15px] font-bold">Liens de suivi</h2>
            <p className="mt-2 text-xs font-semibold">Expéditeur</p>
            <p className="truncate rounded-lg bg-yc-ivory-50 px-3 py-1.5 font-mono text-xs ring-1 ring-yc-ink/[0.06]">{origin}/colis/{j.senderToken}</p>
            <p className="mt-2 text-xs font-semibold">Destinataire (porte le code de remise)</p>
            <p className="truncate rounded-lg bg-yc-ivory-50 px-3 py-1.5 font-mono text-xs ring-1 ring-yc-ink/[0.06]">{origin}/colis/{j.recipientToken}</p>
          </Panel>
          <Panel className="p-5">
            <h2 className="text-[15px] font-bold">Historique</h2>
            <ol className="mt-2 grid gap-1.5 text-sm">
              {j.events.map((e) => <li key={e.id} className="flex justify-between gap-3"><span>{JOB_LABELS[e.toStatus]?.label ?? e.toStatus}{e.note ? <span className="text-yc-ink-soft"> — {e.note}</span> : null}<span className="block text-xs text-yc-ink-soft">{e.actorType === "deliverer" ? "par le livreur" : e.actorType === "customer" ? "en ligne" : "par le bureau"}</span></span><span className="yc-num shrink-0 text-xs text-yc-ink-soft">{dateTimeIn(e.createdAt, tz)}</span></li>)}
            </ol>
          </Panel>
        </div>
      </div>
    </>
  );
}
