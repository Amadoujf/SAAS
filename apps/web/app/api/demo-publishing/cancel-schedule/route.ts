import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { demoCancelSchedule } from "@/lib/publishing/demo-publishing-context";

const bodySchema = z.object({ versionId: z.string().min(1) });

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }
  demoCancelSchedule(parsed.data.versionId);
  return NextResponse.json({ ok: true });
}
