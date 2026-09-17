"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * `DnsProviderGuide`/les données de `DNS_PROVIDER_GUIDES` sont servies via
 * `/api/demo-domains/dns-provider-guides` plutôt qu'importées directement depuis
 * `@yamacommerce/domains` : ce paquet réexporte aussi des modules serveur (ex.
 * `node:crypto` dans verification-token.ts) via son point d'entrée unique — les
 * importer ici ferait échouer le bundle CLIENT (webpack ne sait pas empaqueter
 * `node:crypto` pour le navigateur). Voir la même règle que pour tout composant
 * "use client" de ce projet : jamais d'import direct d'un paquet serveur, toujours
 * un `fetch` vers une route.
 */
interface DnsProviderGuide {
  key: string;
  label: string;
  helpUrl: string;
  steps: string[];
}

/**
 * Panneau de l'assistant de domaines — voir docs/13, « INTERFACE CLIENT » et
 * « DÉMONSTRATION ». Appelle les routes `/api/demo-domains/*`, construites sur le
 * VRAI code de validation/DNS/HTTPS simulé partagé avec la production.
 */

interface ExpectedDnsRecord {
  type: "A" | "CNAME" | "TXT";
  host: string;
  value: string;
  ttlSeconds: number;
}

interface DemoDomain {
  id: string;
  domain: string;
  type: "subdomain" | "custom";
  isPrimary: boolean;
  serveDirectlyWhenNotPrimary: boolean;
  lifecycleStatus: string;
  verificationToken: string | null;
  verificationAttempts: number;
  expectedDnsRecords: ExpectedDnsRecord[];
  detectedDnsRecords: { type: string; host: string; value: string }[];
  lastCheckedAt: string | null;
  createdAt: string;
}

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

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await response.json()) as T;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

export function DomainsPanel() {
  const [domains, setDomains] = useState<DemoDomain[] | null>(null);
  const [companyName, setCompanyName] = useState("Boutique Fatou");
  const [suggestions, setSuggestions] = useState<{ subdomain: string; fullDomain: string; available: boolean }[]>(
    [],
  );
  const [customDomainInput, setCustomDomainInput] = useState("");
  const [addResult, setAddResult] = useState<string | null>(null);
  const [guides, setGuides] = useState<DnsProviderGuide[]>([]);
  const [providerGuideKey, setProviderGuideKey] = useState("cloudflare");
  const [checkResult, setCheckResult] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    const response = await fetch("/api/demo-domains/state");
    const data = (await response.json()) as { domains: DemoDomain[] };
    setDomains(data.domains);
  }, []);

  useEffect(() => {
    void refresh();
    void fetch("/api/demo-domains/dns-provider-guides")
      .then((r) => r.json() as Promise<{ guides: DnsProviderGuide[] }>)
      .then((data) => setGuides(data.guides));
  }, [refresh]);

  const selectedGuide = guides.find((g) => g.key === providerGuideKey);

  async function handleSuggest() {
    const response = await postJson<{
      suggestions: { subdomain: string; fullDomain: string; available: boolean }[];
    }>("/api/demo-domains/suggest-subdomains", { companyName });
    setSuggestions(response.suggestions);
  }

  async function handleClaim(subdomain: string) {
    await postJson("/api/demo-domains/claim-subdomain", { rawSubdomain: subdomain });
    await refresh();
  }

  async function handleAddCustom() {
    const result = await postJson<{ outcome: string; issues?: string[] }>("/api/demo-domains/add-custom", {
      rawDomain: customDomainInput,
    });
    setAddResult(JSON.stringify(result));
    await refresh();
  }

  async function handleSimulatePropagation(domainId: string, partial: boolean) {
    await postJson("/api/demo-domains/simulate-propagation", { domainId, partial });
    await refresh();
  }

  async function handleBreakConfig(domainId: string) {
    await postJson("/api/demo-domains/break-config", { domainId });
    await refresh();
  }

  async function handleCheckNow(domainId: string) {
    const result = await postJson<{ outcome: string }>("/api/demo-domains/check-now", { domainId });
    setCheckResult((prev) => ({ ...prev, [domainId]: result.outcome }));
    await refresh();
  }

  async function handleSetPrimary(domainId: string) {
    await postJson("/api/demo-domains/set-primary", { domainId });
    await refresh();
  }

  async function handleRemove(domainId: string) {
    await postJson("/api/demo-domains/remove", { domainId });
    await refresh();
  }

  async function handleSuspend(domainId: string) {
    await postJson("/api/demo-domains/admin/suspend", { domainId });
    await refresh();
  }

  async function handleReactivate(domainId: string) {
    await postJson("/api/demo-domains/admin/reactivate", { domainId });
    await refresh();
  }

  async function handleReset() {
    await fetch("/api/demo-domains/reset", { method: "POST" });
    setSuggestions([]);
    setAddResult(null);
    setCheckResult({});
    await refresh();
  }

  if (!domains) return <p className="p-4 text-sm text-gray-500">Chargement…</p>;

  const pendingDomain = domains.find((d) => d.type === "custom" && d.lifecycleStatus !== "REMOVED");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 text-sm">
      <section className="rounded-lg border border-gray-200 p-4">
        <h2 className="mb-2 font-semibold text-gray-900">1. Sous-domaine gratuit</h2>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1"
            placeholder="Nom de l'entreprise"
          />
          <button
            type="button"
            onClick={() => void handleSuggest()}
            className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50"
          >
            Rechercher
          </button>
        </div>
        {suggestions.length > 0 && (
          <ul className="mt-3 space-y-1">
            {suggestions.map((s) => (
              <li key={s.fullDomain} className="flex items-center justify-between gap-2">
                <span>
                  {s.fullDomain} — {s.available ? "✅ disponible" : "❌ indisponible"}
                </span>
                {s.available && (
                  <button
                    type="button"
                    onClick={() => void handleClaim(s.subdomain)}
                    className="bg-brand text-brand-foreground rounded px-3 py-1 text-xs font-medium"
                  >
                    Choisir
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 p-4">
        <h2 className="mb-2 font-semibold text-gray-900">2. Ajouter un domaine personnalisé</h2>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={customDomainInput}
            onChange={(e) => setCustomDomainInput(e.target.value)}
            placeholder="boutiquefatou.com"
            className="rounded border border-gray-300 px-2 py-1"
          />
          <button
            type="button"
            onClick={() => void handleAddCustom()}
            className="bg-brand text-brand-foreground rounded px-3 py-1 font-medium"
          >
            Ajouter
          </button>
        </div>
        {addResult && <p className="mt-2 text-xs text-gray-600">{addResult}</p>}
      </section>

      {pendingDomain && (
        <section className="rounded-lg border border-gray-200 p-4">
          <h2 className="mb-2 font-semibold text-gray-900">
            3. Instructions DNS pour {pendingDomain.domain}
          </h2>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-1">Type</th>
                <th>Nom</th>
                <th>Valeur</th>
                <th>TTL</th>
                <th>État détecté</th>
              </tr>
            </thead>
            <tbody>
              {pendingDomain.expectedDnsRecords.map((record, index) => {
                const detected = pendingDomain.detectedDnsRecords.find(
                  (d) => d.type === record.type && d.host === record.host,
                );
                return (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-1">{record.type}</td>
                    <td>{record.host}</td>
                    <td className="max-w-[220px] truncate">{record.value}</td>
                    <td>{record.ttlSeconds}s</td>
                    <td>{detected ? "✅ détecté" : "⏳ non détecté"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="text-xs text-gray-600">
              Fournisseur DNS :
              <select
                value={providerGuideKey}
                onChange={(e) => setProviderGuideKey(e.target.value)}
                className="ml-2 rounded border border-gray-300 px-2 py-1"
              >
                {guides.map((guide) => (
                  <option key={guide.key} value={guide.key}>
                    {guide.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ol className="mt-2 list-decimal pl-5 text-xs text-gray-600">
            {(selectedGuide?.steps ?? []).map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-gray-500">
            La propagation peut prendre un certain temps. Utilisez les boutons ci-dessous pour simuler votre
            fournisseur DNS réel.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleSimulatePropagation(pendingDomain.id, true)}
              className="rounded border border-amber-300 px-3 py-1 text-xs text-amber-700 hover:bg-amber-50"
            >
              Simuler : DNS partiel (erreur)
            </button>
            <button
              type="button"
              onClick={() => void handleSimulatePropagation(pendingDomain.id, false)}
              className="rounded border border-green-300 px-3 py-1 text-xs text-green-700 hover:bg-green-50"
            >
              Simuler : DNS complet ajouté chez le fournisseur
            </button>
            <button
              type="button"
              onClick={() => void handleCheckNow(pendingDomain.id)}
              className="bg-brand text-brand-foreground rounded px-3 py-1 text-xs font-medium"
            >
              Vérifier maintenant
            </button>
          </div>
          {checkResult[pendingDomain.id] && (
            <p className="mt-2 text-xs">
              Résultat de la dernière vérification :{" "}
              <strong>{STATUS_LABELS[checkResult[pendingDomain.id]!.toUpperCase()] ?? checkResult[pendingDomain.id]}</strong>
            </p>
          )}
        </section>
      )}

      <section className="rounded-lg border border-gray-200 p-4">
        <h2 className="mb-2 font-semibold text-gray-900">Domaines de l&apos;entreprise</h2>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-1">Domaine</th>
              <th>Type</th>
              <th>Statut</th>
              <th>Principal</th>
              <th>Dernière vérification</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {domains.map((domain) => (
              <tr key={domain.id} className="border-b border-gray-100">
                <td className="py-1">{domain.domain}</td>
                <td>{domain.type === "subdomain" ? "Sous-domaine gratuit" : "Personnalisé"}</td>
                <td>{STATUS_LABELS[domain.lifecycleStatus] ?? domain.lifecycleStatus}</td>
                <td>{domain.isPrimary ? "✅" : ""}</td>
                <td>{formatDate(domain.lastCheckedAt)}</td>
                <td className="flex flex-wrap gap-2 py-1">
                  {domain.lifecycleStatus === "ACTIVE" && !domain.isPrimary && (
                    <button type="button" onClick={() => void handleSetPrimary(domain.id)} className="text-brand underline">
                      Définir comme principal
                    </button>
                  )}
                  {domain.lifecycleStatus === "ACTIVE" && (
                    <button
                      type="button"
                      onClick={() => void handleBreakConfig(domain.id)}
                      className="text-amber-600 underline"
                    >
                      Simuler une casse DNS
                    </button>
                  )}
                  {domain.lifecycleStatus !== "REMOVED" && (
                    <button type="button" onClick={() => void handleRemove(domain.id)} className="text-red-600 underline">
                      Retirer
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {domains.some((d) => d.isPrimary) && (
          <p className="mt-2 text-xs text-gray-500">
            Les autres domaines actifs redirigent automatiquement vers le domaine principal (sauf le sous-domaine
            gratuit, conservé comme adresse de secours).
          </p>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h2 className="mb-2 font-semibold text-gray-900">Interface Super Admin (aperçu)</h2>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-300 text-gray-500">
              <th className="py-1">Domaine</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {domains.map((domain) => (
              <tr key={domain.id} className="border-b border-gray-200">
                <td className="py-1">{domain.domain}</td>
                <td>{STATUS_LABELS[domain.lifecycleStatus] ?? domain.lifecycleStatus}</td>
                <td className="flex gap-2 py-1">
                  {domain.lifecycleStatus !== "SUSPENDED" ? (
                    <button type="button" onClick={() => void handleSuspend(domain.id)} className="text-red-600 underline">
                      Suspendre
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleReactivate(domain.id)}
                      className="text-brand underline"
                    >
                      Réactiver
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <button type="button" onClick={() => void handleReset()} className="w-fit text-xs text-gray-400 underline">
        Réinitialiser la démonstration
      </button>
    </div>
  );
}
