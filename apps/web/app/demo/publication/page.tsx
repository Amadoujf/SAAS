import type { Metadata } from "next";
import { PublishPanel } from "@/components/editor/publish-panel";

/**
 * Démonstration de la publication définitive — voir docs/12 §12.3. Fonctionne
 * ENTIÈREMENT sans PostgreSQL/Redis/R2 réels (voir lib/publishing/demo-publishing-
 * context.ts), comme les autres `/demo/*` de ce projet.
 */
export const metadata: Metadata = {
  title: "Publication du site — démonstration",
  robots: { index: false, follow: false },
};

export default function PublicationDemoPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white p-4">
        <h1 className="text-lg font-semibold text-gray-900">Publication définitive du site</h1>
      </header>
      <PublishPanel />
    </div>
  );
}
