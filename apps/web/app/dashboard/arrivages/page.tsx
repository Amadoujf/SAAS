import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { withTenant, listImports, listVehicles } from "@yamacommerce/database";
import { hasPermission } from "@yamacommerce/auth";
import { requireAutoPage } from "@/lib/auto/guard";
import { IMPORT_LABELS, IMPORT_STAGES, dateLabel } from "@/lib/auto/labels";
import { PageHeader, Panel } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { EmptyState } from "@/components/yc/empty-state";
import { CopyLink, ImportAdvance, NewImport } from "@/components/dashboard-auto/import-panels";

export const metadata: Metadata = { title: "Arrivages — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Importations : achat → mer → port → douane → prêt ; le client suit par un lien personnel. */
export default async function ImportsPage({ searchParams }: { searchParams: { vehicule?: string } }) {
  const membership = await requireAutoPage("listings.view");
  const tenantId = membership.tenantId;
  const data = await withTenant(tenantId, async (tx) => ({
    imports: await listImports(tx, tenantId),
    candidates: await listVehicles(tx, tenantId, { stock: ["available", "incoming"] }),
    domain: await tx.domain.findFirst({ where: { tenantId, lifecycleStatus: "ACTIVE" }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], select: { domain: true } }),
  }));
  const host = data.domain?.domain ?? (await headers()).get("host") ?? "";
  const base = `${host.startsWith("localhost") || host.includes(":") ? "http" : "https"}://${host}`;
  const busy = new Set(data.imports.filter((i) => !["ready", "canceled"].includes(i.stage)).map((i) => i.listingId));
  const open = data.imports.filter((i) => busy.has(i.listingId) && !["ready", "canceled"].includes(i.stage));
  const done = data.imports.filter((i) => !open.includes(i));
  const canEdit = hasPermission(membership.permissions, "listings.edit");
  return (
    <>
      <PageHeader eyebrow="Pilotage" title="Arrivages" description="Chaque étape réelle met à jour le suivi du client. Le véhicule s'ouvre à l'essai quand il est « prêt »." />
      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        <div className="grid content-start gap-4">
          {open.length === 0 ? <Panel><EmptyState title="Aucune importation en cours" description="Suivez ici les véhicules achetés à l'étranger, du port à votre showroom." /></Panel> : open.map((i) => {
            const reached = IMPORT_STAGES.indexOf(i.stage as (typeof IMPORT_STAGES)[number]);
            return (
              <Panel key={i.id}>
                <div className="grid gap-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link href={`/dashboard/vehicules/${i.listing.id}`} className="text-[17px] font-bold hover:underline">{i.listing.title}</Link>
                      <p className="text-sm text-yc-ink-soft">{i.reference} · {i.origin}{i.vessel ? ` · ${i.vessel}` : ""}{i.containerRef ? ` · ${i.containerRef}` : ""}</p>
                      {i.customer && <p className="text-sm">Attendu par {i.customer.firstName} {i.customer.lastName ?? ""} · {i.customer.phone}</p>}
                    </div>
                    <Pill tone={IMPORT_LABELS[i.stage]!.tone}>{IMPORT_LABELS[i.stage]!.label}</Pill>
                  </div>
                  <ol className="grid grid-cols-5 gap-1" aria-label="Étapes">
                    {IMPORT_STAGES.map((s, k) => (
                      <li key={s} className="text-center text-[11px] font-semibold">
                        <span className={`mb-1 block h-1.5 rounded-full ${k <= reached ? "bg-yc-royal" : "bg-yc-ink/10"}`} />
                        <span className={k <= reached ? "" : "text-yc-ink-soft"}>{IMPORT_LABELS[s]!.label}</span>
                      </li>
                    ))}
                  </ol>
                  {i.eta && <p className="text-sm">Arrivée estimée : <span className="font-semibold first-letter:uppercase">{dateLabel(i.eta, "UTC")}</span></p>}
                  {i.customer && <CopyLink url={`${base}/arrivage/${i.accessToken}`} />}
                  {canEdit && <ImportAdvance importId={i.id} stage={i.stage} eta={i.eta ? i.eta.toISOString().slice(0, 10) : null} />}
                </div>
              </Panel>
            );
          })}
          {done.length > 0 && (
            <Panel className="overflow-hidden">
              <h2 className="border-b border-yc-ink/[0.06] px-5 py-3 text-[15px] font-bold">Terminées</h2>
              <ul className="divide-y divide-yc-ink/[0.06]">{done.map((i) => <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm"><span>{i.reference} · {i.listing.title} · {i.origin}</span><Pill tone={IMPORT_LABELS[i.stage]!.tone}>{IMPORT_LABELS[i.stage]!.label}</Pill></li>)}</ul>
            </Panel>
          )}
        </div>
        {canEdit && <NewImport vehicles={data.candidates.filter((v) => !busy.has(v.id)).map((v) => ({ id: v.id, title: v.title }))} initialVehicle={searchParams.vehicule && /^[0-9a-f-]{36}$/.test(searchParams.vehicule) ? searchParams.vehicule : null} />}
      </div>
    </>
  );
}
