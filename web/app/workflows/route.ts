import { NextResponse } from "next/server";

import { getService } from "@/lib/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const service = getService();
  return NextResponse.json(service.listWorkflows());
}
