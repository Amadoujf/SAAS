import { afterEach, describe, expect, it } from "vitest";
import { getStorageProvider, resetStorageProviderCache } from "./registry";
import { LocalStorageProvider } from "./local-provider";
import { R2StorageProvider } from "./r2-provider";

afterEach(() => {
  resetStorageProviderCache();
});

const LOCAL_CONFIG = {
  kind: "local" as const,
  local: {
    rootDir: "/tmp/does-not-need-to-exist-for-construction",
    uploadBaseUrl: "http://localhost/api/media/local-upload",
    downloadBaseUrl: "http://localhost/api/media/local-serve",
    signingSecret: "secret",
  },
};

const R2_CONFIG = {
  kind: "r2" as const,
  r2: {
    accountId: "acc",
    bucket: "bucket",
    accessKeyId: "key",
    secretAccessKey: "secret",
  },
};

describe("getStorageProvider", () => {
  it("construit un LocalStorageProvider pour kind: 'local'", () => {
    expect(getStorageProvider(LOCAL_CONFIG)).toBeInstanceOf(LocalStorageProvider);
  });

  it("construit un R2StorageProvider pour kind: 'r2'", () => {
    expect(getStorageProvider(R2_CONFIG)).toBeInstanceOf(R2StorageProvider);
  });

  it("réutilise la même instance pour une configuration identique", () => {
    const a = getStorageProvider(LOCAL_CONFIG);
    const b = getStorageProvider(LOCAL_CONFIG);
    expect(a).toBe(b);
  });

  it("reconstruit une nouvelle instance si la configuration change (ex. bascule R2 -> local)", () => {
    const local = getStorageProvider(LOCAL_CONFIG);
    const r2 = getStorageProvider(R2_CONFIG);
    expect(local).not.toBe(r2);
  });

  it("lève une erreur claire si la configuration du fournisseur choisi est manquante", () => {
    expect(() => getStorageProvider({ kind: "local" })).toThrow(/configuration 'local' manquante/);
    expect(() => getStorageProvider({ kind: "r2" })).toThrow(/configuration 'r2' manquante/);
  });
});
