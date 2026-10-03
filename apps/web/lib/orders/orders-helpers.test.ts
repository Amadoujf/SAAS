import { describe, expect, it } from "vitest";
import { csvCell } from "./csv";
import { parseOrderFilters } from "./filters";
import { ORDER_STATUS_META, progressIndex } from "@/lib/commerce/order-status-meta";

describe("export CSV", () => {
  it("neutralise l'injection de formule et échappe les séparateurs", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell("+221770000000")).toBe("'+221770000000");
    expect(csvCell("Dakar; Plateau")).toBe('"Dakar; Plateau"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(45000)).toBe("45000");
  });
});

describe("filtres de commandes (URL → serveur)", () => {
  it("traduit les files lisibles en filtres serveur", () => {
    expect(parseOrderFilters({ file: "a-traiter" }).status).toBe("to_process");
    expect(parseOrderFilters({ file: "preuves" }).status).toBe("awaiting_proof");
    expect(parseOrderFilters({ file: "livraison" }).status).toBe("in_delivery");
  });
  it("ignore un statut inconnu, borne la recherche et pagine", () => {
    const f = parseOrderFilters({ statut: "DROP TABLE", q: "x".repeat(200), page: "3" });
    expect(f.status).toBeUndefined();
    expect(f.search).toHaveLength(80);
    expect(f.skip).toBe(50);
  });
  it("date de fin inclusive (jusqu'à 23:59:59)", () => {
    expect(parseOrderFilters({ au: "2026-09-26" }).to!.getHours()).toBe(23);
    expect(parseOrderFilters({ du: "pas-une-date" }).from).toBeUndefined();
  });
});

describe("présentation des statuts", () => {
  it("une commande en attente de paiement n'est jamais libellée « payée »", () => {
    expect(ORDER_STATUS_META.AWAITING_PAYMENT!.customerLabel).not.toMatch(/pay[ée]e/i);
    expect(ORDER_STATUS_META.AWAITING_PAYMENT!.tone).toBe("warning");
  });
  it("progression client : retrait sans étape « en route »", () => {
    expect(progressIndex("AWAITING_PAYMENT", "delivery")).toBe(0);
    expect(progressIndex("CONFIRMED", "delivery")).toBe(1);
    expect(progressIndex("SHIPPED", "delivery")).toBe(3);
    expect(progressIndex("DELIVERED", "pickup")).toBe(4);
    expect(progressIndex("CANCELED", "delivery")).toBe(-1);
  });
});
