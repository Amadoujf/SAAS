import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { demoAddCustomDomain } from "@/lib/domains/demo-domains-context";

const bodySchema = z.object({ rawDomain: z.string().min(1), confirmHomographRisk: z.boolean().optional() });

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  return NextResponse.json(demoAddCustomDomain(parsed.data.rawDomain, parsed.data.confirmHomographRisk ?? false));
}
