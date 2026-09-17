import { NextResponse } from "next/server";
import { getDemoDomainsSnapshot, resetDemoDomainsState } from "@/lib/domains/demo-domains-context";

export async function POST() {
  resetDemoDomainsState();
  return NextResponse.json({ domains: getDemoDomainsSnapshot() });
}
