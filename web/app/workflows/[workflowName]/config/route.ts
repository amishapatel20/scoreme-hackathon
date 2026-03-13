import { NextResponse } from "next/server";

import { WorkflowNotFoundError } from "@/lib/service";
import { loadWorkflow } from "@/lib/workflows";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ workflowName: string }> }) {
  const { workflowName } = await params;
  try {
    // Use loader directly so the route returns the raw config.
    const config = loadWorkflow(workflowName);
    return NextResponse.json(config);
  } catch (error) {
    if (error instanceof WorkflowNotFoundError) {
      return NextResponse.json({ detail: error.message }, { status: 404 });
    }
    return NextResponse.json({ detail: "Unexpected error." }, { status: 500 });
  }
}
