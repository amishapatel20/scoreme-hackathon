import { NextResponse } from "next/server";

import { RequestNotFoundError, getService } from "@/lib/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const service = getService();

  try {
    const snapshot = service.getRequest(requestId);
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof RequestNotFoundError) {
      return NextResponse.json({ detail: error.message }, { status: 404 });
    }

    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
