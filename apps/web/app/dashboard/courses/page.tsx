import type { Metadata } from "next";
import Link from "next/link";
import { withTenant, expectedCollection, getCourierSettings, listCourierJobs, listCouriers, listDeliveryZones } from "@yamacommerce/database";
import { hasPermission } from "@yamacommerce/auth";
import { requireCourierPage } from "@/lib/courier/guard";
import { JOB_LABELS, formatNumber, timeIn, zoneLabel } from "@/lib/courier/labels";
import { PageHeader, Panel } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { EmptyState } from "@/components/yc/empty-state";
import { NewJob } from "@/components/dashboard-courier/job-panels";

export const metadata: Metadata = { title: "Courses — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const FILES = [
  { key: "", label: "En cours", status: ["pending", "assigned", "picked_up", "in_transit", "failed", "returning"] },
  { key: "a-affecter", label: "À affecter", status: ["pending"] },
  { key: "echecs", label: "Échecs", status: ["failed"] },
  { key: "retours", label: "Retours", status: ["returning", "returned"] },
  { key: "terminees", label: "Terminées", status: ["delivered", "returned", "canceled"] },
];

/** Courses : file du jour, affectation, suivi des échecs et retours ; saisie au bureau. */
export default async function JobsPage({ searchParams }: { searchParams: { file?: string; q?: string } }) {
  const membership = await requireCourierPage("delivery.view");
  const tenantId = membership.tenantId;
  const file = FILES.find((f) => f.key === (searchParams.file ?? "")) ?? FILES[0]!;
  const data = await withTenant(tenantId, async (tx) => ({
    tz: (await tx.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } }))?.timezone || "Africa/Dakar",
    jobs: await listCourierJobs(tx, tenantId, { status: file.status, search: searchParams.q }),
    zones: await listDeliveryZones(tx, tenantId, { activeOnly: true }),
    couriers: (await listCouriers(tx, tenantId)).filter((c) => c.isActive),
    senders: await tx.customer.findMany({ where: { tenantId, courierJobs: { some: {} } }, select: { id: true, firstName: true, lastName: true, phone: true }, orderBy: { firstName: "asc" }, take: 300 }),
    settings: await getCourierSettings(tx, tenantId),
  }));
  return (
    <>
      <PageHeader eyebrow="Pilotage" title="Courses" description="Tarif calculé par le serveur ; remise contre le code du destinataire ; chaque somme encaissée suit son chemin jusqu'à l'expéditeur." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILES.map((f) => <Link key={f.key} href={f.key ? `/dashboard/courses?file=${f.key}` : "/dashboard/courses"} aria-current={file.key === f.key ? "page" : undefined} className="rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold ring-1 ring-yc-ink/10 aria-[current=page]:bg-yc-night-900 aria-[current=page]:text-white">{f.label}</Link>)}
        <form className="ml-auto w-full sm:w-auto"><input name="q" defaultValue={searchParams.q ?? ""} placeholder="Référence, destinataire, téléphone" aria-label="Rechercher" className="h-10 w-full rounded-lg bg-white px-3 text-sm ring-1 ring-inset ring-yc-ink/12 sm:w-64" />{file.key && <input type="hidden" name="file" value={file.key} />}</form>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_440px]">
        <Panel className="overflow-hidden">
          {data.jobs.length === 0 ? <EmptyState title="Aucune course ici" description="" /> : (
            <ul className="divide-y divide-yc-ink/[0.06]">
              {data.jobs.map((j) => {
                const st = JOB_LABELS[j.status] ?? { label: j.status, tone: "neutral" as const };
                const collect = expectedCollection(j);
                return (
                  <li key={j.id}>
                    <Link href={`/dashboard/courses/${j.id}`} className="grid gap-2 px-5 py-3.5 hover:bg-yc-ivory-50 sm:grid-cols-[1fr_170px_auto] sm:items-center">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{j.recipientName} <span className="font-normal text-yc-ink-soft">· {j.zone ? zoneLabel(j.zone) : j.dropoffCommune ?? ""}</span></span>
                        <span className="block truncate text-sm text-yc-ink-soft"><span className="yc-num">{j.reference}</span> · {j.sender.firstName} · {timeIn(j.createdAt, data.tz)}{j.attempts ? ` · ${j.attempts} tentative${j.attempts > 1 ? "s" : ""}` : ""}</span>
                      </span>
                      <span className="text-sm"><span className="block truncate">{j.deliverer?.name ?? <span className="text-yc-ink-soft">Sans livreur</span>}</span>{collect > 0 && <span className="yc-num text-xs text-yc-ink-soft">À encaisser {formatNumber(collect)} F</span>}</span>
                      <span className="justify-self-start sm:justify-self-end"><Pill tone={st.tone}>{st.label}</Pill></span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        {hasPermission(membership.permissions, "delivery.assign") && (
          <NewJob
            zones={data.zones.map((z) => ({ id: z.id, label: zoneLabel(z), fee: z.fee }))}
            couriers={data.couriers.map((c) => ({ id: c.id, name: c.name ?? c.phone }))}
            senders={data.senders.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName ?? ""}`.trim(), phone: s.phone }))}
            surcharges={{ medium: data.settings.mediumSurcharge, large: data.settings.largeSurcharge }}
          />
        )}
      </div>
    </>
  );
}
