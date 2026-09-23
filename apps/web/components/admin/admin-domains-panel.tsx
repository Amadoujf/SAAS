"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Panneau Super Admin des domaines — consomme UNIQUEMENT les routes
 * `/api/admin/domains/*` déjà protégées par `requireSuperAdmin()` (jamais un import
 * direct de `@yamacommerce/database`/`@yamacommerce/domains` ici : ce sont des
 * paquets serveur, voir la note de tête de domains-panel.tsx pour la même règle).
 */

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  PENDING_DNS: "DNS en attente",
  VERIFYING: "Vérification en cours",
  VERIFIED: "Vérifié",
  SSL_PENDING: "Certificat en cours",
  ACTIVE: "Actif",
  MISCONFIGURED: "Configuration incorrecte",
  SUSPENDED: "Suspendu",
  EXPIRED: "Expiré",
  REMOVED: "Retiré",
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  SUSPENDED: "bg-red-100 text-red-800",
  REMOVED: "bg-gray-200 text-gray-600",
  MISCONFIGURED: "bg-amber-100 text-amber-800",
  EXPIRED: "bg-gray-200 text-gray-600",
};

interface DomainTenant {
  id: string;
  name: string;
  slug: string;
  status: string;
}

interface ExpectedDnsRecord {
  type: "A" | "CNAME" | "TXT";
  host: string;
  value: string;
  ttlSeconds?: number;
}

interface AdminDomain {
  id: string;
  domain: string;
  type: string;
  isPrimary: boolean;
  lifecycleStatus: string;
  verificationAttempts: number;
  expectedDnsRecords: ExpectedDnsRecord[] | null;
  detectedDnsRecords: unknown;
  lastCheckedAt: string | null;
  managedByPlatform: boolean;
  registrarProvider: string | null;
  externalRegistrarId: string | null;
  purchasedAt: string | null;
  expiresAt: string | null;
  autoRenew: boolean;
  purchaseCostXOF: number | null;
  priceBilledXOF: number | null;
  paymentStatus: string | null;
  legalOwnerName: string | null;
  transferStatus: string | null;
  isLocked: boolean;
  createdAt: string;
  tenant: DomainTenant;
}

interface AuditLogEntry {
  id: string;
  action: string;
  actorType: string;
  actorUserId: string | null;
  metadata: unknown;
  createdAt: string;
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

export function AdminDomainsPanel() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [domains, setDomains] = useState<AdminDomain[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<AdminDomain | null>(null);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [justification, setJustification] = useState("");

  const search = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      if (statusFilter) params.set("status", statusFilter);
      const response = await fetch(`/api/admin/domains?${params.toString()}`);
      const data = (await response.json()) as { domains: AdminDomain[] };
      setDomains(data.domains ?? []);
    } finally {
      setLoading(false);
    }
  }, [query, statusFilter]);

  useEffect(() => {
    void search();
  }, [search]);

  const loadAuditLog = useCallback(async (domainId: string) => {
    const response = await fetch(`/api/admin/domains/${domainId}/audit-log`);
    const data = (await response.json()) as { entries: AuditLogEntry[] };
    setAuditLog(data.entries ?? []);
  }, []);

  async function selectDomain(domain: AdminDomain) {
    setSelected(domain);
    setActionMessage(null);
    setJustification("");
    await loadAuditLog(domain.id);
  }

  async function refreshSelected() {
    if (!selected) return;
    const params = new URLSearchParams({ query: selected.domain });
    const response = await fetch(`/api/admin/domains?${params.toString()}`);
    const data = (await response.json()) as { domains: AdminDomain[] };
    const updated = data.domains.find((d) => d.id === selected.id) ?? null;
    setSelected(updated);
    await search();
    if (updated) await loadAuditLog(updated.id);
  }

  async function handleSuspend() {
    if (!selected) return;
    try {
      await postJson(`/api/admin/domains/${selected.id}/suspend`, {});
      setActionMessage("Domaine suspendu.");
      await refreshSelected();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Échec de la suspension.");
    }
  }

  async function handleReactivate() {
    if (!selected) return;
    try {
      await postJson(`/api/admin/domains/${selected.id}/reactivate`, {});
      setActionMessage("Domaine réactivé (repasse par une vérification avant HTTPS).");
      await refreshSelected();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Échec de la réactivation.");
    }
  }

  async function handleRelaunchCheck() {
    if (!selected) return;
    try {
      const result = await postJson<{ outcome: string }>(`/api/admin/domains/${selected.id}/relaunch-check`, {});
      setActionMessage(`Vérification relancée — résultat : ${result.outcome}.`);
      await refreshSelected();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Échec de la relance.");
    }
  }

  async function handleRemove() {
    if (!selected) return;
    if (justification.trim().length < 10) {
      setActionMessage("La justification doit contenir au moins 10 caractères.");
      return;
    }
    if (!confirm(`Retirer définitivement "${selected.domain}" ? Cette action est journalisée.`)) return;
    try {
      await postJson(`/api/admin/domains/${selected.id}/remove`, { justification });
      setActionMessage("Domaine retiré (statut REMOVED) et certificat révoqué côté fournisseur.");
      setJustification("");
      await refreshSelected();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Échec du retrait.");
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4">
      <section className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Rechercher
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ex. boutique-fatou.com"
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
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white">
          <ul className="divide-y divide-gray-200">
            {domains.length === 0 && !loading && (
              <li className="p-4 text-sm text-gray-500">Aucun domaine ne correspond à cette recherche.</li>
            )}
            {domains.map((domain) => (
              <li key={domain.id}>
                <button
                  type="button"
                  onClick={() => void selectDomain(domain)}
                  className={`flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 ${
                    selected?.id === domain.id ? "bg-gray-50" : ""
                  }`}
                >
                  <div>
                    <p className="font-medium text-gray-900">{domain.domain}</p>
                    <p className="text-sm text-gray-500">
                      {domain.tenant.name} ({domain.tenant.slug}) · tenant {domain.tenant.status}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      STATUS_BADGE_CLASS[domain.lifecycleStatus] ?? "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {STATUS_LABELS[domain.lifecycleStatus] ?? domain.lifecycleStatus}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4">
          {!selected ? (
            <p className="text-sm text-gray-500">Sélectionnez un domaine pour voir le détail.</p>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{selected.domain}</h2>
                <p className="text-sm text-gray-500">
                  {selected.type === "custom" ? "Domaine personnalisé" : "Sous-domaine gratuit"} · tenant{" "}
                  {selected.tenant.name} ({selected.tenant.status}) · créé le {formatDate(selected.createdAt)}
                </p>
                <span
                  className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium ${
                    STATUS_BADGE_CLASS[selected.lifecycleStatus] ?? "bg-gray-100 text-gray-700"
                  }`}
                >
                  {STATUS_LABELS[selected.lifecycleStatus] ?? selected.lifecycleStatus}
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-gray-500">Tentatives de vérification</dt>
                <dd className="text-gray-900">{selected.verificationAttempts}</dd>
                <dt className="text-gray-500">Dernière vérification DNS</dt>
                <dd className="text-gray-900">{formatDate(selected.lastCheckedAt)}</dd>
                <dt className="text-gray-500">Géré par la plateforme</dt>
                <dd className="text-gray-900">{selected.managedByPlatform ? "Oui" : "Non"}</dd>
                {selected.managedByPlatform && (
                  <>
                    <dt className="text-gray-500">Registrar</dt>
                    <dd className="text-gray-900">{selected.registrarProvider ?? "—"}</dd>
                    <dt className="text-gray-500">Expire le</dt>
                    <dd className="text-gray-900">{formatDate(selected.expiresAt)}</dd>
                    <dt className="text-gray-500">Titulaire légal</dt>
                    <dd className="text-gray-900">{selected.legalOwnerName ?? "—"}</dd>
                  </>
                )}
              </dl>

              {selected.expectedDnsRecords && selected.expectedDnsRecords.length > 0 && (
                <div>
                  <h3 className="mb-1 text-sm font-medium text-gray-700">Enregistrements DNS attendus</h3>
                  <ul className="space-y-1 text-xs text-gray-600">
                    {selected.expectedDnsRecords.map((record, i) => (
                      <li key={i} className="rounded bg-gray-50 px-2 py-1 font-mono">
                        {record.type} {record.host} → {record.value}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-3">
                {selected.lifecycleStatus !== "SUSPENDED" && selected.lifecycleStatus !== "REMOVED" && (
                  <button
                    type="button"
                    onClick={() => void handleSuspend()}
                    className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
                  >
                    Suspendre
                  </button>
                )}
                {selected.lifecycleStatus === "SUSPENDED" && (
                  <button
                    type="button"
                    onClick={() => void handleReactivate()}
                    className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
                  >
                    Réactiver
                  </button>
                )}
                {selected.lifecycleStatus !== "REMOVED" && (
                  <button
                    type="button"
                    onClick={() => void handleRelaunchCheck()}
                    className="rounded bg-gray-700 px-3 py-1.5 text-sm text-white hover:bg-gray-800"
                  >
                    Relancer la vérification
                  </button>
                )}
              </div>

              {selected.lifecycleStatus !== "REMOVED" && (
                <div className="flex flex-col gap-2 border-t border-gray-200 pt-3">
                  <label className="text-sm font-medium text-gray-700">
                    Retirer avec justification (obligatoire, min. 10 caractères)
                  </label>
                  <textarea
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    rows={2}
                    className="rounded border border-gray-300 px-3 py-1.5 text-sm"
                    placeholder="ex. demande du client par e-mail le 18/09, ticket #1234"
                  />
                  <button
                    type="button"
                    onClick={() => void handleRemove()}
                    className="w-fit rounded border border-red-600 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    Retirer le domaine
                  </button>
                </div>
              )}

              {actionMessage && <p className="text-sm text-gray-700">{actionMessage}</p>}

              <div className="border-t border-gray-200 pt-3">
                <h3 className="mb-2 text-sm font-medium text-gray-700">Journal d&apos;audit</h3>
                <ul className="space-y-1 text-xs text-gray-600">
                  {auditLog.length === 0 && <li>Aucune entrée.</li>}
                  {auditLog.map((entry) => (
                    <li key={entry.id} className="rounded bg-gray-50 px-2 py-1">
                      <span className="font-mono">{formatDate(entry.createdAt)}</span> — {entry.action} (
                      {entry.actorType})
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
