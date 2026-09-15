import { supabaseServer } from "./supabase";

export type Platform = "youtube" | "instagram" | "tiktok";

export interface PlatformConnectionRow {
  platform: Platform;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  account_name: string | null;
  account_id: string | null;
  extra: Record<string, unknown>;
  connected_at: string;
  updated_at: string;
}

export interface ConnectionUpsert {
  platform: Platform;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
  accountName?: string | null;
  accountId?: string | null;
  extra?: Record<string, unknown>;
}

export async function saveConnection(input: ConnectionUpsert): Promise<void> {
  const client = supabaseServer();
  const { error } = await client.from("platform_connections").upsert({
    platform: input.platform,
    access_token: input.accessToken,
    refresh_token: input.refreshToken ?? null,
    expires_at: input.expiresAt ?? null,
    account_name: input.accountName ?? null,
    account_id: input.accountId ?? null,
    extra: input.extra ?? {},
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function getConnection(platform: Platform): Promise<PlatformConnectionRow | null> {
  const client = supabaseServer();
  const { data, error } = await client
    .from("platform_connections")
    .select("*")
    .eq("platform", platform)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as PlatformConnectionRow) ?? null;
}

export async function listConnections(): Promise<PlatformConnectionRow[]> {
  const client = supabaseServer();
  const { data, error } = await client.from("platform_connections").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as PlatformConnectionRow[];
}

export async function deleteConnection(platform: Platform): Promise<void> {
  const client = supabaseServer();
  const { error } = await client.from("platform_connections").delete().eq("platform", platform);
  if (error) throw new Error(error.message);
}

// Token süresi dolmuşsa/dolmak üzereyse (YouTube/TikTok için) sessizce
// yeniler ve veritabanını günceller. Instagram'ın uzun ömürlü token'ı
// (~60 gün) bu mekanizmayı desteklemiyor — süresi dolunca kullanıcının
// hesabı /accounts sayfasından yeniden bağlaması gerekir.
export async function getValidAccessToken(platform: Platform): Promise<string> {
  const connection = await getConnection(platform);
  if (!connection) throw new Error(`${platform} hesabı bağlı değil. Önce Bağlı Hesaplar sayfasından bağla.`);

  const expiresAt = connection.expires_at ? new Date(connection.expires_at).getTime() : null;
  const needsRefresh = expiresAt !== null && expiresAt - Date.now() < 5 * 60 * 1000;

  if (needsRefresh && connection.refresh_token) {
    if (platform === "youtube") {
      const { refreshAccessToken } = await import("./oauth/youtube");
      const r = await refreshAccessToken(connection.refresh_token);
      await saveConnection({
        platform,
        accessToken: r.accessToken,
        refreshToken: connection.refresh_token,
        expiresAt: r.expiresAt,
        accountName: connection.account_name,
        accountId: connection.account_id,
        extra: connection.extra,
      });
      return r.accessToken;
    }
    if (platform === "tiktok") {
      const { refreshAccessToken } = await import("./oauth/tiktok");
      const r = await refreshAccessToken(connection.refresh_token);
      await saveConnection({
        platform,
        accessToken: r.accessToken,
        refreshToken: connection.refresh_token,
        expiresAt: r.expiresAt,
        accountName: connection.account_name,
        accountId: connection.account_id,
        extra: connection.extra,
      });
      return r.accessToken;
    }
  }

  return connection.access_token;
}

export async function recordPublication(input: {
  workflowId: string;
  platform: Platform;
  status: "published" | "failed";
  remoteId?: string | null;
  remoteUrl?: string | null;
  error?: string | null;
}): Promise<void> {
  const client = supabaseServer();
  const { error } = await client.from("publications").insert({
    workflow_id: input.workflowId,
    platform: input.platform,
    status: input.status,
    remote_id: input.remoteId ?? null,
    remote_url: input.remoteUrl ?? null,
    error: input.error ?? null,
  });
  if (error) throw new Error(error.message);
}
