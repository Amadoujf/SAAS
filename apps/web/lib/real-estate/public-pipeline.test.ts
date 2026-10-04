import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@yamacommerce/queue", () => ({ RedisRateLimiter: class { consume() { return Promise.resolve({ allowed: true }); } }, redisConnection: {} }));
vi.mock("@yamacommerce/database", () => ({ withTenant: vi.fn(), requestPropertyVisit: vi.fn(), cancelReservationByCustomer: vi.fn(), VISIT_MODULE: "visit_requests" }));

const { visitRequestSchema, submitVisitRequest, VisitRequestError } = await import("./public-pipeline");

const base = { slug: "villa", date: "2099-01-10", time: "10:00", firstName: "Awa", phone: "771234567" };

describe("demande de visite publique", () => {
  it("accepte un créneau de 8 h à 18 h 30, refuse la nuit", () => {
    expect(visitRequestSchema.safeParse(base).success).toBe(true);
    expect(visitRequestSchema.safeParse({ ...base, time: "18:30" }).success).toBe(true);
    expect(visitRequestSchema.safeParse({ ...base, time: "23:00" }).success).toBe(false);
    expect(visitRequestSchema.safeParse({ ...base, time: "07:30" }).success).toBe(false);
  });

  it("exige prénom et téléphone", () => {
    expect(visitRequestSchema.safeParse({ ...base, firstName: "" }).success).toBe(false);
    expect(visitRequestSchema.safeParse({ ...base, phone: "12" }).success).toBe(false);
  });

  it("refuse une date passée avant tout accès à la base", async () => {
    await expect(submitVisitRequest("t1", "v1", { ...base, date: "2020-01-01" })).rejects.toBeInstanceOf(VisitRequestError);
  });
});
