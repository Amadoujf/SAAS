/**
 * Moteur de créneaux des salons — fonctions PURES (aucun accès base), testées à part.
 *
 * Tout est calculé dans le fuseau du salon (`Tenant.timezone`, « Africa/Dakar » par
 * défaut) : les horaires de travail sont des minutes depuis minuit en heure locale,
 * les rendez-vous des instants UTC. La conversion passe par `Intl`, donc un salon situé
 * dans un fuseau à heure d'été reste juste.
 *
 * Un horaire proposé [début, début + durée + préparation) doit :
 * - tenir dans une plage de travail de la personne (la préparation peut déborder après
 *   la fermeture, pas la prestation elle-même) ;
 * - ne chevaucher ni une absence, ni une plage déjà bloquée ;
 * - respecter le délai minimal et la fenêtre de réservation en ligne.
 */

export interface MinuteRange {
  startMinute: number;
  endMinute: number;
}

export interface Interval {
  start: Date;
  end: Date;
}

const MINUTE = 60_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Décalage (minutes) du fuseau `tz` par rapport à UTC à l'instant `at`. */
export function tzOffsetMinutes(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / MINUTE);
}

/** Instant UTC correspondant à `date` (AAAA-MM-JJ) + `minute` en heure locale du salon. */
export function localToUtc(date: string, minute: number, tz: string): Date {
  const naive = new Date(`${date}T00:00:00Z`).getTime() + minute * MINUTE;
  // Deux passes : le décalage peut changer entre l'estimation et l'instant réel (heure d'été).
  let offset = tzOffsetMinutes(new Date(naive), tz);
  offset = tzOffsetMinutes(new Date(naive - offset * MINUTE), tz);
  return new Date(naive - offset * MINUTE);
}

/** Date locale (AAAA-MM-JJ) et minute locale d'un instant, dans le fuseau du salon. */
export function utcToLocal(at: Date, tz: string): { date: string; minute: number; weekday: number } {
  const local = new Date(at.getTime() + tzOffsetMinutes(at, tz) * MINUTE);
  return { date: local.toISOString().slice(0, 10), minute: local.getUTCHours() * 60 + local.getUTCMinutes(), weekday: local.getUTCDay() };
}

/** Jour de la semaine (0 = dimanche) d'une date locale. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

/** Plages d'une journée : triées, valides, sans chevauchement (sinon erreur lisible). */
export function normalizeRanges(ranges: MinuteRange[]): MinuteRange[] {
  const sorted = [...ranges].sort((a, b) => a.startMinute - b.startMinute);
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i]!;
    if (!Number.isInteger(r.startMinute) || !Number.isInteger(r.endMinute) || r.startMinute < 0 || r.endMinute > 1440 || r.startMinute >= r.endMinute) {
      throw new RangeError("Chaque plage horaire a un début avant sa fin, dans la journée.");
    }
    if (i > 0 && sorted[i - 1]!.endMinute > r.startMinute) throw new RangeError("Deux plages horaires du même jour se chevauchent.");
  }
  return sorted;
}

export interface StaffDayInput {
  /** Date locale du salon (AAAA-MM-JJ). */
  date: string;
  tz: string;
  durationMinutes: number;
  bufferMinutes: number;
  stepMinutes: number;
  /** Plages de travail de CE jour de la semaine. */
  hours: MinuteRange[];
  /** Plages déjà bloquées (rendez-vous actifs, préparation comprise). */
  busy: Interval[];
  timeOff: Interval[];
  /** Aucun horaire avant cet instant (maintenant + délai minimal). */
  earliest: Date;
  /** Aucun horaire après cet instant (fenêtre de réservation). */
  latest?: Date | null;
}

/** Horaires de début libres d'une personne pour une prestation, un jour donné. */
export function staffDaySlots(input: StaffDayInput): Date[] {
  const out: Date[] = [];
  const blockMs = (input.durationMinutes + input.bufferMinutes) * MINUTE;
  for (const range of input.hours) {
    for (let m = range.startMinute; m + input.durationMinutes <= range.endMinute; m += input.stepMinutes) {
      const start = localToUtc(input.date, m, input.tz);
      if (start < input.earliest) continue;
      if (input.latest && start > input.latest) continue;
      const block = { start, end: new Date(start.getTime() + blockMs) };
      if (input.busy.some((b) => overlaps(block, b))) continue;
      if (input.timeOff.some((t) => overlaps({ start, end: new Date(start.getTime() + input.durationMinutes * MINUTE) }, t))) continue;
      out.push(start);
    }
  }
  return out;
}

export interface SlotCheckInput extends Omit<StaffDayInput, "date" | "stepMinutes"> {
  start: Date;
  /** Exiger un horaire aligné sur le pas du salon (site public). */
  stepMinutes?: number | null;
}

/** Raison pour laquelle un horaire précis est refusé, ou `null` s'il est libre. */
export function slotRefusal(input: SlotCheckInput): string | null {
  const { start } = input;
  if (start < input.earliest) return "Cet horaire est trop proche ou déjà passé.";
  if (input.latest && start > input.latest) return "Cet horaire est au-delà de la période ouverte à la réservation.";
  const local = utcToLocal(start, input.tz);
  if (input.stepMinutes && local.minute % input.stepMinutes !== 0) return "Cet horaire n'est pas proposé.";
  const fits = input.hours.some((r) => local.minute >= r.startMinute && local.minute + input.durationMinutes <= r.endMinute);
  if (!fits) return "Cet horaire est en dehors des heures de travail.";
  const serviceEnd = new Date(start.getTime() + input.durationMinutes * MINUTE);
  if (input.timeOff.some((t) => overlaps({ start, end: serviceEnd }, t))) return "Cette personne est absente à cet horaire.";
  const block = { start, end: new Date(start.getTime() + (input.durationMinutes + input.bufferMinutes) * MINUTE) };
  if (input.busy.some((b) => overlaps(block, b))) return "Cet horaire vient d'être pris.";
  return null;
}
