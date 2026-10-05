import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { saveCurrentLegalProfile } from "@/lib/legal/legal-pipeline";

const text = (max: number) => z.string().max(max).nullable().optional();
const body = z.object({
  legalName: text(120),
  legalForm: text(60),
  ninea: text(30),
  rccm: text(40),
  address: text(240),
  email: text(120),
  phone: text(30),
  publicationDirector: text(120),
  returnPolicy: text(3000),
  additionalTerms: text(6000),
});

/** Enregistre les informations légales de l'entreprise de la session (jamais d'un identifiant fourni). */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Un champ dépasse la longueur autorisée." }, { status: 400 });
  const result = await saveCurrentLegalProfile(parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ data: { updatedAt: result.data.updatedAt } });
}
