import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import type { ImageGenerateOptions, ImageProvider, ImageResult } from "../../providers/image.js";
import { withRetry } from "../../util/retry.js";
import { createLogger, type Logger } from "../../logger/logger.js";

// Yaklaşık fiyatlandırma (gpt-image-1, standard kalite) — sadece TAHMİN.
const PRICE_PER_IMAGE_USD = 0.04;

export class OpenAIImageProvider implements ImageProvider {
  private client: OpenAI;
  private model: string;
  private outputDir: string;
  private logger: Logger;

  constructor(apiKey: string, outputDir: string, model = "gpt-image-1", logger: Logger = createLogger()) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
    this.outputDir = outputDir;
    this.logger = logger;
  }

  async generate(prompt: string, options: ImageGenerateOptions = {}): Promise<ImageResult> {
    const response = await withRetry(
      () =>
        this.client.images.generate({
          model: this.model,
          prompt,
          size: options.size ?? "1024x1536",
        }),
      {
        onRetry: (attempt, error, delayMs) =>
          this.logger.warn("OpenAI görsel isteği geçici olarak başarısız oldu, tekrar deneniyor", {
            attempt,
            delayMs,
            error: error instanceof Error ? error.message : String(error),
          }),
      },
    );

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error("OpenAI görsel üretim yanıtında veri (b64_json) yok");
    }

    fs.mkdirSync(this.outputDir, { recursive: true });
    const filePath = path.join(this.outputDir, `${randomUUID()}.png`);
    fs.writeFileSync(filePath, Buffer.from(b64, "base64"));

    return { filePath, provider: "openai", model: this.model, costUsd: PRICE_PER_IMAGE_USD };
  }
}
