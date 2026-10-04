import Link from "next/link";

export const LEGAL_LINKS = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/conditions-generales", label: "Conditions générales" },
  { href: "/confidentialite", label: "Confidentialité" },
] as const;

/** Liens légaux de pied de page ; hérite de la couleur du pied de page qui l'accueille. */
export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Informations légales" className={`flex flex-wrap gap-x-4 gap-y-1 text-xs ${className}`}>
      {LEGAL_LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="underline-offset-4 opacity-80 hover:underline hover:opacity-100">{l.label}</Link>
      ))}
    </nav>
  );
}
