import type { Metadata } from "next";
import Link from "next/link";
import { withTenant, listPrograms } from "@yamacommerce/database";
import { hasPermission } from "@yamacommerce/auth";
import { requireEducationPage } from "@/lib/education/guard";
import { CATEGORY_LABELS, formatXof } from "@/lib/education/labels";
import { PageHeader, Panel } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { ButtonLink } from "@/components/yc/button";
import { EmptyState } from "@/components/yc/empty-state";
import { IconPlus } from "@/components/yc/icons";

export const metadata: Metadata = { title: "Formations — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Formations de l'établissement : frais, classes ouvertes, élèves inscrits, publication. */
export default async function ProgramsPage() {
  const membership = await requireEducationPage("listings.view");
  const tenantId = membership.tenantId;
  const [programs, active] = await withTenant(tenantId, async (tx) => [
    await listPrograms(tx, tenantId),
    await tx.enrollmentDetails.groupBy({ by: ["listingId"], where: { tenantId, active: true }, _count: { _all: true } }),
  ] as const);
  const enrolled = new Map(active.map((a) => [a.listingId, a._count._all]));
  return (
    <>
      <PageHeader eyebrow="Pilotage" title="Formations" description="La scolarité et les frais fixés ici s'appliquent à chaque inscription : aucun montant ne vient du navigateur du client." actions={hasPermission(membership.permissions, "listings.create") && <ButtonLink href="/dashboard/formations/nouvelle" variant="royal"><IconPlus size={18} /> Nouvelle formation</ButtonLink>} />
      <Panel className="overflow-hidden">
        {programs.length === 0 ? <EmptyState title="Aucune formation" description="Créez votre première formation, puis ses classes." /> : (
          <ul className="divide-y divide-yc-ink/[0.06]">
            {programs.map((p) => (
              <li key={p.id}>
                <Link href={`/dashboard/formations/${p.id}`} className="grid gap-2 px-5 py-4 hover:bg-yc-ivory-50 sm:grid-cols-[1fr_180px_140px_auto] sm:items-center">
                  <span className="min-w-0"><span className="block truncate font-semibold">{p.title}</span><span className="block truncate text-sm text-yc-ink-soft">{CATEGORY_LABELS[p.program?.category ?? ""] ?? "—"}{p.program?.level ? ` · ${p.program.level}` : ""} · {p.program?.classes.length ?? 0} classe{(p.program?.classes.length ?? 0) > 1 ? "s" : ""} ouverte{(p.program?.classes.length ?? 0) > 1 ? "s" : ""}</span></span>
                  <span className="yc-num text-sm">{formatXof(p.price)}<span className="block text-xs text-yc-ink-soft">+ {formatXof(p.program?.registrationFee ?? 0)} d&apos;inscription</span></span>
                  <span className="yc-num text-sm"><strong>{enrolled.get(p.id) ?? 0}</strong> inscrit{(enrolled.get(p.id) ?? 0) > 1 ? "s" : ""}</span>
                  <Pill tone={p.status === "published" ? "success" : "neutral"}>{p.status === "published" ? "En ligne" : "Brouillon"}</Pill>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
