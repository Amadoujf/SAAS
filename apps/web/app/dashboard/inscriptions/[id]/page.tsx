import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { withTenant, allocateInstallments, getEnrollment, listClasses } from "@yamacommerce/database";
import { hasPermission } from "@yamacommerce/auth";
import { requireEducationPage } from "@/lib/education/guard";
import { ENROLLMENT_LABELS, INSTALLMENT_LABELS, PAYMENT_METHOD_LABELS, dateLabel, dateTimeIn, formatNumber, RELATION_LABELS } from "@/lib/education/labels";
import { PageHeader, Panel, PanelHeader } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { AssignClass, EnrollmentClose, EnrollmentPayment, PersonalLinks, PlanEditor, VoidPayment } from "@/components/dashboard-education/enrollment-panels";

export const metadata: Metadata = { title: "Inscription — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Un dossier d'inscription : élève, responsable, classe, échéancier, encaissements, liens personnels. */
export default async function EnrollmentPage({ params }: { params: { id: string } }) {
  const membership = await requireEducationPage("reservations.view");
  if (!/^[0-9a-f-]{36}$/.test(params.id)) notFound();
  const tenantId = membership.tenantId;
  const data = await withTenant(tenantId, async (tx) => {
    const r = await getEnrollment(tx, tenantId, params.id);
    if (!r?.enrollment) return null;
    const tz = (await tx.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } }))?.timezone || "Africa/Dakar";
    return {
      r,
      tz,
      today: new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date()),
      classes: await listClasses(tx, tenantId, { userId: null, all: true }, { listingId: r.listingId!, activeOnly: true }),
      family: await tx.familyAccess.findFirst({ where: { tenantId, customerId: r.customerId } }),
      domain: await tx.domain.findFirst({ where: { tenantId, lifecycleStatus: "ACTIVE" }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] }),
    };
  });
  if (!data) notFound();
  const { r } = data;
  const e = r.enrollment!;
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(membership.permissions, p);
  const live = r.status === "requested" || r.status === "confirmed";
  const installments = allocateInstallments(e.installments, r.payments, data.today);
  const paid = r.payments.filter((p) => !p.voidedAt).reduce((s, p) => s + p.amount, 0);
  const total = r.totalAmount ?? 0;
  const remaining = Math.max(0, total - paid);
  const next = installments.find((i) => i.state !== "paid");
  const st = ENROLLMENT_LABELS[r.status] ?? { label: r.status, tone: "neutral" as const };
  const host = (await headers()).get("host") ?? "";
  const origin = data.domain ? `https://${data.domain.domain}` : `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
  return (
    <>
      <PageHeader eyebrow={<Link href="/dashboard/inscriptions">← Inscriptions</Link>} title={`${e.student.firstName} ${e.student.lastName}`} description={`${r.listing?.title ?? ""} · dossier ${r.reference}`} actions={<Pill tone={st.tone}>{st.label}</Pill>} />
      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <div className="grid content-start gap-5">
          <Panel className="p-5">
            <dl className="yc-num grid grid-cols-3 gap-3 text-center">
              <div><dt className="text-xs uppercase tracking-[0.08em] text-yc-ink-soft">Montant dû</dt><dd className="text-[22px] font-bold">{formatNumber(total)} F</dd></div>
              <div><dt className="text-xs uppercase tracking-[0.08em] text-yc-ink-soft">Encaissé</dt><dd className="text-[22px] font-bold text-[rgb(4_120_87)]">{formatNumber(paid)} F</dd></div>
              <div><dt className="text-xs uppercase tracking-[0.08em] text-yc-ink-soft">Reste</dt><dd className="text-[22px] font-bold">{formatNumber(remaining)} F</dd></div>
            </dl>
            <p className="mt-3 text-center text-xs text-yc-ink-soft">Inscription {formatNumber(e.registrationFee)} + scolarité {formatNumber(e.tuition)}{e.discountAmount ? ` − remise ${formatNumber(e.discountAmount)} (${e.discountReason})` : ""}</p>
          </Panel>

          <Panel className="overflow-hidden">
            <PanelHeader title="Échéancier" />
            <table className="yc-num w-full text-left text-sm">
              <thead><tr className="text-xs uppercase tracking-[0.08em] text-yc-ink-soft"><th className="px-5 py-2 font-semibold">Échéance</th><th className="px-2 py-2 font-semibold">Date</th><th className="px-2 py-2 text-right font-semibold">Montant</th><th className="px-5 py-2 text-right font-semibold">État</th></tr></thead>
              <tbody className="divide-y divide-yc-ink/[0.06]">
                {installments.map((i) => (
                  <tr key={i.id}>
                    <td className="px-5 py-2.5 font-medium">{i.label}</td>
                    <td className="px-2 py-2.5">{dateLabel(i.dueDate, { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td className="px-2 py-2.5 text-right">{formatNumber(i.amount)}{i.covered > 0 && i.covered < i.amount ? <span className="block text-xs text-yc-ink-soft">{formatNumber(i.covered)} réglés</span> : null}</td>
                    <td className="px-5 py-2.5 text-right"><Pill tone={INSTALLMENT_LABELS[i.state]!.tone}>{INSTALLMENT_LABELS[i.state]!.label}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {live && can("reservations.update_status") && (
              <details className="border-t border-yc-ink/[0.06] px-5 py-4">
                <summary className="cursor-pointer text-sm font-semibold">Remise et échéancier</summary>
                <div className="mt-4"><PlanEditor reservationId={r.id} gross={e.registrationFee + e.tuition} discount={e.discountAmount} reason={e.discountReason} paid={paid} installments={e.installments.map((i) => ({ label: i.label, dueDate: i.dueDate.toISOString().slice(0, 10), amount: i.amount }))} /></div>
              </details>
            )}
          </Panel>

          <Panel className="overflow-hidden">
            <PanelHeader title="Encaissements" />
            {r.payments.length === 0 ? <p className="px-5 pb-4 text-sm text-yc-ink-soft">Aucun encaissement.</p> : (
              <ul className="divide-y divide-yc-ink/[0.06]">
                {r.payments.map((p) => (
                  <li key={p.id} className={`flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm ${p.voidedAt ? "opacity-60" : ""}`}>
                    <span><span className="yc-num font-semibold">{p.receiptNumber}</span> · {PAYMENT_METHOD_LABELS[p.method] ?? p.method}{p.reference ? ` · ${p.reference}` : ""}<span className="block text-xs text-yc-ink-soft">{dateTimeIn(p.paidAt, data.tz)}{p.voidedAt ? ` · annulé : ${p.voidReason}` : ""}</span></span>
                    <span className="flex items-center gap-3"><span className={`yc-num font-semibold ${p.voidedAt ? "line-through" : ""}`}>{formatNumber(p.amount)} F</span>{!p.voidedAt && can("payments.refund") && <VoidPayment paymentId={p.id} />}</span>
                  </li>
                ))}
              </ul>
            )}
            {r.status !== "canceled" && remaining > 0 && can("reservation_payments.record") && <div className="border-t border-yc-ink/[0.06] px-5 py-4"><EnrollmentPayment reservationId={r.id} remaining={remaining} nextDue={next ? next.amount - next.covered : null} /></div>}
          </Panel>
        </div>

        <div className="grid content-start gap-5">
          <Panel className="p-5">
            <h2 className="text-[15px] font-bold">Classe</h2>
            {e.classGroup ? <p className="mt-1 text-sm"><Link href={`/dashboard/classes/${e.classGroup.id}`} className="font-semibold text-yc-electric hover:underline">{e.classGroup.name}</Link> · du {dateLabel(e.classGroup.startDate)} au {dateLabel(e.classGroup.endDate)}</p> : <p className="mt-1 text-sm text-yc-ink-soft">Pas encore affecté.</p>}
            {live && can("reservations.update_status") && data.classes.length > 0 && <div className="mt-3"><AssignClass reservationId={r.id} current={e.classGroupId} pending={r.status === "requested"} classes={data.classes.map((c) => ({ id: c.id, name: c.name, remaining: Math.max(0, c.capacity - c.enrolled) }))} /></div>}
          </Panel>
          <Panel className="p-5">
            <h2 className="text-[15px] font-bold">Élève et responsable</h2>
            <dl className="mt-2 grid gap-1.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-yc-ink-soft">Élève</dt><dd className="font-medium">{e.student.firstName} {e.student.lastName}{e.student.birthDate ? ` · né(e) le ${dateLabel(e.student.birthDate)}` : ""}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-yc-ink-soft">Responsable</dt><dd className="font-medium">{r.customer.firstName} {r.customer.lastName ?? ""} ({RELATION_LABELS[e.student.guardianRelation] ?? e.student.guardianRelation})</dd></div>
              {r.customer.phone && <div className="flex justify-between gap-3"><dt className="text-yc-ink-soft">Téléphone</dt><dd><a href={`tel:${r.customer.phone}`} className="yc-num font-medium text-yc-electric">{r.customer.phone}</a></dd></div>}
              {r.customer.email && <div className="flex justify-between gap-3"><dt className="text-yc-ink-soft">E-mail</dt><dd className="truncate">{r.customer.email}</dd></div>}
            </dl>
            {r.customerNote && <p className="mt-3 rounded-lg bg-yc-ivory-50 px-3 py-2 text-sm ring-1 ring-yc-ink/[0.06]">« {r.customerNote} »</p>}
          </Panel>
          {can("customers.view") && (
            <Panel className="p-5">
              <h2 className="mb-3 text-[15px] font-bold">Liens personnels</h2>
              <PersonalLinks origin={origin} familyToken={data.family?.accessToken ?? null} customerId={r.customerId} studentToken={e.student.accessToken} studentId={e.student.id} />
            </Panel>
          )}
          {live && (can("reservations.update_status") || can("reservations.cancel")) && (
            <Panel className="p-5">
              <h2 className="mb-3 text-[15px] font-bold">Clôture</h2>
              <EnrollmentClose reservationId={r.id} status={r.status} canCancel={can("reservations.cancel")} />
            </Panel>
          )}
          <Panel className="p-5">
            <h2 className="text-[15px] font-bold">Historique</h2>
            <ol className="mt-2 grid gap-1.5 text-sm">
              {r.history.map((h) => <li key={h.id} className="flex justify-between gap-3"><span>{ENROLLMENT_LABELS[h.toStatus]?.label ?? h.toStatus}{h.note ? <span className="text-yc-ink-soft"> — {h.note}</span> : null}</span><span className="yc-num shrink-0 text-xs text-yc-ink-soft">{dateTimeIn(h.createdAt, data.tz)}</span></li>)}
            </ol>
          </Panel>
        </div>
      </div>
    </>
  );
}
