"use client";

import { useState } from "react";

interface Props {
  workflowId: string;
  connectedPlatforms: string[];
  publications: Record<string, { status: string; remoteUrl: string | null }>;
}

const PLATFORM_LABEL: Record<string, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
};

export default function PublishButtons({ workflowId, connectedPlatforms, publications }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});

  async function publish(platform: string) {
    setLoading(platform);
    setMessages((m) => ({ ...m, [platform]: "" }));
    try {
      const res = await fetch(`/api/publish/${platform}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Bilinmeyen hata");
      setMessages((m) => ({ ...m, [platform]: `Yayınlandı! ${json.remoteUrl ?? ""}`.trim() }));
    } catch (err) {
      setMessages((m) => ({ ...m, [platform]: err instanceof Error ? err.message : String(err) }));
    } finally {
      setLoading(null);
    }
  }

  if (connectedPlatforms.length === 0) {
    return (
      <p className="muted">
        Henüz bağlı bir hesap yok — <a href="/accounts">Bağlı Hesaplar</a> sayfasından bir platform bağla.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {connectedPlatforms.map((platform) => {
        const published = publications[platform];
        return (
          <div key={platform}>
            <div className="row">
              <span className="text-sm font-medium text-ink">{PLATFORM_LABEL[platform] ?? platform}</span>
              <button
                type="button"
                className="secondary"
                onClick={() => publish(platform)}
                disabled={loading !== null}
              >
                {loading === platform
                  ? "Yayınlanıyor..."
                  : published?.status === "published"
                    ? "Yeniden Yayınla"
                    : `${PLATFORM_LABEL[platform] ?? platform}'da Yayınla`}
              </button>
            </div>
            {published?.status === "published" && published.remoteUrl && (
              <p className="muted mt-1">
                Daha önce yayınlandı:{" "}
                <a href={published.remoteUrl} target="_blank" rel="noreferrer">
                  {published.remoteUrl}
                </a>
              </p>
            )}
            {messages[platform] && <p className="muted mt-1">{messages[platform]}</p>}
          </div>
        );
      })}
    </div>
  );
}
