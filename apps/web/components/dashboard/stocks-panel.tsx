"use client";

import { useCallback, useEffect, useState } from "react";

interface InventoryRow {
  id: string;
  availableQuantity: number;
  lowStockThreshold: number;
  shop: { id: string; name: string };
  variant: { id: string; name: string; product: { id: string; name: string } };
}

interface StockMovement {
  id: string;
  type: string;
  quantity: number;
  reason: string | null;
  createdAt: string;
}

const MOVEMENT_LABELS: Record<string, string> = {
  in: "Entrée",
  out: "Sortie",
  adjustment: "Ajustement",
  transfer: "Transfert",
  return: "Retour",
};

/** Vue d'ensemble du stock — voir docs/08 §8.2, `/dashboard/stocks` : historique des
 *  mouvements, alertes de stock bas, ajustement manuel. Consomme UNIQUEMENT
 *  `/api/catalog/inventory/*`. */
export function StocksPanel() {
  const [items, setItems] = useState<InventoryRow[]>([]);
  const [selected, setSelected] = useState<InventoryRow | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [adjustType, setAdjustType] = useState<"in" | "out" | "adjustment">("in");
  const [adjustQuantity, setAdjustQuantity] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/catalog/inventory/all");
    const data = (await response.json()) as { items?: InventoryRow[] };
    setItems(data.items ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function selectItem(item: InventoryRow) {
    setSelected(item);
    setMessage(null);
    const response = await fetch(`/api/catalog/inventory/${item.id}/movements`);
    const data = (await response.json()) as { movements?: StockMovement[] };
    setMovements(data.movements ?? []);
  }

  async function handleAdjust() {
    if (!selected) return;
    const quantity = Number(adjustQuantity);
    if (!quantity || quantity <= 0) {
      setMessage("Indiquez une quantité positive.");
      return;
    }
    const response = await fetch(`/api/catalog/inventory/${selected.id}/adjust`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: adjustType, quantity, reason: adjustReason || null }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "Échec de l'ajustement.");
      return;
    }
    setAdjustQuantity("");
    setAdjustReason("");
    setMessage(null);
    await refresh();
    await selectItem(selected);
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="rounded-yc-lg bg-white shadow-yc ring-1 ring-yc-ink/[0.06] border-0">
        <ul className="divide-y divide-yc-ink/[0.06]">
          {items.length === 0 && <li className="p-4 text-sm text-yc-ink-soft">Aucun stock enregistré pour le moment.</li>}
          {items.map((item) => {
            const low = item.availableQuantity <= item.lowStockThreshold;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => void selectItem(item)}
                  className={`flex w-full items-center justify-between px-4 py-3 text-left hover:bg-yc-ivory-50 ${
                    selected?.id === item.id ? "bg-yc-ivory-50" : ""
                  }`}
                >
                  <div>
                    <p className="font-medium text-yc-ink">{item.variant.product.name}</p>
                    <p className="text-sm text-yc-ink-soft">
                      {item.variant.name} · {item.shop.name}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      low ? "bg-red-100 text-red-800" : "bg-yc-ivory-100 text-yc-ink/80"
                    }`}
                  >
                    {item.availableQuantity} en stock
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-yc-lg bg-white shadow-yc ring-1 ring-yc-ink/[0.06] border-0 p-4">
        {!selected ? (
          <p className="text-sm text-yc-ink-soft">Sélectionnez un item pour voir son historique et l&apos;ajuster.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-yc-ink">{selected.variant.product.name}</h2>
              <p className="text-sm text-yc-ink-soft">
                {selected.variant.name} · {selected.shop.name} · seuil d&apos;alerte : {selected.lowStockThreshold}
              </p>
            </div>

            <div className="flex flex-col gap-2 border-t border-yc-ink/10 pt-3">
              <label className="text-sm font-medium text-yc-ink/80">Ajuster le stock</label>
              <div className="flex flex-wrap gap-2">
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as typeof adjustType)}
                  className="rounded-xl border border-yc-ink/15 focus:outline-none focus:ring-2 focus:ring-yc-electric/60 px-2 py-1.5 text-sm"
                >
                  <option value="in">Entrée</option>
                  <option value="out">Sortie</option>
                  <option value="adjustment">Ajustement</option>
                </select>
                <input
                  type="number"
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(e.target.value)}
                  placeholder="Quantité"
                  className="w-24 rounded-xl border border-yc-ink/15 focus:outline-none focus:ring-2 focus:ring-yc-electric/60 px-2 py-1.5 text-sm"
                />
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Raison (optionnel)"
                  className="flex-1 rounded-xl border border-yc-ink/15 focus:outline-none focus:ring-2 focus:ring-yc-electric/60 px-2 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void handleAdjust()}
                  className="rounded-xl bg-yc-night-900 shadow-[0_10px_24px_-12px_rgb(10_16_42/0.8)] px-3 py-1.5 text-sm font-medium text-white hover:bg-yc-night-800"
                >
                  Appliquer
                </button>
              </div>
              {message && <p className="text-sm text-red-600">{message}</p>}
            </div>

            <div className="border-t border-yc-ink/10 pt-3">
              <h3 className="mb-2 text-sm font-medium text-yc-ink/80">Historique des mouvements</h3>
              <ul className="space-y-1 text-xs text-yc-ink/80">
                {movements.length === 0 && <li>Aucun mouvement.</li>}
                {movements.map((movement) => (
                  <li key={movement.id} className="rounded-xl bg-yc-ivory-50 px-2 py-1">
                    {new Date(movement.createdAt).toLocaleString("fr-FR")} — {MOVEMENT_LABELS[movement.type] ?? movement.type} :{" "}
                    {movement.quantity}
                    {movement.reason ? ` (${movement.reason})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
