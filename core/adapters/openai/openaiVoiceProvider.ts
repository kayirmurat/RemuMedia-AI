import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import type { VoiceProvider, VoiceResult } from "../../providers/voice.js";
import { probeMedia } from "../ffmpeg/ffprobe.js";
import { withRetry } from "../../util/retry.js";
import { createLogger, type Logger } from "../../logger/logger.js";

// Yaklaşık fiyatlandırma (tts-1) — sadece TAHMİN.
const PRICE_PER_1K_CHARS_USD = 0.015;

export class OpenAIVoiceProvider implements VoiceProvider {
  private client: OpenAI;
  private model: string;
  private outputDir: string;
  private logger: Logger;

  constructor(apiKey: string, outputDir: string, model = "tts-1", logger: Logger = createLogger()) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
    this.outputDir = outputDir;
    this.logger = logger;
  }

  // "nova": OpenAI'nin daha doğal/canlı, feminen tonlu sesi — "alloy" (nötr)
  // yerine varsayılan yapıldı, anlatım tonunu daha ilgi çekici kılıyor.
  async synthesize(text: string, voice = "nova"): Promise<VoiceResult> {
    const buffer = await withRetry(
      async () => {
        const response = await this.client.audio.speech.create({
          model: this.model,
          voice,
          input: text,
        });
        return Buffer.from(await response.arrayBuffer());
      },
      {
        onRetry: (attempt, error, delayMs) =>
          this.logger.warn("OpenAI TTS isteği geçici olarak başarısız oldu, tekrar deneniyor", {
            attempt,
            delayMs,
            error: error instanceof Error ? error.message : String(error),
          }),
      },
    );

    fs.mkdirSync(this.outputDir, { recursive: true });
    const filePath = path.join(this.outputDir, `${randomUUID()}.mp3`);
    fs.writeFileSync(filePath, buffer);

    const probe = await probeMedia(filePath);
    const costUsd = (text.length / 1000) * PRICE_PER_1K_CHARS_USD;

    return {
      filePath,
      durationSeconds: probe.durationSeconds,
      provider: "openai",
      model: this.model,
      costUsd,
    };
  }
}
