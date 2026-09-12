/**
 * Socle d'internationalisation — adjustement #10. Français par défaut, architecture
 * prête pour l'anglais et le wolof dès le départ : aucune chaîne d'interface ne doit
 * être écrite en dur dans les composants, même en Phase 0.
 *
 * Ce dictionnaire minimal sera étendu au fil des fonctionnalités (Phase 1+) ; le
 * mécanisme (clé plate → traduction par langue) ne change pas.
 */
export const SUPPORTED_LOCALES = ["fr", "en", "wo"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";

const dictionaries: Record<Locale, Record<string, string>> = {
  fr: {
    "landing.title": "Créez et vendez des sites professionnels au Sénégal",
    "landing.cta": "Se connecter",
    "auth.login.title": "Connexion",
    "auth.login.email": "Adresse e-mail",
    "auth.login.password": "Mot de passe",
    "auth.login.submit": "Se connecter",
    "auth.login.error": "Identifiants invalides.",
    "dashboard.welcome": "Bienvenue",
    "dashboard.no_tenant": "Vous n'êtes rattaché à aucune entreprise pour le moment.",
    "admin.title": "Super Admin — YamaCommerce AI",
    "admin.tenants": "Entreprises",
  },
  en: {
    "landing.title": "Build and sell professional websites in Senegal",
    "landing.cta": "Sign in",
    "auth.login.title": "Sign in",
    "auth.login.email": "Email address",
    "auth.login.password": "Password",
    "auth.login.submit": "Sign in",
    "auth.login.error": "Invalid credentials.",
    "dashboard.welcome": "Welcome",
    "dashboard.no_tenant": "You are not attached to any business yet.",
    "admin.title": "Super Admin — YamaCommerce AI",
    "admin.tenants": "Businesses",
  },
  wo: {
    "landing.title": "Sos te jaay sites pro ci Senegaal",
    "landing.cta": "Dugg",
    "auth.login.title": "Dugg",
    "auth.login.email": "Email bi",
    "auth.login.password": "Baatu-tééré",
    "auth.login.submit": "Dugg",
    "auth.login.error": "Xibaar yi jubuwuñu.",
    "dashboard.welcome": "Dalal ak jàmm",
    "dashboard.no_tenant": "Amuloo entreprise leegi.",
    "admin.title": "Super Admin — YamaCommerce AI",
    "admin.tenants": "Entreprise yi",
  },
};

export function t(locale: Locale, key: string): string {
  return dictionaries[locale]?.[key] ?? dictionaries[DEFAULT_LOCALE][key] ?? key;
}
