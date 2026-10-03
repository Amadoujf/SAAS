import type { Metadata } from "next";
import Link from "next/link";
import { hasPermission } from "@yamacommerce/auth";
import { requireRealEstatePage } from "@/lib/real-estate/guard";
import { PageHeader } from "@/components/yc/panel";
import { IconArrowLeft } from "@/components/yc/icons";
import { PropertyEditor } from "@/components/dashboard-real-estate/property-editor";

export const metadata: Metadata = { title: "Nouveau bien — Y-COM", robots: { index: false, follow: false } };

export default async function NewPropertyPage() {
  const membership = await requireRealEstatePage("listings.create");
  return (
    <>
      <Link href="/dashboard/biens" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-yc-ink-soft hover:text-yc-ink"><IconArrowLeft size={16} /> Biens</Link>
      <PageHeader title="Nouveau bien" description="Créé en brouillon : ajoutez des photos puis mettez-le en ligne." />
      <PropertyEditor
        listingId={null}
        status={null}
        can={{ edit: true, publish: hasPermission(membership.permissions, "listings.publish"), remove: false }}
        initial={{ title: "", summary: "", description: "", price: null, propertyType: "apartment", dealType: "rent", bedrooms: null, bathrooms: null, surfaceM2: null, landSurfaceM2: null, furnished: false, amenities: [], agencyReference: "", featured: false, location: { region: "Dakar" }, media: [] }}
      />
    </>
  );
}
