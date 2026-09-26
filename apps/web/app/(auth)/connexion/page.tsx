import { ycFontVariables } from "@/lib/yc-fonts";
import Link from "next/link";
import type { Metadata } from "next";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { YcLogo } from "@/components/yc/logo";
import { IconCheck } from "@/components/yc/icons";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion — YamaCommerce" };

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
    <div className={`${ycFontVariables} grid min-h-screen font-ui lg:grid-cols-2`}>
      <aside className="relative hidden overflow-hidden bg-yc-night-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0 yc-glow" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 yc-grid" aria-hidden="true" />
        <Link href="/" className="relative w-fit"><YcLogo tone="light" /></Link>
        <div className="relative">
          <p className="font-display text-5xl font-semibold leading-[1.02] tracking-[-0.03em]">Vos commandes<br /><span className="yc-text-gradient">vous attendent.</span></p>
          <ul className="mt-8 space-y-3 text-white/70">
            {["Preuves Wave et Orange Money à valider", "Colis à préparer et à expédier", "Clients prévenus à chaque étape"].map((t) => (
              <li key={t} className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-yc-cyan/15 text-yc-cyan"><IconCheck size={14} /></span>{t}</li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/40">Données isolées par entreprise, sessions chiffrées.</p>
      </aside>
      <main className="flex flex-col justify-center bg-yc-ivory-50 px-6 py-12 text-yc-ink sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-10 inline-block lg:hidden"><YcLogo /></Link>
          <h1 className="font-display text-[34px] font-semibold tracking-[-0.025em]">Bon retour parmi nous</h1>
          <p className="mt-2 text-yc-ink-soft">Connectez-vous pour gérer votre boutique.</p>
          {searchParams.cree && <p role="status" className="mt-6 rounded-xl bg-yc-success/10 px-4 py-3 text-sm font-medium text-[rgb(4_120_87)]">Votre boutique est créée. Connectez-vous pour y accéder.</p>}
          {searchParams.error && <p role="alert" className="mt-6 rounded-xl bg-yc-danger/[0.07] px-4 py-3 text-sm font-medium text-[rgb(185_28_28)]">E-mail ou mot de passe incorrect.</p>}
          <LoginForm action={authenticate} next={next} />
          <p className="mt-8 text-sm text-yc-ink-soft">Pas encore de boutique ? <Link href="/creer-ma-boutique" className="font-semibold text-yc-electric underline-offset-4 hover:underline">Créer ma boutique</Link></p>
        </div>
      </main>
    </div>
  );
}
