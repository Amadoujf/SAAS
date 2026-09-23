"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Panneau Super Admin des abonnements SaaS — voir docs/14-facturation-saas-
 * abonnements.md. Consomme UNIQUEMENT les routes `/api/admin/billing/*`, déjà
 * protégées par `requireSuperAdmin()` — même règle que `admin-domains-panel.tsx`
 * (jamais un import direct de `@yamacommerce/database` ici).
 */

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente de paiement",
  TRIALING: "Essai gratuit",
  ACTIVE: "Actif",
  GRACE_PERIOD: "Période de grâce",
  PAST_DUE: "Paiement en retard",
  SUSPENDED: "Suspendu",
  CANCELED: "Annulé",
  EXPIRED: "Expiré",
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  TRIALING: "bg-blue-100 text-blue-800",
  GRACE_PERIOD: "bg-amber-100 text-amber-800",
  PAST_DUE: "bg-amber-100 text-amber-800",
  SUSPENDED: "bg-red-100 text-red-800",
  CANCELED: "bg-gray-200 text-gray-600",
  EXPIRED: "bg-gray-200 text-gray-600",
  PENDING: "bg-gray-100 text-gray-700",
};

interface SubscriptionTenant {
  id: string;
  name: string;
  slug: string;
}

interface SubscriptionListItem {
  id: string;
  status: string;
  billingCycle: string;
  currentPeriodEnd: string;
  tenant: SubscriptionTenant;
  plan: { id: string; name: string };
}

interface SubscriptionPayment {
  id: string;
  provider: string;
  providerSaleId: string | null;
  amountXOF: number;
  currency: string;
  status: string;
  createdAt: string;
  confirmedAt: string | null;
}

interface SubscriptionEvent {
  id: string;
  type: string;
  actorType: string;
  actorUserId: string | null;
  justification: string | null;
  createdAt: string;
}

interface SubscriptionDetail extends SubscriptionListItem {
  tenant: SubscriptionTenant & { status: string };
  plan: { id: string; name: string; priceMonthly: number; priceYearly: number };
  graceEndsAt: string | null;
  suspendedAt: string | null;
  canceledAt: string | null;
  payments: SubscriptionPayment[];
  events: SubscriptionEvent[];
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = (await response.json()) as T;
  if (!response.ok) throw new Error((data as { error?: string })?.error ?? "Une erreur est survenue.");
  return data;
}

export function AdminSubscriptionsPanel() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [subscriptions, setSubscriptions] = useState<SubscriptionListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SubscriptionDetail | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [justification, setJustification] = useState("");
  const [extendAmount, setExtendAmount] = useState("");
  const [extendCycle, setExtendCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [reconciling, setReconciling] = useState(false);
  const [stats, setStats] = useState<{ mrrXOF: number; arrXOF: number; activeSubscriptions: number; churnRate30dPercent: number } | null>(null);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/admin/billing/stats");
      if (response.ok) setStats(await response.json());
    })();
  }, []);

  const search = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      if (statusFilter) params.set("status", statusFilter);
      const response = await fetch(`/api/admin/billing/subscriptions?${params.toString()}`);
      const data = (await response.json()) as { subscriptions: SubscriptionListItem[] };
      setSubscriptions(data.subscriptions ?? []);
    } finally {
      setLoading(false);
    }
  }, [query, statusFilter]);

  useEffect(() => {
    void search();
  }, [search]);

  const loadDetail = useCallback(async (id: string) => {
    const response = await fetch(`/api/admin/billing/subscriptions/${id}`);
    const data = (await response.json()) as { subscription: SubscriptionDetail };
    setDetail(data.subscription ?? null);
  }, []);

  async function selectSubscription(id: string) {
    setSelectedId(id);
    setActionMessage(null);
    setJustification("");
    await loadDetail(id);
  }

  async function refreshSelected() {
    if (!selectedId) return;
    await loadDetail(selectedId);
    await search();
  }

  function requireJustification(): boolean {
    if (justification.trim().length < 10) {
      setActionMessage("La justification doit contenir au moins 10 caractères.");
      return false;
    }
    return true;
  }

  async function handleSuspend() {
    if (!selectedId || !requireJustification()) return;
    try {
      await postJson(`/api/admin/billing/subscriptions/${selectedId}/suspend`, { justification });
      setActionMessage("Abonnement suspendu.");
      setJustification("");
      await refreshSelected();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Échec de la suspension.");
    }
  }

  async function handleReactivate() {
    if (!selectedId || !requireJustification()) return;
    try {
      await postJson(`/api/admin/billing/subscriptions/${selectedId}/reactivate`, { justification });
      setActionMessage("Abonnement réactivé sans prolongation de période.");
      setJustification("");
      await refreshSelected();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Échec de la réactivation.");
    }
  }

  async function handleExtend() {
    if (!selectedId || !detail || !requireJustification()) return;
    const amountXOF = Number(extendAmount);
    if (!Number.isFinite(amountXOF) || amountXOF < 0) {
      setActionMessage("Montant invalide.");
      return;
    }
    try {
      await postJson(`/api/admin/billing/subscriptions/${selectedId}/extend`, {
        planId: detail.plan.id,
        billingCycle: extendCycle,
        amountXOF,
        justification,
      });
      setActionMessage("Abonnement prolongé manuellement.");
      setJustification("");
      setExtendAmount("");
      await refreshSelected();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Échec de la prolongation.");
    }
  }

  async function handleReconcile() {
    setReconciling(true);
    try {
      const result = await postJson<{ lifecycle: { gracePeriodStarted: number; suspended: number }; expiredSessions: number }>(
        "/api/admin/billing/reconcile",
        {},
      );
      setActionMessage(
        `Rapprochement effectué — grâce démarrée: ${result.lifecycle.gracePeriodStarted}, suspendus: ${result.lifecycle.suspended}, sessions expirées: ${result.expiredSessions}.`,
      );
      await search();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Échec du rapprochement.");
    } finally {
      setReconciling(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4">
      {stats && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500">MRR</p>
            <p className="text-lg font-semibold text-gray-900">{stats.mrrXOF.toLocaleString("fr-FR")} XOF</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500">ARR</p>
            <p className="text-lg font-semibold text-gray-900">{stats.arrXOF.toLocaleString("fr-FR")} XOF</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500">Abonnements actifs</p>
            <p className="text-lg font-semibold text-gray-900">{stats.activeSubscriptions}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500">Churn (30j)</p>
            <p className="text-lg font-semibold text-gray-900">{stats.churnRate30dPercent}%</p>
          </div>
        </section>
      )}

      <section className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Rechercher (nom d&apos;entreprise)
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ex. Boutique Fatou"
            className="rounded border border-gray-300 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Statut
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="">Tous</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {loading && <span className="text-sm text-gray-500">Recherche…</span>}
        <button
          type="button"
          disabled={reconciling}
          onClick={() => void handleReconcile()}
          className="ml-auto rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {reconciling ? "Rapprochement…" : "Forcer le rapprochement"}
        </button>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white">
          <ul className="divide-y divide-gray-200">
            {subscriptions.length === 0 && !loading && (
              <li className="p-4 text-sm text-gray-500">Aucun abonnement ne correspond à cette recherche.</li>
            )}
            {subscriptions.map((sub) => (
              <li key={sub.id}>
                <button
                  type="button"
                  onClick={() => void selectSubscription(sub.id)}
                  className={`flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 ${
                    selectedId === sub.id ? "bg-gray-50" : ""
                  }`}
                >
                  <div>
                    <p className="font-medium text-gray-900">{sub.tenant.name}</p>
                    <p className="text-sm text-gray-500">
                      {sub.plan.name} · échéance {formatDate(sub.currentPeriodEnd)}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[sub.status] ?? "bg-gray-100 text-gray-700"}`}>
                    {STATUS_LABELS[sub.status] ?? sub.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4">
          {!detail ? (
            <p className="text-sm text-gray-500">Sélectionnez un abonnement pour voir le détail.</p>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{detail.tenant.name}</h2>
                <p className="text-sm text-gray-500">
                  {detail.plan.name} · {detail.billingCycle === "YEARLY" ? "annuel" : "mensuel"} · tenant {detail.tenant.status}
                </p>
                <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[detail.status] ?? "bg-gray-100 text-gray-700"}`}>
                  {STATUS_LABELS[detail.status] ?? detail.status}
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-gray-500">Échéance</dt>
                <dd className="text-gray-900">{formatDate(detail.currentPeriodEnd)}</dd>
                <dt className="text-gray-500">Fin de grâce</dt>
                <dd className="text-gray-900">{formatDate(detail.graceEndsAt)}</dd>
                <dt className="text-gray-500">Suspendu le</dt>
                <dd className="text-gray-900">{formatDate(detail.suspendedAt)}</dd>
                <dt className="text-gray-500">Annulé le</dt>
                <dd className="text-gray-900">{formatDate(detail.canceledAt)}</dd>
              </dl>

              <div className="flex flex-col gap-2 border-t border-gray-200 pt-3">
                <label className="text-sm font-medium text-gray-700">Justification (obligatoire, min. 10 caractères)</label>
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  rows={2}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm"
                  placeholder="ex. virement reçu le 20/09, référence banque #5678"
                />

                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col gap-1 text-xs text-gray-600">
                    Montant reçu (XOF)
                    <input
                      type="number"
                      value={extendAmount}
                      onChange={(e) => setExtendAmount(e.target.value)}
                      className="w-28 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-gray-600">
                    Cycle
                    <select
                      value={extendCycle}
                      onChange={(e) => setExtendCycle(e.target.value as "MONTHLY" | "YEARLY")}
                      className="rounded border border-gray-300 px-2 py-1 text-sm"
                    >
                      <option value="MONTHLY">Mensuel</option>
                      <option value="YEARLY">Annuel</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleExtend()}
                    className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
                  >
                    Prolonger manuellement
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {detail.status !== "SUSPENDED" && (
                    <button
                      type="button"
                      onClick={() => void handleSuspend()}
                      className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
                    >
                      Suspendre
                    </button>
                  )}
                  {detail.status !== "ACTIVE" && (
                    <button
                      type="button"
                      onClick={() => void handleReactivate()}
                      className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
                    >
                      Réactiver sans paiement
                    </button>
                  )}
                </div>
              </div>

              {actionMessage && <p className="text-sm text-gray-700">{actionMessage}</p>}

              <div className="border-t border-gray-200 pt-3">
                <h3 className="mb-2 text-sm font-medium text-gray-700">Paiements</h3>
                <ul className="space-y-1 text-xs text-gray-600">
                  {detail.payments.length === 0 && <li>Aucun paiement.</li>}
                  {detail.payments.map((payment) => (
                    <li key={payment.id} className="rounded bg-gray-50 px-2 py-1">
                      <span className="font-mono">{formatDate(payment.createdAt)}</span> — {payment.provider} —{" "}
                      {payment.amountXOF.toLocaleString("fr-FR")} {payment.currency} — {payment.status}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-gray-200 pt-3">
                <h3 className="mb-2 text-sm font-medium text-gray-700">Journal d&apos;événements</h3>
                <ul className="space-y-1 text-xs text-gray-600">
                  {detail.events.length === 0 && <li>Aucun événement.</li>}
                  {detail.events.map((event) => (
                    <li key={event.id} className="rounded bg-gray-50 px-2 py-1">
                      <span className="font-mono">{formatDate(event.createdAt)}</span> — {event.type} ({event.actorType})
                      {event.justification && <span className="block italic text-gray-500">{event.justification}</span>}
                      {(event.type === "reminder_sent" || event.type === "notification_sent") && (
                        <span className="block text-amber-600">
                          Notification mise en file d&apos;attente — livraison réelle (e-mail/WhatsApp) non testée.
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
