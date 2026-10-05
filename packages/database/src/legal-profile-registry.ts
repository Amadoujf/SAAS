import type { Prisma } from "@prisma/client";

/**
 * Informations légales d'une entreprise (mentions légales, conditions de vente,
 * confidentialité de SON site). Tout est facultatif : la page publique montre ce qui est
 * renseigné et signale ce qui manque, sans jamais inventer une raison sociale ou un
 * numéro d'immatriculation. Isolation : RLS (une entreprise ne lit ni n'écrit la fiche
 * d'une autre).
 */

export class LegalProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LegalProfileError";
  }
}

export interface LegalProfileInput {
  legalName?: string | null;
  legalForm?: string | null;
  ninea?: string | null;
  rccm?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  publicationDirector?: string | null;
  returnPolicy?: string | null;
  additionalTerms?: string | null;
}

export type LegalProfileView = { [K in keyof LegalProfileInput]-?: string | null } & { updatedAt: Date | null };

const LIMITS: Record<keyof LegalProfileInput, number> = {
  legalName: 120,
  legalForm: 60,
  ninea: 30,
  rccm: 40,
  address: 240,
  email: 120,
  phone: 30,
  publicationDirector: 120,
  returnPolicy: 3000,
  additionalTerms: 6000,
};

const LABELS: Record<keyof LegalProfileInput, string> = {
  legalName: "La raison sociale",
  legalForm: "La forme juridique",
  ninea: "Le NINEA",
  rccm: "Le numéro RCCM",
  address: "L'adresse",
  email: "L'e-mail",
  phone: "Le téléphone",
  publicationDirector: "Le responsable de la publication",
  returnPolicy: "La politique de retour",
  additionalTerms: "Les conditions complémentaires",
};

const MULTILINE = new Set<keyof LegalProfileInput>(["returnPolicy", "additionalTerms"]);
const FIELDS = Object.keys(LIMITS) as (keyof LegalProfileInput)[];

function clean(field: keyof LegalProfileInput, value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new LegalProfileError(`${LABELS[field]} doit être un texte.`);
  const text = MULTILINE.has(field)
    ? value.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()
    : value.replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (text.length > LIMITS[field]) throw new LegalProfileError(`${LABELS[field]} dépasse ${LIMITS[field]} caractères.`);
  return text;
}

/** Normalise et valide ; lève `LegalProfileError` avec un message affichable. */
export function normalizeLegalProfile(input: LegalProfileInput): Required<LegalProfileInput> {
  const out = {} as Required<LegalProfileInput>;
  for (const field of FIELDS) out[field] = clean(field, input[field]);
  if (out.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) throw new LegalProfileError("L'e-mail n'est pas valide.");
  if (out.phone && !/^\+?[\d\s().-]{6,30}$/.test(out.phone)) throw new LegalProfileError("Le téléphone n'est pas valide.");
  return out;
}

const EMPTY: LegalProfileView = {
  legalName: null, legalForm: null, ninea: null, rccm: null, address: null, email: null, phone: null,
  publicationDirector: null, returnPolicy: null, additionalTerms: null, updatedAt: null,
};

export async function getLegalProfile(tx: Prisma.TransactionClient, tenantId: string): Promise<LegalProfileView> {
  const row = await tx.tenantLegalProfile.findUnique({ where: { tenantId } });
  if (!row) return { ...EMPTY };
  const view = { ...EMPTY, updatedAt: row.updatedAt };
  for (const field of FIELDS) view[field] = row[field];
  return view;
}

export async function saveLegalProfile(tx: Prisma.TransactionClient, tenantId: string, input: LegalProfileInput): Promise<LegalProfileView> {
  const data = normalizeLegalProfile(input);
  await tx.tenantLegalProfile.upsert({ where: { tenantId }, create: { tenantId, ...data }, update: data });
  return getLegalProfile(tx, tenantId);
}
