"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AccountCard({
  platform,
  label,
  configured,
  connection,
  note,
}: {
  platform: string;
  label: string;
  configured: boolean;
  connection: { accountName: string | null; connectedAt: string } | null;
  note?: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function disconnect() {
    setLoading(true);
    try {
      await fetch(`/api/auth/${platform}/disconnect`, { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card flex items-center justify-between gap-4">
      <div>
        <p className="font-semibold text-ink">{label}</p>
        {connection ? (
          <p className="muted mt-1">
            Bağlı: <strong className="text-ink">{connection.accountName ?? "hesap"}</strong> ·{" "}
            {new Date(connection.connectedAt).toLocaleDateString("tr-TR")}
          </p>
        ) : (
          <p className="muted mt-1">Bağlı değil{!configured && " · henüz yapılandırılmadı"}</p>
        )}
        {note && <p className="muted mt-1 max-w-md">{note}</p>}
      </div>
      {connection ? (
        <button type="button" className="secondary" onClick={disconnect} disabled={loading}>
          {loading ? "..." : "Bağlantıyı Kes"}
        </button>
      ) : (
        <a href={`/api/auth/${platform}/connect`} className="button">
          Bağlan
        </a>
      )}
    </div>
  );
}
