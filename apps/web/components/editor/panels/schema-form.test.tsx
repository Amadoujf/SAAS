import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { z } from "zod";
import { describeObjectSchema } from "@/lib/editor/schema-introspect";
import { SchemaForm } from "./schema-form";

const testSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  displayCount: z.number().int().min(1).max(12).default(6),
  showBanner: z.boolean().default(false),
  radius: z.enum(["sm", "md", "lg"]).optional(),
  categoryIds: z.array(z.string()).optional(),
  media: z.object({ url: z.string().url(), alt: z.string().optional() }),
  items: z.array(z.object({ label: z.string() })).min(0).max(3),
});

function setup(overrides?: { value?: Record<string, unknown>; original?: Record<string, unknown> }) {
  const fields = describeObjectSchema(testSchema);
  const onChange = vi.fn();
  render(
    <SchemaForm
      fields={fields}
      value={overrides?.value ?? { title: "Bonjour", media: { url: "https://x.test/a.jpg" }, items: [] }}
      onChange={onChange}
      originalValue={overrides?.original}
    />,
  );
  return { onChange };
}

describe("SchemaForm — champs simples", () => {
  it("affiche un champ texte pré-rempli et propage les modifications", () => {
    const { onChange } = setup();
    const input = screen.getByLabelText(/^Titre/) as HTMLInputElement;
    expect(input.value).toBe("Bonjour");
    fireEvent.change(input, { target: { value: "Nouveau titre" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Nouveau titre" }),
    );
  });

  it("affiche une case à cocher pour un booléen", () => {
    const { onChange } = setup();
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ showBanner: true }));
  });

  it("affiche un menu déroulant pour une énumération, avec option d'héritage si optionnel", () => {
    setup();
    const select = screen.getByLabelText("Arrondi") as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toEqual(["", "sm", "md", "lg"]);
  });

  it("affiche un champ objet imbriqué (media) avec ses propres sous-champs", () => {
    setup();
    expect(screen.getByLabelText("Lien", { exact: false })).toBeInTheDocument();
  });
});

describe("SchemaForm — liste d'identifiants", () => {
  it("ajoute un identifiant via le bouton Ajouter", () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByPlaceholderText(/Identifiant/), { target: { value: "cat-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ categoryIds: ["cat-1"] }));
  });
});

describe("SchemaForm — tableau d'objets", () => {
  it("ajoute puis supprime un élément", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Ajouter éléments/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ items: [{ label: "" }] }));
  });

  it("empêche de dépasser le maximum d'éléments (3)", () => {
    setup({
      value: {
        title: "x",
        media: { url: "https://x.test/a.jpg" },
        items: [{ label: "a" }, { label: "b" }, { label: "c" }],
      },
    });
    expect(screen.getByRole("button", { name: /Ajouter éléments/i })).toBeDisabled();
  });
});

describe("SchemaForm — indicateur de personnalisation et réinitialisation", () => {
  it("affiche l'indicateur et le bouton de réinitialisation quand la valeur diffère de l'original", () => {
    const { onChange } = setup({
      value: { title: "Modifié", media: { url: "https://x.test/a.jpg" }, items: [] },
      original: { title: "Original", media: { url: "https://x.test/a.jpg" }, items: [] },
    });
    const resetButton = screen.getByRole("button", { name: "Réinitialiser Titre" });
    fireEvent.click(resetButton);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ title: "Original" }));
  });

  it("n'affiche pas de bouton de réinitialisation quand la valeur est identique à l'original", () => {
    setup({
      value: { title: "Identique", media: { url: "https://x.test/a.jpg" }, items: [] },
      original: { title: "Identique", media: { url: "https://x.test/a.jpg" }, items: [] },
    });
    expect(screen.queryByRole("button", { name: "Réinitialiser Titre" })).not.toBeInTheDocument();
  });
});

describe("SchemaForm — erreurs de validation", () => {
  it("affiche les messages d'erreur passés en prop sous le champ concerné", () => {
    const fields = describeObjectSchema(testSchema);
    render(
      <SchemaForm
        fields={fields}
        value={{ title: "", media: { url: "" }, items: [] }}
        onChange={vi.fn()}
        errors={{ title: ["Ce champ est requis."] }}
      />,
    );
    expect(screen.getByText("Ce champ est requis.")).toBeInTheDocument();
  });
});
