import { describe, expect, it } from "vitest";
import { FakeRegistrarProvider, ManualRegistrarProvider } from "./registrar-provider";

describe("FakeRegistrarProvider", () => {
  it("un domaine jamais enregistré est disponible", async () => {
    const registrar = new FakeRegistrarProvider();
    const result = await registrar.checkAvailability("boutique-test.com");
    expect(result.available).toBe(true);
  });

  it("enregistre un domaine puis le signale indisponible", async () => {
    const registrar = new FakeRegistrarProvider();
    await registrar.register("boutique-test.com", 1, {
      fullName: "Fatou Diop",
      email: "fatou@example.com",
      phone: "+221000000000",
      addressLine1: "Dakar",
      city: "Dakar",
      country: "SN",
    });
    const result = await registrar.checkAvailability("boutique-test.com");
    expect(result.available).toBe(false);
  });

  it("refuse d'enregistrer deux fois le même domaine", async () => {
    const registrar = new FakeRegistrarProvider();
    const contact = {
      fullName: "Fatou Diop",
      email: "fatou@example.com",
      phone: "+221000000000",
      addressLine1: "Dakar",
      city: "Dakar",
      country: "SN",
    };
    await registrar.register("boutique-test.com", 1, contact);
    await expect(registrar.register("boutique-test.com", 1, contact)).rejects.toThrow();
  });

  it("renew() prolonge la date d'expiration", async () => {
    const registrar = new FakeRegistrarProvider();
    const contact = {
      fullName: "Fatou Diop",
      email: "fatou@example.com",
      phone: "+221000000000",
      addressLine1: "Dakar",
      city: "Dakar",
      country: "SN",
    };
    const registered = await registrar.register("boutique-test.com", 1, contact);
    const renewed = await registrar.renew(registered.externalRegistrarId, 1);
    expect(renewed.expiresAt.getTime()).toBeGreaterThan(registered.expiresAt.getTime());
  });
});

describe("ManualRegistrarProvider", () => {
  it("register()/renew()/requestTransfer() lèvent explicitement (aucune automatisation)", async () => {
    const registrar = new ManualRegistrarProvider();
    const contact = {
      fullName: "x",
      email: "x@example.com",
      phone: "x",
      addressLine1: "x",
      city: "x",
      country: "SN",
    };
    await expect(registrar.register("x.com", 1, contact)).rejects.toThrow();
    await expect(registrar.renew("ext-1", 1)).rejects.toThrow();
    await expect(registrar.requestTransfer("x.com", "AUTH", contact)).rejects.toThrow();
  });
});
