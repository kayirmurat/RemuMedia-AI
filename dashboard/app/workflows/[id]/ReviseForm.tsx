"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SCOPE_LABELS: Record<string, string> = {
  script: "Senaryo / Metin (hook dahil)",
  scenes: "Sahne planı / Kurgu (sahne sayısı, görsel dağılımı)",
  voice: "Seslendirme",
  subtitles: "Altyazı",
  render: "Sadece montajı yenile (geçiş/efekt kod güncellemelerini uygular)",
};

const VOICE_OPTIONS = [
  { value: "nova", label: "Nova (canlı, feminen)" },
  { value: "shimmer", label: "Shimmer (yumuşak, feminen)" },
  { value: "alloy", label: "Alloy (nötr)" },
  { value: "echo", label: "Echo (erkeksi)" },
  { value: "fable", label: "Fable (İngiliz aksanlı, erkeksi)" },
  { value: "onyx", label: "Onyx (derin, erkeksi)" },
];

const SCOPES_NEEDING_FEEDBACK = new Set(["script", "scenes"]);

export default function ReviseForm({
  workflowId,
  scopes,
  showContinue,
}: {
  workflowId: string;
  scopes: string[];
  showContinue?: boolean;
}) {
  const [scope, setScope] = useState(scopes[0]!);
  const [feedback, setFeedback] = useState("");
  const [voiceName, setVoiceName] = useState("nova");
  const [loading, setLoading] = useState<"continue" | "revise" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const needsFeedback = SCOPES_NEEDING_FEEDBACK.has(scope);

  async function act(mode: "continue" | "revise") {
    setLoading(mode);
    setMessage(null);
    try {
      const body: Record<string, unknown> =
        mode === "continue"
          ? { mode, workflowId }
          : { mode: "revise", workflowId, scope, feedback, ...(scope === "voice" ? { voiceName } : {}) };

      const res = await fetch("/api/produce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Bilinmeyen hata");
      setMessage(
        mode === "continue"
          ? "Devam ettiriliyor — görsel, seslendirme ve montaj başladı."
          : "İstek gönderildi, birazdan burada güncellenecek.",
      );
      setFeedback("");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      <label className="muted" htmlFor="scope">
        Ne değiştirmek istiyorsun?
      </label>
      <div style={{ marginTop: 6, marginBottom: 10 }}>
        <select id="scope" value={scope} onChange={(e) => setScope(e.target.value)}>
          {scopes.map((s) => (
            <option key={s} value={s}>
              {SCOPE_LABELS[s] ?? s}
            </option>
          ))}
        </select>
      </div>

      {scope === "voice" && (
        <div style={{ marginBottom: 10 }}>
          <label className="muted" htmlFor="voiceName">
            Ses
          </label>
          <div style={{ marginTop: 6 }}>
            <select id="voiceName" value={voiceName} onChange={(e) => setVoiceName(e.target.value)}>
              {VOICE_OPTIONS.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {scope === "render" ? (
        <p className="muted" style={{ marginBottom: 10 }}>
          Bu seçenek, mevcut görseller/ses/altyazılarla videoyu en güncel geçiş/efekt koduyla yeniden
          oluşturur — ekstra not gerekmiyor, ek görsel/ses maliyeti yok.
        </p>
      ) : (
        <>
          <label className="muted" htmlFor="feedback">
            Geri bildirim / not {needsFeedback ? "(gerekli)" : "(opsiyonel)"}
          </label>
          <div style={{ marginTop: 6, marginBottom: 10 }}>
            <textarea
              id="feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Örn: 3 sahne daha ekle, hook'u kısalt, daha yumuşak bir ses olsun..."
            />
          </div>
        </>
      )}

      <div className="row" style={{ justifyContent: "flex-start", gap: 10 }}>
        <button
          type="button"
          className="secondary"
          onClick={() => act("revise")}
          disabled={(needsFeedback && !feedback.trim()) || loading !== null}
        >
          {loading === "revise" ? "Gönderiliyor..." : "Bu Değişikliği Uygula"}
        </button>
        {showContinue && (
          <button type="button" onClick={() => act("continue")} disabled={loading !== null}>
            {loading === "continue" ? "Başlatılıyor..." : "Onayla ve Devam Et"}
          </button>
        )}
      </div>
      {message && (
        <p className="muted" style={{ marginTop: 10 }}>
          {message}
        </p>
      )}
    </div>
  );
}
