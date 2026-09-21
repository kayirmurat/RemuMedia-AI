import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, supabaseBucket } from "../../../../lib/supabase";
import { VOICE_OPTIONS } from "../../../../lib/voiceOptions";

const VALID_VOICES = new Set<string>(VOICE_OPTIONS.map((v) => v.value));
const PREVIEW_TEXT = "Merhaba, ben bu videonun anlatıcısıyım. Bu sesi beğendin mi?";
const SIGNED_URL_TTL_SECONDS = 600;

// Her ses için önizleme kaydı sadece BİR KEZ üretilip Supabase Storage'a
// yazılır (voice-previews/<ses>.mp3) — sonraki her "Dinle" tıklaması sadece
// imzalı bir URL alır, tekrar tekrar OpenAI'ye maliyet çıkarmaz.
export async function GET(_req: NextRequest, { params }: { params: { voiceName: string } }) {
  const voiceName = params.voiceName;
  if (!VALID_VOICES.has(voiceName)) {
    return NextResponse.json({ error: "Geçersiz ses." }, { status: 400 });
  }

  try {
    const client = supabaseServer();
    const bucket = supabaseBucket();
    const key = `voice-previews/${voiceName}.mp3`;

    const existing = await client.storage.from(bucket).createSignedUrl(key, SIGNED_URL_TTL_SECONDS);
    if (!existing.error && existing.data?.signedUrl) {
      return NextResponse.json({ url: existing.data.signedUrl });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Ses önizlemesi için Vercel'de OPENAI_API_KEY env değişkeni tanımlı değil." },
        { status: 500 },
      );
    }

    const ttsRes = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "tts-1", voice: voiceName, input: PREVIEW_TEXT }),
    });
    if (!ttsRes.ok) throw new Error(`OpenAI TTS hatası: ${await ttsRes.text()}`);
    const audioBuffer = Buffer.from(await ttsRes.arrayBuffer());

    const { error: uploadError } = await client.storage
      .from(bucket)
      .upload(key, audioBuffer, { contentType: "audio/mpeg", upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    const signed = await client.storage.from(bucket).createSignedUrl(key, SIGNED_URL_TTL_SECONDS);
    if (signed.error || !signed.data?.signedUrl) {
      throw new Error(signed.error?.message ?? "İmzalı URL alınamadı.");
    }
    return NextResponse.json({ url: signed.data.signedUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
