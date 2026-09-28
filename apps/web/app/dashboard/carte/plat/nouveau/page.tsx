import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { withTenant } from "@yamacommerce/database";
import { requireRestaurantPage } from "@/lib/restaurant/guard";
import { PageHeader } from "@/components/yc/panel";
import { DishEditor } from "@/components/dashboard-restaurant/dish-editor";

export const metadata: Metadata = { title: "Nouveau plat — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function NewDishPage({ searchParams }: { searchParams: { rubrique?: string } }) {
  const membership = await requireRestaurantPage("products.create");
  const sections = await withTenant(membership.tenantId, (tx) => tx.menuSection.findMany({ where: { tenantId: membership.tenantId }, orderBy: { position: "asc" }, select: { id: true, name: true } }));
  if (!sections.length) redirect("/dashboard/carte");
  const sectionId = sections.find((s) => s.id === searchParams.rubrique)?.id ?? sections[0]!.id;
  return (
    <>
      <PageHeader eyebrow={<a href="/dashboard/carte" className="hover:underline">La carte</a>} title="Nouveau plat" />
      <DishEditor dishId={null} sections={sections} initial={{ sectionId, name: "", description: "", price: "", imageUrl: null, imageDemo: false, badges: [], isAvailable: true, isActive: true, prepMinutes: 15, groups: [] }} />
    </>
  );
}
