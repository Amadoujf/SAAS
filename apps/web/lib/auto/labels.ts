/** Libellés et formats de l'automobile — partagés par le tableau de bord et le site public
 *  (utilisables côté navigateur : aucun accès base). */

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export const FUEL_LABELS: Record<string, string> = { essence: "Essence", diesel: "Diesel", hybride: "Hybride", electrique: "Électrique", gpl: "GPL" };
export const TRANSMISSION_LABELS: Record<string, string> = { manuelle: "Manuelle", automatique: "Automatique" };
export const BODY_LABELS: Record<string, string> = {
  citadine: "Citadine",
  berline: "Berline",
  break: "Break",
  suv: "SUV",
  "4x4": "4×4",
  pickup: "Pick-up",
  monospace: "Monospace",
  coupe: "Coupé",
  utilitaire: "Utilitaire",
};
export const CONDITION_LABELS: Record<string, string> = { new: "Neuf", used: "Occasion", imported_used: "Occasion importée" };
export const FEATURE_LABELS: Record<string, string> = {
  climatisation: "Climatisation",
  gps: "GPS",
  camera_recul: "Caméra de recul",
  radar_recul: "Radar de recul",
  bluetooth: "Bluetooth",
  toit_ouvrant: "Toit ouvrant",
  cuir: "Sièges cuir",
  jantes_alu: "Jantes alliage",
  regulateur: "Régulateur de vitesse",
  "4_roues_motrices": "4 roues motrices",
  carplay: "CarPlay / Android Auto",
  sieges_chauffants: "Sièges chauffants",
};

export const STOCK_LABELS: Record<string, { label: string; tone: Tone; guest: string }> = {
  incoming: { label: "En arrivage", tone: "info", guest: "En arrivage" },
  available: { label: "Disponible", tone: "success", guest: "Disponible" },
  reserved: { label: "Réservé", tone: "warning", guest: "Réservé" },
  sold: { label: "Vendu", tone: "neutral", guest: "Vendu" },
};

export const LEAD_LABELS: Record<string, { label: string; tone: Tone }> = {
  new: { label: "Nouveau", tone: "warning" },
  contacted: { label: "Contacté", tone: "info" },
  test_drive: { label: "Essai", tone: "info" },
  negotiation: { label: "Négociation", tone: "info" },
  won: { label: "Vendu", tone: "success" },
  lost: { label: "Perdu", tone: "neutral" },
};
export const LEAD_FLOW = ["new", "contacted", "test_drive", "negotiation"] as const;
export const INTEREST_LABELS: Record<string, string> = { purchase: "Achat", test_drive: "Essai", trade_in: "Reprise", financing: "Financement", import_request: "Importation sur commande" };
export const SOURCE_LABELS: Record<string, string> = { web: "Site", phone: "Téléphone", whatsapp: "WhatsApp", walk_in: "Showroom" };

export const TEST_DRIVE_LABELS: Record<string, { label: string; tone: Tone; guest: string }> = {
  requested: { label: "À confirmer", tone: "warning", guest: "Demande reçue." },
  confirmed: { label: "Confirmé", tone: "info", guest: "Essai réservé : le véhicule vous attend." },
  completed: { label: "Effectué", tone: "success", guest: "Essai effectué. Merci de votre visite." },
  canceled: { label: "Annulé", tone: "neutral", guest: "Essai annulé." },
  no_show: { label: "Absent", tone: "danger", guest: "Essai non honoré." },
};

export const SALE_LABELS: Record<string, { label: string; tone: Tone }> = {
  requested: { label: "Ouvert", tone: "warning" },
  confirmed: { label: "En cours", tone: "info" },
  completed: { label: "Remis", tone: "success" },
  canceled: { label: "Annulé", tone: "neutral" },
};

export const IMPORT_STAGES = ["purchased", "shipped", "at_port", "customs", "ready"] as const;
export const IMPORT_LABELS: Record<string, { label: string; guest: string; tone: Tone }> = {
  purchased: { label: "Acheté", guest: "Véhicule acheté à l'étranger", tone: "info" },
  shipped: { label: "En mer", guest: "Embarqué : le véhicule est en mer", tone: "info" },
  at_port: { label: "Au port", guest: "Arrivé au port de Dakar", tone: "info" },
  customs: { label: "Dédouanement", guest: "En cours de dédouanement", tone: "warning" },
  ready: { label: "Prêt", guest: "Prêt : disponible au showroom", tone: "success" },
  canceled: { label: "Annulée", guest: "Importation annulée", tone: "neutral" },
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = { cash: "Espèces", wave: "Wave", orange_money: "Orange Money", bank_transfer: "Virement", card_terminal: "Carte (terminal)" };

const nf = new Intl.NumberFormat("fr-FR");
export const formatXof = (n: number | null | undefined) => (n == null ? "Prix sur demande" : `${nf.format(n)} FCFA`);
export const formatKm = (n: number) => `${nf.format(n)} km`;
export const formatNumber = (n: number) => nf.format(n);
export const clockLabel = (m: number) => `${Math.floor(m / 60) % 24} h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;
export const shortDate = (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) =>
  new Intl.DateTimeFormat("fr-FR", { ...opts, timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
export const longDate = (iso: string) => shortDate(iso, { weekday: "long", day: "numeric", month: "long" });
export const addDaysIso = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const timeIn = (d: Date | string, tz: string) =>
  new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(d)).replace(":", " h ");
export const dateIn = (d: Date | string, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(d));
export const dateLabel = (d: Date | string, tz: string) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(new Date(d));

export const WEEKDAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
export function hoursByDay(hours: { weekday: number; startMinute: number; endMinute: number }[]) {
  return [1, 2, 3, 4, 5, 6, 0].map((d) => {
    const r = hours.filter((h) => h.weekday === d).sort((a, b) => a.startMinute - b.startMinute);
    return { day: WEEKDAYS[d]!, text: r.length ? r.map((x) => `${clockLabel(x.startMinute)} – ${clockLabel(x.endMinute)}`).join(", ") : "Fermé" };
  });
}

/** Mensualité indicative (taux et durée affichés, jamais présentée comme une offre de crédit). */
export function monthlyEstimate(price: number, downPayment: number, months: number, annualRatePct: number) {
  const principal = Math.max(0, price - downPayment);
  if (!principal || months <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return Math.round(principal / months);
  return Math.round((principal * r) / (1 - Math.pow(1 + r, -months)));
}
