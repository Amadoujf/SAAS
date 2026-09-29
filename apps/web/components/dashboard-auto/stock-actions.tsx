"use client";

import { useRouter } from "next/navigation";
import { useAutoAction, Feedback } from "./shared";

/** Gestes rapides sur une ligne du stock : publier, arrivé / en arrivage, retirer. */
export function StockActions({ listingId, published, stockStatus, canPublish, canEdit, canDelete, compact = false }: { listingId: string; published: boolean; stockStatus: string; canPublish: boolean; canEdit: boolean; canDelete?: boolean; compact?: boolean }) {
  const a = useAutoAction();
  const router = useRouter();
  const btn = "rounded-lg px-3 py-1.5 text-[13px] font-semibold ring-1 ring-inset ring-yc-ink/12 hover:bg-yc-ivory-50 disabled:opacity-50";
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {canPublish && <button type="button" disabled={a.pending} className={btn} onClick={() => a.run({ action: "publish", listingId, publish: !published }, published ? "Retiré du site." : "Publié sur le site.")}>{published ? "Retirer du site" : "Publier"}</button>}
        {canEdit && stockStatus === "incoming" && <button type="button" disabled={a.pending} className={btn} onClick={() => a.run({ action: "arrival", listingId, stockStatus: "available" }, "Véhicule arrivé : ouvert à l'essai.")}>Marquer arrivé</button>}
        {canEdit && stockStatus === "available" && !compact && <button type="button" disabled={a.pending} className={btn} onClick={() => a.run({ action: "arrival", listingId, stockStatus: "incoming" }, "Passé en arrivage.")}>Passer en arrivage</button>}
        {canDelete && stockStatus !== "reserved" && !compact && (
          <button type="button" disabled={a.pending} className={`${btn} text-yc-danger`} onClick={() => window.confirm("Retirer définitivement ce véhicule du stock ? Son historique est conservé.") && a.run({ action: "delete_vehicle", listingId }, "Véhicule retiré.", () => router.push("/dashboard/vehicules"))}>Retirer du stock</button>
        )}
      </div>
      <Feedback error={a.error} notice={a.notice} />
    </div>
  );
}
