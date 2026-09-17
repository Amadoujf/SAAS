import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { demoSimulateDnsPropagation } from "@/lib/domains/demo-domains-context";

const bodySchema = z.object({ domainId: z.string().min(1), partial: z.boolean().optional() });

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  demoSimulateDnsPropagation(parsed.data.domainId, parsed.data.partial ?? false);
  return NextResponse.json({ ok: true });
}
