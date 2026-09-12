import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase";
import { dispatchProduceWorkflow } from "../../../lib/github";
import type { WorkflowRow } from "../../../lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const mode = body.mode as "new" | "continue" | "revise";
  const maxCost = body.maxCost ? String(body.maxCost) : "2.0";

  try {
    if (mode === "new") {
      const topic = String(body.topic ?? "").trim();
      if (!topic) return NextResponse.json({ error: "Konu boş olamaz." }, { status: 400 });

      await dispatchProduceWorkflow({ topic, stop_after: "visualPlan", max_cost: maxCost });
      return NextResponse.json({ ok: true });
    }

    if (mode === "continue") {
      const workflowId = String(body.workflowId ?? "");
      if (!workflowId) return NextResponse.json({ error: "workflowId gerekli." }, { status: 400 });

      await dispatchProduceWorkflow({ workflow_id: workflowId, max_cost: maxCost });
      return NextResponse.json({ ok: true });
    }

    if (mode === "revise") {
      const workflowId = String(body.workflowId ?? "");
      const feedback = String(body.feedback ?? "").trim();
      if (!workflowId || !feedback) {
        return NextResponse.json({ error: "workflowId ve feedback gerekli." }, { status: 400 });
      }

      const client = supabaseServer();
      const { data, error } = await client
        .from("workflows")
        .select("*")
        .eq("id", workflowId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return NextResponse.json({ error: "Workflow bulunamadı." }, { status: 404 });

      const workflow = data as WorkflowRow;
      const revisionNotes = [...((workflow.context.revisionNotes as string[] | undefined) ?? []), feedback];

      for (const stepName of ["brief", "script", "visualPlan"]) {
        workflow.steps[stepName] = { status: "pending", artifactIds: [], cost: 0 };
      }
      workflow.context = { ...workflow.context, revisionNotes };
      workflow.updated_at = new Date().toISOString();

      const { error: saveError } = await client.from("workflows").upsert(workflow);
      if (saveError) throw new Error(saveError.message);

      await dispatchProduceWorkflow({ workflow_id: workflowId, stop_after: "visualPlan", max_cost: maxCost });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Geçersiz mode." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
