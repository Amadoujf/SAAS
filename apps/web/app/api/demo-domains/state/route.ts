import { NextResponse } from "next/server";
import { getDemoDomainsSnapshot } from "@/lib/domains/demo-domains-context";

export async function GET() {
  return NextResponse.json({ domains: getDemoDomainsSnapshot() });
}
