import { NextResponse } from "next/server";

import type { ExplanationResponse } from "@/lib/types";
import { RequestNotFoundError, getService } from "@/lib/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const service = getService();

  try {
    const snapshot = service.getRequest(requestId);

    const response: ExplanationResponse = {
      request_id: snapshot.request_id,
      status: snapshot.status,
      explanation: snapshot.explanation,
      history: snapshot.history,
      audit_trail: snapshot.audit_trail,
      outcome: snapshot.outcome,
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof RequestNotFoundError) {
      return NextResponse.json({ detail: error.message }, { status: 404 });
    }

    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
