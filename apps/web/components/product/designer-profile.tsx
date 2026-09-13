"use client";

import Image from "next/image";
import { Reveal } from "@/lib/motion/reveal";
import { MaskReveal } from "@/lib/motion/mask-reveal";
import type { Locale } from "@/lib/i18n";

/**
 * En-tête de fiche créateur — voir Teranga Atelier (template 4, 20 septembre 2026),
 * « fiches des créateurs ». Props entièrement typées, aucun contenu codé en dur — même
 * principe que `ProductDetail` (voir la revue du 16 septembre 2026, point 3) : ce
 * composant ne sait rien d'un créateur en particulier, ce qui le rend directement
 * compatible avec la route dynamique `/createur/[handle]`.
 */
export interface DesignerProfileData {
  id: string;
  name: string;
  specialty: string;
  region: string;
  bio: string;
  photoUrl: string;
  workshopPhotoUrl?: string;
  quote?: string;
}

export function DesignerProfileHeader({
  designer,
  locale,
}: {
  designer: DesignerProfileData;
  locale: Locale;
}) {
  return (
    <div className="mx-auto max-w-[var(--content-max-width)] px-6 pb-16 pt-32 lg:px-10 lg:pb-24 lg:pt-40">
      <nav
        aria-label="Fil d'Ariane"
        className="mb-8 text-[length:var(--text-body-xs)] text-[var(--color-text-muted)]"
      >
        <a href="/" className="hover:text-[var(--color-primary)]">
          {locale === "en" ? "Home" : "Accueil"}
        </a>{" "}
        / <span className="text-[var(--color-text-primary)]">{designer.name}</span>
      </nav>

      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <MaskReveal className="relative aspect-[4/5] overflow-hidden rounded-[var(--card-radius)]">
          <Image
            src={designer.photoUrl}
            alt={designer.name}
            fill
            sizes="(max-width: 1024px) 100vw, 45vw"
            className="object-cover"
          />
        </MaskReveal>
        <div>
          <Reveal>
            <p className="text-[length:var(--text-body-sm)] uppercase tracking-[0.24em] text-[var(--color-secondary)]">
              {designer.specialty} · {designer.region}
            </p>
          </Reveal>
          <Reveal>
            <h1 className="mt-3 font-[family-name:var(--font-heading)] text-[length:var(--text-heading-xl)] text-[var(--color-text-primary)]">
              {designer.name}
            </h1>
          </Reveal>
          <Reveal>
            <p className="mt-6 max-w-md text-[length:var(--text-body-lg)] text-[var(--color-text-secondary)]">
              {designer.bio}
            </p>
          </Reveal>
          {designer.quote && (
            <Reveal>
              <blockquote className="mt-8 border-l-2 border-[var(--color-secondary)] pl-5 text-[length:var(--text-body-lg)] italic text-[var(--color-text-primary)]">
                &ldquo;{designer.quote}&rdquo;
              </blockquote>
            </Reveal>
          )}
        </div>
      </div>

      {designer.workshopPhotoUrl && (
        <Reveal className="relative mt-16 aspect-[21/9] overflow-hidden rounded-[var(--card-radius)] lg:mt-24">
          <Image
            src={designer.workshopPhotoUrl}
            alt={locale === "en" ? `${designer.name}'s workshop` : `Atelier de ${designer.name}`}
            fill
            sizes="100vw"
            className="object-cover"
          />
        </Reveal>
      )}
    </div>
  );
}
