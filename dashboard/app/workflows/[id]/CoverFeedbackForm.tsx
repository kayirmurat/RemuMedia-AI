"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CoverFeedbackForm({ workflowId }: { workflowId: string }) {
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  async function submit() {
    if (!feedback.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/produce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "revise", scope: "cover", workflowId, feedback }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Bilinmeyen hata");
      setMessage("İstek gönderildi — yeni kapak birazdan burada güncellenecek.");
      setFeedback("");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 10 }}>
      <label className="muted" htmlFor="coverFeedback">
        Kapağı beğenmedin mi? Nasıl değiştirmek istediğini yaz (ör. "görsel çok karanlık, daha aydınlık
        olsun", "metni kısalt", "farklı bir konu/açı kullan")
      </label>
      <div style={{ marginTop: 6 }}>
        <textarea
          id="coverFeedback"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Örn: görsel çok karanlık, daha aydınlık ve sıcak tonlarda olsun"
          rows={2}
        />
      </div>
      <div style={{ marginTop: 8 }}>
        <button type="button" className="secondary" onClick={submit} disabled={!feedback.trim() || loading}>
          {loading ? "Gönderiliyor..." : "Kapağı Bu Şekilde Düzelt"}
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
