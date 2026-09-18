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

export default function MusicPicker({
  workflowId,
  currentTrackId,
}: {
  workflowId: string;
  currentTrackId: string | null;
}) {
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState<string | null>(null);
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
      const res = await fetch("/api/produce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "revise", scope: "musicManual", workflowId, trackId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Bilinmeyen hata");
      setMessage("Seçildi — video bu parçayla yeniden oluşturuluyor, birazdan güncellenecek.");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setApplying(null);
    }
  }

  return (
    <div>
      <p className="muted mb-2">Şu an seçili parçayı dinleyip beğenmezsen kütüphaneden başka birini seçebilirsin.</p>
      <div className="flex flex-col gap-2">
        {tracks.map((track) => {
          const isCurrent = track.id === currentTrackId;
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
