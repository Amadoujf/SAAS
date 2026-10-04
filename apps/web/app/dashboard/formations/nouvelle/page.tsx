import type { Metadata } from "next";
import { hasPermission } from "@yamacommerce/auth";
import { requireEducationPage } from "@/lib/education/guard";
import { PageHeader } from "@/components/yc/panel";
import { EMPTY_PROGRAM, ProgramEditor } from "@/components/dashboard-education/program-editor";

export const metadata: Metadata = { title: "Nouvelle formation — Y-COM", robots: { index: false, follow: false } };

export default async function NewProgramPage() {
  const membership = await requireEducationPage("listings.create");
  return (
    <>
      <PageHeader eyebrow="Formations" title="Nouvelle formation" description="Créez la fiche, puis ajoutez ses classes (horaires, capacité, enseignant)." />
      <ProgramEditor listingId={null} initial={EMPTY_PROGRAM} canPublish={hasPermission(membership.permissions, "listings.publish")} />
    </>
  );
}
