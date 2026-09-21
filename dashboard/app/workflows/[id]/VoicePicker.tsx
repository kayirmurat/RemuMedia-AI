"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VOICE_OPTIONS } from "../../../lib/voiceOptions";

export default function VoicePicker({
  workflowId,
  currentVoiceName,
}: {
  workflowId: string;
  currentVoiceName: string;
}) {
  const [voiceName, setVoiceName] = useState(currentVoiceName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(currentVoiceName);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/voice`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Bilinmeyen hata");
      setSaved(voiceName);
      setMessage("Kaydedildi — üretim devam ettiğinde bu ses kullanılacak.");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p className="muted" style={{ marginBottom: 4 }}>
        Seslendirme — henüz üretilmedi, burada seçtiğin ses kullanılacak (sonradan değiştirmek
        video tamamlandıktan sonra yeniden montaj gerektirir)
      </p>
      <div className="row" style={{ justifyContent: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <select value={voiceName} onChange={(e) => setVoiceName(e.target.value)} style={{ width: 260 }}>
          {VOICE_OPTIONS.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
        <button type="button" className="secondary" onClick={save} disabled={voiceName === saved || saving}>
          {saving ? "Kaydediliyor..." : "Bu Sesi Kullan"}
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
