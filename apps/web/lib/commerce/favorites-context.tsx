"use client";

import { createContext, useContext, useMemo, useState } from "react";

/**
 * Favoris — état partagé côté client, même politique que le panier (voir
 * cart-context.tsx) : en mémoire seulement, pour rendre le bouton favoris réellement
 * fonctionnel dans la démonstration plutôt qu'un simple bouton silencieux (revue du
 * 16 septembre 2026, point 2).
 */
export interface FavoriteItem {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  href?: string;
}

interface FavoritesContextValue {
  items: FavoriteItem[];
  isFavorited: (id: string) => boolean;
  toggle: (item: FavoriteItem) => void;
  count: number;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<FavoriteItem[]>([]);

  function toggle(item: FavoriteItem) {
    setItems((current) =>
      current.some((existing) => existing.id === item.id)
        ? current.filter((existing) => existing.id !== item.id)
        : [...current, item],
    );
  }

  function isFavorited(id: string) {
    return items.some((item) => item.id === id);
  }

  const value = useMemo(
    () => ({ items, isFavorited, toggle, count: items.length }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx)
    throw new Error("useFavorites() doit être appelé sous <FavoritesProvider> (voir components/site-shell.tsx).");
  return ctx;
}
