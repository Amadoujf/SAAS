import Link from "next/link";
import type { HomeStatus } from "@/lib/site-editor/home-status";

const dateFr = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

/**
 * « Votre page d'accueil » : ce qui est en ligne et UNE action pour la modifier. C'est
 * l'unique porte d'entrée vers l'éditeur visuel (plus de second menu concurrent).
 */
export function HomeStatusCard({ status, siteUrl }: { status: HomeStatus; siteUrl: string | null }) {
  const live = status.mode === "editor";
  return (
    <section aria-labelledby="accueil-statut" className="rounded-xl bg-white p-5 shadow-[0_1px_2px_rgb(12_22_48/0.04),0_8px_24px_-16px_rgb(12_22_48/0.12)] ring-1 ring-yc-ink/[0.07] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-yc-ink-soft">Votre page d&apos;accueil</p>
          <h2 id="accueil-statut" className="mt-1.5 text-lg font-semibold text-yc-ink">
            {live ? "Composée dans l'éditeur visuel" : "Accueil standard de votre style"}
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-yc-ink-soft">
            {live
              ? `En ligne${status.versionNumber ? ` — version ${status.versionNumber}` : ""}${status.publishedAt ? `, publiée le ${dateFr.format(status.publishedAt)}` : ""}. Sections, textes, visuels et animations se modifient dans l'éditeur ; le logo, les couleurs et le style se règlent ci-dessous et s'appliquent à tout le site.`
              : status.editorStarted
                ? "Une page d'accueil est en préparation dans l'éditeur visuel, mais n'est pas encore publiée : les visiteurs voient toujours l'accueil standard réglé ci-dessous."
                : "Les visiteurs voient l'accueil standard réglé ci-dessous. Pour une page plus riche (sections immersives, récits animés, carrousels), composez-la dans l'éditeur visuel : vos contenus actuels y sont repris et rien ne change en ligne avant votre publication."}
          </p>
          {live && status.pendingChanges && (
            <p role="status" className="mt-3 inline-flex rounded-full bg-yc-warning/[0.14] px-3 py-1 text-xs font-semibold text-[rgb(146_84_0)]">Modifications enregistrées, pas encore publiées</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href="/editeur" className="inline-flex min-h-11 items-center rounded-lg bg-yc-ink px-4 text-sm font-semibold text-white hover:bg-yc-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yc-electric focus-visible:ring-offset-2">
            {live || status.editorStarted ? "Modifier dans l'éditeur" : "Composer dans l'éditeur"}
          </Link>
          {siteUrl && (
            <a href={siteUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-yc-ink ring-1 ring-inset ring-yc-ink/15 hover:bg-yc-ink/[0.04]">
              Voir le site ↗
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
