"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReviewActions({ workflowId }: { workflowId: string }) {
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState<"continue" | "revise" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  async function act(mode: "continue" | "revise") {
    setLoading(mode);
    setMessage(null);
    try {
      const res = await fetch("/api/produce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, workflowId, feedback }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Bilinmeyen hata");
      setMessage(
        mode === "continue"
          ? "Devam ettiriliyor — görsel, seslendirme ve montaj başladı."
          : "Senaryo geri bildiriminle yeniden yazılıyor, birazdan burada güncellenecek.",
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
      <label className="muted" htmlFor="feedback">
        Geri bildirim / not (opsiyonel — "Yeniden Yaz" için gerekli)
      </label>
      <div style={{ marginTop: 6, marginBottom: 10 }}>
        <textarea
          id="feedback"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Örn: daha esprili bir ton olsun, X konusuna değinmesin..."
        />
      </div>
      <div className="row" style={{ justifyContent: "flex-start", gap: 10 }}>
        <button
          type="button"
          className="secondary"
          onClick={() => act("revise")}
          disabled={!feedback.trim() || loading !== null}
        >
          {loading === "revise" ? "Yazılıyor..." : "Yeniden Yaz"}
        </button>
        <button type="button" onClick={() => act("continue")} disabled={loading !== null}>
          {loading === "continue" ? "Başlatılıyor..." : "Onayla ve Devam Et"}
        </button>
      </div>
      {message && (
        <p className="muted" style={{ marginTop: 10 }}>
          {message}
        </p>
      )}
    </div>
  );
}
