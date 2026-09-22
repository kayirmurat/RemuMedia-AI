import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { VideoGenerateOptions, VideoProvider, VideoResult } from "../../providers/video.js";
import { withRetry } from "../../util/retry.js";
import { createLogger, type Logger } from "../../logger/logger.js";

// BytePlus ModelArk (Seedance'ın resmi, uluslararası erişimli barındırıcısı —
// eski adıyla Volcengine Ark). docs.byteplus.com/ModelArk/Video_Generation_API.
const DEFAULT_BASE_URL = "https://ark.ap-southeast.bytepluses.com/api/v3";
// DİKKAT: bu tam model ID'sini kendi BytePlus konsolündeki "Model erişimi"
// sayfasından doğrula (SEEDANCE_MODEL_ID ile ezilebilir) — bu değer sadece
// makul bir varsayılan, BytePlus modeli farklı bir tarih/varyant soneki ile
// yayınlamış olabilir.
const DEFAULT_MODEL_ID = "seedance-2-5-i2v";
// BytePlus ModelArk saniye başı sabit bir liste fiyatı yayınlamıyor (token
// bazlı faturalandırıyor) — bu yalnızca MAX_COST_PER_VIDEO güvenlik limitinin
// gerçek faturayı hafife almaması için kasıtlı olarak YÜKSEK tutulmuş bir
// TAHMİN. Gerçek faturanı BytePlus konsolünden kontrol et, gerekirse
// SEEDANCE_PRICE_PER_SECOND_USD ile ez.
const DEFAULT_PRICE_PER_SECOND_USD = 0.15;
const MIN_DURATION_SECONDS = 4;
const MAX_DURATION_SECONDS = 30;
const POLL_INTERVAL_MS = 5000;
// Video üretimi görsel üretiminden çok daha yavaş (dakikalar sürebilir).
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

interface SeedanceProviderOptions {
  baseUrl?: string;
  model?: string;
  pricePerSecondUsd?: number;
}

function imageToDataUri(imagePath: string): string {
  const ext = path.extname(imagePath).slice(1).toLowerCase() || "png";
  const mime = ext === "jpg" ? "jpeg" : ext;
  const data = fs.readFileSync(imagePath).toString("base64");
  return `data:image/${mime};base64,${data}`;
}

interface SeedanceTaskCreateResponse {
  id?: string;
  error?: { message?: string; code?: string };
  message?: string;
}

interface SeedanceTaskStatusResponse {
  status?: string;
  content?: { video_url?: string };
  error?: { message?: string; code?: string };
}

export class SeedanceVideoProvider implements VideoProvider {
  private baseUrl: string;
  private model: string;
  private pricePerSecond: number;
  private logger: Logger;

  constructor(
    private apiKey: string,
    private outputDir: string,
    options: SeedanceProviderOptions = {},
    logger: Logger = createLogger(),
  ) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.model = options.model ?? DEFAULT_MODEL_ID;
    this.pricePerSecond = options.pricePerSecondUsd ?? DEFAULT_PRICE_PER_SECOND_USD;
    this.logger = logger;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  async generateFromImage(
    imagePath: string,
    prompt: string,
    options: VideoGenerateOptions = {},
  ): Promise<VideoResult> {
    const durationSeconds = Math.max(
      MIN_DURATION_SECONDS,
      Math.min(MAX_DURATION_SECONDS, Math.round(options.durationSeconds ?? MIN_DURATION_SECONDS)),
    );

    const content: Array<Record<string, unknown>> = [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: imageToDataUri(imagePath) } },
    ];
    if (options.lastFrameImagePath) {
      content.push({
        type: "image_url",
        image_url: { url: imageToDataUri(options.lastFrameImagePath) },
        role: "last_frame",
      });
    }

    const body: Record<string, unknown> = {
      model: this.model,
      content,
      duration: durationSeconds,
      generate_audio: false,
    };
    if (options.aspectRatio) {
      body.ratio = options.aspectRatio;
    }

    const taskId = await withRetry(
      async () => {
        const res = await fetch(`${this.baseUrl}/contents/generations/tasks`, {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify(body),
        });
        const json = (await res.json().catch(() => null)) as SeedanceTaskCreateResponse | null;
        if (!res.ok || !json?.id) {
          throw new Error(
            `Seedance video görevi başlatılamadı (HTTP ${res.status}): ` +
              `${json?.error?.message ?? json?.message ?? JSON.stringify(json)}`,
          );
        }
        return json.id;
      },
      {
        onRetry: (attempt, error, delayMs) =>
          this.logger.warn("Seedance video görevi başlatma isteği geçici olarak başarısız oldu, tekrar deneniyor", {
            attempt,
            delayMs,
            error: error instanceof Error ? error.message : String(error),
          }),
      },
    );

    const videoUrl = await this.pollUntilDone(taskId);

    fs.mkdirSync(this.outputDir, { recursive: true });
    const filePath = path.join(this.outputDir, `${randomUUID()}.mp4`);
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) {
      throw new Error(`Seedance video dosyası indirilemedi (HTTP ${videoRes.status}): ${videoUrl}`);
    }
    fs.writeFileSync(filePath, Buffer.from(await videoRes.arrayBuffer()));

    return {
      filePath,
      provider: "bytedance",
      model: this.model,
      costUsd: durationSeconds * this.pricePerSecond,
      durationSeconds,
    };
  }

  private async pollUntilDone(taskId: string): Promise<string> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      const res = await fetch(`${this.baseUrl}/contents/generations/tasks/${taskId}`, {
        headers: this.headers(),
      });
      const json = (await res.json().catch(() => null)) as SeedanceTaskStatusResponse | null;
      if (!res.ok) {
        throw new Error(`Seedance video durumu sorgulanamadı (HTTP ${res.status}): ${JSON.stringify(json)}`);
      }

      if (json?.status === "succeeded") {
        const videoUrl = json.content?.video_url;
        if (!videoUrl) {
          throw new Error(`Seedance video görevi tamamlandı ama video_url yok. Görev ID: ${taskId}`);
        }
        return videoUrl;
      }

      // ModelArk 'cancelled' yazıyor; 'canceled' savunma amaçlı ele alınıyor.
      if (["failed", "expired", "cancelled", "canceled"].includes(json?.status ?? "")) {
        const detail = json?.error?.message ?? json?.error?.code ?? JSON.stringify(json);
        throw new Error(`Seedance video üretimi başarısız oldu (${json?.status}). Görev ID: ${taskId}. ${detail}`);
      }
      // "queued" | "running" gibi durumlarda döngüye devam edilir.
    }
    throw new Error(`Seedance video üretimi zaman aşımına uğradı (${POLL_TIMEOUT_MS / 1000}s). Görev ID: ${taskId}`);
  }
}
