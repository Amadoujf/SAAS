import { describe, expect, it } from "vitest";
import { computeExpectedDnsRecords } from "./dns-instructions";

describe("computeExpectedDnsRecords", () => {
  it("demande un enregistrement A pour un domaine apex", () => {
    const records = computeExpectedDnsRecords("boutiquefatou.com", "token-123");
    const aRecord = records.find((r) => r.type === "A");
    expect(aRecord).toBeDefined();
    expect(aRecord?.host).toBe("@");
  });

  it("demande un enregistrement CNAME pour un sous-domaine (ex. www)", () => {
    const records = computeExpectedDnsRecords("www.boutiquefatou.com", "token-123");
    const cname = records.find((r) => r.type === "CNAME");
    expect(cname).toBeDefined();
    expect(cname?.host).toBe("www");
  });

  it("inclut toujours l'enregistrement TXT de vérification avec le bon jeton", () => {
    const records = computeExpectedDnsRecords("boutiquefatou.com", "mon-jeton-secret");
    const txt = records.find((r) => r.type === "TXT");
    expect(txt).toBeDefined();
    expect(txt?.host).toBe("_yamacommerce-verification.boutiquefatou.com");
    expect(txt?.value).toBe("mon-jeton-secret");
  });
});
