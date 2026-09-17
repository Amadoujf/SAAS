import "server-only";
import { auth } from "@/lib/auth";

/** Garde partagée par toutes les routes `/api/admin/domains/*` — voir docs/13,
 *  « INTERFACE SUPER ADMIN ». */
export async function requireSuperAdmin(): Promise<{ userId: string } | null> {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) return null;
  return { userId: session.user.id };
}
