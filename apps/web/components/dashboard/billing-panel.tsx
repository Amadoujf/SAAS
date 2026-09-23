"use client";

import { useCallback, useEffect, useState } from "react";

interface SubscriptionSummary {
  status: string;
  billingCycle: "MONTHLY" | "YEARLY";
  renewalMode: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  graceEndsAt: string | null;
  daysRemaining: number;
  planId: string;
  planName: string;
}

interface PlanSummary {
  id: string;
  name: string;
  currency: string;
  priceMonthly: number;
  priceYearly: number;
  trialDays: number;
  maxProducts: number;
  maxEmployees: number;
  maxShops: number;
  storageMB: number;
  maxCustomDomains: number;
  includedModuleKeys: string[];
  features: unknown;
}

interface UsageEntry {
  used: number;
  limit: number | null;
}

interface PaymentEntry {
  id: string;
  provider: string;
  amountXOF: number;
  currency: string;
  status: string;
  createdAt: string;
  confirmedAt: string | null;
}

interface BillingSummary {
  subscription: SubscriptionSummary | null;
  plans: PlanSummary[];
  usage: Record<"products" | "employees" | "domains", UsageEntry>;
  payments: PaymentEntry[];
}

/** Messages distincts par statut — voir docs/14-facturation-saas-abonnements.md,
 *  « messages distincts par statut ». Jamais un message générique unique : le
 *  propriétaire doit comprendre en un coup d'œil s'il doit agir maintenant. */
const STATUS_MESSAGES: Record<string, { label: string; tone: "ok" | "warning" | "danger" }> = {
  TRIALING: { label: "Essai gratuit en cours", tone: "ok" },
  ACTIVE: { label: "Abonnement actif", tone: "ok" },
  PENDING: { label: "Aucun paiement confirmé pour l'instant", tone: "warning" },
  GRACE_PERIOD: { label: "Paiement en retard — période de grâce", tone: "warning" },
  PAST_DUE: { label: "Paiement en retard", tone: "warning" },
  SUSPENDED: { label: "Abonnement suspendu — site public indisponible", tone: "danger" },
  EXPIRED: { label: "Abonnement expiré", tone: "danger" },
  CANCELED: { label: "Abonnement annulé", tone: "danger" },
};

const TONE_CLASSES: Record<"ok" | "warning" | "danger", string> = {
  ok: "bg-green-50 text-green-800 border-green-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  danger: "bg-red-50 text-red-800 border-red-200",
};

const QUOTA_LABELS: Record<keyof BillingSummary["usage"], string> = {
  products: "Produits",
  employees: "Employés",
  domains: "Domaines personnalisés",
};

export function BillingPanel() {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/summary");
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Impossible de charger les informations de facturation.");
        return;
      }
      const data = (await response.json()) as BillingSummary;
      setSummary(data);
      if (data.subscription) setBillingCycle(data.subscription.billingCycle);
    } catch {
      setError("Impossible de charger les informations de facturation.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleChoosePlan(planId: string) {
    setPendingPlanId(planId);
    setCheckoutError(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId, billingCycle }),
      });
      const data = (await response.json()) as { checkoutUrl?: string; error?: string };
      if (!response.ok || !data.checkoutUrl) {
        setCheckoutError(data.error ?? "Échec de la création de la session de paiement.");
        setPendingPlanId(null);
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch {
      setCheckoutError("Échec de la création de la session de paiement.");
      setPendingPlanId(null);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-4xl p-4 text-sm text-gray-500">Chargement…</div>;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (!summary) return null;

  const statusInfo = summary.subscription ? STATUS_MESSAGES[summary.subscription.status] : null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4">
      {/* Correction de stabilisation (22 septembre 2026) — voir docs/14, point 8 :
          l'abonnement ne doit JAMAIS être présenté comme un prélèvement automatique
          tant que `renewalMode: AUTOMATIC` reste structurellement inerte. */}
      <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        Votre abonnement n&apos;est pas débité automatiquement. Nous vous préviendrons avant son
        expiration afin que vous puissiez le renouveler.
      </p>

      {/* Statut courant */}
      {summary.subscription ? (
        <section className={`rounded-lg border p-4 ${statusInfo ? TONE_CLASSES[statusInfo.tone] : "border-gray-200 bg-white"}`}>
          <p className="text-sm font-medium">{statusInfo?.label ?? summary.subscription.status}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{summary.subscription.planName}</p>
          <p className="mt-1 text-sm text-gray-600">
            {summary.subscription.status === "ACTIVE" || summary.subscription.status === "GRACE_PERIOD"
              ? `${summary.subscription.daysRemaining} jour(s) restant(s) — échéance le ${new Date(summary.subscription.currentPeriodEnd).toLocaleDateString("fr-FR")}`
              : `Échéance : ${new Date(summary.subscription.currentPeriodEnd).toLocaleDateString("fr-FR")}`}
          </p>
          {summary.subscription.graceEndsAt && (
            <p className="mt-1 text-sm text-amber-700">
              Fin de la période de grâce le {new Date(summary.subscription.graceEndsAt).toLocaleDateString("fr-FR")}
            </p>
          )}
        </section>
      ) : (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">Aucun abonnement souscrit pour l&apos;instant</p>
          <p className="mt-1 text-sm text-amber-700">Choisissez une formule ci-dessous pour activer votre abonnement.</p>
        </section>
      )}

      {/* Quotas */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Utilisation</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(Object.keys(summary.usage) as Array<keyof BillingSummary["usage"]>).map((key) => {
            const entry = summary.usage[key];
            const ratio = entry.limit ? Math.min(1, entry.used / entry.limit) : 0;
            return (
              <div key={key} className="rounded border border-gray-100 p-3">
                <p className="text-xs font-medium text-gray-500">{QUOTA_LABELS[key]}</p>
                <p className="mt-1 text-sm text-gray-900">
                  {entry.used} / {entry.limit ?? "Illimité"}
                </p>
                {entry.limit !== null && (
                  <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100">
                    <div
                      className={`h-1.5 rounded-full ${ratio >= 1 ? "bg-red-500" : ratio > 0.8 ? "bg-amber-500" : "bg-green-500"}`}
                      style={{ width: `${ratio * 100}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Comparaison des formules */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Formules disponibles</h2>
          <div className="flex rounded-full border border-gray-200 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setBillingCycle("MONTHLY")}
              className={`rounded-full px-3 py-1 ${billingCycle === "MONTHLY" ? "bg-gray-900 text-white" : "text-gray-600"}`}
            >
              Mensuel
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("YEARLY")}
              className={`rounded-full px-3 py-1 ${billingCycle === "YEARLY" ? "bg-gray-900 text-white" : "text-gray-600"}`}
            >
              Annuel
            </button>
          </div>
        </div>

        {checkoutError && <p className="mt-2 text-sm text-red-600">{checkoutError}</p>}

        {summary.plans.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">Aucune formule n&apos;est publiée pour le moment.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {summary.plans.map((plan) => {
              const price = billingCycle === "YEARLY" ? plan.priceYearly : plan.priceMonthly;
              const isCurrent = summary.subscription?.planId === plan.id && summary.subscription.status !== "CANCELED";
              return (
                <div key={plan.id} className={`flex flex-col gap-2 rounded-lg border p-4 ${isCurrent ? "border-gray-900" : "border-gray-200"}`}>
                  <p className="font-medium text-gray-900">{plan.name}</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {price.toLocaleString("fr-FR")} <span className="text-sm font-normal text-gray-500">{plan.currency}</span>
                  </p>
                  <ul className="flex-1 text-sm text-gray-600">
                    <li>{plan.maxProducts} produits</li>
                    <li>{plan.maxEmployees} employés</li>
                    <li>{plan.maxCustomDomains} domaine(s) personnalisé(s)</li>
                    <li>{plan.storageMB} Mo de stockage</li>
                  </ul>
                  <button
                    type="button"
                    disabled={pendingPlanId === plan.id}
                    onClick={() => void handleChoosePlan(plan.id)}
                    className="mt-2 rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {pendingPlanId === plan.id
                      ? "Redirection…"
                      : isCurrent
                        ? "Renouveler"
                        : summary.subscription
                          ? "Changer de formule"
                          : "Souscrire"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Historique des paiements */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Historique des paiements</h2>
        {summary.payments.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">Aucun paiement pour le moment.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">
            {summary.payments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="text-gray-900">
                    {payment.amountXOF.toLocaleString("fr-FR")} {payment.currency}
                  </p>
                  <p className="text-xs text-gray-500">{new Date(payment.createdAt).toLocaleString("fr-FR")}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    payment.status === "SUCCEEDED"
                      ? "bg-green-100 text-green-700"
                      : payment.status === "FAILED"
                        ? "bg-red-100 text-red-700"
                        : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {payment.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
