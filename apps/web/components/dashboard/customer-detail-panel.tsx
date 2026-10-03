"use client";

import { useCallback, useEffect, useState } from "react";

// Doit rester synchronisée avec `packages/database/src/senegal-reference.ts`
// (source de vérité côté serveur, qui valide réellement la valeur) — dupliquée ici
// car ce composant "use client" ne peut pas importer `@yamacommerce/database`
// (dépend de Prisma, exécutable uniquement côté serveur).
const SENEGAL_REGIONS = [
  "Dakar",
  "Diourbel",
  "Fatick",
  "Kaffrine",
  "Kaolack",
  "Kédougou",
  "Kolda",
  "Louga",
  "Matam",
  "Saint-Louis",
  "Sédhiou",
  "Tambacounda",
  "Thiès",
  "Ziguinchor",
];

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  currency: string;
  createdAt: string;
}

interface Address {
  id: string;
  label: string | null;
  region: string;
  department: string | null;
  commune: string | null;
  neighborhood: string | null;
  street: string | null;
  isDefault: boolean;
}

interface CustomerDetail {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  customerGroup: string;
  loyaltyPoints: number;
  totalSpent: number;
  ordersCount: number;
  internalNotes: string | null;
  addresses: Address[];
  orders: Order[];
}

/** Fiche client — voir docs/08, étape 2 : coordonnées, notes internes, adresses,
 *  historique de commandes. Consomme `/api/customers/[id]` et
 *  `/api/customers/[id]/addresses`. */
export function CustomerDetailPanel({ customerId }: { customerId: string }) {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [region, setRegion] = useState(SENEGAL_REGIONS[0]);
  const [commune, setCommune] = useState("");
  const [street, setStreet] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/customers/${customerId}`);
    const data = (await response.json()) as { customer?: CustomerDetail };
    if (data.customer) {
      setCustomer(data.customer);
      setNotes(data.customer.internalNotes ?? "");
    }
  }, [customerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleSaveNotes() {
    const response = await fetch(`/api/customers/${customerId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ internalNotes: notes || null }),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setMessage(data.error ?? "Échec de l'enregistrement des notes.");
      return;
    }
    setMessage(null);
    await refresh();
  }

  async function handleAddAddress() {
    const response = await fetch(`/api/customers/${customerId}/addresses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ region, commune: commune || null, street: street || null }),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setMessage(data.error ?? "Échec de l'ajout de l'adresse.");
      return;
    }
    setCommune("");
    setStreet("");
    setShowAddressForm(false);
    setMessage(null);
    await refresh();
  }

  async function handleDeleteAddress(addressId: string) {
    const response = await fetch(`/api/customers/${customerId}/addresses/${addressId}`, { method: "DELETE" });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setMessage(data.error ?? "Échec de la suppression.");
      return;
    }
    await refresh();
  }

  if (!customer) {
    return <div role="status" aria-label="Chargement de la fiche client" className="space-y-4"><div className="yc-skeleton h-32 rounded-yc-lg" /><div className="yc-skeleton h-48 rounded-yc-lg" /></div>;
  }

  return (
    <div className="flex flex-col gap-4 ">
      {message && <p className="text-sm text-red-600">{message}</p>}

      <section className="rounded-yc-lg bg-white shadow-yc ring-1 ring-yc-ink/[0.06] border-0 p-4">
        <h2 className="text-base font-semibold text-yc-ink">
          {customer.firstName} {customer.lastName ?? ""}
        </h2>
        <p className="text-sm text-yc-ink-soft">
          {[customer.phone, customer.email].filter(Boolean).join(" · ") || "Aucune coordonnée"}
        </p>
        <dl className="mt-3 grid grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-yc-ink-soft">Groupe</dt>
            <dd className="font-medium text-yc-ink">{customer.customerGroup}</dd>
          </div>
          <div>
            <dt className="text-yc-ink-soft">Commandes</dt>
            <dd className="font-medium text-yc-ink">{customer.ordersCount}</dd>
          </div>
          <div>
            <dt className="text-yc-ink-soft">Total dépensé</dt>
            <dd className="font-medium text-yc-ink">{customer.totalSpent.toLocaleString("fr-FR")} FCFA</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-yc-lg bg-white shadow-yc ring-1 ring-yc-ink/[0.06] border-0 p-4">
        <h3 className="mb-2 text-sm font-semibold text-yc-ink">Notes internes</h3>
        <p className="mb-2 text-xs text-yc-ink-soft">Visibles uniquement par votre équipe, jamais par le client.</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-yc-ink/15 focus:outline-none focus:ring-2 focus:ring-yc-electric/60 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void handleSaveNotes()}
          className="mt-2 rounded-xl bg-yc-night-900 shadow-[0_10px_24px_-12px_rgb(10_16_42/0.8)] px-4 py-1.5 text-sm font-medium text-white hover:bg-yc-night-800"
        >
          Enregistrer
        </button>
      </section>

      <section className="rounded-yc-lg bg-white shadow-yc ring-1 ring-yc-ink/[0.06] border-0 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-yc-ink">Adresses</h3>
          <button
            type="button"
            onClick={() => setShowAddressForm((v) => !v)}
            className="rounded-xl border border-yc-ink/15 focus:outline-none focus:ring-2 focus:ring-yc-electric/60 px-3 py-1 text-xs text-yc-ink/80 hover:bg-yc-ivory-50"
          >
            Ajouter une adresse
          </button>
        </div>

        {showAddressForm && (
          <div className="mb-3 flex flex-col gap-2 rounded-xl border border-yc-ink/10 p-3">
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="rounded-xl border border-yc-ink/15 focus:outline-none focus:ring-2 focus:ring-yc-electric/60 px-3 py-1.5 text-sm"
            >
              {SENEGAL_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={commune}
              onChange={(e) => setCommune(e.target.value)}
              placeholder="Commune"
              className="rounded-xl border border-yc-ink/15 focus:outline-none focus:ring-2 focus:ring-yc-electric/60 px-3 py-1.5 text-sm"
            />
            <input
              type="text"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="Rue / quartier"
              className="rounded-xl border border-yc-ink/15 focus:outline-none focus:ring-2 focus:ring-yc-electric/60 px-3 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => void handleAddAddress()}
              className="self-start rounded-xl bg-yc-night-900 shadow-[0_10px_24px_-12px_rgb(10_16_42/0.8)] px-4 py-1.5 text-sm font-medium text-white hover:bg-yc-night-800"
            >
              Ajouter
            </button>
          </div>
        )}

        <ul className="divide-y divide-yc-ink/[0.06]">
          {customer.addresses.length === 0 && <li className="py-2 text-sm text-yc-ink-soft">Aucune adresse enregistrée.</li>}
          {customer.addresses.map((address) => (
            <li key={address.id} className="flex items-center justify-between py-2">
              <p className="text-sm text-yc-ink">
                {[address.street, address.neighborhood, address.commune, address.region].filter(Boolean).join(", ")}
                {address.isDefault && <span className="ml-2 text-xs text-yc-electric">(par défaut)</span>}
              </p>
              <button
                type="button"
                onClick={() => void handleDeleteAddress(address.id)}
                className="rounded-xl border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-yc-lg bg-white shadow-yc ring-1 ring-yc-ink/[0.06] border-0 p-4">
        <h3 className="mb-2 text-sm font-semibold text-yc-ink">Historique des commandes</h3>
        <ul className="divide-y divide-yc-ink/[0.06]">
          {customer.orders.length === 0 && (
            <li className="py-2 text-sm text-yc-ink-soft">Aucune commande pour le moment.</li>
          )}
          {customer.orders.map((order) => (
            <li key={order.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-yc-ink">{order.orderNumber}</span>
              <span className="text-yc-ink-soft">{order.status}</span>
              <span className="text-yc-ink">
                {order.total.toLocaleString("fr-FR")} {order.currency}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
