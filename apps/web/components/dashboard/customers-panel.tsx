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
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (nom, téléphone, e-mail)"
          className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm"
        />
        <button type="submit" className="rounded border border-gray-300 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
          Rechercher
        </button>
        <button
          type="button"
          onClick={() => setShowCreateForm((v) => !v)}
          className="rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Nouveau client
        </button>
      </form>

      {showCreateForm && (
        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Prénom *"
              className="rounded border border-gray-300 px-3 py-1.5 text-sm"
            />
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Nom"
              className="rounded border border-gray-300 px-3 py-1.5 text-sm"
            />
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Téléphone (+221...)"
              className="rounded border border-gray-300 px-3 py-1.5 text-sm"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail"
              className="rounded border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleCreate()}
            className="self-start rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Créer
          </button>
        </div>
      )}

      {message && <p className="text-sm text-red-600">{message}</p>}

      <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
        {customers.length === 0 && <li className="p-4 text-sm text-gray-500">Aucun client pour le moment.</li>}
        {customers.map((customer) => (
          <li key={customer.id}>
            <Link
              href={`/dashboard/clients/${customer.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
            >
              <div>
                <p className="font-medium text-gray-900">
                  {customer.firstName} {customer.lastName ?? ""}
                </p>
                <p className="text-sm text-gray-500">
                  {[customer.phone, customer.email].filter(Boolean).join(" · ") || "Aucune coordonnée"}
                </p>
              </div>
              <div className="text-right text-sm text-gray-500">
                <p>{customer.ordersCount} commande(s)</p>
                <p>{customer.totalSpent.toLocaleString("fr-FR")} FCFA dépensés</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
