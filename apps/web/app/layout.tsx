import type { Metadata, Viewport } from "next";
import "./globals.css";


export const metadata: Metadata = {
  title: "Y-COM — La boutique en ligne pensée pour l'Afrique",
  description:
    "Créez votre boutique, encaissez via Wave, Orange Money ou à la livraison, et gérez commandes et livraisons depuis un seul tableau de bord.",
};

export const viewport: Viewport = { themeColor: "#0a102a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
