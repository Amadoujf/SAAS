"use client";

import { useState } from "react";
import { Button } from "@/components/yc/button";
import { Feedback, section, useRestoAction } from "./shared";

export interface TableCard { id: string; label: string; seats: number; zone: string | null; isActive: boolean; url: string; qrSvg: string }

/** Tables de la salle et leurs QR codes (à imprimer et poser sur chaque table). */
export function TablesManager({ tables, canEdit, tenantName }: { tables: TableCard[]; canEdit: boolean; tenantName: string }) {
  const a = useRestoAction();
  const [f, setF] = useState({ label: "", seats: "4", zone: "" });
  const input = "h-10 w-full rounded-lg bg-white px-3 text-sm ring-1 ring-inset ring-yc-ink/12";
  return (
    <div className="grid gap-5">
      <style>{`@media print { body * { visibility: hidden !important; } .qr-print, .qr-print * { visibility: visible !important; } .qr-print { position: absolute; inset: 0; } .qr-card { break-inside: avoid; } }`}</style>
      {canEdit && (
        <section className={section} aria-labelledby="ajouter-table">
          <h2 id="ajouter-table" className="text-[18px] font-bold tracking-[-0.015em]">Ajouter une table</h2>
          <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_0.7fr_1.2fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); a.run({ action: "add_table", table: { label: f.label, seats: Number(f.seats), zone: f.zone || null } }, `Table ${f.label} ajoutée.`, () => setF({ label: "", seats: "4", zone: f.zone })); }}>
            <label className="grid gap-1.5 text-[13px] font-semibold">Nom ou numéro<input required maxLength={20} value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="12" className={input} /></label>
            <label className="grid gap-1.5 text-[13px] font-semibold">Places<input required type="number" min={1} max={40} value={f.seats} onChange={(e) => setF({ ...f, seats: e.target.value })} className={input} /></label>
            <label className="grid gap-1.5 text-[13px] font-semibold">Zone <span className="font-normal text-yc-ink-soft">(facultatif)</span><input maxLength={40} value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value })} placeholder="Terrasse" className={input} /></label>
            <Button type="submit" size="sm" variant="royal" loading={a.pending}>Ajouter</Button>
          </form>
        </section>
      )}
      <Feedback error={a.error} notice={a.notice} />
      {tables.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-yc-ink-soft">{tables.filter((t) => t.isActive).length} tables · {tables.filter((t) => t.isActive).reduce((s, t) => s + t.seats, 0)} places en salle</p>
          <Button type="button" size="sm" variant="secondary" onClick={() => window.print()}>Imprimer les QR codes</Button>
        </div>
      )}
      <ul className="qr-print grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tables.map((t) => (
          <li key={t.id} className={`qr-card rounded-xl bg-white p-5 text-center ring-1 ring-yc-ink/[0.08] ${t.isActive ? "" : "opacity-50"}`}>
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-yc-ink-soft">{tenantName}</p>
            <p className="mt-1 text-[30px] font-extrabold leading-none">Table {t.label}</p>
            <div className="mx-auto mt-4 w-44 [&_svg]:h-auto [&_svg]:w-full" role="img" aria-label={`QR code de la table ${t.label}`} dangerouslySetInnerHTML={{ __html: t.qrSvg }} />
            <p className="mt-3 text-[13px] font-semibold">Scannez pour commander</p>
            <p className="text-xs text-yc-ink-soft">{t.seats} places{t.zone ? ` · ${t.zone}` : ""}</p>
            {canEdit && (
              <div className="mt-4 flex flex-wrap justify-center gap-2 border-t border-yc-ink/[0.06] pt-3 print:hidden">
                <a href={t.url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-yc-electric hover:underline">Tester</a>
                <button type="button" onClick={() => { const n = window.prompt("Nombre de places :", String(t.seats)); if (n && Number(n) > 0) a.run({ action: "edit_table", tableId: t.id, table: { seats: Math.round(Number(n)) } }, "Table modifiée."); }} className="text-xs font-semibold text-yc-electric hover:underline">Places</button>
                <button type="button" onClick={() => { if (window.confirm("Nouveau QR code ? L'ancien ne fonctionnera plus : réimprimez celui-ci.")) a.run({ action: "table_qr", tableId: t.id }, `Nouveau QR code pour la table ${t.label}.`); }} className="text-xs font-semibold text-yc-electric hover:underline">Nouveau QR</button>
                <button type="button" onClick={() => a.run({ action: "edit_table", tableId: t.id, table: { isActive: !t.isActive } }, t.isActive ? "Table retirée de la salle." : "Table remise en salle.")} className="text-xs font-semibold text-yc-ink-soft hover:underline">{t.isActive ? "Retirer" : "Remettre"}</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
