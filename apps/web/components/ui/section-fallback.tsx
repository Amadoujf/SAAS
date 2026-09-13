/**
 * Fallback affiché quand une section est invalide (paramètres non conformes, clé ou
 * variante inconnue) — voir l'exigence du moteur de rendu : « afficher un fallback
 * propre si une section est invalide », jamais faire planter la page entière.
 *
 * Volontairement discret et sans détail technique en environnement de production ;
 * le détail de l'erreur est réservé aux journaux serveur (voir section-renderer.tsx).
 */
export function SectionFallback({ sectionKey }: { sectionKey: string }) {
  return (
    <div
      role="alert"
      className="mx-auto my-4 max-w-[var(--content-max-width,1280px)] rounded-[var(--radius-md,8px)] border border-dashed border-[var(--color-border,#e2e8f0)] px-6 py-8 text-center text-sm text-[var(--color-text-muted,#64748b)]"
    >
      Cette section (« {sectionKey} ») n&apos;a pas pu être affichée. L&apos;équipe a été notifiée.
    </div>
  );
}
