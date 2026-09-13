"use client";

import { createContext, useContext, useMemo, useState } from "react";

/**
 * Panier — état partagé côté client (voir la revue du 16 septembre 2026, point 2 :
 * « ne conserve aucun faux bouton silencieux »). Volontairement en mémoire seulement
 * (pas de `localStorage`, pas de serveur) : il s'agit de rendre la démonstration
 * réellement interactive, pas d'implémenter un vrai panier persistant — voir la
 * limitation documentée dans le rapport de refonte (Phase 2+ pour la persistance et le
 * paiement réels).
 */
export interface CartLine {
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string;
  variant?: string;
}

interface CartContextValue {
  lines: CartLine[];
  addLine: (input: Omit<CartLine, "quantity"> & { quantity?: number }) => void;
  removeLine: (id: string, variant?: string) => void;
  updateQuantity: (id: string, variant: string | undefined, quantity: number) => void;
  count: number;
  subtotal: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  children,
  initialLines = [],
}: {
  children: React.ReactNode;
  initialLines?: CartLine[];
}) {
  const [lines, setLines] = useState<CartLine[]>(initialLines);

  function addLine(input: Omit<CartLine, "quantity"> & { quantity?: number }) {
    const quantity = input.quantity ?? 1;
    setLines((current) => {
      const existingIndex = current.findIndex(
        (line) => line.id === input.id && line.variant === input.variant,
      );
      if (existingIndex >= 0) {
        const next = [...current];
        const existing = next[existingIndex]!;
        next[existingIndex] = { ...existing, quantity: existing.quantity + quantity };
        return next;
      }
      return [
        ...current,
        {
          id: input.id,
          name: input.name,
          price: input.price,
          imageUrl: input.imageUrl,
          variant: input.variant,
          quantity,
        },
      ];
    });
  }

  function removeLine(id: string, variant?: string) {
    setLines((current) => current.filter((line) => !(line.id === id && line.variant === variant)));
  }

  function updateQuantity(id: string, variant: string | undefined, quantity: number) {
    setLines((current) =>
      current.map((line) =>
        line.id === id && line.variant === variant ? { ...line, quantity: Math.max(1, quantity) } : line,
      ),
    );
  }

  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);

  const value = useMemo(
    () => ({ lines, addLine, removeLine, updateQuantity, count, subtotal }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart() doit être appelé sous <CartProvider> (voir components/site-shell.tsx).");
  return ctx;
}
