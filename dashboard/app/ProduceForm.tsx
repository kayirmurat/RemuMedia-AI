"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function ProduceForm() {
  const [topic, setTopic] = useState("");
  const [sceneCount, setSceneCount] = useState("");
  const [productionNote, setProductionNote] = useState("");
  const [maxCost, setMaxCost] = useState("2.0");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/produce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "new", topic, sceneCount, productionNote, maxCost }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Bilinmeyen hata");
      setMessage("Başlatıldı! Senaryo hazır olunca (yaklaşık 1-2 dakika) burada görünecek.");
      setTopic("");
      setSceneCount("");
      setProductionNote("");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div style={{ marginBottom: 10 }}>
        <label className="muted" htmlFor="topic">
          Konu (opsiyonel — boş bırakırsan sistem kendi ilginç bir konu seçer)
        </label>
        <div style={{ marginTop: 6 }}>
          <input
            type="text"
            id="topic"
            placeholder="örn. Kahve nasıl keşfedildi? (boş bırakabilirsin)"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <label className="muted" htmlFor="productionNote">
          Prodüksiyon notu (opsiyonel — ton/format isteği; konu olarak kullanılmaz)
        </label>
        <div style={{ marginTop: 6 }}>
          <input
            type="text"
            id="productionNote"
            placeholder="örn. eğlenceli bir tonda olsun"
            value={productionNote}
            onChange={(e) => setProductionNote(e.target.value)}
          />
        </div>
      </div>

      <div className="row" style={{ justifyContent: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <label className="muted" htmlFor="sceneCount">
          Sahne sayısı
        </label>
        <input
          type="text"
          id="sceneCount"
          placeholder="otomatik"
          value={sceneCount}
          onChange={(e) => setSceneCount(e.target.value)}
          style={{ width: 80 }}
        />
        <label className="muted" htmlFor="maxCost">
          Maks. maliyet ($)
        </label>
        <input
          type="text"
          id="maxCost"
          value={maxCost}
          onChange={(e) => setMaxCost(e.target.value)}
          style={{ width: 80 }}
        />
        <button type="submit" disabled={loading}>
          {loading ? "Başlatılıyor..." : "Üret"}
        </button>
      </div>
      {message && (
        <p className="muted" style={{ marginTop: 10 }}>
          {message}
        </p>
      )}
    </form>
  );
}
