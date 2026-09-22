"use client";

import { useCallback, useEffect, useState } from "react";

/** Panneau Super Admin des formules SaaS — voir docs/14-facturation-saas-
 *  abonnements.md. Consomme UNIQUEMENT `/api/admin/billing/plans*`. */

interface Plan {
  id: string;
  name: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  currency: string;
  priceMonthly: number;
  priceYearly: number;
  maxProducts: number;
  maxEmployees: number;
  maxShops: number;
  storageMB: number;
  maxCustomDomains: number;
  chariowMonthlyProductId: string | null;
  chariowYearlyProductId: string | null;
  renewalMode: "MANUAL" | "AUTOMATIC";
}

const STATUS_BADGE_CLASS: Record<Plan["status"], string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PUBLISHED: "bg-green-100 text-green-800",
  ARCHIVED: "bg-gray-200 text-gray-500",
};

const EMPTY_FORM = {
  name: "",
  priceMonthly: 0,
  priceYearly: 0,
  maxProducts: 0,
  maxEmployees: 0,
  maxShops: 1,
  storageMB: 1024,
  maxCustomDomains: 1,
  maxAIGenerationsPerMonth: 0,
  maxAIImagesAnalyzedPerMonth: 0,
  maxAIProductsImportedPerMonth: 0,
};

export function AdminPlansPanel() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, { chariowMonthlyProductId: string; chariowYearlyProductId: string }>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/billing/plans");
      const data = (await response.json()) as { plans: Plan[] };
      setPlans(data.plans ?? []);
      setEditing(
        Object.fromEntries(
          (data.plans ?? []).map((plan) => [
            plan.id,
            { chariowMonthlyProductId: plan.chariowMonthlyProductId ?? "", chariowYearlyProductId: plan.chariowYearlyProductId ?? "" },
          ]),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleCreate() {
    if (!form.name.trim()) {
      setMessage("Le nom est obligatoire.");
      return;
    }
    const response = await fetch("/api/admin/billing/plans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "Échec de la création.");
      return;
    }
    setMessage("Formule créée en brouillon.");
    setForm(EMPTY_FORM);
    setShowCreateForm(false);
    await refresh();
  }

  async function updateStatus(plan: Plan, status: Plan["status"]) {
    const response = await fetch(`/api/admin/billing/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "Échec de la mise à jour.");
      return;
    }
    await refresh();
  }

  async function saveChariowMapping(plan: Plan) {
    const values = editing[plan.id];
    if (!values) return;
    const response = await fetch(`/api/admin/billing/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chariowMonthlyProductId: values.chariowMonthlyProductId.trim() || null,
        chariowYearlyProductId: values.chariowYearlyProductId.trim() || null,
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "Échec de l'enregistrement du mapping Chariow.");
      return;
    }
    setMessage(`Mapping Chariow enregistré pour "${plan.name}".`);
    await refresh();
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Formules</h2>
        <button
          type="button"
          onClick={() => setShowCreateForm((v) => !v)}
          className="rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Nouvelle formule
        </button>
      </div>

      {message && <p className="text-sm text-gray-700">{message}</p>}
      {loading && <p className="text-sm text-gray-500">Chargement…</p>}

      {showCreateForm && (
        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Nom de la formule *"
              className="col-span-2 rounded border border-gray-300 px-3 py-1.5 text-sm sm:col-span-1"
            />
            <input
              type="number"
              value={form.priceMonthly}
              onChange={(e) => setForm((f) => ({ ...f, priceMonthly: Number(e.target.value) }))}
              placeholder="Prix mensuel (XOF)"
              className="rounded border border-gray-300 px-3 py-1.5 text-sm"
            />
            <input
              type="number"
              value={form.priceYearly}
              onChange={(e) => setForm((f) => ({ ...f, priceYearly: Number(e.target.value) }))}
              placeholder="Prix annuel (XOF)"
              className="rounded border border-gray-300 px-3 py-1.5 text-sm"
            />
            <input
              type="number"
              value={form.maxProducts}
              onChange={(e) => setForm((f) => ({ ...f, maxProducts: Number(e.target.value) }))}
              placeholder="Max produits"
              className="rounded border border-gray-300 px-3 py-1.5 text-sm"
            />
            <input
              type="number"
              value={form.maxEmployees}
              onChange={(e) => setForm((f) => ({ ...f, maxEmployees: Number(e.target.value) }))}
              placeholder="Max employés"
              className="rounded border border-gray-300 px-3 py-1.5 text-sm"
            />
            <input
              type="number"
              value={form.maxCustomDomains}
              onChange={(e) => setForm((f) => ({ ...f, maxCustomDomains: Number(e.target.value) }))}
              placeholder="Max domaines"
              className="rounded border border-gray-300 px-3 py-1.5 text-sm"
            />
            <input
              type="number"
              value={form.storageMB}
              onChange={(e) => setForm((f) => ({ ...f, storageMB: Number(e.target.value) }))}
              placeholder="Stockage (Mo)"
              className="rounded border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleCreate()}
            className="self-start rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Créer (en brouillon)
          </button>
        </div>
      )}

      <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
        {plans.length === 0 && !loading && <li className="p-4 text-sm text-gray-500">Aucune formule pour le moment.</li>}
        {plans.map((plan) => (
          <li key={plan.id} className="flex flex-col gap-2 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{plan.name}</p>
                <p className="text-sm text-gray-500">
                  {plan.priceMonthly.toLocaleString("fr-FR")} / {plan.priceYearly.toLocaleString("fr-FR")} {plan.currency} ·{" "}
                  {plan.maxProducts} produits · {plan.maxEmployees} employés · {plan.maxCustomDomains} domaine(s)
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[plan.status]}`}>{plan.status}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={editing[plan.id]?.chariowMonthlyProductId ?? ""}
                onChange={(e) =>
                  setEditing((prev) => ({ ...prev, [plan.id]: { ...prev[plan.id]!, chariowMonthlyProductId: e.target.value } }))
                }
                placeholder="ID produit Chariow (mensuel)"
                className="rounded border border-gray-300 px-2 py-1 text-xs"
              />
              <input
                type="text"
                value={editing[plan.id]?.chariowYearlyProductId ?? ""}
                onChange={(e) =>
                  setEditing((prev) => ({ ...prev, [plan.id]: { ...prev[plan.id]!, chariowYearlyProductId: e.target.value } }))
                }
                placeholder="ID produit Chariow (annuel)"
                className="rounded border border-gray-300 px-2 py-1 text-xs"
              />
              <button
                type="button"
                onClick={() => void saveChariowMapping(plan)}
                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
              >
                Enregistrer le mapping
              </button>

              <div className="ml-auto flex gap-2">
                {plan.status !== "PUBLISHED" && (
                  <button
                    type="button"
                    onClick={() => void updateStatus(plan, "PUBLISHED")}
                    className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700"
                  >
                    Publier
                  </button>
                )}
                {plan.status !== "ARCHIVED" && (
                  <button
                    type="button"
                    onClick={() => void updateStatus(plan, "ARCHIVED")}
                    className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    Archiver
                  </button>
                )}
                {plan.status !== "DRAFT" && (
                  <button
                    type="button"
                    onClick={() => void updateStatus(plan, "DRAFT")}
                    className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    Repasser en brouillon
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
