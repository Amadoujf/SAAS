import Link from "next/link";
import type { Metadata } from "next";
import { hasPermission } from "@yamacommerce/auth";
import { withTenant, listServices } from "@yamacommerce/database";
import { requireSalonPage } from "@/lib/salon/guard";
import { durationLabel, priceLabel } from "@/lib/salon/labels";
import { PageHeader, Panel } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { EmptyState } from "@/components/yc/empty-state";
import { ButtonLink } from "@/components/yc/button";
import { IconPlus } from "@/components/yc/icons";

export const metadata: Metadata = { title: "Prestations — Y-COM", robots: { index: false, follow: false } };

const STATUS: Record<string, { label: string; tone: "success" | "neutral" | "warning" }> = {
  published: { label: "En ligne", tone: "success" },
  draft: { label: "Brouillon", tone: "neutral" },
  unavailable: { label: "Retirée", tone: "warning" },
  archived: { label: "Archivée", tone: "neutral" },
};

/** La carte des prestations, par rubrique : durée, prix, personnes, réservation en ligne. */
export default async function ServicesPage() {
  const membership = await requireSalonPage("listings.view");
  const services = await withTenant(membership.tenantId, (tx) => listServices(tx, membership.tenantId));
  const categories = [...new Set(services.map((s) => s.service?.category ?? "Autres"))];
  return (
    <>
      <PageHeader eyebrow="Salon" title="Prestations" description="Votre carte : durées réelles, prix, personnes qui les réalisent. C'est elle qui calcule les horaires proposés en ligne." actions={hasPermission(membership.permissions, "listings.create") ? <ButtonLink href="/dashboard/prestations/nouveau" variant="royal"><IconPlus size={18} /> Prestation</ButtonLink> : undefined} />
      {services.length === 0 ? (
        <Panel><EmptyState title="Aucune prestation" description="Créez votre première prestation : nom, durée, prix et personnes qui la réalisent." /></Panel>
      ) : (
        <div className="grid gap-5">
          {categories.map((c) => (
            <Panel key={c} className="overflow-hidden">
              <h2 className="border-b border-yc-ink/[0.06] px-5 py-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-yc-ink-soft">{c}</h2>
              <ul className="divide-y divide-yc-ink/[0.06]">
                {services.filter((s) => (s.service?.category ?? "Autres") === c).map((s) => {
                  const st = STATUS[s.status] ?? STATUS.draft!;
                  const who = s.service?.skills.filter((k) => k.staff.isActive).map((k) => k.staff.displayName) ?? [];
                  return (
                    <li key={s.id}>
                      <Link href={`/dashboard/prestations/${s.id}`} className="flex flex-col gap-1.5 px-5 py-3.5 hover:bg-yc-ivory-50 sm:flex-row sm:items-center sm:gap-5">
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2 font-semibold">{s.title}<Pill tone={st.tone}>{st.label}</Pill>{s.service && !s.service.onlineBooking && <Pill tone="neutral">Par téléphone</Pill>}</span>
                          <span className="block text-sm text-yc-ink-soft">{s.service ? durationLabel(s.service.durationMinutes) : ""}{s.service?.bufferMinutes ? ` + ${s.service.bufferMinutes} min de préparation` : ""} · {who.length ? who.join(", ") : <span className="text-yc-danger">personne n&apos;est assigné</span>}</span>
                        </span>
                        <span className="yc-num whitespace-nowrap text-sm font-semibold">{priceLabel(s.price, s.service?.priceFrom ?? false)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
