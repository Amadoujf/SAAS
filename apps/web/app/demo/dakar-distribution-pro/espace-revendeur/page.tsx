"use client";

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SiteShell } from "@/components/site-shell";
import { formatFcfa } from "@/lib/format";
import {
  DAKAR_DISTRIBUTION_DESIGN_TOKENS,
  DEMO_ACCOUNT,
  DEMO_FOOTER_GROUPS,
  DEMO_NAV_ITEMS,
  DEMO_SEARCH_SUGGESTIONS,
  SHOP_NAME,
  SHOP_TAGLINE,
  WHATSAPP_NUMBER,
} from "@/lib/demo/dakar-distribution-pro-template";

/**
 * Espace revendeur — DÉMONSTRATION d'interface avec des données fictives d'un compte
 * déjà validé (voir la note de limitation en tête de lib/demo/dakar-distribution-pro-template.ts :
 * pas de vraie authentification/backend dans cette démo statique, exactement comme
 * "Mon compte" sur les 4 autres templates). Ce qui EST réel : l'export CSV ci-dessous
 * génère un vrai fichier téléchargeable côté navigateur à partir de ces données.
 */
function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function EspaceRevendeurPage() {
  const creditPercent = Math.round((DEMO_ACCOUNT.creditUsed / DEMO_ACCOUNT.creditLimit) * 100);

  return (
    <SiteShell
      tokens={DAKAR_DISTRIBUTION_DESIGN_TOKENS}
      animationLevel={DAKAR_DISTRIBUTION_DESIGN_TOKENS.animation.level}
    >
      <Header
        shopName={SHOP_NAME}
        navItems={DEMO_NAV_ITEMS}
        searchSuggestions={DEMO_SEARCH_SUGGESTIONS}
      />
      <main style={{ paddingTop: "var(--header-height)" }}>
        <div className="mx-auto max-w-[var(--content-max-width)] px-6 py-12 lg:px-10 lg:py-16">
          <p className="text-[length:var(--text-body-xs)] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
            Espace revendeur — démonstration
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-heading)] text-[length:var(--text-heading-lg)] text-[var(--color-text-primary)]">
            {DEMO_ACCOUNT.companyName}
          </h1>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-[var(--card-radius)] border border-[var(--color-border)] p-5">
              <p className="text-[length:var(--text-body-xs)] text-[var(--color-text-muted)]">
                Commercial assigné
              </p>
              <p className="mt-2 font-semibold text-[var(--color-text-primary)]">
                {DEMO_ACCOUNT.accountManager.name}
              </p>
              <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-secondary)]">
                {DEMO_ACCOUNT.accountManager.phone}
              </p>
              <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-secondary)]">
                {DEMO_ACCOUNT.accountManager.email}
              </p>
            </div>

            <div className="rounded-[var(--card-radius)] border border-[var(--color-border)] p-5">
              <p className="text-[length:var(--text-body-xs)] text-[var(--color-text-muted)]">
                Limite de crédit
              </p>
              <p className="mt-2 font-semibold text-[var(--color-text-primary)]">
                {formatFcfa(DEMO_ACCOUNT.creditUsed, "fr")} /{" "}
                {formatFcfa(DEMO_ACCOUNT.creditLimit, "fr")}
              </p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${creditPercent}%`, backgroundColor: "var(--color-secondary)" }}
                />
              </div>
              <p className="mt-1 text-[length:var(--text-body-xs)] text-[var(--color-text-muted)]">
                {creditPercent}% utilisé
              </p>
            </div>

            <div className="rounded-[var(--card-radius)] border border-[var(--color-border)] p-5">
              <p className="text-[length:var(--text-body-xs)] text-[var(--color-text-muted)]">
                Utilisateurs du compte
              </p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {DEMO_ACCOUNT.users.map((user) => (
                  <li
                    key={user.email}
                    className="text-[length:var(--text-body-sm)] text-[var(--color-text-secondary)]"
                  >
                    {user.name}{" "}
                    <span className="text-[var(--color-text-muted)]">— {user.role}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-8 rounded-[var(--card-radius)] border border-[var(--color-border)] p-5">
            <p className="text-[length:var(--text-body-xs)] text-[var(--color-text-muted)]">
              Adresses de livraison
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {DEMO_ACCOUNT.addresses.map((address) => (
                <li
                  key={address.label}
                  className="text-[length:var(--text-body-sm)] text-[var(--color-text-secondary)]"
                >
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {address.label}
                  </span>{" "}
                  — {address.address}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-10 flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-heading)] text-[length:var(--text-heading-sm)] text-[var(--color-text-primary)]">
              Historique des commandes
            </h2>
            <button
              type="button"
              onClick={() =>
                downloadCsv("commandes.csv", [
                  ["Commande", "Date", "Montant FCFA", "Statut"],
                  ...DEMO_ACCOUNT.orders.map((order) => [
                    order.id,
                    order.date,
                    order.amount,
                    order.status,
                  ]),
                ])
              }
              className="rounded-[var(--button-radius)] border border-[var(--color-border)] px-4 py-2 text-[length:var(--text-body-sm)] text-[var(--color-text-primary)] transition hover:border-[var(--color-primary)]"
            >
              Exporter en CSV
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-left text-[length:var(--text-body-sm)]">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[var(--color-text-muted)]">
                  <th className="py-2 pr-4">Commande</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Montant</th>
                  <th className="py-2 pr-4">Statut</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_ACCOUNT.orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="py-2.5 pr-4 font-mono text-[var(--color-text-primary)]">
                      {order.id}
                    </td>
                    <td className="py-2.5 pr-4 text-[var(--color-text-secondary)]">{order.date}</td>
                    <td className="py-2.5 pr-4 text-[var(--color-text-primary)]">
                      {formatFcfa(order.amount, "fr")}
                    </td>
                    <td className="py-2.5 pr-4 text-[var(--color-text-secondary)]">
                      {order.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-10 flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-heading)] text-[length:var(--text-heading-sm)] text-[var(--color-text-primary)]">
              Factures
            </h2>
            <button
              type="button"
              onClick={() =>
                downloadCsv("factures.csv", [
                  ["Facture", "Date", "Montant FCFA", "Statut"],
                  ...DEMO_ACCOUNT.invoices.map((invoice) => [
                    invoice.id,
                    invoice.date,
                    invoice.amount,
                    invoice.status,
                  ]),
                ])
              }
              className="rounded-[var(--button-radius)] border border-[var(--color-border)] px-4 py-2 text-[length:var(--text-body-sm)] text-[var(--color-text-primary)] transition hover:border-[var(--color-primary)]"
            >
              Exporter en CSV
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-left text-[length:var(--text-body-sm)]">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[var(--color-text-muted)]">
                  <th className="py-2 pr-4">Facture</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Montant</th>
                  <th className="py-2 pr-4">Statut</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_ACCOUNT.invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="py-2.5 pr-4 font-mono text-[var(--color-text-primary)]">
                      {invoice.id}
                    </td>
                    <td className="py-2.5 pr-4 text-[var(--color-text-secondary)]">
                      {invoice.date}
                    </td>
                    <td className="py-2.5 pr-4 text-[var(--color-text-primary)]">
                      {formatFcfa(invoice.amount, "fr")}
                    </td>
                    <td className="py-2.5 pr-4 text-[var(--color-text-secondary)]">
                      {invoice.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <Footer
        shopName={SHOP_NAME}
        whatsappNumber={WHATSAPP_NUMBER}
        tagline={SHOP_TAGLINE}
        groups={DEMO_FOOTER_GROUPS}
      />
    </SiteShell>
  );
}
