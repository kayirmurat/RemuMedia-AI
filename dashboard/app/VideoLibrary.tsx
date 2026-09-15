"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Thumbnail from "./Thumbnail";

export interface LibraryItem {
  id: string;
  topic: string;
  createdAt: string;
  cost: number;
  phase: "review" | "running" | "completed" | "failed";
  thumbnailArtifactId: string | null;
}

const PHASE_LABEL: Record<LibraryItem["phase"], string> = {
  review: "İnceleme bekliyor",
  running: "Devam ediyor",
  completed: "Tamamlandı",
  failed: "Hata",
};

type SortKey = "date_desc" | "date_asc" | "cost_desc" | "cost_asc";

export default function VideoLibrary({ items }: { items: LibraryItem[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("date_desc");

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    let list = items;
    if (q) {
      list = list.filter((item) => item.topic.toLocaleLowerCase("tr").includes(q));
    }
    return [...list].sort((a, b) => {
      switch (sort) {
        case "date_asc":
          return a.createdAt.localeCompare(b.createdAt);
        case "cost_desc":
          return b.cost - a.cost;
        case "cost_asc":
          return a.cost - b.cost;
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });
  }, [items, query, sort]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          placeholder="Konuya göre ara..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-xs"
        />
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="sm:w-56">
          <option value="date_desc">En yeni</option>
          <option value="date_asc">En eski</option>
          <option value="cost_desc">Maliyet: yüksekten düşüğe</option>
          <option value="cost_asc">Maliyet: düşükten yükseğe</option>
        </select>
      </div>

      {filtered.length === 0 && <p className="muted">Eşleşen video yok.</p>}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {filtered.map((item) => (
          <Link
            key={item.id}
            href={`/workflows/${item.id}`}
            className="block overflow-hidden rounded-xl border border-border bg-card shadow-card no-underline transition-shadow hover:shadow-md"
          >
            <Thumbnail artifactId={item.thumbnailArtifactId} />
            <div className="p-3">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className={`badge badge-${item.phase}`}>{PHASE_LABEL[item.phase]}</span>
              </div>
              <p className="line-clamp-2 text-sm font-semibold text-ink">{item.topic}</p>
              <p className="muted mt-1">
                {new Date(item.createdAt).toLocaleDateString("tr-TR")} · ${item.cost.toFixed(3)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
