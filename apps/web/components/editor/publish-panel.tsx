"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChangesSummary, PublishIssue } from "@yamacommerce/publishing";

/**
 * Panneau de publication — voir docs/12 §12.3, « INTERFACE ». Démonstration
 * interactive (voir lib/publishing/demo-publishing-context.ts) : appelle les routes
 * `/api/demo-publishing/*`, elles-mêmes construites sur le VRAI code de validation et
 * de verrouillage partagé avec le pipeline de production.
 */

type Toggles = {
  tenantSuspended: boolean;
  subscriptionExpired: boolean;
  domainMissing: boolean;
  privateMediaReferenced: boolean;
};

const DEFAULT_TOGGLES: Toggles = {
  tenantSuspended: false,
  subscriptionExpired: false,
  domainMissing: false,
  privateMediaReferenced: false,
};

interface DemoVersion {
  id: string;
  status: "draft" | "scheduled" | "published" | "archived";
  versionNumber: number | null;
  publishMessage: string | null;
  changesSummary: ChangesSummary | null;
  wasScheduled: boolean;
  restoredFromVersionId: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
}

interface Snapshot {
  draft: DemoVersion;
  published: DemoVersion | null;
  history: DemoVersion[];
}

type PublishResult =
  | { outcome: "published"; version: DemoVersion }
  | { outcome: "blocked"; report: { canPublish: boolean; issues: PublishIssue[] } }
  | { outcome: "already_in_progress" };

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

export function PublishPanel() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [toggles, setToggles] = useState<Toggles>(DEFAULT_TOGGLES);
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [message, setMessage] = useState("");
  const [scheduledDateTimeLocal, setScheduledDateTimeLocal] = useState("");
  const [timeZone, setTimeZone] = useState("Africa/Dakar");
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<PublishResult | { outcome: "scheduled" } | null>(null);
  const [concurrentResult, setConcurrentResult] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/demo-publishing/state");
    setSnapshot((await response.json()) as Snapshot);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handlePublishNow() {
    setBusy(true);
    setLastResult(null);
    try {
      const result = await postJson<PublishResult>("/api/demo-publishing/publish", {
        toggles,
        publishMessage: message || undefined,
      });
      setLastResult(result);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleSchedule() {
    if (!scheduledDateTimeLocal) return;
    setBusy(true);
    setLastResult(null);
    try {
      const result = await postJson<{ outcome: string }>("/api/demo-publishing/schedule", {
        toggles,
        dateTimeLocal: scheduledDateTimeLocal,
        timeZone,
      });
      setLastResult(result as never);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelSchedule(versionId: string) {
    await postJson("/api/demo-publishing/cancel-schedule", { versionId });
    await refresh();
  }

  async function handlePromoteNow(versionId: string) {
    await postJson("/api/demo-publishing/promote", { versionId });
    await refresh();
  }

  async function handleRestore(versionId: string, andPublish: boolean) {
    await postJson("/api/demo-publishing/restore", { versionId, andPublish, toggles });
    await refresh();
  }

  async function handleConcurrentTest() {
    setConcurrentResult("En cours…");
    const [a, b] = await Promise.all([
      postJson<PublishResult>("/api/demo-publishing/publish", { toggles, simulateSlowMs: 800 }),
      postJson<PublishResult>("/api/demo-publishing/publish", { toggles, simulateSlowMs: 800 }),
    ]);
    setConcurrentResult(`Appel A → ${a.outcome} · Appel B → ${b.outcome}`);
    await refresh();
  }

  async function handleReset() {
    await postJson("/api/demo-publishing/reset", {});
    setLastResult(null);
    setConcurrentResult(null);
    await refresh();
  }

  if (!snapshot) return <p className="p-4 text-sm text-gray-500">Chargement…</p>;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 text-sm">
      <section className="rounded-lg border border-gray-200 p-4">
        <h2 className="mb-2 font-semibold text-gray-900">État actuel du site</h2>
        <ul className="space-y-1 text-gray-700">
          <li>
            Statut : <strong>{snapshot.published ? "publié" : "jamais publié"}</strong>
          </li>
          <li>Dernière publication : {formatDate(snapshot.published?.publishedAt ?? null)}</li>
          <li>
            Prochaine publication programmée :{" "}
            {formatDate(snapshot.history.find((v) => v.status === "scheduled")?.scheduledAt ?? null)}
          </li>
          {snapshot.published && (
            <li>
              <a href="/demo/publication/apercu" target="_blank" rel="noreferrer" className="text-brand underline">
                Voir le site →
              </a>
            </li>
          )}
        </ul>
      </section>

      <section className="rounded-lg border border-gray-200 p-4">
        <h2 className="mb-2 font-semibold text-gray-900">Simuler des conditions bloquantes</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(
            [
              ["tenantSuspended", "Compte suspendu"],
              ["subscriptionExpired", "Abonnement expiré"],
              ["domainMissing", "Domaine non vérifié"],
              ["privateMediaReferenced", "Document sensible référencé"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={toggles[key]}
                onChange={(e) => setToggles((prev) => ({ ...prev, [key]: e.target.checked }))}
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 p-4">
        <h2 className="mb-2 font-semibold text-gray-900">Publier</h2>
        <div className="mb-3 flex gap-4">
          <label className="flex items-center gap-2">
            <input type="radio" checked={mode === "now"} onChange={() => setMode("now")} />
            Publier maintenant
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={mode === "schedule"} onChange={() => setMode("schedule")} />
            Programmer
          </label>
        </div>

        {mode === "now" ? (
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Message de publication (facultatif)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void handlePublishNow()}
              className="bg-brand text-brand-foreground w-fit rounded px-4 py-2 font-medium disabled:opacity-50"
            >
              {busy ? "Publication…" : "Publier"}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-xs text-gray-600">
              Date et heure
              <input
                type="datetime-local"
                value={scheduledDateTimeLocal}
                onChange={(e) => setScheduledDateTimeLocal(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1"
              />
            </label>
            <label className="flex flex-col text-xs text-gray-600">
              Fuseau horaire
              <select
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1"
              >
                <option value="Africa/Dakar">Africa/Dakar (par défaut)</option>
                <option value="Europe/Paris">Europe/Paris</option>
                <option value="America/New_York">America/New_York</option>
              </select>
            </label>
            <button
              type="button"
              disabled={busy || !scheduledDateTimeLocal}
              onClick={() => void handleSchedule()}
              className="bg-brand text-brand-foreground rounded px-4 py-2 font-medium disabled:opacity-50"
            >
              Programmer
            </button>
          </div>
        )}

        {lastResult && (
          <div className="mt-3 rounded border border-gray-200 p-3">
            {lastResult.outcome === "published" && (
              <p className="text-green-700">
                ✅ Publié — version n°{(lastResult as { version: DemoVersion }).version.versionNumber}
              </p>
            )}
            {lastResult.outcome === "scheduled" && <p className="text-green-700">✅ Publication programmée.</p>}
            {lastResult.outcome === "already_in_progress" && (
              <p className="text-amber-700">⏳ Une publication est déjà en cours pour ce site.</p>
            )}
            {lastResult.outcome === "blocked" && (
              <div>
                <p className="mb-1 font-medium text-red-700">❌ Publication bloquée :</p>
                <ul className="list-disc pl-5 text-red-700">
                  {(lastResult as { report: { issues: PublishIssue[] } }).report.issues
                    .filter((i) => i.severity === "error")
                    .map((issue, index) => (
                      <li key={index}>{issue.message}</li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 p-4">
        <h2 className="mb-2 font-semibold text-gray-900">Fiabilité : double clic / publications concurrentes</h2>
        <button
          type="button"
          onClick={() => void handleConcurrentTest()}
          className="rounded border border-gray-300 px-4 py-2 font-medium hover:bg-gray-50"
        >
          Tester deux publications simultanées
        </button>
        {concurrentResult && <p className="mt-2 text-gray-700">{concurrentResult}</p>}
      </section>

      <section className="rounded-lg border border-gray-200 p-4">
        <h2 className="mb-2 font-semibold text-gray-900">Historique des versions</h2>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-1">Version</th>
              <th>Statut</th>
              <th>Date</th>
              <th>Message</th>
              <th>Changements</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.history.map((version) => (
              <tr key={version.id} className="border-b border-gray-100">
                <td className="py-1">{version.versionNumber ?? "—"}</td>
                <td>
                  {version.status}
                  {version.wasScheduled ? " (programmée)" : ""}
                </td>
                <td>{formatDate(version.publishedAt ?? version.scheduledAt)}</td>
                <td>{version.publishMessage ?? "—"}</td>
                <td>{version.changesSummary ? `${version.changesSummary.totalChangedPages} page(s)` : "—"}</td>
                <td className="flex flex-wrap gap-2 py-1">
                  {version.status === "scheduled" && (
                    <>
                      <button
                        type="button"
                        onClick={() => void handlePromoteNow(version.id)}
                        className="text-brand underline"
                      >
                        Simuler l&apos;échéance maintenant
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCancelSchedule(version.id)}
                        className="text-red-600 underline"
                      >
                        Annuler
                      </button>
                    </>
                  )}
                  {(version.status === "published" || version.status === "archived") && (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleRestore(version.id, false)}
                        className="text-brand underline"
                      >
                        Restaurer dans le brouillon
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRestore(version.id, true)}
                        className="text-brand underline"
                      >
                        Republier cette version
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <button
        type="button"
        onClick={() => void handleReset()}
        className="w-fit text-xs text-gray-400 underline"
      >
        Réinitialiser la démonstration
      </button>
    </div>
  );
}
