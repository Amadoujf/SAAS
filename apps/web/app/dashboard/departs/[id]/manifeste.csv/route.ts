import { NextResponse } from "next/server";
import { withTenant, departureManifest, summarizePayments } from "@yamacommerce/database";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { requireTenantPermission } from "@/lib/tenant-permissions";
import { getTenantModuleKeys, isTravel } from "@/lib/modules/tenant-modules";
import { DOCUMENT_LABELS, documentStatusLabel } from "@/lib/travel/labels";

const cell = (v: unknown) => {
  const s = String(v ?? "");
  // Neutralise les formules (injection CSV) et échappe les guillemets.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

/** Export du manifeste d'un départ (tableur) : jamais le numéro de passeport complet. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const membership = await getCurrentTenantMembership();
  if (!membership || !isTravel(await getTenantModuleKeys(membership.tenantId)) || !(await requireTenantPermission(membership.tenantId, "reservations.view"))) {
    return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  }
  const manifest = await withTenant(membership.tenantId, (tx) => departureManifest(tx, membership.tenantId, params.id));
  if (!manifest) return NextResponse.json({ error: "Départ introuvable." }, { status: 404 });
  const docs = manifest.departure.listing.travel?.requiredDocuments ?? [];
  const header = ["Réservation", "Statut", "Voyageur", "Prénom", "Nom", "Date de naissance", "Nationalité", "Passeport (4 derniers)", "Expiration passeport", ...docs.map((k) => DOCUMENT_LABELS[k] ?? k), "Téléphone du contact", "Total FCFA", "Reçu FCFA"];
  const rows = manifest.bookings.flatMap((b) => {
    const pay = summarizePayments(b.totalAmount, manifest.departure.listing.travel?.depositPercent ?? 0, b.payments);
    return b.travelers.map((t) => [
      b.reference, b.status, t.position, t.firstName, t.lastName, t.birthDate?.toISOString().slice(0, 10) ?? "", t.nationality ?? "", t.passportLast4 ?? "", t.passportExpiry?.toISOString().slice(0, 10) ?? "",
      ...docs.map((k) => documentStatusLabel(k, t.documents.find((d) => d.kind === k)?.status ?? "missing")),
      b.customer.phone ?? "", pay.total ?? "", pay.paid,
    ]);
  });
  const csv = "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
  const date = manifest.departure.startAt.toISOString().slice(0, 10);
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="manifeste-${date}.csv"`, "cache-control": "no-store" } });
}
