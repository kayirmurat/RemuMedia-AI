import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase";
import { getArtifactSignedUrl, readArtifactText } from "../../../../lib/content";
import { getConnection, getValidAccessToken, recordPublication, type Platform } from "../../../../lib/platformConnections";
import * as youtube from "../../../../lib/oauth/youtube";
import * as instagram from "../../../../lib/oauth/instagram";
import * as tiktok from "../../../../lib/oauth/tiktok";
import type { WorkflowRow, ArtifactRow } from "../../../../lib/types";

export async function POST(req: NextRequest, { params }: { params: { platform: string } }) {
  const platform = params.platform as Platform;
  const { workflowId } = await req.json();
  if (!workflowId) return NextResponse.json({ error: "workflowId gerekli." }, { status: 400 });

  try {
    const client = supabaseServer();
    const { data: workflowData, error: workflowError } = await client
      .from("workflows")
      .select("*")
      .eq("id", workflowId)
      .maybeSingle();
    if (workflowError) throw new Error(workflowError.message);
    if (!workflowData) throw new Error("Workflow bulunamadı.");
    const workflow = workflowData as WorkflowRow;

    const { data: artifactsData, error: artifactsError } = await client
      .from("artifacts")
      .select("*")
      .eq("workflow_id", workflowId)
      .eq("type", "final_video")
      .order("created_at", { ascending: false })
      .limit(1);
    if (artifactsError) throw new Error(artifactsError.message);
    const finalVideo = (artifactsData as ArtifactRow[] | null)?.[0];
    if (!finalVideo) throw new Error("Bu üretimin final videosu bulunamadı.");

    const videoUrl = await getArtifactSignedUrl(finalVideo.path);
    const scriptArtifactRes = await client
      .from("artifacts")
      .select("*")
      .eq("workflow_id", workflowId)
      .eq("type", "script")
      .order("created_at", { ascending: false })
      .limit(1);
    const scriptArtifact = (scriptArtifactRes.data as ArtifactRow[] | null)?.[0];
    const scriptText = scriptArtifact ? await readArtifactText(scriptArtifact.path) : "";

    const thumbnailRes = await client
      .from("artifacts")
      .select("*")
      .eq("workflow_id", workflowId)
      .eq("type", "thumbnail")
      .order("created_at", { ascending: false })
      .limit(1);
    const thumbnailArtifact = (thumbnailRes.data as ArtifactRow[] | null)?.[0];
    const coverUrl = thumbnailArtifact ? await getArtifactSignedUrl(thumbnailArtifact.path) : null;

    let result: { remoteId: string; remoteUrl: string; warning?: string };

    if (platform === "youtube") {
      const accessToken = await getValidAccessToken("youtube");
      const uploaded = await youtube.uploadVideo({
        accessToken,
        videoUrl,
        title: workflow.topic,
        description: scriptText || workflow.topic,
      });
      result = { remoteId: uploaded.videoId, remoteUrl: uploaded.url };
      // Kapak fotoğrafı yükleme, kanal telefonla doğrulanmamışsa başarısız
      // olabiliyor — bu, videonun kendisinin başarıyla yayınlanmasını
      // engellemesin, sadece kullanıcıya bir uyarı olarak dönsün.
      if (coverUrl) {
        try {
          await youtube.setThumbnail({ accessToken, videoId: uploaded.videoId, imageUrl: coverUrl });
        } catch (thumbError) {
          result.warning = `Video yayınlandı ama kapak fotoğrafı ayarlanamadı: ${
            thumbError instanceof Error ? thumbError.message : String(thumbError)
          }`;
        }
      }
    } else if (platform === "instagram") {
      const connection = await getConnection("instagram");
      if (!connection) throw new Error("Instagram hesabı bağlı değil.");
      const published = await instagram.publishReel({
        igAccountId: connection.account_id!,
        accessToken: connection.access_token,
        videoUrl,
        caption: scriptText || workflow.topic,
        coverUrl: coverUrl ?? undefined,
      });
      result = { remoteId: published.mediaId, remoteUrl: published.url };
    } else if (platform === "tiktok") {
      // NOT: TikTok'un Content Posting API'si özel bir görseli kapak olarak
      // yüklemeyi desteklemiyor — sadece videonun içinden bir zaman damgası
      // seçilebiliyor (video_cover_timestamp_ms). Bu yüzden coverUrl burada
      // kullanılmıyor; TikTok kendi varsayılan kare seçimini yapıyor.
      const accessToken = await getValidAccessToken("tiktok");
      const published = await tiktok.publishVideo({
        accessToken,
        videoUrl,
        title: workflow.topic,
        publiclyPostable: process.env.TIKTOK_AUDITED === "true",
      });
      result = { remoteId: published.publishId, remoteUrl: "" };
    } else {
      throw new Error("Bilinmeyen platform.");
    }

    await recordPublication({
      workflowId,
      platform,
      status: "published",
      remoteId: result.remoteId,
      remoteUrl: result.remoteUrl || null,
      // "error" alanı burada gerçek bir hatayı değil, yayın başarılı olsa
      // da örn. kapak fotoğrafı ayarlanamadığında dönen uyarıyı taşıyor —
      // önceden bu uyarı sadece o anki ekranda gösterilip kayboluyordu,
      // artık kalıcı olarak saklanıp workflow sayfasında görünüyor.
      error: result.warning ?? null,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordPublication({ workflowId, platform, status: "failed", error: message }).catch(() => {});
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
