import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase";
import { VOICE_OPTIONS } from "../../../../../lib/voiceOptions";

const VALID_VOICES = new Set<string>(VOICE_OPTIONS.map((v) => v.value));

// Senaryo onayı (review) aşamasında, henüz seslendirme adımı hiç çalışmamışken
// tercih edilen sesi kaydeder — herhangi bir adımı sıfırlamaz/tetiklemez,
// sadece "voice" adımı ileride çalıştığında kullanacağı context alanını yazar.
// Bu sayede kullanıcı video tamamlandıktan sonra sesi değiştirip pahalı bir
// yeniden montaj yapmak zorunda kalmıyor.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const voiceName = String(body.voiceName ?? "");
    if (!VALID_VOICES.has(voiceName)) {
      return NextResponse.json({ error: "Geçersiz ses seçimi." }, { status: 400 });
    }

    const client = supabaseServer();
    const { data, error } = await client
      .from("workflows")
      .select("context")
      .eq("id", params.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: "Workflow bulunamadı." }, { status: 404 });

    const context = { ...(data.context as Record<string, unknown>), voiceName };
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
