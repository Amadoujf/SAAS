import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { withTenant, getDish } from "@yamacommerce/database";
import { requireRestaurantPage } from "@/lib/restaurant/guard";
import { PageHeader } from "@/components/yc/panel";
import { DishEditor } from "@/components/dashboard-restaurant/dish-editor";

export const metadata: Metadata = { title: "Plat — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DishPage({ params }: { params: { id: string } }) {
  const membership = await requireRestaurantPage("products.edit");
  if (!/^[0-9a-f-]{36}$/.test(params.id)) notFound();
  const { dish, sections } = await withTenant(membership.tenantId, async (tx) => ({
    dish: await getDish(tx, membership.tenantId, params.id),
    sections: await tx.menuSection.findMany({ where: { tenantId: membership.tenantId }, orderBy: { position: "asc" }, select: { id: true, name: true } }),
  }));
  if (!dish) notFound();
  return (
    <>
      <PageHeader eyebrow={<a href="/dashboard/carte" className="hover:underline">La carte</a>} title={dish.name} description={`Rubrique ${dish.section.name}`} />
      <DishEditor
        dishId={dish.id}
        sections={sections}
        initial={{
          sectionId: dish.sectionId,
          name: dish.name,
          description: dish.description ?? "",
          price: String(dish.price),
          imageUrl: dish.imageUrl,
          imageDemo: dish.imageDemo,
          badges: dish.badges,
          isAvailable: dish.isAvailable,
          isActive: dish.isActive,
          prepMinutes: dish.prepMinutes,
          groups: dish.optionGroups.map((g) => ({ name: g.name, minChoices: g.minChoices, maxChoices: g.maxChoices, options: g.options.map((o) => ({ name: o.name, priceDelta: String(o.priceDelta), isAvailable: o.isAvailable })) })),
        }}
      />
    </>
  );
}
