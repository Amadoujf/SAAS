import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProductCard, type ProductCardData } from "./product-card";
import { CartProvider, useCart } from "@/lib/commerce/cart-context";
import { FavoritesProvider, useFavorites } from "@/lib/commerce/favorites-context";
import { AnimationLevelProvider } from "@/lib/motion/animation-level-context";

/**
 * Preuve que l'ajout au panier et les favoris fonctionnent RÉELLEMENT dans la
 * démonstration (voir la revue du 16 septembre 2026, point 2 : « ne conserve aucun
 * faux bouton silencieux ») — pas seulement une micro-animation locale sans effet.
 */
const PRODUCT: ProductCardData = {
  id: "p1",
  name: "Sac Test",
  price: 10_000,
  imageUrl: "https://images.unsplash.com/photo-test",
};

const OUT_OF_STOCK_PRODUCT: ProductCardData = { ...PRODUCT, id: "p2", inStock: false };

function CartCount() {
  const { count } = useCart();
  return <span data-testid="cart-count">{count}</span>;
}

function FavoritesCount() {
  const { count } = useFavorites();
  return <span data-testid="favorites-count">{count}</span>;
}

function renderWithProviders(ui: React.ReactNode) {
  return render(
    <CartProvider>
      <FavoritesProvider>
        <AnimationLevelProvider level="dynamic">
          <CartCount />
          <FavoritesCount />
          {ui}
        </AnimationLevelProvider>
      </FavoritesProvider>
    </CartProvider>,
  );
}

describe("ProductCard — panier et favoris réellement fonctionnels", () => {
  it("ajoute le produit au panier partagé au clic sur « Ajouter au panier »", () => {
    renderWithProviders(<ProductCard product={PRODUCT} locale="fr" />);

    expect(screen.getByTestId("cart-count")).toHaveTextContent("0");
    fireEvent.click(screen.getByText("Ajouter au panier"));
    expect(screen.getByTestId("cart-count")).toHaveTextContent("1");
  });

  it("bascule le produit dans les favoris partagés au clic sur le cœur", () => {
    renderWithProviders(<ProductCard product={PRODUCT} locale="fr" />);

    expect(screen.getByTestId("favorites-count")).toHaveTextContent("0");
    fireEvent.click(screen.getByRole("button", { name: "Ajouter aux favoris" }));
    expect(screen.getByTestId("favorites-count")).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: "Ajouter aux favoris" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("désactive l'ajout au panier et affiche « Rupture de stock » quand inStock est false", () => {
    renderWithProviders(<ProductCard product={OUT_OF_STOCK_PRODUCT} locale="fr" />);

    // Le badge (span, coin haut-gauche de l'image) ET le bouton d'ajout affichent
    // tous deux « Rupture de stock » — seul le second est un <button>.
    const addToCartButton = screen
      .getAllByText("Rupture de stock")
      .map((el) => el.closest("button"))
      .find((el): el is HTMLButtonElement => el !== null);
    expect(addToCartButton).toBeDisabled();
  });
});
