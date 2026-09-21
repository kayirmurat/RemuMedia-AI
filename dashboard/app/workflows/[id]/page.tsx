import { notFound } from "next/navigation";
import { getSupabaseConfigError, supabaseServer } from "../../../lib/supabase";
import { readArtifactText } from "../../../lib/content";
import { workflowPhase, totalCost, STEP_ORDER, type WorkflowRow, type ArtifactRow } from "../../../lib/types";
import ReviseForm from "./ReviseForm";
import ApproveButton from "./ApproveButton";
import ArtifactPreview from "./ArtifactPreview";
import ScriptEditor from "./ScriptEditor";
import PublishButtons from "./PublishButtons";
import MusicPicker from "./MusicPicker";
import MusicPreferencePicker from "./MusicPreferencePicker";
import VoicePicker from "./VoicePicker";
import Thumbnail from "../../Thumbnail";
import { listConnections } from "../../../lib/platformConnections";

export const dynamic = "force-dynamic";

const STEP_LABEL: Record<string, string> = {
  topicSelection: "Konu seçimi",
  research: "Araştırma",
  brief: "Brief",
  script: "Senaryo",
  visualPlan: "Sahne planı",
  contentReview: "İçerik incelemesi",
  musicSelection: "Müzik seçimi",
  visualAssets: "Görseller",
  voice: "Seslendirme",
  subtitles: "Altyazı",
  assembly: "Montaj",
  qc: "Kalite kontrolü",
  coverImage: "Kapak fotoğrafı",
};

interface Scene {
  narration: string;
  imagePrompt: string;
}

interface ContentReview {
  passed: boolean;
  concerns: string[];
  hookAssessment: string;
  pacingAssessment: string;
}

export default async function WorkflowDetailPage({ params }: { params: { id: string } }) {
  const configError = getSupabaseConfigError();
  if (configError) {
    return <p style={{ color: "var(--danger)" }}>{configError}</p>;
  }

  const client = supabaseServer();
  const { data: workflowData } = await client.from("workflows").select("*").eq("id", params.id).maybeSingle();
  if (!workflowData) notFound();
  const workflow = workflowData as WorkflowRow;

  const { data: artifactsData } = await client
    .from("artifacts")
    .select("*")
    .eq("workflow_id", params.id)
    .order("created_at", { ascending: true });
  const artifacts = (artifactsData ?? []) as ArtifactRow[];

  const phase = workflowPhase(workflow.steps);
  const findLatest = (type: string) => [...artifacts].reverse().find((a) => a.type === type);

  let scriptText = "";
  let briefText = "";
  let scenes: Scene[] = [];
  let contentReview: ContentReview | null = null;
  let sceneLengthCheck: { scriptChars: number; narrationChars: number } | null = null;

  if (phase === "review" || phase === "failed" || phase === "running" || phase === "completed") {
    const scriptArtifact = findLatest("script");
    const briefArtifact = findLatest("brief");
    const planArtifact = findLatest("visual_plan");
    const reviewArtifact = findLatest("content_review");
    if (scriptArtifact) scriptText = await readArtifactText(scriptArtifact.path);
    if (briefArtifact) briefText = await readArtifactText(briefArtifact.path);
    if (planArtifact) {
      try {
        scenes = JSON.parse(await readArtifactText(planArtifact.path));
      } catch {
        scenes = [];
      }
      const { scriptChars, narrationChars } = planArtifact.metadata;
      if (typeof scriptChars === "number" && typeof narrationChars === "number") {
        sceneLengthCheck = { scriptChars, narrationChars };
      }
    }
    if (reviewArtifact) {
      try {
        contentReview = JSON.parse(await readArtifactText(reviewArtifact.path));
      } catch {
        contentReview = null;
      }
    }
  }

  const finalVideoArtifact = findLatest("final_video");
  const thumbnailArtifact = findLatest("thumbnail");
  const imageArtifacts = artifacts.filter((a) => a.type === "image");

  let connectedPlatforms: string[] = [];
  let publicationsByPlatform: Record<string, { status: string; remoteUrl: string | null }> = {};
  if (phase === "completed") {
    const connections = await listConnections();
    connectedPlatforms = connections.map((c) => c.platform);
    const { data: pubsData } = await client
      .from("publications")
      .select("*")
      .eq("workflow_id", params.id)
      .order("created_at", { ascending: true });
    for (const pub of pubsData ?? []) {
      publicationsByPlatform[pub.platform] = { status: pub.status, remoteUrl: pub.remote_url };
    }
  }

  return (
    <>
      <p>
        <a href="/">&larr; Tüm üretimler</a>
      </p>
      <h1 style={{ fontSize: 20 }}>{workflow.topic}</h1>
      <p className="muted">
        Oluşturuldu: {new Date(workflow.created_at).toLocaleString("tr-TR")} · Toplam maliyet: $
        {totalCost(workflow.steps).toFixed(4)}
      </p>

      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: 15 }}>Adım durumu</h2>
        <table>
          <thead>
            <tr>
              <th>Adım</th>
              <th>Durum</th>
              <th>Maliyet</th>
            </tr>
          </thead>
          <tbody>
            {STEP_ORDER.filter((name) => workflow.steps[name]).map((name) => {
              const s = workflow.steps[name]!;
              return (
                <tr key={name}>
                  <td>{STEP_LABEL[name] ?? name}</td>
                  <td>
                    {s.status === "completed" && "✅ Tamam"}
                    {s.status === "failed" && `❌ ${s.error ?? "Hata"}`}
                    {s.status === "running" && "⏳ Çalışıyor"}
                    {s.status === "pending" && "⏸ Bekliyor"}
                  </td>
                  <td>${s.cost.toFixed(4)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {phase === "review" && (
        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: 15 }}>İnceleme — senaryo &amp; sahne planı</h2>
          {briefText && (
            <>
              <p className="muted" style={{ marginBottom: 4 }}>
                Brief
              </p>
              <pre>{briefText}</pre>
            </>
          )}
          <ScriptEditor workflowId={workflow.id} initialScript={scriptText} />
          {scenes.length > 0 && (
            <>
              <p className="muted" style={{ marginBottom: 4 }}>
                Sahne planı ({scenes.length} sahne)
                {sceneLengthCheck && (
                  <>
                    {" "}
                    — toplam anlatım metni: {sceneLengthCheck.narrationChars} karakter (senaryo:{" "}
                    {sceneLengthCheck.scriptChars} karakter, fark: %
                    {Math.abs(
                      Math.round(
                        ((sceneLengthCheck.narrationChars - sceneLengthCheck.scriptChars) /
                          sceneLengthCheck.scriptChars) *
                          100,
                      ),
                    )}
                    ) — süre korunuyor
                  </>
                )}
              </p>
              {scenes.map((s, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <strong>Sahne {i + 1}:</strong> {s.narration}
                  <div className="muted">Görsel: {s.imagePrompt}</div>
                </div>
              ))}
            </>
          )}
          {contentReview && (
            <>
              <p className="muted" style={{ marginBottom: 4, marginTop: 16 }}>
                Otomatik içerik incelemesi{" "}
                <span className={`badge badge-${contentReview.passed ? "completed" : "failed"}`}>
                  {contentReview.passed ? "sorun yok" : "sorun bulundu"}
                </span>
              </p>
              <p style={{ margin: "4px 0" }}>
                <strong>Hook:</strong> {contentReview.hookAssessment}
              </p>
              <p style={{ margin: "4px 0" }}>
                <strong>Tempo:</strong> {contentReview.pacingAssessment}
              </p>
              {contentReview.concerns.length > 0 && (
                <ul style={{ margin: "4px 0" }}>
                  {contentReview.concerns.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              )}
            </>
          )}
          <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--border)" }} />
          <VoicePicker
            workflowId={workflow.id}
            currentVoiceName={(workflow.context.voiceName as string | undefined) ?? "nova"}
          />
          <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--border)" }} />
          <MusicPreferencePicker
            workflowId={workflow.id}
            currentTrackId={(workflow.context.musicTrackOverride as string | undefined) ?? null}
          />
          <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--border)" }} />
          <ReviseForm workflowId={workflow.id} scopes={["script", "scenes"]} showContinue />
        </div>
      )}

      {phase === "failed" && (
        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: 15, color: "var(--danger)" }}>
            Hata
          </h2>
          <p>Bir adım başarısız oldu (yukarıdaki tabloda hangisi olduğunu görebilirsin).</p>
        </div>
      )}

      {phase === "completed" && finalVideoArtifact && (
        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: 15 }}>Final video</h2>
          <ArtifactPreview artifact={finalVideoArtifact} />
          <div style={{ marginTop: 10 }}>
            <ApproveButton
              artifactId={finalVideoArtifact.id}
              approved={Boolean(finalVideoArtifact.metadata.approved)}
            />
          </div>
          <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--border)" }} />
          <h3 className="mb-2 text-sm font-semibold text-ink">Kapak fotoğrafı</h3>
          {thumbnailArtifact ? (
            <>
              <p className="muted mb-2">
                Platformlara yayınlanırken kapak fotoğrafı olarak bu görsel kullanılacak — önce
                onaylaman gerekiyor.
              </p>
              <div style={{ maxWidth: 220 }}>
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                  <Thumbnail artifactId={thumbnailArtifact.id} />
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <ApproveButton
                  artifactId={thumbnailArtifact.id}
                  approved={Boolean(thumbnailArtifact.metadata.approved)}
                />
              </div>
            </>
          ) : (
            <p className="muted">Bu üretim için bir kapak fotoğrafı bulunamadı.</p>
          )}
          <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--border)" }} />
          <h3 className="mb-2 text-sm font-semibold text-ink">Arka plan müziği</h3>
          <MusicPicker
            workflowId={workflow.id}
            currentTrackId={(workflow.context.musicTrackId as string | null) ?? null}
          />
          <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--border)" }} />
          <h3 className="mb-2 text-sm font-semibold text-ink">Yayınla</h3>
          {thumbnailArtifact && !thumbnailArtifact.metadata.approved ? (
            <p className="muted">Yayınlamadan önce yukarıdaki kapak fotoğrafını onaylaman gerekiyor.</p>
          ) : (
            <PublishButtons
              workflowId={workflow.id}
              connectedPlatforms={connectedPlatforms}
              publications={publicationsByPlatform}
            />
          )}
          <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--border)" }} />
          <ScriptEditor workflowId={workflow.id} initialScript={scriptText} />
          <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--border)" }} />
          <ReviseForm
            workflowId={workflow.id}
            scopes={["script", "scenes", "music", "voice", "subtitles", "render", "cover"]}
          />
        </div>
      )}

      {imageArtifacts.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: 15 }}>Sahne görselleri</h2>
          <div className="scene-grid">
            {imageArtifacts.map((a) => (
              <ArtifactPreview key={a.id} artifact={a} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
