"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Dérogation de facturation pour un tenant antérieur à la facturation SaaS — voir
 * docs/14-facturation-saas-abonnements.md, correction de stabilisation du 22
 * septembre 2026. Justification obligatoire, tracée dans `AuditLog` (voir
 * `/api/admin/tenants/[id]/billing-exemption`) — jamais un défaut, une exception
 * ponctuelle et documentée.
 */
export function TenantBillingExemptionToggle({ tenantId, exempted }: { tenantId: string; exempted: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const justification = window.prompt(
      exempted
        ? "Justification pour RETIRER la dérogation de facturation de ce tenant :"
        : "Justification pour EXEMPTER ce tenant de facturation (min. 10 caractères) :",
    );
    if (!justification || justification.trim().length < 10) {
      if (justification !== null) setError("Justification trop courte (min. 10 caractères) — action annulée.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}/billing-exemption`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ exempt: !exempted, justification }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Échec de la mise à jour.");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => void toggle()}
        className={`rounded-full px-3 py-1 text-xs font-medium ${
          exempted ? "bg-amber-100 text-amber-800 hover:bg-amber-200" : "border border-gray-300 text-gray-600 hover:bg-gray-50"
        }`}
      >
        {exempted ? "Exempté de facturation" : "Exempter de facturation"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
