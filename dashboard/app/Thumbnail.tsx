"use client";

import { useEffect, useState } from "react";

export default function Thumbnail({ artifactId }: { artifactId: string | null }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!artifactId) return;
    fetch(`/api/artifacts/${artifactId}/signed-url`)
      .then((r) => r.json())
      .then((j) => setUrl(j.url ?? null))
      .catch(() => setUrl(null));
  }, [artifactId]);

  if (!url) {
    return (
      <div className="flex aspect-[9/16] w-full items-center justify-center rounded-t-xl bg-slate-100 text-3xl">
        🎬
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="aspect-[9/16] w-full rounded-t-xl object-cover" />;
}
