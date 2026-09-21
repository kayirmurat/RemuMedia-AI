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
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  const [saved, setSaved] = useState(currentVoiceName);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  async function preview(voiceValue: string) {
    if (previewUrls[voiceValue]) return;
    setPreviewLoading(voiceValue);
    try {
      const res = await fetch(`/api/voice-preview/${voiceValue}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Önizleme alınamadı");
      setPreviewUrls((m) => ({ ...m, [voiceValue]: json.url }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setPreviewLoading(null);
    }
  }

  async function apply(voiceValue: string) {
    setApplying(voiceValue);
    setMessage(null);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/voice`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceName: voiceValue }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Bilinmeyen hata");
      setSaved(voiceValue);
      setMessage("Kaydedildi — üretim devam ettiğinde bu ses kullanılacak.");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setApplying(null);
    }
  }

  return (
    <div>
      <p className="muted mb-2">
        Seslendirme — henüz üretilmedi, dinleyip beğendiğin sesi seçebilirsin (sonradan değiştirmek
        video tamamlandıktan sonra yeniden montaj gerektirir)
      </p>
      <div className="flex flex-col gap-2">
        {VOICE_OPTIONS.map((v) => {
          const isCurrent = v.value === saved;
          return (
            <div
              key={v.value}
              className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ${
                isCurrent ? "border-accent bg-accent-soft" : "border-border"
              }`}
            >
              <div>
                <p className="text-sm font-medium text-ink">
                  {v.label}
                  {isCurrent && <span className="badge badge-completed ml-2">şu an seçili</span>}
                </p>
                {previewUrls[v.value] && (
                  <audio controls src={previewUrls[v.value]} className="mt-2 h-8 w-full max-w-xs" />
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => preview(v.value)}
                  disabled={previewLoading === v.value}
                >
                  {previewLoading === v.value ? "Yükleniyor..." : "Dinle"}
                </button>
                <button type="button" onClick={() => apply(v.value)} disabled={isCurrent || applying !== null}>
                  {applying === v.value ? "Uygulanıyor..." : "Bu Sesi Kullan"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {message && <p className="muted mt-2">{message}</p>}
    </div>
  );
}
