import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YamaCommerce AI",
  description: "Plateforme SaaS multi-entreprises pour le Sénégal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
