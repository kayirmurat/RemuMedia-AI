import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, supabaseBucket } from "../../../../../lib/supabase";

const TEN_MINUTES = 60 * 10;

export async function GET(_req: NextRequest, { params }: { params: { filename: string } }) {
  try {
    const client = supabaseServer();
    const { data, error } = await client.storage
      .from(supabaseBucket())
      .createSignedUrl(`music/${params.filename}`, TEN_MINUTES);
    if (error) throw new Error(error.message);
    return NextResponse.json({ url: data.signedUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
