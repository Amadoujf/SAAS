"use client";

import Link from "next/link";
import { KITCHEN_LABELS, MODE_LABELS, NEXT_STATUS } from "@/lib/restaurant/labels";
import { Elapsed, Feedback, useRestoAction } from "./shared";

export interface KitchenTicket {
  id: string;
  number: string;
  status: string;
  mode: string;
  table: string | null;
  customerName: string;
  createdAt: string;
  /** Heure souhaitée, déjà formatée dans le fuseau du restaurant. */
  requestedFor: string | null;
  note: string | null;
  items: { id: string; quantity: number; name: string; options: string; note: string | null }[];
}

const COLUMNS = [
  { key: "new", title: "Nouvelles", statuses: ["new"], tone: "bg-[#FFF3DC] ring-[#EBA93A]" },
  { key: "kitchen", title: "En cuisine", statuses: ["accepted", "preparing"], tone: "bg-[#EEF3FF] ring-[#5B7FE0]" },
  { key: "ready", title: "Prêtes", statuses: ["ready"], tone: "bg-[#E8F6EF] ring-[#3FA176]" },
];

/**
 * Écran de la cuisine : trois colonnes, un geste par étape. Les plus anciennes en
 * premier ; au-delà de 20 min l'attente passe en orange.
 */
export function KitchenBoard({ tickets, canMove, canCancel }: { tickets: KitchenTicket[]; canMove: boolean; canCancel: boolean }) {
  const a = useRestoAction();
  return (
    <div>
      <Feedback error={a.error} notice={a.notice} />
      <div className="mt-2 grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const list = tickets.filter((t) => col.statuses.includes(t.status));
          return (
            <section key={col.key} aria-labelledby={`col-${col.key}`} className="min-w-0">
              <h2 id={`col-${col.key}`} className="mb-3 flex items-center gap-2 text-[15px] font-bold">
                {col.title}
                <span className="yc-num rounded-full bg-yc-ink/[0.07] px-2 py-0.5 text-[12px]">{list.length}</span>
              </h2>
              {list.length === 0 ? (
                <p className="rounded-xl border border-dashed border-yc-ink/15 px-4 py-8 text-center text-sm text-yc-ink-soft">Rien pour le moment</p>
              ) : (
                <ul className="grid gap-3">
                  {list.map((t) => {
                    const next = NEXT_STATUS[t.status];
                    return (
                      <li key={t.id} className={`rounded-xl p-4 ring-1 ring-inset ${col.tone}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link href={`/dashboard/ventes/${t.id}`} className="yc-num text-[22px] font-extrabold leading-none hover:underline">n° {t.number.split("-")[1]}</Link>
                            <p className="mt-1 text-[13px] font-semibold">
                              {t.table ? `Table ${t.table}` : MODE_LABELS[t.mode]?.label}
                              <span className="font-normal text-yc-ink-soft"> · {t.customerName}</span>
                            </p>
                          </div>
                          <div className="text-right text-[12px]">
                            <Elapsed since={t.createdAt} />
                            {t.requestedFor && <p className="mt-0.5 font-bold text-yc-royal">Pour {t.requestedFor}</p>}
                          </div>
                        </div>
                        <ul className="mt-3 grid gap-1.5 rounded-lg bg-white/80 p-3 text-[14px]">
                          {t.items.map((i) => (
                            <li key={i.id}>
                              <span className="yc-num font-extrabold">{i.quantity} ×</span> <span className="font-semibold">{i.name}</span>
                              {i.options && <span className="block pl-6 text-[12.5px] text-yc-ink-soft">{i.options}</span>}
                              {i.note && <span className="block pl-6 text-[12.5px] font-semibold text-[#B45309]">« {i.note} »</span>}
                            </li>
                          ))}
                        </ul>
                        {t.note && <p className="mt-2 text-[12.5px] italic">Note : {t.note}</p>}
                        {(canMove || canCancel) && (
                          <div className="mt-3 flex items-center gap-2">
                            {canMove && next && (
                              <button type="button" disabled={a.pending} onClick={() => a.run({ action: "order_status", orderId: t.id, to: next }, `Commande n° ${t.number.split("-")[1]} : ${KITCHEN_LABELS[next]?.label.toLowerCase()}.`)} className="h-11 flex-1 rounded-lg bg-yc-ink text-[14px] font-bold text-white disabled:opacity-60">
                                {KITCHEN_LABELS[t.status]?.action}
                              </button>
                            )}
                            {canCancel && (
                              <button
                                type="button"
                                disabled={a.pending}
                                onClick={() => {
                                  const reason = window.prompt("Motif de l'annulation (visible par le client) :", "Plat indisponible");
                                  if (reason) a.run({ action: "order_status", orderId: t.id, to: "canceled", note: reason }, "Commande annulée.");
                                }}
                                className="h-11 rounded-lg bg-white/70 px-3 text-[13px] font-semibold text-yc-danger ring-1 ring-inset ring-yc-ink/10"
                              >
                                Annuler
                              </button>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
