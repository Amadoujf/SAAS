"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export interface StoreCartLine {
  id: string;
  productVariantId: string;
  productId: string;
  productName: string;
  variantName: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  availableQuantity: number;
}
export interface StoreCart { id: string; lines: StoreCartLine[]; subtotal: number; itemCount: number }

interface CartContextValue {
  cart: StoreCart | null;
  loading: boolean;
  busyLine: string | null;
  error: string | null;
  notice: string | null;
  open: boolean;
  setOpen: (v: boolean) => void;
  add: (productVariantId: string, quantity: number) => Promise<boolean>;
  update: (lineId: string, quantity: number) => Promise<void>;
  remove: (lineId: string) => Promise<void>;
  replace: (cart: StoreCart | null) => void;
  clearMessages: () => void;
}

const Ctx = createContext<CartContextValue | null>(null);

/**
 * Panier RÉEL de la boutique : l'état fait foi côté serveur (cookie visiteur
 * httpOnly + `Cart` en base). Le navigateur n'envoie jamais un prix : uniquement une
 * variante et une quantité ; chaque réponse renvoie le panier recalculé, affiché tel
 * quel. Un changement de stock ou de prix entre deux visites est donc toujours visible.
 */
export function StoreCartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<StoreCart | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyLine, setBusyLine] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const previous = useRef<StoreCart | null>(null);

  const accept = useCallback((next: StoreCart | null) => {
    // Signale clairement une ligne dont le stock est devenu insuffisant.
    const short = next?.lines.find((l) => l.quantity > l.availableQuantity);
    if (short) {
      setNotice(
        short.availableQuantity === 0
          ? `« ${short.productName} » n'est plus en stock. Retirez-le pour continuer.`
          : `Il ne reste que ${short.availableQuantity} « ${short.productName} » en stock.`,
      );
    }
    previous.current = next;
    setCart(next);
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/storefront/cart", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => alive && accept(json?.cart ?? null))
      .catch(() => alive && setError("Impossible de charger votre panier."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [accept]);

  const call = useCallback(
    async (url: string, init: RequestInit, key: string) => {
      setBusyLine(key);
      setError(null);
      try {
        const res = await fetch(url, { ...init, headers: { "content-type": "application/json" } });
        const json = (await res.json().catch(() => ({}))) as { cart?: StoreCart; error?: string };
        if (!res.ok) {
          setError(json.error ?? "Action impossible pour le moment.");
          return false;
        }
        accept(json.cart ?? null);
        return true;
      } catch {
        setError("Connexion interrompue — vérifiez votre réseau.");
        return false;
      } finally {
        setBusyLine(null);
      }
    },
    [accept],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      cart, loading, busyLine, error, notice, open, setOpen,
      add: async (productVariantId, quantity) => {
        const ok = await call("/api/storefront/cart", { method: "POST", body: JSON.stringify({ productVariantId, quantity }) }, `add:${productVariantId}`);
        if (ok) setOpen(true);
        return ok;
      },
      update: async (lineId, quantity) => {
        // Optimiste pour la sensation de vitesse ; le serveur tranche ensuite.
        setCart((c) => c && { ...c, lines: c.lines.map((l) => (l.id === lineId ? { ...l, quantity, lineTotal: l.unitPrice * quantity } : l)) });
        const ok = await call(`/api/storefront/cart/items/${lineId}`, { method: "PATCH", body: JSON.stringify({ quantity }) }, lineId);
        if (!ok) setCart(previous.current);
      },
      remove: async (lineId) => {
        setNotice(null);
        await call(`/api/storefront/cart/items/${lineId}`, { method: "DELETE" }, lineId);
      },
      replace: accept,
      clearMessages: () => {
        setError(null);
        setNotice(null);
      },
    }),
    [cart, loading, busyLine, error, notice, open, call, accept],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStoreCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStoreCart doit être utilisé sous <StoreCartProvider>.");
  return ctx;
}

export const fcfa = (n: number) => `${new Intl.NumberFormat("fr-SN").format(n)} FCFA`;
