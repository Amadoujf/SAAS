import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ycFontVariables } from "@/lib/yc-fonts";
import { previewEnabled, safeNext } from "@/lib/preview/private-preview";

export const metadata: Metadata = { title: "Prévisualisation privée", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Porte de la prévisualisation privée : un code, puis la page demandée. */
export default function PreviewGatePage({ searchParams }: { searchParams: { suite?: string; erreur?: string } }) {
  if (!previewEnabled()) redirect("/");
  const next = safeNext(searchParams.suite);
  const error = searchParams.erreur === "code" ? "Code incorrect." : searchParams.erreur === "trop" ? "Trop d'essais : réessayez dans quelques minutes." : null;
  return (
    <main className={`${ycFontVariables} flex min-h-screen items-center justify-center bg-yc-night-900 px-5 font-ui text-white`}>
      <form method="post" action="/api/preview-access" className="w-full max-w-sm rounded-2xl bg-white/[0.06] p-7 ring-1 ring-white/10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">Y-COM · accès privé</p>
        <h1 className="mt-2 text-[26px] font-bold tracking-[-0.02em]">Prévisualisation</h1>
        <p className="mt-2 text-sm text-white/70">Cette version de démonstration n&apos;est pas publique. Saisissez le code d&apos;accès qui vous a été communiqué.</p>
        <input type="hidden" name="suite" value={next} />
        <label className="mt-6 block text-sm font-semibold">Code d&apos;accès
          <input name="code" type="password" required autoComplete="current-password" autoFocus className="mt-1.5 h-12 w-full rounded-lg bg-white px-3 text-[16px] text-yc-ink focus:outline-none focus:ring-2 focus:ring-yc-electric" />
        </label>
        {error && <p role="alert" className="mt-3 text-sm font-semibold text-[#FF9B8A]">{error}</p>}
        <button type="submit" className="mt-5 h-12 w-full rounded-lg bg-white text-[15px] font-bold text-yc-night-900">Entrer</button>
      </form>
    </main>
  );
}
