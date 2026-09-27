"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/yc/button";
import { postRealEstate } from "./property-editor";

type Status = "confirmed" | "completed" | "canceled" | "no_show";

/** Actions sur une demande de visite, selon son statut et les droits du membre. */
export function VisitActions({ reservationId, status, past, canUpdate, canCancel }: { reservationId: string; status: string; past: boolean; canUpdate: boolean; canCancel: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const act = (to: Status) => {
    if (to === "canceled" && !window.confirm("Annuler cette visite ?")) return;
    setError(null);
    start(async () => {
      try {
        await postRealEstate({ action: "visit_status", reservationId, status: to });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action impossible.");
      }
    });
  };
  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        {canUpdate && status === "requested" && <Button size="sm" variant="royal" loading={pending} onClick={() => act("confirmed")}>Confirmer</Button>}
        {canUpdate && status === "confirmed" && past && <Button size="sm" variant="secondary" loading={pending} onClick={() => act("completed")}>Visite effectuée</Button>}
        {canUpdate && status === "confirmed" && past && <Button size="sm" variant="ghost" loading={pending} onClick={() => act("no_show")}>Absent</Button>}
        {canCancel && (status === "requested" || status === "confirmed") && <Button size="sm" variant="danger" loading={pending} onClick={() => act("canceled")}>Annuler</Button>}
      </div>
      {error && <p role="alert" className="text-xs font-medium text-yc-danger">{error}</p>}
    </div>
  );
}
