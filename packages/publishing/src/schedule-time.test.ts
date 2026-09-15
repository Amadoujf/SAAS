import { describe, expect, it } from "vitest";
import { DEFAULT_TENANT_TIMEZONE, resolveScheduledPublishUtc } from "./schedule-time";

describe("resolveScheduledPublishUtc", () => {
  it("Africa/Dakar (UTC+0, sans heure d'été) : l'heure murale égale l'heure UTC", () => {
    const utc = resolveScheduledPublishUtc("2026-09-22T14:30", "Africa/Dakar");
    expect(utc.toISOString()).toBe("2026-09-22T14:30:00.000Z");
  });

  it("utilise Africa/Dakar par défaut quand aucun fuseau n'est fourni", () => {
    const utc = resolveScheduledPublishUtc("2026-09-22T09:00");
    expect(utc.toISOString()).toBe("2026-09-22T09:00:00.000Z");
    expect(DEFAULT_TENANT_TIMEZONE).toBe("Africa/Dakar");
  });

  it("un fuseau en avance sur UTC (Europe/Paris, UTC+2 en été) recule l'heure UTC", () => {
    const utc = resolveScheduledPublishUtc("2026-07-14T14:30", "Europe/Paris");
    expect(utc.toISOString()).toBe("2026-07-14T12:30:00.000Z");
  });

  it("un fuseau en retard sur UTC (America/New_York, UTC-4 en été) avance l'heure UTC", () => {
    const utc = resolveScheduledPublishUtc("2026-07-14T09:00", "America/New_York");
    expect(utc.toISOString()).toBe("2026-07-14T13:00:00.000Z");
  });

  it("gère correctement une transition d'heure d'été (Europe/Paris passe en heure d'hiver fin octobre)", () => {
    // 25 octobre 2026 : la France repasse en UTC+1 (hiver) après 3h locale.
    const winter = resolveScheduledPublishUtc("2026-10-25T10:00", "Europe/Paris");
    expect(winter.toISOString()).toBe("2026-10-25T09:00:00.000Z");
  });

  it("accepte les secondes explicites", () => {
    const utc = resolveScheduledPublishUtc("2026-09-22T14:30:45", "Africa/Dakar");
    expect(utc.toISOString()).toBe("2026-09-22T14:30:45.000Z");
  });

  it("rejette un format de date/heure invalide", () => {
    expect(() => resolveScheduledPublishUtc("22/09/2026 14:30")).toThrow();
  });

  it("rejette un fuseau horaire inconnu", () => {
    expect(() => resolveScheduledPublishUtc("2026-09-22T14:30", "Pas/UnFuseau")).toThrow();
  });
});
