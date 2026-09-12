import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const client = supabaseServer();
    const { data, error } = await client
      .from("artifacts")
      .select("metadata")
      .eq("id", params.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: "Artifact bulunamadı." }, { status: 404 });

    const metadata = { ...(data.metadata as Record<string, unknown>), approved: true, approvedAt: new Date().toISOString() };
    const { error: updateError } = await client.from("artifacts").update({ metadata }).eq("id", params.id);
    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
