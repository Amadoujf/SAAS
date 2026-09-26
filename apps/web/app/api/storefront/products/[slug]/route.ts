import { NextResponse, type NextRequest } from "next/server";
import { withTenant, getProductBySlugForTenant } from "@yamacommerce/database";
import { resolveActiveTenant } from "@/lib/rendering/resolve-public-site";

/** Aperçu rapide d'un produit PUBLIÉ (boutique résolue par le Host) : images,
 *  variantes et stock réel — le prix payé reste toujours recalculé par le serveur. */
export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  const active = await resolveActiveTenant(request.headers.get("host") ?? "");
  if (active.status !== "ok") return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
  const product = await withTenant(active.tenantId, (tx) => getProductBySlugForTenant(tx, active.tenantId, params.slug, "PUBLISHED"));
  if (!product) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
  return NextResponse.json({
    product: {
      slug: product.slug,
      name: product.name,
      shortDescription: product.shortDescription,
      compareAtPrice: product.compareAtPrice,
      category: product.category?.name ?? null,
      images: product.images.map((i) => ({ url: i.url, alt: i.altText ?? product.name })),
      variants: product.variants.map((v) => ({ id: v.id, name: v.name, price: v.price, available: v.inventoryItems.reduce((s, i) => s + i.availableQuantity, 0) })),
    },
  });
}
