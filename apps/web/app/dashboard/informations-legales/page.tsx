import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/yc/panel";
import { loadCurrentLegalProfile } from "@/lib/legal/legal-pipeline";
import { LegalProfileForm } from "@/components/dashboard-settings/legal-profile-form";

export const metadata: Metadata = { title: "Informations légales — Y-COM", robots: { index: false, follow: false } };

export default async function LegalProfilePage() {
  const data = await loadCurrentLegalProfile();
  if (!data) redirect("/dashboard");
  const { updatedAt, ...profile } = data.profile;
  return (
    <>
      <PageHeader
        eyebrow="Votre entreprise"
        title="Informations légales"
        description="Elles alimentent les pages « Mentions légales », « Conditions générales » et « Confidentialité » de votre site. Ce qui n'est pas renseigné s'affiche « non renseigné », jamais inventé."
      />
      <LegalProfileForm initial={profile} updatedAt={updatedAt ? updatedAt.toISOString() : null} siteUrl={data.siteUrl} />
    </>
  );
}
