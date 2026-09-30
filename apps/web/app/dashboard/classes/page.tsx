import type { Metadata } from "next";
import Link from "next/link";
import { withTenant, listClasses } from "@yamacommerce/database";
import { requireEducationPage } from "@/lib/education/guard";
import { dateLabel, scheduleText, type Slot } from "@/lib/education/labels";
import { PageHeader, Panel } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { EmptyState } from "@/components/yc/empty-state";

export const metadata: Metadata = { title: "Classes — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Classes : toutes pour l'administration, seulement les siennes pour un enseignant. */
export default async function ClassesPage() {
  const membership = await requireEducationPage("academics.view");
  const classes = await withTenant(membership.tenantId, (tx) => listClasses(tx, membership.tenantId, membership.scope));
  return (
    <>
      <PageHeader eyebrow="Pilotage" title={membership.scope.all ? "Classes" : "Mes classes"} description={membership.scope.all ? "Effectifs, enseignants, appel et notes de chaque classe." : "Faites l'appel et saisissez les notes de vos classes."} />
      <Panel className="overflow-hidden">
        {classes.length === 0 ? <EmptyState title={membership.scope.all ? "Aucune classe" : "Aucune classe ne vous est attribuée"} description={membership.scope.all ? "Ajoutez des classes depuis la fiche d'une formation." : "L'administration vous attribue vos classes."} /> : (
          <ul className="divide-y divide-yc-ink/[0.06]">
            {classes.map((c) => (
              <li key={c.id}>
                <Link href={`/dashboard/classes/${c.id}`} className="grid gap-1 px-5 py-4 hover:bg-yc-ivory-50 sm:grid-cols-[1fr_auto] sm:items-center">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{c.name} <span className="font-normal text-yc-ink-soft">· {c.program.listing.title}</span></span>
                    <span className="block truncate text-sm text-yc-ink-soft">{c.teacher?.fullName ?? "Sans enseignant"} · {scheduleText(c.schedule as unknown as Slot[])}</span>
                    <span className="yc-num block text-xs text-yc-ink-soft">Du {dateLabel(c.startDate)} au {dateLabel(c.endDate)}{c.room ? ` · ${c.room}` : ""}</span>
                  </span>
                  <Pill tone={!c.isActive ? "neutral" : c.enrolled >= c.capacity ? "warning" : "success"}>{c.isActive ? `${c.enrolled} / ${c.capacity} élèves` : "Fermée"}</Pill>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
