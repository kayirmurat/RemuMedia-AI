import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, supabaseBucket } from "../../../../../lib/supabase";
import { storageKeyFromPath } from "../../../../../lib/types";

const ONE_HOUR = 60 * 60;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const client = supabaseServer();
    const { data, error } = await client.from("artifacts").select("path").eq("id", params.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: "Artifact bulunamadı." }, { status: 404 });

    const key = storageKeyFromPath(data.path);
    if (!key) return NextResponse.json({ error: "Bu artifact Supabase Storage'da değil." }, { status: 400 });

    const { data: signed, error: signError } = await client.storage
      .from(supabaseBucket())
      .createSignedUrl(key, ONE_HOUR);
    if (signError) throw new Error(signError.message);

    return NextResponse.json({ url: signed.signedUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
