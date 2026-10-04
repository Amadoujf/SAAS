import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { withTenant, getProgram, listClasses } from "@yamacommerce/database";
import { hasPermission } from "@yamacommerce/auth";
import { requireEducationPage } from "@/lib/education/guard";
import { dateLabel, scheduleText, type Slot } from "@/lib/education/labels";
import { PageHeader, Panel, PanelHeader } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { ProgramEditor, type ProgramForm } from "@/components/dashboard-education/program-editor";
import { ClassForm } from "@/components/dashboard-education/class-form";

export const metadata: Metadata = { title: "Formation — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Fiche d'une formation côté équipe : édition, classes (effectifs, enseignants), nouvelle classe. */
export default async function ProgramPage({ params }: { params: { id: string } }) {
  const membership = await requireEducationPage("listings.view");
  if (!/^[0-9a-f-]{36}$/.test(params.id)) notFound();
  const tenantId = membership.tenantId;
  const data = await withTenant(tenantId, async (tx) => {
    const p = await getProgram(tx, tenantId, params.id);
    if (!p?.program) return null;
    return {
      p,
      classes: await listClasses(tx, tenantId, { userId: null, all: true }, { listingId: p.id }),
      teachers: await tx.tenantUser.findMany({ where: { tenantId, status: "ACTIVE" }, include: { user: { select: { id: true, fullName: true } }, role: { select: { name: true } } } }),
    };
  });
  if (!data) notFound();
  const { p } = data;
  const pr = p.program!;
  const can = (x: Parameters<typeof hasPermission>[1]) => hasPermission(membership.permissions, x);
  const form: ProgramForm = {
    title: p.title, summary: p.summary ?? "", description: p.description ?? "", tuition: p.price == null ? "" : String(p.price), registrationFee: String(pr.registrationFee), defaultInstallments: String(pr.defaultInstallments),
    category: pr.category, level: pr.level ?? "", format: pr.format, durationLabel: pr.durationLabel ?? "", audience: pr.audience, featured: p.featured,
    media: (Array.isArray(p.media) ? (p.media as { url: string; alt?: string; demo?: boolean }[]) : []).map((m) => ({ url: m.url, alt: m.alt ?? "", ...(m.demo ? { demo: true } : {}) })), published: p.status === "published",
  };
  const teachers = data.teachers.map((t) => ({ id: t.user.id, name: `${t.user.fullName}${t.role.name === "TEACHER" ? "" : ` (${t.role.name === "OWNER" ? "propriétaire" : "équipe"})`}` }));
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <PageHeader eyebrow={<Link href="/dashboard/formations">← Formations</Link>} title={p.title} description={p.status === "published" ? "En ligne : les familles peuvent envoyer une demande d'inscription." : "Brouillon : invisible sur le site."} />
      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        {can("listings.edit") ? <ProgramEditor listingId={p.id} initial={form} canPublish={can("listings.publish")} /> : <Panel className="p-5"><p className="text-sm">Lecture seule.</p></Panel>}
        <div className="grid content-start gap-5">
          <Panel className="overflow-hidden">
            <PanelHeader title="Classes" />
            {data.classes.length === 0 ? <p className="px-5 pb-5 text-sm text-yc-ink-soft">Aucune classe : ajoutez-en une pour ouvrir les inscriptions.</p> : (
              <ul className="divide-y divide-yc-ink/[0.06]">
                {data.classes.map((c) => (
                  <li key={c.id}>
                    <Link href={`/dashboard/classes/${c.id}`} className="grid gap-1 px-5 py-3 hover:bg-yc-ivory-50">
                      <span className="flex items-center justify-between gap-2"><span className="font-semibold">{c.name}</span><Pill tone={!c.isActive ? "neutral" : c.enrolled >= c.capacity ? "warning" : "success"}>{c.isActive ? `${c.enrolled}/${c.capacity}` : "Fermée"}</Pill></span>
                      <span className="text-sm text-yc-ink-soft">{c.teacher?.fullName ?? "Sans enseignant"} · {scheduleText(c.schedule as unknown as Slot[])}</span>
                      <span className="yc-num text-xs text-yc-ink-soft">Du {dateLabel(c.startDate)} au {dateLabel(c.endDate)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {can("academics.manage") && <ClassForm listingId={p.id} classGroupId={null} title="Nouvelle classe" teachers={teachers} initial={{ name: "", teacherUserId: "", room: "", startDate: today, endDate: today, capacity: "25", schedule: [], isActive: true }} />}
        </div>
      </div>
    </>
  );
}
