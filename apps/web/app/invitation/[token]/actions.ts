"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { acceptInvitation, createAccountIn, findInvitationByToken, ProvisioningError, TeamError, withSuperAdminAccess } from "@yamacommerce/database";
import { hashPassword } from "@yamacommerce/auth";
import { auth, signIn } from "@/lib/auth";

export interface InvitationState { error: string | null }

/** Rejoint l'équipe : avec le compte connecté (même e-mail) ou en créant le compte de
 *  l'adresse invitée. Toutes les vérifications sont refaites côté serveur. */
export async function acceptInvitationAction(_prev: InvitationState, form: FormData): Promise<InvitationState> {
  const token = String(form.get("token") ?? "");
  const session = await auth();
  const invitation = await withSuperAdminAccess((tx) => findInvitationByToken(tx, token));
  if (!invitation) return { error: "Cette invitation n'est plus valable." };

  const password = String(form.get("password") ?? "");
  try {
    if (session?.user) {
      await withSuperAdminAccess((tx) => acceptInvitation(tx, token, session.user.id));
    } else {
      if (password.length < 8) return { error: "Le mot de passe doit contenir au moins 8 caractères." };
      const passwordHash = await hashPassword(password);
      // Compte ET adhésion dans une seule transaction : jamais de compte orphelin.
      await withSuperAdminAccess(async (tx) => {
        const user = await createAccountIn(tx, { email: invitation.email, fullName: String(form.get("fullName") ?? ""), password }, passwordHash);
        await acceptInvitation(tx, token, user.id);
      });
    }
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
