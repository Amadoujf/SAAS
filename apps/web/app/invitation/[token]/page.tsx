import type { Metadata } from "next";
import Link from "next/link";
import { findInvitationByToken, withSuperAdminAccess } from "@yamacommerce/database";
import { ycFontVariables } from "@/lib/yc-fonts";
import { auth } from "@/lib/auth";
import { YcLogo } from "@/components/yc/logo";
import { ROLE_LABELS } from "@/lib/team/roles";
import { InvitationForm } from "./invitation-form";

export const metadata: Metadata = { title: "Invitation — Y-COM", robots: { index: false, follow: false } };

export default async function InvitationPage({ params }: { params: { token: string } }) {
  const [invitation, session] = await Promise.all([withSuperAdminAccess((tx) => findInvitationByToken(tx, params.token)), auth()]);
  const sessionEmail = session?.user?.email?.toLowerCase() ?? null;
  return (
    <main className={`${ycFontVariables} flex min-h-screen flex-col bg-yc-paper px-4 py-6 font-ui text-yc-navy-ink sm:px-12`}>
      <Link href="/" className="w-fit"><YcLogo /></Link>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
        {!invitation ? (
          <>
            <h1 className="font-editorial text-[40px] leading-[1.05]">Invitation <em className="text-yc-royal">expirée.</em></h1>
            <p className="mt-3 text-yc-ink-soft">Ce lien a déjà été utilisé, a été annulé ou a expiré. Demandez une nouvelle invitation à la personne qui vous a invité.</p>
          </>
        ) : (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-yc-ink-soft">Invitation</p>
            <h1 className="mt-4 font-editorial text-[40px] leading-[1.05]">Rejoignez <em className="text-yc-royal">{invitation.tenant.name}.</em></h1>
            <p className="mt-3 text-yc-ink-soft">
              Vous êtes invité comme <strong className="text-yc-navy-ink">{ROLE_LABELS[invitation.roleName]?.label ?? invitation.roleName}</strong> ({ROLE_LABELS[invitation.roleName]?.description}) avec l&apos;adresse <strong className="text-yc-navy-ink">{invitation.email}</strong>.
            </p>
            {sessionEmail && sessionEmail !== invitation.email ? (
              <p role="alert" className="mt-6 rounded-lg bg-yc-warning/[0.12] px-4 py-3 text-sm">
                Vous êtes connecté avec {sessionEmail}. Déconnectez-vous puis rouvrez ce lien avec le compte {invitation.email}.
              </p>
            ) : (
              <>
                <InvitationForm token={params.token} email={invitation.email} loggedIn={!!sessionEmail} />
                {!sessionEmail && (
                  <p className="mt-6 text-sm text-yc-ink-soft">
                    Vous avez déjà un compte avec cette adresse ?{" "}
                    <Link href={`/connexion?suite=${encodeURIComponent(`/invitation/${params.token}`)}`} className="font-semibold text-yc-royal hover:underline">Connectez-vous</Link>
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
