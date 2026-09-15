const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
].join(" ");

export function isYoutubeConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function getAuthorizeUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export async function exchangeCode(code: string, redirectUri: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token değişimi başarısız: ${await res.text()}`);
  const json = (await res.json()) as TokenResponse;

  const channelRes = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
    { headers: { Authorization: `Bearer ${json.access_token}` } },
  );
  const channelJson = await channelRes.json();
  const channel = channelJson.items?.[0];

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString(),
    accountName: channel?.snippet?.title ?? "YouTube kanalı",
    accountId: channel?.id ?? null,
  };
}

export async function refreshAccessToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token yenileme başarısız: ${await res.text()}`);
  const json = (await res.json()) as TokenResponse;
  return {
    accessToken: json.access_token,
    expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString(),
  };
}

// YouTube resumable upload: önce metadata ile bir "upload session" açılır
// (Location header döner), sonra video byte'ları o URL'e PUT edilir.
export async function uploadVideo(params: {
  accessToken: string;
  videoUrl: string;
  title: string;
  description: string;
}): Promise<{ videoId: string; url: string }> {
  const initRes = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        snippet: { title: params.title.slice(0, 100), description: params.description.slice(0, 4900) },
        // NOT: YouTube "değiştirilmiş/sentetik içerik" (AI) etiketini şu an
        // Studio arayüzünden manuel işaretlemek gerekiyor — API alanı henüz
        // bu entegrasyonda doğrulanmadı. Her yüklemeden sonra Studio'da bu
        // videoyu açıp "İçerik detayları" adımında ilgili onay kutusunu
        // işaretlemeyi unutma.
        status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
      }),
    },
  );
  if (!initRes.ok) throw new Error(`YouTube upload başlatılamadı: ${await initRes.text()}`);
  const uploadUrl = initRes.headers.get("location");
  if (!uploadUrl) throw new Error("YouTube upload URL'i alınamadı");

  const videoRes = await fetch(params.videoUrl);
  if (!videoRes.ok) throw new Error("Video dosyası indirilemedi");
  const videoBuffer = await videoRes.arrayBuffer();

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4" },
    body: videoBuffer,
  });
  if (!putRes.ok) throw new Error(`YouTube video yüklenemedi: ${await putRes.text()}`);
  const json = await putRes.json();

  return { videoId: json.id, url: `https://youtube.com/shorts/${json.id}` };
}
