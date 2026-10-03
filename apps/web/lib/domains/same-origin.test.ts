import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "./same-origin";

function req(headers: Record<string, string>, nextHost = "localhost:3000") {
  return { headers: new Headers(headers), nextUrl: { host: nextHost } } as never;
}

describe("isSameOriginRequest", () => {
  it("accepte une requête du domaine public de la boutique, même si Next écoute sur un autre hôte", () => {
    expect(isSameOriginRequest(req({ origin: "https://boutique-aida.sn", host: "boutique-aida.sn" }))).toBe(true);
    expect(isSameOriginRequest(req({ origin: "https://boutique-aida.sn", host: "127.0.0.1:3000", "x-forwarded-host": "boutique-aida.sn" }))).toBe(true);
  });
  it("refuse une origine tierce, une origine absente ou invalide", () => {
    expect(isSameOriginRequest(req({ origin: "https://pirate.example", host: "boutique-aida.sn" }))).toBe(false);
    expect(isSameOriginRequest(req({ host: "boutique-aida.sn" }))).toBe(false);
    expect(isSameOriginRequest(req({ origin: "pas-une-url", host: "boutique-aida.sn" }))).toBe(false);
  });
});
