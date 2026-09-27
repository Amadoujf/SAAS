import { describe, expect, it } from "vitest";
import { addDays, localToUtc, normalizeRanges, slotRefusal, staffDaySlots, utcToLocal, weekdayOf } from "../src/service-slots";

/** Moteur de créneaux (fonctions pures) : fuseau, plages, chevauchements, délais. */
const DAKAR = "Africa/Dakar";
const PARIS = "Europe/Paris";
const hm = (d: Date, tz: string) => {
  const l = utcToLocal(d, tz);
  return `${String(Math.floor(l.minute / 60)).padStart(2, "0")}:${String(l.minute % 60).padStart(2, "0")}`;
};
const base = {
  date: "2030-03-12",
  tz: DAKAR,
  durationMinutes: 60,
  bufferMinutes: 0,
  stepMinutes: 30,
  hours: [{ startMinute: 9 * 60, endMinute: 12 * 60 }],
  busy: [],
  timeOff: [],
  earliest: new Date("2030-01-01T00:00:00Z"),
};

describe("fuseaux horaires", () => {
  it("Dakar (UTC+0) : minute locale = minute UTC", () => {
    expect(localToUtc("2030-03-12", 9 * 60, DAKAR).toISOString()).toBe("2030-03-12T09:00:00.000Z");
  });
  it("Paris : tient compte de l'heure d'été", () => {
    expect(localToUtc("2030-01-15", 9 * 60, PARIS).toISOString()).toBe("2030-01-15T08:00:00.000Z");
    expect(localToUtc("2030-07-15", 9 * 60, PARIS).toISOString()).toBe("2030-07-15T07:00:00.000Z");
    expect(utcToLocal(new Date("2030-07-15T07:00:00Z"), PARIS)).toMatchObject({ date: "2030-07-15", minute: 540 });
  });
  it("jour de la semaine et addition de jours", () => {
    expect(weekdayOf("2030-03-12")).toBe(2); // mardi
    expect(addDays("2030-02-28", 1)).toBe("2030-03-01");
  });
});

describe("plages de travail", () => {
  it("trie et refuse les chevauchements ou plages vides", () => {
    expect(normalizeRanges([{ startMinute: 900, endMinute: 1200 }, { startMinute: 540, endMinute: 780 }]).map((r) => r.startMinute)).toEqual([540, 900]);
    expect(() => normalizeRanges([{ startMinute: 540, endMinute: 780 }, { startMinute: 700, endMinute: 900 }])).toThrow(/chevauchent/);
    expect(() => normalizeRanges([{ startMinute: 600, endMinute: 600 }])).toThrow();
  });
});

describe("horaires proposés", () => {
  it("la prestation tient entièrement dans la plage", () => {
    expect(staffDaySlots(base).map((d) => hm(d, DAKAR))).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00"]);
  });
  it("deux plages dans la journée (pause déjeuner)", () => {
    const slots = staffDaySlots({ ...base, hours: [{ startMinute: 540, endMinute: 660 }, { startMinute: 900, endMinute: 1020 }] });
    expect(slots.map((d) => hm(d, DAKAR))).toEqual(["09:00", "09:30", "10:00", "15:00", "15:30", "16:00"]);
  });
  it("un rendez-vous existant bloque, temps de préparation compris", () => {
    const busy = [{ start: new Date("2030-03-12T10:00:00Z"), end: new Date("2030-03-12T11:00:00Z") }];
    expect(staffDaySlots({ ...base, busy }).map((d) => hm(d, DAKAR))).toEqual(["09:00", "11:00"]);
    // 15 min de préparation après chaque prestation : 09:00 déborderait sur 10:00.
    expect(staffDaySlots({ ...base, busy, bufferMinutes: 15 }).map((d) => hm(d, DAKAR))).toEqual(["11:00"]);
  });
  it("une absence bloque ; le délai minimal écarte les horaires trop proches", () => {
    const timeOff = [{ start: new Date("2030-03-12T09:00:00Z"), end: new Date("2030-03-12T10:30:00Z") }];
    expect(staffDaySlots({ ...base, timeOff }).map((d) => hm(d, DAKAR))).toEqual(["10:30", "11:00"]);
    expect(staffDaySlots({ ...base, earliest: new Date("2030-03-12T10:15:00Z") }).map((d) => hm(d, DAKAR))).toEqual(["10:30", "11:00"]);
  });
});

describe("vérification d'un horaire précis", () => {
  const check = { ...base, start: new Date("2030-03-12T10:00:00Z") };
  it("accepte un horaire libre", () => expect(slotRefusal(check)).toBeNull());
  it("refuse hors horaires, chevauchement, absence, passé, pas non aligné", () => {
    expect(slotRefusal({ ...check, start: new Date("2030-03-12T11:30:00Z") })).toMatch(/heures de travail/);
    expect(slotRefusal({ ...check, busy: [{ start: new Date("2030-03-12T10:30:00Z"), end: new Date("2030-03-12T11:00:00Z") }] })).toMatch(/pris/);
    expect(slotRefusal({ ...check, timeOff: [{ start: new Date("2030-03-12T10:45:00Z"), end: new Date("2030-03-12T12:00:00Z") }] })).toMatch(/absente/);
    expect(slotRefusal({ ...check, earliest: new Date("2030-03-12T10:01:00Z") })).toMatch(/passé/);
    expect(slotRefusal({ ...check, start: new Date("2030-03-12T10:10:00Z"), stepMinutes: 30 })).toMatch(/pas proposé/);
    expect(slotRefusal({ ...check, latest: new Date("2030-03-11T00:00:00Z") })).toMatch(/au-delà/);
  });
});
