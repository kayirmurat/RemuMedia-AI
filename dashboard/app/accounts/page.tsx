import { getSupabaseConfigError } from "../../lib/supabase";
import { listConnections } from "../../lib/platformConnections";
import { isYoutubeConfigured } from "../../lib/oauth/youtube";
import { isInstagramConfigured } from "../../lib/oauth/instagram";
import { isTiktokConfigured } from "../../lib/oauth/tiktok";
import AccountCard from "./AccountCard";

export const dynamic = "force-dynamic";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: { connected?: string; error?: string };
}) {
  const configError = getSupabaseConfigError();
  if (configError) return <p className="text-danger">{configError}</p>;

  const connections = await listConnections();
  const byPlatform = Object.fromEntries(connections.map((c) => [c.platform, c]));

  return (
    <>
      <h1 className="text-xl font-bold text-ink">Bağlı Hesaplar</h1>
      <p className="muted mb-4">
        Videoları doğrudan bu hesaplara yayınlayabilmek için platformları buradan bağla.
      </p>

      {searchParams.connected && (
        <p className="mb-4 rounded-lg bg-ok-soft p-3 text-sm text-ok">Hesap başarıyla bağlandı.</p>
      )}
      {searchParams.error && (
        <p className="mb-4 rounded-lg bg-danger-soft p-3 text-sm text-danger">{searchParams.error}</p>
      )}

      <div className="flex flex-col gap-3">
        <AccountCard
          platform="youtube"
          label="YouTube"
          configured={isYoutubeConfigured()}
          connection={
            byPlatform.youtube
              ? { accountName: byPlatform.youtube.account_name, connectedAt: byPlatform.youtube.connected_at }
              : null
          }
          note="Bağlandıktan sonra hemen tam otomatik yayınlayabilirsin."
        />
        <AccountCard
          platform="instagram"
          label="Instagram"
          configured={isInstagramConfigured()}
          connection={
            byPlatform.instagram
              ? {
                  accountName: byPlatform.instagram.account_name,
                  connectedAt: byPlatform.instagram.connected_at,
                }
              : null
          }
          note="Instagram Business hesabı ve bağlı bir Facebook Sayfası gerektirir. Meta'nın app review'ü onaylanana kadar sadece test hesaplarıyla yayınlanabilir."
        />
        <AccountCard
          platform="tiktok"
          label="TikTok"
          configured={isTiktokConfigured()}
          connection={
            byPlatform.tiktok
              ? { accountName: byPlatform.tiktok.account_name, connectedAt: byPlatform.tiktok.connected_at }
              : null
          }
          note="TikTok'un audit süreci onaylanana kadar yayınlar sadece sana özel (gizli) olarak paylaşılabilir."
        />
      </div>
    </>
  );
}
