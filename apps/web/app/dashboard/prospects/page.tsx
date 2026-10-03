import type { Metadata } from "next";
import Link from "next/link";
import { withTenant, getLead, listLeads, listVehicles } from "@yamacommerce/database";
import { hasPermission } from "@yamacommerce/auth";
import { requireAutoPage } from "@/lib/auto/guard";
import { INTEREST_LABELS, LEAD_FLOW, LEAD_LABELS, SOURCE_LABELS, formatNumber, shortDate } from "@/lib/auto/labels";
import { PageHeader, Panel, PanelHeader } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { DeskLead, LeadActions } from "@/components/dashboard-auto/lead-panels";

export const metadata: Metadata = { title: "Prospects — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Prospects par étape : demandes du site, essais, négociations ; perte toujours motivée. */
export default async function LeadsPage({ searchParams }: { searchParams: { ouvert?: string; q?: string; clos?: string } }) {
  const membership = await requireAutoPage("customers.view");
  const tenantId = membership.tenantId;
  const openId = searchParams.ouvert && /^[0-9a-f-]{36}$/.test(searchParams.ouvert) ? searchParams.ouvert : null;
  const data = await withTenant(tenantId, async (tx) => ({
    open: await listLeads(tx, tenantId, { status: [...LEAD_FLOW], search: searchParams.q?.slice(0, 60) }),
    closed: searchParams.clos ? await listLeads(tx, tenantId, { status: ["won", "lost"], take: 60 }) : [],
    selected: openId ? await getLead(tx, tenantId, openId) : null,
    vehicles: await listVehicles(tx, tenantId, { stock: ["available", "incoming", "reserved"] }),
  }));
  const canEdit = hasPermission(membership.permissions, "customers.edit");
  const today = iso(new Date());
  const Card = ({ l }: { l: (typeof data.open)[number] }) => {
    const due = l.nextActionAt && iso(l.nextActionAt) <= today;
    return (
      <Link href={`/dashboard/prospects?ouvert=${l.id}${searchParams.clos ? "&clos=1" : ""}`} aria-current={openId === l.id ? "true" : undefined} className="block rounded-lg bg-white p-3 ring-1 ring-yc-ink/[0.08] hover:ring-yc-ink/20 aria-[current=true]:ring-2 aria-[current=true]:ring-yc-electric">
        <span className="flex items-start justify-between gap-2"><span className="font-semibold">{l.customer.firstName} {l.customer.lastName ?? ""}</span>{due && <span className="rounded bg-[#FFF3DC] px-1.5 py-0.5 text-[10.5px] font-bold text-[#6B4300]">À relancer</span>}</span>
        <span className="block truncate text-sm text-yc-ink-soft">{l.listing?.title ?? INTEREST_LABELS[l.interest]}</span>
        <span className="mt-1.5 flex flex-wrap gap-1 text-[11px] font-semibold text-yc-ink-soft"><span className="rounded bg-yc-ink/[0.05] px-1.5 py-0.5">{INTEREST_LABELS[l.interest]}</span><span className="rounded bg-yc-ink/[0.05] px-1.5 py-0.5">{SOURCE_LABELS[l.source]}</span>{l.budget ? <span className="yc-num rounded bg-yc-ink/[0.05] px-1.5 py-0.5">{formatNumber(l.budget)} F</span> : null}</span>
      </Link>
    );
  };
  const s = data.selected;
  return (
    <>
      <PageHeader eyebrow="Pilotage" title="Prospects" description="Une demande du site, un essai ou un appel alimente la fiche du client pour CE véhicule — jamais de doublon." actions={<form><input name="q" defaultValue={searchParams.q ?? ""} placeholder="Nom, téléphone, véhicule…" aria-label="Rechercher un prospect" className="h-10 w-64 max-w-full rounded-lg bg-white px-3 text-sm ring-1 ring-inset ring-yc-ink/12" /></form>} />
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-4">
            {LEAD_FLOW.map((st) => {
              const list = data.open.filter((l) => l.status === st);
              return (
                <section key={st} aria-label={LEAD_LABELS[st]!.label} className="w-[260px] shrink-0 rounded-xl bg-yc-ink/[0.03] p-2.5 sm:w-auto">
                  <h2 className="flex items-center justify-between px-1 pb-2 text-[13px] font-bold uppercase tracking-[0.08em]">{LEAD_LABELS[st]!.label}<span className="yc-num text-yc-ink-soft">{list.length}</span></h2>
                  <div className="grid gap-2">{list.map((l) => <Card key={l.id} l={l} />)}{list.length === 0 && <p className="px-1 py-4 text-center text-xs text-yc-ink-soft">—</p>}</div>
                </section>
              );
            })}
          </div>
          <p className="mt-3 text-sm"><Link href={searchParams.clos ? "/dashboard/prospects" : "/dashboard/prospects?clos=1"} className="font-semibold text-yc-electric hover:underline">{searchParams.clos ? "Masquer les dossiers clos" : "Voir les dossiers clos (vendus, perdus)"}</Link></p>
          {data.closed.length > 0 && (
            <Panel className="mt-3 overflow-hidden">
              <ul className="divide-y divide-yc-ink/[0.06]">{data.closed.map((l) => (
                <li key={l.id}><Link href={`/dashboard/prospects?ouvert=${l.id}&clos=1`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-yc-ivory-50"><span className="min-w-0 truncate">{l.customer.firstName} {l.customer.lastName ?? ""} · {l.listing?.title ?? INTEREST_LABELS[l.interest]}{l.lostReason ? ` — ${l.lostReason}` : ""}</span><Pill tone={LEAD_LABELS[l.status]!.tone}>{LEAD_LABELS[l.status]!.label}</Pill></Link></li>
              ))}</ul>
            </Panel>
          )}
        </div>
        <div className="grid content-start gap-5">
          {s ? (
            <Panel className="overflow-hidden">
              <PanelHeader eyebrow={<Pill tone={LEAD_LABELS[s.status]!.tone}>{LEAD_LABELS[s.status]!.label}</Pill>} title={`${s.customer.firstName} ${s.customer.lastName ?? ""}`} description={s.customer.phone ? <span className="flex flex-wrap gap-3"><a href={`tel:${s.customer.phone}`} className="font-semibold text-yc-electric">{s.customer.phone}</a><a href={`https://wa.me/${s.customer.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="font-semibold text-yc-electric">WhatsApp</a></span> : s.customer.email} />
              <div className="grid gap-4 px-5 pb-5">
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div><dt className="text-yc-ink-soft">Intérêt</dt><dd className="font-semibold">{INTEREST_LABELS[s.interest]}</dd></div>
                  <div><dt className="text-yc-ink-soft">Venu par</dt><dd className="font-semibold">{SOURCE_LABELS[s.source]}</dd></div>
                  {s.listing && <div className="col-span-2"><dt className="text-yc-ink-soft">Véhicule</dt><dd className="font-semibold"><Link href={`/dashboard/vehicules/${s.listing.id}`} className="hover:underline">{s.listing.title}</Link></dd></div>}
                  {s.budget && <div><dt className="text-yc-ink-soft">Budget</dt><dd className="yc-num font-semibold">{formatNumber(s.budget)} FCFA</dd></div>}
                  {s.nextActionAt && <div><dt className="text-yc-ink-soft">Relance</dt><dd className="font-semibold">{shortDate(iso(s.nextActionAt))}</dd></div>}
                  {s.lostReason && <div className="col-span-2"><dt className="text-yc-ink-soft">Motif de perte</dt><dd className="font-semibold">{s.lostReason}</dd></div>}
                </dl>
                {s.listing && s.listing.vehicle?.stockStatus === "available" && !["won", "lost"].includes(s.status) && hasPermission(membership.permissions, "reservations.update_status") && (
                  <Link href={`/dashboard/dossiers?vehicule=${s.listing.id}&prospect=${s.id}#ouvrir`} className="inline-flex h-10 items-center justify-center rounded-lg bg-yc-night-900 px-4 text-sm font-semibold text-white">Ouvrir un dossier de vente</Link>
                )}
                {s.sales.map((x) => <Link key={x.reservationId} href={`/dashboard/dossiers/${x.reservationId}`} className="text-sm font-semibold text-yc-electric hover:underline">Dossier de vente {x.active ? "en cours" : "clos"} →</Link>)}
                <ol className="grid gap-2 border-l-2 border-yc-ink/10 pl-3 text-sm">
                  {s.events.map((e) => (
                    <li key={e.id}>
                      <span className="text-xs text-yc-ink-soft">{new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Dakar" }).format(e.createdAt)}</span>
                      <p>{e.kind === "status" ? `→ ${LEAD_LABELS[e.toStatus ?? ""]?.label ?? e.toStatus}${e.body ? ` : ${e.body}` : ""}` : e.body}</p>
                    </li>
                  ))}
                </ol>
                {canEdit && <LeadActions leadId={s.id} status={s.status} />}
              </div>
            </Panel>
          ) : (
            <Panel><p className="p-5 text-sm text-yc-ink-soft">Choisissez un prospect pour voir son historique, noter un échange ou le faire avancer.</p></Panel>
          )}
          {canEdit && <DeskLead vehicles={data.vehicles.map((v) => ({ id: v.id, title: v.title }))} />}
        </div>
      </div>
    </>
  );
}
