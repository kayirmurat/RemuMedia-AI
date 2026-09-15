import { NextRequest, NextResponse } from "next/server";
import * as youtube from "../../../../../lib/oauth/youtube";
import * as instagram from "../../../../../lib/oauth/instagram";
import * as tiktok from "../../../../../lib/oauth/tiktok";
import { saveConnection, type Platform } from "../../../../../lib/platformConnections";

export async function GET(req: NextRequest, { params }: { params: { platform: string } }) {
  const platform = params.platform as Platform;
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL(`/accounts?error=Yetkilendirme+iptal+edildi`, req.url));
  }

  try {
    const redirectUri = `${req.nextUrl.origin}/api/auth/${platform}/callback`;

    if (platform === "youtube") {
      const r = await youtube.exchangeCode(code, redirectUri);
      await saveConnection({
        platform,
        accessToken: r.accessToken,
        refreshToken: r.refreshToken,
        expiresAt: r.expiresAt,
        accountName: r.accountName,
        accountId: r.accountId,
      });
    } else if (platform === "instagram") {
      const r = await instagram.exchangeCode(code, redirectUri);
      await saveConnection({
        platform,
        accessToken: r.accessToken,
        accountName: r.accountName,
        accountId: r.accountId,
        extra: r.extra,
      });
    } else if (platform === "tiktok") {
      const r = await tiktok.exchangeCode(code, redirectUri);
      await saveConnection({
        platform,
        accessToken: r.accessToken,
        refreshToken: r.refreshToken,
        expiresAt: r.expiresAt,
        accountName: r.accountName,
        accountId: r.accountId,
      });
    } else {
      throw new Error("Bilinmeyen platform.");
    }

    return NextResponse.redirect(new URL(`/accounts?connected=${platform}`, req.url));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(new URL(`/accounts?error=${encodeURIComponent(message)}`, req.url));
  }
}
