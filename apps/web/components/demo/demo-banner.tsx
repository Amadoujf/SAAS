/**
 * Bandeau des sites de DÉMONSTRATION : les produits, biens, prix et commandes affichés
 * sont fictifs — jamais présentés comme ceux d'une entreprise réelle. Discret (une
 * ligne), sur toutes les pages, lisible et non masquable.
 */
export function DemoBanner({ kind }: { kind: "boutique" | "agence" }) {
  return (
    <p className="bg-[#1B1F2A] px-4 py-1.5 text-center text-[12px] font-medium leading-snug text-white/85">
      <span className="mr-1.5 rounded-sm bg-white/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white">Démonstration</span>
      {kind === "boutique" ? "Boutique fictive : produits, prix et commandes ne sont pas réels." : "Agence fictive : biens, prix et visites ne sont pas réels."}
    </p>
  );
}
