import type { Metadata } from "next";
import { withTenant, getEducationSettings } from "@yamacommerce/database";
import { requireEducationPage } from "@/lib/education/guard";
import { PageHeader } from "@/components/yc/panel";
import { SchoolSettings } from "@/components/dashboard-education/enrollment-panels";

export const metadata: Metadata = { title: "Réglages de l'établissement — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SchoolSettingsPage() {
  const membership = await requireEducationPage("academics.manage");
  const settings = await withTenant(membership.tenantId, (tx) => getEducationSettings(tx, membership.tenantId));
  return (
    <>
      <PageHeader eyebrow="Gestion" title="Année et règles" description="Année scolaire affichée, barème des notes, seuil d'alerte d'absences, ouverture des inscriptions en ligne." />
      <SchoolSettings initial={settings} />
    </>
  );
}
