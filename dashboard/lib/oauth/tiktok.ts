const SCOPES = ["video.publish", "video.upload", "user.info.basic"].join(",");

export function isTiktokConfigured(): boolean {
  return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
}

export function getAuthorizeUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    state: "remumedia",
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  open_id: string;
}

export async function exchangeCode(code: string, redirectUri: string) {
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) throw new Error(`TikTok token değişimi başarısız: ${await res.text()}`);
  const json = (await res.json()) as TokenResponse;

  const infoRes = await fetch(
    "https://open.tiktokapis.com/v2/user/info/?fields=display_name",
    { headers: { Authorization: `Bearer ${json.access_token}` } },
  );
  const infoJson = await infoRes.json();

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString(),
    accountName: infoJson.data?.user?.display_name ?? "TikTok hesabı",
    accountId: json.open_id,
  };
}

export async function refreshAccessToken(refreshToken: string) {
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`TikTok token yenileme başarısız: ${await res.text()}`);
  const json = (await res.json()) as TokenResponse;
  return { accessToken: json.access_token, expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString() };
}

// NOT: Geliştirici uygulaması TikTok'un "audit" sürecinden geçene kadar
// privacy_level SADECE "SELF_ONLY" (gizli/taslak) olabilir — herkese açık
// yayın için TikTok'un onayı gerekiyor (bkz. README).
export async function publishVideo(params: {
  accessToken: string;
  videoUrl: string;
  title: string;
  publiclyPostable: boolean;
}): Promise<{ publishId: string }> {
  const res = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      post_info: {
        title: params.title.slice(0, 150),
        privacy_level: params.publiclyPostable ? "PUBLIC_TO_EVERYONE" : "SELF_ONLY",
      },
      source_info: { source: "PULL_FROM_URL", video_url: params.videoUrl },
    }),
  });
  if (!res.ok) throw new Error(`TikTok yayınlama başlatılamadı: ${await res.text()}`);
  const json = await res.json();
  if (json.error?.code && json.error.code !== "ok") {
    throw new Error(`TikTok hata döndürdü: ${json.error.message ?? json.error.code}`);
  }
  return { publishId: json.data?.publish_id };
}
