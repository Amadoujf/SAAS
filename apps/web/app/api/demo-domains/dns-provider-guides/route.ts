import { NextResponse } from "next/server";
import { DNS_PROVIDER_GUIDES } from "@yamacommerce/domains";

export async function GET() {
  return NextResponse.json({ guides: Object.values(DNS_PROVIDER_GUIDES) });
}
