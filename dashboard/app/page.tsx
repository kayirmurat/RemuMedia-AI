import { getSupabaseConfigError, supabaseServer } from "../lib/supabase";
import { workflowPhase, totalCost, type WorkflowRow, type ArtifactRow } from "../lib/types";
import ProduceForm from "./ProduceForm";
import VideoLibrary, { type LibraryItem } from "./VideoLibrary";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const configError = getSupabaseConfigError();
  if (configError) {
    return (
      <>
        <h1 className="text-xl font-bold text-ink">RemuMedia AI</h1>
        <p className="text-danger">{configError}</p>
      </>
    );
  }

  const client = supabaseServer();
  let workflows: WorkflowRow[] = [];
  let thumbnails: ArtifactRow[] = [];
  let queryError: string | null = null;
  try {
    const [workflowsRes, thumbnailsRes] = await Promise.all([
      client.from("workflows").select("*").order("created_at", { ascending: false }).limit(50),
      client.from("artifacts").select("*").eq("type", "thumbnail").order("created_at", { ascending: true }),
    ]);
    if (workflowsRes.error) queryError = workflowsRes.error.message;
    workflows = (workflowsRes.data ?? []) as WorkflowRow[];
    thumbnails = (thumbnailsRes.data ?? []) as ArtifactRow[];
  } catch (err) {
    queryError = err instanceof Error ? err.message : String(err);
  }

  // Bir workflow'un birden fazla thumbnail'ı olabilir (ör. "Sadece montajı
  // yenile" sonrası) — en son üretileni kullan.
  const latestThumbnailByWorkflow = new Map<string, string>();
  for (const t of thumbnails) latestThumbnailByWorkflow.set(t.workflow_id, t.id);

  const items: LibraryItem[] = workflows.map((w) => ({
    id: w.id,
    topic: w.topic,
    createdAt: w.created_at,
    cost: totalCost(w.steps),
    phase: workflowPhase(w.steps),
    thumbnailArtifactId: latestThumbnailByWorkflow.get(w.id) ?? null,
  }));

  return (
    <>
      <h1 className="text-xl font-bold text-ink">RemuMedia AI</h1>

      <div className="card">
        <h2 className="mt-0 text-base font-semibold text-ink">Yeni Video Üret</h2>
        <ProduceForm />
      </div>

      {queryError && <p className="text-danger">Supabase hatası: {queryError}</p>}

      <h2 className="mb-3 text-base font-semibold text-ink">Üretimler</h2>
      {items.length === 0 ? <p className="muted">Henüz üretim yok.</p> : <VideoLibrary items={items} />}
    </>
  );
}
