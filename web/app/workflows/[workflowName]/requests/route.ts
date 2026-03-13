import { NextResponse } from "next/server";

import {
  DuplicateRequestConflictError,
  SubmissionValidationError,
  WorkflowNotFoundError,
  getService,
} from "@/lib/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ workflowName: string }> }) {
  const { workflowName } = await params;
  const idempotencyKey = request.headers.get("idempotency-key") ?? request.headers.get("Idempotency-Key");
  if (!idempotencyKey) {
    return NextResponse.json({ detail: "Idempotency-Key header is required." }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body." }, { status: 400 });
  }

  const payload = body?.payload;
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ detail: "Body must be { payload: {...} }." }, { status: 400 });
  }

  const service = getService();

  try {
    const snapshot = service.submit(workflowName, idempotencyKey, payload);
    const status = snapshot.idempotent_replay ? 200 : 201;
    return NextResponse.json(snapshot, { status });
  } catch (error) {
    if (error instanceof WorkflowNotFoundError) {
      return NextResponse.json({ detail: error.message }, { status: 404 });
    }
    if (error instanceof DuplicateRequestConflictError) {
      return NextResponse.json({ detail: error.message }, { status: 409 });
    }
    if (error instanceof SubmissionValidationError) {
      return NextResponse.json(error.snapshot, { status: 422 });
    }

    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
