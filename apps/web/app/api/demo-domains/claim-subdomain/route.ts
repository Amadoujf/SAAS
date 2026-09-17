import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { demoClaimSubdomain } from "@/lib/domains/demo-domains-context";

const bodySchema = z.object({ rawSubdomain: z.string().min(1) });

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  return NextResponse.json(demoClaimSubdomain(parsed.data.rawSubdomain));
}
