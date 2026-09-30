import Link from "next/link";
import { withTenant, educationOverview, listClasses, listEnrollments, overdueInstallments } from "@yamacommerce/database";
import { hasPermission, type Permission } from "@yamacommerce/auth";
import type { AcademicScope } from "@yamacommerce/database";
import { formatNumber, scheduleText, type Slot } from "@/lib/education/labels";
import { Panel, PanelHeader } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { ButtonLink } from "@/components/yc/button";
import { EmptyState } from "@/components/yc/empty-state";
import { IconChevronRight, IconPlus } from "@/components/yc/icons";

function Kpi({ href, label, value, foot, tone = "blue" }: { href: string; label: string; value: string; foot: string; tone?: "blue" | "orange" | "green" | "red" }) {
  const color = tone === "orange" ? "text-[#C2410C]" : tone === "green" ? "text-[rgb(4_120_87)]" : tone === "red" ? "text-yc-danger" : "text-yc-ink";
  return (
    <Link href={href} className="yc-focus group rounded-xl bg-white p-4 shadow-[0_1px_2px_rgb(12_22_48/0.04),0_8px_24px_-16px_rgb(12_22_48/0.12)] ring-1 ring-yc-ink/[0.07] transition-shadow hover:shadow-[0_12px_30px_-14px_rgb(12_22_48/0.25)] sm:p-5">
      <span className="flex items-center justify-between text-[13px] text-yc-ink-soft sm:text-[15px]">{label}<IconChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" /></span>
      <span className={`yc-num mt-1 block text-[20px] font-bold tracking-[-0.02em] sm:text-[26px] ${color}`}>{value}</span>
      <span className="mt-0.5 block text-xs text-yc-ink-soft sm:text-sm">{foot}</span>
    </Link>
  );
}

/** Vue d'ensemble de l'établissement ; un enseignant voit seulement ses classes du jour. */
export async function EducationOverview({ tenantId, permissions, scope, greeting }: { tenantId: string; permissions: string[]; scope: AcademicScope; greeting: React.ReactNode }) {
  const can = (p: Permission) => hasPermission(permissions, p);
  const admin = can("reservations.view");
  const data = await withTenant(tenantId, async (tx) => ({
    kpi: admin ? await educationOverview(tx, tenantId) : null,
    classes: can("academics.view") ? await listClasses(tx, tenantId, scope, { activeOnly: true }) : [],
    requests: admin ? await listEnrollments(tx, tenantId, { status: ["requested"], take: 6 }) : [],
    late: admin ? (await overdueInstallments(tx, tenantId)).slice(0, 6) : [],
  }));
  const weekday = new Date().getUTCDay();
  const todayClasses = data.classes.filter((c) => (c.schedule as unknown as Slot[]).some((s) => s.weekday === weekday));
  const kpi = data.kpi;
  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>{greeting}<p className="mt-1 text-yc-ink-soft">{admin ? "Votre établissement aujourd'hui." : "Vos classes aujourd'hui."}</p></div>
        <div className="flex gap-2">
          {can("reservations.update_status") && <ButtonLink href="/dashboard/inscriptions#inscrire" variant="royal"><IconPlus size={18} /> Inscrire un élève</ButtonLink>}
        </div>
      </div>
      {kpi && (
        <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Kpi href="/dashboard/inscriptions" label="Élèves inscrits" value={String(kpi.activeEnrollments)} foot={`${kpi.classes} classe${kpi.classes > 1 ? "s" : ""} · remplissage ${kpi.fillRate} %`} />
          <Kpi href="/dashboard/inscriptions?file=a-confirmer" label="Demandes à confirmer" value={String(kpi.pendingRequests)} foot="Inscriptions en ligne" tone={kpi.pendingRequests ? "orange" : "blue"} />
          <Kpi href="/dashboard/inscriptions?file=retards" label="Échéances en retard" value={`${formatNumber(kpi.overdueAmount)} F`} foot={`${kpi.overdueCount} dossier${kpi.overdueCount > 1 ? "s" : ""} à relancer`} tone={kpi.overdueAmount ? "red" : "blue"} />
          <Kpi href="/dashboard/inscriptions" label="Encaissé ce mois" value={`${formatNumber(kpi.collectedThisMonth)} F`} foot={`${kpi.absentToday} absence${kpi.absentToday > 1 ? "s" : ""} aujourd'hui`} tone="green" />
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel className="overflow-hidden">
          <PanelHeader title={admin ? "Cours du jour" : "Mes cours du jour"} action={<Link href="/dashboard/classes" className="text-sm font-semibold text-yc-electric hover:underline">{admin ? "Classes" : "Mes classes"}</Link>} />
          {todayClasses.length === 0 ? <EmptyState title="Aucun cours aujourd'hui" description="" /> : (
            <ul className="divide-y divide-yc-ink/[0.06]">{todayClasses.map((c) => (
              <li key={c.id}><Link href={`/dashboard/classes/${c.id}#appel`} className="flex items-center gap-3 px-5 py-3 hover:bg-yc-ivory-50">
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{c.name} · {c.program.listing.title}</span><span className="block truncate text-sm text-yc-ink-soft">{scheduleText((c.schedule as unknown as Slot[]).filter((s) => s.weekday === weekday))} · {c.enrolled} élève{c.enrolled > 1 ? "s" : ""}</span></span>
                <span className="text-sm font-semibold text-yc-electric">Faire l&apos;appel</span>
              </Link></li>
            ))}</ul>
          )}
        </Panel>
        {admin && (
          <Panel className="overflow-hidden">
            <PanelHeader title="Demandes d'inscription" action={<Link href="/dashboard/inscriptions?file=a-confirmer" className="text-sm font-semibold text-yc-electric hover:underline">Toutes</Link>} />
            {data.requests.length === 0 ? <EmptyState title="Aucune demande en attente" description="" /> : (
              <ul className="divide-y divide-yc-ink/[0.06]">{data.requests.map((r) => (
                <li key={r.id}><Link href={`/dashboard/inscriptions/${r.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-yc-ivory-50">
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.enrollment?.student.firstName} {r.enrollment?.student.lastName}</span><span className="block truncate text-sm text-yc-ink-soft">{r.listing?.title} · {r.customer.phone}</span></span>
                  <Pill tone="warning">À confirmer</Pill>
                </Link></li>
              ))}</ul>
            )}
          </Panel>
        )}
        {admin && data.late.length > 0 && (
          <Panel className="overflow-hidden lg:col-span-2">
            <PanelHeader title="Relances de paiement" />
            <ul className="divide-y divide-yc-ink/[0.06]">{data.late.map((l) => (
              <li key={l.reservation.id}><Link href={`/dashboard/inscriptions/${l.reservation.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-yc-ivory-50">
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{l.reservation.enrollment?.student.firstName} {l.reservation.enrollment?.student.lastName}</span><span className="block truncate text-sm text-yc-ink-soft">{l.late.map((i) => i.label).join(", ")} · {l.reservation.customer.phone}</span></span>
                <span className="yc-num font-semibold text-yc-danger">{formatNumber(l.amount)} F</span>
              </Link></li>
            ))}</ul>
          </Panel>
        )}
      </div>
    </>
  );
}
