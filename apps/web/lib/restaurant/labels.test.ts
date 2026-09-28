import { describe, expect, it } from "vitest";
import { clockLabel, hoursByDay, optionsText, readyGuestLabel, timeIn } from "./labels";

describe("libellés du restaurant", () => {
  it("horaires regroupés par jour, lundi en premier, jours fermés signalés", () => {
    const h = hoursByDay([
      { weekday: 1, startMinute: 18 * 60, endMinute: 23 * 60 },
      { weekday: 1, startMinute: 11 * 60 + 30, endMinute: 15 * 60 },
      { weekday: 0, startMinute: 12 * 60, endMinute: 1440 },
    ]);
    expect(h[0]).toEqual({ day: "Lundi", text: "11 h30 – 15 h, 18 h – 23 h" });
    expect(h[1]).toEqual({ day: "Mardi", text: "Fermé" });
    expect(h[6]).toEqual({ day: "Dimanche", text: "12 h – 0 h" });
  });

  it("options d'une ligne : suppléments visibles, inclus sans prix", () => {
    expect(optionsText([{ group: "Accompagnement", option: "Attiéké", priceDelta: 500 }, { group: "Sauce", option: "Piment", priceDelta: 0 }])).toBe("Attiéké (+500), Piment");
    expect(optionsText(null)).toBe("");
  });

  it("heure locale dans le fuseau du restaurant", () => {
    expect(timeIn(new Date("2026-10-01T12:45:00Z"), "Africa/Dakar")).toBe("12 h 45");
    expect(clockLabel(19 * 60 + 5)).toBe("19 h05");
  });

  it("« prête » dit au client quoi faire selon le mode", () => {
    expect(readyGuestLabel("takeaway")).toMatch(/venir la retirer/);
    expect(readyGuestLabel("delivery")).toMatch(/livraison/);
    expect(readyGuestLabel("dine_in")).toMatch(/table/);
  });
});
