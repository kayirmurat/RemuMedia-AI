import { NextRequest, NextResponse } from "next/server";
import * as youtube from "../../../../../lib/oauth/youtube";
import * as instagram from "../../../../../lib/oauth/instagram";
import * as tiktok from "../../../../../lib/oauth/tiktok";

export async function GET(req: NextRequest, { params }: { params: { platform: string } }) {
  const redirectUri = `${req.nextUrl.origin}/api/auth/${params.platform}/callback`;
  try {
    if (params.platform === "youtube") {
      if (!youtube.isYoutubeConfigured()) {
        throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET tanımlı değil.");
      }
      return NextResponse.redirect(youtube.getAuthorizeUrl(redirectUri));
    }
    if (params.platform === "instagram") {
      if (!instagram.isInstagramConfigured()) {
        throw new Error("META_APP_ID / META_APP_SECRET tanımlı değil.");
      }
      return NextResponse.redirect(instagram.getAuthorizeUrl(redirectUri));
    }
    if (params.platform === "tiktok") {
      if (!tiktok.isTiktokConfigured()) {
        throw new Error("TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET tanımlı değil.");
      }
      return NextResponse.redirect(tiktok.getAuthorizeUrl(redirectUri));
    }
    throw new Error("Bilinmeyen platform.");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(new URL(`/accounts?error=${encodeURIComponent(message)}`, req.url));
  }
}
