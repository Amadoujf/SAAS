import { Bricolage_Grotesque, Inter } from "next/font/google";

/**
 * Typographies YamaCommerce — importées UNIQUEMENT par les pages de l'univers
 * YamaCommerce (vitrine, connexion, onboarding, dashboard, documents). Next.js ne
 * précharge une police que sur les routes qui l'importent : les boutiques des
 * entreprises (autres domaines, leurs propres polices) ne la téléchargent jamais,
 * et les pages YamaCommerce l'ont préchargée (aucun saut de mise en page).
 */
// Une seule graisse pour les titres (600) : ~20 kB au lieu du fichier variable complet.
const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600"], variable: "--font-yc-display", display: "swap" });
const ui = Inter({ subsets: ["latin"], variable: "--font-yc-ui", display: "swap" });

export const ycFontVariables = `${display.variable} ${ui.variable}`;
