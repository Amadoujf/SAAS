import { describe, expect, it } from "vitest";
import { paymentSplit, periodWindows, trendPercent } from "./dashboard-insights";

describe("dashboard-insights — calculs purs", () => {
  it("« ce mois-ci » se compare au même nombre de jours du mois précédent", () => {
    const now = new Date("2026-09-26T12:00:00Z");
    const { current, previous } = periodWindows("month", now);
    expect(current.from.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(previous.from.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(previous.to.toISOString()).toBe("2026-08-26T12:00:00.000Z");
  });

  it("le mois précédent plus court n'est jamais dépassé (31 mars → février)", () => {
    const { previous } = periodWindows("month", new Date("2026-03-31T10:00:00Z"));
    expect(previous.to.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("7 / 30 / 90 jours : deux fenêtres contiguës de même durée", () => {
    const now = new Date("2026-09-26T00:00:00Z");
    const { current, previous } = periodWindows("7d", now);
    expect(current.from.toISOString()).toBe("2026-09-19T00:00:00.000Z");
    expect(previous.to).toEqual(current.from);
    expect(previous.from.toISOString()).toBe("2026-09-12T00:00:00.000Z");
  });

  it("tendance : jamais inventée sans base de comparaison", () => {
    expect(trendPercent(112, 100)).toBe(12);
    expect(trendPercent(90, 120)).toBe(-25);
    expect(trendPercent(50, 0)).toBeNull();
  });

  it("répartition des paiements : total exact de 100 %, méthodes inconnues ignorées", () => {
    const split = paymentSplit([
      { paymentMethod: "manual_wave", count: 1 },
      { paymentMethod: "manual_orange_money", count: 1 },
      { paymentMethod: "cod", count: 1 },
      { paymentMethod: "inconnu", count: 5 },
    ]);
    expect(split.total).toBe(3);
    expect(split.items.map((i) => i.method)).toEqual(["wave", "orange_money", "cod"]);
    expect(split.items.reduce((s, i) => s + i.percent, 0)).toBe(100);
    expect(paymentSplit([]).items).toEqual([]);
  });
});
