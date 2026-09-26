"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { acceptInvitation, createOwnerAccount, findInvitationByToken, ProvisioningError, TeamError, withSuperAdminAccess } from "@yamacommerce/database";
import { auth, signIn } from "@/lib/auth";

export interface InvitationState { error: string | null }

/** Rejoint l'équipe : avec le compte connecté (même e-mail) ou en créant le compte de
 *  l'adresse invitée. Toutes les vérifications sont refaites côté serveur. */
export async function acceptInvitationAction(_prev: InvitationState, form: FormData): Promise<InvitationState> {
  const token = String(form.get("token") ?? "");
  const session = await auth();
  const invitation = await withSuperAdminAccess((tx) => findInvitationByToken(tx, token));
  if (!invitation) return { error: "Cette invitation n'est plus valable." };

  let userId = session?.user?.id ?? null;
  const password = String(form.get("password") ?? "");
  try {
    if (!userId) {
      const user = await createOwnerAccount({ email: invitation.email, fullName: String(form.get("fullName") ?? ""), password });
      userId = user.id;
    }
    await withSuperAdminAccess((tx) => acceptInvitation(tx, token, userId!));
  } catch (error) {
    if (error instanceof ProvisioningError || error instanceof TeamError) return { error: error.message };
    throw error;
  }

  if (!session?.user) {
    try {
      await signIn("credentials", { email: invitation.email, password, redirectTo: "/dashboard" });
    } catch (error) {
      if (error instanceof AuthError) redirect("/connexion");
      throw error;
    }
  }
  redirect("/dashboard");
}
