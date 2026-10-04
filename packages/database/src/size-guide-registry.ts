import type { Prisma } from "@prisma/client";

/**
 * Guides des tailles modifiables par l'entreprise. Un guide est un tableau libre
 * (tailles, mesures en cm, pointures…) rattaché à une catégorie et remplaçable par
 * produit. Résolution sur la fiche : guide du produit, sinon celui de sa catégorie.
 * Isolation : RLS + clés étrangères composites (un guide d'une autre entreprise ne peut
 * pas être rattaché, même avec son identifiant).
 */

export class SizeGuideError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SizeGuideError";
  }
}

export interface SizeGuideInput {
  name: string;
  columns: string[];
  rows: string[][];
  note?: string | null;
}

export interface SizeGuideView {
  id: string;
  name: string;
  columns: string[];
  rows: string[][];
  note: string | null;
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Normalise et valide un guide ; lève `SizeGuideError` avec un message affichable. */
export function normalizeSizeGuide(input: SizeGuideInput): SizeGuideInput {
  const name = clean(input.name, 80);
  if (!name) throw new SizeGuideError("Donnez un nom au guide (ex. « Robes et hauts femme »).");
  const columns = (Array.isArray(input.columns) ? input.columns : []).map((c) => clean(c, 40));
  if (columns.length < 2 || columns.length > 6) throw new SizeGuideError("Un guide compte de 2 à 6 colonnes : la taille, puis 1 à 5 mesures.");
  if (columns.some((c) => !c)) throw new SizeGuideError("Chaque colonne doit avoir un intitulé.");
  const rows = (Array.isArray(input.rows) ? input.rows : [])
    .map((r) => columns.map((_, k) => clean(Array.isArray(r) ? r[k] : "", 30)))
    .filter((r) => r.some(Boolean));
  if (rows.length < 1 || rows.length > 30) throw new SizeGuideError("Un guide compte de 1 à 30 lignes.");
  if (rows.some((r) => !r[0])) throw new SizeGuideError("Chaque ligne doit indiquer sa taille (première colonne).");
  const sizes = rows.map((r) => r[0]!.toLowerCase());
  if (new Set(sizes).size !== sizes.length) throw new SizeGuideError("Chaque taille ne doit apparaître qu'une fois.");
  const note = clean(input.note ?? "", 300) || null;
  return { name, columns, rows, note };
}

function toView(g: { id: string; name: string; columns: string[]; rows: Prisma.JsonValue; note: string | null }): SizeGuideView {
  return { id: g.id, name: g.name, columns: g.columns, rows: (g.rows as unknown as string[][]) ?? [], note: g.note };
}

async function uniqueName<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (typeof error === "object" && error && (error as { code?: string }).code === "P2002") throw new SizeGuideError("Un guide porte déjà ce nom.");
    throw error;
  }
}

export async function listSizeGuides(tx: Prisma.TransactionClient, tenantId: string) {
  const guides = await tx.sizeGuide.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
  const [cats, prods] = await Promise.all([
    tx.category.groupBy({ by: ["sizeGuideId"], where: { tenantId, sizeGuideId: { not: null } }, _count: true }),
    tx.product.groupBy({ by: ["sizeGuideId"], where: { tenantId, sizeGuideId: { not: null }, status: { not: "ARCHIVED" } }, _count: true }),
  ]);
  const count = (list: { sizeGuideId: string | null; _count: number }[], id: string) => list.find((x) => x.sizeGuideId === id)?._count ?? 0;
  return guides.map((g) => ({ ...toView(g), categories: count(cats, g.id), products: count(prods, g.id) }));
}

export async function createSizeGuide(tx: Prisma.TransactionClient, tenantId: string, input: SizeGuideInput): Promise<SizeGuideView> {
  const v = normalizeSizeGuide(input);
  return uniqueName(async () => toView(await tx.sizeGuide.create({ data: { tenantId, name: v.name, columns: v.columns, rows: v.rows, note: v.note ?? null } })));
}

export async function updateSizeGuide(tx: Prisma.TransactionClient, tenantId: string, id: string, input: SizeGuideInput): Promise<SizeGuideView> {
  const v = normalizeSizeGuide(input);
  const existing = await tx.sizeGuide.findFirst({ where: { id, tenantId } });
  if (!existing) throw new SizeGuideError("Guide introuvable.");
  return uniqueName(async () => toView(await tx.sizeGuide.update({ where: { id }, data: { name: v.name, columns: v.columns, rows: v.rows, note: v.note ?? null } })));
}

/** Supprime un guide après l'avoir détaché de ses catégories et produits. */
export async function deleteSizeGuide(tx: Prisma.TransactionClient, tenantId: string, id: string): Promise<void> {
  const existing = await tx.sizeGuide.findFirst({ where: { id, tenantId } });
  if (!existing) throw new SizeGuideError("Guide introuvable.");
  await tx.category.updateMany({ where: { tenantId, sizeGuideId: id }, data: { sizeGuideId: null } });
  await tx.product.updateMany({ where: { tenantId, sizeGuideId: id }, data: { sizeGuideId: null } });
  await tx.sizeGuide.delete({ where: { id } });
}

async function assertGuide(tx: Prisma.TransactionClient, tenantId: string, guideId: string | null) {
  if (guideId && !(await tx.sizeGuide.findFirst({ where: { id: guideId, tenantId }, select: { id: true } }))) throw new SizeGuideError("Guide introuvable.");
}

export async function setCategorySizeGuide(tx: Prisma.TransactionClient, tenantId: string, categoryId: string, guideId: string | null): Promise<void> {
  await assertGuide(tx, tenantId, guideId);
  const { count } = await tx.category.updateMany({ where: { id: categoryId, tenantId }, data: { sizeGuideId: guideId } });
  if (count !== 1) throw new SizeGuideError("Catégorie introuvable.");
}

export async function setProductSizeGuide(tx: Prisma.TransactionClient, tenantId: string, productId: string, guideId: string | null): Promise<void> {
  await assertGuide(tx, tenantId, guideId);
  const { count } = await tx.product.updateMany({ where: { id: productId, tenantId }, data: { sizeGuideId: guideId } });
  if (count !== 1) throw new SizeGuideError("Produit introuvable.");
}

/** Guide affiché sur la fiche : celui du produit, sinon celui de sa catégorie. */
export async function resolveProductSizeGuide(tx: Prisma.TransactionClient, tenantId: string, productId: string): Promise<SizeGuideView | null> {
  const product = await tx.product.findFirst({ where: { id: productId, tenantId }, select: { sizeGuideId: true, category: { select: { sizeGuideId: true } } } });
  const id = product?.sizeGuideId ?? product?.category?.sizeGuideId ?? null;
  if (!id) return null;
  const guide = await tx.sizeGuide.findFirst({ where: { id, tenantId } });
  return guide ? toView(guide) : null;
}
