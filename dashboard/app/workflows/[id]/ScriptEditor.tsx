"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ScriptEditor({
  workflowId,
  initialScript,
}: {
  workflowId: string;
  initialScript: string;
}) {
  const [script, setScript] = useState(initialScript);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const dirty = script.trim() !== initialScript.trim();

  async function save() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/produce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "revise", scope: "scriptManual", workflowId, script }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Bilinmeyen hata");
      setMessage("Metnin kaydedildi — sahne planı bu metinle yeniden oluşturuluyor, birazdan güncellenecek.");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p className="muted" style={{ marginBottom: 4 }}>
        Senaryo (metni doğrudan düzenleyebilirsin)
      </p>
      <textarea value={script} onChange={(e) => setScript(e.target.value)} rows={10} />
      <div style={{ marginTop: 8 }}>
        <button type="button" onClick={save} disabled={!dirty || !script.trim() || loading}>
          {loading ? "Kaydediliyor..." : "Bu Metni Kullan (sahne planı yeniden oluşturulur)"}
        </button>
      </div>
      {message && (
        <p className="muted" style={{ marginTop: 8 }}>
          {message}
        </p>
      )}
    </div>
  );
}
