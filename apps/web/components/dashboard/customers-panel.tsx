"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface Customer {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  customerGroup: string;
  totalSpent: number;
  ordersCount: number;
  createdAt: string;
}

/** Liste des clients — voir docs/08, étape 2 (clients/panier/commandes/livraison).
 *  Consomme UNIQUEMENT `/api/customers`. Aucun gate de module (client = module
 *  core) : seule la permission `customers.view`/`customers.edit` compte, vérifiée
 *  côté serveur par `customer-pipeline.ts`. */
export function CustomersPanel() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const refresh = useCallback(async (searchValue: string) => {
    const query = searchValue.trim() ? `?search=${encodeURIComponent(searchValue.trim())}` : "";
    const response = await fetch(`/api/customers${query}`);
    const data = (await response.json()) as { customers?: Customer[] };
    setCustomers(data.customers ?? []);
  }, []);

  useEffect(() => {
    void refresh(search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    await refresh(search);
  }

  async function handleCreate() {
    if (!firstName.trim()) {
      setMessage("Le prénom est obligatoire.");
      return;
    }
    const response = await fetch("/api/customers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        firstName: firstName.trim(),
        lastName: lastName.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
      }),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setMessage(data.error ?? "Échec de la création.");
      return;
    }
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setMessage(null);
    setShowCreateForm(false);
    await refresh(search);
  }

  return (
    <div className="flex flex-col gap-4 ">
      <form onSubmit={handleSearch} className="flex flex-wrap gap-2" role="search">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (nom, téléphone, e-mail)"
          aria-label="Rechercher un client"
          className="h-11 min-w-0 basis-full flex-1 sm:basis-auto rounded-xl border border-yc-ink/15 focus:outline-none focus:ring-2 focus:ring-yc-electric/60 px-3 h-11 text-sm"
        />
        <button type="submit" className="rounded-xl border border-yc-ink/15 focus:outline-none focus:ring-2 focus:ring-yc-electric/60 px-4 h-11 text-sm text-yc-ink/80 hover:bg-yc-ivory-50">
          Rechercher
        </button>
        <button
          type="button"
          onClick={() => setShowCreateForm((v) => !v)}
          className="rounded-xl bg-yc-night-900 shadow-[0_10px_24px_-12px_rgb(10_16_42/0.8)] px-4 h-11 text-sm font-medium text-white hover:bg-yc-night-800"
        >
          Nouveau client
        </button>
      </form>

      {showCreateForm && (
        <div className="flex flex-col gap-2 rounded-yc-lg bg-white shadow-yc ring-1 ring-yc-ink/[0.06] border-0 p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Prénom *"
              aria-label="Prénom"
              className="rounded-xl border border-yc-ink/15 focus:outline-none focus:ring-2 focus:ring-yc-electric/60 px-3 h-11 text-sm"
            />
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Nom"
              aria-label="Nom"
              className="rounded-xl border border-yc-ink/15 focus:outline-none focus:ring-2 focus:ring-yc-electric/60 px-3 h-11 text-sm"
            />
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Téléphone (+221...)"
              aria-label="Téléphone"
              className="rounded-xl border border-yc-ink/15 focus:outline-none focus:ring-2 focus:ring-yc-electric/60 px-3 h-11 text-sm"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail"
              aria-label="E-mail"
              className="rounded-xl border border-yc-ink/15 focus:outline-none focus:ring-2 focus:ring-yc-electric/60 px-3 h-11 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleCreate()}
            className="self-start rounded-xl bg-yc-night-900 shadow-[0_10px_24px_-12px_rgb(10_16_42/0.8)] px-4 h-11 text-sm font-medium text-white hover:bg-yc-night-800"
          >
            Créer
          </button>
        </div>
      )}

      {message && <p className="text-sm text-red-600">{message}</p>}

      <ul className="divide-y divide-yc-ink/[0.06] rounded-yc-lg bg-white shadow-yc ring-1 ring-yc-ink/[0.06] border-0">
        {customers.length === 0 && <li className="p-4 text-sm text-yc-ink-soft">Aucun client pour le moment.</li>}
        {customers.map((customer) => (
          <li key={customer.id}>
            <Link
              href={`/dashboard/clients/${customer.id}`}
              className="yc-focus flex items-center justify-between gap-4 px-4 py-3 hover:bg-yc-ivory-50"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-yc-ink">
                  {customer.firstName} {customer.lastName ?? ""}
                </p>
                <p className="truncate text-sm text-yc-ink-soft">
                  {[customer.phone, customer.email].filter(Boolean).join(" · ") || "Aucune coordonnée"}
                </p>
              </div>
              <div className="shrink-0 text-right text-sm text-yc-ink-soft">
                <p>{customer.ordersCount} commande(s)</p>
                <p className="font-semibold text-yc-ink tabular-nums">{customer.totalSpent.toLocaleString("fr-FR")} FCFA</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
