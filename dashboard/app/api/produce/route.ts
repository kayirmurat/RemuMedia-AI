import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase";
import { dispatchProduceWorkflow } from "../../../lib/github";
import { STEP_ORDER, type StepRecord, type WorkflowRow } from "../../../lib/types";

// Hangi "kapsam" (scope) seçilirse, workflow adımlarından HANGİSİNDEN İTİBAREN
// her şeyin sıfırlanıp yeniden üretileceğini belirler. Öncesindeki tamamlanmış
// adımlar (ve maliyetleri) korunur — WorkflowEngine zaten "completed" durumundaki
// adımları atlıyor (bkz. core/workflow/engine.ts).
const SCOPE_RESET_FROM: Record<string, (typeof STEP_ORDER)[number]> = {
  script: "brief", // Senaryo/Metin (hook dahil) — brief'ten itibaren her şey, LLM yeniden yazar
  scriptManual: "script", // Kullanıcının kendi düzenlediği metin — brief AYNEN kalır, LLM'e gitmez
  scenes: "visualPlan", // Sahne planı/Kurgu — senaryo metni AYNEN kalır
  music: "musicSelection", // Arka plan müziği — sahneler/görseller/ses AYNEN kalır
  musicManual: "musicSelection", // Kütüphaneden doğrudan seçilen parça — LLM'e gitmez
  voice: "voice", // Seslendirme — sahneler/görseller AYNEN kalır
  subtitles: "subtitles", // Altyazı — ses/görseller AYNEN kalır
  render: "assembly", // Sadece montaj/geçişleri güncel kodla yeniden render et
};

// Senaryo/sahne değişikliği görsel+ses üretimine (maliyetli kısım) geçmeden
// önce kullanıcının onayına sunulmalı. Ses/altyazı/montaj değişiklikleri
// senaryoyu/sahneleri etkilemediği için doğrudan sonuna kadar çalışabilir.
const SCOPES_NEEDING_REVIEW_GATE = new Set(["script", "scriptManual", "scenes"]);
const SCOPES_NEEDING_FEEDBACK = new Set(["script", "scenes"]);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const mode = body.mode as "new" | "continue" | "revise";
  const maxCost = body.maxCost ? String(body.maxCost) : "2.0";

  try {
    if (mode === "new") {
      const topic = String(body.topic ?? "").trim();
      if (!topic) return NextResponse.json({ error: "Konu boş olamaz." }, { status: 400 });

      await dispatchProduceWorkflow({ topic, stop_after: "contentReview", max_cost: maxCost });
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
      const scope = String(body.scope ?? "script");
      const feedback = String(body.feedback ?? "").trim();
      const voiceName = body.voiceName ? String(body.voiceName) : undefined;
      const manualScript = scope === "scriptManual" ? String(body.script ?? "").trim() : undefined;
      const trackId = scope === "musicManual" ? String(body.trackId ?? "").trim() : undefined;
      const fromStep = SCOPE_RESET_FROM[scope];

      if (!workflowId || !fromStep) {
        return NextResponse.json({ error: "workflowId ve geçerli bir scope gerekli." }, { status: 400 });
      }
      if (SCOPES_NEEDING_FEEDBACK.has(scope) && !feedback) {
        return NextResponse.json({ error: "Bu değişiklik için geri bildirim gerekli." }, { status: 400 });
      }
      if (scope === "scriptManual" && !manualScript) {
        return NextResponse.json({ error: "Senaryo metni boş olamaz." }, { status: 400 });
      }
      if (scope === "musicManual" && !trackId) {
        return NextResponse.json({ error: "trackId gerekli." }, { status: 400 });
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

      const fromIndex = STEP_ORDER.indexOf(fromStep);
      for (const stepName of STEP_ORDER.slice(fromIndex)) {
        workflow.steps[stepName] = { status: "pending", artifactIds: [], cost: 0 } as StepRecord;
      }

      if (feedback) {
        const revisionNotes = [...((workflow.context.revisionNotes as string[] | undefined) ?? []), feedback];
        workflow.context = { ...workflow.context, revisionNotes };
      }
      if (voiceName) {
        workflow.context = { ...workflow.context, voiceName };
      }
      if (manualScript) {
        workflow.context = { ...workflow.context, scriptOverride: manualScript };
      }
      if (trackId) {
        workflow.context = { ...workflow.context, musicTrackOverride: trackId };
      }
      workflow.updated_at = new Date().toISOString();

      const { error: saveError } = await client.from("workflows").upsert(workflow);
      if (saveError) throw new Error(saveError.message);

      await dispatchProduceWorkflow({
        workflow_id: workflowId,
        max_cost: maxCost,
        ...(SCOPES_NEEDING_REVIEW_GATE.has(scope) ? { stop_after: "contentReview" } : {}),
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Geçersiz mode." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
