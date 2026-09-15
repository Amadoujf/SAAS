/**
 * Conversion heure-locale-du-tenant → instant UTC — voir docs/12 §12.3, « PUBLICATION
 * PROGRAMMÉE » : « Gérer correctement le fuseau horaire configuré par l'entreprise,
 * avec Africa/Dakar par défaut. ». BullMQ (`delay`) et Postgres (`scheduledAt`) ne
 * connaissent que des instants UTC — cette fonction est le SEUL endroit qui convertit
 * une heure murale ("22/09/2026 14:30") + un fuseau ("Africa/Dakar") en `Date` UTC,
 * pour qu'aucun autre module n'ait à réimplémenter cette arithmétique.
 *
 * Algorithme standard (le même que `date-fns-tz` `zonedTimeToUtc`) : on devine un
 * instant UTC candidat égal aux champs muraux, on mesure le décalage réel du fuseau à
 * CET instant via `Intl.DateTimeFormat`, puis on corrige — répété deux fois pour
 * converger même près d'une transition d'heure d'été (sans effet pour Africa/Dakar,
 * qui n'observe aucune heure d'été).
 */

export const DEFAULT_TENANT_TIMEZONE = "Africa/Dakar";

interface NaiveDateTimeFields {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Accepte "YYYY-MM-DDTHH:mm" ou "YYYY-MM-DDTHH:mm:ss" (format natif d'un
 *  `<input type="datetime-local">`) — jamais de suffixe de fuseau, qui serait ambigu
 *  avec le paramètre `timeZone` séparé. */
function parseNaiveDateTime(dateTimeLocal: string): NaiveDateTimeFields {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(dateTimeLocal);
  if (!match) {
    throw new Error(
      `resolveScheduledPublishUtc : format de date/heure invalide "${dateTimeLocal}" ` +
        `(attendu "YYYY-MM-DDTHH:mm").`,
    );
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: match[6] ? Number(match[6]) : 0,
  };
}

/** Décalage (en ms) du fuseau `timeZone` par rapport à UTC, tel qu'observé à l'instant
 *  `utcMs` — positif pour un fuseau en avance sur UTC. */
function timeZoneOffsetMsAt(utcMs: number, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const localAsUtcMs = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return localAsUtcMs - utcMs;
}

/**
 * Convertit une heure murale locale (ex. "2026-09-22T14:30" à "Africa/Dakar") en
 * instant UTC réel — voir la note de tête de fichier pour l'algorithme. Lève si
 * `timeZone` n'est pas reconnu par `Intl` (fuseau mal configuré côté tenant, mieux
 * vaut échouer tôt qu'ignorer silencieusement le fuseau demandé).
 */
export function resolveScheduledPublishUtc(
  dateTimeLocal: string,
  timeZone: string = DEFAULT_TENANT_TIMEZONE,
): Date {
  const naive = parseNaiveDateTime(dateTimeLocal);
  try {
    Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    throw new Error(`resolveScheduledPublishUtc : fuseau horaire inconnu "${timeZone}".`);
  }

  const naiveAsUtcMs = Date.UTC(
    naive.year,
    naive.month - 1,
    naive.day,
    naive.hour,
    naive.minute,
    naive.second,
  );

  let candidateMs = naiveAsUtcMs;
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const offsetMs = timeZoneOffsetMsAt(candidateMs, timeZone);
    const nextCandidateMs = naiveAsUtcMs - offsetMs;
    if (nextCandidateMs === candidateMs) break;
    candidateMs = nextCandidateMs;
  }

  return new Date(candidateMs);
}
