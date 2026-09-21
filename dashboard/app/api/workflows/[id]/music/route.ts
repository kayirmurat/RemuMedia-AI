import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase";
import musicManifest from "../../../../../lib/musicManifest.json";

const VALID_TRACK_IDS = new Set((musicManifest as { id: string }[]).map((t) => t.id));

// Senaryo onayı (review) aşamasında, henüz musicSelection adımı hiç
// çalışmamışken tercih edilen parçayı kaydeder — VoicePicker'daki
// /api/workflows/[id]/voice ile aynı desen: herhangi bir adımı
// sıfırlamaz/tetiklemez, sadece "musicSelection" adımı ileride çalıştığında
// kullanacağı context alanını yazar (bkz. core/workflow/steps/musicSelection.ts).
// trackId boş/"auto" gönderilirse override temizlenir — yapay zeka kendi seçer.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const trackId = String(body.trackId ?? "").trim();
    if (trackId && !VALID_TRACK_IDS.has(trackId)) {
      return NextResponse.json({ error: "Geçersiz parça seçimi." }, { status: 400 });
    }

    const client = supabaseServer();
    const { data, error } = await client
      .from("workflows")
      .select("context")
      .eq("id", params.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: "Workflow bulunamadı." }, { status: 404 });

    const context = { ...(data.context as Record<string, unknown>), musicTrackOverride: trackId || undefined };
    const { error: updateError } = await client
      .from("workflows")
      .update({ context, updated_at: new Date().toISOString() })
      .eq("id", params.id);
    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
