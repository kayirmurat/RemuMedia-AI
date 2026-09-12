"use client";

import { useEffect, useState } from "react";
import type { ArtifactRow } from "../../../lib/types";

export default function ArtifactPreview({ artifact }: { artifact: ArtifactRow }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/artifacts/${artifact.id}/signed-url`)
      .then((r) => r.json())
      .then((j) => setUrl(j.url ?? null))
      .catch(() => setUrl(null));
  }, [artifact.id]);

  if (!url) return <p className="muted">Yükleniyor...</p>;

  if (artifact.type === "final_video") {
    return (
      <div>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video src={url} controls style={{ maxWidth: "100%", borderRadius: 8 }} />
        <p>
          <a href={url} target="_blank" rel="noreferrer">
            İndir
          </a>
        </p>
      </div>
    );
  }

  if (artifact.type === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" />;
  }

  return (
    <a href={url} target="_blank" rel="noreferrer">
      Dosyayı aç
    </a>
  );
}
