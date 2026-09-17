import type { Metadata } from "next";
import { DomainsPanel } from "@/components/domains/domains-panel";

/**
 * Démonstration de l'assistant de domaines personnalisés — voir docs/13. Fonctionne
 * ENTIÈREMENT sans PostgreSQL/Redis/DNS/Caddy réels (voir lib/domains/demo-domains-
 * context.ts), comme les autres `/demo/*` de ce projet.
 */
export const metadata: Metadata = {
  title: "Domaines personnalisés — démonstration",
  robots: { index: false, follow: false },
};

export default function DomainsDemoPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white p-4">
        <h1 className="text-lg font-semibold text-gray-900">Assistant de domaines personnalisés</h1>
      </header>
      <DomainsPanel />
    </div>
  );
}
