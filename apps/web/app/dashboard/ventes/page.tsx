import Link from "next/link";
import type { Metadata } from "next";
import { withTenant, listOrders, localToUtc, paymentSummary, utcToLocal } from "@yamacommerce/database";
import { requireRestaurantPage } from "@/lib/restaurant/guard";
import { KITCHEN_LABELS, MODE_LABELS, formatXof, timeIn } from "@/lib/restaurant/labels";
import { PageHeader, Panel } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { EmptyState } from "@/components/yc/empty-state";
import { ButtonLink } from "@/components/yc/button";
import { IconPlus } from "@/components/yc/icons";

export const metadata: Metadata = { title: "Commandes — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const QUEUES = [
  { key: "", label: "Aujourd'hui" },
  { key: "en-cours", label: "En cours" },
  { key: "a-encaisser", label: "À encaisser" },
  { key: "annulees", label: "Annulées" },
  { key: "historique", label: "Historique" },
] as const;

const PAY: Record<string, { label: string; tone: "success" | "warning" | "neutral" }> = {
  paid: { label: "Réglée", tone: "success" },
  partial: { label: "Réglée en partie", tone: "warning" },
  unpaid: { label: "Non réglée", tone: "neutral" },
};

/** Commandes du restaurant : du jour, en cours, à encaisser, historique. */
export default async function RestaurantOrdersPage({ searchParams }: { searchParams: { file?: string; q?: string } }) {
  const membership = await requireRestaurantPage("orders.view");
  const queue = QUEUES.find((q) => q.key === (searchParams.file ?? ""))?.key ?? "";
  const search = searchParams.q?.trim().slice(0, 60) || undefined;
  const { rows, tz, totals } = await withTenant(membership.tenantId, async (tx) => {
    const tz = (await tx.tenant.findUnique({ where: { id: membership.tenantId }, select: { timezone: true } }))?.timezone || "Africa/Dakar";
    const today = utcToLocal(new Date(), tz).date;
    const from = localToUtc(today, 0, tz);
    const all = await listOrders(tx, membership.tenantId, {
      ...(queue === "" ? { from } : {}),
      ...(queue === "en-cours" ? { status: ["new", "accepted", "preparing", "ready"] } : {}),
      ...(queue === "a-encaisser" ? { status: ["new", "accepted", "preparing", "ready", "completed"] } : {}),
      ...(queue === "annulees" ? { status: ["canceled"] } : {}),
      search,
      take: 300,
    });
    const rows = queue === "a-encaisser" ? all.filter((o) => paymentSummary(o.total, o.payments).state !== "paid") : all;
    const todays = queue === "" ? rows.filter((o) => o.status !== "canceled") : [];
    return {
      tz,
      rows,
      totals: { count: todays.length, ordered: todays.reduce((s, o) => s + o.total, 0), collected: todays.reduce((s, o) => s + paymentSummary(o.total, o.payments).paid, 0) },
    };
  });
  return (
    <>
      <PageHeader eyebrow="Service" title="Commandes" description="Une commande n'est « réglée » qu'après encaissement enregistré (espèces, Wave, Orange Money, carte)." actions={<ButtonLink href="/dashboard/ventes/nouvelle" variant="royal"><IconPlus size={18} /> Commande</ButtonLink>} />
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Files de travail" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {QUEUES.map((q) => {
            const on = queue === q.key;
            return <Link key={q.key} href={q.key ? `/dashboard/ventes?file=${q.key}` : "/dashboard/ventes"} aria-current={on ? "page" : undefined} className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${on ? "bg-yc-night-900 text-white" : "bg-white text-yc-ink-soft ring-1 ring-yc-ink/10 hover:text-yc-ink"}`}>{q.label}</Link>;
          })}
        </nav>
        <form action="/dashboard/ventes" className="flex gap-2">
          {queue && <input type="hidden" name="file" value={queue} />}
          <input name="q" defaultValue={search ?? ""} placeholder="Numéro, nom, téléphone" aria-label="Rechercher une commande" className="h-10 w-full min-w-0 rounded-lg bg-white px-3 text-sm ring-1 ring-inset ring-yc-ink/12 lg:w-64" />
          <button type="submit" className="h-10 shrink-0 rounded-lg bg-yc-night-900 px-4 text-sm font-semibold text-white">Chercher</button>
        </form>
      </div>
      {queue === "" && (
        <p className="mb-4 text-sm text-yc-ink-soft">
          <strong className="text-yc-ink">{totals.count}</strong> commande{totals.count > 1 ? "s" : ""} aujourd&apos;hui · <strong className="yc-num text-yc-ink">{formatXof(totals.ordered)}</strong> commandés · <strong className="yc-num text-[rgb(4_120_87)]">{formatXof(totals.collected)}</strong> encaissés
        </p>
      )}
      {rows.length === 0 ? (
        <Panel><EmptyState title="Aucune commande ici" description={queue ? "Tout est à jour." : "Les commandes du site, des tables et de la salle apparaissent ici."} /></Panel>
      ) : (
        <Panel className="overflow-hidden">
          <ul className="divide-y divide-yc-ink/[0.06]">
            {rows.map((o) => {
              const st = KITCHEN_LABELS[o.status] ?? KITCHEN_LABELS.new!;
              const pay = paymentSummary(o.total, o.payments);
              return (
                <li key={o.id}>
                  <Link href={`/dashboard/ventes/${o.id}`} className="flex flex-col gap-2 px-5 py-4 hover:bg-yc-ivory-50 sm:flex-row sm:items-center sm:gap-5">
                    <span className="w-28 shrink-0">
                      <span className="yc-num block text-[18px] font-extrabold">n° {o.number.split("-")[1]}</span>
                      <span className="yc-num block text-xs text-yc-ink-soft">{timeIn(o.createdAt, tz)}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 font-semibold">{o.table ? `Table ${o.table.label}` : MODE_LABELS[o.mode]?.label} · {o.customerName}<Pill tone={st.tone}>{st.label}</Pill></span>
                      <span className="mt-0.5 block truncate text-sm text-yc-ink-soft">{o.items.map((i) => `${i.quantity} × ${i.nameSnapshot}`).join(", ")}</span>
                    </span>
                    <span className="flex items-center gap-3 sm:w-64 sm:justify-end">
                      {o.status !== "canceled" && <Pill tone={PAY[pay.state]!.tone} dot={false}>{PAY[pay.state]!.label}</Pill>}
                      <span className="yc-num whitespace-nowrap text-sm font-bold">{formatXof(o.total)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </>
  );
}
