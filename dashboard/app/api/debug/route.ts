import { NextResponse } from "next/server";
import { getSupabaseConfigError, supabaseServer } from "../../../lib/supabase";

export async function GET() {
  const configError = getSupabaseConfigError();
  if (configError) return NextResponse.json({ configError });

  const client = supabaseServer();

  const unfiltered = await client
    .from("workflows")
    .select("id,topic,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const noOrder = await client.from("workflows").select("id,topic,created_at");

  return NextResponse.json({
    unfiltered: { data: unfiltered.data, error: unfiltered.error },
    noOrder: { data: noOrder.data, error: noOrder.error },
  });
}
