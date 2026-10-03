import { ycFontVariables } from "@/lib/yc-fonts";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { YcLogo } from "@/components/yc/logo";
import { IconCheck } from "@/components/yc/icons";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion — Y-COM" };

/** N'autorise qu'une redirection interne (jamais une URL externe fournie en
 *  paramètre : pas de redirection ouverte). */
function safeNext(value: string | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export default function ConnexionPage({ searchParams }: { searchParams: { error?: string; suite?: string; cree?: string } }) {
  const next = safeNext(searchParams.suite);
  async function authenticate(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", { email: formData.get("email"), password: formData.get("password"), redirectTo: String(formData.get("next") ?? "/dashboard") });
    } catch (error) {
      if (error instanceof AuthError) redirect(`/connexion?error=1${next !== "/dashboard" ? `&suite=${encodeURIComponent(next)}` : ""}`);
      throw error;
    }
  }

  return (
    <div className={`${ycFontVariables} grid min-h-screen bg-yc-paper font-ui text-yc-navy-ink lg:grid-cols-[1fr_1.05fr]`}>
      <main className="flex flex-col px-4 py-6 sm:px-12 lg:py-8">
        <Link href="/" className="w-fit"><YcLogo /></Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-yc-ink-soft">Espace marchand</p>
          <h1 className="mt-4 font-editorial text-[44px] leading-[1.02] sm:text-[52px]">Bon retour<br /><em className="text-yc-royal">parmi nous.</em></h1>
          <p className="mt-3 text-yc-ink-soft">Connectez-vous pour gérer votre boutique.</p>
          {searchParams.cree && <p role="status" className="mt-6 rounded-lg bg-yc-success/10 px-4 py-3 text-sm font-medium text-[rgb(4_120_87)]">Votre boutique est créée. Connectez-vous pour y accéder.</p>}
          {searchParams.error && <p role="alert" className="mt-6 rounded-lg bg-yc-danger/[0.07] px-4 py-3 text-sm font-medium text-[rgb(185_28_28)]">E-mail ou mot de passe incorrect.</p>}
          <LoginForm action={authenticate} next={next} />
          <p className="mt-8 text-sm text-yc-ink-soft">Pas encore de site ? <Link href="/creer-ma-boutique" className="font-semibold text-yc-royal underline-offset-4 hover:underline">Créer mon site</Link></p>
        </div>
        <p className="text-xs text-yc-ink-soft">Données isolées par entreprise, sessions chiffrées.</p>
      </main>
      <aside className="relative hidden flex-col justify-center gap-12 overflow-hidden bg-yc-navy px-12 py-12 text-yc-paper lg:flex" aria-hidden="true">
        <div className="relative aspect-[1410/852] w-full max-w-[720px] overflow-hidden rounded-lg shadow-[0_40px_80px_-30px_rgb(0_0_0/0.6)]">
          <Image src="/marketing/hero-templates.jpg" alt="" fill priority sizes="(min-width: 1024px) 720px, 0px" className="object-cover" />
        </div>
        <div>
          <p className="font-editorial text-[44px] leading-[1.02]">Vos commandes <em>vous attendent.</em></p>
          <ul className="mt-6 space-y-2.5 text-[15px] text-yc-paper/80">
            {["Preuves Wave et Orange Money à valider", "Colis à préparer et à expédier", "Clients prévenus à chaque étape"].map((t) => (
              <li key={t} className="flex items-center gap-3"><IconCheck size={16} className="text-[#8FA9EE]" />{t}</li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
