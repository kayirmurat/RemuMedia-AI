import { NextResponse } from "next/server";
import { deleteConnection, type Platform } from "../../../../../lib/platformConnections";

export async function POST(_req: Request, { params }: { params: { platform: string } }) {
  await deleteConnection(params.platform as Platform);
  return NextResponse.json({ ok: true });
}
