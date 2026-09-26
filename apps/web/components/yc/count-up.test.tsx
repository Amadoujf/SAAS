import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("framer-motion", async (orig) => ({ ...(await orig<typeof import("framer-motion")>()), useReducedMotion: () => true }));

describe("CountUp — animations réduites", () => {
  it("affiche immédiatement la valeur finale, sans animation, si l'utilisateur réduit les animations", async () => {
    const { CountUp } = await import("./count-up");
    render(<CountUp value={125000} format="fcfa" />);
    expect(screen.getByText(/125\s000/)).toBeInTheDocument();
  });
});
