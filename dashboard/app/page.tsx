import Link from "next/link";
import { getSupabaseConfigError, supabaseServer } from "../lib/supabase";
import { workflowPhase, totalCost, type WorkflowRow } from "../lib/types";
import ProduceForm from "./ProduceForm";

export const dynamic = "force-dynamic";

const PHASE_LABEL: Record<string, string> = {
  review: "İnceleme bekliyor",
  running: "Devam ediyor",
  completed: "Tamamlandı",
  failed: "Hata",
};

export default async function HomePage() {
  const configError = getSupabaseConfigError();
  if (configError) {
    return (
      <>
        <h1>RemuMedia AI</h1>
        <p style={{ color: "var(--danger)" }}>{configError}</p>
      </>
    );
  }

  const client = supabaseServer();
  let workflows: WorkflowRow[] = [];
  let queryError: string | null = null;
  try {
    const { data, error } = await client
      .from("workflows")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) queryError = error.message;
    workflows = (data ?? []) as WorkflowRow[];
  } catch (err) {
    queryError = err instanceof Error ? err.message : String(err);
  }

  return (
    <>
      <h1>RemuMedia AI</h1>

      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Yeni Video Üret</h2>
        <ProduceForm />
      </div>

      {queryError && <p style={{ color: "var(--danger)" }}>Supabase hatası: {queryError}</p>}

      <h2 style={{ fontSize: 16 }}>Üretimler</h2>
      {workflows.length === 0 && <p className="muted">Henüz üretim yok.</p>}
      {workflows.map((w) => {
        const phase = workflowPhase(w.steps);
        return (
          <Link
            key={w.id}
            href={`/workflows/${w.id}`}
            className="card"
            style={{ display: "block", textDecoration: "none", color: "inherit" }}
          >
            <div className="row">
              <strong>{w.topic}</strong>
              <span className={`badge badge-${phase}`}>{PHASE_LABEL[phase]}</span>
            </div>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              {new Date(w.created_at).toLocaleString("tr-TR")} · ${totalCost(w.steps).toFixed(3)}
            </p>
          </Link>
        );
      })}
    </>
  );
}
