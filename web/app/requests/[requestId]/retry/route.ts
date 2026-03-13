import { NextResponse } from "next/server";

import { RequestNotFoundError, RetryNotAllowedError, WorkflowNotFoundError, getService } from "@/lib/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const service = getService();

  try {
    const snapshot = service.retry(requestId);
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof RequestNotFoundError) {
      return NextResponse.json({ detail: error.message }, { status: 404 });
    }
    if (error instanceof RetryNotAllowedError) {
      return NextResponse.json({ detail: error.message }, { status: 409 });
    }
    if (error instanceof WorkflowNotFoundError) {
      return NextResponse.json({ detail: error.message }, { status: 404 });
    }

    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
