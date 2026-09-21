"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import musicManifest from "../../../lib/musicManifest.json";

interface Track {
  id: string;
  filename: string;
  moods: string[];
}

const tracks = musicManifest as Track[];

export default function MusicPreferencePicker({
  workflowId,
  currentTrackId,
}: {
  workflowId: string;
  currentTrackId: string | null;
}) {
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(currentTrackId);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  async function preview(filename: string) {
    if (previewUrls[filename]) return;
    const res = await fetch(`/api/music/${filename}/signed-url`);
    const json = await res.json();
    if (json.url) setPreviewUrls((m) => ({ ...m, [filename]: json.url }));
  }

  async function apply(trackId: string) {
    setApplying(trackId);
    setMessage(null);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/music`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Bilinmeyen hata");
      setSaved(trackId || null);
      setMessage(
        trackId
          ? "Kaydedildi — üretim devam ettiğinde bu parça kullanılacak."
          : "Kaydedildi — parçayı yapay zeka senaryonun tonuna göre seçecek.",
      );
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
        Arka plan müziği — henüz seçilmedi, dinleyip kütüphaneden birini seçebilir ya da yapay
        zekanın senaryonun tonuna göre otomatik seçmesine bırakabilirsin.
      </p>
      <div className="flex flex-col gap-2">
        <div
          className={`flex items-center justify-between rounded-lg border p-3 ${
            saved === null ? "border-accent bg-accent-soft" : "border-border"
          }`}
        >
          <p className="text-sm font-medium text-ink">
            Otomatik (yapay zeka seçsin)
            {saved === null && <span className="badge badge-completed ml-2">şu an seçili</span>}
          </p>
          <button type="button" onClick={() => apply("")} disabled={saved === null || applying !== null}>
            {applying === "" ? "Uygulanıyor..." : "Bunu Kullan"}
          </button>
        </div>
        {tracks.map((track) => {
          const isCurrent = track.id === saved;
          return (
            <div
              key={track.id}
              className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ${
                isCurrent ? "border-accent bg-accent-soft" : "border-border"
              }`}
            >
              <div>
                <p className="text-sm font-medium text-ink">
                  {track.id}
                  {isCurrent && <span className="badge badge-completed ml-2">şu an seçili</span>}
                </p>
                <p className="muted">{track.moods.join(", ")}</p>
                {previewUrls[track.filename] && (
                  <audio controls src={previewUrls[track.filename]} className="mt-2 h-8 w-full max-w-xs" />
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" className="secondary" onClick={() => preview(track.filename)}>
                  Dinle
                </button>
                <button
                  type="button"
                  onClick={() => apply(track.id)}
                  disabled={isCurrent || applying !== null}
                >
                  {applying === track.id ? "Uygulanıyor..." : "Bu Parçayı Kullan"}
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
