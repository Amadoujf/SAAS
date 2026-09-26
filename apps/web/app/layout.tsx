import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import "./globals.css";

/** Typographies YamaCommerce : titres expressifs (Bricolage Grotesque) et interface
 *  extrêmement lisible (Inter, chiffres tabulaires). Exposées en variables CSS
 *  uniquement — elles ne s'imposent jamais aux sites des entreprises, qui gardent
 *  leurs propres polices (design tokens). */
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-yc-display", display: "swap" });
const ui = Inter({ subsets: ["latin"], variable: "--font-yc-ui", display: "swap" });

export const metadata: Metadata = {
  title: "YamaCommerce — La boutique en ligne pensée pour l'Afrique",
  description:
    "Créez votre boutique, encaissez via Wave, Orange Money ou à la livraison, et gérez commandes et livraisons depuis un seul tableau de bord.",
};

export const viewport: Viewport = { themeColor: "#0a102a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${ui.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
