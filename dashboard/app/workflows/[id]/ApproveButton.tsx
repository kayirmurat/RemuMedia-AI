"use client";

import { useState } from "react";

export default function ApproveButton({ artifactId, approved }: { artifactId: string; approved: boolean }) {
  const [isApproved, setIsApproved] = useState(approved);
  const [loading, setLoading] = useState(false);

  async function approve() {
    setLoading(true);
    try {
      const res = await fetch(`/api/artifacts/${artifactId}/approve`, { method: "POST" });
      if (res.ok) setIsApproved(true);
    } finally {
      setLoading(false);
    }
  }

  if (isApproved) {
    return <p style={{ color: "var(--ok)", fontWeight: 600 }}>✅ Onaylandı</p>;
  }

  return (
    <button type="button" onClick={approve} disabled={loading}>
      {loading ? "..." : "Onayla"}
    </button>
  );
}
