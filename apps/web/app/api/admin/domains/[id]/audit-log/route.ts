import { NextResponse } from "next/server";
import { withSuperAdminAccess } from "@yamacommerce/database";
import { requireSuperAdmin } from "@/lib/domains/require-super-admin";

/** « Consulter le journal d'audit » — voir docs/13, « INTERFACE SUPER ADMIN ». */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const entries = await withSuperAdminAccess((tx) =>
    tx.auditLog.findMany({
      where: { entityType: "Domain", entityId: params.id },
      orderBy: { createdAt: "desc" },
    }),
  );
  return NextResponse.json({ entries });
}
