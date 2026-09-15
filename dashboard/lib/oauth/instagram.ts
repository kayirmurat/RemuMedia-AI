const GRAPH_VERSION = "v21.0";
const SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
].join(",");

export function isInstagramConfigured(): boolean {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

export function getAuthorizeUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
  });
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

export async function exchangeCode(code: string, redirectUri: string) {
  const tokenParams = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    redirect_uri: redirectUri,
    code,
  });
  const tokenRes = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?${tokenParams.toString()}`,
  );
  if (!tokenRes.ok) throw new Error(`Meta token değişimi başarısız: ${await tokenRes.text()}`);
  const { access_token: shortLivedToken } = await tokenRes.json();

  // Kısa ömürlü token'ı uzun ömürlüye (~60 gün) çevir.
  const exchangeParams = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    fb_exchange_token: shortLivedToken,
  });
  const longRes = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?${exchangeParams.toString()}`,
  );
  if (!longRes.ok) throw new Error(`Meta uzun ömürlü token alınamadı: ${await longRes.text()}`);
  const longJson = await longRes.json();
  const userToken = longJson.access_token as string;

  // Kullanıcının Facebook Sayfaları'nı ve onlara bağlı Instagram Business
  // hesabını bul — Reels yayınlama bu ikisini gerektiriyor.
  const pagesRes = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/me/accounts?access_token=${userToken}`,
  );
  const pagesJson = await pagesRes.json();
  const page = pagesJson.data?.[0];
  if (!page) {
    throw new Error(
      "Bağlı bir Facebook Sayfası bulunamadı. Instagram Reels yayınlamak için hesabının bir " +
        "Facebook Sayfası'na ve Business/Creator türünde bir Instagram hesabına bağlı olması gerekiyor.",
    );
  }

  const igRes = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`,
  );
  const igJson = await igRes.json();
  const igAccountId = igJson.instagram_business_account?.id;
  if (!igAccountId) {
    throw new Error(
      `"${page.name}" sayfasına bağlı bir Instagram Business hesabı bulunamadı. Instagram hesabını ` +
        "bu Facebook Sayfası'na bağladığından emin ol.",
    );
  }

  const igInfoRes = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${igAccountId}?fields=username&access_token=${page.access_token}`,
  );
  const igInfoJson = await igInfoRes.json();

  return {
    accessToken: page.access_token as string,
    accountName: (igInfoJson.username as string) ?? page.name,
    accountId: igAccountId as string,
    extra: { pageId: page.id, pageName: page.name },
  };
}

export async function publishReel(params: {
  igAccountId: string;
  accessToken: string;
  videoUrl: string;
  caption: string;
}): Promise<{ mediaId: string; url: string }> {
  const createRes = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${params.igAccountId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_type: "REELS",
        video_url: params.videoUrl,
        caption: params.caption.slice(0, 2200),
        access_token: params.accessToken,
      }),
    },
  );
  if (!createRes.ok) throw new Error(`Instagram medya konteyneri oluşturulamadı: ${await createRes.text()}`);
  const { id: creationId } = await createRes.json();

  // Instagram video'yu arka planda işliyor — FINISHED olana kadar bekle.
  let status = "IN_PROGRESS";
  for (let i = 0; i < 30 && status !== "FINISHED"; i++) {
    await new Promise((r) => setTimeout(r, 4000));
    const statusRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${creationId}?fields=status_code&access_token=${params.accessToken}`,
    );
    const statusJson = await statusRes.json();
    status = statusJson.status_code;
    if (status === "ERROR") throw new Error("Instagram video işleme sırasında hata verdi.");
  }
  if (status !== "FINISHED") throw new Error("Instagram video işleme zaman aşımına uğradı.");

  const publishRes = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${params.igAccountId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: creationId, access_token: params.accessToken }),
    },
  );
  if (!publishRes.ok) throw new Error(`Instagram yayınlama başarısız: ${await publishRes.text()}`);
  const { id: mediaId } = await publishRes.json();

  return { mediaId, url: `https://www.instagram.com/reel/${mediaId}/` };
}
